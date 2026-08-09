/* =========================================================
   1. FIREBASE INITIALIZATION
   ========================================================= */
const firebaseConfig = {
  apiKey: "AIzaSyB3gtg1nSKTBJOqkg1R0SAgNj8ina8gJdM",
  authDomain: "sharia-institute.firebaseapp.com",
  projectId: "sharia-institute",
  storageBucket: "sharia-institute.firebasestorage.app",
  messagingSenderId: "826631619554",
  appId: "1:826631619554:web:3bb123a51d33dd9728afbb",
  measurementId: "G-EHVEP9ZH7X"
};
if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
const db = firebase.firestore();

/* =========================================================
   2. APP CORE
   ========================================================= */
const app = {
  data: {
    currentUser: null, currentPage: 'dashboard', activeExamId: null,
    timerInterval: null, menuOpen: false,
    students: [], teachers: [], lessons: [], materials: [],
    exams: [], attendance: [], timetable: [], users: [], notifications: [],
    stages: [], levels: [], sections: [], subjects: [], courses: [],
    myNotifications: [], myUnreadCount: 0
  },
  /* ---------- Helpers ---------- */
  showToast(msg, type='success') {
    const t = document.getElementById('toast');
    t.textContent = msg; t.className = 'toast show ' + type;
    setTimeout(() => t.className = 'toast', 3500);
  },
  generateId() { return Date.now().toString(36) + Math.random().toString(36).substr(2,6); },
  formatDate(d) {
    if (!d) return 'غير محدد';
    try { const date = d.toDate ? d.toDate() : new Date(d); return date.toLocaleString('ar-DZ', {dateStyle:'short', timeStyle:'short'}); } catch { return 'غير محدد'; }
  },
  formatDateOnly(d) {
    if (!d) return 'غير محدد';
    try { const date = d.toDate ? d.toDate() : new Date(d); return date.toLocaleDateString('ar-DZ'); } catch { return 'غير محدد'; }
  },
  escapeHtml(str) { if (!str) return ''; return str.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[m])); },
  getStageName(id) { const s = this.data.stages.find(x => x.id === id); return s ? s.name : '—'; },
  getLevelName(id) { const l = this.data.levels.find(x => x.id === id); return l ? l.name : '—'; },
  getSectionName(id) { const s = this.data.sections.find(x => x.id === id); return s ? s.name : '—'; },
  getSubjectName(id) { const s = this.data.subjects.find(x => x.id === id); return s ? s.name : '—'; },
  getCourseName(id) { const c = this.data.courses.find(x => x.id === id); return c ? c.name : '—'; },
  getStudentName(id) { const s = this.data.students.find(x => x.id === id); return s ? s.fullName : '—'; },
  getTeacherName(id) { const t = this.data.teachers.find(x => x.id === id); return t ? t.fullName : '—'; },
  getTimetableSlot() { return ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00']; },
  getTimetableDays() { return ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت']; },
  buildSectionsSelect(id, selected, withAll, allLabel) {
    let html = withAll ? `<option value="all">${allLabel||'جميع الأقسام'}</option>` : '';
    this.data.sections.forEach(s => { html += `<option value="${s.id}" ${s.id===selected?'selected':''}>${this.escapeHtml(s.name)}</option>`; });
    return html;
  },
  buildSectionsSelectOldStyle() {
    let html = '<option value="">اختر القسم / المرحلة</option>';
    this.data.stages.forEach(st => {
      html += `<optgroup label="${this.escapeHtml(st.name)}">`;
      this.data.levels.filter(l => l.stageId === st.id).forEach(lv => {
        this.data.sections.filter(sc => sc.levelId === lv.id).forEach(sc => {
          html += `<option value="${sc.id}">${this.escapeHtml(sc.name)} — ${this.escapeHtml(lv.name)}</option>`;
        });
      });
      html += `</optgroup>`;
    });
    return html;
  },
  /* ---------- Auth ---------- */
  switchLoginTab(tab) {
    document.getElementById('tabUser').classList.toggle('active', tab==='user');
    document.getElementById('tabAdmin').classList.toggle('active', tab==='admin');
    document.getElementById('userLoginForm').classList.toggle('hidden', tab!=='user');
    document.getElementById('adminLoginForm').classList.toggle('hidden', tab!=='admin');
  },
  async login() {
    const email = document.getElementById('loginEmail').value.trim();
    const pass = document.getElementById('loginPassword').value.trim();
    if (!email || !pass) return this.showToast('أدخل البريد وكلمة المرور','error');
    try {
      await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      const cred = await firebase.auth().signInWithEmailAndPassword(email, pass);
      const uid = cred.user.uid;
      const snap = await db.collection('users').where('uid','==',uid).get();
      if (snap.empty) return this.showToast('المستخدم غير مسجل في النظام','error');
      const doc = snap.docs[0]; const u = {id: doc.id, ...doc.data()};
      this.data.currentUser = u; this.showApp(); this.showToast('تم تسجيل الدخول');
      await db.collection('loginLogs').add({userId: u.id, email, role: u.role, time: new Date()});
    } catch(e) { this.showToast('خطأ: '+e.message,'error'); }
  },
  async adminLogin() {
    const email = document.getElementById('adminEmail').value.trim();
    const pass = document.getElementById('adminPassword').value.trim();
    if (!email || !pass) return this.showToast('أدخل البريد وكلمة المرور','error');
    try {
      await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      const cred = await firebase.auth().signInWithEmailAndPassword(email, pass);
      const uid = cred.user.uid;
      const snap = await db.collection('users').where('uid','==',uid).get();
      if (snap.empty) return this.showToast('المستخدم غير مسجل في النظام','error');
      const doc = snap.docs[0]; const u = {id: doc.id, ...doc.data()};
      this.data.currentUser = u; this.showApp(); this.showToast('مرحباً مدير المعهد');
    } catch(e) { this.showToast('خطأ: '+e.message,'error'); }
  },
  logout() { firebase.auth().signOut(); this.data.currentUser = null; location.reload(); },
  checkAuth() {
    firebase.auth().onAuthStateChanged(async user => {
      if (user) {
        const snap = await db.collection('users').where('uid','==',user.uid).get();
        if (!snap.empty) { const doc = snap.docs[0]; this.data.currentUser = {id: doc.id, ...doc.data()}; this.showApp(); }
      } else { document.getElementById('loginScreen').classList.remove('hidden'); }
    });
  },
  /* ---------- UI ---------- */
  showApp() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('appContainer').classList.remove('hidden');
    this.renderNav(); this.renderBadge(); this.startSync(); this.navigate('dashboard');
  },
  toggleMenu() {
    const sb = document.getElementById('sidebar'); sb.classList.toggle('open');
    document.getElementById('menuOverlay').classList.toggle('show');
  },
  closeMenu() { document.getElementById('sidebar').classList.remove('open'); document.getElementById('menuOverlay').classList.remove('show'); },
  openModal(html) { const d = document.createElement('div'); d.className='modal-overlay'; d.innerHTML=html; d.onclick=e=>{ if(e.target===d){ d.remove(); } }; document.body.appendChild(d); },
  closeModal() { document.querySelectorAll('.modal-overlay').forEach(m => m.remove()); },
  renderBadge() {
    const badge = document.getElementById('notificationBadge');
    if (!badge) return;
    const u = this.data.currentUser;
    if (!u) return;
    const count = this.data.myUnreadCount || 0;
    badge.textContent = count;
    badge.style.display = count > 0 ? 'inline-flex' : 'none';
  },
  /* ---------- Navigation ---------- */
  renderNav() {
    const u = this.data.currentUser; if (!u) return;
    const isAdmin = u.role === 'admin'; const isStudent = u.role === 'student'; const isTeacher = u.role === 'teacher';
    let items = [];
    items.push({page:'dashboard', label:'🏠 الرئيسية'});
    if (isAdmin) {
      items.push({page:'stages', label:'🏛️ المراحل'});
      items.push({page:'levels', label:'📚 المستويات'});
      items.push({page:'sections', label:'🗂️ الأقسام'});
      items.push({page:'subjects', label:'📖 المقررات'});
      items.push({page:'courses', label:'🎓 الدورات'});
      items.push({page:'students', label:'👨‍🎓 الطلاب'});
      items.push({page:'teachers', label:'👨‍🏫 الأساتذة'});
      items.push({page:'users', label:'🔐 المستخدمين'});
      items.push({page:'timetable', label:'🗓️ الجدول الأسبوعي'});
      items.push({page:'lessons', label:'📅 الدروس'});
      items.push({page:'attendance', label:'✅ الحضور'});
      items.push({page:'exams', label:'📝 الاختبارات'});
      items.push({page:'materials', label:'📚 المكتبة'});
      items.push({page:'notifications', label:'🔔 الإشعارات'});
      items.push({page:'archive', label:'📁 الأرشيف'});
    } else if (isTeacher) {
      items.push({page:'timetable', label:'🗓️ الجدول الأسبوعي'});
      items.push({page:'lessons', label:'📅 الدروس'});
      items.push({page:'attendance', label:'✅ الحضور'});
      items.push({page:'exams', label:'📝 الاختبارات'});
      items.push({page:'materials', label:'📚 المكتبة'});
      items.push({page:'myNotifications', label:'🔔 إشعاراتي'});
    } else {
      items.push({page:'myTimetable', label:'🗓️ جدولي'});
      items.push({page:'myLessons', label:'📅 دروسي'});
      items.push({page:'myAttendance', label:'✅ حضوري'});
      items.push({page:'myExams', label:'📝 اختباراتي'});
      items.push({page:'myMaterials', label:'📚 المكتبة'});
      items.push({page:'studentCard', label:'🪪 بطاقتي'});
      items.push({page:'myNotifications', label:'🔔 إشعاراتي'});
    }
    items.push({page:'about', label:'🏛️ عن المعهد'});
    const nav = document.getElementById('navMenu');
    nav.innerHTML = items.map(it => `<div class="nav-item ${it.page===this.data.currentPage?'active':''}" onclick="app.navigate('${it.page}')">${it.label}</div>`).join('');
  },
  navigate(page, arg) {
    this.data.currentPage = page; this.renderNav(); this.closeMenu();
    const main = document.getElementById('mainContent');
    main.innerHTML = this.renderPage(page, arg);
    if (page === 'dashboard') this.renderDashboardCharts();
    if (page === 'timetable') this.renderTimetableView();
  },
  renderPage(page, arg) {
    const u = this.data.currentUser; if (!u) return '<div class="card">يرجى تسجيل الدخول</div>';
    const isAdmin = u.role === 'admin';
    switch(page) {
      case 'dashboard': return this.renderDashboard();
      case 'stages': return isAdmin ? this.renderStages() : this.renderForbidden();
      case 'levels': return isAdmin ? this.renderLevels() : this.renderForbidden();
      case 'sections': return isAdmin ? this.renderSections() : this.renderForbidden();
      case 'subjects': return isAdmin ? this.renderSubjects() : this.renderForbidden();
      case 'courses': return isAdmin ? this.renderCourses() : this.renderForbidden();
      case 'students': return isAdmin ? this.renderStudents() : this.renderForbidden();
      case 'teachers': return isAdmin ? this.renderTeachers() : this.renderForbidden();
      case 'users': return isAdmin ? this.renderUsers() : this.renderForbidden();
      case 'timetable': case 'myTimetable': return this.renderTimetable();
      case 'lessons': case 'myLessons': return this.renderLessons();
      case 'attendance': case 'myAttendance': return this.renderAttendance();
      case 'exams': case 'myExams': return this.renderExams();
      case 'materials': case 'myMaterials': return this.renderMaterials();
      case 'about': return this.renderAboutPage();
      case 'notifications': return isAdmin ? this.renderNotifications() : this.renderForbidden();
      case 'myNotifications': return this.renderMyNotifications();
      case 'studentCard': return this.renderStudentCardPage();
      case 'archive': return isAdmin ? this.renderArchive() : this.renderForbidden();
      case 'examQuestions': this.data.activeExamId = arg; return this.renderExamQuestions();
      default: return '<div class="card">الصفحة غير موجودة</div>';
    }
  },
  renderForbidden() { return '<div class="card"><h2>🚫 غير مصرح</h2><p>لا يمكنك الوصول إلى هذه الصفحة.</p></div>'; },
  /* ---------- Sync ---------- */
  startSync() {
    const cols = {
      stages: 'stages', levels: 'levels', sections: 'sections', subjects: 'subjects', courses: 'courses',
      students: 'students', teachers: 'teachers', users: 'users', lessons: 'lessons',
      timetable: 'timetable', attendance: 'attendance', exams: 'exams', materials: 'materials',
      notifications: 'notifications'
    };
    Object.entries(cols).forEach(([col, key]) => {
      db.collection(col).onSnapshot(snap => {
        this.data[key] = snap.docs.map(d => ({id: d.id, ...d.data()}));
        if (this.data.currentPage === 'dashboard') this.renderDashboard();
        if (this.data.currentPage === 'students') this.filterStudents();
        if (this.data.currentPage === 'teachers') this.filterTeachers();
        if (this.data.currentPage === 'users') this.filterUsers();
        if (this.data.currentPage === 'timetable') this.renderTimetableView();
        if (this.data.currentPage === 'lessons') this.filterLessons();
        if (this.data.currentPage === 'attendance') this.filterAttendance();
        if (this.data.currentPage === 'exams') this.filterExams();
        if (this.data.currentPage === 'materials') this.filterMaterials();
        if (this.data.currentPage === 'notifications') this.renderNotifications();
        if (this.data.currentPage === 'myNotifications') this.renderMyNotifications();
        if (this.data.currentPage === 'studentCard') this.renderStudentCardPage();
        if (this.data.currentPage === 'archive') this.renderArchive();
      });
    });
    this.loadMyNotifications();
  },
  async loadMyNotifications() {
    const u = this.data.currentUser; if (!u) return;
    const snap = await db.collection('notifications').where('targetId','==',u.id).where('read','==',false).get();
    this.data.myNotifications = snap.docs.map(d => ({id:d.id, ...d.data()}));
    this.data.myUnreadCount = this.data.myNotifications.length;
    this.renderBadge();
  },
  /* =========================================================
     3. DASHBOARD
     ========================================================= */
  renderDashboard() {
    const isAdmin = this.data.currentUser.role === 'admin';
    let quickActions = '';
    if (isAdmin) {
      quickActions = `<button class="btn btn-primary" onclick="app.navigate('students')">👨‍🎓 الطلاب</button>
        <button class="btn btn-primary" onclick="app.navigate('teachers')">👨‍🏫 الأساتذة</button>
        <button class="btn btn-primary" onclick="app.navigate('timetable')">🗓️ الجدول</button>
        <button class="btn btn-primary" onclick="app.navigate('lessons')">📅 الدروس</button>`;
    }
    return `<div class="header-bar"><h2>🏠 لوحة التحكم</h2><span class="cloud-indicator">☁️ متصل بالسحابة</span></div>
      <div class="stats-grid">
        <div class="stat-card"><div class="number">${this.data.stages.length}</div><div class="label">المراحل</div></div>
        <div class="stat-card"><div class="number">${this.data.levels.length}</div><div class="label">المستويات</div></div>
        <div class="stat-card"><div class="number">${this.data.sections.length}</div><div class="label">الأقسام</div></div>
        <div class="stat-card"><div class="number">${this.data.students.length}</div><div class="label">الطلاب</div></div>
        <div class="stat-card"><div class="number">${this.data.teachers.length}</div><div class="label">المدرسون</div></div>
        <div class="stat-card"><div class="number">${this.data.lessons.length}</div><div class="label">الدروس</div></div>
      </div>
      <div class="card"><h3>⚡ إجراءات سريعة</h3>${quickActions || '<p style="color:#888;">استكشف الجدول والمكتبة والاختبارات من القائمة.</p>'}</div>
      <div class="card"><h3>📈 آخر النشاطات</h3><p style="color:#888; margin-top:8px;">البيانات تُحمل مباشرة من السحابة...</p></div>`;
  },
  renderDashboardCharts() {
    /* placeholder for future charts */
  },
  /* =========================================================
     4. STAGES / LEVELS / SECTIONS / SUBJECTS / COURSES
     ========================================================= */
  renderStages() {
    let html = `<div class="header-bar"><h2>🏛️ المراحل الدراسية</h2><button class="btn btn-primary" onclick="app.showStageModal()">+ مرحلة</button></div>`;
    html += `<div class="card"><div class="table-wrap" id="stagesTableWrap"></div></div>`;
    setTimeout(() => this.renderStagesTable(), 0);
    return html;
  },
  renderStagesTable() {
    const wrap = document.getElementById('stagesTableWrap'); if (!wrap) return;
    let html = '<table><thead><tr><th>الاسم</th><th>المستويات</th><th>الإجراءات</th></tr></thead><tbody>';
    this.data.stages.forEach(s => {
      const levelsCount = this.data.levels.filter(l => l.stageId === s.id).length;
      html += `<tr><td><strong>${this.escapeHtml(s.name)}</strong></td><td><span class="badge badge-info">${levelsCount} مستوى</span></td>
        <td><button class="btn btn-danger" onclick="app.deleteDoc('stages','${s.id}')">حذف</button></td></tr>`;
    });
    html += '</tbody></table>'; wrap.innerHTML = html || '<div class="empty-state">لا توجد مراحل</div>';
  },
  showStageModal() {
    this.openModal(`<div class="modal"><h3>إضافة مرحلة</h3>
      <div class="form-group"><label>الاسم</label><input id="stName"></div>
      <button class="btn btn-primary btn-block" onclick="app.saveStage()">💾 حفظ</button>
      <button class="btn btn-secondary btn-block" onclick="app.closeModal()">إلغاء</button>
    </div>`);
  },
  async saveStage() {
    const name = document.getElementById('stName').value.trim();
    if (!name) return this.showToast('أدخل الاسم','error');
    try { await db.collection('stages').add({name, createdAt: new Date()}); this.showToast('تم الحفظ'); this.closeModal(); } catch(e) { this.showToast('خطأ','error'); }
  },
  renderLevels() {
    let html = `<div class="header-bar"><h2>📚 المستويات</h2><button class="btn btn-primary" onclick="app.showLevelModal()">+ مستوى</button></div>`;
    html += `<div class="card"><div class="table-wrap" id="levelsTableWrap"></div></div>`;
    setTimeout(() => this.renderLevelsTable(), 0);
    return html;
  },
  renderLevelsTable() {
    const wrap = document.getElementById('levelsTableWrap'); if (!wrap) return;
    let html = '<table><thead><tr><th>الاسم</th><th>المرحلة</th><th>الأقسام</th><th>الإجراءات</th></tr></thead><tbody>';
    this.data.levels.forEach(l => {
      const sectionsCount = this.data.sections.filter(s => s.levelId === l.id).length;
      html += `<tr><td><strong>${this.escapeHtml(l.name)}</strong></td><td>${this.getStageName(l.stageId)}</td>
        <td><span class="badge badge-info">${sectionsCount} قسم</span></td>
        <td><button class="btn btn-danger" onclick="app.deleteDoc('levels','${l.id}')">حذف</button></td></tr>`;
    });
    html += '</tbody></table>'; wrap.innerHTML = html || '<div class="empty-state">لا توجد مستويات</div>';
  },
  showLevelModal() {
    let opts = '<option value="">اختر المرحلة</option>';
    this.data.stages.forEach(s => opts += `<option value="${s.id}">${this.escapeHtml(s.name)}</option>`);
    this.openModal(`<div class="modal"><h3>إضافة مستوى</h3>
      <div class="form-group"><label>الاسم</label><input id="lvName"></div>
      <div class="form-group"><label>المرحلة</label><select id="lvStage">${opts}</select></div>
      <button class="btn btn-primary btn-block" onclick="app.saveLevel()">💾 حفظ</button>
      <button class="btn btn-secondary btn-block" onclick="app.closeModal()">إلغاء</button>
    </div>`);
  },
  async saveLevel() {
    const name = document.getElementById('lvName').value.trim();
    const stageId = document.getElementById('lvStage').value;
    if (!name || !stageId) return this.showToast('أدخل جميع البيانات','error');
    try { await db.collection('levels').add({name, stageId, createdAt: new Date()}); this.showToast('تم الحفظ'); this.closeModal(); } catch(e) { this.showToast('خطأ','error'); }
  },
  renderSections() {
    let html = `<div class="header-bar"><h2>🗂️ الأقسام</h2><button class="btn btn-primary" onclick="app.showSectionModal()">+ قسم</button></div>`;
    html += `<div class="card"><div class="table-wrap" id="sectionsTableWrap"></div></div>`;
    setTimeout(() => this.renderSectionsTable(), 0);
    return html;
  },
  renderSectionsTable() {
    const wrap = document.getElementById('sectionsTableWrap'); if (!wrap) return;
    let html = '<table><thead><tr><th>الاسم</th><th>المستوى</th><th>الطلاب</th><th>الإجراءات</th></tr></thead><tbody>';
    this.data.sections.forEach(s => {
      const studentsCount = this.data.students.filter(st => st.sectionId === s.id).length;
      html += `<tr><td><strong>${this.escapeHtml(s.name)}</strong></td><td>${this.getLevelName(s.levelId)}</td>
        <td><span class="badge badge-info">${studentsCount} طالب</span></td>
        <td><button class="btn btn-danger" onclick="app.deleteDoc('sections','${s.id}')">حذف</button></td></tr>`;
    });
    html += '</tbody></table>'; wrap.innerHTML = html || '<div class="empty-state">لا توجد أقسام</div>';
  },
  showSectionModal() {
    let opts = '<option value="">اختر المستوى</option>';
    this.data.levels.forEach(l => opts += `<option value="${l.id}">${this.escapeHtml(l.name)} — ${this.getStageName(l.stageId)}</option>`);
    this.openModal(`<div class="modal"><h3>إضافة قسم</h3>
      <div class="form-group"><label>الاسم</label><input id="scName"></div>
      <div class="form-group"><label>المستوى</label><select id="scLevel">${opts}</select></div>
      <button class="btn btn-primary btn-block" onclick="app.saveSection()">💾 حفظ</button>
      <button class="btn btn-secondary btn-block" onclick="app.closeModal()">إلغاء</button>
    </div>`);
  },
  async saveSection() {
    const name = document.getElementById('scName').value.trim();
    const levelId = document.getElementById('scLevel').value;
    if (!name || !levelId) return this.showToast('أدخل جميع البيانات','error');
    try { await db.collection('sections').add({name, levelId, createdAt: new Date()}); this.showToast('تم الحفظ'); this.closeModal(); } catch(e) { this.showToast('خطأ','error'); }
  },
  renderSubjects() {
    let html = `<div class="header-bar"><h2>📖 المقررات</h2><button class="btn btn-primary" onclick="app.showSubjectModal()">+ مقرر</button></div>`;
    html += `<div class="card"><div class="table-wrap" id="subjectsTableWrap"></div></div>`;
    setTimeout(() => this.renderSubjectsTable(), 0);
    return html;
  },
  renderSubjectsTable() {
    const wrap = document.getElementById('subjectsTableWrap'); if (!wrap) return;
    let html = '<table><thead><tr><th>الاسم</th><th>الدورات</th><th>الإجراءات</th></tr></thead><tbody>';
    this.data.subjects.forEach(s => {
      const coursesCount = this.data.courses.filter(c => c.subjectId === s.id).length;
      html += `<tr><td><strong>${this.escapeHtml(s.name)}</strong></td><td><span class="badge badge-info">${coursesCount} دورة</span></td>
        <td><button class="btn btn-danger" onclick="app.deleteDoc('subjects','${s.id}')">حذف</button></td></tr>`;
    });
    html += '</tbody></table>'; wrap.innerHTML = html || '<div class="empty-state">لا توجد مقررات</div>';
  },
  showSubjectModal() {
    this.openModal(`<div class="modal"><h3>إضافة مقرر</h3>
      <div class="form-group"><label>الاسم</label><input id="sjName"></div>
      <button class="btn btn-primary btn-block" onclick="app.saveSubject()">💾 حفظ</button>
      <button class="btn btn-secondary btn-block" onclick="app.closeModal()">إلغاء</button>
    </div>`);
  },
  async saveSubject() {
    const name = document.getElementById('sjName').value.trim();
    if (!name) return this.showToast('أدخل الاسم','error');
    try { await db.collection('subjects').add({name, createdAt: new Date()}); this.showToast('تم الحفظ'); this.closeModal(); } catch(e) { this.showToast('خطأ','error'); }
  },
  renderCourses() {
    let html = `<div class="header-bar"><h2>🎓 الدورات</h2><button class="btn btn-primary" onclick="app.showCourseModal()">+ دورة</button></div>`;
    html += `<div class="card"><div class="table-wrap" id="coursesTableWrap"></div></div>`;
    setTimeout(() => this.renderCoursesTable(), 0);
    return html;
  },
  renderCoursesTable() {
    const wrap = document.getElementById('coursesTableWrap'); if (!wrap) return;
    let html = '<table><thead><tr><th>الاسم</th><th>المقرر</th><th>الإجراءات</th></tr></thead><tbody>';
    this.data.courses.forEach(c => {
      html += `<tr><td><strong>${this.escapeHtml(c.name)}</strong></td><td>${this.getSubjectName(c.subjectId)}</td>
        <td><button class="btn btn-danger" onclick="app.deleteDoc('courses','${c.id}')">حذف</button></td></tr>`;
    });
    html += '</tbody></table>'; wrap.innerHTML = html || '<div class="empty-state">لا توجد دورات</div>';
  },
  showCourseModal() {
    let opts = '<option value="">اختر المقرر</option>';
    this.data.subjects.forEach(s => opts += `<option value="${s.id}">${this.escapeHtml(s.name)}</option>`);
    this.openModal(`<div class="modal"><h3>إضافة دورة</h3>
      <div class="form-group"><label>الاسم</label><input id="coName"></div>
      <div class="form-group"><label>المقرر</label><select id="coSubject">${opts}</select></div>
      <button class="btn btn-primary btn-block" onclick="app.saveCourse()">💾 حفظ</button>
      <button class="btn btn-secondary btn-block" onclick="app.closeModal()">إلغاء</button>
    </div>`);
  },
  async saveCourse() {
    const name = document.getElementById('coName').value.trim();
    const subjectId = document.getElementById('coSubject').value;
    if (!name || !subjectId) return this.showToast('أدخل جميع البيانات','error');
    try { await db.collection('courses').add({name, subjectId, createdAt: new Date()}); this.showToast('تم الحفظ'); this.closeModal(); } catch(e) { this.showToast('خطأ','error'); }
  },
  /* =========================================================
     5. STUDENTS
     ========================================================= */
  renderStudents() {
    return `<div class="header-bar"><h2>👨‍🎓 الطلاب</h2><button class="btn btn-primary" onclick="app.showStudentModal()">+ طالب</button></div>
      <div class="card"><input class="search-box" id="studentSearch" placeholder="🔍 البحث بالاسم أو القسم أو الهاتف..." oninput="app.filterStudents()"></div>
      <div class="card"><div class="table-wrap" id="studentsTableWrap"></div></div>`;
  },
  filterStudents() {
    const q = (document.getElementById('studentSearch')?.value || '').toLowerCase();
    let list = this.data.students;
    if (q) list = list.filter(s => (s.fullName||'').toLowerCase().includes(q) || (s.phone||'').includes(q) || this.getSectionName(s.sectionId).toLowerCase().includes(q));
    this.renderStudentsTable(list);
  },
  renderStudentsTable(list) {
    const wrap = document.getElementById('studentsTableWrap'); if (!wrap) return;
    if (!list.length) { wrap.innerHTML = '<div class="empty-state">لا يوجد طلاب</div>'; return; }
    let html = '<table><thead><tr><th>الاسم</th><th>القسم</th><th>السن</th><th>البلد/المدينة</th><th>المستوى الأكاديمي</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>';
    list.forEach(s => {
      html += `<tr><td><strong>${this.escapeHtml(s.fullName)}</strong><br><small style="color:#888">${this.escapeHtml(s.phone||'')}</small></td>
        <td><span class="badge badge-primary">${this.getSectionName(s.sectionId)}</span></td>
        <td>${s.age || '—'}</td>
        <td>${s.city || '—'} / ${s.country || '—'}</td>
        <td>${s.academicLevel || '—'}</td>
        <td><span class="badge ${s.active!==false?'badge-success':'badge-danger'}">${s.active!==false?'نشط':'غير نشط'}</span></td>
        <td>
          <button class="btn btn-info" onclick="app.showStudentCard('${s.id}')">🪪 البطاقة</button>
          <button class="btn btn-danger" onclick="app.deleteDoc('students','${s.id}')">حذف</button>
        </td></tr>`;
    });
    html += '</tbody></table>'; wrap.innerHTML = html;
  },
  showStudentModal() {
    this.openModal(`<div class="modal"><h3>إضافة طالب جديد</h3>
      <div class="form-group"><label>الاسم الكامل</label><input id="stFullName"></div>
      <div class="form-group"><label>القسم / المرحلة</label><select id="stSection">${this.buildSectionsSelectOldStyle()}</select></div>
      <div class="form-group"><label>رقم الهاتف</label><input id="stPhone" dir="ltr"></div>
      <div class="form-group"><label>تاريخ الدخول</label><input type="date" id="stEntryDate"></div>
      <div class="form-group"><label>السن</label><input type="number" id="stAge"></div>
      <div class="form-group"><label>البلد</label><input id="stCountry"></div>
      <div class="form-group"><label>المدينة</label><input id="stCity"></div>
      <div class="form-group"><label>المستوى الأكاديمي</label><input id="stAcademicLevel" placeholder="مثال: بكالوريا، ليسانس..."></div>
      <div class="form-group"><label>المهنة</label><input id="stJob" placeholder="مهنة الطالب (إن وجدت)"></div>
      <button class="btn btn-primary btn-block" onclick="app.saveStudent()">💾 حفظ</button>
      <button class="btn btn-secondary btn-block" onclick="app.closeModal()">إلغاء</button>
    </div>`);
  },
  async saveStudent() {
    const fullName = document.getElementById('stFullName').value.trim();
    const sectionId = document.getElementById('stSection').value;
    const phone = document.getElementById('stPhone').value.trim();
    const entryDate = document.getElementById('stEntryDate').value;
    const age = parseInt(document.getElementById('stAge').value) || null;
    const country = document.getElementById('stCountry').value.trim();
    const city = document.getElementById('stCity').value.trim();
    const academicLevel = document.getElementById('stAcademicLevel').value.trim();
    const job = document.getElementById('stJob').value.trim();
    if (!fullName || !sectionId) return this.showToast('أدخل الاسم والقسم','error');
    try {
      await db.collection('students').add({ fullName, sectionId, phone, entryDate, age, country, city, academicLevel, job, active: true, createdAt: new Date() });
      this.showToast('تم إضافة الطالب'); this.closeModal();
    } catch(e) { this.showToast('خطأ في الحفظ','error'); }
  },
  /* =========================================================
     6. TEACHERS
     ========================================================= */
  renderTeachers() {
    return `<div class="header-bar"><h2>👨‍🏫 الأساتذة</h2><button class="btn btn-primary" onclick="app.showTeacherModal()">+ أستاذ</button></div>
      <div class="card"><div class="table-wrap" id="teachersTableWrap"></div></div>`;
  },
  filterTeachers() {
    /* placeholder for future filtering */
    this.renderTeachersTable(this.data.teachers);
  },
  renderTeachersTable(list) {
    const wrap = document.getElementById('teachersTableWrap'); if (!wrap) return;
    if (!list.length) { wrap.innerHTML = '<div class="empty-state">لا يوجد أساتذة</div>'; return; }
    let html = '<table><thead><tr><th>الاسم</th><th>التخصص</th><th>السن</th><th>البلد/المدينة</th><th>المستوى الأكاديمي</th><th>المهنة</th><th>إجراءات</th></tr></thead><tbody>';
    list.forEach(t => {
      html += `<tr><td><strong>${this.escapeHtml(t.fullName)}</strong><br><small style="color:#888">${this.escapeHtml(t.phone||'')}</small></td>
        <td>${this.escapeHtml(t.specialty||'—')}</td>
        <td>${t.age || '—'}</td>
        <td>${t.city || '—'} / ${t.country || '—'}</td>
        <td>${t.academicLevel || '—'}</td>
        <td>${t.job || '—'}</td>
        <td><button class="btn btn-danger" onclick="app.deleteDoc('teachers','${t.id}')">حذف</button></td></tr>`;
    });
    html += '</tbody></table>'; wrap.innerHTML = html;
  },
  showTeacherModal() {
    this.openModal(`<div class="modal"><h3>إضافة أستاذ جديد</h3>
      <div class="form-group"><label>الاسم الكامل</label><input id="teFullName"></div>
      <div class="form-group"><label>التخصص</label><input id="teSpecialty"></div>
      <div class="form-group"><label>رقم الهاتف</label><input id="tePhone" dir="ltr"></div>
      <div class="form-group"><label>تاريخ الدخول</label><input type="date" id="teEntryDate"></div>
      <div class="form-group"><label>السن</label><input type="number" id="teAge"></div>
      <div class="form-group"><label>البلد</label><input id="teCountry"></div>
      <div class="form-group"><label>المدينة</label><input id="teCity"></div>
      <div class="form-group"><label>المستوى الأكاديمي</label><input id="teAcademicLevel" placeholder="مثال: ماجستير، دكتوراه..."></div>
      <div class="form-group"><label>المهنة</label><input id="teJob" placeholder="مهنة الأستاذ (إن وجدت)"></div>
      <button class="btn btn-primary btn-block" onclick="app.saveTeacher()">💾 حفظ</button>
      <button class="btn btn-secondary btn-block" onclick="app.closeModal()">إلغاء</button>
    </div>`);
  },
  async saveTeacher() {
    const fullName = document.getElementById('teFullName').value.trim();
    const specialty = document.getElementById('teSpecialty').value.trim();
    const phone = document.getElementById('tePhone').value.trim();
    const entryDate = document.getElementById('teEntryDate').value;
    const age = parseInt(document.getElementById('teAge').value) || null;
    const country = document.getElementById('teCountry').value.trim();
    const city = document.getElementById('teCity').value.trim();
    const academicLevel = document.getElementById('teAcademicLevel').value.trim();
    const job = document.getElementById('teJob').value.trim();
    if (!fullName) return this.showToast('أدخل اسم الأستاذ','error');
    try {
      await db.collection('teachers').add({ fullName, specialty, phone, entryDate, age, country, city, academicLevel, job, createdAt: new Date() });
      this.showToast('تم إضافة الأستاذ'); this.closeModal();
    } catch(e) { this.showToast('خطأ في الحفظ','error'); }
  },
  /* =========================================================
     7. USERS
     ========================================================= */
  renderUsers() {
    return `<div class="header-bar"><h2>🔐 المستخدمين</h2><button class="btn btn-primary" onclick="app.showUserModal()">+ مستخدم</button></div>
      <div class="card"><input class="search-box" id="userSearch" placeholder="🔍 البحث بالاسم أو اسم المستخدم..." oninput="app.filterUsers()"></div>
      <div class="card"><div class="table-wrap" id="usersTableWrap"></div></div>`;
  },
  filterUsers() {
    const q = (document.getElementById('userSearch')?.value || '').toLowerCase();
    let list = this.data.users;
    if (q) list = list.filter(u => (u.fullName||'').toLowerCase().includes(q) || (u.email||'').toLowerCase().includes(q));
    this.renderUsersTable(list);
  },
  renderUsersTable(list) {
    const wrap = document.getElementById('usersTableWrap'); if (!wrap) return;
    if (!list.length) { wrap.innerHTML = '<div class="empty-state">لا يوجد مستخدمون</div>'; return; }
    let html = '<table><thead><tr><th>الاسم</th><th>اسم المستخدم</th><th>الدور</th><th>القسم</th><th>إجراءات</th></tr></thead><tbody>';
    list.forEach(u => {
      const roleLabel = u.role==='admin'?'مدير':u.role==='teacher'?'أستاذ':'طالب';
      html += `<tr><td><strong>${this.escapeHtml(u.fullName)}</strong></td><td>${this.escapeHtml(u.email||'—')}</td>
        <td><span class="badge badge-info">${roleLabel}</span></td>
        <td><span class="badge badge-primary">${this.getSectionName(u.sectionId)}</span></td>
        <td><button class="btn btn-danger" onclick="app.deleteDoc('users','${u.id}')">حذف</button></td></tr>`;
    });
    html += '</tbody></table>'; wrap.innerHTML = html;
  },
  showUserModal() {
    const roles = '<option value="student">طالب</option><option value="teacher">أستاذ</option><option value="admin">مدير</option>';
    this.openModal(`<div class="modal"><h3>إضافة مستخدم</h3>
      <div class="form-group"><label>الاسم الكامل</label><input id="uFullName"></div>
      <div class="form-group"><label>البريد الإلكتروني</label><input type="email" id="uEmail" dir="ltr"></div>
      <div class="form-group"><label>كلمة المرور</label><input type="password" id="uPassword"></div>
      <div class="form-group"><label>الدور</label><select id="uRole">${roles}</select></div>
      <div class="form-group"><label>القسم (اختياري)</label><select id="uSection"><option value="">—</option>${this.buildSectionsSelect('', '', false, '')}</select></div>
      <button class="btn btn-primary btn-block" onclick="app.saveUser()">💾 حفظ</button>
      <button class="btn btn-secondary btn-block" onclick="app.closeModal()">إلغاء</button>
    </div>`);
  },
  async saveUser() {
    const fullName = document.getElementById('uFullName').value.trim();
    const email = document.getElementById('uEmail').value.trim();
    const password = document.getElementById('uPassword').value.trim();
    const role = document.getElementById('uRole').value;
    const sectionId = document.getElementById('uSection').value;
    if (!fullName || !email || !password) return this.showToast('أدخل جميع البيانات','error');
    try {
      const currentUser = firebase.auth().currentUser;
      const cred = await firebase.auth().createUserWithEmailAndPassword(email, password);
      const uid = cred.user.uid;
      await db.collection('users').add({ fullName, email, uid, role, sectionId: sectionId || '', createdAt: new Date() });
      if (currentUser) {
        await firebase.auth().updateCurrentUser(currentUser);
      } else {
        await firebase.auth().signOut();
      }
      this.showToast('تم إضافة المستخدم'); this.closeModal();
    } catch(e) { this.showToast('خطأ: '+e.message,'error'); }
  },
  /* =========================================================
     8. TIMETABLE
     ========================================================= */
  renderTimetable() {
    const isAdmin = this.data.currentUser.role === 'admin';
    return `<div class="header-bar"><h2>🗓️ الجدول الأسبوعي</h2>
      ${isAdmin ? `<button class="btn btn-primary" onclick="app.showTimetableModal()">+ حصة</button>` : ''}
    </div>
    <div class="card" style="display:flex; gap:10px; flex-wrap:wrap;">
      <select id="ttSectionFilter" class="search-box" style="max-width:260px; margin:0;" onchange="app.renderTimetableView()">
        <option value="all">جميع الأقسام</option>${this.buildSectionsSelect('', '', false, '')}
      </select>
    </div>
    <div class="card" id="timetableCard"></div>`;
  },
  renderTimetableView() {
    const card = document.getElementById('timetableCard'); if (!card) return;
    const filter = document.getElementById('ttSectionFilter')?.value || 'all';
    const days = this.getTimetableDays(); const slots = this.getTimetableSlot();
    let html = '<div class="timetable-grid">';
    html += '<div class="timetable-header">الوقت</div>';
    days.forEach(d => html += `<div class="timetable-header">${d}</div>`);
    slots.forEach(slot => {
      html += `<div class="timetable-time">${slot}</div>`;
      days.forEach(day => {
        const entry = this.data.timetable.find(t => t.day === day && t.time === slot && (filter==='all' || t.sectionId===filter));
        if (entry) {
          html += `<div class="timetable-cell" onclick="app.showTimetableEdit('${entry.id}')">
            <div class="lesson-title">${this.escapeHtml(entry.title||'حصة')}</div>
            <div class="lesson-meta">${this.getSectionName(entry.sectionId)} — ${this.getTeacherName(entry.teacherId)}</div>
          </div>`;
        } else { html += `<div class="timetable-cell empty"></div>`; }
      });
    });
    html += '</div>';
    /* Mobile list */
    html += '<div class="timetable-mobile-list">';
    days.forEach(day => {
      html += `<div class="tt-mobile-card"><div class="tt-day">${day}</div>`;
      slots.forEach(slot => {
        const entry = this.data.timetable.find(t => t.day === day && t.time === slot && (filter==='all' || t.sectionId===filter));
        if (entry) {
          html += `<div class="tt-slot" onclick="app.showTimetableEdit('${entry.id}')">
            <div><div class="tt-lesson">${this.escapeHtml(entry.title||'حصة')}</div><div class="tt-meta">${this.getSectionName(entry.sectionId)} — ${this.getTeacherName(entry.teacherId)}</div></div>
            <div class="tt-time">${slot}</div>
          </div>`;
        }
      });
      html += '</div>';
    });
    html += '</div>';
    card.innerHTML = html;
  },
  showTimetableModal() {
    const daysOpts = this.getTimetableDays().map(d => `<option value="${d}">${d}</option>`).join('');
    const slotsOpts = this.getTimetableSlot().map(s => `<option value="${s}">${s}</option>`).join('');
    this.openModal(`<div class="modal"><h3>إضافة حصة</h3>
      <div class="form-group"><label>اليوم</label><select id="ttDay">${daysOpts}</select></div>
      <div class="form-group"><label>الوقت</label><select id="ttTime">${slotsOpts}</select></div>
      <div class="form-group"><label>القسم</label><select id="ttSection">${this.buildSectionsSelectOldStyle()}</select></div>
      <div class="form-group"><label>الأستاذ</label><select id="ttTeacher"><option value="">—</option>${this.data.teachers.map(t => `<option value="${t.id}">${this.escapeHtml(t.fullName)}</option>`).join('')}</select></div>
      <div class="form-group"><label>العنوان</label><input id="ttTitle" placeholder="مثال: درس الفقه"></div>
      <button class="btn btn-primary btn-block" onclick="app.saveTimetable()">💾 حفظ</button>
      <button class="btn btn-secondary btn-block" onclick="app.closeModal()">إلغاء</button>
    </div>`);
  },
  async saveTimetable() {
    const day = document.getElementById('ttDay').value;
    const time = document.getElementById('ttTime').value;
    const sectionId = document.getElementById('ttSection').value;
    const teacherId = document.getElementById('ttTeacher').value;
    const title = document.getElementById('ttTitle').value.trim();
    if (!day || !time || !sectionId) return this.showToast('أدخل اليوم والوقت والقسم','error');
    try { await db.collection('timetable').add({day, time, sectionId, teacherId: teacherId || '', title: title || 'حصة', createdAt: new Date()}); this.showToast('تم الحفظ'); this.closeModal(); } catch(e) { this.showToast('خطأ','error'); }
  },
  showTimetableEdit(id) {
    const entry = this.data.timetable.find(t => t.id === id); if (!entry) return;
    this.openModal(`<div class="modal"><h3>تعديل / حذف حصة</h3>
      <div class="form-group"><label>العنوان</label><input id="ttEditTitle" value="${this.escapeHtml(entry.title||'')}"></div>
      <div style="display:flex; gap:10px;">
        <button class="btn btn-primary btn-block" onclick="app.updateTimetable('${id}')">💾 تحديث</button>
        <button class="btn btn-danger btn-block" onclick="app.deleteDoc('timetable','${id}')">🗑️ حذف</button>
      </div>
      <button class="btn btn-secondary btn-block" onclick="app.closeModal()">إلغاء</button>
    </div>`);
  },
  async updateTimetable(id) {
    const title = document.getElementById('ttEditTitle').value.trim();
    try { await db.collection('timetable').doc(id).update({title}); this.showToast('تم التحديث'); this.closeModal(); } catch(e) { this.showToast('خطأ','error'); }
  },
  /* =========================================================
     9. LESSONS
     ========================================================= */
  renderLessons() {
    const isAdmin = this.data.currentUser.role === 'admin';
    return `<div class="header-bar"><h2>📅 الدروس</h2>
      ${isAdmin ? `<button class="btn btn-primary" onclick="app.showLessonModal()">+ درس</button>` : ''}
    </div>
    <div class="card"><input class="search-box" id="lessonSearch" placeholder="🔍 البحث بالعنوان..." oninput="app.filterLessons()"></div>
    <div class="card"><div class="table-wrap" id="lessonsListWrap"></div></div>`;
  },
  filterLessons() {
    const q = (document.getElementById('lessonSearch')?.value || '').toLowerCase();
    let list = this.data.lessons;
    if (q) list = list.filter(l => (l.title||'').toLowerCase().includes(q));
    this.renderLessonsList(list);
  },
  renderLessonsList(list) {
    const wrap = document.getElementById('lessonsListWrap'); if (!wrap) return;
    if (!list.length) { wrap.innerHTML = '<div class="empty-state">لا يوجد دروس</div>'; return; }
    let html = '<table><thead><tr><th>العنوان</th><th>القسم</th><th>الأستاذ</th><th>التاريخ</th><th>إجراءات</th></tr></thead><tbody>';
    list.forEach(l => {
      html += `<tr><td><strong>${this.escapeHtml(l.title)}</strong></td><td>${this.getSectionName(l.sectionId)}</td>
        <td>${this.getTeacherName(l.teacherId)}</td><td>${this.formatDate(l.date)}</td>
        <td>
          <button class="btn btn-success" onclick="app.shareLessonLink('${l.id}')">🔗 رابط الحضور</button>
          <button class="btn btn-danger" onclick="app.deleteDoc('lessons','${l.id}')">حذف</button>
        </td></tr>`;
    });
    html += '</tbody></table>'; wrap.innerHTML = html;
  },
  showLessonModal() {
    this.openModal(`<div class="modal"><h3>إضافة درس</h3>
      <div class="form-group"><label>العنوان</label><input id="lsTitle"></div>
      <div class="form-group"><label>القسم</label><select id="lsSection">${this.buildSectionsSelectOldStyle()}</select></div>
      <div class="form-group"><label>الأستاذ</label><select id="lsTeacher"><option value="">—</option>${this.data.teachers.map(t => `<option value="${t.id}">${this.escapeHtml(t.fullName)}</option>`).join('')}</select></div>
      <div class="form-group"><label>التاريخ</label><input type="datetime-local" id="lsDate"></div>
      <button class="btn btn-primary btn-block" onclick="app.saveLesson()">💾 حفظ</button>
      <button class="btn btn-secondary btn-block" onclick="app.closeModal()">إلغاء</button>
    </div>`);
  },
  async saveLesson() {
    const title = document.getElementById('lsTitle').value.trim();
    const sectionId = document.getElementById('lsSection').value;
    const teacherId = document.getElementById('lsTeacher').value;
    const dateVal = document.getElementById('lsDate').value;
    if (!title || !sectionId) return this.showToast('أدخل العنوان والقسم','error');
    try { await db.collection('lessons').add({title, sectionId, teacherId: teacherId || '', date: dateVal ? new Date(dateVal) : new Date(), createdAt: new Date()}); this.showToast('تم الحفظ'); this.closeModal(); } catch(e) { this.showToast('خطأ','error'); }
  },
  shareLessonLink(lessonId) {
    const url = `${location.origin}${location.pathname}?attendanceLesson=${lessonId}`;
    navigator.clipboard.writeText(url).then(() => this.showToast('تم نسخ رابط الحضور'));
  },
  /* =========================================================
     10. ATTENDANCE
     ========================================================= */
  renderAttendance() {
    const isAdmin = this.data.currentUser.role === 'admin';
    return `<div class="header-bar"><h2>✅ الحضور</h2>
      ${isAdmin ? `<button class="btn btn-primary" onclick="app.showAttendanceModal()">+ تسجيل</button>` : ''}
    </div>
    <div class="card" style="display:flex; gap:10px; flex-wrap:wrap;">
      <select id="attLessonFilter" class="search-box" style="max-width:260px; margin:0;" onchange="app.filterAttendance()">
        <option value="all">جميع الدروس</option>${this.data.lessons.map(l => `<option value="${l.id}">${this.escapeHtml(l.title)}</option>`).join('')}
      </select>
      ${isAdmin ? `<button class="btn btn-success" onclick="app.exportAttendanceToWord()">📄 Word</button><button class="btn btn-warning" onclick="app.exportAttendanceToPDF()">📄 PDF</button>` : ''}
    </div>
    <div class="card"><div class="table-wrap" id="attendanceListWrap"></div></div>`;
  },
  filterAttendance() {
    const filter = document.getElementById('attLessonFilter')?.value || 'all';
    let list = this.data.attendance;
    if (filter !== 'all') list = list.filter(a => a.lessonId === filter);
    this.renderAttendanceList(list);
  },
  renderAttendanceList(list) {
    const wrap = document.getElementById('attendanceListWrap'); if (!wrap) return;
    if (!list.length) { wrap.innerHTML = '<div class="empty-state">لا يوجد حضور</div>'; return; }
    let html = '<table><thead><tr><th>الدرس</th><th>الطالب</th><th>القسم</th><th>التاريخ</th></tr></thead><tbody>';
    list.forEach(a => {
      const lesson = this.data.lessons.find(l => l.id === a.lessonId);
      html += `<tr><td>${this.escapeHtml(lesson ? lesson.title : '')}</td><td>${this.escapeHtml(a.studentName || '')}</td>
        <td><span class="badge badge-primary">${this.getSectionName(a.studentSectionId)}</span></td>
        <td>${this.formatDate(a.timestamp)}</td></tr>`;
    });
    html += '</tbody></table>'; wrap.innerHTML = html;
  },
  showAttendanceModal() {
    this.openModal(`<div class="modal"><h3>تسجيل حضور</h3>
      <div class="form-group"><label>الدرس</label><select id="atLesson"><option value="">اختر الدرس</option>${this.data.lessons.map(l => `<option value="${l.id}">${this.escapeHtml(l.title)} — ${this.getSectionName(l.sectionId)}</option>`).join('')}</select></div>
      <div class="form-group"><label>الطالب</label><select id="atStudent"><option value="">اختر الطالب</option>${this.data.students.map(s => `<option value="${s.id}">${this.escapeHtml(s.fullName)} — ${this.getSectionName(s.sectionId)}</option>`).join('')}</select></div>
      <button class="btn btn-primary btn-block" onclick="app.saveAttendance()">💾 تأكيد</button>
      <button class="btn btn-secondary btn-block" onclick="app.closeModal()">إلغاء</button>
    </div>`);
  },
  async saveAttendance() {
    const lessonId = document.getElementById('atLesson').value;
    const studentId = document.getElementById('atStudent').value;
    if (!lessonId || !studentId) return this.showToast('اختر الدرس والطالب','error');
    const student = this.data.students.find(s => s.id === studentId);
    try {
      await db.collection('attendance').add({ lessonId, studentId, studentName: student ? student.fullName : '', studentSectionId: student ? student.sectionId : '', timestamp: new Date() });
      this.showToast('تم تسجيل الحضور'); this.closeModal();
    } catch(e) { this.showToast('خطأ','error'); }
  },
  exportAttendanceToWord() {
    const filter = document.getElementById('attLessonFilter')?.value || 'all';
    let rows = this.data.attendance;
    if (filter !== 'all') rows = rows.filter(a => a.lessonId === filter);
    if (!rows.length) return this.showToast('لا يوجد حضور','error');
    const lessonName = filter==='all' ? 'جميع الدروس' : (this.data.lessons.find(l=>l.id===filter)?.title || filter);
    let htmlTable = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>كشف الحضور</title></head><body style="font-family:Arial; direction:rtl; text-align:right;"><h2 style="color:#0d5c3a;">كشف حضور - ${lessonName}</h2><p>معهد الإمام سحنون للعلوم الشرعية</p><table border="1" style="border-collapse:collapse; width:100%; text-align:right;"><thead><tr style="background:#0d5c3a; color:white;"><th style="padding:8px;">#</th><th style="padding:8px;">الدرس</th><th style="padding:8px;">الطالب</th><th style="padding:8px;">القسم</th><th style="padding:8px;">التاريخ</th></tr></thead><tbody>`;
    rows.forEach((a, idx) => {
      const lesson = this.data.lessons.find(l => l.id === a.lessonId);
      htmlTable += `<tr><td style="padding:8px;">${idx+1}</td><td style="padding:8px;">${this.escapeHtml(lesson?lesson.title:'')}</td><td style="padding:8px;">${this.escapeHtml(a.studentName||'')}</td><td style="padding:8px;">${this.getSectionName(a.studentSectionId)}</td><td style="padding:8px;">${this.formatDate(a.timestamp)}</td></tr>`;
    });
    htmlTable += `</tbody></table></body></html>`;
    const blob = new Blob(['\ufeff'+htmlTable], {type:'application/msword'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `حضور_${lessonName}.doc`; a.click();
    this.showToast('تم تصدير Word');
  },
  exportAttendanceToPDF() {
    const filter = document.getElementById('attLessonFilter')?.value || 'all';
    let rows = this.data.attendance;
    if (filter !== 'all') rows = rows.filter(a => a.lessonId === filter);
    if (!rows.length) return this.showToast('لا يوجد حضور','error');
    const lessonName = filter==='all' ? 'جميع الدروس' : (this.data.lessons.find(l=>l.id===filter)?.title || filter);
    const body = rows.map((a, idx) => { const lesson = this.data.lessons.find(l => l.id === a.lessonId); return [idx+1, lesson?lesson.title:'', a.studentName||'', this.getSectionName(a.studentSectionId), this.formatDate(a.timestamp)]; });
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({orientation:'landscape'});
    doc.setFontSize(16); doc.text(`كشف حضور - ${lessonName}`, 14, 15);
    doc.setFontSize(10); doc.text('معهد الإمام سحنون للعلوم الشرعية', 14, 22);
    doc.autoTable({ head:[['#','الدرس','الطالب','القسم','التاريخ']], body, startY:28, styles:{font:'Arial', halign:'right'}, headStyles:{fillColor:[26,95,42]} });
    doc.save(`حضور_${lessonName}.pdf`);
    this.showToast('تم تصدير PDF');
  },
  showAttendanceRegistration() {
    const params = new URLSearchParams(window.location.search);
    const lessonId = params.get('attendanceLesson');
    if (!lessonId) return;
    const lesson = this.data.lessons.find(l => l.id === lessonId);
    if (!lesson) { document.body.innerHTML = '<div style="padding:40px; text-align:center; font-family:Segoe UI,Tahoma,Geneva,Verdana,sans-serif;"><h2>⚠️ الدرس غير موجود</h2></div>'; return; }
    document.body.innerHTML = `
    <div class="public-page"><h2>🕌 معهد الإمام سحنون</h2><p>تسجيل حضور للدرس: <strong>${this.escapeHtml(lesson.title)}</strong></p>
      <div class="form-group"><label>الاسم الكامل</label><input id="pubName" placeholder="أدخل اسمك الكامل"></div>
      <div class="form-group"><label>القسم / المرحلة</label><select id="pubSection">${this.buildSectionsSelectOldStyle()}</select></div>
      <button id="pubBtn" onclick="app.submitPublicAttendance('${lessonId}')">✅ تأكيد الحضور</button>
      <p style="margin-top:18px; font-size:0.85rem; color:#888;">سيتم تسجيل حضورك في النظام السحابي مباشرة.</p>
    </div>`;
  },
  async submitPublicAttendance(lessonId) {
    const name = document.getElementById('pubName').value.trim();
    const sectionId = document.getElementById('pubSection').value;
    if (!name || !sectionId) return this.showToast('أدخل الاسم والقسم','error');
    try { await db.collection('attendance').add({ lessonId, studentName: name, studentSectionId: sectionId, timestamp: new Date() }); this.showToast('تم تسجيل حضورك'); document.getElementById('pubBtn').disabled = true; document.getElementById('pubBtn').textContent = '✅ تم التسجيل'; } catch(e) { this.showToast('خطأ','error'); }
  },
  /* =========================================================
     11. MATERIALS
     ========================================================= */
  renderMaterials() {
    const isAdmin = this.data.currentUser.role === 'admin';
    return `<div class="header-bar"><h2>📚 المكتبة</h2>
      ${isAdmin ? `<button class="btn btn-primary" onclick="app.showMaterialModal()">+ مادة</button>` : ''}
    </div>
    <div class="card" style="display:flex; gap:10px; flex-wrap:wrap;">
      <select id="matCourseFilter" class="search-box" style="max-width:260px; margin:0;" onchange="app.filterMaterials()"><option value="all">جميع المقررات</option>${this.data.courses.map(c => `<option value="${c.id}">${this.escapeHtml(c.name)}</option>`).join('')}</select>
    </div>
    <div class="card" id="libraryGrid"></div>`;
  },
  filterMaterials() {
    const filter = document.getElementById('matCourseFilter')?.value || 'all';
    let list = this.data.materials;
    if (filter !== 'all') list = list.filter(m => m.courseId === filter);
    this.renderMaterialsGrid(list);
  },
  renderMaterialsGrid(list) {
    const wrap = document.getElementById('libraryGrid'); if (!wrap) return;
    if (!list.length) { wrap.innerHTML = '<div class="empty-state">لا توجد مواد</div>'; return; }
    let html = '<div class="stats-grid">';
    list.forEach(m => {
      html += `<div class="stat-card" style="text-align:right; align-items:flex-start;">
        <div style="font-size:1.1rem; font-weight:700; color:#1a5f2a; margin-bottom:6px;">${this.escapeHtml(m.title)}</div>
        <div style="font-size:0.82rem; color:#666;">${this.getCourseName(m.courseId)}</div>
        <div style="margin-top:10px; display:flex; gap:8px;">
          <a href="${this.escapeHtml(m.url||'#')}" target="_blank" class="btn btn-info" style="font-size:0.8rem;">📥 تحميل</a>
          <button class="btn btn-danger" style="font-size:0.8rem;" onclick="app.deleteDoc('materials','${m.id}')">حذف</button>
        </div>
      </div>`;
    });
    html += '</div>'; wrap.innerHTML = html;
  },
  showMaterialModal() {
    this.openModal(`<div class="modal"><h3>رفع مادة</h3>
      <div class="form-group"><label>العنوان</label><input id="mtTitle"></div>
      <div class="form-group"><label>الدورة</label><select id="mtCourse"><option value="">—</option>${this.data.courses.map(c => `<option value="${c.id}">${this.escapeHtml(c.name)}</option>`).join('')}</select></div>
      <div class="form-group"><label>رابط الملف</label><input id="mtUrl" dir="ltr"></div>
      <button class="btn btn-primary btn-block" onclick="app.saveMaterial()">💾 حفظ</button>
      <button class="btn btn-secondary btn-block" onclick="app.closeModal()">إلغاء</button>
    </div>`);
  },
  async saveMaterial() {
    const title = document.getElementById('mtTitle').value.trim();
    const courseId = document.getElementById('mtCourse').value;
    const url = document.getElementById('mtUrl').value.trim();
    if (!title || !url) return this.showToast('أدخل العنوان والرابط','error');
    try { await db.collection('materials').add({title, courseId: courseId || '', url, createdAt: new Date()}); this.showToast('تم الحفظ'); this.closeModal(); } catch(e) { this.showToast('خطأ','error'); }
  },
  /* =========================================================
     12. EXAMS
     ========================================================= */
  renderExams() {
    const isAdmin = this.data.currentUser.role === 'admin';
    return `<div class="header-bar"><h2>📝 الاختبارات</h2>
      ${isAdmin ? `<button class="btn btn-primary" onclick="app.showExamModal()">+ اختبار</button>` : ''}
    </div>
    <div class="card"><div class="table-wrap" id="examsTableWrap"></div></div>`;
  },
  filterExams() { this.renderExamsTable(this.data.exams); },
  renderExamsTable(list) {
    const wrap = document.getElementById('examsTableWrap'); if (!wrap) return;
    if (!list.length) { wrap.innerHTML = '<div class="empty-state">لا يوجد اختبارات</div>'; return; }
    let html = '<table><thead><tr><th>العنوان</th><th>القسم</th><th>المدة</th><th>أسئلة</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>';
    list.forEach(e => {
      const qCount = e.questions ? e.questions.length : 0;
      html += `<tr><td><strong>${this.escapeHtml(e.title)}</strong></td><td>${this.getSectionName(e.sectionId)}</td><td>${e.duration} دقيقة</td><td>${qCount}</td>
        <td><span class="badge ${e.status==='منشور'?'badge-success':'badge-warning'}">${e.status||'مسودة'}</span></td>
        <td>
          <button class="btn btn-info" onclick="app.navigate('examQuestions','${e.id}')">الأسئلة</button>
          <button class="btn btn-danger" onclick="app.deleteDoc('exams','${e.id}')">حذف</button>
        </td></tr>`;
    });
    html += '</tbody></table>'; wrap.innerHTML = html;
  },
  showExamModal() {
    const sectionsSelect = this.buildSectionsSelect('exSection', '', true, 'جميع الأقسام');
    this.openModal(`<div class="modal"><h3>إضافة اختبار جديد</h3>
      <div class="form-group"><label>العنوان</label><input id="exTitle"></div>
      <div class="form-group"><label>القسم المستهدف</label><select id="exSection">${sectionsSelect}</select></div>
      <div class="form-group"><label>المدة (دقيقة)</label><input type="number" id="exDuration" value="20"></div>
      <button class="btn btn-primary btn-block" onclick="app.saveExam()">💾 إنشاء</button>
      <button class="btn btn-secondary btn-block" onclick="app.closeModal()">إلغاء</button>
    </div>`);
  },
  async saveExam() {
    const title = document.getElementById('exTitle').value.trim();
    const duration = parseInt(document.getElementById('exDuration').value) || 20;
    const sectionId = document.getElementById('exSection').value;
    if (!title) return this.showToast('أدخل عنوان الاختبار','error');
    try { await db.collection('exams').add({title, duration, sectionId: sectionId || '', questions:[], status:'منشور', createdAt: new Date()}); this.showToast('تم إنشاء الاختبار'); this.closeModal(); } catch(e) { this.showToast('خطأ','error'); }
  },
  renderExamQuestions() {
    const exam = this.data.exams.find(e => e.id === this.data.activeExamId);
    if (!exam) return '<div class="card">الاختبار غير موجود</div>';
    let html = `<div class="header-bar"><h2>أسئلة: ${this.escapeHtml(exam.title)}</h2><button class="btn btn-primary" onclick="app.showQuestionModal()">+ سؤال</button></div>`;
    html += '<div class="card">';
    if (exam.questions && exam.questions.length) {
      exam.questions.forEach((q, idx) => {
        html += `<div class="question-box"><h4>س ${idx+1}: ${this.escapeHtml(q.text)}</h4>`;
        q.options.forEach((opt, i) => { html += `<label class="option-label"><input type="radio" name="q_${idx}" value="${i}"> ${this.escapeHtml(opt)}</label>`; });
        html += '</div>';
      });
    } else { html += '<p style="color:#888;">لا توجد أسئلة بعد.</p>'; }
    html += '</div>';
    if (this.data.currentUser.role === 'student') {
      html += `<div class="card" style="position:sticky; bottom:10px; background:#fff;"><div class="exam-timer" id="examTimerDisplay">${exam.duration}:00</div><button class="btn btn-success btn-block" onclick="app.submitExam()">📤 تسليم الاختبار</button></div>`;
      setTimeout(() => this.setupExamTimer(), 300);
    }
    return html;
  },
  showQuestionModal() {
    this.openModal(`<div class="modal"><h3>إضافة سؤال</h3>
      <div class="form-group"><label>نص السؤال</label><textarea id="qText" rows="2"></textarea></div>
      <div class="form-group"><label>الخيار 1</label><input id="qOpt0"></div>
      <div class="form-group"><label>الخيار 2</label><input id="qOpt1"></div>
      <div class="form-group"><label>الخيار 3</label><input id="qOpt2"></div>
      <div class="form-group"><label>الخيار 4</label><input id="qOpt3"></div>
      <div class="form-group"><label>الإجابة الصحيحة (0-3)</label><input type="number" id="qCorrect" value="0" min="0" max="3"></div>
      <button class="btn btn-primary btn-block" onclick="app.saveQuestion()">💾 حفظ</button>
      <button class="btn btn-secondary btn-block" onclick="app.closeModal()">إلغاء</button>
    </div>`);
  },
  async saveQuestion() {
    const text = document.getElementById('qText').value.trim();
    const options = [0,1,2,3].map(i => document.getElementById(`qOpt${i}`).value.trim());
    const correct = parseInt(document.getElementById('qCorrect').value) || 0;
    if (!text || options.some(o => !o)) return this.showToast('أدخل السؤال والخيارات','error');
    try {
      const exam = this.data.exams.find(e => e.id === this.data.activeExamId);
      const questions = exam.questions || [];
      questions.push({text, options, correct});
      await db.collection('exams').doc(this.data.activeExamId).update({questions});
      this.showToast('تم إضافة السؤال'); this.closeModal();
    } catch(e) { this.showToast('خطأ','error'); }
  },
  setupExamTimer() {
    const exam = this.data.exams.find(e => e.id === this.data.activeExamId);
    if (!exam) return;
    let timeLeft = (exam.duration || 20) * 60;
    clearInterval(this.data.timerInterval);
    this.data.timerInterval = setInterval(() => {
      timeLeft--;
      const m = Math.floor(timeLeft/60), s = timeLeft%60;
      const display = document.getElementById('examTimerDisplay');
      if (display) display.innerText = `${m}:${s<10?'0'+s:s}`;
      if (timeLeft <= 0) { clearInterval(this.data.timerInterval); this.showToast('انتهى الوقت!','error'); this.navigate('myExams'); }
    }, 1000);
  },
  submitExam() { clearInterval(this.data.timerInterval); this.showToast('تم تسليم الاختبار بنجاح!'); this.navigate('myExams'); },
  /* =========================================================
     13. STUDENT CARD
     ========================================================= */
  renderStudentCardPage() {
    const u = this.data.currentUser;
    if (u.role !== 'student') return this.renderForbidden();
    const student = this.data.students.find(s => s.id === u.studentId);
    if (!student) return `<div class="card"><h2>🪪 بطاقة الطالب</h2><p>لم يتم ربط حسابك بملف طالب.</p></div>`;
    return this.buildStudentCard(student);
  },
  showStudentCard(studentId) {
    const student = this.data.students.find(s => s.id === studentId);
    if (!student) return this.showToast('الطالب غير موجود','error');
    const cardHtml = this.buildStudentCard(student);
    this.openModal(`<div class="modal" style="max-width:600px;">${cardHtml}<div style="margin-top:16px; display:flex; gap:10px;"><button class="btn btn-primary btn-block" onclick="window.print()">🖨️ طباعة</button><button class="btn btn-secondary btn-block" onclick="app.closeModal()">إغلاق</button></div></div>`);
  },
  buildStudentCard(student) {
    const sectionName = this.getSectionName(student.sectionId);
    const levelName = this.getLevelName(this.data.sections.find(s=>s.id===student.sectionId)?.levelId);
    const stageName = this.getStageName(this.data.levels.find(l=>l.id===this.data.sections.find(s=>s.id===student.sectionId)?.levelId)?.stageId);
    const attendanceCount = this.data.attendance.filter(a => a.studentId === student.id || a.studentName === student.fullName).length;
    const serial = (student.serialNumber || student.id.slice(-6)).toString().padStart(6, '0');
    return `
    <div class="student-card" id="studentCardPrint">
      <div class="card-header">
        <div class="logo-mini">🕌</div>
        <div class="institute-name">معهد الإمام سحنون للعلوم الشرعية</div>
      </div>
      <div class="card-body">
        <div class="card-row"><span class="card-label">الرقم التسلسلي:</span><span class="card-value">#${serial}</span></div>
        <div class="card-row"><span class="card-label">الاسم الكامل:</span><span class="card-value">${this.escapeHtml(student.fullName)}</span></div>
        <div class="card-row"><span class="card-label">المرحلة:</span><span class="card-value">${stageName}</span></div>
        <div class="card-row"><span class="card-label">المستوى:</span><span class="card-value">${levelName}</span></div>
        <div class="card-row"><span class="card-label">القسم:</span><span class="card-value">${sectionName}</span></div>
        <div class="card-row"><span class="card-label">السن:</span><span class="card-value">${student.age || '—'}</span></div>
        <div class="card-row"><span class="card-label">البلد/المدينة:</span><span class="card-value">${student.country || '—'} / ${student.city || '—'}</span></div>
        <div class="card-row"><span class="card-label">المستوى الأكاديمي:</span><span class="card-value">${student.academicLevel || '—'}</span></div>
        <div class="card-row"><span class="card-label">المهنة:</span><span class="card-value">${student.job || '—'}</span></div>
        <div class="card-row"><span class="card-label">تاريخ الدخول:</span><span class="card-value">${student.entryDate || '—'}</span></div>
        <div class="card-row"><span class="card-label">عدد مرات الحضور:</span><span class="card-value">${attendanceCount}</span></div>
      </div>
      <div class="card-footer">بطاقة متابعة طالب — معهد الإمام سحنون</div>
    </div>`;
  },
  /* =========================================================
     14. NOTIFICATIONS
     ========================================================= */
  renderNotifications() {
    return `<div class="header-bar"><h2>🔔 إدارة الإشعارات</h2><button class="btn btn-primary" onclick="app.showNotificationModal()">+ إشعار</button></div>
      <div class="card"><div class="table-wrap" id="notificationsTableWrap"></div></div>`;
  },
  renderNotificationsTable() {
    const wrap = document.getElementById('notificationsTableWrap'); if (!wrap) return;
    if (!this.data.notifications.length) { wrap.innerHTML = '<div class="empty-state">لا يوجد إشعارات</div>'; return; }
    let html = '<table><thead><tr><th>العنوان</th><th>النوع</th><th>المستلم</th><th>التاريخ</th><th>إجراءات</th></tr></thead><tbody>';
    this.data.notifications.forEach(n => {
      const target = n.targetId === 'all' ? 'الجميع' : this.getStudentName(n.targetId) || this.getTeacherName(n.targetId) || n.targetId;
      html += `<tr><td><strong>${this.escapeHtml(n.title)}</strong><br><small>${this.escapeHtml(n.body||'')}</small></td>
        <td><span class="badge badge-info">${n.type || 'عام'}</span></td>
        <td>${target}</td>
        <td>${this.formatDate(n.timestamp)}</td>
        <td><button class="btn btn-danger" onclick="app.deleteDoc('notifications','${n.id}')">حذف</button></td></tr>`;
    });
    html += '</tbody></table>'; wrap.innerHTML = html;
  },
  showNotificationModal() {
    const targets = '<option value="all">الجميع</option>' + this.data.students.map(s => `<option value="${s.id}">${this.escapeHtml(s.fullName)}</option>`).join('') + this.data.teachers.map(t => `<option value="${t.id}">${this.escapeHtml(t.fullName)}</option>`).join('');
    const types = '<option value="عام">إعلان عام</option><option value="غياب">تنبيه غياب</option><option value="حصة">تغيير حصة</option><option value="اختبار">اختبار</option>';
    this.openModal(`<div class="modal"><h3>إرسال إشعار</h3>
      <div class="form-group"><label>العنوان</label><input id="notifTitle"></div>
      <div class="form-group"><label>المحتوى</label><textarea id="notifBody" rows="3"></textarea></div>
      <div class="form-group"><label>النوع</label><select id="notifType">${types}</select></div>
      <div class="form-group"><label>المستلم</label><select id="notifTarget">${targets}</select></div>
      <button class="btn btn-primary btn-block" onclick="app.saveNotification()">📨 إرسال</button>
      <button class="btn btn-secondary btn-block" onclick="app.closeModal()">إلغاء</button>
    </div>`);
  },
  async saveNotification() {
    const title = document.getElementById('notifTitle').value.trim();
    const body = document.getElementById('notifBody').value.trim();
    const type = document.getElementById('notifType').value;
    const targetId = document.getElementById('notifTarget').value;
    if (!title) return this.showToast('أدخل عنوان الإشعار','error');
    try {
      await db.collection('notifications').add({ title, body, type, targetId, read: false, timestamp: new Date() });
      this.showToast('تم إرسال الإشعار'); this.closeModal();
    } catch(e) { this.showToast('خطأ في الإرسال','error'); }
  },
  renderMyNotifications() {
    const u = this.data.currentUser; if (!u) return this.renderForbidden();
    let html = `<div class="header-bar"><h2>🔔 إشعاراتي</h2></div><div class="card">`;
    if (!this.data.myNotifications.length) { html += '<p style="color:#888;">لا توجد إشعارات جديدة.</p>'; }
    else {
      html += '<div class="notifications-list">';
      this.data.myNotifications.forEach(n => {
        html += `<div class="notification-item ${n.read ? 'read' : 'unread'}">
          <div class="notification-title">${this.escapeHtml(n.title)} <span class="badge badge-${n.type==='غياب'?'danger':n.type==='حصة'?'warning':'info'}">${n.type||'عام'}</span></div>
          <div class="notification-body">${this.escapeHtml(n.body||'')}</div>
          <div class="notification-meta">${this.formatDate(n.timestamp)}</div>
        </div>`;
      });
      html += '</div>';
    }
    html += '</div>';
    setTimeout(() => this.markMyNotificationsRead(), 500);
    return html;
  },
  async markMyNotificationsRead() {
    const u = this.data.currentUser; if (!u) return;
    const unread = this.data.myNotifications.filter(n => !n.read);
    for (const n of unread) {
      try { await db.collection('notifications').doc(n.id).update({read: true}); } catch(e) {}
    }
    this.data.myUnreadCount = 0; this.renderBadge();
  },
  /* =========================================================
     15. ARCHIVE
     ========================================================= */
  renderArchive() {
    return `<div class="header-bar"><h2>📁 الأرشيف</h2></div>
      <div class="card" style="display:flex; gap:10px; flex-wrap:wrap;">
        <button class="btn btn-success" onclick="app.exportArchive('students')">👨‍🎓 أرشيف الطلاب (Excel)</button>
        <button class="btn btn-success" onclick="app.exportArchive('teachers')">👨‍🏫 أرشيف الأساتذة (Excel)</button>
        <button class="btn btn-success" onclick="app.exportArchive('attendance')">✅ أرشيف الحضور (Excel)</button>
      </div>
      <div class="card"><p style="color:#888;">يتم تصدير البيانات بصيغة HTML-Table متوافقة مع Excel (يمكن فتحها مباشرة في Excel).</p></div>`;
  },
  exportArchive(collection) {
    let rows = [];
    if (collection === 'students') {
      rows = this.data.students.map((s, i) => [i+1, s.fullName, s.phone||'', this.getSectionName(s.sectionId), s.age||'', s.country||'', s.city||'', s.academicLevel||'', s.job||'', s.entryDate||'']);
      return this.downloadExcel(rows, ['#','الاسم','الهاتف','القسم','السن','البلد','المدينة','المستوى الأكاديمي','المهنة','تاريخ الدخول'], 'أرشيف_الطلاب');
    } else if (collection === 'teachers') {
      rows = this.data.teachers.map((t, i) => [i+1, t.fullName, t.phone||'', t.specialty||'', t.age||'', t.country||'', t.city||'', t.academicLevel||'', t.job||'', t.entryDate||'']);
      return this.downloadExcel(rows, ['#','الاسم','الهاتف','التخصص','السن','البلد','المدينة','المستوى الأكاديمي','المهنة','تاريخ الدخول'], 'أرشيف_الأساتذة');
    } else if (collection === 'attendance') {
      rows = this.data.attendance.map((a, i) => [i+1, this.getStudentName(a.studentId) || a.studentName || '', this.getSectionName(a.studentSectionId), this.data.lessons.find(l=>l.id===a.lessonId)?.title || '', this.formatDate(a.timestamp)]);
      return this.downloadExcel(rows, ['#','الطالب','القسم','الدرس','التاريخ'], 'أرشيف_الحضور');
    }
  },
  downloadExcel(rows, headers, filename) {
    let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${filename}</title></head><body style="direction:rtl; text-align:right;"><table border="1" style="border-collapse:collapse;"><thead><tr style="background:#1a5f2a; color:white;">`;
    headers.forEach(h => html += `<th style="padding:8px;">${h}</th>`);
    html += '</tr></thead><tbody>';
    rows.forEach(r => { html += '<tr>'; r.forEach(c => html += `<td style="padding:6px;">${this.escapeHtml(String(c||''))}</td>`); html += '</tr>'; });
    html += '</tbody></table></body></html>';
    const blob = new Blob(['\ufeff'+html], {type:'application/vnd.ms-excel'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${filename}.xls`; a.click();
    this.showToast('تم تصدير الأرشيف');
  },
  /* =========================================================
     16. ABOUT
     ========================================================= */
  renderAboutPage() {
    return `<div class="header-bar"><h2>🏛️ عن المعهد</h2></div>
      <div class="card">
        <h3 style="color:#1a5f2a; margin-bottom:14px; font-size:1.3rem;">رؤيتنا ورسالتنا</h3>
        <p style="line-height:1.8; color:#444; font-size:1rem;">تأسس معهد الإمام سحنون للعلوم الشرعية ليقدم بيئة تعليمية متكاملة تجمع بين التأصيل العلمي الأكاديمي للعلوم الشرعية وبين الاستفادة من أفضل الوسائل التقنية السحابية الحديثة.</p>
        <p style="line-height:1.8; color:#444; font-size:1rem; margin-top:10px;">نسعى لإعداد طلاب العلم الشرعي على منهج أهل السنة والجماعة، بأسلوب تقني متطور يسهل الوصول إلى العلم ويوثق المسيرة التعليمية بشكل احترافي.</p>
      </div>`;
  },
  /* =========================================================
     17. GENERAL DELETE
     ========================================================= */
  async deleteDoc(colName, docId) {
    if (!confirm('هل أنت متأكد من الحذف من السحابة؟')) return;
    try { await db.collection(colName).doc(docId).delete(); this.showToast('تم الحذف'); } catch(e) { this.showToast('خطأ في الحذف','error'); }
  },
  /* =========================================================
     18. INIT
     ========================================================= */
  init() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('attendanceLesson')) {
      this.startSync();
      setTimeout(() => this.showAttendanceRegistration(), 1500);
    } else {
      this.checkAuth();
    }
  }
};
app.init();
