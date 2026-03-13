// qa.js – QA dashboard logic (API-backed)

document.addEventListener('DOMContentLoaded', async function () {
  // User info from session
  const user = API.getUser();
  const displayName = user?.displayName || 'QA User';
  document.getElementById('userName').textContent = displayName;
  document.getElementById('avatarEl').textContent = displayName[0] || 'Q';

  updateClock();
  setInterval(updateClock, 1000);

  // Initial data load
  await refreshAll();

  // Real-time SSE — update relevant sections as events arrive
  API.subscribe({
    init:      async ()  => { await refreshAll(); },
    responses: async ()  => { await loadLatestResponses(); await loadAllResponses(); await loadStats(); },
    pending:   d         => { showPendingBanner(d); },
    docs:      async ()  => { await loadDocuments(); },
    questions: async ()  => { await populateQuestionSelect(); await refreshQuestionList(); await loadStats(); },
  });
});

async function refreshAll() {
  await Promise.all([
    loadStats(),
    loadLatestResponses(),
    loadAllResponses(),
    loadDocuments(),
    populateQuestionSelect(),
  ]);
}

// ── Tab switching ──────────────────────────────────────────────
window.showTab = function (tabId, element) {
  document.querySelectorAll('div[id^="tab-"]').forEach(tab => {
    tab.style.display = 'none';
  });
  const targetTab = document.getElementById('tab-' + tabId);
  if (targetTab) targetTab.style.display = 'block';

  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
  if (element) element.classList.add('active');

  if (tabId === 'manage-questions') refreshQuestionList();
};

// ── Clock ──────────────────────────────────────────────────────
function updateClock() {
  document.getElementById('clock').textContent = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
}

// ── Stats ──────────────────────────────────────────────────────
async function loadStats() {
  try {
    const stats = await API.getStats();
    document.getElementById('s-qcount').textContent  = stats.questions  ?? 0;
    document.getElementById('s-rcount').textContent  = stats.responses  ?? 0;
    document.getElementById('s-nocount').textContent = stats.noAnswers  ?? 0;
  } catch (e) {
    console.error('Failed to load stats', e);
  }
}

// ── Responses ──────────────────────────────────────────────────
async function loadLatestResponses() {
  const container = document.getElementById('latest-responses');
  try {
    const responses = await API.getResponses();
    const latest = responses.slice(-5).reverse();
    container.innerHTML = latest.length
      ? latest.map(renderResponseItem).join('')
      : '<div class="empty-hint">No responses yet</div>';
  } catch {
    container.innerHTML = '<div class="empty-hint">Failed to load responses</div>';
  }
}

async function loadAllResponses() {
  const container = document.getElementById('all-responses');
  try {
    const responses = await API.getResponses();
    container.innerHTML = responses.length
      ? responses.slice().reverse().map(renderResponseItem).join('')
      : '<div class="empty-hint">No responses yet</div>';
  } catch {
    container.innerHTML = '<div class="empty-hint">Failed to load responses</div>';
  }
}

function renderResponseItem(r) {
  const isYes = r.answer === 'yes';
  return `
    <div class="answer-item">
      <div class="answer-top">
        <span class="badge ${isYes ? 'badge-yes' : 'badge-no'}">${isYes ? 'Igen' : 'Nem'}</span>
        <span class="answer-meta">${escapeHtml(r.answeredAt || r.time || '')} · ${escapeHtml(r.operatorName || r.operator || 'Operator')}</span>
      </div>
      <div class="answer-q">${escapeHtml(r.question)}</div>
      ${r.reason ? `<div class="answer-reason">${escapeHtml(r.reason)}</div>` : ''}
    </div>`;
}

// ── Documents ──────────────────────────────────────────────────
async function loadDocuments() {
  const container = document.getElementById('doc-list');
  try {
    const docs = await API.getDocs();
    container.innerHTML = docs.length
      ? docs.map(doc => `
          <div class="pdf-item" onclick="openDoc('${doc.id}', '${escapeHtml(doc.name)}')">
            <div class="pdf-icon">
              <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <div class="pdf-info">
              <div class="pdf-name">${escapeHtml(doc.name)}</div>
              <div class="pdf-meta">${escapeHtml(doc.size)} · ${escapeHtml(doc.uploadedAt || doc.date || '')}</div>
            </div>
          </div>`).join('')
      : '<div class="empty-hint">No documents uploaded by management</div>';
  } catch {
    container.innerHTML = '<div class="empty-hint">Failed to load documents</div>';
  }
}

// ── Question select (Send tab) ─────────────────────────────────
// Stores the API question ID as the option value — required by API.sendPending(id)
async function populateQuestionSelect() {
  const select = document.getElementById('questionSelect');
  if (!select) return;
  try {
    const questions = await API.getQuestions();
    select.innerHTML = questions.length
      ? questions.map(q => `<option value="${q.id}">${escapeHtml(q.text)}</option>`).join('')
      : '<option value="">— No questions available —</option>';
  } catch {
    select.innerHTML = '<option value="">— Failed to load —</option>';
  }
}

// ── Question list (Manage Questions tab) ───────────────────────
async function refreshQuestionList() {
  const container = document.getElementById('questionList');
  if (!container) return;
  try {
    const questions = await API.getQuestions();
    container.innerHTML = questions.length
      ? questions.map(q => `
          <div class="q-item" data-id="${q.id}">
            <span class="q-text">${escapeHtml(q.text)}</span>
            <span class="q-freq">${escapeHtml(q.freq)}</span>
            <button class="btn-icon del" onclick="deleteQuestionHandler('${q.id}')" title="Delete">
              <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>`).join('')
      : '<div class="empty-hint">No questions yet.</div>';
  } catch {
    container.innerHTML = '<div class="empty-hint">Failed to load questions.</div>';
  }
}

// ── Add question ───────────────────────────────────────────────
window.addQuestionHandler = async function () {
  const textInput  = document.getElementById('newQText');
  const freqSelect = document.getElementById('newQFreq');
  const text = textInput.value.trim();
  const freq = freqSelect.value;

  if (!text) { alert('Please enter a question.'); return; }

  try {
    await API.addQuestion(text, freq);
    textInput.value = '';
    await refreshQuestionList();
    await populateQuestionSelect();
    await loadStats();
  } catch {
    alert('Failed to add question.');
  }
};

// ── Delete question ────────────────────────────────────────────
// Overrides the localStorage version in questions.js
window.deleteQuestionHandler = async function (id) {
  try {
    await API.deleteQuestion(id);
    await refreshQuestionList();
    await populateQuestionSelect();
    await loadStats();
  } catch {
    alert('Failed to delete question.');
  }
};

// ── Send question to operators ─────────────────────────────────
// Uses API.sendPending(id) so the SSE stream notifies all operator tabs instantly
window.sendQuestion = async function () {
  const select     = document.getElementById('questionSelect');
  const questionId = select.value;
  if (!questionId) { alert('Please select a question.'); return; }

  try {
    await API.sendPending(questionId);

    const flash = document.getElementById('sentFlash');
    flash.style.display = 'block';
    setTimeout(() => { flash.style.display = 'none'; }, 3000);

    // Hide any stale pending banner — a fresh question was just sent
    document.getElementById('pendingActive').classList.remove('show');
  } catch {
    alert('Failed to send question to operators.');
  }
};

// Show/hide the "active question" banner in the Send tab
function showPendingBanner(pending) {
  const el  = document.getElementById('pendingActive');
  const txt = document.getElementById('pendingText');
  if (pending?.text) {
    txt.textContent = pending.text;
    el.classList.add('show');
  } else {
    el.classList.remove('show');
  }
}

// ── Documents modal ────────────────────────────────────────────
window.openDoc = async function (id, name) {
  try {
    const doc = await API.getDocData(id);
    document.getElementById('pdfFrame').src = doc.data + '#toolbar=0&navpanes=0';
    document.getElementById('modalTitle').textContent = name;
    document.getElementById('pdfModal').classList.add('open');
  } catch {
    alert('Failed to open document.');
  }
};

window.closeModal = function () {
  document.getElementById('pdfModal').classList.remove('open');
  document.getElementById('pdfFrame').src = '';
};

// ── Logout ─────────────────────────────────────────────────────
window.logout = function () {
  API.clearUser();
  window.location.href = '/pre_login.html';
};

// ── Utility ────────────────────────────────────────────────────
function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return String(unsafe).replace(/[&<>"]/g, m =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m])
  );
}

// Init — show first tab
showTab('send', document.querySelector('.nav-item.active') || document.querySelector('.nav-item'));
