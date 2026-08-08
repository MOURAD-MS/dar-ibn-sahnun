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
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

/* =========================================================
   2. APP CORE
   ========================================================= */
const app = {
  data: {
    currentUser: null,
    currentPage: 'dashboard',
    activeExamId: null,
    timerInterval: null,
    students: [], teachers: [], lessons: [], materials: [],
    exams: [], attendance: [], timetable: [], users: [],
    stages: [], levels: [], sections: [], subjects: [], courses: [],
    menuOpen: false
  },
  /* ---------- Helpers ---------- */
  showToast(msg, type='success') {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast show ' + type;
    setTimeout(() => t.className = 'toast', 3500);
  },
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
  },
  formatDate(d) {
    if (!d) return 'غير محدد';
    try {
      const date = d.toDate ? d.toDate() : new Date(d);
      return date.toLocaleString('ar-DZ', { dateStyle:'short', timeStyle:'short' });
    } catch { return 'غير محدد'; }
  },
  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  },
  /* ---------- Menu Toggle (Mobile) ---------- */
  toggleMenu() {
    this.data.menuOpen = !this.data.menuOpen;
    const sb = document.getElementById('sidebar');
    const ov = document.getElementById('menuOverlay');
    if (this.data.menuOpen) { sb.classList.add('open'); ov.classList.add('show'); }
    else { sb.classList.remove('open'); ov.classList.remove('show'); }
  },
  closeMenuIfMobile() {
    if (window.innerWidth <= 768) {
      this.data.menuOpen = false;
      document.getElementById('sidebar').classList.remove('open');
      document.getElementById('menuOverlay').classList.remove('show');
    }
  },
  /* ---------- Login Tabs ---------- */
  switchLoginTab(tab) {
    document.getElementById('tabUser').classList.toggle('active', tab === 'user');
    document.getElementById('tabAdmin').classList.toggle('active', tab === 'admin');
    document.getElementById('userLoginForm').classList.toggle('hidden', tab !== 'user');
    document.getElementById('adminLoginForm').classList.toggle('hidden', tab !== 'admin');
  },
  /* ---------- Auth ---------- */
  async login() {
    const user = document.getElementById('loginUsername').value.trim().replace(/\s/g, '');
    const pass = document.getElementById('loginPassword').value;
    if (!user || !pass) { this.showToast('أدخل اسم المستخدم وكلمة المرور', 'error'); return; }
    try {
      await firebase.auth().signInAnonymously();
    } catch(e) { console.log('anon auth ok'); }
    try {
      const snap = await db.collection('users').where('username', '==', user).where('password', '==', pass).limit(1).get();
      if (snap.empty) { this.showToast('اسم المستخدم أو كلمة المرور غير صحيحة', 'error'); return; }
      const u = { id: snap.docs[0].id, ...snap.docs[0].data() };
      this.data.currentUser = u;
      this.buildNav(); this.startSync(); this.navigate('dashboard');
      document.getElementById('loginScreen').classList.add('hidden');
      document.getElementById('appContainer').classList.remove('hidden');
      this.showToast('مرحباً بك ' + u.name);
    } catch(e) { this.showToast('خطأ في الاتصال', 'error'); }
  },
  async adminLogin() {
    const email = document.getElementById('adminEmail').value.trim().toLowerCase();
    const pass = document.getElementById('adminPassword').value;
    if (!email || !pass) { this.showToast('أدخل البريد وكلمة المرور', 'error'); return; }
    try {
      await firebase.auth().signInWithEmailAndPassword(email, pass);
      const user = { name: 'المدير', role: 'admin', username: 'admin' };
      this.data.currentUser = user;
      this.buildNav(); this.startSync(); this.navigate('dashboard');
      document.getElementById('loginScreen').classList.add('hidden');
      document.getElementById('appContainer').classList.remove('hidden');
      this.showToast('مرحباً أيها المدير');
    } catch(e) { this.showToast('بيانات الدخول خاطئة', 'error'); }
  },
  async checkAuth() {
    firebase.auth().onAuthStateChanged(async user => {
      if (!user) {
        // Ensure we still have a Firebase Auth user for anonymous
        try { await firebase.auth().signInAnonymously(); } catch(e) {}
      }
    });
  },
  async logout() {
    this.data.currentUser = null; this.data.currentPage = 'dashboard';
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('appContainer').classList.add('hidden');
    this.stopSync(); this.closeMenuIfMobile();
    document.getElementById('loginUsername').value = '';
    document.getElementById('loginPassword').value = '';
    document.getElementById('adminEmail').value = '';
    document.getElementById('adminPassword').value = '';
  },
  /* ---------- Navigation ---------- */
  buildNav() {
    const r = this.data.currentUser?.role;
    if (!r) return;
    const items = [
      { id:'dashboard', label:'📊 الرئيسية', roles:['admin','teacher','student'] },
      { id:'stages', label:'🏛️ المراحل', roles:['admin'] },
      { id:'levels', label:'📐 المستويات', roles:['admin'] },
      { id:'sections', label:'🏫 الأقسام', roles:['admin'] },
      { id:'subjects', label:'📚 المواد', roles:['admin'] },
      { id:'courses', label:'📖 المقررات', roles:['admin'] },
      { id:'students', label:'👨‍🎓 الطلاب', roles:['admin','teacher'] },
      { id:'teachers', label:'👨‍🏫 المدرسون', roles:['admin'] },
      { id:'users', label:'👥 إدارة المستخدمين', roles:['admin'] },
      { id:'timetable', label:'📅 الجدول الأسبوعي', roles:['admin','teacher','student'] },
      { id:'lessons', label:'📚 الدروس والحضور', roles:['admin','teacher'] },
      { id:'attendance', label:'✅ الحضور والغياب', roles:['admin','teacher'] },
      { id:'library', label:'📖 المكتبة السحابية', roles:['admin','teacher','student'] },
      { id:'exams', label:'📝 الاختبارات', roles:['admin','teacher'] },
      { id:'myLessons', label:'📖 حصصي', roles:['student'] },
      { id:'myExams', label:'📝 اختباراتي', roles:['student'] },
      { id:'about', label:'🏛️ عن المعهد', roles:['admin','teacher','student'] }
    ];
    document.getElementById('navMenu').innerHTML = items.filter(i=>i.roles.includes(r)).map(i =>
      `<div class="nav-item ${this.data.currentPage===i.id?'active':''}" onclick="app.navigate('${i.id}')" data-page="${i.id}">${i.label}</div>`
    ).join('');
  },
  navigate(page, extra) {
    if (!this.data.currentUser) {
      this.showToast('الجلسة انتهت، سجّل الدخول من جديد', 'error');
      this.logout(); return;
    }
    this.data.currentPage = page;
    if (page === 'takeExam') { this.data.activeExamId = extra; }
    if (page === 'examQuestions') { this.data.activeExamId = extra; }
    this.closeMenuIfMobile(); this.buildNav();
    const content = this.getPageContent(page);
    document.getElementById('mainContent').innerHTML = content;
    if (page === 'takeExam') { this.setupExamTimer(); }
    if (page === 'attendance') { this.renderAttendanceList(); }
    if (page === 'timetable') { this.renderTimetableView(); }
    if (page === 'students') { this.renderStudentsTable(); }
    if (page === 'teachers') { this.renderTeachersTable(); }
    if (page === 'users') { this.renderUsersTable(); }
    if (page === 'library') { this.renderLibraryGrid(); }
    if (page === 'exams') { this.renderExamsTable(); }
    if (page === 'examQuestions') { this.renderExamQuestionsList(); }
    if (page === 'lessons') { this.renderLessonsList(); }
    if (page === 'dashboard') { this.renderDashboardStats(); }
    if (page === 'stages') { this.renderStagesList(); }
    if (page === 'levels') { this.renderLevelsList(); }
    if (page === 'sections') { this.renderSectionsList(); }
    if (page === 'subjects') { this.renderSubjectsList(); }
    if (page === 'courses') { this.renderCoursesList(); }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },
  /* ---------- Cloud Sync ---------- */
  unsubscribers: [],
  startSync() {
    this.unsubscribers = [
      db.collection('users').onSnapshot(snap => { this.data.users = snap.docs.map(d=>({id:d.id,...d.data()})); if(this.data.currentPage==='users') this.renderUsersTable(); }),
      db.collection('students').onSnapshot(snap => { this.data.students = snap.docs.map(d=>({id:d.id,...d.data()})); if(this.data.currentPage==='students') this.renderStudentsTable(); if(this.data.currentPage==='dashboard') this.renderDashboardStats(); }),
      db.collection('teachers').onSnapshot(snap => { this.data.teachers = snap.docs.map(d=>({id:d.id,...d.data()})); if(this.data.currentPage==='teachers') this.renderTeachersTable(); if(this.data.currentPage==='dashboard') this.renderDashboardStats(); }),
      db.collection('lessons').onSnapshot(snap => { this.data.lessons = snap.docs.map(d=>({id:d.id,...d.data()})); if(this.data.currentPage==='lessons') this.renderLessonsList(); if(this.data.currentPage==='myLessons') this.navigate('myLessons'); }),
      db.collection('materials').onSnapshot(snap => { this.data.materials = snap.docs.map(d=>({id:d.id,...d.data()})); if(this.data.currentPage==='library') this.renderLibraryGrid(); }),
      db.collection('exams').onSnapshot(snap => { this.data.exams = snap.docs.map(d=>({id:d.id,...d.data()})); if(this.data.currentPage==='exams') this.renderExamsTable(); if(this.data.currentPage==='examQuestions') this.renderExamQuestionsList(); if(this.data.currentPage==='myExams') this.navigate('myExams'); }),
      db.collection('attendance').onSnapshot(snap => { this.data.attendance = snap.docs.map(d=>({id:d.id,...d.data()})); if(this.data.currentPage==='attendance') this.renderAttendanceList(); }),
      db.collection('timetable').onSnapshot(snap => { this.data.timetable = snap.docs.map(d=>({id:d.id,...d.data()})); if(this.data.currentPage==='timetable') this.renderTimetableView(); }),
      db.collection('stages').onSnapshot(snap => { this.data.stages = snap.docs.map(d=>({id:d.id,...d.data()})); if(this.data.currentPage==='stages') this.renderStagesList(); if(this.data.currentPage==='levels') this.renderLevelsList(); if(this.data.currentPage==='sections') this.renderSectionsList(); }),
      db.collection('levels').onSnapshot(snap => { this.data.levels = snap.docs.map(d=>({id:d.id,...d.data()})); if(this.data.currentPage==='levels') this.renderLevelsList(); if(this.data.currentPage==='sections') this.renderSectionsList(); }),
      db.collection('sections').onSnapshot(snap => { this.data.sections = snap.docs.map(d=>({id:d.id,...d.data()})); if(this.data.currentPage==='sections') this.renderSectionsList(); if(this.data.currentPage==='courses') this.renderCoursesList(); }),
      db.collection('subjects').onSnapshot(snap => { this.data.subjects = snap.docs.map(d=>({id:d.id,...d.data()})); if(this.data.currentPage==='subjects') this.renderSubjectsList(); if(this.data.currentPage==='courses') this.renderCoursesList(); }),
      db.collection('courses').onSnapshot(snap => { this.data.courses = snap.docs.map(d=>({id:d.id,...d.data()})); if(this.data.currentPage==='courses') this.renderCoursesList(); })
    ];
  },
  stopSync() {
    this.unsubscribers.forEach(u => u && u());
    this.unsubscribers = [];
  },
  /* ---------- Modal ---------- */
  openModal(html) {
    const existing = document.querySelector('.modal-overlay');
    if (existing) existing.remove();
    document.body.insertAdjacentHTML('beforeend', `<div class="modal-overlay" onclick="if(event.target===this) app.closeModal()">${html}</div>`);
    document.body.style.overflow = 'hidden';
  },
  closeModal() {
    const m = document.querySelector('.modal-overlay');
    if (m) m.remove();
    document.body.style.overflow = '';
  },
  /* =========================================================
     3. DASHBOARD
     ========================================================= */
  getPageContent(page) {
    switch(page) {
      case 'dashboard': return this.renderDashboard();
      case 'stages': return this.renderStagesPage();
      case 'levels': return this.renderLevelsPage();
      case 'sections': return this.renderSectionsPage();
      case 'subjects': return this.renderSubjectsPage();
      case 'courses': return this.renderCoursesPage();
      case 'students': return this.renderStudentsPage();
      case 'teachers': return this.renderTeachersPage();
      case 'users': return this.renderUsersPage();
      case 'timetable': return this.renderTimetablePage();
      case 'lessons': return this.renderLessonsPage();
      case 'attendance': return this.renderAttendancePage();
      case 'library': return this.renderLibraryPage();
      case 'exams': return this.renderExamsPage();
      case 'examQuestions': return this.renderExamQuestions();
      case 'myLessons': return this.renderMyLessonsPage();
      case 'myExams': return this.renderMyExamsPage();
      case 'takeExam': return this.renderTakeExamPage();
      case 'about': return this.renderAboutPage();
      default: return '<div class="card">الصفحة غير موجودة</div>';
    }
  },
  renderDashboard() {
    const r = this.data.currentUser?.role;
    const quickActions = r === 'admin' ? `
      <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:12px;">
        <button class="btn btn-primary" onclick="app.navigate('users')">+ مستخدم جديد</button>
        <button class="btn btn-success" onclick="app.navigate('lessons')">+ درس جديد</button>
        <button class="btn btn-info" onclick="app.navigate('timetable')">📅 الجدول الأسبوعي</button>
        <button class="btn btn-warning" onclick="app.navigate('exams')">+ اختبار جديد</button>
      </div>` : r === 'teacher' ? `
      <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:12px;">
        <button class="btn btn-success" onclick="app.navigate('lessons')">+ درس جديد</button>
        <button class="btn btn-info" onclick="app.navigate('timetable')">📅 الجدول الأسبوعي</button>
        <button class="btn btn-warning" onclick="app.navigate('exams')">+ اختبار جديد</button>
      </div>` : '';
    return `<div class="header-bar"><h2>📊 لوحة التحكم</h2><div class="cloud-indicator">☁️ متصل بالسحابة</div></div>
      <div class="stats-grid" id="dashStats"></div>
      <div class="card"><h3>⚡ إجراءات سريعة</h3>${quickActions || '<p style="color:#888;">استكشف الجدول والمكتبة والاختبارات من القائمة.</p>'}</div>
      <div class="card"><h3>📈 آخر النشاطات</h3><p style="color:#888; margin-top:8px;">البيانات تُحمل مباشرة من السحابة...</p></div>`;
  },
  renderDashboardStats() {
    const el = document.getElementById('dashStats');
    if (!el) return;
    el.innerHTML = `
      <div class="stat-card"><div class="number">${this.data.stages.length}</div><div class="label">المراحل</div></div>
      <div class="stat-card"><div class="number">${this.data.levels.length}</div><div class="label">المستويات</div></div>
      <div class="stat-card"><div class="number">${this.data.sections.length}</div><div class="label">الأقسام</div></div>
      <div class="stat-card"><div class="number">${this.data.students.length}</div><div class="label">الطلاب</div></div>
      <div class="stat-card"><div class="number">${this.data.teachers.length}</div><div class="label">المدرسون</div></div>
      <div class="stat-card"><div class="number">${this.data.lessons.length}</div><div class="label">الدروس</div></div>`;
  },
  /* =========================================================
     4. STAGES MANAGEMENT
     ========================================================= */
  renderStagesPage() {
    return `<div class="header-bar"><h2>🏛️ المراحل الدراسية</h2><button class="btn btn-primary" onclick="app.showStageModal()">+ مرحلة جديدة</button></div>
      <div class="card"><div class="table-wrap" id="stagesTableWrap"></div></div>`;
  },
  renderStagesList() {
    const wrap = document.getElementById('stagesTableWrap');
    if (!wrap) return;
    if (!this.data.stages.length) { wrap.innerHTML = '<div class="empty-state">لا توجد مراحل مسجلة. أضف مرحلة أولاً.</div>'; return; }
    let html = `<table><tr><th>المرحلة</th><th>المستويات</th><th>إجراءات</th></tr>`;
    this.data.stages.forEach(s => {
      const levelsCount = this.data.levels.filter(l => l.stageId === s.id).length;
      html += `<tr><td><strong>${this.escapeHtml(s.name)}</strong></td><td><span class="badge badge-info">${levelsCount} مستوى</span></td>
        <td><button class="btn btn-danger" onclick="app.deleteDoc('stages','${s.id}')">حذف</button></td></tr>`;
    });
    html += '</table>';
    wrap.innerHTML = html;
  },
  showStageModal() {
    this.openModal(`<div class="modal"><h3>إضافة مرحلة دراسية</h3>
      <div class="form-group"><label>اسم المرحلة</label><input id="stageName" placeholder="مثال: المتوسط، الثانوي، الجامعي..."></div>
      <button class="btn btn-primary btn-block" onclick="app.saveStage()">💾 حفظ</button>
      <button class="btn btn-secondary btn-block" onclick="app.closeModal()">إلغاء</button>
    </div>`);
  },
  async saveStage() {
    const name = document.getElementById('stageName').value.trim();
    if (!name) return this.showToast('يرجى إدخال اسم المرحلة', 'error');
    try {
      await db.collection('stages').add({ name, createdAt: new Date() });
      this.showToast('تم إضافة المرحلة'); this.closeModal();
    } catch(e) { this.showToast('خطأ في الحفظ', 'error'); }
  },
  /* =========================================================
     5. LEVELS MANAGEMENT
     ========================================================= */
  renderLevelsPage() {
    return `<div class="header-bar"><h2>📐 المستويات الدراسية</h2><button class="btn btn-primary" onclick="app.showLevelModal()">+ مستوى جديد</button></div>
      <div class="card"><div class="table-wrap" id="levelsTableWrap"></div></div>`;
  },
  renderLevelsList() {
    const wrap = document.getElementById('levelsTableWrap');
    if (!wrap) return;
    if (!this.data.levels.length) { wrap.innerHTML = '<div class="empty-state">لا توجد مستويات مسجلة. أضف مستوى أولاً.</div>'; return; }
    let html = `<table><tr><th>المستوى</th><th>المرحلة</th><th>الأقسام</th><th>إجراءات</th></tr>`;
    this.data.levels.forEach(l => {
      const stage = this.data.stages.find(s => s.id === l.stageId);
      const sectionsCount = this.data.sections.filter(s => s.levelId === l.id).length;
      html += `<tr><td><strong>${this.escapeHtml(l.name)}</strong></td><td>${this.escapeHtml(stage ? stage.name : '—')}</td>
        <td><span class="badge badge-info">${sectionsCount} قسم</span></td>
        <td><button class="btn btn-danger" onclick="app.deleteDoc('levels','${l.id}')">حذف</button></td></tr>`;
    });
    html += '</table>';
    wrap.innerHTML = html;
  },
  showLevelModal() {
    const stagesOpts = this.data.stages.map(s => `<option value="${s.id}">${this.escapeHtml(s.name)}</option>`).join('');
    if (!stagesOpts) { this.showToast('أضف مرحلة أولاً', 'error'); return; }
    this.openModal(`<div class="modal"><h3>إضافة مستوى دراسي</h3>
      <div class="form-group"><label>اسم المستوى</label><input id="levelName" placeholder="مثال: السنة الأولى، السنة الثانية..."></div>
      <div class="form-group"><label>المرحلة الأم</label><select id="levelStageId">${stagesOpts}</select></div>
      <button class="btn btn-primary btn-block" onclick="app.saveLevel()">💾 حفظ</button>
      <button class="btn btn-secondary btn-block" onclick="app.closeModal()">إلغاء</button>
    </div>`);
  },
  async saveLevel() {
    const name = document.getElementById('levelName').value.trim();
    const stageId = document.getElementById('levelStageId').value;
    if (!name || !stageId) return this.showToast('يرجى ملء جميع الحقول', 'error');
    try {
      await db.collection('levels').add({ name, stageId, createdAt: new Date() });
      this.showToast('تم إضافة المستوى'); this.closeModal();
    } catch(e) { this.showToast('خطأ في الحفظ', 'error'); }
  },
  /* =========================================================
     6. SECTIONS MANAGEMENT
     ========================================================= */
  renderSectionsPage() {
    return `<div class="header-bar"><h2>🏫 الأقسام الدراسية</h2><button class="btn btn-primary" onclick="app.showSectionModal()">+ قسم جديد</button></div>
      <div class="card"><div class="table-wrap" id="sectionsTableWrap"></div></div>`;
  },
  renderSectionsList() {
    const wrap = document.getElementById('sectionsTableWrap');
    if (!wrap) return;
    if (!this.data.sections.length) { wrap.innerHTML = '<div class="empty-state">لا توجد أقسام مسجلة. أضف قسم أولاً.</div>'; return; }
    let html = `<table><tr><th>القسم</th><th>المستوى</th><th>المرحلة</th><th>الطلاب</th><th>إجراءات</th></tr>`;
    this.data.sections.forEach(s => {
      const level = this.data.levels.find(l => l.id === s.levelId);
      const stage = level ? this.data.stages.find(st => st.id === level.stageId) : null;
      const studentsCount = this.data.students.filter(st => st.sectionId === s.id).length;
      html += `<tr><td><strong>${this.escapeHtml(s.name)}</strong></td>
        <td>${this.escapeHtml(level ? level.name : '—')}</td>
        <td>${this.escapeHtml(stage ? stage.name : '—')}</td>
        <td><span class="badge badge-info">${studentsCount} طالب</span></td>
        <td><button class="btn btn-danger" onclick="app.deleteDoc('sections','${s.id}')">حذف</button></td></tr>`;
    });
    html += '</table>';
    wrap.innerHTML = html;
  },
  showSectionModal() {
    const levelsOpts = this.data.levels.map(l => {
      const stage = this.data.stages.find(s => s.id === l.stageId);
      return `<option value="${l.id}">${this.escapeHtml(l.name)} (${this.escapeHtml(stage ? stage.name : '—')})</option>`;
    }).join('');
    if (!levelsOpts) { this.showToast('أضف مستوى أولاً', 'error'); return; }
    this.openModal(`<div class="modal"><h3>إضافة قسم دراسي</h3>
      <div class="form-group"><label>اسم القسم</label><input id="sectionName" placeholder="مثال: القسم أ، القسم ب..."></div>
      <div class="form-group"><label>المستوى الأم</label><select id="sectionLevelId">${levelsOpts}</select></div>
      <button class="btn btn-primary btn-block" onclick="app.saveSection()">💾 حفظ</button>
      <button class="btn btn-secondary btn-block" onclick="app.closeModal()">إلغاء</button>
    </div>`);
  },
  async saveSection() {
    const name = document.getElementById('sectionName').value.trim();
    const levelId = document.getElementById('sectionLevelId').value;
    if (!name || !levelId) return this.showToast('يرجى ملء جميع الحقول', 'error');
    try {
      await db.collection('sections').add({ name, levelId, createdAt: new Date() });
      this.showToast('تم إضافة القسم'); this.closeModal();
    } catch(e) { this.showToast('خطأ في الحفظ', 'error'); }
  },
  /* =========================================================
     7. SUBJECTS MANAGEMENT
     ========================================================= */
  renderSubjectsPage() {
    return `<div class="header-bar"><h2>📚 المواد العلمية</h2><button class="btn btn-primary" onclick="app.showSubjectModal()">+ مادة جديدة</button></div>
      <div class="card"><div class="table-wrap" id="subjectsTableWrap"></div></div>`;
  },
  renderSubjectsList() {
    const wrap = document.getElementById('subjectsTableWrap');
    if (!wrap) return;
    if (!this.data.subjects.length) { wrap.innerHTML = '<div class="empty-state">لا توجد مواد مسجلة. أضف مادة أولاً.</div>'; return; }
    let html = `<table><tr><th>المادة</th><th>المقررات المرتبطة</th><th>إجراءات</th></tr>`;
    this.data.subjects.forEach(s => {
      const coursesCount = this.data.courses.filter(c => c.subjectId === s.id).length;
      html += `<tr><td><strong>${this.escapeHtml(s.name)}</strong></td><td><span class="badge badge-info">${coursesCount} مقرر</span></td>
        <td><button class="btn btn-danger" onclick="app.deleteDoc('subjects','${s.id}')">حذف</button></td></tr>`;
    });
    html += '</table>';
    wrap.innerHTML = html;
  },
  showSubjectModal() {
    this.openModal(`<div class="modal"><h3>إضافة مادة علمية</h3>
      <div class="form-group"><label>اسم المادة</label><input id="subjectName" placeholder="مثال: الفقه المالكي، الحديث، التفسير..."></div>
      <button class="btn btn-primary btn-block" onclick="app.saveSubject()">💾 حفظ</button>
      <button class="btn btn-secondary btn-block" onclick="app.closeModal()">إلغاء</button>
    </div>`);
  },
  async saveSubject() {
    const name = document.getElementById('subjectName').value.trim();
    if (!name) return this.showToast('يرجى إدخال اسم المادة', 'error');
    try {
      await db.collection('subjects').add({ name, createdAt: new Date() });
      this.showToast('تم إضافة المادة'); this.closeModal();
    } catch(e) { this.showToast('خطأ في الحفظ', 'error'); }
  },
  /* =========================================================
     8. COURSES MANAGEMENT
     ========================================================= */
  renderCoursesPage() {
    return `<div class="header-bar"><h2>📖 المقررات الدراسية</h2><button class="btn btn-primary" onclick="app.showCourseModal()">+ مقرر جديد</button></div>
      <div class="card"><div class="table-wrap" id="coursesTableWrap"></div></div>`;
  },
  renderCoursesList() {
    const wrap = document.getElementById('coursesTableWrap');
    if (!wrap) return;
    if (!this.data.courses.length) { wrap.innerHTML = '<div class="empty-state">لا توجد مقررات مسجلة. أضف مقرر أولاً.</div>'; return; }
    let html = `<table><tr><th>المقرر</th><th>المادة</th><th>القسم</th><th>المستوى</th><th>المرحلة</th><th>إجراءات</th></tr>`;
    this.data.courses.forEach(c => {
      const subject = this.data.subjects.find(s => s.id === c.subjectId);
      const section = this.data.sections.find(s => s.id === c.sectionId);
      const level = section ? this.data.levels.find(l => l.id === section.levelId) : null;
      const stage = level ? this.data.stages.find(s => s.id === level.stageId) : null;
      html += `<tr><td><strong>${this.escapeHtml(c.name || subject?.name || '—')}</strong></td>
        <td>${this.escapeHtml(subject ? subject.name : '—')}</td>
        <td>${this.escapeHtml(section ? section.name : '—')}</td>
        <td>${this.escapeHtml(level ? level.name : '—')}</td>
        <td>${this.escapeHtml(stage ? stage.name : '—')}</td>
        <td><button class="btn btn-danger" onclick="app.deleteDoc('courses','${c.id}')">حذف</button></td></tr>`;
    });
    html += '</table>';
    wrap.innerHTML = html;
  },
  showCourseModal() {
    const subjectsOpts = this.data.subjects.map(s => `<option value="${s.id}">${this.escapeHtml(s.name)}</option>`).join('');
    const sectionsOpts = this.data.sections.map(s => {
      const level = this.data.levels.find(l => l.id === s.levelId);
      const stage = level ? this.data.stages.find(st => st.id === level.stageId) : null;
      return `<option value="${s.id}">${this.escapeHtml(s.name)} (${this.escapeHtml(level ? level.name : '—')} - ${this.escapeHtml(stage ? stage.name : '—')})</option>`;
    }).join('');
    if (!subjectsOpts) { this.showToast('أضف مادة أولاً', 'error'); return; }
    if (!sectionsOpts) { this.showToast('أضف قسم أولاً', 'error'); return; }
    this.openModal(`<div class="modal"><h3>إضافة مقرر دراسي</h3>
      <div class="form-group"><label>المادة</label><select id="courseSubjectId">${subjectsOpts}</select></div>
      <div class="form-group"><label>القسم</label><select id="courseSectionId">${sectionsOpts}</select></div>
      <button class="btn btn-primary btn-block" onclick="app.saveCourse()">💾 حفظ</button>
      <button class="btn btn-secondary btn-block" onclick="app.closeModal()">إلغاء</button>
    </div>`);
  },
  async saveCourse() {
    const subjectId = document.getElementById('courseSubjectId').value;
    const sectionId = document.getElementById('courseSectionId').value;
    if (!subjectId || !sectionId) return this.showToast('يرجى اختيار المادة والقسم', 'error');
    const subject = this.data.subjects.find(s => s.id === subjectId);
    const name = subject ? subject.name : 'مقرر';
    try {
      await db.collection('courses').add({ name, subjectId, sectionId, createdAt: new Date() });
      this.showToast('تم إضافة المقرر'); this.closeModal();
    } catch(e) { this.showToast('خطأ في الحفظ', 'error'); }
  },
  /* ---------- Dynamic Section Dropdown Helpers ---------- */
  buildSectionsSelect(id, selectedVal, includeEmpty, emptyLabel) {
    let html = '';
    if (includeEmpty) html += `<option value="">${emptyLabel || '-- اختر القسم --'}</option>`;
    this.data.stages.forEach(st => {
      const stageLevels = this.data.levels.filter(l => l.stageId === st.id);
      if (stageLevels.length) {
        html += `<optgroup label="${this.escapeHtml(st.name)}">`;
        stageLevels.forEach(l => {
          const levelSections = this.data.sections.filter(s => s.levelId === l.id);
          levelSections.forEach(s => {
            html += `<option value="${s.id}" ${selectedVal === s.id ? 'selected' : ''}>${this.escapeHtml(l.name)} - ${this.escapeHtml(s.name)}</option>`;
          });
        });
        html += `</optgroup>`;
      }
    });
    return html;
  },
  buildSectionsSelectOldStyle() {
    let html = '<option value="">-- اختر القسم --</option>';
    this.data.stages.forEach(st => {
      const stageLevels = this.data.levels.filter(l => l.stageId === st.id);
      if (stageLevels.length) {
        stageLevels.forEach(l => {
          const levelSections = this.data.sections.filter(s => s.levelId === l.id);
          if (levelSections.length) {
            html += `<optgroup label="${this.escapeHtml(st.name)} - ${this.escapeHtml(l.name)}">`;
            levelSections.forEach(s => {
              html += `<option value="${s.id}">${this.escapeHtml(s.name)}</option>`;
            });
            html += `</optgroup>`;
          }
        });
      }
    });
    return html;
  },
  getSectionName(sectionId) {
    if (!sectionId) return 'غير محدد';
    const section = this.data.sections.find(s => s.id === sectionId);
    if (!section) return sectionId;
    const level = this.data.levels.find(l => l.id === section.levelId);
    const stage = level ? this.data.stages.find(s => s.id === level.stageId) : null;
    return `${this.escapeHtml(stage ? stage.name + ' - ' : '')}${this.escapeHtml(level ? level.name + ' - ' : '')}${this.escapeHtml(section.name)}`;
  },
  /* =========================================================
     9. STUDENTS
     ========================================================= */
  renderStudentsPage() {
    return `<div class="header-bar"><h2>👨‍🎓 إدارة الطلاب</h2><button class="btn btn-primary" onclick="app.showStudentModal()">+ طالب جديد</button></div>
      <div class="card"><input class="search-box" id="studentSearch" placeholder="🔍 البحث بالاسم أو القسم..." oninput="app.filterStudents()"></div>
      <div class="card"><div class="table-wrap" id="studentsTableWrap"></div></div>`;
  },
  renderStudentsTable() {
    const wrap = document.getElementById('studentsTableWrap');
    if (!wrap) return;
    if (!this.data.students.length) { wrap.innerHTML = '<div class="empty-state">لا يوجد طلاب مسجلون بعد.</div>'; return; }
    let html = `<table><tr><th>الاسم</th><th>القسم</th><th>الحالة</th><th>إجراءات</th></tr>`;
    this.data.students.forEach(s => {
      html += `<tr><td><strong>${this.escapeHtml(s.name)}</strong></td>
        <td><span class="badge badge-primary">${this.getSectionName(s.sectionId)}</span></td>
        <td><span class="badge ${s.active!==false?'badge-success':'badge-danger'}">${s.active!==false?'نشط':'غير نشط'}</span></td>
        <td><button class="btn btn-danger" onclick="app.deleteDoc('students','${s.id}')">حذف</button></td></tr>`;
    });
    html += '</table>';
    wrap.innerHTML = html;
  },
  filterStudents() {
    const q = document.getElementById('studentSearch').value.toLowerCase();
    const rows = document.querySelectorAll('#studentsTableWrap table tr:not(:first-child)');
    rows.forEach(r => { const text = r.textContent.toLowerCase(); r.style.display = text.includes(q) ? '' : 'none'; });
  },
  showStudentModal() {
    const sectionsSelect = this.buildSectionsSelectOldStyle();
    this.openModal(`<div class="modal"><h3>تسجيل طالب جديد</h3>
      <div class="form-group"><label>الاسم الكامل</label><input id="stName" placeholder="مثال: أحمد بن محمد"></div>
      <div class="form-group"><label>القسم / المرحلة</label><select id="stSectionId">${sectionsSelect}</select></div>
      <div class="form-group"><label>رقم الهاتف (اختياري)</label><input id="stPhone" placeholder="0555..." dir="ltr"></div>
      <button class="btn btn-primary btn-block" onclick="app.saveStudent()">💾 حفظ في السحابة</button>
      <button class="btn btn-secondary btn-block" onclick="app.closeModal()">إلغاء</button>
    </div>`);
  },
  async saveStudent() {
    const name = document.getElementById('stName').value.trim();
    const sectionId = document.getElementById('stSectionId').value;
    const phone = document.getElementById('stPhone').value.trim();
    if (!name) return this.showToast('يرجى إدخال اسم الطالب', 'error');
    if (!sectionId) return this.showToast('يرجى اختيار القسم', 'error');
    try {
      await db.collection('students').add({ name, sectionId, phone: phone || '', active: true, createdAt: new Date() });
      this.showToast('تم إضافة الطالب بنجاح'); this.closeModal();
    } catch(e) { console.error(e); this.showToast('خطأ في الحفظ', 'error'); }
  },
  /* =========================================================
     10. TEACHERS
     ========================================================= */
  renderTeachersPage() {
    return `<div class="header-bar"><h2>👨‍🏫 المدرسون</h2><button class="btn btn-primary" onclick="app.showTeacherModal()">+ مدرس جديد</button></div>
      <div class="card"><div class="table-wrap" id="teachersTableWrap"></div></div>`;
  },
  renderTeachersTable() {
    const wrap = document.getElementById('teachersTableWrap');
    if (!wrap) return;
    if (!this.data.teachers.length) { wrap.innerHTML = '<div class="empty-state">لا يوجد مدرسون مسجلون.</div>'; return; }
    let html = `<table><tr><th>الاسم</th><th>التخصص</th><th>الهاتف</th><th>إجراءات</th></tr>`;
    this.data.teachers.forEach(t => {
      html += `<tr><td><strong>${this.escapeHtml(t.name)}</strong></td><td>${this.escapeHtml(t.subject||'')}</td><td dir="ltr">${this.escapeHtml(t.phone||'')}</td>
        <td><button class="btn btn-danger" onclick="app.deleteDoc('teachers','${t.id}')">حذف</button></td></tr>`;
    });
    html += '</table>';
    wrap.innerHTML = html;
  },
  showTeacherModal() {
    this.openModal(`<div class="modal"><h3>إضافة مدرس</h3>
      <div class="form-group"><label>الاسم</label><input id="tcName"></div>
      <div class="form-group"><label>التخصص</label><input id="tcSubject" placeholder="مثال: الفقه المالكي"></div>
      <div class="form-group"><label>البريد الإلكتروني</label><input id="tcEmail" dir="ltr"></div>
      <div class="form-group"><label>الهاتف</label><input id="tcPhone" dir="ltr"></div>
      <button class="btn btn-primary btn-block" onclick="app.saveTeacher()">💾 حفظ</button>
      <button class="btn btn-secondary btn-block" onclick="app.closeModal()">إلغاء</button>
    </div>`);
  },
  async saveTeacher() {
    const name = document.getElementById('tcName').value.trim();
    const subject = document.getElementById('tcSubject').value.trim();
    const email = document.getElementById('tcEmail').value.trim();
    const phone = document.getElementById('tcPhone').value.trim();
    if (!name) return this.showToast('يرجى إدخال الاسم', 'error');
    try {
      await db.collection('teachers').add({ name, subject, email, phone, createdAt: new Date() });
      this.showToast('تم إضافة المدرس'); this.closeModal();
    } catch(e) { this.showToast('خطأ في الحفظ','error'); }
  },
  /* =========================================================
     11. USERS MANAGEMENT
     ========================================================= */
  renderUsersPage() {
    return `<div class="header-bar"><h2>👥 إدارة المستخدمين</h2><button class="btn btn-primary" onclick="app.showUserModal()">+ مستخدم جديد</button></div>
      <div class="card"><input class="search-box" id="userSearch" placeholder="🔍 البحث بالاسم أو اسم المستخدم..." oninput="app.filterUsers()"></div>
      <div class="card"><div class="table-wrap" id="usersTableWrap"></div></div>`;
  },
  renderUsersTable() {
    const wrap = document.getElementById('usersTableWrap');
    if (!wrap) return;
    if (!this.data.users.length) { wrap.innerHTML = '<div class="empty-state">لا يوجد مستخدمون مسجلون.</div>'; return; }
    let html = `<table><tr><th>الاسم</th><th>اسم المستخدم</th><th>البريد</th><th>الدور</th><th>القسم</th><th>إجراءات</th></tr>`;
    this.data.users.forEach(u => {
      const roleLabel = u.role === 'student' ? '🎓 طالب' : u.role === 'teacher' ? '👨‍🏫 أستاذ' : '👤 غير معروف';
      html += `<tr><td><strong>${this.escapeHtml(u.name)}</strong></td>
        <td dir="ltr">${this.escapeHtml(u.username)}</td>
        <td dir="ltr">${this.escapeHtml(u.email || '—')}</td>
        <td><span class="badge badge-info">${roleLabel}</span></td>
        <td><span class="badge badge-primary">${this.getSectionName(u.sectionId)}</span></td>
        <td>
          <button class="btn btn-warning" onclick="app.showResetPasswordModal('${u.id}','${this.escapeHtml(u.name)}')">🔑 إعادة تعيين</button>
          <button class="btn btn-danger" onclick="app.deleteDoc('users','${u.id}')">حذف</button>
        </td></tr>`;
    });
    html += '</table>';
    wrap.innerHTML = html;
  },
  filterUsers() {
    const q = document.getElementById('userSearch').value.toLowerCase();
    const rows = document.querySelectorAll('#usersTableWrap table tr:not(:first-child)');
    rows.forEach(r => { const text = r.textContent.toLowerCase(); r.style.display = text.includes(q) ? '' : 'none'; });
  },
  showUserModal() {
    const sectionsSelect = this.buildSectionsSelectOldStyle();
    this.openModal(`<div class="modal"><h3>إضافة مستخدم جديد</h3>
      <div class="form-group"><label>الاسم الكامل</label><input id="uName" placeholder="مثال: أحمد بن محمد"></div>
      <div class="form-group"><label>اسم المستخدم (فريد، بدون مسافات)</label><input id="uUsername" placeholder="ahmed_ben_mohamed" dir="ltr"></div>
      <div class="form-group"><label>البريد الإلكتروني (اختياري — لاستعادة كلمة المرور)</label><input type="email" id="uEmail" placeholder="example@email.com" dir="ltr"></div>
      <div class="form-group"><label>كلمة المرور (4 أرقام أو أكثر)</label><input type="password" id="uPassword" placeholder="1234"></div>
      <div class="form-group"><label>الدور</label>
        <select id="uRole" onchange="app.toggleUserSection()">
          <option value="student">🎓 طالب</option>
          <option value="teacher">👨‍🏫 أستاذ</option>
        </select>
      </div>
      <div class="form-group" id="uSectionWrap">
        <label>القسم / المرحلة</label><select id="uSectionId">${sectionsSelect}</select>
      </div>
      <button class="btn btn-primary btn-block" onclick="app.saveUser()">💾 إنشاء المستخدم</button>
      <button class="btn btn-secondary btn-block" onclick="app.closeModal()">إلغاء</button>
    </div>`);
  },
  toggleUserSection() {
    const role = document.getElementById('uRole').value;
    const wrap = document.getElementById('uSectionWrap');
    if (wrap) wrap.style.display = role === 'student' ? 'flex' : 'none';
  },
  async saveUser() {
    const name = document.getElementById('uName').value.trim();
    const username = document.getElementById('uUsername').value.trim().replace(/\s/g, '');
    const email = document.getElementById('uEmail').value.trim().toLowerCase();
    const password = document.getElementById('uPassword').value;
    const role = document.getElementById('uRole').value;
    const sectionId = role === 'student' ? document.getElementById('uSectionId').value : '';
    if (!name || !username || !password) return this.showToast('يرجى ملء جميع الحقول الإلزامية', 'error');
    if (password.length < 4) return this.showToast('كلمة المرور يجب أن تكون 4 أرقام على الأقل', 'error');
    if (role === 'student' && !sectionId) return this.showToast('يرجى اختيار القسم للطالب', 'error');
    try {
      const existing = await db.collection('users').where('username','==',username).limit(1).get();
      if (!existing.empty) return this.showToast('اسم المستخدم مستخدم بالفعل، اختر اسماً آخر', 'error');
      const data = { name, username, password, role, sectionId: sectionId || '', createdAt: new Date() };
      if (email) data.email = email;
      await db.collection('users').add(data);
      this.showToast('تم إنشاء المستخدم بنجاح'); this.closeModal();
    } catch(e) { console.error(e); this.showToast('خطأ في الحفظ', 'error'); }
  },
  showResetPasswordModal(userId, userName) {
    this.openModal(`<div class="modal"><h3>إعادة تعيين كلمة المرور — ${this.escapeHtml(userName)}</h3>
      <div class="form-group"><label>كلمة المرور الجديدة (4 أرقام أو أكثر)</label><input type="password" id="newPassword" placeholder="أدخل كلمة المرور الجديدة"></div>
      <button class="btn btn-primary btn-block" onclick="app.resetPassword('${userId}')">🔑 حفظ</button>
      <button class="btn btn-secondary btn-block" onclick="app.closeModal()">إلغاء</button>
    </div>`);
  },
  async resetPassword(userId) {
    const newPassword = document.getElementById('newPassword').value;
    if (!newPassword || newPassword.length < 4) return this.showToast('كلمة المرور قصيرة جداً', 'error');
    try {
      await db.collection('users').doc(userId).update({ password: newPassword });
      this.showToast('تم تغيير كلمة المرور بنجاح'); this.closeModal();
    } catch(e) { this.showToast('خطأ في التحديث', 'error'); }
  },
  /* =========================================================
     12. WEEKLY TIMETABLE (Updated for dynamic sections)
     ========================================================= */
  timetableDays: ['السبت','الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس'],
  timetableSlots: ['08:00','09:30','11:00','13:00','14:30','16:00'],
  renderTimetablePage() {
    const isStudent = this.data.currentUser?.role === 'student';
    const studentSection = this.data.currentUser?.sectionId;
    return `<div class="header-bar"><h2>📅 الجدول الأسبوعي</h2>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        ${!isStudent ? `<select id="ttSectionFilter" class="search-box" style="max-width:260px; margin:0;" onchange="app.renderTimetableView()"><option value="all">جميع الأقسام</option>${this.buildSectionsSelect('ttSectionFilter', '', false, '')}</select>
        <button class="btn btn-primary" onclick="app.showTimetableModal()">+ إضافة حصة</button>` : 
        `<input type="hidden" id="ttSectionFilter" value="${studentSection||'all'}">`}
      </div>
    </div>
    <div class="card" id="timetableCard"></div>`;
  },
  renderTimetableView() {
    const card = document.getElementById('timetableCard');
    if (!card) return;
    const sectionFilter = document.getElementById('ttSectionFilter')?.value || 'all';
    const userSection = this.data.currentUser?.role === 'student' ? this.data.currentUser?.sectionId : null;
    const effectiveFilter = userSection || sectionFilter;
    const entries = this.data.timetable.filter(e => effectiveFilter==='all' || e.sectionId===effectiveFilter);
    let html = `<div style="overflow-x:auto;"><div class="timetable-grid">`;
    html += `<div class="timetable-header">الوقت / اليوم</div>`;
    this.timetableDays.forEach(d => html += `<div class="timetable-header">${d}</div>`);
    this.timetableSlots.forEach(slot => {
      html += `<div class="timetable-time">${slot}</div>`;
      this.timetableDays.forEach(day => {
        const entry = entries.find(e => e.day===day && e.time===slot && (effectiveFilter==='all' || e.sectionId===effectiveFilter));
        if (entry) {
          html += `<div class="timetable-cell" onclick="app.showTimetableModal('${entry.id}')"><div class="lesson-title">${this.escapeHtml(entry.title)}</div><div class="lesson-meta">${this.escapeHtml(entry.teacher||'')} | ${this.getSectionName(entry.sectionId)}</div></div>`;
        } else {
          html += `<div class="timetable-cell empty">—</div>`;
        }
      });
    });
    html += `</div></div>`;
    html += `<div class="timetable-mobile-list">`;
    this.timetableDays.forEach(day => {
      const dayEntries = entries.filter(e => e.day === day);
      if (!dayEntries.length && effectiveFilter !== 'all') return;
      html += `<div class="tt-mobile-card"><div class="tt-day">${day}</div>`;
      this.timetableSlots.forEach(slot => {
        const entry = dayEntries.find(e => e.time === slot);
        if (entry) {
          html += `<div class="tt-slot" onclick="app.showTimetableModal('${entry.id}')"><div><div class="tt-lesson">${this.escapeHtml(entry.title)}</div><div class="tt-meta">${this.escapeHtml(entry.teacher||'')} | ${this.getSectionName(entry.sectionId)}</div></div><div class="tt-time">${slot}</div></div>`;
        } else if (effectiveFilter === 'all') {
          html += `<div class="tt-slot"><div class="tt-lesson" style="color:#aaa; font-weight:normal;">— لا توجد حصة —</div><div class="tt-time">${slot}</div></div>`;
        }
      });
      html += `</div>`;
    });
    html += `</div>`;
    card.innerHTML = html;
  },
  showTimetableModal(entryId) {
    const isStudent = this.data.currentUser?.role === 'student';
    if (isStudent) return;
    const entry = entryId ? this.data.timetable.find(e => e.id === entryId) : null;
    const sectionsSelect = this.buildSectionsSelect('ttSection', entry ? entry.sectionId : '', false, '');
    this.openModal(`<div class="modal"><h3>${entry ? 'تعديل الحصة' : 'إضافة حصة للجدول'}</h3>
      <div class="form-group"><label>المادة / الدرس</label><input id="ttTitle" value="${entry ? this.escapeHtml(entry.title) : ''}"></div>
      <div class="form-group"><label>القسم</label><select id="ttSection">${sectionsSelect}</select></div>
      <div class="form-group"><label>اليوم</label>
        <select id="ttDay">${this.timetableDays.map(d=>`<option value="${d}" ${entry && entry.day===d?'selected':''}>${d}</option>`).join('')}</select>
      </div>
      <div class="form-group"><label>الوقت</label>
        <select id="ttTime">${this.timetableSlots.map(t=>`<option value="${t}" ${entry && entry.time===t?'selected':''}>${t}</option>`).join('')}</select>
      </div>
      <div class="form-group"><label>المدرس</label><input id="ttTeacher" value="${entry ? this.escapeHtml(entry.teacher||'') : ''}"></div>
      <div class="form-group"><label>القاعة (اختياري)</label><input id="ttRoom" value="${entry ? this.escapeHtml(entry.room||'') : ''}"></div>
      <button class="btn btn-primary btn-block" onclick="app.saveTimetableEntry('${entryId||''}')">💾 حفظ</button>
      ${entry ? `<button class="btn btn-danger btn-block" onclick="app.deleteDoc('timetable','${entry.id}'); app.closeModal();">🗑️ حذف الحصة</button>` : ''}
      <button class="btn btn-secondary btn-block" onclick="app.closeModal()">إلغاء</button>
    </div>`);
  },
  async saveTimetableEntry(entryId) {
    const title = document.getElementById('ttTitle').value.trim();
    const sectionId = document.getElementById('ttSection').value;
    const day = document.getElementById('ttDay').value;
    const time = document.getElementById('ttTime').value;
    const teacher = document.getElementById('ttTeacher').value.trim();
    const room = document.getElementById('ttRoom').value.trim();
    if (!title || !sectionId || !day || !time) return this.showToast('يرجى ملء جميع الحقول الإلزامية', 'error');
    const payload = { title, sectionId, day, time, teacher, room, updatedAt: new Date() };
    try {
      if (entryId) {
        await db.collection('timetable').doc(entryId).update(payload);
      } else {
        await db.collection('timetable').add({ ...payload, createdAt: new Date() });
      }
      this.showToast('تم حفظ الحصة'); this.closeModal();
    } catch(e) { this.showToast('خطأ في الحفظ','error'); }
  },
  /* =========================================================
     13. LESSONS & ATTENDANCE LINKS (Updated for dynamic sections)
     ========================================================= */
  renderLessonsPage() {
    return `<div class="header-bar"><h2>📚 إدارة الدروس</h2><button class="btn btn-primary" onclick="app.showLessonModal()">+ درس جديد</button></div>
      <div class="card"><div class="table-wrap" id="lessonsListWrap"></div></div>`;
  },
  renderLessonsList() {
    const wrap = document.getElementById('lessonsListWrap');
    if (!wrap) return;
    if (!this.data.lessons.length) { wrap.innerHTML = '<div class="empty-state">لا توجد دروس مسجلة.</div>'; return; }
    let html = `<table><tr><th>الدرس</th><th>القسم</th><th>التاريخ</th><th>رابط الحضور</th><th>إجراءات</th></tr>`;
    this.data.lessons.forEach(l => {
      html += `<tr><td><strong>${this.escapeHtml(l.title)}</strong></td><td>${this.getSectionName(l.sectionId)}</td><td>${l.date||''}</td>
        <td><button class="btn btn-info" onclick="app.copyLessonLink('${l.id}')">📋 نسخ الرابط</button></td>
        <td><button class="btn btn-danger" onclick="app.deleteDoc('lessons','${l.id}')">حذف</button></td></tr>`;
    });
    html += '</table>';
    wrap.innerHTML = html;
  },
  generateLessonLink(lessonId) {
    const base = window.location.href.split('?')[0].split('#')[0];
    return `${base}?attendanceLesson=${encodeURIComponent(lessonId)}`;
  },
  copyLessonLink(lessonId) {
    const link = this.generateLessonLink(lessonId);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).then(() => { this.showToast('تم نسخ رابط الحضور! يمكنك لصقه في واتساب أو تليجرام'); }).catch(() => this.fallbackCopy(link));
    } else { this.fallbackCopy(link); }
  },
  fallbackCopy(link) {
    const ta = document.createElement('textarea'); ta.value = link; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    this.showToast('تم نسخ رابط الحضور! يمكنك لصقه في واتساب أو تليجرام');
  },
  showLessonModal() {
    const sectionsSelect = this.buildSectionsSelectOldStyle();
    this.openModal(`<div class="modal"><h3>إضافة درس جديد</h3>
      <div class="form-group"><label>عنوان الدرس</label><input id="lsTitle"></div>
      <div class="form-group"><label>القسم المستهدف</label><select id="lsSection">${sectionsSelect}</select></div>
      <div class="form-group"><label>التاريخ</label><input type="date" id="lsDate"></div>
      <div class="form-group"><label>الوقت</label><input type="time" id="lsTime"></div>
      <button class="btn btn-primary btn-block" onclick="app.saveLesson()">💾 حفظ</button>
      <button class="btn btn-secondary btn-block" onclick="app.closeModal()">إلغاء</button>
    </div>`);
  },
  async saveLesson() {
    const title = document.getElementById('lsTitle').value.trim();
    const sectionId = document.getElementById('lsSection').value;
    const date = document.getElementById('lsDate').value;
    const time = document.getElementById('lsTime').value;
    if (!title || !date) return this.showToast('يرجى ملء العنوان والتاريخ', 'error');
    try {
      await db.collection('lessons').add({ title, sectionId, date, time, createdAt: new Date() });
      this.showToast('تم إضافة الدرس'); this.closeModal();
    } catch(e) { this.showToast('خطأ في الحفظ','error'); }
  },
  /* =========================================================
     14. ATTENDANCE MANAGEMENT
     ========================================================= */
  renderAttendancePage() {
    return `<div class="header-bar"><h2>✅ سجلات الحضور والغياب</h2>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <select id="attLessonFilter" class="search-box" style="max-width:220px; margin:0;" onchange="app.renderAttendanceList()"><option value="all">جميع الدروس</option></select>
        <button class="btn btn-success" onclick="app.exportAttendanceToWord()">📄 Word</button>
        <button class="btn btn-danger" onclick="app.exportAttendanceToPDF()">📄 PDF</button>
      </div>
    </div>
    <div class="card"><div class="table-wrap" id="attendanceListWrap"></div></div>`;
  },
  renderAttendanceList() {
    const wrap = document.getElementById('attendanceListWrap');
    const select = document.getElementById('attLessonFilter');
    if (!wrap) return;
    if (select && select.options.length <= 1) {
      this.data.lessons.forEach(l => { select.add(new Option(this.escapeHtml(l.title), l.id)); });
    }
    const filter = select ? select.value : 'all';
    let rows = this.data.attendance;
    if (filter !== 'all') rows = rows.filter(a => a.lessonId === filter);
    if (!rows.length) { wrap.innerHTML = '<div class="empty-state">لا توجد سجلات حضور.</div>'; return; }
    let html = `<table><tr><th>#</th><th>الدرس</th><th>اسم الطالب</th><th>القسم</th><th>التاريخ</th></tr>`;
    rows.forEach((a, idx) => {
      const lesson = this.data.lessons.find(l => l.id === a.lessonId);
      html += `<tr><td>${idx+1}</td><td>${this.escapeHtml(lesson ? lesson.title : a.lessonId || 'عام')}</td>
        <td><strong>${this.escapeHtml(a.studentName || 'غير معروف')}</strong></td>
        <td><span class="badge badge-primary">${this.getSectionName(a.studentSectionId)}</span></td>
        <td>${this.formatDate(a.timestamp)}</td></tr>`;
    });
    html += '</table>';
    wrap.innerHTML = html;
  },
  exportAttendanceToWord() {
    const filter = document.getElementById('attLessonFilter')?.value || 'all';
    let rows = this.data.attendance;
    if (filter !== 'all') rows = rows.filter(a => a.lessonId === filter);
    if (!rows.length) return this.showToast('لا يوجد حضور لتصديره', 'error');
    const lessonName = filter==='all' ? 'جميع الدروس' : (this.data.lessons.find(l=>l.id===filter)?.title || filter);
    let htmlTable = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset='utf-8'><title>كشف الحضور</title></head>
    <body style="font-family: Arial; direction: rtl; text-align: right;">
    <h2 style="color:#0d5c3a;">كشف حضور - ${lessonName}</h2>
    <p>معهد الإمام سحنون للعلوم الشرعية</p>
    <table border="1" style="border-collapse:collapse; width:100%; text-align:right;">
    <thead><tr style="background:#0d5c3a; color:white;"><th style="padding:8px;">#</th><th style="padding:8px;">الدرس</th><th style="padding:8px;">الطالب</th><th style="padding:8px;">القسم</th><th style="padding:8px;">التاريخ</th></tr></thead>
    <tbody>`;
    rows.forEach((a, idx) => {
      const lesson = this.data.lessons.find(l => l.id === a.lessonId);
      htmlTable += `<tr><td style="padding:8px;">${idx+1}</td><td style="padding:8px;">${this.escapeHtml(lesson?lesson.title:'')}</td><td style="padding:8px;">${this.escapeHtml(a.studentName||'')}</td><td style="padding:8px;">${this.getSectionName(a.studentSectionId)}</td><td style="padding:8px;">${this.formatDate(a.timestamp)}</td></tr>`;
    });
    htmlTable += `</tbody></table></body></html>`;
    const blob = new Blob(['\ufeff'+htmlTable], {type:'application/msword'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `حضور_${lessonName}.doc`; a.click();
    this.showToast('تم تصدير ملف Word');
  },
  exportAttendanceToPDF() {
    const filter = document.getElementById('attLessonFilter')?.value || 'all';
    let rows = this.data.attendance;
    if (filter !== 'all') rows = rows.filter(a => a.lessonId === filter);
    if (!rows.length) return this.showToast('لا يوجد حضور لتصديره', 'error');
    const lessonName = filter==='all' ? 'جميع الدروس' : (this.data.lessons.find(l=>l.id===filter)?.title || filter);
    const body = rows.map((a, idx) => {
      const lesson = this.data.lessons.find(l => l.id === a.lessonId);
      return [idx+1, lesson?lesson.title:'', a.studentName||'', this.getSectionName(a.studentSectionId), this.formatDate(a.timestamp)];
    });
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(16); doc.text(`كشف حضور - ${lessonName}`, 14, 15);
    doc.setFontSize(10); doc.text('معهد الإمام سحنون للعلوم الشرعية', 14, 22);
    doc.autoTable({ head: [['#','الدرس','الطالب','القسم','التاريخ']], body, startY: 28, styles: { font: 'Arial', halign: 'right' }, headStyles: { fillColor: [26,95,42] } });
    doc.save(`حضور_${lessonName}.pdf`);
    this.showToast('تم تصدير ملف PDF');
  },
  showAttendanceRegistration() {
    const params = new URLSearchParams(window.location.search);
    const lessonId = params.get('attendanceLesson');
    if (!lessonId) return;
    const lesson = this.data.lessons.find(l => l.id === lessonId);
    if (!lesson) {
      document.body.innerHTML = '<div style="padding:40px; text-align:center; font-family:Segoe UI,Tahoma,Geneva,Verdana,sans-serif;"><h2>⚠️ الدرس غير موجود</h2></div>';
      return;
    }
    const sectionsSelect = this.buildSectionsSelectOldStyle();
    document.body.innerHTML = `
    <div class="public-page">
      <h2>🕌 معهد الإمام سحنون</h2>
      <p>تسجيل حضور للدرس: <strong>${this.escapeHtml(lesson.title)}</strong></p>
      <div class="form-group"><label>الاسم الكامل</label><input id="pubName" placeholder="أدخل اسمك الكامل"></div>
      <div class="form-group"><label>القسم / المرحلة</label><select id="pubSection">${sectionsSelect}</select></div>
      <button id="pubBtn" onclick="app.submitPublicAttendance('${lessonId}')">✅ تأكيد الحضور</button>
      <p style="margin-top:18px; font-size:0.85rem; color:#888;">سيتم تسجيل حضورك في النظام السحابي مباشرة.</p>
    </div>`;
  },
  async submitPublicAttendance(lessonId) {
    const name = document.getElementById('pubName').value.trim();
    const sectionId = document.getElementById('pubSection').value;
    if (!name || !sectionId) return this.showToast('يرجى إدخال الاسم واختيار القسم', 'error');
    try {
      await db.collection('attendance').add({ lessonId, studentName: name, studentSectionId: sectionId, timestamp: new Date(), source: 'link' });
      document.body.innerHTML = `<div class="public-page"><h2 style="color:#28a745;">✅ تم تسجيل حضورك بنجاح!</h2><p style="color:#666; margin-top:12px;">بارك الله فيك يا ${this.escapeHtml(name)}</p></div>`;
    } catch(e) { this.showToast('حدث خطأ أثناء التسجيل، حاول مرة أخرى.', 'error'); }
  },
  /* =========================================================
     15. LIBRARY
     ========================================================= */
  renderLibraryPage() {
    return `<div class="header-bar"><h2>📖 المكتبة السحابية</h2>
      ${this.data.currentUser?.role !== 'student' ? `<button class="btn btn-primary" onclick="app.showMaterialModal()">+ محتوى جديد</button>` : ''}
    </div>
    <div class="card" style="display:flex; gap:10px; flex-wrap:wrap;">
      <input class="search-box" id="libSearch" placeholder="🔍 البحث..." oninput="app.filterLibrary()" style="margin:0;">
      <select id="libType" class="search-box" onchange="app.filterLibrary()" style="max-width:160px; margin:0;">
        <option value="all">الكل</option><option value="pdf">PDF / كتاب</option><option value="video">مرئي</option>
      </select>
    </div>
    <div class="card" id="libraryGrid"></div>`;
  },
  renderLibraryGrid() {
    const grid = document.getElementById('libraryGrid');
    if (!grid) return;
    if (!this.data.materials.length) { grid.innerHTML = '<div class="empty-state">المكتبة فارغة حالياً.</div>'; return; }
    const q = (document.getElementById('libSearch')?.value || '').toLowerCase();
    const type = document.getElementById('libType')?.value || 'all';
    const filtered = this.data.materials.filter(m => {
      const matchQ = (m.title||'').toLowerCase().includes(q) || (m.description||'').toLowerCase().includes(q);
      const matchType = type==='all' || m.type===type;
      return matchQ && matchType;
    });
    if (!filtered.length) { grid.innerHTML = '<div class="empty-state">لا توجد نتائج مطابقة.</div>'; return; }
    grid.innerHTML = `<div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:14px;">
      ${filtered.map(m => `
        <div style="background:#f8fafb; border-radius:12px; padding:16px; border:1px solid #e9ecef; display:flex; flex-direction:column;">
          <div style="font-size:2rem; margin-bottom:8px;">${m.type==='video'?'🎬':'📄'}</div>
          <h4 style="color:#1a5f2a; margin-bottom:6px; font-size:1rem;">${this.escapeHtml(m.title)}</h4>
          <p style="font-size:0.84rem; color:#666; margin-bottom:12px; flex:1;">${this.escapeHtml(m.description||'')}</p>
          <div style="display:flex; gap:6px;">
            <a href="${m.url}" target="_blank" class="btn btn-primary" style="flex:1; justify-content:center; min-height:44px;">${m.type==='video'?'مشاهدة':'تحميل'}</a>
            ${this.data.currentUser?.role !== 'student' ? `<button class="btn btn-danger" onclick="app.deleteDoc('materials','${m.id}')">حذف</button>` : ''}
          </div>
        </div>
      `).join('')}
    </div>`;
  },
  filterLibrary() { this.renderLibraryGrid(); },
  showMaterialModal() {
    this.openModal(`<div class="modal"><h3>إضافة محتوى سحابي</h3>
      <div class="form-group"><label>العنوان</label><input id="mTitle"></div>
      <div class="form-group"><label>النوع</label>
        <select id="mType"><option value="pdf">PDF / كتاب</option><option value="video">مرئي (رابط يوتيوب)</option></select>
      </div>
      <div class="form-group"><label>الرابط</label><input id="mUrl" placeholder="https://..." dir="ltr"></div>
      <div class="form-group"><label>الوصف</label><textarea id="mDesc" rows="3"></textarea></div>
      <button class="btn btn-primary btn-block" onclick="app.saveMaterial()">💾 رفع ونشر</button>
      <button class="btn btn-secondary btn-block" onclick="app.closeModal()">إلغاء</button>
    </div>`);
  },
  async saveMaterial() {
    const title = document.getElementById('mTitle').value.trim();
    const url = document.getElementById('mUrl').value.trim();
    if (!title || !url) return this.showToast('الرجاء إدخال العنوان والرابط', 'error');
    try {
      await db.collection('materials').add({ title, type: document.getElementById('mType').value, url, description: document.getElementById('mDesc').value, uploadedBy: this.data.currentUser?.username || '', uploadedAt: new Date().toISOString().split('T')[0] });
      this.showToast('تم إضافة المحتوى'); this.closeModal();
    } catch(e) { this.showToast('خطأ في الحفظ','error'); }
  },
  /* =========================================================
     16. EXAMS (Updated for dynamic sections)
     ========================================================= */
  renderExamsPage() {
    return `<div class="header-bar"><h2>📝 إدارة الاختبارات</h2><button class="btn btn-primary" onclick="app.showExamModal()">+ اختبار جديد</button></div>
      <div class="card"><div class="table-wrap" id="examsTableWrap"></div></div>`;
  },
  renderExamsTable() {
    const wrap = document.getElementById('examsTableWrap');
    if (!wrap) return;
    const sectionId = this.data.currentUser?.sectionId;
    const role = this.data.currentUser?.role;
    let exams = this.data.exams;
    if (role === 'student' && sectionId) {
      exams = exams.filter(e => e.sectionId === sectionId || !e.sectionId);
    }
    if (!exams.length) { wrap.innerHTML = '<div class="empty-state">لا توجد اختبارات.</div>'; return; }
    let html = `<table><tr><th>العنوان</th><th>القسم</th><th>المدة</th><th>الأسئلة</th><th>الحالة</th><th>إجراءات</th></tr>`;
    exams.forEach(e => {
      const qCount = e.questions ? e.questions.length : 0;
      html += `<tr><td><strong>${this.escapeHtml(e.title)}</strong></td><td>${this.getSectionName(e.sectionId)}</td><td>${e.duration} دقيقة</td><td>${qCount}</td>
        <td><span class="badge ${e.status==='منشور'?'badge-success':'badge-warning'}">${e.status||'مسودة'}</span></td>
        <td>
          <button class="btn btn-info" onclick="app.navigate('examQuestions','${e.id}')">الأسئلة</button>
          <button class="btn btn-danger" onclick="app.deleteDoc('exams','${e.id}')">حذف</button>
        </td></tr>`;
    });
    html += '</table>';
    wrap.innerHTML = html;
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
    if (!title) return this.showToast('يرجى إدخال عنوان الاختبار', 'error');
    try {
      await db.collection('exams').add({ title, duration, sectionId: sectionId || '', questions: [], status: 'منشور', createdAt: new Date() });
      this.showToast('تم إنشاء الاختبار'); this.closeModal();
    } catch(e) { this.showToast('خطأ','error'); }
  },
  renderExamQuestions() {
    const exam = this.data.exams.find(e => e.id === this.data.activeExamId);
    if (!exam) return `<div class="card">الاختبار غير موجود</div>`;
    return `<div class="header-bar"><h2>أسئلة: ${this.escapeHtml(exam.title)}</h2>
      <div><button class="btn btn-primary" onclick="app.showQuestionModal()">+ سؤال جديد</button>
      <button class="btn btn-info" onclick="app.navigate('exams')">عودة</button></div></div>
      <div class="card" id="examQuestionsWrap"></div>`;
  },
  renderExamQuestionsList() {
    const wrap = document.getElementById('examQuestionsWrap');
    const exam = this.data.exams.find(e => e.id === this.data.activeExamId);
    if (!wrap || !exam) return;
    if (!exam.questions || !exam.questions.length) { wrap.innerHTML = '<div class="empty-state">لا توجد أسئلة بعد.</div>'; return; }
    let html = '';
    (exam.questions || []).forEach((q, i) => {
      html += `<div class="question-box"><h4>س ${i+1}: ${this.escapeHtml(q.text)}</h4><ol style="margin-right:18px; margin-top:8px;">`;
      q.options.forEach((opt, idx) => {
        html += `<li style="${idx === q.correct ? 'color:#155724; background:#d4edda; padding:4px 10px; border-radius:6px; font-weight:bold; margin:4px 0;' : 'margin:4px 0; padding:4px 0;'}">${this.escapeHtml(opt)} ${idx===q.correct ? '✅' : ''}</li>`;
      });
      html += '</ol></div>';
    });
    wrap.innerHTML = html;
  },
  showQuestionModal() {
    this.openModal(`<div class="modal"><h3>إضافة سؤال اختيارات</h3>
      <div class="form-group"><label>نص السؤال</label><input id="qText"></div>
      <div class="form-group"><label>الخيار 1</label><input id="qOpt0"></div>
      <div class="form-group"><label>الخيار 2</label><input id="qOpt1"></div>
      <div class="form-group"><label>الخيار 3</label><input id="qOpt2"></div>
      <div class="form-group"><label>رقم الإجابة الصحيحة (0,1,2)</label><input type="number" id="qCorrect" value="0" min="0" max="2"></div>
      <button class="btn btn-primary btn-block" onclick="app.saveQuestion()">💾 حفظ</button>
      <button class="btn btn-secondary btn-block" onclick="app.closeModal()">إلغاء</button>
    </div>`);
  },
  async saveQuestion() {
    const exam = this.data.exams.find(e => e.id === this.data.activeExamId);
    const text = document.getElementById('qText').value.trim();
    const opts = [0,1,2].map(i => document.getElementById('qOpt'+i).value.trim()).filter(x => x);
    const correct = parseInt(document.getElementById('qCorrect').value) || 0;
    if (!text || opts.length < 2) return this.showToast('أدخل السؤال وخيارين على الأقل', 'error');
    const questions = [...(exam.questions || []), { id: this.generateId(), text, options: opts, correct, points: 2 }];
    try {
      await db.collection('exams').doc(exam.id).update({ questions });
      this.showToast('تم إضافة السؤال'); this.closeModal();
    } catch(e) { this.showToast('خطأ','error'); }
  },
  /* =========================================================
     17. STUDENT VIEWS (Updated for dynamic sections)
     ========================================================= */
  renderMyLessonsPage() {
    const sectionId = this.data.currentUser?.sectionId;
    const lessons = sectionId ? this.data.lessons.filter(l => l.sectionId === sectionId) : this.data.lessons;
    return `<div class="header-bar"><h2>📖 حصصي القادمة</h2><span class="badge badge-info">${this.getSectionName(sectionId)}</span></div>
      <div class="card"><div class="table-wrap"><table><tr><th>الدرس</th><th>القسم</th><th>التاريخ</th><th>الوقت</th></tr>
        ${lessons.length ? lessons.map(l => `<tr><td>${this.escapeHtml(l.title)}</td><td>${this.getSectionName(l.sectionId)}</td><td>${l.date||''}</td><td>${l.time||''}</td></tr>`).join('') : '<tr><td colspan="4" class="text-center" style="color:#888;">لا توجد حصص مسجلة لقسمك حالياً.</td></tr>'}
      </table></div></div>`;
  },
  renderMyExamsPage() {
    const sectionId = this.data.currentUser?.sectionId;
    const exams = sectionId ? this.data.exams.filter(e => e.sectionId === sectionId || !e.sectionId) : this.data.exams;
    return `<div class="header-bar"><h2>📝 اختباراتي المتاحة</h2><span class="badge badge-info">${this.getSectionName(sectionId)}</span></div>
      <div class="card"><div class="table-wrap"><table><tr><th>الاختبار</th><th>القسم</th><th>المدة</th><th>إجراء</th></tr>
        ${exams.length ? exams.map(e => `<tr><td>${this.escapeHtml(e.title)}</td><td>${this.getSectionName(e.sectionId)}</td><td>${e.duration} دقيقة</td><td><button class="btn btn-primary" onclick="app.navigate('takeExam','${e.id}')">بدء</button></td></tr>`).join('') : '<tr><td colspan="4" class="text-center" style="color:#888;">لا توجد اختبارات متاحة لقسمك حالياً.</td></tr>'}
      </table></div></div>`;
  },
  renderTakeExamPage() {
    const exam = this.data.exams.find(e => e.id === this.data.activeExamId);
    if (!exam) return '<div class="card">خطأ في تحميل الاختبار</div>';
    let html = `<div class="header-bar"><h2>${this.escapeHtml(exam.title)}</h2></div>`;
    html += `<div class="exam-timer" id="examTimerDisplay">${exam.duration}:00</div><div class="card">`;
    (exam.questions || []).forEach((q, i) => {
      html += `<div class="question-box"><h4>${i+1}. ${this.escapeHtml(q.text)}</h4>`;
      q.options.forEach((opt, idx) => { html += `<label class="option-label"><input type="radio" name="q_${q.id}" value="${idx}"> ${this.escapeHtml(opt)}</label>`; });
      html += '</div>';
    });
    html += `<button class="btn btn-success btn-block" onclick="app.submitExam()">📤 تسليم الإجابات</button></div>`;
    return html;
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
  submitExam() {
    clearInterval(this.data.timerInterval);
    this.showToast('تم تسليم الاختبار بنجاح!');
    this.navigate('myExams');
  },
  /* =========================================================
     18. ABOUT
     ========================================================= */
  renderAboutPage() {
    return `<div class="header-bar"><h2>🏛️ عن المعهد</h2></div>
      <div class="card">
        <h3 style="color:#1a5f2a; margin-bottom:14px; font-size:1.3rem;">رؤيتنا ورسالتنا</h3>
        <p style="line-height:1.8; color:#444; font-size:1rem;">
          تأسس معهد الإمام سحنون للعلوم الشرعية ليقدم بيئة تعليمية متكاملة تجمع بين التأصيل العلمي الأكاديمي للعلوم الشرعية وبين الاستفادة من أفضل الوسائل التقنية السحابية الحديثة.
        </p>
        <p style="line-height:1.8; color:#444; font-size:1rem; margin-top:10px;">
          نسعى لإعداد طلاب العلم الشرعي على منهج أهل السنة والجماعة، بأسلوب تقني متطور يسهل الوصول إلى العلم ويوثق المسيرة التعليمية بشكل احترافي.
        </p>
      </div>`;
  },
  /* =========================================================
     19. GENERAL DELETE
     ========================================================= */
  async deleteDoc(colName, docId) {
    if (!confirm('هل أنت متأكد من الحذف من السحابة؟')) return;
    try { await db.collection(colName).doc(docId).delete(); this.showToast('تم الحذف'); }
    catch(e) { this.showToast('خطأ في الحذف','error'); }
  },
  /* =========================================================
     20. INIT
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
