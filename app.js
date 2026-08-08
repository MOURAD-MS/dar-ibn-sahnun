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
    if (this.data.menuOpen) {
      sb.classList.add('open');
      ov.classList.add('show');
    } else {
      sb.classList.remove('open');
      ov.classList.remove('show');
    }
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
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    const remember = document.getElementById('rememberMe').checked;
    if (!username || !password) {
      this.showToast('يرجى إدخال اسم المستخدم وكلمة المرور', 'error');
      return;
    }
    try {
      const snap = await db.collection('users').where('username','==',username).limit(1).get();
      if (snap.empty) {
        this.showToast('اسم المستخدم أو كلمة المرور غير صحيحة', 'error');
        return;
      }
      const userDoc = snap.docs[0];
      const userData = userDoc.data();
      if (userData.password !== password) {
        this.showToast('اسم المستخدم أو كلمة المرور غير صحيحة', 'error');
        return;
      }
      this.data.currentUser = { uid: userDoc.id, ...userData };
      if (remember) {
        localStorage.setItem('sahnun_session', JSON.stringify({ uid: userDoc.id, username, role: userData.role }));
      }
      this.enterApp();
    } catch(e) {
      console.error(e);
      this.showToast('خطأ في الاتصال، تأكد من الإنترنت', 'error');
    }
  },
  async adminLogin() {
    const email = document.getElementById('adminEmail').value.trim();
    const password = document.getElementById('adminPassword').value;
    if (!email || !password) {
      this.showToast('يرجى إدخال البريد وكلمة المرور', 'error');
      return;
    }
    try {
      const cred = await firebase.auth().signInWithEmailAndPassword(email, password);
      const user = cred.user;
      this.data.currentUser = { uid: user.uid, username: user.email, name: 'المدير', role: 'admin', email: user.email };
      localStorage.setItem('sahnun_session', JSON.stringify({ uid: user.uid, username: user.email, role: 'admin' }));
      this.enterApp();
    } catch(e) {
      console.error(e);
      this.showToast('خطأ في البريد الإلكتروني أو كلمة المرور', 'error');
    }
  },
  /* ---------- Password Reset ---------- */
  showForgotAdminPassword() {
    this.openModal(`<div class="modal"><h3>🔐 استعادة كلمة مرور المدير</h3>
      <p style="color:#666; margin-bottom:12px; font-size:0.9rem;">أدخل بريدك المسجل في Firebase وسيُرسل إليك رابط إعادة التعيين.</p>
      <div class="form-group"><label>البريد الإلكتروني</label><input type="email" id="forgotAdminEmail" placeholder="admin@example.com" dir="ltr"></div>
      <button class="btn btn-primary btn-block" onclick="app.sendAdminPasswordReset()">📧 إرسال رابط الاستعادة</button>
      <button class="btn btn-secondary btn-block" onclick="app.closeModal()">إلغاء</button>
    </div>`);
  },
  async sendAdminPasswordReset() {
    const email = document.getElementById('forgotAdminEmail').value.trim();
    if (!email) return this.showToast('يرجى إدخال البريد الإلكتروني', 'error');
    try {
      await firebase.auth().sendPasswordResetEmail(email);
      this.showToast('✅ تم إرسال رابط الاستعادة إلى بريدك الإلكتروني');
      this.closeModal();
    } catch(e) {
      console.error(e);
      this.showToast('⚠️ لم يتم العثور على هذا البريد أو هناك خطأ في الإرسال', 'error');
    }
  },
  showForgotUserPassword() {
    this.openModal(`<div class="modal"><h3>🔐 استعادة كلمة المرور</h3>
      <p style="color:#666; margin-bottom:12px; font-size:0.9rem;">أدخل اسم المستخدم والبريد المسجل لإنشاء رمز استعادة.</p>
      <div class="form-group"><label>اسم المستخدم</label><input type="text" id="forgotUsername" placeholder="اسم المستخدم" dir="ltr"></div>
      <div class="form-group"><label>البريد الإلكتروني المسجل</label><input type="email" id="forgotUserEmail" placeholder="بريدك@example.com" dir="ltr"></div>
      <button class="btn btn-primary btn-block" onclick="app.sendUserPasswordReset()">🔑 إنشاء رمز الاستعادة</button>
      <button class="btn btn-secondary btn-block" onclick="app.closeModal()">إلغاء</button>
    </div>`);
  },
  async sendUserPasswordReset() {
    const username = document.getElementById('forgotUsername').value.trim().replace(/\s/g, '');
    const email = document.getElementById('forgotUserEmail').value.trim().toLowerCase();
    if (!username || !email) return this.showToast('يرجى ملء جميع الحقول', 'error');
    try {
      const snap = await db.collection('users').where('username', '==', username).limit(1).get();
      if (snap.empty) return this.showToast('اسم المستخدم غير موجود', 'error');
      const userDoc = snap.docs[0];
      const userData = userDoc.data();
      if ((userData.email || '').toLowerCase() !== email) {
        return this.showToast('البريد الإلكتروني لا يتطابق مع السجل', 'error');
      }
      const token = Math.floor(100000 + Math.random() * 900000).toString();
      const expires = new Date(Date.now() + 15 * 60 * 1000);
      await db.collection('users').doc(userDoc.id).update({ resetToken: token, resetExpires: expires });
      this.closeModal();
      this.openModal(`<div class="modal"><h3>✅ تم إنشاء رمز الاستعادة</h3>
        <p style="color:#666; margin-bottom:12px; font-size:0.9rem;">تم إنشاء رمز مؤقت صالح لـ 15 دقيقة. اكتبه وأدخله مع كلمة المرور الجديدة.</p>
        <div style="background:#e8f5e9; border:2px dashed #1a5f2a; border-radius:12px; padding:16px; text-align:center; margin-bottom:16px;">
          <div style="font-size:2rem; font-weight:bold; color:#1a5f2a; letter-spacing:8px;">${token}</div>
          <div style="font-size:0.8rem; color:#666; margin-top:6px;">صالح حتى ${expires.toLocaleTimeString('ar-DZ')}</div>
        </div>
        <div class="form-group"><label>أدخل الرمز هنا للتأكيد</label><input type="text" id="verifyTokenInput" placeholder="123456" maxlength="6" dir="ltr"></div>
        <div class="form-group"><label>كلمة المرور الجديدة (4 أرقام على الأقل)</label><input type="password" id="verifyNewPassword" placeholder="••••" autocomplete="new-password"></div>
        <button class="btn btn-primary btn-block" onclick="app.verifyUserPasswordReset('${userDoc.id}')">🔑 تأكيد وتغيير كلمة المرور</button>
      </div>`);
    } catch(e) {
      console.error(e);
      this.showToast('خطأ في الاتصال أو البيانات', 'error');
    }
  },
  async verifyUserPasswordReset(userId) {
    const token = document.getElementById('verifyTokenInput').value.trim();
    const newPassword = document.getElementById('verifyNewPassword').value;
    if (!token || !newPassword) return this.showToast('يرجى ملء جميع الحقول', 'error');
    if (newPassword.length < 4) return this.showToast('كلمة المرور يجب أن تكون 4 أرقام على الأقل', 'error');
    try {
      const doc = await db.collection('users').doc(userId).get();
      if (!doc.exists) return this.showToast('المستخدم غير موجود', 'error');
      const data = doc.data();
      if (data.resetToken !== token) return this.showToast('الرمز غير صحيح', 'error');
      if (data.resetExpires && data.resetExpires.toDate() < new Date()) {
        return this.showToast('انتهت صلاحية الرمز، ابدأ من جديد', 'error');
      }
      await db.collection('users').doc(userId).update({ password: newPassword, resetToken: firebase.firestore.FieldValue.delete(), resetExpires: firebase.firestore.FieldValue.delete() });
      this.showToast('✅ تم تغيير كلمة المرور بنجاح! يمكنك الآن تسجيل الدخول');
      this.closeModal();
    } catch(e) {
      console.error(e);
      this.showToast('خطأ في التحديث', 'error');
    }
  },
  enterApp() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('appContainer').classList.remove('hidden');
    this.buildNav();
    this.startSync();
    this.navigate('dashboard');
  },
  checkAuth() {
    const session = localStorage.getItem('sahnun_session');
    if (!session) {
      document.getElementById('loginScreen').classList.remove('hidden');
      return;
    }
    try {
      const data = JSON.parse(session);
      if (data.role === 'admin') {
        firebase.auth().onAuthStateChanged(user => {
          if (user) {
            this.data.currentUser = { uid: user.uid, username: user.email, name: 'المدير', role: 'admin', email: user.email };
            this.enterApp();
          } else {
            localStorage.removeItem('sahnun_session');
            document.getElementById('loginScreen').classList.remove('hidden');
          }
        });
      } else {
        db.collection('users').doc(data.uid).get().then(doc => {
          if (doc.exists) {
            this.data.currentUser = { uid: doc.id, ...doc.data() };
            this.enterApp();
          } else {
            localStorage.removeItem('sahnun_session');
            document.getElementById('loginScreen').classList.remove('hidden');
          }
        }).catch(() => {
          localStorage.removeItem('sahnun_session');
          document.getElementById('loginScreen').classList.remove('hidden');
        });
      }
    } catch(e) {
      localStorage.removeItem('sahnun_session');
      document.getElementById('loginScreen').classList.remove('hidden');
    }
  },
  logout() {
    if (this.data.currentUser?.role === 'admin') {
      firebase.auth().signOut().catch(()=>{});
    }
    localStorage.removeItem('sahnun_session');
    this.data.currentUser = null;
    this.data.currentPage = 'dashboard';
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('appContainer').classList.add('hidden');
    this.stopSync();
    this.closeMenuIfMobile();
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
      this.logout();
      return;
    }
    this.data.currentPage = page;
    if (page === 'takeExam') { this.data.activeExamId = extra; }
    if (page === 'examQuestions') { this.data.activeExamId = extra; }
    this.closeMenuIfMobile();
    this.buildNav();
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
      db.collection('timetable').onSnapshot(snap => { this.data.timetable = snap.docs.map(d=>({id:d.id,...d.data()})); if(this.data.currentPage==='timetable') this.renderTimetableView(); })
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
      <div class="stat-card"><div class="number">${this.data.students.length}</div><div class="label">الطلاب</div></div>
      <div class="stat-card"><div class="number">${this.data.teachers.length}</div><div class="label">المدرسون</div></div>
      <div class="stat-card"><div class="number">${this.data.lessons.length}</div><div class="label">الدروس</div></div>
      <div class="stat-card"><div class="number">${this.data.exams.length}</div><div class="label">الاختبارات</div></div>
      <div class="stat-card"><div class="number">${this.data.materials.length}</div><div class="label">المحتويات</div></div>
      <div class="stat-card"><div class="number">${this.data.attendance.length}</div><div class="label">سجلات الحضور</div></div>`;
  },
  /* =========================================================
     4. STUDENTS
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
    let html = `<table><tr><th>الاسم</th><th>القسم / المرحلة</th><th>الحالة</th><th>إجراءات</th></tr>`;
    this.data.students.forEach(s => {
      html += `<tr><td><strong>${this.escapeHtml(s.name)}</strong></td>
        <td><span class="badge badge-primary">${this.escapeHtml(s.section || 'غير محدد')}</span></td>
        <td><span class="badge ${s.active!==false?'badge-success':'badge-danger'}">${s.active!==false?'نشط':'غير نشط'}</span></td>
        <td><button class="btn btn-danger" onclick="app.deleteDoc('students','${s.id}')">حذف</button></td></tr>`;
    });
    html += '</table>';
    wrap.innerHTML = html;
  },
  filterStudents() {
    const q = document.getElementById('studentSearch').value.toLowerCase();
    const rows = document.querySelectorAll('#studentsTableWrap table tr:not(:first-child)');
    rows.forEach(r => {
      const text = r.textContent.toLowerCase();
      r.style.display = text.includes(q) ? '' : 'none';
    });
  },
  showStudentModal() {
    this.openModal(`<div class="modal"><h3>تسجيل طالب جديد</h3>
      <div class="form-group"><label>الاسم الكامل</label><input id="stName" placeholder="مثال: أحمد بن محمد"></div>
      <div class="form-group"><label>القسم / المرحلة</label>
        <select id="stSection">
          <option value="">-- اختر القسم --</option>
          <option value="السنة الأولى - المتوسط">السنة الأولى - المتوسط</option>
          <option value="السنة الثانية - المتوسط">السنة الثانية - المتوسط</option>
          <option value="السنة الثالثة - المتوسط">السنة الثالثة - المتوسط</option>
          <option value="السنة الأولى - الثانوي">السنة الأولى - الثانوي</option>
          <option value="السنة الثانية - الثانوي">السنة الثانية - الثانوي</option>
          <option value="السنة الثالثة - الثانوي">السنة الثالثة - الثانوي</option>
          <option value="المرحلة الجامعية - الأولى">المرحلة الجامعية - الأولى</option>
          <option value="المرحلة الجامعية - الثانية">المرحلة الجامعية - الثانية</option>
          <option value="المرحلة الجامعية - الثالثة">المرحلة الجامعية - الثالثة</option>
          <option value="المرحلة الجامعية - الرابعة">المرحلة الجامعية - الرابعة</option>
          <option value="الدراسات العليا">الدراسات العليا</option>
        </select>
      </div>
      <div class="form-group"><label>رقم الهاتف (اختياري)</label><input id="stPhone" placeholder="0555..." dir="ltr"></div>
      <button class="btn btn-primary btn-block" onclick="app.saveStudent()">💾 حفظ في السحابة</button>
      <button class="btn btn-secondary btn-block" onclick="app.closeModal()">إلغاء</button>
    </div>`);
  },
  async saveStudent() {
    const name = document.getElementById('stName').value.trim();
    const section = document.getElementById('stSection').value;
    const phone = document.getElementById('stPhone').value.trim();
    if (!name) return this.showToast('يرجى إدخال اسم الطالب', 'error');
    if (!section) return this.showToast('يرجى اختيار القسم / المرحلة', 'error');
    try {
      await db.collection('students').add({ name, section, phone: phone || '', active: true, createdAt: new Date() });
      this.showToast('تم إضافة الطالب بنجاح');
      this.closeModal();
    } catch(e) { console.error(e); this.showToast('خطأ في الحفظ', 'error'); }
  },
  /* =========================================================
     5. TEACHERS
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
     6. USERS MANAGEMENT
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
        <td><span class="badge badge-primary">${this.escapeHtml(u.section || '—')}</span></td>
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
    rows.forEach(r => {
      const text = r.textContent.toLowerCase();
      r.style.display = text.includes(q) ? '' : 'none';
    });
  },
  showUserModal() {
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
        <label>القسم / المرحلة</label>
        <select id="uSection">
          <option value="">-- اختر القسم --</option>
          <option value="السنة الأولى - المتوسط">السنة الأولى - المتوسط</option>
          <option value="السنة الثانية - المتوسط">السنة الثانية - المتوسط</option>
          <option value="السنة الثالثة - المتوسط">السنة الثالثة - المتوسط</option>
          <option value="السنة الأولى - الثانوي">السنة الأولى - الثانوي</option>
          <option value="السنة الثانية - الثانوي">السنة الثانية - الثانوي</option>
          <option value="السنة الثالثة - الثانوي">السنة الثالثة - الثانوي</option>
          <option value="المرحلة الجامعية - الأولى">المرحلة الجامعية - الأولى</option>
          <option value="المرحلة الجامعية - الثانية">المرحلة الجامعية - الثانية</option>
          <option value="المرحلة الجامعية - الثالثة">المرحلة الجامعية - الثالثة</option>
          <option value="المرحلة الجامعية - الرابعة">المرحلة الجامعية - الرابعة</option>
          <option value="الدراسات العليا">الدراسات العليا</option>
        </select>
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
    const section = role === 'student' ? document.getElementById('uSection').value : '';
    if (!name || !username || !password) return this.showToast('يرجى ملء جميع الحقول الإلزامية', 'error');
    if (password.length < 4) return this.showToast('كلمة المرور يجب أن تكون 4 أرقام على الأقل', 'error');
    if (role === 'student' && !section) return this.showToast('يرجى اختيار القسم للطالب', 'error');
    try {
      const existing = await db.collection('users').where('username','==',username).limit(1).get();
      if (!existing.empty) return this.showToast('اسم المستخدم مستخدم بالفعل، اختر اسماً آخر', 'error');
      const data = { name, username, password, role, section: section || '', createdAt: new Date() };
      if (email) data.email = email;
      await db.collection('users').add(data);
      this.showToast('تم إنشاء المستخدم بنجاح');
      this.closeModal();
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
      this.showToast('تم تغيير كلمة المرور بنجاح');
      this.closeModal();
    } catch(e) { this.showToast('خطأ في التحديث', 'error'); }
  },
  /* =========================================================
     7. WEEKLY TIMETABLE
     ========================================================= */
  timetableSections: ['السنة الأولى - المتوسط','السنة الثانية - المتوسط','السنة الثالثة - المتوسط','السنة الأولى - الثانوي','السنة الثانية - الثانوي','السنة الثالثة - الثانوي','المرحلة الجامعية - الأولى','المرحلة الجامعية - الثانية','المرحلة الجامعية - الثالثة','المرحلة الجامعية - الرابعة','الدراسات العليا'],
  timetableDays: ['السبت','الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس'],
  timetableSlots: ['08:00','09:30','11:00','13:00','14:30','16:00'],
  renderTimetablePage() {
    const isStudent = this.data.currentUser?.role === 'student';
    const sections = this.timetableSections;
    const studentSection = this.data.currentUser?.section;
    return `<div class="header-bar"><h2>📅 الجدول الأسبوعي</h2>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        ${!isStudent ? `<select id="ttSectionFilter" class="search-box" style="max-width:220px; margin:0;" onchange="app.renderTimetableView()">
          <option value="all">جميع الأقسام</option>
          ${sections.map(s=>`<option value="${s}">${s}</option>`).join('')}
        </select>
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
    const userSection = this.data.currentUser?.role === 'student' ? this.data.currentUser?.section : null;
    const effectiveFilter = userSection || sectionFilter;
    const entries = this.data.timetable.filter(e => effectiveFilter==='all' || e.section===effectiveFilter);
    let html = `<div style="overflow-x:auto;"><div class="timetable-grid">`;
    html += `<div class="timetable-header">الوقت / اليوم</div>`;
    this.timetableDays.forEach(d => html += `<div class="timetable-header">${d}</div>`);
    this.timetableSlots.forEach(slot => {
      html += `<div class="timetable-time">${slot}</div>`;
      this.timetableDays.forEach(day => {
        const entry = entries.find(e => e.day===day && e.time===slot && (effectiveFilter==='all' || e.section===effectiveFilter));
        if (entry) {
          html += `<div class="timetable-cell" onclick="app.showTimetableModal('${entry.id}')"><div class="lesson-title">${this.escapeHtml(entry.title)}</div><div class="lesson-meta">${this.escapeHtml(entry.teacher||'')} | ${this.escapeHtml(entry.section)}</div></div>`;
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
          html += `<div class="tt-slot" onclick="app.showTimetableModal('${entry.id}')"><div><div class="tt-lesson">${this.escapeHtml(entry.title)}</div><div class="tt-meta">${this.escapeHtml(entry.teacher||'')} | ${this.escapeHtml(entry.section)}</div></div><div class="tt-time">${slot}</div></div>`;
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
    if (isStudent) return; // Students can't edit
    const entry = entryId ? this.data.timetable.find(e => e.id === entryId) : null;
    this.openModal(`<div class="modal"><h3>${entry ? 'تعديل الحصة' : 'إضافة حصة للجدول'}</h3>
      <div class="form-group"><label>المادة / الدرس</label><input id="ttTitle" value="${entry ? this.escapeHtml(entry.title) : ''}"></div>
      <div class="form-group"><label>القسم</label>
        <select id="ttSection">${this.timetableSections.map(s=>`<option value="${s}" ${entry && entry.section===s?'selected':''}>${s}</option>`).join('')}</select>
      </div>
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
    const section = document.getElementById('ttSection').value;
    const day = document.getElementById('ttDay').value;
    const time = document.getElementById('ttTime').value;
    const teacher = document.getElementById('ttTeacher').value.trim();
    const room = document.getElementById('ttRoom').value.trim();
    if (!title || !section || !day || !time) return this.showToast('يرجى ملء جميع الحقول الإلزامية', 'error');
    const payload = { title, section, day, time, teacher, room, updatedAt: new Date() };
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
     8. LESSONS & ATTENDANCE LINKS
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
      html += `<tr><td><strong>${this.escapeHtml(l.title)}</strong></td><td>${this.escapeHtml(l.section||'')}</td><td>${l.date||''}</td>
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
      navigator.clipboard.writeText(link).then(() => {
        this.showToast('تم نسخ رابط الحضور! يمكنك لصقه في واتساب أو تليجرام');
      }).catch(() => this.fallbackCopy(link));
    } else {
      this.fallbackCopy(link);
    }
  },
  fallbackCopy(link) {
    const ta = document.createElement('textarea');
    ta.value = link; document.body.appendChild(ta);
    ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    this.showToast('تم نسخ رابط الحضور! يمكنك لصقه في واتساب أو تليجرام');
  },
  showLessonModal() {
    this.openModal(`<div class="modal"><h3>إضافة درس جديد</h3>
      <div class="form-group"><label>عنوان الدرس</label><input id="lsTitle"></div>
      <div class="form-group"><label>القسم المستهدف</label>
        <select id="lsSection">${this.timetableSections.map(s=>`<option value="${s}">${s}</option>`).join('')}</select>
      </div>
      <div class="form-group"><label>التاريخ</label><input type="date" id="lsDate"></div>
      <div class="form-group"><label>الوقت</label><input type="time" id="lsTime"></div>
      <button class="btn btn-primary btn-block" onclick="app.saveLesson()">💾 حفظ</button>
      <button class="btn btn-secondary btn-block" onclick="app.closeModal()">إلغاء</button>
    </div>`);
  },
  async saveLesson() {
    const title = document.getElementById('lsTitle').value.trim();
    const section = document.getElementById('lsSection').value;
    const date = document.getElementById('lsDate').value;
    const time = document.getElementById('lsTime').value;
    if (!title || !date) return this.showToast('يرجى ملء العنوان والتاريخ', 'error');
    try {
      await db.collection('lessons').add({ title, section, date, time, createdAt: new Date() });
      this.showToast('تم إضافة الدرس'); this.closeModal();
    } catch(e) { this.showToast('خطأ في الحفظ','error'); }
  },
  /* =========================================================
     9. ATTENDANCE MANAGEMENT
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
      this.data.lessons.forEach(l => {
        select.add(new Option(this.escapeHtml(l.title), l.id));
      });
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
        <td><span class="badge badge-primary">${this.escapeHtml(a.studentSection || 'غير محدد')}</span></td>
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
      htmlTable += `<tr><td style="padding:8px;">${idx+1}</td><td style="padding:8px;">${this.escapeHtml(lesson?lesson.title:'')}</td><td style="padding:8px;">${this.escapeHtml(a.studentName||'')}</td><td style="padding:8px;">${this.escapeHtml(a.studentSection||'')}</td><td style="padding:8px;">${this.formatDate(a.timestamp)}</td></tr>`;
    });
    htmlTable += `</tbody></table></body></html>`;
    const blob = new Blob(['\ufeff'+htmlTable], {type:'application/msword'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `حضور_${lessonName}.doc`;
    a.click();
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
      return [idx+1, lesson?lesson.title:'', a.studentName||'', a.studentSection||'', this.formatDate(a.timestamp)];
    });
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(16);
    doc.text(`كشف حضور - ${lessonName}`, 14, 15);
    doc.setFontSize(10);
    doc.text('معهد الإمام سحنون للعلوم الشرعية', 14, 22);
    doc.autoTable({ head: [['#','الدرس','الطالب','القسم','التاريخ']], body, startY: 28, styles: { font: 'Arial', halign: 'right' }, headStyles: { fillColor: [26,95,42] } });
    doc.save(`حضور_${lessonName}.pdf`);
    this.showToast('تم تصدير ملف PDF');
  },
  // Public self-registration via URL
  showAttendanceRegistration() {
    const params = new URLSearchParams(window.location.search);
    const lessonId = params.get('attendanceLesson');
    if (!lessonId) return;
    const lesson = this.data.lessons.find(l => l.id === lessonId);
    if (!lesson) {
      document.body.innerHTML = '<div style="padding:40px; text-align:center; font-family:Segoe UI,Tahoma,Geneva,Verdana,sans-serif;"><h2>⚠️ الدرس غير موجود</h2></div>';
      return;
    }
    document.body.innerHTML = `
    <div class="public-page">
      <h2>🕌 معهد الإمام سحنون</h2>
      <p>تسجيل حضور للدرس: <strong>${this.escapeHtml(lesson.title)}</strong></p>
      <div class="form-group">
        <label>الاسم الكامل</label>
        <input id="pubName" placeholder="أدخل اسمك الكامل">
      </div>
      <div class="form-group">
        <label>القسم / المرحلة</label>
        <select id="pubSection">
          <option value="">-- اختر قسمك --</option>
          ${this.timetableSections.map(s=>`<option value="${s}">${s}</option>`).join('')}
        </select>
      </div>
      <button id="pubBtn" onclick="app.submitPublicAttendance('${lessonId}')">✅ تأكيد الحضور</button>
      <p style="margin-top:18px; font-size:0.85rem; color:#888;">سيتم تسجيل حضورك في النظام السحابي مباشرة.</p>
    </div>`;
  },
  async submitPublicAttendance(lessonId) {
    const name = document.getElementById('pubName').value.trim();
    const section = document.getElementById('pubSection').value;
    if (!name || !section) return this.showToast('يرجى إدخال الاسم واختيار القسم', 'error');
    try {
      await db.collection('attendance').add({
        lessonId, studentName: name, studentSection: section,
        timestamp: new Date(), source: 'link'
      });
      document.body.innerHTML = `<div class="public-page">
        <h2 style="color:#28a745;">✅ تم تسجيل حضورك بنجاح!</h2>
        <p style="color:#666; margin-top:12px;">بارك الله فيك يا ${this.escapeHtml(name)}</p>
      </div>`;
    } catch(e) { this.showToast('حدث خطأ أثناء التسجيل، حاول مرة أخرى.', 'error'); }
  },
  /* =========================================================
     10. LIBRARY
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
      await db.collection('materials').add({
        title, type: document.getElementById('mType').value, url,
        description: document.getElementById('mDesc').value,
        uploadedBy: this.data.currentUser?.username || '', uploadedAt: new Date().toISOString().split('T')[0]
      });
      this.showToast('تم إضافة المحتوى'); this.closeModal();
    } catch(e) { this.showToast('خطأ في الحفظ','error'); }
  },
  /* =========================================================
     11. EXAMS
     ========================================================= */
  renderExamsPage() {
    return `<div class="header-bar"><h2>📝 إدارة الاختبارات</h2><button class="btn btn-primary" onclick="app.showExamModal()">+ اختبار جديد</button></div>
      <div class="card"><div class="table-wrap" id="examsTableWrap"></div></div>`;
  },
  renderExamsTable() {
    const wrap = document.getElementById('examsTableWrap');
    if (!wrap) return;
    const section = this.data.currentUser?.section;
    const role = this.data.currentUser?.role;
    let exams = this.data.exams;
    if (role === 'student' && section) {
      exams = exams.filter(e => e.section === section || !e.section);
    }
    if (!exams.length) { wrap.innerHTML = '<div class="empty-state">لا توجد اختبارات.</div>'; return; }
    let html = `<table><tr><th>العنوان</th><th>القسم</th><th>المدة</th><th>الأسئلة</th><th>الحالة</th><th>إجراءات</th></tr>`;
    exams.forEach(e => {
      const qCount = e.questions ? e.questions.length : 0;
      html += `<tr><td><strong>${this.escapeHtml(e.title)}</strong></td><td>${this.escapeHtml(e.section || 'الكل')}</td><td>${e.duration} دقيقة</td><td>${qCount}</td>
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
    this.openModal(`<div class="modal"><h3>إضافة اختبار جديد</h3>
      <div class="form-group"><label>العنوان</label><input id="exTitle"></div>
      <div class="form-group"><label>القسم المستهدف</label>
        <select id="exSection">${this.timetableSections.map(s=>`<option value="${s}">${s}</option>`).join('')}</select>
      </div>
      <div class="form-group"><label>المدة (دقيقة)</label><input type="number" id="exDuration" value="20"></div>
      <button class="btn btn-primary btn-block" onclick="app.saveExam()">💾 إنشاء</button>
      <button class="btn btn-secondary btn-block" onclick="app.closeModal()">إلغاء</button>
    </div>`);
  },
  async saveExam() {
    const title = document.getElementById('exTitle').value.trim();
    const duration = parseInt(document.getElementById('exDuration').value) || 20;
    const section = document.getElementById('exSection').value;
    if (!title) return this.showToast('يرجى إدخال عنوان الاختبار', 'error');
    try {
      await db.collection('exams').add({ title, duration, section, questions: [], status: 'منشور', createdAt: new Date() });
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
     12. STUDENT VIEWS (FILTERED BY SECTION)
     ========================================================= */
  renderMyLessonsPage() {
    const section = this.data.currentUser?.section;
    const lessons = section ? this.data.lessons.filter(l => l.section === section) : this.data.lessons;
    return `<div class="header-bar"><h2>📖 حصصي القادمة</h2><span class="badge badge-info">${this.escapeHtml(section || 'الكل')}</span></div>
      <div class="card"><div class="table-wrap"><table><tr><th>الدرس</th><th>القسم</th><th>التاريخ</th><th>الوقت</th></tr>
        ${lessons.length ? lessons.map(l => `<tr><td>${this.escapeHtml(l.title)}</td><td>${this.escapeHtml(l.section||'')}</td><td>${l.date||''}</td><td>${l.time||''}</td></tr>`).join('') : '<tr><td colspan="4" class="text-center" style="color:#888;">لا توجد حصص مسجلة لقسمك حالياً.</td></tr>'}
      </table></div></div>`;
  },
  renderMyExamsPage() {
    const section = this.data.currentUser?.section;
    const exams = section ? this.data.exams.filter(e => e.section === section || !e.section) : this.data.exams;
    return `<div class="header-bar"><h2>📝 اختباراتي المتاحة</h2><span class="badge badge-info">${this.escapeHtml(section || 'الكل')}</span></div>
      <div class="card"><div class="table-wrap"><table><tr><th>الاختبار</th><th>القسم</th><th>المدة</th><th>إجراء</th></tr>
        ${exams.length ? exams.map(e => `<tr><td>${this.escapeHtml(e.title)}</td><td>${this.escapeHtml(e.section || 'الكل')}</td><td>${e.duration} دقيقة</td><td><button class="btn btn-primary" onclick="app.navigate('takeExam','${e.id}')">بدء</button></td></tr>`).join('') : '<tr><td colspan="4" class="text-center" style="color:#888;">لا توجد اختبارات متاحة لقسمك حالياً.</td></tr>'}
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
     13. ABOUT
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
     14. GENERAL DELETE
     ========================================================= */
  async deleteDoc(colName, docId) {
    if (!confirm('هل أنت متأكد من الحذف من السحابة؟')) return;
    try { await db.collection(colName).doc(docId).delete(); this.showToast('تم الحذف'); }
    catch(e) { this.showToast('خطأ في الحذف','error'); }
  },
  /* =========================================================
     15. INIT
     ========================================================= */
  init() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('attendanceLesson')) {
      this.startSync();
      setTimeout(() => this.showAttendanceRegistration(), 1000);
    } else {
      this.checkAuth();
    }
  }
};
document.addEventListener('DOMContentLoaded', () => app.init());