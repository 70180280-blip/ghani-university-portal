/**
 * Ghani University Portal - Student Frontend Engine (Bulletproof)
 * 
 * Manages:
 * - Student authentication (Name + Father's Name + Reg No + Optional Verification)
 * - Dark & Light theme toggle
 * - SAP Fiori Tiles with live counters
 * - Modular ERP screens (Results, Attendance, Transcript, Timetable, Degree Audit, Admit Card)
 * - AI Assistant Chat, Performance Insights, What-If Simulator
 * - Chart.js visualizations (with graceful fallback if offline)
 */

// Global State
let currentStudent = null;
let currentView = 'dashboard';
let sgpaChartInstance = null;
let attendanceChartInstance = null;
let currentAttendanceData = null;

// ============================================================================
// TOP-LEVEL GLOBAL FUNCTIONS (Immediately accessible to all inline onclick handlers)
// ============================================================================

window.openView = function(viewName) {
  const container = document.getElementById('view-modal-container');
  const title = document.getElementById('view-modal-title');
  const body = document.getElementById('view-modal-body');

  if (!container || !title || !body) return;

  container.classList.remove('hidden');
  body.innerHTML = '<div class="flex justify-center p-12"><div class="animate-spin rounded-full h-10 w-10 border-b-2 border-sky-500"></div></div>';

  switch (viewName) {
    case 'results':
      title.innerText = 'My Academic Results & SGPA Trend';
      loadResultsView(body);
      break;
    case 'attendance':
      title.innerText = 'Attendance Audit & Course Breakdown';
      loadAttendanceView(body);
      break;
    case 'transcript':
      title.innerText = 'Official Interim Academic Transcript';
      loadTranscriptView(body);
      break;
    case 'registered-courses':
    case 'active-courses':
    case 'courses':
      title.innerText = 'Active Registered Courses Load';
      loadRegisteredCoursesView(body);
      break;
    case 'timetable':
      title.innerText = 'Weekly Lecture Timetable';
      loadTimetableView(body);
      break;
    case 'degree-audit':
      title.innerText = 'Degree Audit & Graduation Progress';
      loadDegreeAuditView(body);
      break;
    case 'personal-details':
      title.innerText = 'Student Profile & University Records';
      loadPersonalDetailsView(body);
      break;
    case 'admit-card':
      title.innerText = 'Examination Admit Card';
      loadAdmitCardView(body);
      break;
    case 'ai-assistant':
      title.innerText = 'AI Study Assistant (Academic Advisor)';
      loadAiAssistantView(body);
      break;
    case 'ai-insights':
      title.innerText = 'AI Academic Performance Insights';
      loadAiInsightsView(body);
      break;
    case 'what-if':
      title.innerText = 'What-If Academic Simulator';
      loadWhatIfView(body);
      break;
    default:
      window.closeViewModal();
  }
};

window.closeViewModal = function() {
  const container = document.getElementById('view-modal-container');
  if (container) container.classList.add('hidden');
  if (sgpaChartInstance) {
    try { sgpaChartInstance.destroy(); } catch (e) {}
    sgpaChartInstance = null;
  }
  if (attendanceChartInstance) {
    try { attendanceChartInstance.destroy(); } catch (e) {}
    attendanceChartInstance = null;
  }
};

window.quickFillStudent = function(reg, name, father) {
  const regInput = document.getElementById('login-reg-no');
  const nameInput = document.getElementById('login-student-name');
  const fatherInput = document.getElementById('login-father-name');

  if (regInput) regInput.value = reg;
  if (nameInput) nameInput.value = name;
  if (fatherInput) fatherInput.value = father;

  // Auto trigger form submit
  const form = document.getElementById('student-login-form');
  if (form) {
    form.dispatchEvent(new Event('submit'));
  }
};

window.sendQuickPrompt = function(promptText) {
  const input = document.getElementById('ai-chat-input');
  if (input) {
    input.value = promptText;
    document.getElementById('ai-chat-form')?.dispatchEvent(new Event('submit'));
  }
};

window.runWhatIfSimulation = async function() {
  const selects = document.querySelectorAll('.sim-grade');
  const simulatedCourses = Array.from(selects).map(s => ({
    courseCode: s.dataset.code,
    creditHours: Number(s.dataset.ch),
    simulatedGrade: s.value
  }));

  try {
    const res = await fetch('/api/student/ai/what-if', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ simulatedCourses })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    const p = data.projection;
    const resArea = document.getElementById('whatif-result-area');
    if (resArea) resArea.classList.remove('hidden');

    const sgpaEl = document.getElementById('sim-sgpa-val');
    const prevEl = document.getElementById('sim-prev-cgpa');
    const newEl = document.getElementById('sim-new-cgpa');
    const advEl = document.getElementById('sim-ai-advice');

    if (sgpaEl) sgpaEl.innerText = Number(p.simulatedSGPA).toFixed(2);
    if (prevEl) prevEl.innerText = Number(p.previousCGPA).toFixed(2);
    if (newEl) newEl.innerText = `${Number(p.projectedCGPA).toFixed(2)} (${p.cgpaDifference >= 0 ? '+' : ''}${Number(p.cgpaDifference).toFixed(2)})`;
    if (advEl) advEl.innerText = data.aiExplanation;
  } catch (err) {
    console.error('What-If simulation failed:', err);
  }
};

window.handleSendAiMessage = async function(e) {
  if (e && e.preventDefault) e.preventDefault();
  const input = document.getElementById('ai-chat-input');
  const message = input ? input.value.trim() : '';
  if (!message) return;

  const messagesBox = document.getElementById('ai-chat-messages');
  if (!messagesBox) return;

  // Append user message
  messagesBox.innerHTML += `
    <div class="flex items-start justify-end gap-2">
      <div class="bg-sky-700 text-white p-3 rounded-xl rounded-tr-none max-w-[85%] leading-relaxed">
        ${escapeHtml(message)}
      </div>
    </div>
  `;

  if (input) input.value = '';
  messagesBox.scrollTop = messagesBox.scrollHeight;

  const typingId = `typing_${Date.now()}`;
  messagesBox.innerHTML += `
    <div id="${typingId}" class="flex items-start gap-2">
      <div class="w-7 h-7 rounded-full bg-sky-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">AI</div>
      <div class="bg-slate-800 p-3 rounded-xl rounded-tl-none border border-slate-700 text-slate-400">
        Thinking...
      </div>
    </div>
  `;
  messagesBox.scrollTop = messagesBox.scrollHeight;

  try {
    const res = await fetch('/api/student/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
    const data = await res.json();
    document.getElementById(typingId)?.remove();

    const answer = data.success ? data.answer : (data.error || 'Unable to process query');
    messagesBox.innerHTML += `
      <div class="flex items-start gap-2">
        <div class="w-7 h-7 rounded-full bg-sky-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">AI</div>
        <div class="bg-slate-800 p-3 rounded-xl rounded-tl-none border border-slate-700 text-slate-200 max-w-[85%] leading-relaxed">
          ${formatMarkdown(answer)}
        </div>
      </div>
    `;
    messagesBox.scrollTop = messagesBox.scrollHeight;
  } catch (err) {
    document.getElementById(typingId)?.remove();
    messagesBox.innerHTML += `<div class="text-xs text-red-400 p-2">Error connecting to AI advisor.</div>`;
  }
};

// ============================================================================
// LIFECYCLE & INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  checkSession();
  setupEventListeners();
});

function initTheme() {
  const savedTheme = localStorage.getItem('gtiu_theme') || 'dark';
  applyTheme(savedTheme);

  const toggleBtn = document.getElementById('theme-toggle-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const isDark = document.documentElement.classList.contains('dark');
      applyTheme(isDark ? 'light' : 'dark');
    });
  }
}

function applyTheme(theme) {
  const isLight = theme === 'light';
  if (isLight) {
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
    localStorage.setItem('gtiu_theme', 'light');
    updateThemeIcon('light');
  } else {
    document.documentElement.classList.remove('light');
    document.documentElement.classList.add('dark');
    localStorage.setItem('gtiu_theme', 'dark');
    updateThemeIcon('dark');
  }

  // Live update charts if currently opened
  const gridColor = isLight ? '#E2E8F0' : '#334155';
  const textColor = isLight ? '#475569' : '#94A3B8';
  [sgpaChartInstance, attendanceChartInstance].forEach(chart => {
    if (chart && chart.options && chart.options.scales) {
      try {
        if (chart.options.scales.y) {
          chart.options.scales.y.grid = chart.options.scales.y.grid || {};
          chart.options.scales.y.grid.color = gridColor;
          chart.options.scales.y.ticks = chart.options.scales.y.ticks || {};
          chart.options.scales.y.ticks.color = textColor;
        }
        if (chart.options.scales.x) {
          chart.options.scales.x.ticks = chart.options.scales.x.ticks || {};
          chart.options.scales.x.ticks.color = textColor;
        }
        if (chart.options.plugins && chart.options.plugins.legend) {
          chart.options.plugins.legend.labels = chart.options.plugins.legend.labels || {};
          chart.options.plugins.legend.labels.color = textColor;
        }
        chart.update();
      } catch (e) {
        // Safe ignore
      }
    }
  });
}
window.applyTheme = applyTheme;

function updateThemeIcon(theme) {
  const iconSpan = document.getElementById('theme-icon');
  const labelSpan = document.getElementById('theme-label');
  const toggleBtn = document.getElementById('theme-toggle-btn');
  if (!iconSpan) return;

  if (theme === 'light') {
    // Current is Light mode -> Moon icon to switch to Dark
    iconSpan.innerHTML = `<svg class="w-4 h-4 text-amber-300" fill="currentColor" viewBox="0 0 20 20"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/></svg>`;
    if (labelSpan) labelSpan.innerText = 'Light';
    if (toggleBtn) toggleBtn.title = 'Active: Light Mode. Click to switch to Dark Mode.';
  } else {
    // Current is Dark mode -> Sun icon to switch to Light
    iconSpan.innerHTML = `<svg class="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"/></svg>`;
    if (labelSpan) labelSpan.innerText = 'Dark';
    if (toggleBtn) toggleBtn.title = 'Active: Dark Mode. Click to switch to Light (Brightness) Mode.';
  }
}

async function checkSession() {
  try {
    const res = await fetch('/api/student/me');
    const data = await res.json();

    if (data.authenticated && data.student) {
      currentStudent = data.student;
      showPortalApp();
      loadDashboard();
    } else {
      showLoginScreen(data.config?.optionalVerification);
    }
  } catch (err) {
    showLoginScreen();
  }
}

function showLoginScreen(optConfig) {
  const loginSection = document.getElementById('login-section');
  const portalSection = document.getElementById('portal-section');
  const userMenu = document.getElementById('user-profile-menu');

  if (loginSection) loginSection.classList.remove('hidden');
  if (portalSection) portalSection.classList.add('hidden');
  if (userMenu) userMenu.classList.add('hidden');

  const optContainer = document.getElementById('optional-verification-container');
  if (optContainer) {
    if (optConfig && optConfig.enabled) {
      optContainer.classList.remove('hidden');
      const lbl = document.getElementById('optional-field-label');
      if (lbl) lbl.innerText = optConfig.label || 'Security Verification';
    } else {
      optContainer.classList.add('hidden');
    }
  }
}

function showPortalApp() {
  const loginSection = document.getElementById('login-section');
  const portalSection = document.getElementById('portal-section');
  const userMenu = document.getElementById('user-profile-menu');

  if (loginSection) loginSection.classList.add('hidden');
  if (portalSection) portalSection.classList.remove('hidden');
  if (userMenu) userMenu.classList.remove('hidden');

  if (currentStudent) {
    const nameEl = document.getElementById('nav-student-name');
    const regEl = document.getElementById('nav-student-reg');
    if (nameEl) nameEl.innerText = currentStudent.name;
    if (regEl) regEl.innerText = currentStudent.registration_no;
  }
}

async function loadDashboard() {
  try {
    const res = await fetch('/api/student/dashboard');
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    const s = data.student;
    const nameEl = document.getElementById('banner-student-name');
    const fatherEl = document.getElementById('banner-father-name');
    const regEl = document.getElementById('banner-reg-no');
    const classEl = document.getElementById('banner-class');
    const cgpaEl = document.getElementById('banner-cgpa');
    const chEl = document.getElementById('banner-earned-ch');

    if (nameEl) nameEl.innerText = s.name;
    if (fatherEl) fatherEl.innerText = s.father_name;
    if (regEl) regEl.innerText = s.registration_no;
    if (classEl) classEl.innerText = s.current_class;
    if (cgpaEl) cgpaEl.innerText = Number(s.cgpa || 0).toFixed(2);
    if (chEl) chEl.innerText = `${s.earned_ch || 0} CH`;

    const t = data.tiles;
    if (t) {
      const resCount = document.getElementById('tile-results-count');
      const resSub = document.getElementById('tile-results-sub');
      const auditCount = document.getElementById('tile-audit-count');
      const auditSub = document.getElementById('tile-audit-sub');

      if (resCount) resCount.innerText = t.results.myResults.countText;
      if (resSub) resSub.innerText = t.results.myResults.subText;
      if (auditCount) auditCount.innerText = t.results.degreeAudit.countText;
      if (auditSub) auditSub.innerText = t.results.degreeAudit.subText;

      const coursesCount = document.getElementById('tile-courses-count');
      const coursesSub = document.getElementById('tile-courses-sub');
      const timeCount = document.getElementById('tile-timetable-count');
      const timeSub = document.getElementById('tile-timetable-sub');

      if (coursesCount) coursesCount.innerText = t.academics.registeredCourses.countText;
      if (coursesSub) coursesSub.innerText = t.academics.registeredCourses.subText;
      if (timeCount) timeCount.innerText = t.academics.timetable.countText;
      if (timeSub) timeSub.innerText = t.academics.timetable.subText;

      const attCount = document.getElementById('tile-attendance-count');
      const attSub = document.getElementById('tile-attendance-sub');
      const attContainer = document.getElementById('tile-attendance-container');
      const attBadge = document.getElementById('tile-attendance-badge');

      if (attCount) attCount.innerText = t.administration.attendance.countText;
      if (attSub) attSub.innerText = t.administration.attendance.subText;
      if (t.administration.attendance.isWarning) {
        if (attContainer) attContainer.classList.add('warning-tile');
        if (attBadge) attBadge.classList.remove('hidden');
      } else {
        if (attContainer) attContainer.classList.remove('warning-tile');
        if (attBadge) attBadge.classList.add('hidden');
      }

      const insCount = document.getElementById('tile-insights-count');
      const insSub = document.getElementById('tile-insights-sub');
      if (insCount) insCount.innerText = t.ai.insights.countText;
      if (insSub) insSub.innerText = t.ai.insights.subText;
    }
  } catch (err) {
    console.error('Error loading dashboard:', err);
  }
}

// ============================================================================
// VIEW LOADERS
// ============================================================================

window.__currentStudentResults = null;

window.loadFilteredSemesterResult = function() {
  const yearSelect = document.getElementById('result-filter-year');
  const sessionSelect = document.getElementById('result-filter-session');
  const outContainer = document.getElementById('filtered-result-container');
  if (!yearSelect || !sessionSelect || !outContainer) return;

  const yr = parseInt(yearSelect.value, 10);
  const sess = sessionSelect.value;
  const data = window.__currentStudentResults;

  if (!data || !data.semesters || data.semesters.length === 0) {
    outContainer.innerHTML = `
      <div class="p-6 rounded-xl bg-slate-800/40 border border-slate-700 text-center space-y-2">
        <div class="inline-flex p-3 rounded-full bg-amber-500/10 text-amber-400 mb-1">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
        </div>
        <h4 class="text-sm font-bold text-slate-200">No Examination Records Found for ${escapeHtml(sess)} ${yr}</h4>
        <p class="text-xs text-slate-400 max-w-md mx-auto">Official grades for this semester have not been announced or gazetted yet. Examination results are published at the end of each academic term.</p>
      </div>
    `;
    return;
  }

  // Look for matching semester
  const match = data.semesters.find(s => Number(s.academic_year) === yr && String(s.term).toLowerCase() === sess.toLowerCase());

  if (!match) {
    outContainer.innerHTML = `
      <div class="p-6 rounded-xl bg-slate-800/40 border border-slate-700 text-center space-y-2">
        <div class="inline-flex p-3 rounded-full bg-amber-500/10 text-amber-400 mb-1">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
        </div>
        <h4 class="text-sm font-bold text-slate-200">No Examination Records Found for ${escapeHtml(sess)} ${yr}</h4>
        <p class="text-xs text-slate-400 max-w-md mx-auto">No examination results recorded for this specific session. Please choose another completed academic session or view your cumulative summary below.</p>
      </div>
    `;
    return;
  }

  // Render the matching semester result card
  let semHtml = `
    <div class="rounded-xl border border-sky-500/40 overflow-hidden bg-slate-800/60 shadow-lg space-y-0">
      <div class="bg-gradient-to-r from-sky-950/90 to-slate-800 px-4 py-3 flex flex-wrap justify-between items-center gap-2 border-b border-sky-500/30">
        <div class="flex items-center gap-2">
          <span class="px-2.5 py-1 bg-sky-500 text-slate-950 font-bold text-xs rounded-lg">Semester ${match.semester_number}</span>
          <span class="font-bold text-white text-sm">${match.term} ${match.academic_year} Official Gazetted Result</span>
        </div>
        <div class="text-xs space-x-3 text-slate-300">
          <span>SGPA: <strong class="text-sky-300 font-bold text-sm">${match.sgpa.toFixed(2)}</strong></span>
          <span>Earned CH: <strong class="text-emerald-300 font-bold">${match.earned_ch} / ${match.total_ch}</strong></span>
          <span>Percentage: <strong class="text-white">${match.percentage}%</strong></span>
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs text-slate-300">
          <thead class="bg-slate-900 text-slate-400 font-semibold border-b border-slate-700">
            <tr>
              <th class="py-2.5 px-3">Course Code</th>
              <th class="py-2.5 px-3">Course Title</th>
              <th class="py-2.5 px-2 text-center">CH</th>
              <th class="py-2.5 px-2 text-center">Assign</th>
              <th class="py-2.5 px-2 text-center">Quiz</th>
              <th class="py-2.5 px-2 text-center">Mid</th>
              <th class="py-2.5 px-2 text-center">Final</th>
              <th class="py-2.5 px-2 text-center">Total</th>
              <th class="py-2.5 px-2 text-center">%age</th>
              <th class="py-2.5 px-2 text-center">Grade</th>
              <th class="py-2.5 px-2 text-center">GP</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-700/50">
  `;

  match.courses.forEach(c => {
    const isF = c.grade === 'F';
    semHtml += `
      <tr class="hover:bg-slate-700/30">
        <td class="py-2 px-3 font-semibold text-sky-400 font-mono">${escapeHtml(c.courseCode)}</td>
        <td class="py-2 px-3 font-medium text-slate-200">${escapeHtml(c.title)}</td>
        <td class="py-2 px-2 text-center text-slate-300">${c.creditHours}</td>
        <td class="py-2 px-2 text-center text-slate-400">${c.assignmentMarks}</td>
        <td class="py-2 px-2 text-center text-slate-400">${c.quizMarks}</td>
        <td class="py-2 px-2 text-center text-slate-400">${c.midMarks}</td>
        <td class="py-2 px-2 text-center text-slate-400">${c.finalMarks}</td>
        <td class="py-2 px-2 text-center font-bold text-white">${c.marksObtained} / ${c.totalMarks}</td>
        <td class="py-2 px-2 text-center font-semibold text-slate-200">${c.percentage}%</td>
        <td class="py-2 px-2 text-center font-bold ${isF ? 'text-red-400 bg-red-950/40 rounded' : 'text-emerald-400'}">${escapeHtml(c.grade)}</td>
        <td class="py-2 px-2 text-center font-mono text-slate-300">${Number(c.gradePoint).toFixed(1)}</td>
      </tr>
    `;
  });

  semHtml += `</tbody></table></div></div>`;
  outContainer.innerHTML = semHtml;
};

async function loadResultsView(container) {
  try {
    const res = await fetch('/api/student/results');
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    window.__currentStudentResults = data;

    const cgpa = data.overallStats?.cgpa ? data.overallStats.cgpa.toFixed(2) : '0.00';
    const earnedCH = data.overallStats?.earnedCH || 0;
    const overallPercentage = data.overallStats?.overallPercentage || 0;
    const completedCount = data.semesters?.length || 0;

    let html = `
      <div class="space-y-6">
        <!-- Top Stats Banner -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="p-4 rounded-xl bg-slate-800/60 border border-slate-700">
            <span class="text-xs text-slate-400">Current CGPA</span>
            <p class="text-2xl font-bold text-sky-400">${cgpa}</p>
          </div>
          <div class="p-4 rounded-xl bg-slate-800/60 border border-slate-700">
            <span class="text-xs text-slate-400">Total Earned CH</span>
            <p class="text-2xl font-bold text-emerald-400">${earnedCH} CH</p>
          </div>
          <div class="p-4 rounded-xl bg-slate-800/60 border border-slate-700">
            <span class="text-xs text-slate-400">Overall Percentage</span>
            <p class="text-2xl font-bold text-amber-400">${overallPercentage}%</p>
          </div>
          <div class="p-4 rounded-xl bg-slate-800/60 border border-slate-700">
            <span class="text-xs text-slate-400">Completed Semesters</span>
            <p class="text-2xl font-bold text-indigo-400">${completedCount}</p>
          </div>
        </div>

        <!-- Term Result Selector (Image 2 style) -->
        <div class="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
          <div class="border-b border-slate-800 pb-2">
            <h4 class="text-sm font-bold text-white flex items-center gap-2">
              <svg class="w-4 h-4 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
              <span>Term Examination Result Lookup</span>
            </h4>
            <p class="text-xs text-slate-400 mt-0.5">Select Academic Year and Session Term to view official semester transcript</p>
          </div>

          <form id="result-term-form" onsubmit="event.preventDefault(); window.loadFilteredSemesterResult();" class="space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
              <div>
                <label class="block text-xs font-semibold text-slate-300 mb-1.5">Year: <span class="text-sky-400 font-bold">*</span></label>
                <select id="result-filter-year" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 transition shadow-inner">
                  <option value="2026">2026</option>
                  <option value="2025">2025</option>
                  <option value="2024">2024</option>
                  <option value="2023">2023</option>
                  <option value="2022">2022</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-300 mb-1.5">Session: <span class="text-sky-400 font-bold">*</span></label>
                <select id="result-filter-session" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 transition shadow-inner">
                  <option value="Fall">Fall</option>
                  <option value="Spring">Spring</option>
                  <option value="Summer">Summer</option>
                </select>
              </div>
            </div>
            <div>
              <button type="submit" id="btn-load-result" class="px-6 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold transition shadow-md flex items-center gap-2 cursor-pointer">
                <span>Load</span>
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
              </button>
            </div>
          </form>

          <!-- Dynamic Output of Filtered Result -->
          <div id="filtered-result-container" class="pt-2"></div>
        </div>
    `;

    // If student has completed semesters, show chart and complete breakdown
    if (completedCount > 0) {
      html += `
        <div class="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
          <h4 class="text-sm font-semibold text-slate-200 mb-3">Semester SGPA Progression</h4>
          <div class="h-56"><canvas id="sgpaChart"></canvas></div>
        </div>

        <div class="space-y-4">
          <h4 class="text-sm font-bold text-slate-200">Complete Academic History (${completedCount} Semesters)</h4>
      `;

      data.semesters.forEach(sem => {
        html += `
          <div class="rounded-xl border border-slate-700 overflow-hidden bg-slate-800/40">
            <div class="bg-slate-800 px-4 py-3 flex flex-wrap justify-between items-center gap-2 border-b border-slate-700">
              <span class="font-bold text-sky-300">Semester ${sem.semester_number} (${sem.term} ${sem.academic_year})</span>
              <div class="text-xs space-x-3 text-slate-300">
                <span>SGPA: <strong class="text-white">${sem.sgpa.toFixed(2)}</strong></span>
                <span>Earned CH: <strong class="text-white">${sem.earned_ch} / ${sem.total_ch}</strong></span>
                <span>Semester Marks: <strong class="text-white">${sem.percentage}%</strong></span>
              </div>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs text-slate-300">
                <thead class="bg-slate-900/60 text-slate-400 font-semibold border-b border-slate-700">
                  <tr>
                    <th class="py-2.5 px-3">Course Code</th>
                    <th class="py-2.5 px-3">Course Title</th>
                    <th class="py-2.5 px-2 text-center">CH</th>
                    <th class="py-2.5 px-2 text-center">Assign</th>
                    <th class="py-2.5 px-2 text-center">Quiz</th>
                    <th class="py-2.5 px-2 text-center">Mid</th>
                    <th class="py-2.5 px-2 text-center">Final</th>
                    <th class="py-2.5 px-2 text-center">Total</th>
                    <th class="py-2.5 px-2 text-center">%age</th>
                    <th class="py-2.5 px-2 text-center">Grade</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-700/50">
        `;

        sem.courses.forEach(c => {
          const isF = c.grade === 'F';
          html += `
            <tr class="hover:bg-slate-700/30">
              <td class="py-2 px-3 font-semibold text-slate-200">${escapeHtml(c.courseCode)}</td>
              <td class="py-2 px-3">${escapeHtml(c.title)}</td>
              <td class="py-2 px-2 text-center">${c.creditHours}</td>
              <td class="py-2 px-2 text-center text-slate-400">${c.assignmentMarks}</td>
              <td class="py-2 px-2 text-center text-slate-400">${c.quizMarks}</td>
              <td class="py-2 px-2 text-center text-slate-400">${c.midMarks}</td>
              <td class="py-2 px-2 text-center text-slate-400">${c.finalMarks}</td>
              <td class="py-2 px-2 text-center font-bold text-white">${c.marksObtained} / ${c.totalMarks}</td>
              <td class="py-2 px-2 text-center">${c.percentage}%</td>
              <td class="py-2 px-2 text-center font-bold ${isF ? 'text-red-500 bg-red-950/40 rounded' : 'text-sky-400'}">${escapeHtml(c.grade)}</td>
            </tr>
          `;
        });

        html += `</tbody></table></div></div>`;
      });
      html += `</div>`;
    } else {
      html += `
        <div class="p-6 rounded-xl bg-slate-800/40 border border-slate-700 text-center space-y-2">
          <p class="text-sm font-semibold text-slate-300">Current Academic Status: In Progress</p>
          <p class="text-xs text-slate-400">You are enrolled in your active semester coursework. Use the selector above to look up published term results or check your Registered Courses tile.</p>
        </div>
      `;
    }

    html += `</div>`;
    container.innerHTML = html;

    // Auto-select student's latest year/session in selector and trigger initial display
    const yearSelect = document.getElementById('result-filter-year');
    const sessionSelect = document.getElementById('result-filter-session');
    if (completedCount > 0 && data.semesters[completedCount - 1]) {
      const latest = data.semesters[completedCount - 1];
      if (yearSelect) yearSelect.value = String(latest.academic_year);
      if (sessionSelect) sessionSelect.value = latest.term;
      window.loadFilteredSemesterResult();
    } else if (data.student?.batchYear) {
      if (yearSelect) yearSelect.value = String(data.student.batchYear);
      if (sessionSelect) sessionSelect.value = 'Fall';
      window.loadFilteredSemesterResult();
    }

    // Render chart with safety
    try {
      if (typeof Chart !== 'undefined' && completedCount > 0) {
        const ctx = document.getElementById('sgpaChart')?.getContext('2d');
        if (ctx) {
          const isLight = document.documentElement.classList.contains('light');
          const gridColor = isLight ? '#E2E8F0' : '#334155';
          const textColor = isLight ? '#475569' : '#94A3B8';

          sgpaChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
              labels: data.chart.labels,
              datasets: [{
                label: 'SGPA',
                data: data.chart.data,
                backgroundColor: '#3B82F6',
                borderRadius: 6
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                y: {
                  min: 0,
                  max: 4.0,
                  grid: { color: gridColor },
                  ticks: { color: textColor }
                },
                x: {
                  grid: { display: false },
                  ticks: { color: textColor }
                }
              },
              plugins: {
                legend: { display: false }
              }
            }
          });
        }
      }
    } catch (chartErr) {
      console.warn('SGPA Chart load skipped:', chartErr);
    }

  } catch (err) {
    container.innerHTML = `<div class="p-6 text-red-400 text-xs">Failed to load results: ${err.message}</div>`;
  }
}

async function loadAttendanceView(container) {
  try {
    const res = await fetch('/api/student/attendance');
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    if (!data.courses || data.courses.length === 0) {
      container.innerHTML = `
        <div class="p-8 text-center text-slate-400 space-y-2">
          <p class="text-sm font-semibold">No attendance sessions logged yet.</p>
          <p class="text-xs">Faculty can upload attendance records from the Admin ERP.</p>
        </div>
      `;
      return;
    }

    currentAttendanceData = data;

    let html = `
      <div class="space-y-6">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="p-4 rounded-xl bg-slate-800/60 border border-slate-700">
            <span class="text-xs text-slate-400">Overall Attendance</span>
            <p class="text-2xl font-bold ${data.overall.isAtRisk ? 'text-red-400' : 'text-emerald-400'}">${data.overall.percentage}%</p>
          </div>
          <div class="p-4 rounded-xl bg-slate-800/60 border border-slate-700">
            <span class="text-xs text-slate-400">Classes Attended</span>
            <p class="text-2xl font-bold text-sky-400">${data.overall.present} / ${data.overall.total}</p>
          </div>
          <div class="p-4 rounded-xl bg-slate-800/60 border border-slate-700">
            <span class="text-xs text-slate-400">Absences Logged</span>
            <p class="text-2xl font-bold text-amber-400">${data.overall.absent}</p>
          </div>
          <div class="p-4 rounded-xl bg-slate-800/60 border border-slate-700">
            <span class="text-xs text-slate-400">Policy Threshold</span>
            <p class="text-2xl font-bold text-indigo-400">${data.overall.minimumAttendanceRequired}% Min</p>
          </div>
        </div>

        <div class="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
          <h4 class="text-sm font-semibold text-slate-200 mb-3">Month-wise Attendance Trend</h4>
          <div class="h-48"><canvas id="attendanceChart"></canvas></div>
        </div>

        <div class="space-y-4">
          <h4 class="text-sm font-semibold text-slate-200">Course Attendance Status</h4>
    `;

    data.courses.forEach(c => {
      const isRisk = c.isAtRisk;
      html += `
        <div class="p-4 rounded-xl bg-slate-800/40 border ${isRisk ? 'border-red-500/50 bg-red-950/10' : 'border-slate-700'} space-y-3">
          <div class="flex justify-between items-start">
            <div>
              <span class="font-bold text-slate-200">${c.course_code} - ${c.course_title}</span>
              <p class="text-xs text-slate-400">${c.present} Present | ${c.absent} Absent | ${c.leave} Leave | Total: ${c.total} Sessions</p>
            </div>
            <div class="text-right">
              <span class="inline-block px-2.5 py-1 text-xs font-bold rounded ${isRisk ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-emerald-500/20 text-emerald-400'}">
                ${c.percentage}% ${isRisk ? 'CRITICAL WARNING' : 'SAFE'}
              </span>
              <p class="text-xs text-slate-400 mt-1">Can miss: <strong class="text-white">${c.absencesAllowedNow}</strong> more class(es)</p>
            </div>
          </div>
          <div class="w-full bg-slate-700 rounded-full h-2.5 overflow-hidden">
            <div class="h-2.5 rounded-full ${isRisk ? 'bg-red-500' : 'bg-sky-500'}" style="width: ${c.percentage}%"></div>
          </div>
        </div>
      `;
    });

    html += `
        </div>

        <div class="p-4 rounded-xl bg-slate-800/40 border border-slate-700">
          <h4 class="text-sm font-semibold text-slate-200 mb-3">Daily Attendance Audit Log</h4>
          <div class="max-h-60 overflow-y-auto divide-y divide-slate-700/50 text-xs">
    `;

    (data.calendarRecords || []).slice(0, 30).forEach(r => {
      let badge = '<span class="text-emerald-400 font-bold">Present</span>';
      if (r.status === 'absent') badge = '<span class="text-red-400 font-bold">Absent</span>';
      if (r.status === 'leave') badge = '<span class="text-amber-400 font-bold">Leave</span>';

      html += `
        <div class="py-2 flex justify-between items-center text-slate-300">
          <div>
            <span class="font-semibold text-slate-200">${r.date}</span>
            <span class="text-slate-400 ml-2">(${r.course_code})</span>
          </div>
          <div>${badge}</div>
        </div>
      `;
    });

    html += `</div></div></div>`;
    container.innerHTML = html;

    try {
      if (typeof Chart !== 'undefined') {
        const ctx = document.getElementById('attendanceChart')?.getContext('2d');
        if (ctx) {
          const isLight = document.documentElement.classList.contains('light');
          const gridColor = isLight ? '#E2E8F0' : '#334155';
          const textColor = isLight ? '#475569' : '#94A3B8';

          attendanceChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
              labels: data.monthlyChart.labels,
              datasets: [{
                label: 'Attendance %',
                data: data.monthlyChart.data,
                borderColor: '#3B82F6',
                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                fill: true,
                tension: 0.3
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                y: {
                  min: 40,
                  max: 100,
                  grid: { color: gridColor },
                  ticks: { color: textColor }
                },
                x: {
                  grid: { display: false },
                  ticks: { color: textColor }
                }
              },
              plugins: {
                legend: { labels: { color: textColor } }
              }
            }
          });
        }
      }
    } catch (e) {
      console.warn('Attendance chart render skipped:', e);
    }

  } catch (err) {
    container.innerHTML = `<div class="p-6 text-red-400 text-xs">Failed to load attendance: ${err.message}</div>`;
  }
}

async function loadTranscriptView(container) {
  try {
    const res = await fetch('/api/student/transcript');
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    let html = `
      <div class="space-y-6">
        <div class="flex justify-end gap-3 no-print">
          <button onclick="window.print()" class="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-semibold flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
            Print
          </button>
          <a href="/api/student/transcript/pdf" target="_blank" class="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
            Download Official PDF
          </a>
        </div>

        <div class="p-8 rounded-xl bg-white text-slate-900 shadow-xl border border-slate-300 font-sans printable-document">
          <div class="text-center border-b-2 border-slate-900 pb-4">
            <h2 class="text-xl font-black text-[#1E3A8A] uppercase">${data.university.name}</h2>
            <p class="text-xs font-bold text-[#3B82F6]">OFFICE OF THE CONTROLLER OF EXAMINATIONS</p>
            <p class="text-[10px] text-slate-600">${data.university.city} | ${data.university.address}</p>
            <div class="mt-2 py-1 bg-[#1E3A8A] text-white font-bold text-xs uppercase tracking-wide">
              Official Interim Academic Transcript
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4 my-4 p-3 bg-slate-100 rounded text-xs">
            <div>
              <p><strong class="text-[#1E3A8A]">Student Name:</strong> ${data.student.name.toUpperCase()}</p>
              <p><strong class="text-[#1E3A8A]">Father's Name:</strong> ${data.student.father_name.toUpperCase()}</p>
              <p><strong class="text-[#1E3A8A]">Registration No:</strong> ${data.student.registration_no}</p>
            </div>
            <div>
              <p><strong class="text-[#1E3A8A]">Program:</strong> ${data.student.program_name || data.student.program_code}</p>
              <p><strong class="text-[#1E3A8A]">Batch:</strong> ${data.student.batch}</p>
              <p><strong class="text-[#1E3A8A]">Status:</strong> ${data.student.status || 'Active / Regular'}</p>
            </div>
          </div>

          <div class="space-y-4">
    `;

    (data.semesters || []).forEach(sem => {
      html += `
        <div class="border border-slate-300 rounded overflow-hidden">
          <div class="bg-slate-800 text-white px-3 py-1 text-xs font-bold flex justify-between">
            <span>SEMESTER ${sem.semester_number}</span>
            <span>SGPA: ${sem.sgpa.toFixed(2)} | CGPA: ${sem.cgpa.toFixed(2)} | Earned CH: ${sem.earned_ch}</span>
          </div>
          <table class="w-full text-left text-[11px]">
            <thead class="bg-slate-200 font-bold border-b border-slate-300">
              <tr>
                <th class="py-1 px-2">Course Code</th>
                <th class="py-1 px-2">Course Title</th>
                <th class="py-1 px-1 text-center">CH</th>
                <th class="py-1 px-2 text-center">Marks</th>
                <th class="py-1 px-1 text-center">%age</th>
                <th class="py-1 px-1 text-center">Grade</th>
                <th class="py-1 px-1 text-center">Points</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200">
      `;

      sem.courses.forEach(c => {
        html += `
          <tr>
            <td class="py-1 px-2 font-semibold">${c.courseCode}</td>
            <td class="py-1 px-2">${c.title}</td>
            <td class="py-1 px-1 text-center">${c.creditHours}</td>
            <td class="py-1 px-2 text-center">${c.marksObtained} / ${c.totalMarks}</td>
            <td class="py-1 px-1 text-center">${c.percentage}%</td>
            <td class="py-1 px-1 text-center font-bold ${c.grade === 'F' ? 'text-red-600' : 'text-[#1E3A8A]'}">${c.grade}</td>
            <td class="py-1 px-1 text-center">${c.gradePoint.toFixed(2)}</td>
          </tr>
        `;
      });

      html += `</tbody></table></div>`;
    });

    html += `
          </div>

          <div class="mt-6 p-3 bg-[#1E3A8A] text-white rounded text-xs flex justify-between items-center font-bold">
            <span>Required CH: ${data.student.total_ch_required || 130}</span>
            <span>Cumulative Earned CH: ${data.overallStats.earnedCH}</span>
            <span>Overall %: ${data.overallStats.overallPercentage}%</span>
            <span class="text-sm text-amber-300">FINAL CGPA: ${data.overallStats.cgpa.toFixed(2)}</span>
          </div>

          <div class="mt-12 pt-6 border-t border-slate-300 grid grid-cols-2 text-center text-xs">
            <div><p class="font-bold border-t border-slate-400 pt-1 inline-block px-8">Prepared & Verified By</p></div>
            <div><p class="font-bold border-t border-slate-400 pt-1 inline-block px-8">Controller of Examinations</p></div>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<div class="p-6 text-red-400 text-xs">Failed to load transcript: ${err.message}</div>`;
  }
}

async function loadRegisteredCoursesView(container) {
  try {
    const res = await fetch('/api/student/registered-courses');
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    if (!data.courses || data.courses.length === 0) {
      container.innerHTML = `
        <div class="p-8 text-center text-slate-400 space-y-2">
          <div class="inline-flex p-3 rounded-full bg-sky-500/10 text-sky-400 mb-1">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
          </div>
          <p class="text-sm font-semibold text-slate-200">No active course registrations found for Semester ${data.currentSemester || 1}.</p>
          <p class="text-xs text-slate-400">Course enrollment is managed by the Academic Registrar. Contact department office for enrollment slip.</p>
        </div>
      `;
      return;
    }

    const totalCH = data.courses.reduce((sum, c) => sum + (Number(c.credit_hours) || 3), 0);

    let html = `
      <div class="space-y-4">
        <div class="flex flex-wrap justify-between items-center gap-3 p-4 bg-slate-800/80 rounded-xl border border-slate-700">
          <div>
            <h4 class="text-sm font-bold text-white flex items-center gap-2">
              <svg class="w-4 h-4 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              <span>Current Registered Load (Semester ${data.currentSemester || 1})</span>
            </h4>
            <p class="text-xs text-slate-400 mt-0.5">Officially enrolled academic subjects for ongoing term</p>
          </div>
          <div class="flex items-center gap-2">
            <span class="px-3 py-1 bg-sky-500/20 text-sky-300 font-bold text-xs rounded-lg border border-sky-500/30">
              ${data.courses.length} Courses
            </span>
            <span class="px-3 py-1 bg-emerald-500/20 text-emerald-300 font-bold text-xs rounded-lg border border-emerald-500/30">
              ${totalCH} Credit Hours
            </span>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    `;

    data.courses.forEach(c => {
      const code = c.course_code || c.code || 'COURSE';
      const title = c.title || 'Subject Title';
      const ch = c.credit_hours || 3;
      const teacher = c.teacher_name || 'Department Faculty';
      const sec = c.section || 'A';
      const dept = c.department || 'Department of Computer Science';
      const lec = c.lecture_hours || 3;
      const lab = c.lab_hours || 0;

      html += `
        <div class="p-4 rounded-xl bg-slate-800/50 border border-slate-700 hover:border-sky-500/60 transition space-y-3">
          <div class="flex justify-between items-start">
            <span class="px-2.5 py-1 text-xs font-bold font-mono bg-sky-500/20 text-sky-400 rounded-lg border border-sky-500/30">${escapeHtml(code)}</span>
            <span class="px-2 py-0.5 text-xs font-semibold bg-slate-700 text-slate-200 rounded">${ch} CH</span>
          </div>
          <div>
            <h4 class="font-bold text-white text-sm leading-snug">${escapeHtml(title)}</h4>
            <p class="text-[11px] text-slate-400 mt-0.5">${escapeHtml(dept)}</p>
          </div>
          <div class="pt-2 border-t border-slate-700/60 text-xs text-slate-400 space-y-1">
            <div class="flex justify-between">
              <span>Instructor:</span>
              <strong class="text-slate-200">${escapeHtml(teacher)}</strong>
            </div>
            <div class="flex justify-between">
              <span>Section:</span>
              <strong class="text-slate-200">Section ${escapeHtml(sec)}</strong>
            </div>
            <div class="flex justify-between">
              <span>Schedule Hours:</span>
              <span class="text-slate-300 font-medium">${lec}h Lecture ${lab > 0 ? `+ ${lab}h Lab` : ''}</span>
            </div>
          </div>
        </div>
      `;
    });

    html += `</div></div>`;
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<div class="p-6 text-red-400 text-xs">Failed to load courses: ${err.message}</div>`;
  }
}

async function loadTimetableView(container) {
  try {
    const res = await fetch('/api/student/timetable');
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    if (!data.weeklySchedule || data.weeklySchedule.length === 0) {
      container.innerHTML = `<div class="p-8 text-center text-slate-400 text-xs">Timetable has not yet been uploaded.</div>`;
      return;
    }

    let html = `
      <div class="space-y-6">
        <div class="p-4 rounded-xl bg-sky-950/30 border border-sky-500/40 flex justify-between items-center">
          <div>
            <h4 class="font-bold text-sky-300">Today is ${data.currentDay}</h4>
            <p class="text-xs text-slate-300">${data.todayEventsCount} scheduled class(es) today</p>
          </div>
        </div>

        <div class="rounded-xl border border-slate-700 overflow-hidden bg-slate-800/40">
          <table class="w-full text-left text-xs text-slate-300">
            <thead class="bg-slate-900/60 text-slate-400 font-semibold border-b border-slate-700">
              <tr>
                <th class="py-2.5 px-3">Day</th>
                <th class="py-2.5 px-3">Time</th>
                <th class="py-2.5 px-3">Course</th>
                <th class="py-2.5 px-3">Instructor</th>
                <th class="py-2.5 px-3">Room</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-700/50">
    `;

    data.weeklySchedule.forEach(slot => {
      const isToday = slot.day_of_week === data.currentDay;
      html += `
        <tr class="${isToday ? 'bg-sky-500/10 font-medium' : 'hover:bg-slate-700/20'}">
          <td class="py-2.5 px-3 font-bold ${isToday ? 'text-sky-400' : 'text-slate-200'}">${slot.day_of_week}</td>
          <td class="py-2.5 px-3 text-slate-300">${slot.start_time.slice(0, 5)} - ${slot.end_time.slice(0, 5)}</td>
          <td class="py-2.5 px-3 font-semibold text-slate-200">${slot.course_code} - ${slot.course_title}</td>
          <td class="py-2.5 px-3 text-slate-400">${slot.teacher_name}</td>
          <td class="py-2.5 px-3 text-amber-300">${slot.room}</td>
        </tr>
      `;
    });

    html += `</tbody></table></div></div>`;
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<div class="p-6 text-red-400 text-xs">Failed to load timetable: ${err.message}</div>`;
  }
}

async function loadDegreeAuditView(container) {
  try {
    const res = await fetch('/api/student/degree-audit');
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    const a = data.audit;

    let html = `
      <div class="space-y-6">
        <div class="p-5 rounded-xl bg-slate-800/50 border border-slate-700 space-y-3">
          <div class="flex justify-between items-center text-xs">
            <span class="font-bold text-slate-200">Degree Completion Progress</span>
            <span class="font-bold text-sky-400">${a.progressPct}% Complete</span>
          </div>
          <div class="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
            <div class="h-3 rounded-full bg-gradient-to-r from-sky-500 to-emerald-400" style="width: ${a.progressPct}%"></div>
          </div>
          <div class="flex justify-between text-xs text-slate-400 pt-1">
            <span>Earned: <strong>${a.earnedCH} CH</strong></span>
            <span>Remaining: <strong>${a.remainingCH} CH</strong></span>
            <span>Required: <strong>${a.totalRequiredCH} CH</strong></span>
          </div>
        </div>

        <div class="space-y-3">
          <h4 class="text-sm font-semibold text-slate-200">Completed Courses (${a.completedCourses.length})</h4>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
    `;

    a.completedCourses.forEach(c => {
      html += `
        <div class="p-2.5 rounded-lg bg-slate-800/40 border border-slate-700 flex justify-between items-center">
          <div>
            <span class="font-bold text-slate-200">${c.code}</span>
            <span class="text-slate-400 ml-1">${c.title}</span>
          </div>
          <span class="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded font-bold">${c.grade} (${c.creditHours} CH)</span>
        </div>
      `;
    });

    html += `</div></div></div>`;
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<div class="p-6 text-red-400 text-xs">Failed to load degree audit: ${err.message}</div>`;
  }
}

async function loadPersonalDetailsView(container) {
  try {
    const res = await fetch('/api/student/personal-details');
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    const p = data.profile;
    container.innerHTML = `
      <div class="p-6 rounded-2xl bg-slate-900/80 border border-slate-700/80 space-y-6 text-xs">
        <div class="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <h4 class="text-base font-bold text-white flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>${escapeHtml(p.name)}</span>
            </h4>
            <p class="text-xs text-slate-400 mt-0.5 font-mono text-sky-400 font-semibold">${escapeHtml(p.registration_no)}</p>
          </div>
          <span class="px-3 py-1 rounded-lg text-xs font-bold ${p.status === 'Active' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-700 text-slate-300'}">
            ${escapeHtml(p.status || 'Active')}
          </span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <div class="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/60 space-y-1">
            <span class="text-[11px] font-medium text-slate-400">Full Name</span>
            <p class="text-sm font-bold text-white">${escapeHtml(p.name)}</p>
          </div>

          <div class="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/60 space-y-1">
            <span class="text-[11px] font-medium text-slate-400">Father's Name</span>
            <p class="text-sm font-bold text-white">${escapeHtml(p.father_name)}</p>
          </div>

          <div class="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/60 space-y-1">
            <span class="text-[11px] font-medium text-slate-400">Registration Number</span>
            <p class="text-sm font-bold text-sky-400 font-mono">${escapeHtml(p.registration_no)}</p>
          </div>

          <div class="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/60 space-y-1">
            <span class="text-[11px] font-medium text-slate-400">Student Contact Number</span>
            <p class="text-sm font-bold text-sky-300 font-mono flex items-center gap-1.5">
              <svg class="w-3.5 h-3.5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
              <span>${escapeHtml(p.phone || 'N/A')}</span>
            </p>
          </div>

          <div class="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/60 space-y-1">
            <span class="text-[11px] font-medium text-slate-400">Father's Contact Number</span>
            <p class="text-sm font-bold text-emerald-300 font-mono flex items-center gap-1.5">
              <svg class="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
              <span>${escapeHtml(p.father_phone || 'N/A')}</span>
            </p>
          </div>

          <div class="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/60 space-y-1">
            <span class="text-[11px] font-medium text-slate-400">Student Email / Gmail</span>
            <p class="text-sm font-bold text-amber-300 font-mono flex items-center gap-1.5 break-all">
              <svg class="w-3.5 h-3.5 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
              <span>${escapeHtml(p.email || 'N/A')}</span>
            </p>
          </div>

          <div class="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/60 space-y-1">
            <span class="text-[11px] font-medium text-slate-400">Academic Program</span>
            <p class="text-sm font-bold text-white">${escapeHtml(p.program_name || 'BS Computer Science')} (${escapeHtml(p.program_code || 'BSCS')})</p>
          </div>

          <div class="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/60 space-y-1">
            <span class="text-[11px] font-medium text-slate-400">Batch / Intake</span>
            <p class="text-sm font-bold text-white">Batch ${escapeHtml(p.batch || '')}</p>
          </div>

          <div class="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/60 space-y-1">
            <span class="text-[11px] font-medium text-slate-400">Current Semester</span>
            <p class="text-sm font-bold text-sky-400">Semester ${p.current_semester || 1}</p>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="p-6 text-red-400 text-xs">Failed to load profile: ${escapeHtml(err.message)}</div>`;
  }
}

async function loadAdmitCardView(container) {
  try {
    const res = await fetch('/api/student/admit-card');
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    let html = `
      <div class="space-y-6">
        <div class="flex justify-end gap-3 no-print">
          <button onclick="window.print()" class="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-semibold flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
            Print
          </button>
          <a href="/api/student/admit-card/pdf" target="_blank" class="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
            Download Admit Card PDF
          </a>
        </div>

        <div class="p-8 rounded-xl bg-white text-slate-900 shadow-xl border border-slate-300 font-sans printable-document">
          <div class="text-center border-b-2 border-slate-900 pb-3">
            <h2 class="text-xl font-black text-[#1E3A8A] uppercase">Ghani Technical & Islamic University</h2>
            <p class="text-xs font-bold text-[#3B82F6]">CONTROLLER OF EXAMINATIONS - ROLL NUMBER SLIP</p>
            <p class="text-[10px] text-slate-600">Sheikhupura Campus</p>
          </div>

          <div class="flex justify-between items-start my-4 p-4 bg-slate-50 border border-slate-200 rounded text-xs">
            <div class="space-y-1">
              <p><strong class="text-[#1E3A8A]">Candidate:</strong> ${data.student.name.toUpperCase()}</p>
              <p><strong class="text-[#1E3A8A]">Father's Name:</strong> ${data.student.father_name.toUpperCase()}</p>
              <p><strong class="text-[#1E3A8A]">Registration No:</strong> ${data.student.registration_no}</p>
              <p><strong class="text-[#1E3A8A]">Program:</strong> ${data.student.program_code} (${data.student.batch})</p>
            </div>
            <div class="w-24 h-28 border-2 border-dashed border-slate-400 bg-slate-100 flex flex-col items-center justify-center text-[10px] text-slate-500 text-center p-1">
              <span>PHOTO</span>
              <span>(Passport Photo)</span>
            </div>
          </div>

          <div class="mt-4 border border-slate-300 rounded overflow-hidden">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-800 text-white font-bold">
                <tr>
                  <th class="py-2 px-3">Course Code</th>
                  <th class="py-2 px-3">Course Title</th>
                  <th class="py-2 px-3">Date</th>
                  <th class="py-2 px-3">Time</th>
                  <th class="py-2 px-3">Room</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200">
      `;

      (data.examSchedule || []).forEach(item => {
        html += `
          <tr>
            <td class="py-2 px-3 font-bold">${item.course_code}</td>
            <td class="py-2 px-3">${item.course_title}</td>
            <td class="py-2 px-3">${item.exam_date}</td>
            <td class="py-2 px-3">${item.start_time.slice(0, 5)} - ${item.end_time.slice(0, 5)}</td>
            <td class="py-2 px-3 font-semibold text-[#1E3A8A]">${item.room}</td>
          </tr>
        `;
      });

      html += `</tbody></table></div></div></div>`;
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<div class="p-6 text-red-400 text-xs">Failed to load admit card: ${err.message}</div>`;
  }
}

function loadAiAssistantView(container) {
  container.innerHTML = `
    <div class="flex flex-col h-[520px]">
      <div class="flex flex-wrap gap-2 pb-3 border-b border-slate-700/60 mb-3 text-xs">
        <button onclick="window.sendQuickPrompt('What is my current CGPA and how many credit hours have I earned?')" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-sky-300 rounded-full border border-slate-700">What is my CGPA?</button>
        <button onclick="window.sendQuickPrompt('Which subject am I weakest in and what is my grade?')" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-sky-300 rounded-full border border-slate-700">Which subject am I weakest in?</button>
        <button onclick="window.sendQuickPrompt('How many classes can I still miss before dropping below 75%?')" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-sky-300 rounded-full border border-slate-700">How many classes can I miss?</button>
        <button onclick="window.sendQuickPrompt('Meri attendance aur grades kaisay chal rahay hain? (Roman Urdu)')" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-full border border-slate-700">Roman Urdu Advice</button>
      </div>

      <div id="ai-chat-messages" class="flex-1 overflow-y-auto space-y-3 p-2 text-xs">
        <div class="flex items-start gap-2">
          <div class="w-7 h-7 rounded-full bg-sky-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">AI</div>
          <div class="bg-slate-800 p-3 rounded-xl rounded-tl-none border border-slate-700 text-slate-200 max-w-[85%] leading-relaxed">
            Assalam-o-Alaikum ${currentStudent ? currentStudent.name : ''}! I am your official GTIU Academic Advisor. I have access to your verified academic records, results, and attendance. How can I assist you with your studies today?
          </div>
        </div>
      </div>

      <form id="ai-chat-form" onsubmit="window.handleSendAiMessage(event)" class="mt-3 flex gap-2">
        <input type="text" id="ai-chat-input" placeholder="Ask about your grades, attendance, exam prep (English or Roman Urdu)..." class="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500" />
        <button type="submit" id="ai-send-btn" class="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1">
          <span>Send</span>
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
        </button>
      </form>
    </div>
  `;
}

async function loadAiInsightsView(container) {
  try {
    const res = await fetch('/api/student/ai/insights');
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    const ins = data.insights;

    let html = `
      <div class="space-y-6">
        <div class="p-5 rounded-xl bg-gradient-to-r from-sky-950/60 to-indigo-950/40 border border-sky-500/30 space-y-3">
          <div class="flex justify-between items-center">
            <span class="text-xs font-bold text-sky-300">Executive Academic Assessment</span>
            <span class="px-3 py-1 text-xs font-bold rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/40">${ins.status_badge || 'Good Standing'}</span>
          </div>
          <p class="text-sm text-slate-200 leading-relaxed">${ins.summary}</p>
        </div>

        <div class="p-5 rounded-xl bg-slate-800/50 border border-slate-700 space-y-3">
          <h4 class="text-xs font-bold text-slate-300 uppercase tracking-wider">Tailored Academic Recommendations</h4>
          <ul class="space-y-2 text-xs text-slate-300">
    `;

    (ins.suggestions || []).forEach(tip => {
      html += `
        <li class="flex items-start gap-2">
          <span class="text-sky-400 font-bold mt-0.5">•</span>
          <span>${tip}</span>
        </li>
      `;
    });

    html += `</ul></div></div>`;
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<div class="p-6 text-red-400 text-xs">Failed to load insights: ${err.message}</div>`;
  }
}

function loadWhatIfView(container) {
  container.innerHTML = `
    <div class="space-y-6">
      <p class="text-xs text-slate-400">
        Choose hypothetical courses and your target letter grades to simulate your future SGPA and projected CGPA.
        <strong>All GPAs and quality points are calculated in deterministic code</strong>, with AI advisory guidance.
      </p>

      <div class="space-y-3 bg-slate-800/40 p-4 rounded-xl border border-slate-700">
        <h4 class="text-xs font-bold text-slate-200">Simulate Upcoming Semester Courses</h4>
        <div id="whatif-courses-list" class="space-y-2">
          <div class="grid grid-cols-12 gap-2 text-xs">
            <input type="text" value="CS401 - Operating Systems" readonly class="col-span-6 bg-slate-800 text-slate-300 border border-slate-700 rounded px-2 py-1.5" />
            <input type="number" value="4" readonly class="col-span-2 bg-slate-800 text-slate-300 border border-slate-700 rounded px-2 py-1.5 text-center" />
            <select class="sim-grade col-span-4 bg-slate-800 text-white border border-slate-700 rounded px-2 py-1.5" data-ch="4" data-code="CS401">
              <option value="A">Grade A (4.00)</option>
              <option value="A-">Grade A- (3.67)</option>
              <option value="B+">Grade B+ (3.33)</option>
              <option value="B" selected>Grade B (3.00)</option>
              <option value="C">Grade C (2.00)</option>
              <option value="F">Grade F (0.00)</option>
            </select>
          </div>
          <div class="grid grid-cols-12 gap-2 text-xs">
            <input type="text" value="CS402 - Analysis of Algorithms" readonly class="col-span-6 bg-slate-800 text-slate-300 border border-slate-700 rounded px-2 py-1.5" />
            <input type="number" value="3" readonly class="col-span-2 bg-slate-800 text-slate-300 border border-slate-700 rounded px-2 py-1.5 text-center" />
            <select class="sim-grade col-span-4 bg-slate-800 text-white border border-slate-700 rounded px-2 py-1.5" data-ch="3" data-code="CS402">
              <option value="A" selected>Grade A (4.00)</option>
              <option value="A-">Grade A- (3.67)</option>
              <option value="B+">Grade B+ (3.33)</option>
              <option value="B">Grade B (3.00)</option>
              <option value="C">Grade C (2.00)</option>
              <option value="F">Grade F (0.00)</option>
            </select>
          </div>
          <div class="grid grid-cols-12 gap-2 text-xs">
            <input type="text" value="CS403 - Computer Networks" readonly class="col-span-6 bg-slate-800 text-slate-300 border border-slate-700 rounded px-2 py-1.5" />
            <input type="number" value="4" readonly class="col-span-2 bg-slate-800 text-slate-300 border border-slate-700 rounded px-2 py-1.5 text-center" />
            <select class="sim-grade col-span-4 bg-slate-800 text-white border border-slate-700 rounded px-2 py-1.5" data-ch="4" data-code="CS403">
              <option value="A">Grade A (4.00)</option>
              <option value="A-">Grade A- (3.67)</option>
              <option value="B+" selected>Grade B+ (3.33)</option>
              <option value="B">Grade B (3.00)</option>
              <option value="C">Grade C (2.00)</option>
              <option value="F">Grade F (0.00)</option>
            </select>
          </div>
          <div class="grid grid-cols-12 gap-2 text-xs">
            <input type="text" value="AI401 - Artificial Intelligence" readonly class="col-span-6 bg-slate-800 text-slate-300 border border-slate-700 rounded px-2 py-1.5" />
            <input type="number" value="3" readonly class="col-span-2 bg-slate-800 text-slate-300 border border-slate-700 rounded px-2 py-1.5 text-center" />
            <select class="sim-grade col-span-4 bg-slate-800 text-white border border-slate-700 rounded px-2 py-1.5" data-ch="3" data-code="AI401">
              <option value="A" selected>Grade A (4.00)</option>
              <option value="A-">Grade A- (3.67)</option>
              <option value="B+">Grade B+ (3.33)</option>
              <option value="B">Grade B (3.00)</option>
              <option value="C">Grade C (2.00)</option>
              <option value="F">Grade F (0.00)</option>
            </select>
          </div>
        </div>

        <button onclick="window.runWhatIfSimulation()" class="w-full mt-3 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold transition">
          Run What-If Calculation
        </button>
      </div>

      <div id="whatif-result-area" class="hidden space-y-4">
        <div class="grid grid-cols-3 gap-3 text-center">
          <div class="p-3 rounded-lg bg-slate-800 border border-slate-700">
            <span class="text-[10px] text-slate-400">Simulated SGPA</span>
            <p id="sim-sgpa-val" class="text-xl font-bold text-sky-400">0.00</p>
          </div>
          <div class="p-3 rounded-lg bg-slate-800 border border-slate-700">
            <span class="text-[10px] text-slate-400">Previous CGPA</span>
            <p id="sim-prev-cgpa" class="text-xl font-bold text-slate-300">0.00</p>
          </div>
          <div class="p-3 rounded-lg bg-slate-800 border border-slate-700">
            <span class="text-[10px] text-slate-400">Projected New CGPA</span>
            <p id="sim-new-cgpa" class="text-xl font-bold text-emerald-400">0.00</p>
          </div>
        </div>

        <div class="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
          <h4 class="text-xs font-bold text-sky-300 mb-1">AI Academic Advice</h4>
          <p id="sim-ai-advice" class="text-xs text-slate-300 leading-relaxed"></p>
        </div>
      </div>
    </div>
  `;

  window.runWhatIfSimulation();
}

function setupEventListeners() {
  const loginForm = document.getElementById('student-login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errBox = document.getElementById('login-error-msg');
      if (errBox) errBox.classList.add('hidden');

      const name = document.getElementById('login-student-name').value;
      const father_name = document.getElementById('login-father-name').value;
      const registration_no = document.getElementById('login-reg-no').value;
      const extra_field = document.getElementById('login-extra-field')?.value || '';

      const submitBtn = document.getElementById('login-submit-btn');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = 'Verifying with Registrar...';
      }

      try {
        const res = await fetch('/api/student/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, father_name, registration_no, extra_field })
        });
        const data = await res.json();

        if (data.success && data.student) {
          currentStudent = data.student;
          showPortalApp();
          loadDashboard();
        } else {
          if (errBox) {
            errBox.innerText = data.error || 'Authentication failed.';
            errBox.classList.remove('hidden');
          }
        }
      } catch (err) {
        if (errBox) {
          errBox.innerText = 'Network error during login.';
          errBox.classList.remove('hidden');
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerText = 'Sign In to Portal';
        }
      }
    });
  }

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await fetch('/api/student/logout', { method: 'POST' });
        window.location.reload();
      } catch (e) {
        window.location.reload();
      }
    });
  }

  // Hidden admin shortcut: Ctrl+Shift+A or Alt+A
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') || (e.altKey && e.key.toLowerCase() === 'a')) {
      e.preventDefault();
      window.location.href = '/admin';
    }
  });

  // Hidden admin shortcut: Triple-click logo
  let logoClicks = 0;
  let lastLogoClick = 0;
  const logoEls = document.querySelectorAll('header img, #logo-fallback-nav');
  logoEls.forEach(el => {
    el.addEventListener('click', () => {
      const now = Date.now();
      if (now - lastLogoClick < 1000) {
        logoClicks++;
        if (logoClicks >= 3) {
          window.location.href = '/admin';
        }
      } else {
        logoClicks = 1;
      }
      lastLogoClick = now;
    });
  });

  // Explicit tile listeners
  const tileCourses = document.getElementById('tile-registered-courses');
  if (tileCourses) {
    tileCourses.addEventListener('click', (e) => {
      e.preventDefault();
      window.openView('registered-courses');
    });
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag] || tag));
}

function formatMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/•\s+(.*)/g, '<li class="ml-4 list-disc">$1</li>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
}
