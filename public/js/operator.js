// operator.js
const user = API.requireRole(['operator']);
if (user) {
  document.getElementById('userName').textContent = user.displayName;
  document.getElementById('avatarEl').textContent = user.displayName[0];
}
function logout() { API.clearUser(); location.href = '/pre_login.html'; }

function tick() {
  const n = new Date();
  document.getElementById('clock').textContent   = n.toLocaleTimeString('hu-HU');
  document.getElementById('dateStr').textContent = n.toLocaleDateString('hu-HU', { weekday: 'long', month: 'long', day: 'numeric' });
}
setInterval(tick, 1000); tick();

let pendingQ = null, answeredPendingId = null, myResponses = [], docs = [];

try { myResponses = JSON.parse(sessionStorage.getItem('op_my_responses') || '[]'); } catch {}
try { answeredPendingId = sessionStorage.getItem('op_answered_id') || null; } catch {}

API.subscribe({
  init:          d => { pendingQ = d.pending; docs = d.docs; checkQuestion(); renderHistory(); renderDocs(); if (d.pendingDoc) showDocNotification(d.pendingDoc); },
  pending:       d => { pendingQ = d; checkQuestion(); },
  'pending-doc': d => { if (d) showDocNotification(d); else clearDocNotification(); },
  docs:          d => { docs = d; renderDocs(); },
});

function switchTab(n, btn) {
  document.querySelectorAll('.tab-view').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + n).classList.add('active');
  btn.classList.add('active');
  if (n === 'history') renderHistory();
  if (n === 'docs') renderDocs();
  if (n === 'qa') document.getElementById('nav-qa').classList.remove('has-notif');
}

// ── Question display ───────────────────────────────────────────
function checkQuestion() {
  const navBtn = document.getElementById('nav-qa');
  if (pendingQ && pendingQ.id !== answeredPendingId) {
    document.getElementById('noQuestion').style.display     = 'none';
    document.getElementById('activeQuestion').style.display = 'block';
    document.getElementById('qText').textContent            = pendingQ.text;
    document.getElementById('qSentAt').textContent          = 'Elküldve: ' + pendingQ.sentAt;
    document.getElementById('answerSection').style.display  = '';
    document.getElementById('answeredState').classList.remove('show');

    // Reset both reason boxes
    closeReasonBox();

    // Apply custom button labels
    const yesLabel = pendingQ.yesLabel || 'Igen';
    const noLabel  = pendingQ.noLabel  || 'Nem';
    document.getElementById('btnYesLabel').textContent = yesLabel;
    document.getElementById('btnNoLabel').textContent  = noLabel;

    if (!document.getElementById('tab-qa').classList.contains('active')) navBtn.classList.add('has-notif');
  } else if (!pendingQ) {
    document.getElementById('noQuestion').style.display     = '';
    document.getElementById('activeQuestion').style.display = 'none';
    navBtn.classList.remove('has-notif');
  }
}

function closeReasonBox() {
  document.getElementById('yesReasonBox').classList.remove('open');
  document.getElementById('noReasonBox').classList.remove('open');
  document.getElementById('yesReasonText').value = '';
  document.getElementById('noReasonText').value  = '';
  // Reset textarea border colours
  document.getElementById('yesReasonText').style.borderColor = '';
  document.getElementById('noReasonText').style.borderColor  = '';
}

// ── Answer handlers ────────────────────────────────────────────
function answerYes() {
  if (!pendingQ) return;
  const expl = pendingQ.requireExplanation || 'no';
  if (expl === 'yes' || expl === 'both') {
    // Need explanation before submitting
    closeReasonBox();
    document.getElementById('yesReasonBox').classList.add('open');
    document.getElementById('yesReasonText').focus();
  } else {
    submitAnswer('yes', '');
  }
}

function answerNo() {
  if (!pendingQ) return;
  const expl = pendingQ.requireExplanation || 'no';
  if (expl === 'no' || expl === 'both') {
    closeReasonBox();
    document.getElementById('noReasonBox').classList.add('open');
    document.getElementById('noReasonText').focus();
  } else {
    submitAnswer('no', '');
  }
}

function submitYes() {
  const reason = document.getElementById('yesReasonText').value.trim();
  if (!reason) {
    document.getElementById('yesReasonText').style.borderColor = 'var(--accent)';
    document.getElementById('yesReasonText').placeholder = 'Ez a mező kötelező!';
    return;
  }
  submitAnswer('yes', reason);
}

function submitNo() {
  const reason = document.getElementById('noReasonText').value.trim();
  if (!reason) {
    document.getElementById('noReasonText').style.borderColor = 'var(--red)';
    document.getElementById('noReasonText').placeholder = 'Ez a mező kötelező!';
    return;
  }
  submitAnswer('no', reason);
}

async function submitAnswer(answer, reason) {
  const resp = {
    question: pendingQ.text, answer, reason,
    operatorName: user ? user.displayName : 'Operator',
    pendingId: pendingQ.id,
  };
  await API.addResponse(resp);
  answeredPendingId = pendingQ.id;
  try { sessionStorage.setItem('op_answered_id', answeredPendingId); } catch {}
  myResponses.push({ ...resp, time: new Date().toLocaleString('hu-HU') });
  try { sessionStorage.setItem('op_my_responses', JSON.stringify(myResponses)); } catch {}
  showAnswered(answer, reason);
}

function showAnswered(type, reason) {
  document.getElementById('answerSection').style.display = 'none';
  const state = document.getElementById('answeredState');
  const icon  = document.getElementById('answeredIcon');
  const svg   = document.getElementById('answeredSvg');
  const yesLabel = pendingQ?.yesLabel || 'Igen';
  const noLabel  = pendingQ?.noLabel  || 'Nem';
  if (type === 'yes') {
    icon.className = 'answered-icon yes-icon'; svg.style.stroke = 'var(--accent)';
    svg.innerHTML  = '<polyline points="20 6 9 17 4 12"/>';
    document.getElementById('answeredTitle').textContent = yesLabel + ' — válasz elküldve';
    document.getElementById('answeredSub').textContent   = reason ? 'Ok: ' + reason : 'A QA csapat értesítést kapott';
  } else {
    icon.className = 'answered-icon no-icon'; svg.style.stroke = 'var(--red)';
    svg.innerHTML  = '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>';
    document.getElementById('answeredTitle').textContent = noLabel + ' — válasz elküldve';
    document.getElementById('answeredSub').textContent   = reason ? 'Ok: ' + reason : 'A QA csapat értesítést kapott';
  }
  state.classList.add('show');
  document.getElementById('nav-qa').classList.remove('has-notif');
}

// ── History ────────────────────────────────────────────────────
function esc(s) { return API.escHtml(s); }

function renderHistory() {
  const list = document.getElementById('historyList');
  if (!myResponses.length) { list.innerHTML = '<div class="empty-state">Még nincs válasz</div>'; return; }
  list.innerHTML = myResponses.slice().reverse().map(r => `
    <div class="hist-item">
      <div class="hist-top">
        <div class="hist-q">${esc(r.question)}</div>
        <span class="badge badge-${r.answer}">${r.answer === 'yes' ? '✓ Igen' : '✗ Nem'}</span>
      </div>
      <div class="hist-meta">${r.time || ''}</div>
      ${r.reason ? `<div class="hist-reason">Ok: ${esc(r.reason)}</div>` : ''}
    </div>`).join('');
}

// ── Docs ───────────────────────────────────────────────────────
function renderDocs() {
  const list = document.getElementById('docList');
  list.innerHTML = docs.length ? docs.map(d => `
    <div class="doc-item">
      <div class="doc-icon"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
      <div class="doc-info">
        <div class="doc-name">${esc(d.name)}</div>
        <div class="doc-meta">${d.size} · ${d.uploadedAt}</div>
      </div>
      <button class="btn-view-doc" onclick="viewPDF('${d.id}','${esc(d.name)}')">Megnyit</button>
    </div>`).join('') : '<div class="empty-state">Nincs elérhető dokumentum</div>';
}

async function viewPDF(id, name) {
  const doc = await API.getDocData(id);
  document.getElementById('modalTitle').textContent = name;
  const src = doc.data.startsWith('http') ? doc.data : doc.data + '#toolbar=0&navpanes=0';
  document.getElementById('pdfFrame').src = src;
  document.getElementById('pdfModal').classList.add('open');
}
function closeModal() {
  document.getElementById('pdfModal').classList.remove('open');
  document.getElementById('pdfFrame').src = '';
}

// ── Incoming document notification ────────────────────────────
function showDocNotification(doc) {
  let el = document.getElementById('docNotification');
  if (!el) {
    el = document.createElement('div');
    el.id = 'docNotification';
    el.className = 'doc-notification';
    const qaTab = document.getElementById('tab-qa');
    if (qaTab) qaTab.prepend(el);
  }
  el.innerHTML = `
    <div class="doc-notif-inner">
      <div class="doc-notif-badge"><span class="q-dot"></span> Új dokumentum érkezett</div>
      <div class="doc-notif-name">${API.escHtml(doc.name)}</div>
      <div class="doc-notif-meta">Elküldve: ${API.escHtml(doc.sentAt)}</div>
      <button class="btn-open-doc" onclick="openNotifDoc('${doc.docId}','${API.escHtml(doc.name)}')">
        <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        Megnyit
      </button>
    </div>`;
  el.style.display = 'block';
  document.getElementById('nav-qa').classList.add('has-notif');
}

function clearDocNotification() {
  const el = document.getElementById('docNotification');
  if (el) el.style.display = 'none';
}

async function openNotifDoc(docId, name) {
  const doc = await API.getDocData(docId);
  document.getElementById('modalTitle').textContent = name;
  const src = doc.data.startsWith('http') ? doc.data : doc.data + '#toolbar=0&navpanes=0&zoom=page-width';
  document.getElementById('pdfFrame').src = src;
  document.getElementById('pdfModal').classList.add('open');
}
