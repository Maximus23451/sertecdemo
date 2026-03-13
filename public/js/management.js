// management.js
const user = API.requireRole(['management']);
if (user) {
  document.getElementById('userName').textContent = user.displayName;
  document.getElementById('avatarEl').textContent = user.displayName[0];
}
function logout() { API.clearUser(); location.href = '/pre_login.html'; }

setInterval(() => { document.getElementById('clock').textContent = new Date().toLocaleTimeString('hu-HU'); }, 1000);
document.getElementById('clock').textContent = new Date().toLocaleTimeString('hu-HU');

let questions = [], responses = [], docs = [];

API.subscribe({
  init:      d => { questions = d.questions; responses = d.responses; docs = d.docs; render(); },
  questions: d => { questions = d; render(); },
  responses: d => { responses = d; render(); },
  docs:      d => { docs = d; renderDocs(); updateStats(); },
});

function render() { renderStats(); renderQList(); renderResponses(); renderDocs(); }

function showTab(name, el) {
  document.querySelectorAll('[id^="tab-"]').forEach(t => t.style.display = 'none');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('tab-' + name).style.display = '';
  el.classList.add('active');
}

function esc(s) { return API.escHtml(s); }

function renderStats() {
  document.getElementById('s-q').textContent    = questions.length;
  document.getElementById('s-r').textContent    = responses.length;
  document.getElementById('s-no').textContent   = responses.filter(r => r.answer === 'no').length;
  document.getElementById('s-docs').textContent = docs.length;
}
function updateStats() { document.getElementById('s-docs').textContent = docs.length; }

function renderQList() {
  const el = document.getElementById('questionList'), ov = document.getElementById('ov-questions');
  if (!questions.length) { el.innerHTML = '<div class="empty-hint">No questions yet.</div>'; ov.innerHTML = '<div class="empty-hint">No questions configured</div>'; return; }
  const rows = questions.map(q => `
    <div class="q-item">
      <div class="q-text">${esc(q.text)}</div>
      <div class="q-freq">${q.freq}</div>
      <button class="btn-icon del" onclick="delQuestion('${q.id}')">
        <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
      </button>
    </div>`).join('');
  el.innerHTML = rows;
  ov.innerHTML = questions.map(q => `<div class="q-item"><div class="q-text">${esc(q.text)}</div><div class="q-freq">${q.freq}</div></div>`).join('');
}

function responseHtml(arr) {
  if (!arr.length) return '<div class="empty-hint">No responses yet</div>';
  return arr.slice().reverse().map(r => `
    <div class="answer-item">
      <div class="answer-top"><div class="answer-q">${esc(r.question)}</div><span class="badge badge-${r.answer}">${r.answer === 'yes' ? '✓ Yes' : '✗ No'}</span></div>
      <div class="answer-meta">${esc(r.operatorName || 'Operator')} · ${r.time}</div>
      ${r.reason ? `<div class="answer-reason">Reason: ${esc(r.reason)}</div>` : ''}
    </div>`).join('');
}
function renderResponses() {
  document.getElementById('ov-responses').innerHTML  = responseHtml(responses.slice(-5));
  document.getElementById('all-responses').innerHTML = responseHtml(responses);
  renderStats();
}

function renderDocs() {
  const list = document.getElementById('pdfList');
  if (!docs.length) { list.innerHTML = ''; return; }
  list.innerHTML = docs.map(d => `
    <div class="pdf-item">
      <div class="pdf-icon"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
      <div class="pdf-info"><div class="pdf-name">${esc(d.name)}</div><div class="pdf-meta">${d.size} · ${d.uploadedAt}</div></div>
      <div class="pdf-actions">
        <button class="btn-sm btn-view" onclick="viewPDF('${d.id}','${esc(d.name)}')">View</button>
        <button class="btn-sm btn-del"  onclick="delDoc('${d.id}')">Delete</button>
      </div>
    </div>`).join('');
}

async function handleFiles(files) {
  for (const file of Array.from(files)) {
    if (file.type !== 'application/pdf') continue;
    const reader = new FileReader();
    reader.onload = async e => { await API.uploadDoc(file.name, API.formatSize(file.size), e.target.result); };
    reader.readAsDataURL(file);
  }
}

async function addQuestion() {
  const text = document.getElementById('newQText').value.trim();
  const freq = document.getElementById('newQFreq').value;
  if (!text) return;
  await API.addQuestion(text, freq);
  document.getElementById('newQText').value = '';
}

async function delQuestion(id) { await API.deleteQuestion(id); }
async function delDoc(id) { await API.deleteDoc(id); }

async function viewPDF(id, name) {
  const doc = await API.getDocData(id);
  document.getElementById('modalTitle').textContent = name;
  document.getElementById('pdfFrame').src = doc.data + '#toolbar=0&navpanes=0';
  document.getElementById('pdfModal').classList.add('open');
}
function closeModal() { document.getElementById('pdfModal').classList.remove('open'); document.getElementById('pdfFrame').src = ''; }

const zone = document.getElementById('uploadZone');
zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag'); });
zone.addEventListener('dragleave', () => zone.classList.remove('drag'));
zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('drag'); handleFiles(e.dataTransfer.files); });
