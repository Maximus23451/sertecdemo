document.addEventListener('DOMContentLoaded', async function () {
  const user = API.getUser();
  const displayName = user?.displayName || 'Manager';
  document.getElementById('userName').textContent = displayName;
  document.getElementById('avatarEl').textContent = displayName[0] || 'M';

  updateClock();
  setInterval(updateClock, 1000);

  await refreshAll();

  API.subscribe({
    init:      async (d) => { await refreshAll(); window._machines = d.machines ||[]; filterMachines(); },
    responses: async () => { await loadResponsesOverview(); await loadAllResponses(); await loadStats(); },
    docs:      async () => { await loadDocuments(); await loadStats(); },
    questions: async () => { await loadOverviewQuestions(); await loadStats(); },
    machines:  (d) => { window._machines = d; filterMachines(); }
  });

  const zone = document.getElementById('uploadZone');
  zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('drag'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag'));
  zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('drag'); handleFiles(e.dataTransfer.files); });
});

async function refreshAll() {
  await Promise.all([ loadStats(), loadDocuments(), loadResponsesOverview(), loadAllResponses(), loadOverviewQuestions() ]);
}

function updateClock() {
  document.getElementById('clock').textContent = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

async function loadStats() {
  try {
    const stats = await API.getStats();
    document.getElementById('s-r').textContent    = stats.responses ?? 0;
    document.getElementById('s-no').textContent   = stats.noAnswers ?? 0;
    document.getElementById('s-docs').textContent = stats.docs      ?? 0;
  } catch (e) { console.error('Failed to load stats', e); }
}

async function loadResponsesOverview() {
  const container = document.getElementById('ov-responses');
  try {
    const responses = await API.getResponses();
    const latest = responses.slice(-5).reverse();
    container.innerHTML = latest.length ? latest.map(renderResponseItem).join('') : '<div class="empty-hint">No responses yet</div>';
  } catch { container.innerHTML = '<div class="empty-hint">Failed to load responses</div>'; }
}

async function loadOverviewQuestions() {
  const container = document.getElementById('ov-questions');
  try {
    const questions = await API.getQuestions();
    container.innerHTML = questions.length ? questions.map(q => `
      <div class="q-item">
        <span class="q-text">${escapeHtml(q.text)}</span>
        <span class="q-freq">${escapeHtml(q.freq)}</span>
      </div>`).join('') : '<div class="empty-hint">No questions configured</div>';
  } catch { container.innerHTML = '<div class="empty-hint">Failed to load questions</div>'; }
}

async function loadAllResponses() {
  const container = document.getElementById('all-responses');
  if (!container) return;
  try {
    const responses = await API.getResponses();
    container.innerHTML = responses.length ? responses.slice().reverse().map(renderResponseItem).join('') : '<div class="empty-hint">No responses yet</div>';
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

// ── Custom Modal Logic ──────────────────────────────────────────
let confirmAction = null;
window.openConfirmModal = function(text, actionFn) {
  document.getElementById('confirmModalText').textContent = text;
  confirmAction = actionFn;
  document.getElementById('confirmModal').classList.add('open');
};
window.closeConfirmModal = function() {
  document.getElementById('confirmModal').classList.remove('open');
  confirmAction = null;
};
document.getElementById('confirmModalAction').addEventListener('click', async () => {
  if (confirmAction) await confirmAction();
  closeConfirmModal();
});

window.promptClearResponses = function() {
  openConfirmModal('Are you sure you want to clear all recorded responses? This action cannot be undone.', async () => {
    await API.clearResponses();
    await refreshAll();
  });
};

// ── Machines & Parts ──────────────────────────────────────────
window._machines =[];
window.addNewMachine = async function() {
  const inp = document.getElementById('newMachineName');
  if(!inp.value.trim()) return;
  await API.addMachine(inp.value.trim());
  inp.value = '';
};
window.addPart = async function(id) {
  const inp = document.getElementById('part-input-' + id);
  if(!inp.value.trim()) return;
  await API.addPartToMachine(id, inp.value.trim());
  inp.value = '';
};
window.deleteMachine = async function(id) {
  openConfirmModal('Are you sure you want to delete this machine?', async () => {
    await API.deleteMachine(id);
  });
};
window.filterMachines = function() {
  const q = document.getElementById('machineSearch').value.toLowerCase();
  const list = document.getElementById('machineList');
  const filtered = window._machines.filter(m => 
    m.name.toLowerCase().includes(q) || m.parts.some(p => p.toLowerCase().includes(q))
  );
  
  if(!filtered.length) { list.innerHTML = '<div class="empty-hint">No machines found</div>'; return; }
  
  list.innerHTML = filtered.map(m => `
    <div class="machine-item">
      <div class="machine-header">
        <span class="machine-name">${escapeHtml(m.name)}</span>
        <button class="btn-icon del" onclick="deleteMachine('${m.id}')"><svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>
      <div class="machine-parts">
        ${m.parts.map(p => `<span class="part-badge">${escapeHtml(p)}</span>`).join('')}
      </div>
      <div class="add-part-form">
        <input class="inp" style="min-height:30px; padding:4px 8px;" id="part-input-${m.id}" placeholder="Link part..."/>
        <button class="btn-add" style="padding:4px 12px; font-size:0.75rem;" onclick="addPart('${m.id}')">Add</button>
      </div>
    </div>
  `).join('');
};

// ── Documents ──────────────────────────────────────────────────
async function loadDocuments() {
  const list = document.getElementById('pdfList');
  try {
    const docs = await API.getDocs();
    list.innerHTML = docs.length ? docs.map(doc => {
      const isLinked = doc.linked === true || (doc.data && doc.data.startsWith('http'));
      const badge = isLinked ? `<span class="doc-source-badge ${doc.source === 'onedrive' ? 'onedrive' : 'gdrive'}">${doc.source === 'onedrive' ? 'OneDrive' : 'Google Drive'}</span>` : `<span class="doc-source-badge upload">Uploaded</span>`;
      return `
        <div class="pdf-item">
          <div class="pdf-icon"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
          <div class="pdf-info"><div class="pdf-name">${escapeHtml(doc.name)} ${badge}</div><div class="pdf-meta">${escapeHtml(doc.size || '')}${doc.uploadedAt ? ' · ' + escapeHtml(doc.uploadedAt) : ''}</div></div>
          <div class="pdf-actions">
            <button class="btn-sm btn-view" onclick="openDoc('${doc.id}', '${escapeHtml(doc.name)}')">View</button>
            <button class="btn-sm btn-del"  onclick="deleteDoc('${doc.id}')">Delete</button>
          </div>
        </div>`;
    }).join('') : '<div class="empty-hint">No documents yet</div>';
  } catch { list.innerHTML = '<div class="empty-hint">Failed to load documents</div>'; }
}

window.deleteDoc = async function (id) {
  openConfirmModal('Are you sure you want to delete this document?', async () => {
    try { await API.deleteDoc(id); await loadDocuments(); await loadStats(); } catch { alert('Failed to delete document.'); }
  });
};

function parseCloudUrl(raw) {
  const url = raw.trim();
  const gdMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
  if (gdMatch) return { embedUrl: `https://drive.google.com/file/d/${gdMatch[1]}/preview`, source: 'gdrive' };
  if (url.includes('onedrive.live.com/embed') || url.includes('sharepoint.com')) return { embedUrl: url, source: 'onedrive' };
  if (url.includes('1drv.ms')) return { error: 'OneDrive short links (1drv.ms) cannot be embedded. Use Embed link.' };
  return null;
}

window.addLinkedDoc = async function () {
  const nameInput = document.getElementById('linkName'), urlInput = document.getElementById('linkUrl'), errorEl = document.getElementById('linkError');
  const name = nameInput.value.trim(), raw = urlInput.value.trim();
  errorEl.style.display = 'none';
  if (!name || !raw) { showLinkError('Provide name and URL.'); return; }
  const parsed = parseCloudUrl(raw);
  if (!parsed) { showLinkError('URL not recognised.'); return; }
  if (parsed.error) { showLinkError(parsed.error); return; }
  try {
    await API.uploadDoc(name, parsed.source === 'gdrive' ? 'Google Drive' : 'OneDrive', parsed.embedUrl);
    nameInput.value = ''; urlInput.value = ''; await loadDocuments(); await loadStats();
  } catch { showLinkError('Failed to save document link.'); }
};

function showLinkError(msg) { const el = document.getElementById('linkError'); el.textContent = '⚠ ' + msg; el.style.display = 'block'; }

window.handleFiles = async function (files) {
  const allowed = Array.from(files).filter(f => f.type === 'application/pdf');
  if (!allowed.length) { alert('Only PDF files are allowed.'); return; }
  for (const file of allowed) {
    try {
      const base64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(file); });
      await API.uploadDoc(file.name, API.formatSize(file.size), base64);
    } catch (e) { alert(`Failed: ${e.message}`); }
  }
  await loadDocuments(); await loadStats();
};

window.openDoc = async function (id, name) {
  try {
    const doc = await API.getDocData(id);
    document.getElementById('pdfFrame').src = doc.data.startsWith('http') ? doc.data : doc.data + '#toolbar=0&navpanes=0';
    document.getElementById('modalTitle').textContent = name;
    document.getElementById('pdfModal').classList.add('open');
  } catch { alert('Failed to open document.'); }
};

window.closeModal = function () { document.getElementById('pdfModal').classList.remove('open'); document.getElementById('pdfFrame').src = ''; };
window.showTab = function (tabId, element) {
  document.querySelectorAll('div[id^="tab-"]').forEach(t => t.style.display = 'none');
  document.getElementById('tab-' + tabId).style.display = 'block';
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  if (element) element.classList.add('active');
};
window.logout = function () { API.clearUser(); window.location.href = '/pre_login.html'; };
function escapeHtml(u) { return !u ? '' : String(u).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m])); }
