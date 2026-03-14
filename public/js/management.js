// management.js – Management dashboard (API-backed)

document.addEventListener('DOMContentLoaded', async function () {
  const user = API.getUser();
  const displayName = user?.displayName || 'Manager';
  document.getElementById('userName').textContent = displayName;
  document.getElementById('avatarEl').textContent = displayName[0] || 'M';

  updateClock();
  setInterval(updateClock, 1000);

  await refreshAll();

  API.subscribe({
    init:      async () => { await refreshAll(); },
    responses: async () => { await loadResponsesOverview(); await loadAllResponses(); await loadStats(); },
    docs:      async () => { await loadDocuments(); await loadStats(); await populateSendDocDropdown(); },
    questions: async () => { await loadOverviewQuestions(); await loadStats(); },
  });

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
    populateSendDocDropdown(),
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
  } catch (e) { console.error('Failed to load stats', e); }
}

// ── Overview ───────────────────────────────────────────────────
async function loadResponsesOverview() {
  const container = document.getElementById('ov-responses');
  try {
    const responses = await API.getResponses();
    const latest = responses.slice(-5).reverse();
    container.innerHTML = latest.length
      ? latest.map(renderResponseItem).join('')
      : '<div class="empty-hint">No responses yet</div>';
  } catch { container.innerHTML = '<div class="empty-hint">Failed to load responses</div>'; }
}

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
  } catch { container.innerHTML = '<div class="empty-hint">Failed to load questions</div>'; }
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
  } catch { container.innerHTML = '<div class="empty-hint">Failed to load responses</div>'; }
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
      ? docs.map(doc => {
          const isLinked = doc.linked === true || (doc.data && doc.data.startsWith('http'));
          const badge = isLinked
            ? `<span class="doc-source-badge ${doc.source === 'onedrive' ? 'onedrive' : 'gdrive'}">${doc.source === 'onedrive' ? 'OneDrive' : 'Google Drive'}</span>`
            : `<span class="doc-source-badge upload">Uploaded</span>`;
          return `
            <div class="pdf-item">
              <div class="pdf-icon">
                <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              </div>
              <div class="pdf-info">
                <div class="pdf-name">${escapeHtml(doc.name)} ${badge}</div>
                <div class="pdf-meta">${escapeHtml(doc.size || '')}${doc.uploadedAt ? ' · ' + escapeHtml(doc.uploadedAt) : ''}</div>
              </div>
              <div class="pdf-actions">
                <button class="btn-sm btn-view" onclick="openDoc('${doc.id}', '${escapeHtml(doc.name)}')">View</button>
                <button class="btn-sm btn-del"  onclick="deleteDoc('${doc.id}')">Delete</button>
              </div>
            </div>`;
        }).join('')
      : '<div class="empty-hint">No documents yet</div>';
  } catch { list.innerHTML = '<div class="empty-hint">Failed to load documents</div>'; }
}

// ── URL parsing ────────────────────────────────────────────────
// Returns { embedUrl, source } or null if unrecognised
function parseCloudUrl(raw) {
  const url = raw.trim();

  // ── Google Drive ──────────────────────────────────────────
  // Formats:
  //   https://drive.google.com/file/d/FILE_ID/view?usp=sharing
  //   https://drive.google.com/file/d/FILE_ID/edit
  //   https://drive.google.com/open?id=FILE_ID
  const gdMatch =
    url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/) ||
    url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
  if (gdMatch) {
    return {
      embedUrl: `https://drive.google.com/file/d/${gdMatch[1]}/preview`,
      source: 'gdrive',
    };
  }

  // ── OneDrive ──────────────────────────────────────────────
  // Management should paste the embed src URL from OneDrive's Embed dialog.
  // Typical format: https://onedrive.live.com/embed?...
  // or              https://<tenant>.sharepoint.com/...
  if (
    url.includes('onedrive.live.com/embed') ||
    url.includes('1drv.ms') ||
    url.includes('sharepoint.com')
  ) {
    // 1drv.ms short links can't be used directly in iframes — tell the user
    if (url.includes('1drv.ms')) {
      return { error: 'OneDrive short links (1drv.ms) cannot be embedded. Please use Share → Embed in OneDrive and copy the src="…" URL from the iframe code.' };
    }
    return { embedUrl: url, source: 'onedrive' };
  }

  return null;
}

// ── Add linked doc ─────────────────────────────────────────────
window.addLinkedDoc = async function () {
  const nameInput  = document.getElementById('linkName');
  const urlInput   = document.getElementById('linkUrl');
  const errorEl    = document.getElementById('linkError');
  const name = nameInput.value.trim();
  const raw  = urlInput.value.trim();

  errorEl.style.display = 'none';

  if (!name) { showLinkError('Please enter a document name.'); return; }
  if (!raw)  { showLinkError('Please paste a Google Drive or OneDrive URL.'); return; }

  const parsed = parseCloudUrl(raw);
  if (!parsed)          { showLinkError('URL not recognised. Paste a Google Drive share link or OneDrive embed URL.'); return; }
  if (parsed.error)     { showLinkError(parsed.error); return; }

  try {
    // Store embedUrl as the "data" field so operator.js can use it directly as iframe src
    await API.uploadDoc(name, parsed.source === 'gdrive' ? 'Google Drive' : 'OneDrive', parsed.embedUrl);
    nameInput.value = '';
    urlInput.value  = '';
    await loadDocuments();
    await loadStats();
  } catch { showLinkError('Failed to save document link. Please try again.'); }
};

function showLinkError(msg) {
  const el = document.getElementById('linkError');
  el.textContent    = '⚠ ' + msg;
  el.style.display  = 'block';
}

// ── File upload ────────────────────────────────────────────────
window.handleFiles = async function (files) {
  const zone    = document.getElementById('uploadZone');
  const allowed = Array.from(files).filter(f => f.type === 'application/pdf');
  if (!allowed.length) { alert('Only PDF files are allowed.'); return; }

  zone.classList.add('uploading');
  for (const file of allowed) {
    try {
      const base64 = await readFileAsBase64(file);
      await API.uploadDoc(file.name, API.formatSize(file.size), base64);
    } catch (e) { alert(`Failed to upload "${file.name}": ${e.message}`); }
  }
  zone.classList.remove('uploading');
  await loadDocuments();
  await loadStats();
};

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
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
  } catch { alert('Failed to delete document.'); }
};

// ── Document modal ─────────────────────────────────────────────
window.openDoc = async function (id, name) {
  try {
    const doc = await API.getDocData(id);
    // Linked docs already have a full embed URL; uploaded docs are base64 data-URLs
    const src = doc.data.startsWith('http')
      ? doc.data
      : doc.data + '#toolbar=0&navpanes=0';
    document.getElementById('pdfFrame').src      = src;
    document.getElementById('modalTitle').textContent = name;
    document.getElementById('pdfModal').classList.add('open');
  } catch { alert('Failed to open document.'); }
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

// ── Send Document to Operators ─────────────────────────────────
let _allLinkedDocs  = [];  // cache for search filtering
let _selectedDocId  = null;

async function populateSendDocDropdown() {
  try {
    const docs = await API.getDocs();
    // Only linked docs (gdrive / onedrive) can be sent — uploaded ones are base64 blobs
    _allLinkedDocs = docs.filter(d => d.size === 'Google Drive' || d.size === 'OneDrive');
    filterDocDropdown(); // render with current search term
  } catch { /* silent */ }
}

window.filterDocDropdown = function () {
  const query    = (document.getElementById('docSearchInput').value || '').toLowerCase();
  const dropdown = document.getElementById('docDropdown');
  const filtered = query
    ? _allLinkedDocs.filter(d => d.name.toLowerCase().includes(query))
    : _allLinkedDocs;

  if (!filtered.length) {
    dropdown.innerHTML = `<div class="doc-dropdown-empty">${_allLinkedDocs.length ? 'No results for "' + escapeHtml(query) + '"' : 'No linked documents saved yet'}</div>`;
    return;
  }

  dropdown.innerHTML = filtered.map(d => {
    const isGdrive = d.size === 'Google Drive';
    return `
      <div class="doc-dropdown-item ${_selectedDocId === d.id ? 'selected' : ''}"
           onclick="selectDoc('${d.id}', '${escapeHtml(d.name)}', '${isGdrive ? 'gdrive' : 'onedrive'}')">
        <span class="link-badge ${isGdrive ? 'gdrive' : 'onedrive'}">${isGdrive ? 'Google Drive' : 'OneDrive'}</span>
        <span class="doc-dropdown-name">${escapeHtml(d.name)}</span>
      </div>`;
  }).join('');
};

window.selectDoc = function (id, name, source) {
  _selectedDocId = id;

  // Highlight selected row
  document.querySelectorAll('.doc-dropdown-item').forEach(el => el.classList.remove('selected'));
  const row = document.querySelector(`.doc-dropdown-item[onclick*="'${id}'"]`);
  if (row) row.classList.add('selected');

  // Show preview chip
  const preview = document.getElementById('docSelectedPreview');
  const isGdrive = source === 'gdrive';
  preview.style.display = 'flex';
  preview.innerHTML = `
    <span class="link-badge ${isGdrive ? 'gdrive' : 'onedrive'}">${isGdrive ? 'Google Drive' : 'OneDrive'}</span>
    <span class="doc-selected-name">${escapeHtml(name)}</span>
    <button class="doc-deselect" onclick="deselectDoc()" title="Clear">✕</button>`;

  document.getElementById('btnSendDoc').disabled = false;
};

window.deselectDoc = function () {
  _selectedDocId = null;
  document.getElementById('docSelectedPreview').style.display = 'none';
  document.getElementById('btnSendDoc').disabled = true;
  document.querySelectorAll('.doc-dropdown-item').forEach(el => el.classList.remove('selected'));
};

window.sendDocument = async function () {
  if (!_selectedDocId) return;
  try {
    await fetch('/api/pending-doc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docId: _selectedDocId }),
    });
    const flash = document.getElementById('docSentFlash');
    flash.style.display = 'block';
    setTimeout(() => { flash.style.display = 'none'; }, 3000);
  } catch { alert('Failed to send document.'); }
};
