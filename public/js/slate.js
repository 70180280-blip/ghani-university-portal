/**
 * Ghani University Communication Slate Frontend Engine
 * Real-time student & teacher messaging, course groups, assignments, and meeting requests
 */

(function () {
  'use strict';

  // Global Slate State
  window.Slate = {
    currentUser: null,
    activeTab: 'chats', // 'chats', 'channels', 'announcements', 'materials', 'meetings', 'notifications'
    activeConversationId: null,
    activeCourseCode: null,
    conversations: [],
    courseChannels: [],
    messages: [],
    materials: [],
    announcements: [],
    meetings: [],
    notifications: [],
    pollTimer: null,
    replyToMessage: null,
    searchQuery: '',
    isMobileDrawerOpen: false
  };

  const S = window.Slate;

  // Escape HTML helper
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Format timestamp helper
  function formatTime(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function formatDate(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // Toast notification
  function showToast(message, type = 'success') {
    let box = document.getElementById('slate-toast');
    if (!box) {
      box = document.createElement('div');
      box.id = 'slate-toast';
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

  // API Fetch Helper
  async function slateFetch(url, options = {}) {
    options.headers = options.headers || {};
    options.headers['Accept'] = 'application/json';
    const res = await fetch(url, options);
    if (res.status === 401) {
      // Prompt login or redirect
      console.warn('[Slate] Unauthorized session.');
      return res;
    }
    return res;
  }

  // Initialize Slate
  async function initSlate() {
    try {
      const res = await slateFetch('/api/slate/me');
      if (res.status === 401) {
        showAuthPrompt();
        return;
      }
      const data = await res.json();
      if (!data.success) {
        showAuthPrompt();
        return;
      }

      S.currentUser = data.user;
      renderHeaderUser();

      // Read URL query params (e.g. ?tab=materials&course=CS302)
      const urlParams = new URLSearchParams(window.location.search);
      const targetTab = urlParams.get('tab');
      const targetConv = urlParams.get('conversationId');
      const targetCourse = urlParams.get('course');

      if (targetTab) S.activeTab = targetTab;
      if (targetConv) S.activeConversationId = parseInt(targetConv, 10);
      if (targetCourse) S.activeCourseCode = targetCourse;

      switchTab(S.activeTab);
      loadNotifications();

      // Start smart polling (every 3 seconds)
      if (S.pollTimer) clearInterval(S.pollTimer);
      S.pollTimer = setInterval(pollActiveFeed, 3000);
    } catch (err) {
      console.error('[Slate] Init error:', err);
    }
  }

  function showAuthPrompt() {
    const mainView = document.getElementById('slate-main-view');
    const authView = document.getElementById('slate-auth-gate');
    if (mainView) mainView.classList.add('hidden');
    if (authView) authView.classList.remove('hidden');
  }

  function renderHeaderUser() {
    const u = S.currentUser;
    if (!u) return;

    const nameEl = document.getElementById('slate-user-name');
    const roleEl = document.getElementById('slate-user-role');
    const avatarEl = document.getElementById('slate-user-avatar');

    if (nameEl) nameEl.innerText = u.name;
    if (roleEl) roleEl.innerText = u.role === 'Student' ? `Student • ${u.program_code || ''}` : `${u.designation || 'Faculty'} • ${u.department || ''}`;
    if (avatarEl) {
      const initials = u.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
      avatarEl.innerText = initials || 'GU';
    }

    // Role-dependent tab labels
    const directTabLabel = document.getElementById('nav-label-chats');
    if (directTabLabel) {
      directTabLabel.innerText = u.type === 'student' ? 'My Teachers' : 'My Students';
    }
  }

  // Switch Navigation Tabs
  window.switchTab = async function (tabName) {
    S.activeTab = tabName;

    // Update active style on nav buttons
    document.querySelectorAll('.slate-nav-item').forEach(btn => {
      if (btn.getAttribute('data-tab') === tabName) {
        btn.classList.add('bg-[#2563EB]', 'text-white', 'shadow-md');
        btn.classList.remove('text-slate-600', 'dark:text-slate-400', 'hover:bg-slate-200', 'dark:hover:bg-slate-800');
      } else {
        btn.classList.remove('bg-[#2563EB]', 'text-white', 'shadow-md');
        btn.classList.add('text-slate-600', 'dark:text-slate-400', 'hover:bg-slate-200', 'dark:hover:bg-slate-800');
      }
    });

    // Update view panels
    const listPanel = document.getElementById('slate-list-panel');
    const chatPanel = document.getElementById('slate-chat-panel');
    const streamPanel = document.getElementById('slate-stream-panel');

    if (tabName === 'chats' || tabName === 'channels') {
      if (listPanel) listPanel.classList.remove('hidden');
      if (chatPanel) chatPanel.classList.remove('hidden');
      if (streamPanel) streamPanel.classList.add('hidden');
      if (tabName === 'chats') loadConversations();
      if (tabName === 'channels') loadCourseChannels();
    } else {
      // Content tabs: announcements, materials, meetings
      if (listPanel) listPanel.classList.add('hidden');
      if (chatPanel) chatPanel.classList.add('hidden');
      if (streamPanel) streamPanel.classList.remove('hidden');

      if (tabName === 'announcements') renderAnnouncementsFeed();
      if (tabName === 'materials') renderMaterialsFeed();
      if (tabName === 'meetings') renderMeetingsFeed();
      if (tabName === 'notifications') renderNotificationsFeed();
    }
  };

  // 1. Load Conversations (Direct)
  async function loadConversations() {
    const container = document.getElementById('slate-conversations-list');
    if (!container) return;

    try {
      const res = await slateFetch('/api/slate/conversations');
      const data = await res.json();
      if (!data.success) return;

      S.conversations = (data.conversations || []).filter(c => c.type === 'direct');
      renderConversationList();

      // If active conversation set, load it, otherwise load first
      if (S.conversations.length > 0) {
        if (!S.activeConversationId || !S.conversations.some(c => c.id === S.activeConversationId)) {
          openConversation(S.conversations[0].id);
        } else {
          openConversation(S.activeConversationId);
        }
      } else {
        renderEmptyChatWelcome();
      }
    } catch (err) {
      console.error('[Slate] Error loading conversations:', err);
    }
  }

  // 2. Load Course Channels
  async function loadCourseChannels() {
    const container = document.getElementById('slate-conversations-list');
    if (!container) return;

    try {
      const res = await slateFetch('/api/slate/course-channels');
      const data = await res.json();
      if (!data.success) return;

      S.courseChannels = data.courses || [];
      renderCourseChannelList();

      if (S.courseChannels.length > 0) {
        const first = S.courseChannels[0];
        if (first.conversation_id) openConversation(first.conversation_id);
      } else {
        container.innerHTML = `<div class="p-6 text-center text-xs text-slate-400">No enrolled course channels found.</div>`;
      }
    } catch (err) {
      console.error('[Slate] Error loading course channels:', err);
    }
  }

  function renderConversationList() {
    const container = document.getElementById('slate-conversations-list');
    if (!container) return;

    if (S.conversations.length === 0) {
      container.innerHTML = `
        <div class="p-6 text-center text-xs text-slate-400 space-y-3">
          <p>No direct conversations yet.</p>
          ${S.currentUser.type === 'student' ? `
            <button onclick="window.Slate.openNewChatModal()" class="px-3.5 py-1.5 bg-[#2563EB] text-white rounded-lg text-xs font-bold shadow hover:bg-blue-600 transition">
              + Message a Teacher
            </button>
          ` : `
            <button onclick="window.Slate.openNewChatModal()" class="px-3.5 py-1.5 bg-[#2563EB] text-white rounded-lg text-xs font-bold shadow hover:bg-blue-600 transition">
              + Message a Student
            </button>
          `}
        </div>
      `;
      return;
    }

    let html = '';
    S.conversations.forEach(c => {
      const isActive = c.id === S.activeConversationId;
      const unreadBadge = c.unread_count > 0 ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#2563EB] text-white">${c.unread_count}</span>` : '';
      const initials = (c.title || 'GU').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

      html += `
        <div onclick="window.Slate.openConversation(${c.id})"
             class="slate-conv-item p-3.5 flex items-center justify-between gap-3 cursor-pointer border-b border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition ${isActive ? 'active bg-slate-200 dark:bg-slate-800 font-semibold' : ''}">
          <div class="flex items-center gap-3 min-w-0">
            <div class="relative w-10 h-10 rounded-full bg-[#142B4A] text-white font-bold text-xs flex items-center justify-center flex-shrink-0 shadow-sm">
              <span>${initials}</span>
              <span class="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 status-live"></span>
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-1.5">
                <h4 class="text-xs font-bold text-slate-900 dark:text-white truncate">${escapeHtml(c.title)}</h4>
              </div>
              <p class="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">${escapeHtml(c.last_message_text || 'Start chatting...')}</p>
            </div>
          </div>
          <div class="flex flex-col items-end gap-1 flex-shrink-0">
            <span class="text-[10px] text-slate-400">${formatTime(c.last_message_at)}</span>
            ${unreadBadge}
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  function renderCourseChannelList() {
    const container = document.getElementById('slate-conversations-list');
    if (!container) return;

    let html = '';
    S.courseChannels.forEach(c => {
      const isActive = c.conversation_id === S.activeConversationId;
      html += `
        <div onclick="window.Slate.openConversation(${c.conversation_id}, '${escapeHtml(c.course_code)}')"
             class="slate-conv-item p-3.5 flex items-center justify-between gap-3 cursor-pointer border-b border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition ${isActive ? 'active bg-slate-200 dark:bg-slate-800 font-semibold' : ''}">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-10 h-10 rounded-xl bg-[#0D9488]/15 border border-[#0D9488]/40 text-[#0D9488] font-bold text-xs flex items-center justify-center flex-shrink-0">
              📚
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-1.5">
                <span class="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#2563EB]/15 text-[#2563EB]">${c.course_code}</span>
                <h4 class="text-xs font-bold text-slate-900 dark:text-white truncate">${escapeHtml(c.course_title)}</h4>
              </div>
              <p class="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                ${c.teacher_name ? `Instructor: ${escapeHtml(c.teacher_name)}` : `${c.credit_hours || 3} Credit Hours`}
              </p>
            </div>
          </div>
          <span class="text-xs text-slate-400">›</span>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  // 3. Open Conversation & Load Messages
  window.Slate.openConversation = async function (convId, courseCode = null) {
    S.activeConversationId = convId;
    if (courseCode) S.activeCourseCode = courseCode;

    // Highlight in list
    document.querySelectorAll('.slate-conv-item').forEach(el => el.classList.remove('active'));

    const headerTitle = document.getElementById('chat-header-title');
    const headerSub = document.getElementById('chat-header-sub');
    const messagesBox = document.getElementById('slate-messages-container');

    if (messagesBox) {
      messagesBox.innerHTML = '<div class="p-8 text-center text-xs text-slate-400"><div class="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-[#2563EB] mb-2"></div><br/>Loading conversation stream...</div>';
    }

    try {
      const res = await slateFetch(`/api/slate/conversations/${convId}/messages`);
      const data = await res.json();
      if (!data.success) return;

      S.messages = data.messages || [];
      const conv = data.conversation;

      if (headerTitle) headerTitle.innerText = conv.title || 'Course Channel';
      if (headerSub) headerSub.innerText = conv.type === 'course_group' ? `Course Channel • ${conv.course_code || ''}` : 'Direct End-to-End University Channel';

      renderMessages();
      renderDetailsDrawer(conv);
    } catch (err) {
      console.error('[Slate] Error opening conversation:', err);
    }
  };

  function renderMessages() {
    const container = document.getElementById('slate-messages-container');
    if (!container) return;

    if (S.messages.length === 0) {
      container.innerHTML = `
        <div class="h-full flex flex-col items-center justify-center text-center p-8 space-y-3 select-none">
          <div class="w-14 h-14 rounded-2xl bg-[#2563EB]/15 text-[#2563EB] flex items-center justify-center text-2xl shadow-inner">
            💬
          </div>
          <h3 class="text-sm font-bold text-slate-800 dark:text-white">Start the Discussion</h3>
          <p class="text-xs text-slate-400 max-w-sm">Ask academic questions, share lecture notes, or discuss coursework. Messages are verified by Ghani University.</p>
        </div>
      `;
      return;
    }

    let html = '';
    let lastDate = '';

    S.messages.forEach(m => {
      const msgDate = formatDate(m.created_at);
      if (msgDate !== lastDate) {
        html += `
          <div class="flex items-center justify-center my-4">
            <span class="px-3 py-1 rounded-full bg-slate-200 dark:bg-slate-800 text-[10px] font-bold text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-700 shadow-sm">
              ${msgDate}
            </span>
          </div>
        `;
        lastDate = msgDate;
      }

      const isMe = m.sender_type === S.currentUser.type && m.sender_id === S.currentUser.id;
      const isTeacher = m.sender_type === 'teacher';

      // Attachments preview
      let attachmentHtml = '';
      if (m.file_url) {
        const isImage = /\.(png|jpe?g|gif|webp)$/i.test(m.file_url);
        if (isImage) {
          attachmentHtml = `
            <div class="mt-2 rounded-xl overflow-hidden border border-white/20 max-w-xs shadow">
              <a href="${m.file_url}" target="_blank">
                <img src="${m.file_url}" alt="Image" class="w-full object-cover max-h-56 hover:opacity-95 transition" />
              </a>
            </div>
          `;
        } else {
          attachmentHtml = `
            <a href="${m.file_url}" download target="_blank" class="mt-2 flex items-center gap-2.5 p-2.5 rounded-xl bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 transition border border-white/15 text-xs font-semibold">
              <span class="text-lg">📄</span>
              <div class="min-w-0 flex-1">
                <p class="truncate font-bold text-xs">${escapeHtml(m.file_name || 'Document File')}</p>
                <span class="text-[10px] opacity-75">${m.file_size || 'Download File'}</span>
              </div>
              <span class="text-xs">⬇️</span>
            </a>
          `;
        }
      }

      html += `
        <div class="flex flex-col ${isMe ? 'items-end' : 'items-start'} mb-3 group">
          <div class="flex items-end gap-2 max-w-[85%] sm:max-w-[70%]">
            
            ${!isMe ? `
              <div class="w-7 h-7 rounded-full ${isTeacher ? 'bg-[#0D9488]' : 'bg-[#142B4A]'} text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0 shadow-sm" title="${escapeHtml(m.sender_name)}">
                ${m.sender_name ? m.sender_name[0].toUpperCase() : 'U'}
              </div>
            ` : ''}

            <div class="rounded-2xl p-3.5 shadow-sm text-xs leading-relaxed ${isMe ? 'bubble-student' : 'bubble-teacher'} relative">
              ${!isMe ? `
                <div class="flex items-center gap-1.5 mb-1">
                  <span class="font-bold text-[11px] text-[#0D9488] dark:text-teal-400">${escapeHtml(m.sender_name)}</span>
                  ${isTeacher ? `<span class="px-1.5 py-0.2 rounded text-[9px] font-black bg-[#0D9488]/20 text-[#0D9488] dark:text-teal-300">FACULTY</span>` : ''}
                </div>
              ` : ''}

              <div class="break-words select-text font-normal">${escapeHtml(m.content)}</div>
              ${attachmentHtml}

              <div class="flex items-center justify-end gap-1.5 mt-1.5 text-[9px] opacity-70">
                <span>${formatTime(m.created_at)}</span>
                ${isMe ? `<span>✓✓</span>` : ''}
              </div>
            </div>

            <!-- Message Action Pill (Reply / Report / Pin) -->
            <div class="opacity-0 group-hover:opacity-100 transition flex items-center gap-1 px-1 py-0.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-[10px]">
              <button onclick="window.Slate.setReply(${m.id}, '${escapeHtml(m.sender_name)}', '${escapeHtml(m.content)}')" title="Reply" class="hover:text-blue-500 p-0.5">↩️</button>
              <button onclick="window.Slate.reportMessageModal(${m.id})" title="Report Message" class="hover:text-red-500 p-0.5">🚩</button>
            </div>

          </div>
        </div>
      `;
    });

    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
  }

  function renderDetailsDrawer(conv) {
    const titleEl = document.getElementById('details-title');
    const badgeEl = document.getElementById('details-badge');
    const emailEl = document.getElementById('details-email');
    const roomEl = document.getElementById('details-room');
    const actionsEl = document.getElementById('details-actions');

    if (titleEl) titleEl.innerText = conv.title || 'Course Details';
    if (badgeEl) badgeEl.innerText = conv.type === 'course_group' ? (conv.course_code || 'Course') : 'Faculty Member';
    if (emailEl) emailEl.innerText = conv.participant_badge || 'Sheikhupura Campus';
    if (roomEl) roomEl.innerText = conv.type === 'course_group' ? 'General Academic Slate' : 'Official Office Desk';

    if (actionsEl) {
      if (S.currentUser.type === 'student' && conv.type === 'direct') {
        actionsEl.innerHTML = `
          <button onclick="window.Slate.openMeetingRequestModal(${conv.participant_id || 0})" class="w-full py-2 bg-[#0D9488] hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow transition flex items-center justify-center gap-1.5">
            <span>📅 Request 1-on-1 Meeting</span>
          </button>
        `;
      } else {
        actionsEl.innerHTML = '';
      }
    }
  }

  function renderEmptyChatWelcome() {
    const container = document.getElementById('slate-messages-container');
    if (container) {
      container.innerHTML = `
        <div class="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
          <div class="w-16 h-16 rounded-3xl bg-[#2563EB]/15 text-[#2563EB] flex items-center justify-center text-3xl">
            🏛️
          </div>
          <h2 class="text-base font-bold text-slate-800 dark:text-white">Ghani University Communication Slate</h2>
          <p class="text-xs text-slate-400 max-w-md">Select a conversation or course channel from the left sidebar to start collaborating.</p>
        </div>
      `;
    }
  }

  // 4. Send Message Handler
  window.Slate.handleSendMessage = async function (e) {
    if (e) e.preventDefault();
    if (!S.activeConversationId) {
      showToast('Please select a conversation first.', 'error');
      return;
    }

    const input = document.getElementById('slate-message-input');
    const content = input ? input.value.trim() : '';

    if (!content && !window.Slate.stagedAttachment) {
      return;
    }

    const payload = {
      content,
      message_type: window.Slate.stagedAttachment ? 'file' : 'text',
      file_url: window.Slate.stagedAttachment?.file_url || null,
      file_name: window.Slate.stagedAttachment?.file_name || null,
      file_size: window.Slate.stagedAttachment?.file_size || null,
      reply_to_id: S.replyToMessage?.id || null
    };

    try {
      const res = await slateFetch(`/api/slate/conversations/${S.activeConversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!data.success) {
        showToast(data.error, 'error');
        return;
      }

      if (input) input.value = '';
      window.Slate.clearAttachment();
      window.Slate.clearReply();

      S.messages.push(data.message);
      renderMessages();
    } catch (err) {
      console.error('[Slate] Error sending message:', err);
      showToast('Failed to send message.', 'error');
    }
  };

  // Reply management
  window.Slate.setReply = function (id, name, content) {
    S.replyToMessage = { id, name, content };
    const banner = document.getElementById('slate-reply-banner');
    const text = document.getElementById('slate-reply-text');
    if (banner && text) {
      banner.classList.remove('hidden');
      text.innerText = `Replying to ${name}: "${content.slice(0, 40)}..."`;
    }
  };

  window.Slate.clearReply = function () {
    S.replyToMessage = null;
    const banner = document.getElementById('slate-reply-banner');
    if (banner) banner.classList.add('hidden');
  };

  // Staged File Attachment management
  window.Slate.stagedAttachment = null;
  window.Slate.handleFileSelect = async function (file) {
    if (!file) return;

    const statusEl = document.getElementById('slate-attachment-preview');
    if (statusEl) {
      statusEl.classList.remove('hidden');
      statusEl.innerHTML = `<span class="animate-pulse">Uploading ${escapeHtml(file.name)}...</span>`;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/slate/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!data.success) {
        showToast(data.error || 'Upload failed.', 'error');
        window.Slate.clearAttachment();
        return;
      }

      window.Slate.stagedAttachment = data;
      if (statusEl) {
        statusEl.innerHTML = `
          <div class="flex items-center gap-2 text-xs font-semibold text-teal-400 bg-teal-950/60 p-2 rounded-xl border border-teal-500/30">
            <span>📎 Attached: ${escapeHtml(data.file_name)} (${data.file_size})</span>
            <button onclick="window.Slate.clearAttachment()" class="text-red-400 hover:text-red-300 ml-auto font-bold">×</button>
          </div>
        `;
      }
    } catch (err) {
      showToast('File upload failed: ' + err.message, 'error');
      window.Slate.clearAttachment();
    }
  };

  window.Slate.clearAttachment = function () {
    window.Slate.stagedAttachment = null;
    const statusEl = document.getElementById('slate-attachment-preview');
    const fileInput = document.getElementById('slate-file-input');
    if (statusEl) {
      statusEl.classList.add('hidden');
      statusEl.innerHTML = '';
    }
    if (fileInput) fileInput.value = '';
  };

  // 5. Polling for Live Stream
  async function pollActiveFeed() {
    if (S.activeTab === 'chats' || S.activeTab === 'channels') {
      if (S.activeConversationId) {
        try {
          const res = await slateFetch(`/api/slate/conversations/${S.activeConversationId}/messages`);
          const data = await res.json();
          if (data.success && data.messages) {
            if (data.messages.length !== S.messages.length) {
              S.messages = data.messages;
              renderMessages();
            }
          }
        } catch (e) {}
      }
    }
    loadNotifications();
  }

  // 6. Announcements Feed
  async function renderAnnouncementsFeed() {
    const container = document.getElementById('slate-stream-content');
    if (!container) return;

    container.innerHTML = '<div class="p-8 text-center text-xs text-slate-400"><div class="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-[#2563EB] mb-2"></div><br/>Loading announcements...</div>';

    try {
      const res = await slateFetch('/api/slate/announcements');
      const data = await res.json();
      if (!data.success) return;

      S.announcements = data.announcements || [];

      let html = `
        <div class="max-w-4xl mx-auto space-y-6">
          <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h2 class="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>📢 University &amp; Class Announcements</span>
              </h2>
              <p class="text-xs text-slate-500 dark:text-slate-400">Official circulars, class updates, and schedule notices.</p>
            </div>
            ${S.currentUser.type !== 'student' ? `
              <button onclick="window.Slate.openCreateAnnouncementModal()" class="px-4 py-2 bg-[#2563EB] hover:bg-blue-600 text-white rounded-xl text-xs font-bold shadow flex items-center gap-1.5 transition">
                <span>+ Post Announcement</span>
              </button>
            ` : ''}
          </div>
      `;

      if (S.announcements.length === 0) {
        html += `<div class="p-12 text-center text-xs text-slate-400">No active announcements posted yet.</div>`;
      } else {
        S.announcements.forEach(a => {
          html += `
            <div class="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <div class="flex justify-between items-start gap-3">
                <div class="space-y-1">
                  <div class="flex items-center gap-2">
                    ${a.is_pinned ? `<span class="px-2 py-0.5 rounded text-[10px] font-black bg-amber-500/20 text-amber-500 border border-amber-500/30">PINNED</span>` : ''}
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-[#2563EB]/15 text-[#2563EB]">${a.course_code || 'UNIVERSITY-WIDE'}</span>
                    <span class="text-xs text-slate-400">• ${formatDate(a.created_at)}</span>
                  </div>
                  <h3 class="text-base font-bold text-slate-900 dark:text-white">${escapeHtml(a.title)}</h3>
                  <p class="text-xs text-[#0D9488] font-semibold">Instructor: ${escapeHtml(a.teacher_name || 'Academic Administration')}</p>
                </div>
              </div>
              <div class="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">${escapeHtml(a.content)}</div>
              ${a.file_url ? `
                <a href="${a.file_url}" target="_blank" download class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                  <span>📎 Download Attached File</span>
                </a>
              ` : ''}
            </div>
          `;
        });
      }

      html += `</div>`;
      container.innerHTML = html;
    } catch (err) {
      console.error('[Slate] Error rendering announcements:', err);
    }
  }

  // 7. Course Materials & Assignments Feed
  async function renderMaterialsFeed() {
    const container = document.getElementById('slate-stream-content');
    if (!container) return;

    container.innerHTML = '<div class="p-8 text-center text-xs text-slate-400"><div class="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-[#2563EB] mb-2"></div><br/>Loading course works & assignments...</div>';

    try {
      const res = await slateFetch('/api/slate/materials');
      const data = await res.json();
      if (!data.success) return;

      S.materials = data.materials || [];

      let html = `
        <div class="max-w-4xl mx-auto space-y-6">
          <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h2 class="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>📝 Course Assignments, Quizzes &amp; Lecture Notes</span>
              </h2>
              <p class="text-xs text-slate-500 dark:text-slate-400">View tasks uploaded by your course instructors and submit your completed files.</p>
            </div>
            ${S.currentUser.type !== 'student' ? `
              <button onclick="window.Slate.openUploadMaterialModal()" class="px-4 py-2 bg-[#0D9488] hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow flex items-center gap-1.5 transition">
                <span>+ Upload Work / Assignment</span>
              </button>
            ` : ''}
          </div>
      `;

      if (S.materials.length === 0) {
        html += `<div class="p-12 text-center text-xs text-slate-400">No course materials or assignments posted yet.</div>`;
      } else {
        S.materials.forEach(m => {
          const isAssignment = m.material_type === 'assignment' || m.material_type === 'quiz';
          const sub = m.submission;

          html += `
            <div class="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div class="space-y-1">
                  <div class="flex items-center gap-2">
                    <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#2563EB]/15 text-[#2563EB]">${m.course_code}</span>
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${m.material_type === 'quiz' ? 'bg-amber-500/20 text-amber-500' : (m.material_type === 'assignment' ? 'bg-[#0D9488]/20 text-[#0D9488]' : 'bg-slate-500/20 text-slate-400')}">
                      ${m.material_type}
                    </span>
                    <span class="text-xs text-slate-400">• Posted ${formatDate(m.created_at)}</span>
                  </div>
                  <h3 class="text-base font-bold text-slate-900 dark:text-white">${escapeHtml(m.title)}</h3>
                  <p class="text-xs text-slate-500 dark:text-slate-400">Instructor: <strong class="text-slate-800 dark:text-slate-200">${escapeHtml(m.teacher_name || 'Faculty Member')}</strong> | Max Marks: <strong>${m.total_marks || 10}</strong></p>
                </div>

                <div class="text-right sm:text-right">
                  ${m.due_date ? `
                    <div class="px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-xs font-bold">
                      ⏰ Due: ${formatDate(m.due_date)}
                    </div>
                  ` : ''}
                </div>
              </div>

              <div class="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">${escapeHtml(m.description || '')}</div>

              <!-- Attachments download -->
              ${m.file_url ? `
                <div class="pt-2">
                  <a href="${m.file_url}" target="_blank" download class="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition">
                    <span>📥 Download Work Task: ${escapeHtml(m.file_name || 'Task Document')}</span>
                  </a>
                </div>
              ` : ''}

              <!-- Submission Status / Action for Students -->
              ${S.currentUser.type === 'student' && isAssignment ? `
                <div class="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    ${sub ? `
                      <div class="flex items-center gap-2">
                        <span class="px-2.5 py-1 rounded-full text-xs font-bold ${sub.status === 'graded' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'}">
                          ${sub.status === 'graded' ? `✓ Graded: ${sub.marks_obtained}/${m.total_marks}` : '✓ Submitted (Pending Evaluation)'}
                        </span>
                        <span class="text-xs text-slate-400">${formatDate(sub.submitted_at)}</span>
                      </div>
                      ${sub.teacher_feedback ? `
                        <p class="text-xs text-slate-300 mt-1.5"><strong class="text-teal-400">Faculty Feedback:</strong> "${escapeHtml(sub.teacher_feedback)}"</p>
                      ` : ''}
                    ` : `
                      <span class="text-xs font-semibold text-amber-500">Pending Submission</span>
                    `}
                  </div>

                  <button onclick="window.Slate.openSubmitWorkModal(${m.id}, '${escapeHtml(m.title)}', '${escapeHtml(m.course_code)}')"
                          class="px-4 py-2 ${sub ? 'bg-slate-700 hover:bg-slate-600' : 'bg-[#2563EB] hover:bg-blue-600'} text-white rounded-xl text-xs font-bold shadow transition flex items-center gap-1.5">
                    <span>${sub ? '📤 Re-upload Solution File' : '📤 Upload Done Solution'}</span>
                  </button>
                </div>
              ` : ''}

              <!-- Teacher grading review -->
              ${S.currentUser.type !== 'student' && isAssignment ? `
                <div class="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <span class="text-xs text-slate-400">Total Submissions Received</span>
                  <a href="/teacher?tab=submissions&materialId=${m.id}" class="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow transition">
                    Evaluate &amp; Grade Submissions →
                  </a>
                </div>
              ` : ''}

            </div>
          `;
        });
      }

      html += `</div>`;
      container.innerHTML = html;
    } catch (err) {
      console.error('[Slate] Error rendering materials:', err);
    }
  }

  // 8. Meeting Requests Feed
  async function renderMeetingsFeed() {
    const container = document.getElementById('slate-stream-content');
    if (!container) return;

    container.innerHTML = '<div class="p-8 text-center text-xs text-slate-400"><div class="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-[#2563EB] mb-2"></div><br/>Loading meeting requests...</div>';

    try {
      const res = await slateFetch('/api/slate/meetings');
      const data = await res.json();
      if (!data.success) return;

      S.meetings = data.meetings || [];

      let html = `
        <div class="max-w-4xl mx-auto space-y-6">
          <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h2 class="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>📅 Student–Faculty Consultation &amp; Meeting Requests</span>
              </h2>
              <p class="text-xs text-slate-500 dark:text-slate-400">Book academic counseling or discuss coursework face-to-face or online.</p>
            </div>
            ${S.currentUser.type === 'student' ? `
              <button onclick="window.Slate.openMeetingRequestModal()" class="px-4 py-2 bg-[#2563EB] hover:bg-blue-600 text-white rounded-xl text-xs font-bold shadow flex items-center gap-1.5 transition">
                <span>+ Request Meeting</span>
              </button>
            ` : ''}
          </div>
      `;

      if (S.meetings.length === 0) {
        html += `<div class="p-12 text-center text-xs text-slate-400">No meeting requests found.</div>`;
      } else {
        S.meetings.forEach(m => {
          const isPending = m.status === 'pending';
          const isApproved = m.status === 'approved';
          const isRejected = m.status === 'rejected';

          html += `
            <div class="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  <div class="flex items-center gap-2">
                    <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      isApproved ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : (
                        isRejected ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      )
                    }">
                      ${m.status}
                    </span>
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-[#142B4A]/10 dark:bg-white/10 text-slate-800 dark:text-white uppercase">${m.meeting_mode.replace('_', ' ')}</span>
                  </div>
                  <h3 class="text-sm font-bold text-slate-900 dark:text-white mt-1">${escapeHtml(m.purpose)}</h3>
                  <p class="text-xs text-slate-500 dark:text-slate-400">
                    ${S.currentUser.type === 'student' ? `With Instructor: <strong>${escapeHtml(m.teacher_name)}</strong>` : `Student: <strong>${escapeHtml(m.student_name)}</strong> (${escapeHtml(m.registration_no || '')})`}
                  </p>
                </div>

                <div class="text-xs text-slate-400 font-mono">
                  ⏰ Preferred: ${new Date(m.preferred_datetime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                </div>
              </div>

              ${m.teacher_notes ? `
                <div class="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300">
                  <strong>Notes:</strong> ${escapeHtml(m.teacher_notes)}
                </div>
              ` : ''}

              ${S.currentUser.type !== 'student' && isPending ? `
                <div class="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <button onclick="window.Slate.updateMeetingStatus(${m.id}, 'approved')" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition">
                    ✓ Approve Meeting
                  </button>
                  <button onclick="window.Slate.updateMeetingStatus(${m.id}, 'rejected')" class="px-3 py-1.5 bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white rounded-lg text-xs font-bold transition">
                    ✕ Decline
                  </button>
                </div>
              ` : ''}
            </div>
          `;
        });
      }

      html += `</div>`;
      container.innerHTML = html;
    } catch (err) {
      console.error('[Slate] Error rendering meetings:', err);
    }
  }

  // 9. Notifications
  async function loadNotifications() {
    try {
      const res = await slateFetch('/api/slate/notifications');
      const data = await res.json();
      if (!data.success) return;

      S.notifications = data.notifications || [];
      const unreadCount = S.notifications.filter(n => !n.is_read).length;

      const badge = document.getElementById('slate-unread-badge');
      if (badge) {
        if (unreadCount > 0) {
          badge.innerText = unreadCount;
          badge.classList.remove('hidden');
        } else {
          badge.classList.add('hidden');
        }
      }
    } catch (e) {}
  }

  function renderNotificationsFeed() {
    const container = document.getElementById('slate-stream-content');
    if (!container) return;

    let html = `
      <div class="max-w-2xl mx-auto space-y-4">
        <div class="flex justify-between items-center pb-3 border-b border-slate-200 dark:border-slate-800">
          <h2 class="text-base font-bold text-slate-900 dark:text-white">🔔 Notification Center</h2>
          <button onclick="window.Slate.markAllNotificationsRead()" class="text-xs text-[#2563EB] hover:underline font-semibold">Mark All Read</button>
        </div>
    `;

    if (S.notifications.length === 0) {
      html += `<div class="p-8 text-center text-xs text-slate-400">No notifications.</div>`;
    } else {
      S.notifications.forEach(n => {
        html += `
          <div class="p-4 rounded-xl ${n.is_read ? 'bg-slate-100 dark:bg-slate-900/50' : 'bg-blue-50/60 dark:bg-slate-800 border-l-4 border-[#2563EB]'} flex justify-between items-start gap-3">
            <div>
              <h4 class="text-xs font-bold text-slate-900 dark:text-white">${escapeHtml(n.title)}</h4>
              <p class="text-xs text-slate-600 dark:text-slate-300 mt-0.5">${escapeHtml(n.message)}</p>
              <span class="text-[10px] text-slate-400 mt-1 block">${formatDate(n.created_at)} ${formatTime(n.created_at)}</span>
            </div>
          </div>
        `;
      });
    }

    html += `</div>`;
    container.innerHTML = html;
  }

  window.Slate.markAllNotificationsRead = async function () {
    await slateFetch('/api/slate/notifications/read', { method: 'POST' });
    loadNotifications();
    renderNotificationsFeed();
  };

  // 10. Student Submit Work Modal
  window.Slate.openSubmitWorkModal = function (materialId, title, courseCode) {
    const modal = document.getElementById('slate-submit-modal');
    const titleEl = document.getElementById('submit-modal-title');
    const inputId = document.getElementById('submit-material-id');

    if (titleEl) titleEl.innerText = `Submit: ${title} (${courseCode})`;
    if (inputId) inputId.value = materialId;
    if (modal) modal.classList.remove('hidden');
  };

  window.Slate.closeSubmitModal = function () {
    const modal = document.getElementById('slate-submit-modal');
    if (modal) modal.classList.add('hidden');
  };

  window.Slate.handleAssignmentSubmit = async function (e) {
    if (e) e.preventDefault();
    const materialId = document.getElementById('submit-material-id')?.value;
    const fileInput = document.getElementById('submit-file-input');
    const comment = document.getElementById('submit-comment')?.value || '';

    if (!fileInput || !fileInput.files[0]) {
      showToast('Please select your completed solution file.', 'error');
      return;
    }

    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('file', file);

    const btn = document.getElementById('submit-work-btn');
    if (btn) {
      btn.disabled = true;
      btn.innerText = 'Uploading work...';
    }

    try {
      // 1. Upload file
      const upRes = await fetch('/api/slate/upload', { method: 'POST', body: formData });
      const upData = await upRes.json();
      if (!upData.success) {
        showToast(upData.error || 'Upload failed.', 'error');
        if (btn) { btn.disabled = false; btn.innerText = 'Submit Solution'; }
        return;
      }

      // 2. Submit assignment record
      const subRes = await slateFetch('/api/slate/materials/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          material_id: materialId,
          file_url: upData.file_url,
          file_name: upData.file_name,
          student_comment: comment
        })
      });
      const subData = await subRes.json();
      if (!subData.success) {
        showToast(subData.error, 'error');
        if (btn) { btn.disabled = false; btn.innerText = 'Submit Solution'; }
        return;
      }

      showToast('Assignment uploaded successfully to teacher!', 'success');
      window.Slate.closeSubmitModal();
      renderMaterialsFeed();
    } catch (err) {
      showToast('Submission error: ' + err.message, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.innerText = 'Submit Solution'; }
    }
  };

  // 11. Meeting Request Modal
  window.Slate.openMeetingRequestModal = async function (teacherId = null) {
    const modal = document.getElementById('slate-meeting-modal');
    const select = document.getElementById('meeting-teacher-select');

    if (select) {
      select.innerHTML = '<option value="">Loading faculty roster...</option>';
      try {
        const res = await slateFetch('/api/slate/course-channels');
        const data = await res.json();
        const courses = data.courses || [];

        let optHtml = '<option value="">Select Instructor / Faculty Member</option>';
        const seen = new Set();
        courses.forEach(c => {
          if (c.teacher_id && !seen.has(c.teacher_id)) {
            seen.add(c.teacher_id);
            const isSelected = teacherId && teacherId == c.teacher_id;
            optHtml += `<option value="${c.teacher_id}" data-course="${escapeHtml(c.course_code)}" ${isSelected ? 'selected' : ''}>${escapeHtml(c.teacher_name)} (${c.course_code})</option>`;
          }
        });
        select.innerHTML = optHtml;
      } catch (e) {}
    }

    if (modal) modal.classList.remove('hidden');
  };

  window.Slate.closeMeetingModal = function () {
    const modal = document.getElementById('slate-meeting-modal');
    if (modal) modal.classList.add('hidden');
  };

  window.Slate.handleSendMeetingRequest = async function (e) {
    if (e) e.preventDefault();
    const select = document.getElementById('meeting-teacher-select');
    const teacherId = select?.value;
    const courseCode = select?.options[select.selectedIndex]?.getAttribute('data-course') || '';
    const purpose = document.getElementById('meeting-purpose-input')?.value;
    const datetime = document.getElementById('meeting-datetime-input')?.value;
    const mode = document.getElementById('meeting-mode-select')?.value;

    if (!teacherId || !purpose || !datetime) {
      showToast('Please fill all meeting details.', 'error');
      return;
    }

    try {
      const res = await slateFetch('/api/slate/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacher_id: teacherId,
          course_code: courseCode,
          purpose,
          preferred_datetime: datetime,
          meeting_mode: mode
        })
      });
      const data = await res.json();
      if (!data.success) {
        showToast(data.error, 'error');
        return;
      }

      showToast('Meeting request submitted to faculty!', 'success');
      window.Slate.closeMeetingModal();
      if (S.activeTab === 'meetings') renderMeetingsFeed();
    } catch (err) {
      showToast('Error requesting meeting: ' + err.message, 'error');
    }
  };

  // 12. Create Work Material Modal (Teacher)
  window.Slate.openUploadMaterialModal = async function () {
    const modal = document.getElementById('slate-upload-material-modal');
    const select = document.getElementById('material-course-select');

    if (select) {
      select.innerHTML = '<option value="">Loading courses...</option>';
      try {
        const res = await slateFetch('/api/slate/course-channels');
        const data = await res.json();
        let optHtml = '<option value="">Select Target Course</option>';
        (data.courses || []).forEach(c => {
          optHtml += `<option value="${escapeHtml(c.course_code)}">${c.course_code} - ${escapeHtml(c.course_title)}</option>`;
        });
        select.innerHTML = optHtml;
      } catch (e) {}
    }

    if (modal) modal.classList.remove('hidden');
  };

  window.Slate.closeUploadMaterialModal = function () {
    const modal = document.getElementById('slate-upload-material-modal');
    if (modal) modal.classList.add('hidden');
  };

  window.Slate.handleCreateMaterial = async function (e) {
    if (e) e.preventDefault();
    const courseCode = document.getElementById('material-course-select')?.value;
    const title = document.getElementById('material-title-input')?.value;
    const desc = document.getElementById('material-desc-input')?.value;
    const type = document.getElementById('material-type-select')?.value;
    const marks = document.getElementById('material-marks-input')?.value || 10;
    const dueDate = document.getElementById('material-due-input')?.value;
    const fileInput = document.getElementById('material-file-input');

    if (!courseCode || !title) {
      showToast('Please provide Course and Title.', 'error');
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
      const res = await slateFetch('/api/slate/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          course_code: courseCode,
          title,
          description: desc,
          material_type: type,
          total_marks: marks,
          due_date: dueDate || null,
          file_url: fileUrl,
          file_name: fileName
        })
      });
      const data = await res.json();
      if (!data.success) {
        showToast(data.error, 'error');
        return;
      }

      showToast('Work material published successfully on Slate!', 'success');
      window.Slate.closeUploadMaterialModal();
      renderMaterialsFeed();
    } catch (err) {
      showToast('Error publishing material: ' + err.message, 'error');
    }
  };

  // 13. Create Announcement Modal
  window.Slate.openCreateAnnouncementModal = async function () {
    const modal = document.getElementById('slate-announcement-modal');
    const select = document.getElementById('announcement-course-select');

    if (select) {
      try {
        const res = await slateFetch('/api/slate/course-channels');
        const data = await res.json();
        let optHtml = '<option value="">All My Classes (Broadcast)</option>';
        (data.courses || []).forEach(c => {
          optHtml += `<option value="${escapeHtml(c.course_code)}">${c.course_code} - ${escapeHtml(c.course_title)}</option>`;
        });
        select.innerHTML = optHtml;
      } catch (e) {}
    }

    if (modal) modal.classList.remove('hidden');
  };

  window.Slate.closeAnnouncementModal = function () {
    const modal = document.getElementById('slate-announcement-modal');
    if (modal) modal.classList.add('hidden');
  };

  window.Slate.handleCreateAnnouncement = async function (e) {
    if (e) e.preventDefault();
    const courseCode = document.getElementById('announcement-course-select')?.value;
    const title = document.getElementById('announcement-title-input')?.value;
    const content = document.getElementById('announcement-content-input')?.value;
    const isPinned = document.getElementById('announcement-pinned-check')?.checked;

    if (!title || !content) {
      showToast('Please enter Title and Announcement content.', 'error');
      return;
    }

    try {
      const res = await slateFetch('/api/slate/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          course_code: courseCode || null,
          title,
          content,
          is_pinned: isPinned
        })
      });
      const data = await res.json();
      if (!data.success) {
        showToast(data.error, 'error');
        return;
      }

      showToast('Announcement broadcasted to students!', 'success');
      window.Slate.closeAnnouncementModal();
      renderAnnouncementsFeed();
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  };

  // 14. Report Inappropriate Message Modal
  window.Slate.reportMessageModal = async function (msgId) {
    const reason = prompt('Please specify the reason for reporting this message to University Administration:');
    if (!reason) return;

    try {
      const res = await slateFetch(`/api/slate/messages/${msgId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Message report submitted to Administration.', 'success');
      } else {
        showToast(data.error, 'error');
      }
    } catch (err) {
      showToast('Report failed: ' + err.message, 'error');
    }
  };

  // Auto-init when DOM ready
  document.addEventListener('DOMContentLoaded', initSlate);

})();
