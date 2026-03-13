// management.js – Management dashboard (API-backed)

document.addEventListener('DOMContentLoaded', async function () {
  const user = API.getUser();
  const displayName = user?.displayName || 'Manager';
  document.getElementById('userName').textContent = displayName;
  document.getElementById('avatarEl').textContent = displayName[0] || 'M';

  updateClock();
  setInterval(updateClock, 1000);

  await refreshAll();

  // Real-time SSE updates
  API.subscribe({
    init:      async () => { await refreshAll(); },
    responses: async () => { await loadResponsesOverview(); await loadAllResponses(); await loadStats(); },
    docs:      async () => { await loadDocuments(); await loadStats(); },
    questions: async () => { await loadOverviewQuestions(); await loadStats(); },
  });

  // Drag-and-drop on upload zone
  const zone = document.getElementById('uploadZone');
  zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('drag'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag');
    handleFiles(e.dataTransfer.files);
  });
});

async function refreshAll() {
  await Promise.all([
    loadStats(),
    loadDocuments(),
    loadResponsesOverview(),
    loadAllResponses(),
    loadOverviewQuestions(),
  ]);
}

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
    document.getElementById('s-r').textContent    = stats.responses ?? 0;
    document.getElementById('s-no').textContent   = stats.noAnswers ?? 0;
    document.getElementById('s-docs').textContent = stats.docs      ?? 0;
  } catch (e) {
    console.error('Failed to load stats', e);
  }
}

// ── Overview: recent responses ─────────────────────────────────
async function loadResponsesOverview() {
  const container = document.getElementById('ov-responses');
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

// ── Overview: active questions ─────────────────────────────────
async function loadOverviewQuestions() {
  const container = document.getElementById('ov-questions');
  try {
    const questions = await API.getQuestions();
    container.innerHTML = questions.length
      ? questions.map(q => `
          <div class="q-item">
            <span class="q-text">${escapeHtml(q.text)}</span>
            <span class="q-freq">${escapeHtml(q.freq)}</span>
          </div>`).join('')
      : '<div class="empty-hint">No questions configured</div>';
  } catch {
    container.innerHTML = '<div class="empty-hint">Failed to load questions</div>';
  }
}

// ── All responses tab ──────────────────────────────────────────
async function loadAllResponses() {
  const container = document.getElementById('all-responses');
  if (!container) return;
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
  const list = document.getElementById('pdfList');
  try {
    const docs = await API.getDocs();
    list.innerHTML = docs.length
      ? docs.map(doc => `
          <div class="pdf-item">
            <div class="pdf-icon">
              <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <div class="pdf-info">
              <div class="pdf-name">${escapeHtml(doc.name)}</div>
              <div class="pdf-meta">${escapeHtml(doc.size)} · ${escapeHtml(doc.uploadedAt || doc.date || '')}</div>
            </div>
            <div class="pdf-actions">
              <button class="btn-sm btn-view" onclick="openDoc('${doc.id}', '${escapeHtml(doc.name)}')">View</button>
              <button class="btn-sm btn-del"  onclick="deleteDoc('${doc.id}')">Delete</button>
            </div>
          </div>`).join('')
      : '<div class="empty-hint">No documents uploaded</div>';
  } catch {
    list.innerHTML = '<div class="empty-hint">Failed to load documents</div>';
  }
}

// ── Upload ─────────────────────────────────────────────────────
window.handleFiles = async function (files) {
  const zone = document.getElementById('uploadZone');
  const allowed = Array.from(files).filter(f => f.type === 'application/pdf');
  if (!allowed.length) { alert('Only PDF files are allowed.'); return; }

  zone.classList.add('uploading');

  for (const file of allowed) {
    try {
      const base64 = await readFileAsBase64(file);
      const sizeLabel = API.formatSize(file.size);
      await API.uploadDoc(file.name, sizeLabel, base64);
    } catch (e) {
      alert(`Failed to upload "${file.name}": ${e.message}`);
    }
  }

  zone.classList.remove('uploading');
  // Docs SSE event will trigger loadDocuments + loadStats automatically;
  // fall back to manual refresh in case SSE is slow
  await loadDocuments();
  await loadStats();
};

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result); // full data-URL
    reader.onerror = () => reject(new Error('File read failed'));
    reader.readAsDataURL(file);
  });
}

// ── Delete doc ─────────────────────────────────────────────────
window.deleteDoc = async function (id) {
  if (!confirm('Delete this document?')) return;
  try {
    await API.deleteDoc(id);
    await loadDocuments();
    await loadStats();
  } catch {
    alert('Failed to delete document.');
  }
};

// ── Document modal ─────────────────────────────────────────────
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

// ── Tab switching ──────────────────────────────────────────────
window.showTab = function (tabId, element) {
  document.querySelectorAll('div[id^="tab-"]').forEach(tab => tab.style.display = 'none');
  document.getElementById('tab-' + tabId).style.display = 'block';
  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
  if (element) element.classList.add('active');
};

// ── Logout ─────────────────────────────────────────────────────
window.logout = function () {
  API.clearUser();
  window.location.href = '/pre_login.html';
};

// ── Utility ───────────────────────────────────────────────────
function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return String(unsafe).replace(/[&<>"]/g, m =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m])
  );
}
