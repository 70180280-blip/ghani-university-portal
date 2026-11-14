/**
 * Ghani University Portal - Admin ERP Management Engine (Bulletproof)
 * 
 * Manages:
 * - Admin Authentication & Session Recovery
 * - AI File Ingestion (Student Lists, Marks, Attendance) with preview, validation & confirmation
 * - Upload History & Data Rollback (Delete upload)
 * - Manual inline editing and single/bulk deletion of students
 * - Live Student Registry with search filter
 * - Export to Excel (.xlsx)
 * - AI Admin Natural Language Search (Safe parameterized queries)
 * - AI At-Risk Student Report & Academic Council Audit
 * - Audit Log Viewer
 * - Category-wise Database Purge Center
 */

// Global State
let currentAdmin = null;
let currentPreviewUploadId = null;
let currentPreviewRecords = [];
let currentPreviewType = 'students';

/**
 * Robust Admin Fetch wrapper:
 * - Enforces Accept: application/json
 * - Automatically handles 401 session expiry and prompts re-authentication
 */
async function adminFetch(url, options = {}) {
  const headers = Object.assign({
    'Accept': 'application/json'
  }, options.headers || {});

  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    console.warn('[Admin] Session expired or unauthorized.');
    showAdminLogin();
    const errBox = document.getElementById('admin-login-error');
    if (errBox) {
      errBox.innerText = 'Your admin session has expired. Please sign in again.';
      errBox.classList.remove('hidden');
    }
    throw new Error('Admin session expired. Please sign in again.');
  }
  return res;
}

// ============================================================================
// TOP-LEVEL GLOBAL FUNCTIONS (Immediately accessible to all inline onclick handlers)
// ============================================================================

window.switchAdminTab = function(tabName) {
  if (!currentAdmin) {
    showAdminLogin();
    return;
  }
  const tabs = ['upload', 'overview', 'search', 'atrisk', 'students', 'courses', 'audit', 'cleanup'];
  tabs.forEach(t => {
    const el = document.getElementById(`tab-content-${t}`);
    const btn = document.getElementById(`tab-btn-${t}`);
    if (el) {
      el.classList.add('hidden');
      el.style.display = 'none';
    }
    if (btn) {
      btn.classList.remove('bg-sky-600', 'text-white');
      btn.classList.add('text-slate-400');
    }
  });

  const activeEl = document.getElementById(`tab-content-${tabName}`);
  const activeBtn = document.getElementById(`tab-btn-${tabName}`);
  if (activeEl) {
    activeEl.classList.remove('hidden');
    activeEl.style.display = 'block';
  }
  if (activeBtn) {
    activeBtn.classList.add('bg-sky-600', 'text-white');
    activeBtn.classList.remove('text-slate-400');
  }

  try {
    if (tabName === 'overview') {
      if (typeof window.loadAdminDashboardStats === 'function') window.loadAdminDashboardStats();
      if (typeof window.loadUploadHistory === 'function') window.loadUploadHistory();
    }
    if (tabName === 'atrisk') {
      if (typeof window.loadAtRiskReport === 'function') window.loadAtRiskReport();
    }
    if (tabName === 'students') {
      if (typeof window.loadStudentManager === 'function') window.loadStudentManager();
    }
    if (tabName === 'courses') {
      if (typeof window.loadCoursesCatalog === 'function') window.loadCoursesCatalog();
    }
    if (tabName === 'audit') {
      if (typeof window.loadAuditLogs === 'function') window.loadAuditLogs();
    }
  } catch (err) {
    console.error(`Error loading data for tab ${tabName}:`, err);
  }
};

window.handleDeleteStudent = async function(id, name, reg) {
  if (!confirm(`Are you sure you want to permanently delete student "${name}" (${reg})?\nAll corresponding marks, attendance, and records will be deleted.`)) {
    return;
  }

  try {
    const res = await adminFetch(`/api/admin/students/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      alert(data.message);
      if (window.loadStudentManager) window.loadStudentManager();
      if (window.loadAdminDashboardStats) window.loadAdminDashboardStats();
    } else {
      alert(`Error: ${data.error}`);
    }
  } catch (err) {
    alert(`Delete error: ${err.message}`);
  }
};

window.handleDeleteAllStudents = async function() {
  const confirmText = prompt('CRITICAL SECURITY WARNING:\nYou are about to permanently delete ALL student profiles, grades, and attendance records from the database.\n\nType exactly "DELETE UNIVERSITY DATA" to confirm:');
  if (confirmText !== 'DELETE UNIVERSITY DATA') {
    alert('Action cancelled. You must type "DELETE UNIVERSITY DATA" to confirm.');
    return;
  }

  try {
    const res = await adminFetch('/api/admin/students', { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      alert(data.message);
      if (window.loadStudentManager) window.loadStudentManager();
      if (window.loadAdminDashboardStats) window.loadAdminDashboardStats();
    } else {
      alert(`Error: ${data.error}`);
    }
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
};

window.handleDeleteCourse = async function(code, title) {
  if (!confirm(`Are you sure you want to permanently delete course "${code} - ${title}"?\nAll corresponding marks, attendance records, enrollments, and timetables for this course will also be removed.`)) {
    return;
  }

  try {
    const res = await adminFetch(`/api/admin/courses/${encodeURIComponent(code)}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      alert(data.message);
      if (window.loadCoursesCatalog) window.loadCoursesCatalog();
      if (window.loadAdminDashboardStats) window.loadAdminDashboardStats();
    } else {
      alert(`Error: ${data.error}`);
    }
  } catch (err) {
    alert(`Delete error: ${err.message}`);
  }
};

window.handleDeleteAllCourses = async function() {
  const confirmText = prompt('CRITICAL SECURITY WARNING:\nYou are about to permanently delete ALL courses from the curriculum catalog along with all linked results and timetables.\n\nType exactly "DELETE UNIVERSITY DATA" to confirm:');
  if (confirmText !== 'DELETE UNIVERSITY DATA') {
    alert('Action cancelled. You must type "DELETE UNIVERSITY DATA" to confirm.');
    return;
  }

  try {
    const res = await adminFetch('/api/admin/courses', { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      alert(data.message);
      if (window.loadCoursesCatalog) window.loadCoursesCatalog();
      if (window.loadAdminDashboardStats) window.loadAdminDashboardStats();
    } else {
      alert(`Error: ${data.error}`);
    }
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
};

window.handlePurgeCategory = async function(category, label) {
  const requiredPhrase = 'DELETE UNIVERSITY DATA';
  const input = prompt(`CRITICAL PURGE CONFIRMATION:\nAre you sure you want to permanently delete ${label}?\n\nType exactly "${requiredPhrase}" to execute:`);
  if (input !== requiredPhrase) {
    alert(`Action cancelled. You must type "${requiredPhrase}" to confirm.`);
    return;
  }

  try {
    const res = await adminFetch('/api/admin/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category })
    });
    const data = await res.json();
    if (data.success) {
      alert(data.message);
      if (window.loadAdminDashboardStats) window.loadAdminDashboardStats();
      if (category === 'students' || category === 'all') {
        if (window.loadStudentManager) window.loadStudentManager();
      }
      if (category === 'courses' || category === 'all') {
        if (window.loadCoursesCatalog) window.loadCoursesCatalog();
      }
    } else {
      alert(`Purge Error: ${data.error}`);
    }
  } catch (err) {
    alert(`Purge Request Failed: ${err.message}`);
  }
};

window.retryDbConnection = async function() {
  const dot = document.getElementById('db-status-dot');
  const ping = document.getElementById('db-status-ping');
  const text = document.getElementById('db-status-text');

  if (text) {
    text.className = 'text-[11px] font-semibold text-amber-300';
    text.innerText = 'Connecting...';
  }
  if (dot) {
    dot.className = 'relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400 animate-pulse';
  }
  if (ping) ping.className = 'hidden';

  try {
    const res = await adminFetch('/api/admin/db/retry', { method: 'POST' });
    const data = await res.json();
    await window.loadDbStatus();

    if (data.success && data.isMySQL) {
      console.log('MySQL connection verified successfully.');
    } else {
      alert(`Database Notice: ${data.error || 'Connection check failed'}\n\nPlease verify MySQL connection credentials.`);
    }
  } catch (err) {
    await window.loadDbStatus();
    alert(`Connection check error: ${err.message}`);
  }
};

window.loadDbStatus = async function() {
  const dot = document.getElementById('db-status-dot');
  const ping = document.getElementById('db-status-ping');
  const text = document.getElementById('db-status-text');
  const pill = document.getElementById('db-indicator-pill');

  try {
    const res = await fetch('/api/admin/db/status', { headers: { 'Accept': 'application/json' } });
    const data = await res.json();

    if (data.success && data.isMySQL) {
      // GREEN DOT: Connected to MySQL
      if (dot) {
        dot.className = 'relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.9)]';
      }
      if (ping) {
        ping.className = 'animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75';
      }
      if (text) {
        text.className = 'text-[11px] font-semibold text-emerald-300';
        const stCount = data.counts?.students !== undefined ? data.counts.students : '';
        text.innerText = stCount !== '' ? `MySQL Live (${stCount} Students)` : 'MySQL Live';
      }
      if (pill) {
        pill.title = `MySQL Live: Cloud Database Connected. Current Records: ${data.counts?.students || 0} students, ${data.counts?.results || 0} results, ${data.counts?.attendance || 0} attendance. (Click to test connection)`;
      }
    } else {
      // RED DOT: Disconnected
      if (dot) {
        dot.className = 'relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)]';
      }
      if (ping) {
        ping.className = 'hidden';
      }
      if (text) {
        text.className = 'text-[11px] font-semibold text-red-400';
        text.innerText = 'DB Offline';
      }
      if (pill) {
        pill.title = `Database Disconnected: ${data.lastError || 'Click to test & reconnect'}`;
      }
    }
  } catch (err) {
    if (dot) {
      dot.className = 'relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)]';
    }
    if (ping) ping.className = 'hidden';
    if (text) {
      text.className = 'text-[11px] font-semibold text-red-400';
      text.innerText = 'DB Offline';
    }
    if (pill) {
      pill.title = `Database Check Error: ${err.message}. Click to reconnect.`;
    }
  }
};

window.handleAiSearch = async function(queryText) {
  const input = document.getElementById('ai-search-input');
  const query = queryText || (input ? input.value.trim() : '');
  if (!query) return;

  if (input) input.value = query;

  const resultsArea = document.getElementById('ai-search-results-area');
  const explanationBox = document.getElementById('ai-search-explanation');
  const tableContainer = document.getElementById('ai-search-table-container');

  if (resultsArea) resultsArea.classList.remove('hidden');
  if (explanationBox) explanationBox.innerHTML = 'Translating natural language into safe parameterized query...';
  if (tableContainer) tableContainer.innerHTML = '<div class="p-6 text-center text-slate-400">Executing safe query...</div>';

  try {
    const res = await adminFetch('/api/admin/ai/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    const data = await res.json();

    if (!data.success) {
      if (explanationBox) explanationBox.innerHTML = `<span class="text-red-400">Search error: ${data.error}</span>`;
      if (tableContainer) tableContainer.innerHTML = '';
      return;
    }

    if (explanationBox) explanationBox.innerHTML = `<strong>Query Intent:</strong> ${data.explanation} (${data.rowCount} rows returned)`;

    const exportBtn = document.getElementById('ai-search-export-btn');
    if (!data.data || data.data.length === 0) {
      if (exportBtn) { exportBtn.classList.add('hidden'); exportBtn.classList.remove('flex'); }
      if (tableContainer) tableContainer.innerHTML = '<div class="p-4 text-center text-slate-400">No matching records found.</div>';
      return;
    }

    window.currentAiSearchResults = data.data;
    if (exportBtn) {
      exportBtn.classList.remove('hidden');
      exportBtn.classList.add('flex');
    }

    const columns = Object.keys(data.data[0]);
    let html = `
      <table class="w-full text-left text-xs text-slate-300">
        <thead class="bg-slate-900 text-slate-400 font-bold border-b border-slate-700">
          <tr>
            ${columns.map(c => `<th class="py-2.5 px-3 uppercase text-[10px]">${c.replace(/_/g, ' ')}</th>`).join('')}
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-700/50">
    `;

    data.data.forEach(row => {
      html += `
        <tr class="hover:bg-slate-800/40">
          ${columns.map(c => `<td class="py-2 px-3">${row[c] !== null ? escapeHtml(row[c]) : '—'}</td>`).join('')}
        </tr>
      `;
    });

    html += `</tbody></table>`;
    if (tableContainer) tableContainer.innerHTML = html;

  } catch (err) {
    if (explanationBox) explanationBox.innerHTML = `<span class="text-red-400">Search failed: ${err.message}</span>`;
  }
};

window.exportAiSearchResults = function() {
  if (!window.currentAiSearchResults || window.currentAiSearchResults.length === 0) {
    alert('No search results available to export.');
    return;
  }
  const rows = window.currentAiSearchResults;
  const headers = Object.keys(rows[0]);
  const csvLines = [headers.join(',')];
  for (const r of rows) {
    const line = headers.map(h => {
      let val = r[h] === null || r[h] === undefined ? '' : String(r[h]);
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        val = `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    }).join(',');
    csvLines.push(line);
  }
  const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gu_database_search_${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

window.handleDeleteUpload = async function(id) {
  if (!confirm(`Are you sure you want to delete Upload #${id}? All records created by this upload will be removed from the database.`)) {
    return;
  }

  try {
    const res = await adminFetch(`/api/admin/upload/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      alert(data.message);
      if (window.loadAdminDashboardStats) window.loadAdminDashboardStats();
      if (window.loadStudentManager) window.loadStudentManager();
    } else {
      alert(`Error: ${data.error}`);
    }
  } catch (err) {
    alert(`Delete error: ${err.message}`);
  }
};

window.confirmPreviewData = async function() {
  const confirmBtn = document.getElementById('confirm-upload-btn');
  const btnLabel = document.getElementById('confirm-btn-label');
  const previewArea = document.getElementById('upload-preview-area');

  // Recover uploadId defensively from memory or DOM
  if (!currentPreviewUploadId) {
    currentPreviewUploadId = (confirmBtn && confirmBtn.getAttribute('data-upload-id')) ||
                             (previewArea && previewArea.getAttribute('data-upload-id')) ||
                             localStorage.getItem('gtiu_current_upload_id');
  }

  if (!currentPreviewUploadId) {
    alert('Notice: No active upload batch found. Please choose an Excel/PDF file and click "Process File & Generate Preview" first.');
    return;
  }

  // Scrape edited input fields from preview table if currentPreviewRecords is empty
  if (!currentPreviewRecords || currentPreviewRecords.length === 0) {
    const rows = document.querySelectorAll('#preview-table-container tbody tr');
    currentPreviewRecords = [];
    rows.forEach(tr => {
      const inputs = tr.querySelectorAll('input');
      if (inputs.length >= 5) {
        currentPreviewRecords.push({
          registration_no: inputs[0].value.trim(),
          student_name: inputs[1].value.trim(),
          father_name: inputs[2].value.trim(),
          phone: inputs[3].value.trim(),
          father_phone: inputs[4].value.trim(),
          program_code: inputs[5] ? inputs[5].value.trim() : 'BSCS',
          current_semester: 1
        });
      }
    });
  }

  let isConfirmedSuccess = false;

  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.className = 'px-6 py-2.5 bg-amber-600 text-white rounded-xl text-xs font-bold transition shadow-lg flex items-center gap-2 cursor-wait';
    confirmBtn.innerHTML = `
      <div class="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
      <span id="confirm-btn-label">Committing data to MySQL Database...</span>
    `;
  }

  try {
    const res = await adminFetch('/api/admin/upload/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uploadId: currentPreviewUploadId,
        records: currentPreviewRecords,
        detectedType: currentPreviewType
      })
    });
    const data = await res.json();

    if (data.success) {
      isConfirmedSuccess = true;
      const savedCount = data.savedCount || currentPreviewRecords.length;

      // 1. Permanently update button to GREEN "Thank You - Data Successfully Saved in Database"
      if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.className = 'px-6 py-2.5 bg-emerald-500 text-slate-950 font-black rounded-xl text-xs shadow-[0_0_25px_rgba(16,185,129,0.9)] flex items-center gap-2 cursor-default transition';
        confirmBtn.innerHTML = `
          <svg class="w-4 h-4 text-slate-950" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>
          <span id="confirm-btn-label">✓ Thank You - Data Successfully Saved in Database</span>
        `;
      }

      // Update indicator dot & header text to Green
      const indDot = document.getElementById('preview-indicator-dot');
      if (indDot) indDot.className = 'w-3 h-3 rounded-full bg-emerald-400';
      const hText = document.getElementById('preview-heading-text');
      if (hText) hText.innerText = 'Extracted Data Preview (✓ Successfully Saved to MySQL Database)';

      // 2. Render prominent Success Banner at top of preview area
      const successContainer = document.getElementById('commit-success-container');
      if (successContainer) {
        successContainer.innerHTML = `
          <div class="mb-4 p-5 rounded-2xl bg-gradient-to-r from-emerald-950/95 via-emerald-900/90 to-slate-900 border-2 border-emerald-400 text-emerald-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-2xl">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-emerald-300 shrink-0">
                <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
              </div>
              <div>
                <h4 class="text-base font-black text-white flex items-center gap-2">
                  <span>Thank You for Submitting the Data!</span>
                  <span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-400 text-slate-950">✓ Committed to MySQL</span>
                </h4>
                <p class="text-xs text-emerald-200 mt-1">
                  All <strong>${savedCount} records</strong> have been successfully processed and permanently stored into the Cloud MySQL database.
                </p>
              </div>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <button onclick="window.switchAdminTab('students')" class="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs shadow-lg transition flex items-center gap-1.5">
                <span>Open Student Registry (${savedCount})</span>
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
              </button>
            </div>
          </div>
        `;
      }

      // 3. Update all table row validation badges to "✓ Saved in Database"
      const validationBadges = document.querySelectorAll('.preview-validation-badge');
      validationBadges.forEach(badge => {
        badge.className = 'preview-validation-badge px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 inline-flex items-center gap-1';
        badge.innerHTML = `<svg class="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg> <span>Saved in Database</span>`;
      });

      // 4. Update KPI numbers and Student Registry list in real-time
      if (typeof window.loadAdminDashboardStats === 'function') {
        window.loadAdminDashboardStats();
      }
      if (typeof window.loadStudentManager === 'function') {
        window.loadStudentManager();
      }
    } else {
      alert(`Error: ${data.error}`);
    }
  } catch (err) {
    alert(`Confirmation error: ${err.message}`);
  } finally {
    if (!isConfirmedSuccess && confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.className = 'px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-red-900/50 flex items-center gap-2 cursor-pointer';
      confirmBtn.innerHTML = `
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
        <span id="confirm-btn-label">Confirm &amp; Commit to Database</span>
      `;
    }
  }
};

window.updatePreviewRow = function(idx, field, value) {
  if (currentPreviewRecords[idx]) {
    currentPreviewRecords[idx][field] = value;
  }
};

window.loadAtRiskReport = async function() {
  const container = document.getElementById('atrisk-report-container');
  if (!container) return;
  container.innerHTML = '<div class="p-6 text-center text-slate-400"><div class="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-sky-400 mb-2"></div><br/>Analyzing institutional data for at-risk flags...</div>';

  try {
    const res = await adminFetch('/api/admin/ai/at-risk');
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    if (data.totalFlagged === 0) {
      container.innerHTML = `
        <div class="p-8 rounded-xl bg-slate-800/40 border border-slate-700 text-center space-y-2">
          <div class="inline-flex p-3 rounded-full bg-emerald-500/20 text-emerald-400 mb-1">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
          </div>
          <h4 class="text-sm font-bold text-white">All Clear — No At-Risk Students</h4>
          <p class="text-slate-400 text-xs">All registered students currently maintain required academic standing and attendance thresholds.</p>
        </div>
      `;
      return;
    }

    let html = `
      <div class="space-y-6">
        <div class="p-5 rounded-xl bg-slate-800 border border-red-500/30 text-xs space-y-2">
          <div class="flex justify-between items-center">
            <span class="font-bold text-red-400 uppercase tracking-wide">Institutional Academic Council Risk Assessment</span>
            <span class="px-2.5 py-1 bg-red-500/20 text-red-400 font-bold rounded">${data.totalFlagged} Students Flagged</span>
          </div>
          <div class="text-slate-300 leading-relaxed space-y-2 mt-2">
            ${formatMarkdown(data.aiSummary)}
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    `;

    data.students.forEach(s => {
      html += `
        <div class="p-4 rounded-xl bg-slate-800/40 border border-slate-700 space-y-2 text-xs">
          <div class="flex justify-between items-start">
            <div>
              <span class="font-bold text-slate-200 text-sm">${escapeHtml(s.name)}</span>
              <p class="text-slate-400 font-mono">${escapeHtml(s.registration_no)} | ${escapeHtml(s.program_code)}</p>
            </div>
            <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">Action Needed</span>
          </div>
          <div class="p-2.5 rounded bg-slate-900/60 border border-slate-800 space-y-1">
            <p class="text-slate-400">Father: <strong class="text-slate-300">${escapeHtml(s.father_name || '—')}</strong></p>
            <p class="text-slate-400">Attendance: <strong class="${s.attendance_pct < 75 ? 'text-red-400' : 'text-slate-200'}">${s.attendance_pct}%</strong></p>
            <p class="text-slate-400">CGPA: <strong class="${s.cgpa < 2.0 ? 'text-red-400' : 'text-slate-200'}">${Number(s.cgpa).toFixed(2)}</strong></p>
          </div>
          <div class="space-y-1 pt-1">
            <strong class="text-[10px] text-slate-400 uppercase">Risk Factors:</strong>
            ${(s.risk_factors || []).map(r => `<div class="text-red-300 font-medium">• ${escapeHtml(r)}</div>`).join('')}
          </div>
        </div>
      `;
    });

    html += `</div></div>`;
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<div class="p-6 text-red-400">Failed to load at-risk report: ${err.message}</div>`;
  }
};

window.filterStudentTable = function(query) {
  const q = (query || '').toLowerCase().trim();
  const rows = document.querySelectorAll('.student-row');
  rows.forEach(r => {
    const text = r.getAttribute('data-search') || '';
    if (!q || text.includes(q)) {
      r.style.display = '';
    } else {
      r.style.display = 'none';
    }
  });
};

window.loadStudentManager = async function() {
  const container = document.getElementById('student-manager-container');
  if (!container) return;
  container.innerHTML = '<div class="p-6 text-center text-slate-400"><div class="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-sky-400 mb-2"></div><br/>Loading student registry from MySQL...</div>';

  try {
    const res = await adminFetch('/api/admin/students');
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    if (!data.students || data.students.length === 0) {
      container.innerHTML = `
        <div class="p-8 rounded-xl bg-slate-800/40 border border-slate-700 text-center space-y-3">
          <p class="text-slate-400 text-xs">No students currently exist in the database.</p>
          <button onclick="window.switchAdminTab('upload')" class="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold transition">
            Go to Upload Tab to Ingest Students (Excel / PDF)
          </button>
        </div>
      `;
      return;
    }

    let html = `
      <div class="space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-3 bg-slate-800/60 p-3 rounded-xl border border-slate-700">
          <div class="flex items-center gap-2">
            <span class="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold text-xs border border-emerald-500/30">
              Total Students: ${data.students.length}
            </span>
            <span class="text-xs text-slate-400 hidden sm:inline">All profiles synced with MySQL</span>
          </div>
          <input type="text" id="student-search-box" oninput="window.filterStudentTable(this.value)" placeholder="Search by Name, Reg No or Father Name..." class="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 w-72 focus:outline-none focus:border-sky-500" />
        </div>

        <div class="rounded-xl border border-slate-700 overflow-x-auto bg-slate-800/40 max-h-[600px] overflow-y-auto">
          <table class="w-full text-left text-xs text-slate-300 whitespace-nowrap">
            <thead class="bg-slate-900 text-slate-400 font-bold border-b border-slate-700 sticky top-0 z-10 shadow-sm">
              <tr>
                <th class="py-2.5 px-3 min-w-[40px]">#</th>
                <th class="py-2.5 px-3 min-w-[130px] whitespace-nowrap">Reg No</th>
                <th class="py-2.5 px-3 min-w-[150px] whitespace-nowrap">Student Name</th>
                <th class="py-2.5 px-3 min-w-[150px] whitespace-nowrap">Father's Name</th>
                <th class="py-2.5 px-3 min-w-[120px] whitespace-nowrap">Student Contact</th>
                <th class="py-2.5 px-3 min-w-[120px] whitespace-nowrap">Father's Contact</th>
                <th class="py-2.5 px-2 text-center min-w-[120px] whitespace-nowrap">Batch / Program</th>
                <th class="py-2.5 px-2 text-center min-w-[50px] whitespace-nowrap">Sem</th>
                <th class="py-2.5 px-3 min-w-[80px] whitespace-nowrap">Status</th>
                <th class="py-2.5 px-3 text-right min-w-[120px] whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-700/50">
    `;

    data.students.forEach((s, idx) => {
      const searchData = `${s.name} ${s.registration_no} ${s.father_name || ''} ${s.phone || ''} ${s.father_phone || ''}`.toLowerCase();
      html += `
        <tr class="hover:bg-slate-800/40 student-row" data-search="${escapeHtml(searchData)}">
          <td class="py-2.5 px-3 text-slate-500 whitespace-nowrap">${idx + 1}</td>
          <td class="py-2.5 px-3 font-bold text-sky-400 font-mono whitespace-nowrap">${escapeHtml(s.registration_no)}</td>
          <td class="py-2.5 px-3 font-semibold text-white whitespace-nowrap">${escapeHtml(s.name)}</td>
          <td class="py-2.5 px-3 text-slate-300 whitespace-nowrap">${escapeHtml(s.father_name || '—')}</td>
          <td class="py-2.5 px-3 text-sky-300 font-mono font-medium whitespace-nowrap">${escapeHtml(s.phone || '—')}</td>
          <td class="py-2.5 px-3 text-emerald-300 font-mono font-medium whitespace-nowrap">${escapeHtml(s.father_phone || '—')}</td>
          <td class="py-2.5 px-2 text-center text-slate-300 whitespace-nowrap">${escapeHtml(s.batch || '')} <span class="text-[10px] text-slate-400">(${escapeHtml(s.program_code)})</span></td>
          <td class="py-2.5 px-2 text-center font-bold text-slate-200 whitespace-nowrap">${s.current_semester || 1}</td>
          <td class="py-2.5 px-3 whitespace-nowrap"><span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">${escapeHtml(s.status || 'Active')}</span></td>
          <td class="py-2.5 px-3 text-right whitespace-nowrap">
            <div class="flex justify-end items-center gap-1.5">
              <button onclick="window.promptEditStudent(${s.id})" class="px-2.5 py-1 bg-sky-600/20 hover:bg-sky-600 text-sky-300 hover:text-white rounded text-[11px] font-semibold border border-sky-500/30 transition">
                Edit
              </button>
              <button onclick="window.handleDeleteStudent(${s.id}, '${escapeHtml(s.name).replace(/'/g, "\\'")}', '${escapeHtml(s.registration_no)}')" class="px-2.5 py-1 bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white rounded text-[11px] font-semibold border border-red-500/30 transition" title="Delete this student">
                Delete
              </button>
            </div>
          </td>
        </tr>
      `;
    });

    html += `</tbody></table></div></div>`;
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<div class="p-6 text-red-400 bg-red-950/30 border border-red-500/40 rounded-xl">Failed to load student registry: ${err.message}</div>`;
  }
};

window.promptEditStudent = async function(id) {
  try {
    const res = await adminFetch('/api/admin/students');
    const data = await res.json();
    const student = (data.students || []).find(s => s.id === id);
    if (!student) return alert('Student record not found.');

    document.getElementById('edit-student-id').value = student.id;
    document.getElementById('edit-modal-reg').innerText = `Registration: ${student.registration_no} (${student.program_code || 'BSCS'}, Batch ${student.batch || '2023'})`;
    document.getElementById('edit-student-name').value = student.name || '';
    document.getElementById('edit-father-name').value = student.father_name || '';
    document.getElementById('edit-student-phone').value = student.phone || '';
    document.getElementById('edit-father-phone').value = student.father_phone || '';
    document.getElementById('edit-student-email').value = student.email || '';
    document.getElementById('edit-current-semester').value = student.current_semester || 1;
    document.getElementById('edit-student-status').value = student.status || 'Active';

    const errBox = document.getElementById('edit-modal-error');
    if (errBox) errBox.classList.add('hidden');

    const modal = document.getElementById('student-edit-modal');
    if (modal) modal.classList.remove('hidden');
  } catch (err) {
    alert(`Could not open student edit modal: ${err.message}`);
  }
};

window.closeEditStudentModal = function() {
  const modal = document.getElementById('student-edit-modal');
  if (modal) modal.classList.add('hidden');
};

window.filterCoursesTable = function(query) {
  const q = (query || '').toLowerCase().trim();
  const rows = document.querySelectorAll('.course-catalog-row');
  let visible = 0;
  rows.forEach(r => {
    const text = r.getAttribute('data-search') || '';
    if (!q || text.includes(q)) {
      r.style.display = '';
      visible++;
    } else {
      r.style.display = 'none';
    }
  });
  const countEl = document.getElementById('courses-visible-count');
  if (countEl) countEl.innerText = `${visible} Courses`;
};

window.loadCoursesCatalog = async function() {
  const container = document.getElementById('courses-manager-container');
  if (!container) return;
  container.innerHTML = '<div class="p-6 text-center text-slate-400"><div class="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-400 mb-2"></div><br/>Loading active courses curriculum from MySQL...</div>';

  try {
    const res = await adminFetch('/api/admin/courses');
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    if (!data.courses || data.courses.length === 0) {
      container.innerHTML = `
        <div class="p-8 rounded-xl bg-slate-800/40 border border-slate-700 text-center space-y-3">
          <p class="text-slate-400 text-xs">No active courses registered in the system.</p>
        </div>
      `;
      return;
    }

    const totalCourses = data.courses.length;
    const departments = [...new Set(data.courses.map(c => c.department || 'Computer Science'))];

    let html = `
      <div class="space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3 bg-slate-800/60 p-4 rounded-xl border border-slate-700">
          <div class="flex items-center gap-2">
            <span id="courses-visible-count" class="px-3 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 font-bold text-xs border border-indigo-500/30">
              ${totalCourses} Courses
            </span>
            <span class="text-xs text-slate-400 hidden sm:inline">• ${departments.length} Academic Departments</span>
          </div>
          <input type="text" id="courses-search-box" oninput="window.filterCoursesTable(this.value)" placeholder="Search by Course Code, Title, or Dept..." class="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 w-72 focus:outline-none focus:border-indigo-500" />
        </div>

        <div class="rounded-xl border border-slate-700 overflow-x-auto bg-slate-800/40 max-h-[600px] overflow-y-auto">
          <table class="w-full text-left text-xs text-slate-300">
            <thead class="bg-slate-900 text-slate-400 font-bold border-b border-slate-700 sticky top-0 z-10 shadow-sm">
              <tr>
                <th class="py-2.5 px-3">#</th>
                <th class="py-2.5 px-3">Course Code</th>
                <th class="py-2.5 px-3">Course Title</th>
                <th class="py-2.5 px-2 text-center">Credit Hours</th>
                <th class="py-2.5 px-2 text-center">Teaching Load</th>
                <th class="py-2.5 px-3">Department</th>
                <th class="py-2.5 px-3">Prerequisite</th>
                <th class="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-700/50">
    `;

    data.courses.forEach((c, idx) => {
      const searchData = `${c.code} ${c.title} ${c.department || ''} ${c.prerequisite || ''}`.toLowerCase();
      html += `
        <tr class="hover:bg-slate-800/40 course-catalog-row" data-search="${escapeHtml(searchData)}">
          <td class="py-2.5 px-3 text-slate-500">${idx + 1}</td>
          <td class="py-2.5 px-3 font-bold text-indigo-400 font-mono">${escapeHtml(c.code)}</td>
          <td class="py-2.5 px-3 font-semibold text-white">${escapeHtml(c.title)}</td>
          <td class="py-2.5 px-2 text-center"><span class="px-2 py-0.5 rounded text-[11px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">${c.credit_hours || 3} CH</span></td>
          <td class="py-2.5 px-2 text-center text-slate-300 font-mono text-[11px]">${c.lecture_hours || 3}h Lec ${c.lab_hours ? `+ ${c.lab_hours}h Lab` : ''}</td>
          <td class="py-2.5 px-3 text-slate-300">${escapeHtml(c.department || 'Department of Computer Science')}</td>
          <td class="py-2.5 px-3 text-slate-400 italic">${escapeHtml(c.prerequisite || 'None')}</td>
          <td class="py-2.5 px-3 text-right">
            <button onclick="window.handleDeleteCourse('${escapeHtml(c.code)}', '${escapeHtml(c.title || '')}')" class="px-2 py-1 bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white rounded-lg text-xs font-semibold border border-red-500/30 transition">
              🗑️ Delete
            </button>
          </td>
        </tr>
      `;
    });

    html += `</tbody></table></div></div>`;
    container.innerHTML = html;
  } catch (err) {
    console.error('[Admin] Error loading courses catalog:', err);
    container.innerHTML = `<div class="p-6 text-center text-red-400 text-xs">Failed to load courses catalog: ${escapeHtml(err.message)}</div>`;
  }
};

window.loadAuditLogs = async function() {
  const container = document.getElementById('audit-logs-container');
  if (!container) return;
  container.innerHTML = '<div class="p-6 text-center text-slate-400"><div class="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-sky-400 mb-2"></div><br/>Loading audit log entries...</div>';

  try {
    const res = await adminFetch('/api/admin/audit-logs');
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    if (!data.logs || data.logs.length === 0) {
      container.innerHTML = '<div class="p-6 text-center text-slate-500 text-xs">No audit logs recorded yet.</div>';
      return;
    }

    let html = `
      <div class="rounded-xl border border-slate-700 overflow-x-auto bg-slate-800/40 max-h-[600px] overflow-y-auto">
        <table class="w-full text-left text-xs text-slate-300">
          <thead class="bg-slate-900 text-slate-400 font-bold border-b border-slate-700 sticky top-0 z-10 shadow-sm">
            <tr>
              <th class="py-2.5 px-3">Timestamp</th>
              <th class="py-2.5 px-3">Admin</th>
              <th class="py-2.5 px-3">Action</th>
              <th class="py-2.5 px-3">Target</th>
              <th class="py-2.5 px-3">Details</th>
              <th class="py-2.5 px-3">IP Address</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-700/50">
    `;

    data.logs.forEach(l => {
      html += `
        <tr class="hover:bg-slate-800/30">
          <td class="py-2 px-3 text-slate-400">${new Date(l.created_at).toLocaleString()}</td>
          <td class="py-2 px-3 font-semibold text-sky-300">${escapeHtml(l.admin_username)}</td>
          <td class="py-2 px-3 font-bold text-slate-200">${escapeHtml(l.action)}</td>
          <td class="py-2 px-3 text-slate-400">${escapeHtml(l.target_table || '—')} #${l.target_id || ''}</td>
          <td class="py-2 px-3 text-slate-300">${escapeHtml(l.details || '—')}</td>
          <td class="py-2 px-3 text-slate-500 font-mono">${escapeHtml(l.ip_address || '—')}</td>
        </tr>
      `;
    });

    html += `</tbody></table></div>`;
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<div class="p-6 text-red-400">Failed to load audit logs: ${err.message}</div>`;
  }
};

window.loadAdminDashboardStats = async function() {
  try {
    if (window.loadDbStatus) window.loadDbStatus();
    const res = await adminFetch('/api/admin/stats');
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    const sEl = document.getElementById('stat-students-count');
    const uEl = document.getElementById('stat-uploads-count');
    const cEl = document.getElementById('stat-courses-count');
    const aEl = document.getElementById('stat-atrisk-count');

    if (sEl) sEl.innerText = data.counts.students;
    if (uEl) uEl.innerText = data.counts.uploads;
    if (cEl) cEl.innerText = data.counts.courses;
    if (aEl) aEl.innerText = data.counts.atRiskStudents;

    if (window.loadUploadHistory) window.loadUploadHistory();
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
};

window.loadUploadHistory = async function() {
  try {
    const res = await adminFetch('/api/admin/upload/history');
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    const tbody = document.getElementById('upload-history-tbody');
    if (!tbody) return;

    if (!data.uploads || data.uploads.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="py-4 text-center text-slate-500 text-xs">No upload history found.</td></tr>`;
      return;
    }

    let html = '';
    data.uploads.forEach(u => {
      const isDeleted = u.status === 'deleted';
      const isConfirmed = u.status === 'confirmed';
      html += `
        <tr class="hover:bg-slate-800/40 text-xs text-slate-300">
          <td class="py-2.5 px-3 font-semibold text-slate-200">${escapeHtml(u.original_filename)}</td>
          <td class="py-2.5 px-3 text-slate-400">${escapeHtml(u.instruction || 'None')}</td>
          <td class="py-2.5 px-3 uppercase text-sky-400 font-bold">${escapeHtml(u.detected_type || u.file_type)}</td>
          <td class="py-2.5 px-3">${new Date(u.created_at).toLocaleString()}</td>
          <td class="py-2.5 px-3">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold ${isDeleted ? 'bg-red-500/20 text-red-400 border border-red-500/30' : (isConfirmed ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30')}">
              ${(u.status || 'preview').toUpperCase()} (${u.record_count} records)
            </span>
          </td>
          <td class="py-2.5 px-3 text-right">
            ${!isDeleted ? `
              <button onclick="window.handleDeleteUpload(${u.id})" class="px-2.5 py-1 bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white rounded text-[11px] font-semibold transition border border-red-500/30">
                Rollback / Delete
              </button>
            ` : '<span class="text-slate-500 text-[11px]">Purged</span>'}
          </td>
        </tr>
      `;
    });
    tbody.innerHTML = html;
  } catch (err) {
    console.error('Failed to load history:', err);
  }
};

// ============================================================================
// LIFECYCLE & EVENT LISTENERS
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  checkAdminSession();
  setupAdminEventListeners();
  if (window.loadDbStatus) window.loadDbStatus();
  // Poll DB status every 30s to keep dot real-time
  setInterval(() => {
    if (window.loadDbStatus) window.loadDbStatus();
  }, 30000);
});

function initTheme() {
  const saved = localStorage.getItem('gtiu_theme') || 'dark';
  if (saved === 'light') {
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
  } else {
    document.documentElement.classList.remove('light');
    document.documentElement.classList.add('dark');
  }
}

async function checkAdminSession() {
  try {
    const res = await fetch('/api/admin/me', { headers: { 'Accept': 'application/json' } });
    const data = await res.json();
    if (data.authenticated && data.admin) {
      currentAdmin = data.admin;
      showAdminDashboard();
      if (window.loadAdminDashboardStats) window.loadAdminDashboardStats();
    } else {
      showAdminLogin();
    }
  } catch (err) {
    showAdminLogin();
  }
}

function showAdminLogin() {
  currentAdmin = null;
  const loginView = document.getElementById('admin-login-view');
  const dashView = document.getElementById('admin-dashboard-view');
  const navUser = document.getElementById('admin-nav-user');
  const logoutBtn = document.getElementById('admin-logout-btn');
  if (loginView) loginView.classList.remove('hidden');
  if (dashView) dashView.classList.add('hidden');
  if (navUser) navUser.classList.add('hidden');
  if (logoutBtn) logoutBtn.classList.add('hidden');
}

function showAdminDashboard() {
  const loginView = document.getElementById('admin-login-view');
  const dashView = document.getElementById('admin-dashboard-view');
  const navUser = document.getElementById('admin-nav-user');
  const logoutBtn = document.getElementById('admin-logout-btn');
  if (loginView) loginView.classList.add('hidden');
  if (dashView) dashView.classList.remove('hidden');
  if (navUser) {
    navUser.classList.remove('hidden');
    navUser.innerText = currentAdmin?.username || 'Admin';
  }
  if (logoutBtn) logoutBtn.classList.remove('hidden');

  // Load live DB status
  if (window.loadDbStatus) window.loadDbStatus();

  // Default to upload tab for easy data entry
  window.switchAdminTab('upload');
}

async function handleFileUpload(e) {
  e.preventDefault();
  const fileInput = document.getElementById('upload-file-input');
  const instructionInput = document.getElementById('upload-instruction-input');
  const statusBox = document.getElementById('upload-status-box');
  const previewArea = document.getElementById('upload-preview-area');

  if (!fileInput.files || fileInput.files.length === 0) {
    alert('Please select a file (PDF, Excel, Word, or PowerPoint).');
    return;
  }

  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  formData.append('instruction', instructionInput ? instructionInput.value : '');

  statusBox.classList.remove('hidden');
  statusBox.innerHTML = `
    <div class="flex items-center gap-3 text-sky-400 text-xs">
      <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-sky-400"></div>
      <span>Extracting student names, father names & contact numbers with Institutional Ingestion Engine...</span>
    </div>
  `;
  if (previewArea) previewArea.classList.add('hidden');

  try {
    const res = await adminFetch('/api/admin/upload', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();

    if (!data.success) {
      statusBox.innerHTML = `<span class="text-red-400 text-xs">Extraction Failed: ${data.error}</span>`;
      return;
    }

    statusBox.classList.add('hidden');
    renderPreviewTable(data);
  } catch (err) {
    statusBox.innerHTML = `<span class="text-red-400 text-xs">Upload error: ${err.message}</span>`;
  }
}

function renderPreviewTable(data) {
  currentPreviewUploadId = data.uploadId;
  currentPreviewRecords = data.records;
  currentPreviewType = data.detectedType;

  const previewArea = document.getElementById('upload-preview-area');
  const tableContainer = document.getElementById('preview-table-container');
  const summaryText = document.getElementById('preview-summary-text');
  const successContainer = document.getElementById('commit-success-container');
  if (successContainer) successContainer.innerHTML = '';

  const confirmBtn = document.getElementById('confirm-upload-btn');
  if (confirmBtn) {
    confirmBtn.disabled = false;
    confirmBtn.setAttribute('data-upload-id', data.uploadId);
    confirmBtn.className = 'px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-red-900/50 flex items-center gap-2 cursor-pointer';
    confirmBtn.innerHTML = `
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
      <span id="confirm-btn-label">Confirm &amp; Commit to Database</span>
    `;
  }

  const indDot = document.getElementById('preview-indicator-dot');
  if (indDot) indDot.className = 'w-3 h-3 rounded-full bg-red-500 animate-pulse';
  const hText = document.getElementById('preview-heading-text');
  if (hText) hText.innerText = 'Extracted Data Preview (Review & Click Red Button to Commit to MySQL)';

  if (previewArea) {
    previewArea.setAttribute('data-upload-id', data.uploadId);
  }
  localStorage.setItem('gtiu_current_upload_id', data.uploadId);

  let warningsHtml = '';
  if (data.warnings && data.warnings.length > 0) {
    warningsHtml = `
      <div class="mt-2 p-3 rounded-xl bg-amber-950/70 border border-amber-500/50 text-amber-200 text-xs flex items-center gap-2">
        <svg class="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
        <span>${data.warnings.map(escapeHtml).join('<br>')}</span>
      </div>
    `;
  }

  summaryText.innerHTML = `
    <strong>Detected Type:</strong> <span class="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-bold">${data.detectedType.toUpperCase()}</span> | 
    <strong>Records Extracted:</strong> ${data.records.length} | 
    <span class="text-slate-400">${data.summary || ''}</span>
    ${warningsHtml}
  `;

  let html = '';

  // If detected type is students list
  if (data.detectedType === 'students' || data.detectedType === 'student_list') {
    html = `
      <table class="w-full text-left text-xs text-slate-300">
        <thead class="bg-slate-900 text-slate-400 font-bold border-b border-slate-700">
          <tr>
            <th class="py-2 px-3">Reg No</th>
            <th class="py-2 px-3">Student Name</th>
            <th class="py-2 px-3">Father's Name</th>
            <th class="py-2 px-3">Student Contact / Phone</th>
            <th class="py-2 px-3">Father's Contact / Phone</th>
            <th class="py-2 px-2 text-center">Program</th>
            <th class="py-2 px-3">Validation</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-700/60">
    `;

    data.records.forEach((r, idx) => {
      html += `
        <tr class="hover:bg-slate-800/40">
          <td class="py-2 px-3">
            <input type="text" value="${escapeHtml(r.registration_no || '')}" onchange="window.updatePreviewRow(${idx}, 'registration_no', this.value)" class="bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-sky-300 font-semibold w-32" />
          </td>
          <td class="py-2 px-3">
            <input type="text" value="${escapeHtml(r.student_name || r.name || '')}" onchange="window.updatePreviewRow(${idx}, 'student_name', this.value)" class="bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-white font-medium w-36" />
          </td>
          <td class="py-2 px-3">
            <input type="text" value="${escapeHtml(r.father_name || '')}" onchange="window.updatePreviewRow(${idx}, 'father_name', this.value)" class="bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-slate-300 w-36" />
          </td>
          <td class="py-2 px-3">
            <input type="text" value="${escapeHtml(r.phone || r.student_phone || '')}" onchange="window.updatePreviewRow(${idx}, 'phone', this.value)" class="bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-sky-400 font-mono w-32" />
          </td>
          <td class="py-2 px-3">
            <input type="text" value="${escapeHtml(r.father_phone || r.guardian_phone || '')}" onchange="window.updatePreviewRow(${idx}, 'father_phone', this.value)" class="bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-emerald-400 font-mono w-32" />
          </td>
          <td class="py-2 px-2 text-center">
            <input type="text" value="${escapeHtml(r.program_code || 'BSCS')}" onchange="window.updatePreviewRow(${idx}, 'program_code', this.value)" class="bg-slate-800 border border-slate-700 rounded px-1 py-0.5 text-xs text-center w-16" />
          </td>
          <td class="py-2 px-3 text-xs">
            <span class="preview-validation-badge text-emerald-400 font-semibold">Ready to Save</span>
          </td>
        </tr>
      `;
    });
  } else {
    // Marks or Attendance Table
    html = `
      <table class="w-full text-left text-xs text-slate-300">
        <thead class="bg-slate-900 text-slate-400 font-bold border-b border-slate-700">
          <tr>
            <th class="py-2 px-3">Reg No</th>
            <th class="py-2 px-3">Student Name</th>
            <th class="py-2 px-3">Father Name</th>
            <th class="py-2 px-2 text-center">Assign</th>
            <th class="py-2 px-2 text-center">Quiz</th>
            <th class="py-2 px-2 text-center">Mid</th>
            <th class="py-2 px-2 text-center">Final</th>
            <th class="py-2 px-2 text-center">Total / Att</th>
            <th class="py-2 px-3">Flags & Validation</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-700/60">
    `;

    data.records.forEach((r, idx) => {
      const hasFlags = r.flags && r.flags.length > 0;
      const hasImpossible = r.flags && r.flags.some(f => f.includes('Impossible'));
      const rowBg = hasImpossible ? 'bg-red-950/30' : (hasFlags ? 'bg-amber-950/20' : 'hover:bg-slate-800/40');

      html += `
        <tr class="${rowBg}">
          <td class="py-2 px-3">
            <input type="text" value="${escapeHtml(r.registration_no || '')}" onchange="window.updatePreviewRow(${idx}, 'registration_no', this.value)" class="bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-sky-300 font-semibold w-32" />
          </td>
          <td class="py-2 px-3">
            <input type="text" value="${escapeHtml(r.student_name || '')}" onchange="window.updatePreviewRow(${idx}, 'student_name', this.value)" class="bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-slate-200 w-28" />
          </td>
          <td class="py-2 px-3">
            <input type="text" value="${escapeHtml(r.father_name || '')}" onchange="window.updatePreviewRow(${idx}, 'father_name', this.value)" class="bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-slate-200 w-28" />
          </td>
          <td class="py-2 px-2 text-center">
            <input type="number" step="0.5" value="${r.assignment_marks || 0}" onchange="window.updatePreviewRow(${idx}, 'assignment_marks', this.value)" class="bg-slate-800 border border-slate-700 rounded px-1 py-0.5 text-xs text-center w-14" />
          </td>
          <td class="py-2 px-2 text-center">
            <input type="number" step="0.5" value="${r.quiz_marks || 0}" onchange="window.updatePreviewRow(${idx}, 'quiz_marks', this.value)" class="bg-slate-800 border border-slate-700 rounded px-1 py-0.5 text-xs text-center w-14" />
          </td>
          <td class="py-2 px-2 text-center">
            <input type="number" step="0.5" value="${r.mid_marks || 0}" onchange="window.updatePreviewRow(${idx}, 'mid_marks', this.value)" class="bg-slate-800 border border-slate-700 rounded px-1 py-0.5 text-xs text-center w-14" />
          </td>
          <td class="py-2 px-2 text-center">
            <input type="number" step="0.5" value="${r.final_marks || 0}" onchange="window.updatePreviewRow(${idx}, 'final_marks', this.value)" class="bg-slate-800 border border-slate-700 rounded px-1 py-0.5 text-xs text-center w-14" />
          </td>
          <td class="py-2 px-2 text-center">
            <input type="number" step="0.5" value="${r.total_obtained || (r.attendance_present ? r.attendance_present : 0)}" onchange="window.updatePreviewRow(${idx}, 'total_obtained', this.value)" class="bg-slate-800 border border-slate-700 rounded px-1 py-0.5 text-xs text-center font-bold text-white w-16" />
          </td>
          <td class="py-2 px-3 text-xs">
            ${hasFlags ? `<span class="preview-validation-badge ${hasImpossible ? 'text-red-400' : 'text-amber-400'} font-semibold">${r.flags.map(escapeHtml).join('; ')}</span>` : '<span class="preview-validation-badge text-emerald-400 font-semibold">Verified</span>'}
          </td>
        </tr>
      `;
    });
  }

  html += `</tbody></table>`;
  tableContainer.innerHTML = html;
  previewArea.classList.remove('hidden');
}

function setupAdminEventListeners() {
  const loginForm = document.getElementById('admin-login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errBox = document.getElementById('admin-login-error');
      if (errBox) errBox.classList.add('hidden');

      const username = document.getElementById('admin-username').value;
      const password = document.getElementById('admin-password').value;

      try {
        const res = await fetch('/api/admin/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (data.success && data.admin) {
          currentAdmin = data.admin;
          showAdminDashboard();
          if (window.loadAdminDashboardStats) window.loadAdminDashboardStats();
        } else {
          if (errBox) {
            errBox.innerText = data.error || 'Authentication failed.';
            errBox.classList.remove('hidden');
          }
        }
      } catch (err) {
        if (errBox) {
          errBox.innerText = 'Network error during sign in.';
          errBox.classList.remove('hidden');
        }
      }
    });
  }

  const logoutBtn = document.getElementById('admin-logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await fetch('/api/admin/logout', { method: 'POST', headers: { 'Accept': 'application/json' } });
      window.location.reload();
    });
  }

  const uploadForm = document.getElementById('admin-upload-form');
  if (uploadForm) {
    uploadForm.addEventListener('submit', handleFileUpload);
  }

  // Student Profile Edit Modal Form (Ghalti No. 9 Fix)
  const studentEditForm = document.getElementById('student-edit-form');
  if (studentEditForm) {
    studentEditForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('edit-student-id').value;
      const name = document.getElementById('edit-student-name').value.trim();
      const father_name = document.getElementById('edit-father-name').value.trim();
      const phone = document.getElementById('edit-student-phone').value.trim();
      const father_phone = document.getElementById('edit-father-phone').value.trim();
      const email = document.getElementById('edit-student-email').value.trim();
      const current_semester = parseInt(document.getElementById('edit-current-semester').value) || 1;
      const status = document.getElementById('edit-student-status').value;

      const saveBtn = document.getElementById('edit-save-btn');
      const errBox = document.getElementById('edit-modal-error');
      if (errBox) errBox.classList.add('hidden');
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerText = 'Saving...';
      }

      try {
        const updateRes = await adminFetch(`/api/admin/students/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            father_name,
            phone,
            father_phone,
            email,
            current_semester,
            status
          })
        });
        const updateData = await updateRes.json();
        if (updateData.success) {
          window.closeEditStudentModal();
          if (window.loadStudentManager) window.loadStudentManager();
          if (window.loadAdminDashboardStats) window.loadAdminDashboardStats();
        } else {
          if (errBox) {
            errBox.innerText = updateData.error || 'Failed to update student.';
            errBox.classList.remove('hidden');
          }
        }
      } catch (err) {
        if (errBox) {
          errBox.innerText = `Update error: ${err.message}`;
          errBox.classList.remove('hidden');
        }
      } finally {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.innerText = 'Save Changes';
        }
      }
    });
  }

  // Explicit event listeners for all Admin tabs (bulletproof backup to inline onclick)
  const tabNames = ['upload', 'students', 'courses', 'overview', 'search', 'atrisk', 'audit', 'cleanup'];
  tabNames.forEach(t => {
    const btn = document.getElementById(`tab-btn-${t}`);
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        window.switchAdminTab(t);
      });
    }
  });
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
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
    .replace(/###\s+(.*)/g, '<h4 class="font-bold text-sky-400 text-sm mt-3">$1</h4>')
    .replace(/•\s+(.*)/g, '<li class="ml-4 list-disc">$1</li>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
}
