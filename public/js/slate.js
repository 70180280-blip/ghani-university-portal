/**
 * Ghani University / UOL Slate LMS Frontend Engine
 * Faithful recreation of The University of Lahore Moodle LMS
 * Features: Dashboard, My courses, Course Details, Calendar, Timeline, & Grading
 */

(function () {
  'use strict';

  // Global State
  window.Slate = {
    currentTab: 'courses', // 'dashboard', 'courses', 'course-detail'
    currentCourseSubTab: 'course', // 'course', 'participants', 'grades', 'competencies'
    currentFilter: 'all',
    currentSort: 'name',
    currentViewMode: 'cards',
    searchQuery: '',
    selectedCourseId: 'AI-301',
    calendarDate: new Date(2026, 10, 16), // Nov 16, 2026 matching screenshots
    calendarEvents: [
      {
        id: 1,
        title: 'Mid Term Exams',
        date: '2026-11-09',
        type: 'exam',
        badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
        course: 'All Courses',
        description: 'Mid Term Examination Week begins across all undergraduate departments.'
      },
      {
        id: 2,
        title: 'Assignment-2 Due',
        date: '2026-11-20',
        type: 'assignment',
        badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
        course: 'Computer Architecture-BSES Section D',
        description: 'Submission deadline for Pipelining Hazard Analysis & Cache Design.'
      },
      {
        id: 3,
        title: 'SOC Assignment',
        date: '2026-11-30',
        type: 'assignment',
        badgeClass: 'bg-orange-100 text-[#e0533c] dark:bg-orange-950/60 dark:text-orange-300',
        course: 'Introduction to Artificial Intelligence-5th BSES Section D',
        description: 'Training Machine Learning Models on Three Data Modalities submission deadline.'
      }
    ],
    timelineItems: [
      {
        id: 1,
        title: 'Training Machine Learning Models on Three Data Modalities',
        course: 'Introduction to Artificial Intelligence-5th BSES Section D',
        dueDate: 'Monday, 30 November 2026, 12:00 AM',
        icon: '📝',
        status: 'due',
        badge: 'Due 30 Nov'
      },
      {
        id: 2,
        title: 'Assignment 2: Cache Memory & Pipelining Simulator',
        course: 'Computer Architecture-BSES Section D',
        dueDate: 'Friday, 20 November 2026, 11:59 PM',
        icon: '💻',
        status: 'due',
        badge: 'Due 20 Nov'
      },
      {
        id: 3,
        title: 'Lab Report 04: ARM Cortex-M Assembly Syntax',
        course: 'Embedded Software System Lab-BSES Section D',
        dueDate: 'Wednesday, 25 November 2026, 5:00 PM',
        icon: '🔬',
        status: 'due',
        badge: 'Due 25 Nov'
      }
    ],
    courses: [
      {
        id: 'CA-301',
        title: 'Computer Architecture-BSES Section D',
        department: 'Department of Intelligent Systems',
        instructor: 'Muhammad Wisal',
        avatarText: 'MW',
        coverClass: 'card-cover-blue',
        status: 'inprogress',
        starred: false
      },
      {
        id: 'CNS-302',
        title: 'Cyber Networks and Security-5th BSES Section D',
        department: 'Department of Intelligent Systems',
        instructor: 'Engr. Haris Khan',
        avatarText: 'HK',
        coverClass: 'card-cover-cyan',
        status: 'inprogress',
        starred: true
      },
      {
        id: 'DSA-201',
        title: 'Data Structures and Algorithms-BSES Section D',
        department: 'Department of Intelligent Systems',
        instructor: 'Atique Ur Rahman',
        avatarText: 'A',
        coverClass: 'card-cover-azure',
        status: 'inprogress',
        starred: false
      },
      {
        id: 'DSD-202',
        title: 'Digital System Design-BSES Section D',
        department: 'Department of Intelligent Systems',
        instructor: 'Abdul Hannan',
        avatarText: 'A',
        coverClass: 'card-cover-purple',
        status: 'inprogress',
        starred: false
      },
      {
        id: 'EDA-203',
        title: 'Electronic Devices and Applications-BSES Section D',
        department: 'Department of Intelligent Systems',
        instructor: 'Muhammad Wisal',
        avatarText: 'MW',
        coverClass: 'card-cover-green',
        status: 'inprogress',
        starred: false
      },
      {
        id: 'ESA-303',
        title: 'Embedded System Architecture-5th BSES Section D',
        department: 'Department of Intelligent Systems',
        instructor: 'Dr. Zeeshan Haider',
        avatarText: 'ZH',
        coverClass: 'card-cover-blue',
        status: 'inprogress',
        starred: false
      },
      {
        id: 'ESSL-304',
        title: 'Embedded Software System Lab-BSES Section D',
        department: 'Department of Intelligent Systems',
        instructor: 'Abdul Hannan',
        avatarText: 'A',
        coverClass: 'card-cover-azure',
        status: 'inprogress',
        starred: false
      },
      {
        id: 'ESD-305',
        title: 'Embedded Systems Development-5th BSES Section D',
        department: 'Department of Intelligent Systems',
        instructor: 'Layaeq Layaeq Ali',
        avatarText: 'L',
        coverClass: 'card-cover-teal',
        status: 'inprogress',
        starred: false
      },
      {
        id: 'ICP-101',
        title: 'Ideology and Constitution of Pakistan',
        department: 'Digital Courses - Summer 2026',
        instructor: 'Prof. Sajjad Ahmed',
        avatarText: 'SA',
        coverClass: 'card-cover-pakistan',
        status: 'past',
        starred: false
      },
      {
        id: 'AI-301',
        title: 'Introduction to Artificial Intelligence-5th BSES Section D',
        department: 'Department of Intelligent Systems',
        instructor: 'Dr. Tariq Mahmood',
        avatarText: 'TM',
        coverClass: 'card-cover-pink',
        status: 'inprogress',
        starred: true
      },
      {
        id: 'CS-201',
        title: 'Discrete Structures',
        department: 'Department of Computer Science',
        instructor: 'Dr. Amjad Farooq',
        avatarText: 'AF',
        coverClass: 'card-cover-cyan',
        status: 'past',
        starred: false
      },
      {
        id: 'CS-301',
        title: 'Database Systems',
        department: 'Department of Computer Science',
        instructor: 'Engr. Noman Ali',
        avatarText: 'NA',
        coverClass: 'card-cover-purple',
        status: 'inprogress',
        starred: false
      }
    ],
    participants: [
      { reg: '418414', name: 'Muhammad Ahmed', role: 'Student', status: 'Active (2 mins ago)' },
      { reg: '418415', name: 'Ali Hassan', role: 'Student', status: 'Active (1 hour ago)' },
      { reg: '418416', name: 'Usman Tariq', role: 'Student', status: 'Active (Today)' },
      { reg: '418417', name: 'Hamza Khalid', role: 'Student', status: 'Active (Yesterday)' },
      { reg: '418418', name: 'Bilal Ahmad', role: 'Student', status: 'Active (Today)' },
      { reg: '418419', name: 'Muhammad Ahmed', role: 'Student', status: 'Active (3 days ago)' },
      { reg: '418420', name: 'Mmuneed', role: 'Student', status: 'Active (Today)' },
      { reg: '418421', name: 'Usman Tariq', role: 'Student', status: 'Active (5 days ago)' },
      { reg: '418422', name: 'Salman khan', role: 'Student', status: 'Active (Yesterday)' },
      { reg: '418423', name: 'Zeeshan Khan', role: 'Student', status: 'Active (Today)' },
      { reg: '418424', name: 'Wajid Ali', role: 'Student', status: 'Active (4 hours ago)' },
      { reg: '418425', name: 'Hassan Khan', role: 'Student', status: 'Active (Today)' },
      { reg: 'T-1002', name: 'Dr. Tariq Mahmood', role: 'Teacher / Instructor', status: 'Active (Now)' }
    ]
  };

  const S = window.Slate;

  // Helper: Escape HTML
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Toast Notification
  window.showToast = function (message, type = 'success') {
    let box = document.getElementById('slate-toast');
    if (!box) {
      box = document.createElement('div');
      box.id = 'slate-toast';
      box.className = 'fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none';
      document.body.appendChild(box);
    }
    const item = document.createElement('div');
    item.className = `pointer-events-auto px-4 py-3 rounded-xl shadow-2xl border text-xs font-bold flex items-center gap-2 transition-all transform duration-300 translate-y-2 opacity-0 ${
      type === 'success' ? 'bg-[#e0533c] text-white border-orange-400' : 'bg-red-600 text-white border-red-400'
    }`;
    item.innerHTML = `<span>${type === 'success' ? '✓' : '⚠️'}</span><span>${escapeHtml(message)}</span>`;
    box.appendChild(item);

    requestAnimationFrame(() => item.classList.remove('translate-y-2', 'opacity-0'));
    setTimeout(() => {
      item.classList.add('translate-y-2', 'opacity-0');
      setTimeout(() => item.remove(), 300);
    }, 3500);
  };

  // Switch Main Slate Tabs (Dashboard, My courses, Course Detail)
  window.switchSlateTab = function (tab) {
    S.currentTab = tab;

    const viewCourses = document.getElementById('slate-view-courses');
    const viewDashboard = document.getElementById('slate-view-dashboard');
    const viewDetail = document.getElementById('slate-view-course-detail');
    const navCourses = document.getElementById('nav-btn-courses');
    const navDashboard = document.getElementById('nav-btn-dashboard');

    if (viewCourses) viewCourses.classList.add('hidden');
    if (viewDashboard) viewDashboard.classList.add('hidden');
    if (viewDetail) viewDetail.classList.add('hidden');

    if (navCourses) navCourses.classList.remove('active');
    if (navDashboard) navDashboard.classList.remove('active');

    if (tab === 'courses') {
      if (viewCourses) viewCourses.classList.remove('hidden');
      if (navCourses) navCourses.classList.add('active');
      window.renderCourseCards();
    } else if (tab === 'dashboard') {
      if (viewDashboard) viewDashboard.classList.remove('hidden');
      if (navDashboard) navDashboard.classList.add('active');
      window.renderTimeline();
      window.renderCalendar();
    } else if (tab === 'course-detail') {
      if (viewDetail) viewDetail.classList.remove('hidden');
      if (navCourses) navCourses.classList.add('active');
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Filter Courses by sub-pill
  window.filterCourses = function (filter) {
    S.currentFilter = filter;
    document.querySelectorAll('.uol-filter-pill').forEach(pill => {
      if (pill.getAttribute('data-filter') === filter) {
        pill.classList.add('active');
      } else {
        pill.classList.remove('active');
      }
    });
    window.renderCourseCards();
  };

  // Search Courses live text input
  window.searchCourses = function (query) {
    S.searchQuery = (query || '').toLowerCase().trim();
    window.renderCourseCards();
  };

  // Sort Courses
  window.sortCourses = function (sortBy) {
    S.currentSort = sortBy;
    window.renderCourseCards();
  };

  // Set View Mode (cards, list, summary)
  window.setViewMode = function (mode) {
    S.currentViewMode = mode;
    ['cards', 'list', 'summary'].forEach(m => {
      const btn = document.getElementById(`btn-view-${m}`);
      if (!btn) return;
      if (m === mode) {
        btn.className = 'p-1.5 rounded-lg text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 shadow-sm';
      } else {
        btn.className = 'p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition';
      }
    });
    window.renderCourseCards();
  };

  // Render Course Cards
  window.renderCourseCards = function () {
    const container = document.getElementById('courses-grid-container');
    if (!container) return;

    let list = [...S.courses];

    // Apply Filter
    if (S.currentFilter === 'inprogress') {
      list = list.filter(c => c.status === 'inprogress');
    } else if (S.currentFilter === 'past') {
      list = list.filter(c => c.status === 'past');
    } else if (S.currentFilter === 'future') {
      list = list.filter(c => c.status === 'future');
    } else if (S.currentFilter === 'starred') {
      list = list.filter(c => c.starred);
    } else if (S.currentFilter === 'removed') {
      list = [];
    }

    // Apply Search
    if (S.searchQuery) {
      list = list.filter(c =>
        c.title.toLowerCase().includes(S.searchQuery) ||
        c.department.toLowerCase().includes(S.searchQuery) ||
        c.instructor.toLowerCase().includes(S.searchQuery)
      );
    }

    // Apply Sort
    if (S.currentSort === 'name') {
      list.sort((a, b) => a.title.localeCompare(b.title));
    }

    if (list.length === 0) {
      container.className = 'col-span-full py-16 text-center bg-white dark:bg-[#131c31] rounded-3xl border border-slate-200 dark:border-slate-800';
      container.innerHTML = `
        <div class="w-16 h-16 rounded-2xl bg-orange-50 dark:bg-orange-950/40 text-[#e0533c] flex items-center justify-center text-2xl mx-auto mb-3">
          🔍
        </div>
        <h3 class="text-base font-bold text-slate-800 dark:text-slate-200">No courses match your criteria</h3>
        <p class="text-xs text-slate-400 mt-1">Try clearing your search query or switching filters.</p>
        <button onclick="window.filterCourses('all')" class="mt-4 px-4 py-2 bg-[#e0533c] text-white rounded-xl text-xs font-bold hover:bg-[#c9432d] transition">
          View All Courses
        </button>
      `;
      return;
    }

    // Render Cards Mode
    if (S.currentViewMode === 'cards') {
      container.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pt-2';
      container.innerHTML = list.map(c => `
        <div class="bg-white dark:bg-[#131c31] border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col group">
          <!-- Geometric Top Cover Banner -->
          <div class="h-32 ${c.coverClass} relative p-3 flex justify-end items-start">
            <button onclick="window.toggleCourseMenu(event, '${c.id}')" class="w-7 h-7 rounded-lg bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-200 hover:bg-white flex items-center justify-center text-xs font-black shadow transition" title="Course options">
              &bull;&bull;&bull;
            </button>
          </div>

          <!-- Card Body -->
          <div class="p-5 flex-1 flex flex-col justify-between space-y-4">
            <div class="space-y-2">
              <span class="inline-block px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-orange-50 dark:bg-orange-950/40 text-[#e0533c] dark:text-orange-300">
                ${escapeHtml(c.department)}
              </span>
              <h3 class="text-sm font-bold text-slate-900 dark:text-white leading-snug group-hover:text-[#e0533c] transition cursor-pointer" onclick="window.viewCourseDetail('${c.id}')">
                ${escapeHtml(c.title)}
              </h3>
            </div>

            <!-- Instructor & View Button -->
            <div class="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
              <div class="flex items-center gap-2 min-w-0">
                <div class="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-black flex items-center justify-center shrink-0">
                  ${escapeHtml(c.avatarText)}
                </div>
                <span class="text-xs text-slate-600 dark:text-slate-400 truncate font-medium">
                  ${escapeHtml(c.instructor)}
                </span>
              </div>
              <button onclick="window.viewCourseDetail('${c.id}')" class="px-3.5 py-1.5 rounded-xl border border-[#e0533c] text-[#e0533c] hover:bg-[#fff1ee] dark:hover:bg-orange-950/20 text-xs font-bold transition shrink-0">
                View Course
              </button>
            </div>
          </div>
        </div>
      `).join('');
    } else if (S.currentViewMode === 'list') {
      container.className = 'space-y-3 pt-2';
      container.innerHTML = list.map(c => `
        <div class="bg-white dark:bg-[#131c31] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center justify-between gap-4 hover:shadow-md transition">
          <div class="flex items-center gap-4 min-w-0">
            <div class="w-12 h-12 rounded-xl ${c.coverClass} shrink-0"></div>
            <div class="min-w-0">
              <span class="text-[10px] font-bold text-[#e0533c] uppercase">${escapeHtml(c.department)}</span>
              <h3 class="text-sm font-bold text-slate-900 dark:text-white truncate cursor-pointer hover:text-[#e0533c]" onclick="window.viewCourseDetail('${c.id}')">
                ${escapeHtml(c.title)}
              </h3>
              <p class="text-xs text-slate-500">${escapeHtml(c.instructor)}</p>
            </div>
          </div>
          <button onclick="window.viewCourseDetail('${c.id}')" class="px-4 py-2 rounded-xl border border-[#e0533c] text-[#e0533c] hover:bg-[#fff1ee] text-xs font-bold shrink-0">
            View Course
          </button>
        </div>
      `).join('');
    } else {
      // Summary Mode
      container.className = 'space-y-4 pt-2';
      container.innerHTML = list.map(c => `
        <div class="bg-white dark:bg-[#131c31] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-2">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-bold text-slate-900 dark:text-white cursor-pointer hover:text-[#e0533c]" onclick="window.viewCourseDetail('${c.id}')">
              ${escapeHtml(c.title)}
            </h3>
            <span class="text-xs text-[#e0533c] font-bold">${escapeHtml(c.department)}</span>
          </div>
          <p class="text-xs text-slate-500">Instructor: <strong>${escapeHtml(c.instructor)}</strong> &bull; Code: <strong>${escapeHtml(c.id)}</strong></p>
          <div class="flex justify-end pt-1">
            <button onclick="window.viewCourseDetail('${c.id}')" class="px-4 py-1.5 rounded-xl bg-[#e0533c] text-white text-xs font-bold hover:bg-[#c9432d]">
              Open Course
            </button>
          </div>
        </div>
      `).join('');
    }
  };

  // View Specific Course Detail
  window.viewCourseDetail = function (courseId) {
    S.selectedCourseId = courseId;
    const course = S.courses.find(c => c.id === courseId) || S.courses[9]; // Defaults to AI course

    const titleEl = document.getElementById('detail-course-title');
    const instructorEl = document.getElementById('detail-instructor-name');
    if (titleEl) titleEl.textContent = course.title;
    if (instructorEl) instructorEl.textContent = course.instructor;

    window.switchSlateTab('course-detail');
    window.switchCourseSubTab('course');
  };

  // Course Sub-tab Switching (Course, Participants, Grades, Competencies)
  window.switchCourseSubTab = function (subtab) {
    S.currentCourseSubTab = subtab;

    ['course', 'participants', 'grades', 'competencies'].forEach(st => {
      const btn = document.getElementById(`subtab-${st}`);
      const view = document.getElementById(`course-subview-${st === 'course' ? 'content' : st}`);
      if (btn) {
        if (st === subtab) {
          btn.className = 'uol-nav-link active pb-2 font-bold text-[#e0533c]';
        } else {
          btn.className = 'uol-nav-link text-slate-500 dark:text-slate-400 pb-2';
        }
      }
      if (view) {
        if (st === subtab) {
          view.classList.remove('hidden');
        } else {
          view.classList.add('hidden');
        }
      }
    });

    if (subtab === 'participants') {
      window.renderCourseParticipants();
    }
  };

  // Render Course Participants Table
  window.renderCourseParticipants = function () {
    const list = document.getElementById('course-participants-list');
    if (!list) return;

    list.innerHTML = S.participants.map(p => `
      <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50">
        <td class="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">${escapeHtml(p.reg)}</td>
        <td class="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">${escapeHtml(p.name)}</td>
        <td class="py-3 px-4">
          <span class="inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
            p.role.includes('Teacher') ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
          }">
            ${escapeHtml(p.role)}
          </span>
        </td>
        <td class="py-3 px-4 text-slate-500 text-xs">${escapeHtml(p.status)}</td>
      </tr>
    `).join('');
  };

  // Timeline Filtering
  window.filterTimeline = function () {
    window.renderTimeline();
  };

  // Render Timeline
  window.renderTimeline = function () {
    const container = document.getElementById('timeline-content-container');
    if (!container) return;

    const range = document.getElementById('timeline-range-select')?.value || '7';
    const search = (document.getElementById('timeline-search-input')?.value || '').toLowerCase().trim();

    let items = [...S.timelineItems];

    if (search) {
      items = items.filter(i =>
        i.title.toLowerCase().includes(search) ||
        i.course.toLowerCase().includes(search)
      );
    }

    if (items.length === 0) {
      container.className = 'bg-white dark:bg-[#131c31] border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center shadow-sm';
      container.innerHTML = `
        <div class="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xl mx-auto mb-3 text-slate-400">
          ⌛
        </div>
        <p class="text-sm font-semibold text-slate-500 dark:text-slate-400">No upcoming activities due</p>
      `;
      return;
    }

    container.className = 'bg-white dark:bg-[#131c31] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm divide-y divide-slate-100 dark:divide-slate-800';
    container.innerHTML = items.map(item => `
      <div class="py-4 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div class="flex items-start gap-4">
          <div class="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-[#e0533c] flex items-center justify-center text-lg shrink-0">
            ${item.icon}
          </div>
          <div>
            <h4 class="text-sm font-bold text-slate-900 dark:text-white hover:text-[#e0533c] cursor-pointer" onclick="window.viewCourseDetail('AI-301')">
              ${escapeHtml(item.title)}
            </h4>
            <p class="text-xs font-semibold text-[#e0533c] mt-0.5">${escapeHtml(item.course)}</p>
            <p class="text-[11px] text-slate-400 mt-1">${escapeHtml(item.dueDate)}</p>
          </div>
        </div>
        <div class="flex items-center gap-3 self-end sm:self-auto">
          <span class="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            ${escapeHtml(item.badge)}
          </span>
          <button onclick="window.openSubmissionModal()" class="px-3.5 py-1.5 bg-[#e0533c] hover:bg-[#c9432d] text-white rounded-xl text-xs font-bold transition">
            Add submission
          </button>
        </div>
      </div>
    `).join('');
  };

  // Calendar Rendering
  window.changeCalendarMonth = function (delta) {
    const d = S.calendarDate;
    d.setMonth(d.getMonth() + delta);
    window.renderCalendar();
  };

  window.renderCalendar = function () {
    const grid = document.getElementById('calendar-days-grid');
    const label = document.getElementById('calendar-month-label');
    if (!grid || !label) return;

    const d = S.calendarDate;
    const year = d.getFullYear();
    const month = d.getMonth();

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    label.textContent = `${monthNames[month]} ${year}`;

    // First day of month (0 = Sunday, 1 = Monday)
    const firstDay = new Date(year, month, 1);
    let startDayOfWeek = firstDay.getDay(); // 0 is Sunday
    // Adjust to Monday start: 0->6, 1->0, 2->1, etc.
    let shift = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    let cellsHtml = '';

    // Previous month filler days
    for (let i = shift - 1; i >= 0; i--) {
      const dayNum = prevMonthDays - i;
      cellsHtml += `
        <div class="calendar-grid-cell p-2 text-slate-300 dark:text-slate-600 bg-slate-50/50 dark:bg-slate-900/40 select-none">
          <span class="font-bold text-[11px]">${dayNum}</span>
        </div>
      `;
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const events = S.calendarEvents.filter(e => e.date === dateStr);
      const isToday = (year === 2026 && month === 10 && day === 16);

      let eventsHtml = '';
      events.forEach(evt => {
        eventsHtml += `
          <div onclick="window.showEventDetails(${evt.id})" class="mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${evt.badgeClass} truncate cursor-pointer hover:opacity-80 transition shadow-xs" title="${escapeHtml(evt.title)}">
            ${escapeHtml(evt.title)}
          </div>
        `;
      });

      cellsHtml += `
        <div class="calendar-grid-cell p-2 bg-white dark:bg-[#131c31] hover:bg-orange-50/20 dark:hover:bg-orange-950/10 flex flex-col justify-between">
          <div class="flex items-center justify-between">
            <span class="inline-flex items-center justify-center font-bold text-xs ${
              isToday
                ? 'w-6 h-6 rounded-full bg-[#e0533c] text-white shadow-sm'
                : 'text-slate-700 dark:text-slate-200'
            }">
              ${day}
            </span>
            ${events.length > 0 ? '<span class="w-1.5 h-1.5 rounded-full bg-[#e0533c]"></span>' : ''}
          </div>
          <div class="space-y-1">
            ${eventsHtml}
          </div>
        </div>
      `;
    }

    // Trailing filler days to complete 7-day row
    const totalFilled = shift + daysInMonth;
    const remaining = (7 - (totalFilled % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      cellsHtml += `
        <div class="calendar-grid-cell p-2 text-slate-300 dark:text-slate-600 bg-slate-50/50 dark:bg-slate-900/40 select-none">
          <span class="font-bold text-[11px]">${i}</span>
        </div>
      `;
    }

    grid.innerHTML = cellsHtml;
  };

  // Show Event Details Modal
  window.showEventDetails = function (eventId) {
    const evt = S.calendarEvents.find(e => e.id === eventId);
    if (!evt) return;

    const modal = document.getElementById('modal-event');
    const titleEl = document.getElementById('modal-event-title');
    const bodyEl = document.getElementById('modal-event-body');

    if (titleEl) titleEl.textContent = evt.title;
    if (bodyEl) {
      bodyEl.innerHTML = `
        <p><strong>Course:</strong> ${escapeHtml(evt.course)}</p>
        <p><strong>Date:</strong> ${escapeHtml(evt.date)}</p>
        <p><strong>Event Type:</strong> <span class="capitalize font-bold text-[#e0533c]">${escapeHtml(evt.type)}</span></p>
        <div class="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300">
          ${escapeHtml(evt.description)}
        </div>
      `;
    }

    if (modal) modal.classList.remove('hidden');
  };

  window.closeEventModal = function () {
    const modal = document.getElementById('modal-event');
    if (modal) modal.classList.add('hidden');
  };

  // Open New Event Modal
  window.openNewEventModal = function () {
    const title = prompt('Enter Event Title:');
    if (!title) return;
    const dateStr = prompt('Enter Date (YYYY-MM-DD):', '2026-11-28');
    if (!dateStr) return;

    const newEvt = {
      id: Date.now(),
      title: title.trim(),
      date: dateStr.trim(),
      type: 'user',
      badgeClass: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300',
      course: 'General Academic Event',
      description: 'Custom student calendar event created in UOL Slate.'
    };

    S.calendarEvents.push(newEvt);
    window.renderCalendar();
    window.showToast('New event added to calendar!');
  };

  // Submission Modal handlers
  window.openSubmissionModal = function () {
    const modal = document.getElementById('modal-submission');
    if (modal) modal.classList.remove('hidden');
  };

  window.closeSubmissionModal = function () {
    const modal = document.getElementById('modal-submission');
    if (modal) modal.classList.add('hidden');
  };

  window.handleFileSelect = function (input) {
    if (input.files && input.files[0]) {
      const label = document.getElementById('selected-file-label');
      if (label) {
        label.textContent = `Selected: ${input.files[0].name} (${(input.files[0].size / 1024 / 1024).toFixed(2)} MB)`;
        label.className = 'text-[11px] text-[#e0533c] font-bold';
      }
    }
  };

  window.submitAssignmentFile = function () {
    window.closeSubmissionModal();
    window.showToast('Assignment submitted successfully! Status updated.');
  };

  // Announcements Modal
  window.openAnnouncementsModal = function () {
    alert('Course Announcements:\n1. Mid Term Exam Schedule posted for Section D.\n2. Lab practical makeup sessions scheduled on Saturdays.\n3. Research paper reading list updated.');
  };

  // Toggle All Course Topics Accordion
  let allTopicsCollapsed = false;
  window.toggleAllCourseTopics = function () {
    allTopicsCollapsed = !allTopicsCollapsed;
    const btn = document.getElementById('btn-collapse-all');
    const topics = document.querySelectorAll('#course-subview-content .p-4, #course-subview-content .p-5');

    topics.forEach(t => {
      const content = t.querySelector('div, ul, p');
      if (content && t.id !== 'btn-collapse-all') {
        if (allTopicsCollapsed) {
          t.style.opacity = '0.6';
        } else {
          t.style.opacity = '1';
        }
      }
    });

    if (btn) {
      btn.innerHTML = allTopicsCollapsed ? '<span>&or;</span><span>Expand all</span>' : '<span>&and;</span><span>Collapse all</span>';
    }
  };

  // Course card 3-dots menu
  window.toggleCourseMenu = function (e, courseId) {
    e.stopPropagation();
    const action = confirm('Select an action:\n\nClick OK to Star this course, or Cancel to leave it unchanged.');
    if (action) {
      const c = S.courses.find(x => x.id === courseId);
      if (c) {
        c.starred = !c.starred;
        window.showToast(c.starred ? 'Course starred!' : 'Course removed from starred.');
        window.renderCourseCards();
      }
    }
  };

  // Theme Toggle
  window.toggleTheme = function () {
    const isDark = document.documentElement.classList.contains('dark');
    if (isDark) {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      localStorage.setItem('uol_theme', 'light');
    } else {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
      localStorage.setItem('uol_theme', 'dark');
    }
  };

  // User Profile Menu Dropdown
  window.toggleUserMenu = function () {
    const menu = document.getElementById('user-dropdown-menu');
    if (menu) menu.classList.toggle('hidden');
  };

  window.toggleNotificationsDropdown = function () {
    alert('28 Notifications:\n- Mid Term date sheet has been published.\n- Assignment 2 submitted by 18 students.\n- Library clearance notification for Batch 2022.\n- Registration portal open for Spring 2027.');
  };

  window.toggleMessagesDrawer = function () {
    alert('Messages:\nYou have 3 unread messages from faculty advisor and department office.');
  };

  window.openFullCalendarModal = function () {
    window.switchSlateTab('dashboard');
    document.querySelector('#slate-view-dashboard')?.scrollIntoView({ behavior: 'smooth' });
  };

  window.openImportExportModal = function () {
    alert('iCalendar (.ics) Export:\nAcademic semester timetable and examination calendar ready to sync with Google Calendar or Apple iCal.');
  };

  // Initial Boot
  document.addEventListener('DOMContentLoaded', () => {
    // Restore Saved Theme
    const savedTheme = localStorage.getItem('uol_theme');
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else if (savedTheme === 'light') {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }

    // Close user menu on outside click
    document.addEventListener('click', (e) => {
      const userMenu = document.getElementById('user-dropdown-menu');
      if (userMenu && !userMenu.contains(e.target) && !e.target.closest('button[onclick="window.toggleUserMenu()"]')) {
        userMenu.classList.add('hidden');
      }
    });

    // Populate Course Count in Dashboard
    const countEl = document.getElementById('dash-courses-count');
    if (countEl) countEl.textContent = S.courses.length;

    // Render Initial View (My Courses)
    window.switchSlateTab('courses');
  });

})();
