/**
 * Ghani University Teacher Faculty Portal Frontend Engine
 */

(function () {
  'use strict';

  window.Teacher = {
    currentTeacher: null,
    courses: [],
    materials: [],
    submissions: [],
    meetings: [],
    activeTab: 'overview'
  };

  const T = window.Teacher;

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function showTeacherToast(message, type = 'success') {
    let box = document.getElementById('teacher-toast');
    if (!box) {
      box = document.createElement('div');
      box.id = 'teacher-toast';
      box.className = 'fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none';
      document.body.appendChild(box);
    }
    const item = document.createElement('div');
    item.className = `pointer-events-auto px-4 py-3 rounded-xl shadow-2xl border text-xs font-bold flex items-center gap-2 transition-all transform duration-300 translate-y-2 opacity-0 ${
      type === 'success' ? 'bg-[#0D9488] text-white border-teal-400' : 'bg-red-600 text-white border-red-400'
    }`;
    item.innerHTML = `<span>${type === 'success' ? '✓' : '⚠️'}</span><span>${escapeHtml(message)}</span>`;
    box.appendChild(item);

    requestAnimationFrame(() => item.classList.remove('translate-y-2', 'opacity-0'));
    setTimeout(() => {
      item.classList.add('translate-y-2', 'opacity-0');
      setTimeout(() => item.remove(), 300);
    }, 3500);
  }

  // Teacher Fetch API
  async function teacherFetch(url, options = {}) {
    options.headers = options.headers || {};
    options.headers['Accept'] = 'application/json';
    return fetch(url, options);
  }

  // Initialize
  async function initTeacherPortal() {
    try {
      const res = await teacherFetch('/api/teacher/me');
      const data = await res.json();
      if (data.success && data.teacher) {
        T.currentTeacher = data.teacher;
        renderTeacherDashboard();
      } else {
        showTeacherLogin();
      }
    } catch (err) {
      showTeacherLogin();
    }
  }

  function showTeacherLogin() {
    const loginView = document.getElementById('teacher-login-view');
    const dashView = document.getElementById('teacher-dashboard-view');
    if (loginView) loginView.classList.remove('hidden');
    if (dashView) dashView.classList.add('hidden');
  }

  function renderTeacherDashboard() {
    const loginView = document.getElementById('teacher-login-view');
    const dashView = document.getElementById('teacher-dashboard-view');
    if (loginView) loginView.classList.add('hidden');
    if (dashView) dashView.classList.remove('hidden');

    const teacher = T.currentTeacher;
    const nameEl = document.getElementById('teacher-header-name');
    const infoEl = document.getElementById('teacher-header-info');
    const welcomeEl = document.getElementById('teacher-welcome-name');

    if (nameEl) nameEl.innerText = teacher.name;
    if (infoEl) infoEl.innerText = `${teacher.designation || 'Faculty'} • ${teacher.department || 'Ghani University'}`;
    if (welcomeEl) welcomeEl.innerText = teacher.name;

    // Load initial data
    loadTeacherStats();
    loadTeacherCourses();
  }

  // Handle Login
  window.handleTeacherLogin = async function (e) {
    if (e) e.preventDefault();
    const identInput = document.getElementById('teacher-login-ident');
    const passInput = document.getElementById('teacher-login-pass');
    const errBox = document.getElementById('teacher-login-error');

    if (errBox) errBox.classList.add('hidden');

    try {
      const res = await teacherFetch('/api/teacher/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: identInput.value.trim(),
          password: passInput.value
        })
      });
      const data = await res.json();
      if (!data.success) {
        if (errBox) {
          errBox.innerText = data.error || 'Login failed.';
          errBox.classList.remove('hidden');
        }
        return;
      }

      T.currentTeacher = data.teacher;
      renderTeacherDashboard();
    } catch (err) {
      if (errBox) {
        errBox.innerText = 'Network error: ' + err.message;
        errBox.classList.remove('hidden');
      }
    }
  };

  // Handle Logout
  window.handleTeacherLogout = async function () {
    await teacherFetch('/api/teacher/logout', { method: 'POST' });
    window.location.reload();
  };

  // Switch Teacher Portal Tabs
  window.switchTeacherTab = function (tabName) {
    T.activeTab = tabName;

    // Toggle button styles
    document.querySelectorAll('.teacher-tab-btn').forEach(b => {
      if (b.getAttribute('data-tab') === tabName) {
        b.classList.add('bg-[#0D9488]', 'text-white', 'shadow');
        b.classList.remove('text-slate-400', 'hover:text-white');
      } else {
        b.classList.remove('bg-[#0D9488]', 'text-white', 'shadow');
        b.classList.add('text-slate-400', 'hover:text-white');
      }
    });

    // Toggle contents
    document.querySelectorAll('.teacher-tab-pane').forEach(p => p.classList.add('hidden'));
    const activePane = document.getElementById(`teacher-tab-${tabName}`);
    if (activePane) activePane.classList.remove('hidden');

    if (tabName === 'courses') loadTeacherCourses();
    if (tabName === 'materials') loadTeacherMaterials();
    if (tabName === 'submissions') loadAllSubmissions();
    if (tabName === 'meetings') loadTeacherMeetings();
  };

  // 1. Load Stats
  async function loadTeacherStats() {
    try {
      const [cRes, mRes, meetRes] = await Promise.all([
        teacherFetch('/api/teacher/courses'),
        teacherFetch('/api/teacher/materials'),
        teacherFetch('/api/teacher/meetings')
      ]);

      const cData = await cRes.json();
      const mData = await mRes.json();
      const meetData = await meetRes.json();

      const courses = cData.courses || [];
      const materials = mData.materials || [];
      const meetings = meetData.meetings || [];

      let totalStudents = 0;
      courses.forEach(c => totalStudents += (c.enrolled_count || 0));

      const pendingMeetings = meetings.filter(m => m.status === 'pending').length;

      document.getElementById('stat-teacher-courses').innerText = courses.length;
      document.getElementById('stat-teacher-students').innerText = totalStudents;
      document.getElementById('stat-teacher-tasks').innerText = materials.length;
      document.getElementById('stat-teacher-meetings').innerText = pendingMeetings;
    } catch (e) {}
  }

  // 2. Load Courses
  async function loadTeacherCourses() {
    const container = document.getElementById('teacher-courses-container');
    if (!container) return;

    container.innerHTML = '<div class="p-8 text-center text-xs text-slate-400">Loading courses...</div>';

    try {
      const res = await teacherFetch('/api/teacher/courses');
      const data = await res.json();
      if (!data.success) return;

      T.courses = data.courses || [];

      if (T.courses.length === 0) {
        container.innerHTML = '<div class="p-8 text-center text-xs text-slate-400">No courses assigned to your faculty profile yet. Contact University Registrar Office.</div>';
        return;
      }

      let html = '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">';
      T.courses.forEach(c => {
        html += `
          <div class="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 shadow-md hover:border-[#0D9488]/50 transition">
            <div class="flex justify-between items-start gap-2">
              <div>
                <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#2563EB]/20 text-[#2563EB] border border-[#2563EB]/30">${c.course_code}</span>
                <h3 class="text-sm font-bold text-white mt-1">${escapeHtml(c.course_title)}</h3>
              </div>
              <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-500/15 text-teal-400 border border-teal-500/30">Section ${c.section || 'A'}</span>
            </div>
            <p class="text-xs text-slate-400">${escapeHtml(c.department || 'Computer Science')}</p>
            <div class="pt-2 border-t border-slate-800 flex justify-between items-center text-xs">
              <span class="text-slate-400">👥 <strong>${c.enrolled_count || 0}</strong> Enrolled Students</span>
              <a href="/slate?tab=channels&course=${c.course_code}" target="_blank" class="text-teal-400 hover:underline font-bold flex items-center gap-1">
                <span>Slate Channel</span> →
              </a>
            </div>
          </div>
        `;
      });
      html += '</div>';
      container.innerHTML = html;
    } catch (err) {
      container.innerHTML = `<div class="p-6 text-red-400 text-xs">Failed to load courses: ${err.message}</div>`;
    }
  }

  // 3. Load Materials & Works
  async function loadTeacherMaterials() {
    const container = document.getElementById('teacher-materials-container');
    if (!container) return;

    container.innerHTML = '<div class="p-8 text-center text-xs text-slate-400">Loading materials...</div>';

    try {
      const res = await teacherFetch('/api/teacher/materials');
      const data = await res.json();
      if (!data.success) return;

      T.materials = data.materials || [];

      if (T.materials.length === 0) {
        container.innerHTML = '<div class="p-8 text-center text-xs text-slate-400">No works or assignments uploaded yet. Click "+ Upload Work Material" to publish one.</div>';
        return;
      }

      let html = '<div class="space-y-3">';
      T.materials.forEach(m => {
        html += `
          <div class="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#2563EB]/20 text-[#2563EB]">${m.course_code}</span>
                <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-teal-500/15 text-teal-400">${m.material_type}</span>
                <span class="text-xs text-slate-400">• Max Marks: ${m.total_marks || 10}</span>
              </div>
              <h4 class="text-sm font-bold text-white">${escapeHtml(m.title)}</h4>
              <p class="text-xs text-slate-400">${escapeHtml(m.description || '')}</p>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <button onclick="window.Teacher.viewSubmissions(${m.id}, '${escapeHtml(m.title)}')" class="px-3.5 py-1.5 bg-[#0D9488] hover:bg-teal-600 text-white rounded-xl text-xs font-bold shadow flex items-center gap-1">
                <span>Submissions (${m.submission_count || 0})</span>
              </button>
              <button onclick="window.Teacher.handleDeleteMaterial(${m.id})" class="px-3 py-1.5 bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white rounded-xl text-xs font-semibold border border-red-500/30">
                Delete
              </button>
            </div>
          </div>
        `;
      });
      html += '</div>';
      container.innerHTML = html;
    } catch (err) {
      container.innerHTML = `<div class="p-6 text-red-400 text-xs">Failed to load materials: ${err.message}</div>`;
    }
  }

  // 4. View Submissions for a Material
  window.Teacher.viewSubmissions = async function (materialId, title) {
    const modal = document.getElementById('teacher-submissions-modal');
    const container = document.getElementById('submissions-list-container');
    const titleEl = document.getElementById('submissions-modal-title');

    if (titleEl) titleEl.innerText = `Submissions for: ${title}`;
    if (modal) modal.classList.remove('hidden');
    if (container) container.innerHTML = '<div class="p-8 text-center text-xs text-slate-400">Loading student submissions...</div>';

    try {
      const res = await teacherFetch(`/api/teacher/materials/${materialId}/submissions`);
      const data = await res.json();
      if (!data.success) return;

      const submissions = data.submissions || [];
      if (submissions.length === 0) {
        container.innerHTML = '<div class="p-8 text-center text-xs text-slate-400">No students have submitted this task yet.</div>';
        return;
      }

      let html = '<div class="divide-y divide-slate-800">';
      submissions.forEach(sub => {
        const isGraded = sub.status === 'graded';
        html += `
          <div class="py-4 space-y-3">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <h4 class="text-sm font-bold text-white">${escapeHtml(sub.student_name)} <span class="text-xs font-mono text-[#93C5FD]">(${escapeHtml(sub.registration_no)})</span></h4>
                <p class="text-xs text-slate-400">Submitted: ${new Date(sub.submitted_at).toLocaleString()}</p>
                ${sub.student_comment ? `<p class="text-xs text-slate-300 italic mt-1">"${escapeHtml(sub.student_comment)}"</p>` : ''}
              </div>
              <div class="flex items-center gap-2">
                <a href="${sub.file_url}" target="_blank" download class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded-lg text-xs font-semibold border border-slate-700 flex items-center gap-1">
                  <span>📥 Download Solution</span>
                </a>
              </div>
            </div>

            <!-- Grade Form -->
            <form onsubmit="window.Teacher.handleGradeSubmit(event, ${sub.id})" class="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60 flex flex-wrap items-center gap-3">
              <div class="flex items-center gap-1.5">
                <label class="text-xs font-bold text-slate-300">Marks (out of ${sub.total_marks}):</label>
                <input type="number" id="grade-marks-${sub.id}" value="${sub.marks_obtained !== null ? sub.marks_obtained : ''}" min="0" max="${sub.total_marks}" step="0.5" required
                       class="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white text-center font-bold" />
              </div>
              <div class="flex-1 min-w-[200px]">
                <input type="text" id="grade-feedback-${sub.id}" value="${escapeHtml(sub.teacher_feedback || '')}" placeholder="Instructor feedback to student..."
                       class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1 text-xs text-white" />
              </div>
              <button type="submit" class="px-4 py-1.5 bg-[#0D9488] hover:bg-teal-600 text-white rounded-lg text-xs font-bold shadow">
                ${isGraded ? 'Update Grade' : 'Submit Grade'}
              </button>
            </form>
          </div>
        `;
      });
      html += '</div>';
      container.innerHTML = html;
    } catch (err) {
      container.innerHTML = `<div class="p-6 text-red-400 text-xs">Error loading submissions: ${err.message}</div>`;
    }
  };

  window.Teacher.closeSubmissionsModal = function () {
    const modal = document.getElementById('teacher-submissions-modal');
    if (modal) modal.classList.add('hidden');
  };

  window.Teacher.handleGradeSubmit = async function (e, subId) {
    if (e) e.preventDefault();
    const marksInput = document.getElementById(`grade-marks-${subId}`);
    const feedbackInput = document.getElementById(`grade-feedback-${subId}`);

    const marks = marksInput?.value;
    const feedback = feedbackInput?.value;

    try {
      const res = await teacherFetch(`/api/teacher/submissions/${subId}/grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marks_obtained: marks, teacher_feedback: feedback })
      });
      const data = await res.json();
      if (!data.success) {
        showTeacherToast(data.error, 'error');
        return;
      }
      showTeacherToast('Grade and feedback saved successfully!');
    } catch (err) {
      showTeacherToast('Failed to save grade: ' + err.message, 'error');
    }
  };

  window.Teacher.handleDeleteMaterial = async function (id) {
    if (!confirm('Are you sure you want to delete this material and all linked student submissions?')) return;
    try {
      const res = await teacherFetch(`/api/teacher/materials/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showTeacherToast('Material deleted successfully.');
        loadTeacherMaterials();
      }
    } catch (e) {}
  };

  // 5. Load Meetings
  async function loadTeacherMeetings() {
    const container = document.getElementById('teacher-meetings-container');
    if (!container) return;

    container.innerHTML = '<div class="p-8 text-center text-xs text-slate-400">Loading meeting requests...</div>';

    try {
      const res = await teacherFetch('/api/teacher/meetings');
      const data = await res.json();
      if (!data.success) return;

      T.meetings = data.meetings || [];

      if (T.meetings.length === 0) {
        container.innerHTML = '<div class="p-8 text-center text-xs text-slate-400">No meeting consultation requests at this time.</div>';
        return;
      }

      let html = '<div class="space-y-3">';
      T.meetings.forEach(m => {
        const isPending = m.status === 'pending';
        html += `
          <div class="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <div class="flex items-center gap-2">
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${m.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' : (m.status === 'rejected' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400')}">${m.status}</span>
                  <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-white/10 text-slate-300 uppercase">${m.meeting_mode.replace('_', ' ')}</span>
                </div>
                <h4 class="text-sm font-bold text-white mt-1">${escapeHtml(m.purpose)}</h4>
                <p class="text-xs text-slate-400">Student: <strong class="text-slate-200">${escapeHtml(m.student_name)}</strong> (${escapeHtml(m.registration_no || '')}) • Phone: ${escapeHtml(m.student_phone || '—')}</p>
              </div>
              <span class="text-xs text-slate-400 font-mono">⏰ ${new Date(m.preferred_datetime).toLocaleString()}</span>
            </div>

            ${isPending ? `
              <div class="flex items-center gap-2 pt-2 border-t border-slate-800">
                <button onclick="window.Teacher.handleMeetingAction(${m.id}, 'approved')" class="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition">
                  ✓ Approve Consultation
                </button>
                <button onclick="window.Teacher.handleMeetingAction(${m.id}, 'rejected')" class="px-3.5 py-1.5 bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white rounded-lg text-xs font-bold transition">
                  ✕ Decline
                </button>
              </div>
            ` : ''}
          </div>
        `;
      });
      html += '</div>';
      container.innerHTML = html;
    } catch (err) {
      container.innerHTML = `<div class="p-6 text-red-400 text-xs">Error loading meetings: ${err.message}</div>`;
    }
  }

  window.Teacher.handleMeetingAction = async function (id, status) {
    const notes = prompt(`Optional instructor notes for student (${status}):`);
    try {
      const res = await teacherFetch(`/api/teacher/meetings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, teacher_notes: notes || '' })
      });
      const data = await res.json();
      if (data.success) {
        showTeacherToast(`Meeting ${status} successfully.`);
        loadTeacherMeetings();
        loadTeacherStats();
      }
    } catch (e) {}
  };

  // Upload Material Modal Handler
  window.Teacher.openUploadModal = async function () {
    const modal = document.getElementById('teacher-material-modal');
    const select = document.getElementById('t-mat-course-select');

    if (select) {
      let opt = '<option value="">Select Assigned Course</option>';
      T.courses.forEach(c => {
        opt += `<option value="${escapeHtml(c.course_code)}">${c.course_code} - ${escapeHtml(c.course_title)}</option>`;
      });
      select.innerHTML = opt;
    }

    if (modal) modal.classList.remove('hidden');
  };

  window.Teacher.closeUploadModal = function () {
    const modal = document.getElementById('teacher-material-modal');
    if (modal) modal.classList.add('hidden');
  };

  window.Teacher.handlePublishMaterial = async function (e) {
    if (e) e.preventDefault();
    const courseCode = document.getElementById('t-mat-course-select')?.value;
    const title = document.getElementById('t-mat-title')?.value;
    const desc = document.getElementById('t-mat-desc')?.value;
    const type = document.getElementById('t-mat-type')?.value;
    const marks = document.getElementById('t-mat-marks')?.value;
    const dueDate = document.getElementById('t-mat-due')?.value;
    const fileInput = document.getElementById('t-mat-file');

    if (!courseCode || !title) {
      showTeacherToast('Course and Title are required.', 'error');
      return;
    }

    let fileUrl = null;
    let fileName = null;

    if (fileInput && fileInput.files[0]) {
      const formData = new FormData();
      formData.append('file', fileInput.files[0]);
      const upRes = await fetch('/api/slate/upload', { method: 'POST', body: formData });
      const upData = await upRes.json();
      if (upData.success) {
        fileUrl = upData.file_url;
        fileName = upData.file_name;
      }
    }

    try {
      const res = await teacherFetch('/api/teacher/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          course_code: courseCode,
          title,
          description: desc,
          material_type: type,
          total_marks: marks || 10,
          due_date: dueDate || null,
          file_url: fileUrl,
          file_name: fileName
        })
      });
      const data = await res.json();
      if (!data.success) {
        showTeacherToast(data.error, 'error');
        return;
      }

      showTeacherToast('Work published to course on Slate!');
      window.Teacher.closeUploadModal();
      loadTeacherMaterials();
      loadTeacherStats();
    } catch (err) {
      showTeacherToast('Failed to publish: ' + err.message, 'error');
    }
  };

  document.addEventListener('DOMContentLoaded', initTeacherPortal);

})();
