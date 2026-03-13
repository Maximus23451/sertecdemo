// qa.js
const user = API.requireRole(['qa']);
if (user) {
  document.getElementById('userName').textContent = user.displayName;
  document.getElementById('avatarEl').textContent = user.displayName[0];
}
function logout() { API.clearUser(); location.href = '/pre_login.html'; }

setInterval(() => { document.getElementById('clock').textContent = new Date().toLocaleTimeString('hu-HU'); }, 1000);
document.getElementById('clock').textContent = new Date().toLocaleTimeString('hu-HU');

let questions = [], responses = [], docs = [], pendingQ = null;

API.subscribe({
  init:      d => { questions = d.questions; responses = d.responses; docs = d.docs; pendingQ = d.pending; render(); },
  questions: d => { questions = d; populateSelect(); },
  responses: d => { responses = d; renderResponses(); },
  docs:      d => { docs = d; renderDocs(); },
  pending:   d => { pendingQ = d; renderPending(); },
});

function render() { populateSelect(); renderResponses(); renderDocs(); renderPending(); }

function showTab(n, el) {
  document.querySelectorAll('[id^="tab-"]').forEach(t => t.style.display = 'none');
  document.querySelectorAll('.nav-item').forEach(x => x.classList.remove('active'));
  document.getElementById('tab-' + n).style.display = '';
  el.classList.add('active');
}

function esc(s) { return API.escHtml(s); }

function populateSelect() {
  const sel = document.getElementById('questionSelect');
  sel.innerHTML = questions.length
    ? questions.map(q => `<option value="${q.id}">${esc(q.text)}</option>`).join('')
    : '<option value="">— No questions available —</option>';
  document.getElementById('s-qcount').textContent  = questions.length;
  document.getElementById('s-rcount').textContent  = responses.length;
  document.getElementById('s-nocount').textContent = responses.filter(r => r.answer === 'no').length;
}

function renderPending() {
  const el = document.getElementById('pendingActive'), tx = document.getElementById('pendingText');
  if (pendingQ) { el.classList.add('show'); tx.textContent = pendingQ.text; }
  else { el.classList.remove('show'); }
}

async function sendQuestion() {
  const id = document.getElementById('questionSelect').value;
  if (!id) return;
  await API.sendPending(id);
  const flash = document.getElementById('sentFlash');
  flash.style.display = 'block';
  setTimeout(() => flash.style.display = 'none', 3000);
}

function respHtml(arr) {
  if (!arr.length) return '<div class="empty-hint">No responses yet</div>';
  return arr.slice().reverse().map(r => `
    <div class="answer-item">
      <div class="answer-top">
        <div class="answer-q">${esc(r.question)}</div>
        <span class="badge badge-${r.answer}">${r.answer === 'yes' ? '✓ Yes' : '✗ No'}</span>
      </div>
      <div class="answer-meta">${esc(r.operatorName || 'Operator')} · ${r.time}</div>
      ${r.reason ? `<div class="answer-reason">${esc(r.reason)}</div>` : ''}
    </div>`).join('');
}

function renderResponses() {
  document.getElementById('latest-responses').innerHTML = respHtml(responses.slice(-5));
  document.getElementById('all-responses').innerHTML   = respHtml(responses);
  document.getElementById('s-rcount').textContent  = responses.length;
  document.getElementById('s-nocount').textContent = responses.filter(r => r.answer === 'no').length;
}

function renderDocs() {
  document.getElementById('doc-list').innerHTML = docs.length ? docs.map(d => `
    <div class="pdf-item">
      <div class="pdf-icon"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
      <div class="pdf-info"><div class="pdf-name">${esc(d.name)}</div><div class="pdf-meta">${d.size} · ${d.uploadedAt}</div></div>
      <button class="btn-sm btn-view" onclick="viewPDF('${d.id}','${esc(d.name)}')">View</button>
    </div>`).join('') : '<div class="empty-hint">No documents uploaded by management</div>';
}

async function viewPDF(id, name) {
  const doc = await API.getDocData(id);
  document.getElementById('modalTitle').textContent = name;
  document.getElementById('pdfFrame').src = doc.data + '#toolbar=0&navpanes=0';
  document.getElementById('pdfModal').classList.add('open');
}
function closeModal() {
  document.getElementById('pdfModal').classList.remove('open');
  document.getElementById('pdfFrame').src = '';
}
