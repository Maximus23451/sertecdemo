/**
 * Dashboard App — Backend Server
 * Express + SSE (Server-Sent Events) for real-time cross-device sync
 */

const express = require('express');
const path    = require('path');
const crypto  = require('crypto');
const fs      = require('fs');

// ─── Persistence ──────────────────────────────────────────────
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

function dataPath(name) { return path.join(DATA_DIR, name + '.json'); }

function loadData(name, fallback) {
  try { return JSON.parse(fs.readFileSync(dataPath(name), 'utf8')); }
  catch { return fallback; }
}

function saveData(name, data) {
  try { fs.writeFileSync(dataPath(name), JSON.stringify(data, null, 2)); }
  catch (e) { console.error('Failed to save', name, e.message); }
}

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── Root redirect ───────────────────────────────────────────
app.get('/', (req, res) => res.redirect('/pre_login.html'));

// ─── In-Memory Store ──────────────────────────────────────────
const store = {
  questions:  loadData('questions',  []),
  responses:  loadData('responses',  []),
  docs:       loadData('docs',       []),
  machines:   loadData('machines',   []),
  pending:    null,   // intentionally not persisted
  pendingDoc: null,   // intentionally not persisted
  sseClients: [],
};

// ─── Demo Users ───────────────────────────────────────────────
const USERS = [
  { username: 'manager1',  password: 'demo123', role: 'management', displayName: 'Kovács Péter'  },
  { username: 'manager2',  password: 'demo123', role: 'management', displayName: 'Nagy Anna'      },
  { username: 'qa1',       password: 'demo123', role: 'qa',         displayName: 'Szabó Gábor'   },
  { username: 'qa2',       password: 'demo123', role: 'qa',         displayName: 'Tóth Eszter'   },
  { username: 'operator1', password: 'demo123', role: 'operator',   displayName: 'Horváth Béla'  },
  { username: 'operator2', password: 'demo123', role: 'operator',   displayName: 'Varga Zsolt'   },
  { username: 'operator3', password: 'demo123', role: 'operator',   displayName: 'Kiss Mónika'   },
];

// ─── Helpers ──────────────────────────────────────────────────
function uid() { return crypto.randomBytes(8).toString('hex'); }
function now() { return new Date().toLocaleString('hu-HU'); }

function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  store.sseClients = store.sseClients.filter(client => {
    try { client.res.write(msg); return true; }
    catch { return false; }
  });
}

// ─── Seed demo questions on first run ────────────────────────
if (store.questions.length === 0) {
  store.questions = [
    { id: uid(), text: 'Minden gép megfelelően működik?',      freq: 'Every 1 hour',  createdAt: now(), lastSent: Date.now(), yesLabel: 'Igen', noLabel: 'Nem', requireExplanation: 'no'   },
    { id: uid(), text: 'Elvégezted a biztonsági ellenőrzést?', freq: 'Every shift',   createdAt: now(), lastSent: Date.now(), yesLabel: 'Igen', noLabel: 'Nem', requireExplanation: 'no'   },
    { id: uid(), text: 'A munkaterület tiszta és rendezett?',  freq: 'Every 2 hours', createdAt: now(), lastSent: Date.now(), yesLabel: 'Igen', noLabel: 'Nem', requireExplanation: 'no'   },
    { id: uid(), text: 'Van aktív minőségi probléma?',         freq: 'Every 30 min',  createdAt: now(), lastSent: Date.now(), yesLabel: 'Igen', noLabel: 'Nem', requireExplanation: 'yes'  },
  ];
  saveData('questions', store.questions);
} else {
  // Ensure existing questions have lastSent so the timer works
  store.questions.forEach(q => { if (!q.lastSent) q.lastSent = Date.now(); });
}

// ─── Automated Question Timer (checks every 1 min) ───────────
setInterval(() => {
  const nowMs = Date.now();
  let updated = false;

  store.questions.forEach(q => {
    const elapsed = (nowMs - (q.lastSent || 0)) / 60000; // minutes
    let due = false;
    if (q.freq === 'Every 30 min'  && elapsed >= 30)   due = true;
    if (q.freq === 'Every 1 hour'  && elapsed >= 60)   due = true;
    if (q.freq === 'Every 2 hours' && elapsed >= 120)  due = true;
    if (q.freq === 'Once per day'  && elapsed >= 1440) due = true;

    if (due) {
      q.lastSent   = nowMs;
      store.pending = { id: uid(), text: q.text, sentAt: now(), yesLabel: q.yesLabel || 'Igen', noLabel: q.noLabel || 'Nem', requireExplanation: q.requireExplanation || 'no' };
      updated = true;
    }
  });

  if (updated) {
    saveData('questions', store.questions);
    broadcast('pending', store.pending);
  }
}, 60000);

// ─── Auth ─────────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = USERS.find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ error: 'Invalid username or password' });

  // When an operator logs in, immediately send the "Every shift" question
  if (user.role === 'operator') {
    const shiftQ = store.questions.find(q => q.freq === 'Every shift');
    if (shiftQ) {
      shiftQ.lastSent  = Date.now();
      saveData('questions', store.questions);
      store.pending = { id: uid(), text: shiftQ.text, sentAt: now(), yesLabel: shiftQ.yesLabel || 'Igen', noLabel: shiftQ.noLabel || 'Nem', requireExplanation: shiftQ.requireExplanation || 'no' };
      broadcast('pending', store.pending);
    }
  }

  res.json({ username: user.username, role: user.role, displayName: user.displayName });
});

// ─── SSE — Real-time stream ────────────────────────────────────
app.get('/api/stream', (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  res.write(`event: init\ndata: ${JSON.stringify({
    questions: store.questions,
    responses: store.responses,
    machines:  store.machines,
    docs:      store.docs.map(d => ({ id: d.id, name: d.name, size: d.size, uploadedAt: d.uploadedAt })),
    pending:   store.pending,
  })}\n\n`);

  const client = { id: uid(), res };
  store.sseClients.push(client);

  const ping = setInterval(() => {
    try { res.write(': ping\n\n'); } catch { clearInterval(ping); }
  }, 25000);

  req.on('close', () => {
    clearInterval(ping);
    store.sseClients = store.sseClients.filter(c => c.id !== client.id);
  });
});

// ─── Machines & Parts ─────────────────────────────────────────
app.get('/api/machines', (_, res) => res.json(store.machines));

app.post('/api/machines', (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name required' });
  const machine = { id: uid(), name: name.trim(), parts: [] };
  store.machines.push(machine);
  saveData('machines', store.machines);
  broadcast('machines', store.machines);
  res.json(machine);
});

app.post('/api/machines/:id/parts', (req, res) => {
  const { part } = req.body;
  const machine = store.machines.find(m => m.id === req.params.id);
  if (!machine) return res.status(404).json({ error: 'Machine not found' });
  if (part && part.trim() && !machine.parts.includes(part.trim())) {
    machine.parts.push(part.trim());
    saveData('machines', store.machines);
    broadcast('machines', store.machines);
  }
  res.json(machine);
});

app.delete('/api/machines/:id', (req, res) => {
  store.machines = store.machines.filter(m => m.id !== req.params.id);
  saveData('machines', store.machines);
  broadcast('machines', store.machines);
  res.json({ ok: true });
});

// ─── Questions ────────────────────────────────────────────────
app.get('/api/questions', (_, res) => res.json(store.questions));

app.post('/api/questions', (req, res) => {
  const { text, freq, yesLabel, noLabel, requireExplanation } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'text required' });
  const q = {
    id: uid(), text: text.trim(), freq: freq || 'Every 1 hour',
    yesLabel: yesLabel || 'Igen', noLabel: noLabel || 'Nem',
    requireExplanation: requireExplanation || 'no',
    createdAt: now(), lastSent: Date.now(),
  };
  store.questions.push(q);
  saveData('questions', store.questions);
  broadcast('questions', store.questions);
  res.json(q);
});

app.delete('/api/questions/:id', (req, res) => {
  store.questions = store.questions.filter(q => q.id !== req.params.id);
  saveData('questions', store.questions);
  broadcast('questions', store.questions);
  res.json({ ok: true });
});

// ─── Pending question ─────────────────────────────────────────
app.get('/api/pending', (_, res) => res.json(store.pending));

app.post('/api/pending', (req, res) => {
  const { questionId } = req.body;
  const q = store.questions.find(q => q.id === questionId);
  if (!q) return res.status(404).json({ error: 'Question not found' });
  q.lastSent    = Date.now();
  saveData('questions', store.questions);
  store.pending = { id: uid(), text: q.text, sentAt: now(), yesLabel: q.yesLabel || 'Igen', noLabel: q.noLabel || 'Nem', requireExplanation: q.requireExplanation || 'no' };
  broadcast('pending', store.pending);
  res.json(store.pending);
});

app.delete('/api/pending', (_, res) => {
  store.pending = null;
  broadcast('pending', null);
  res.json({ ok: true });
});

// ─── Responses ────────────────────────────────────────────────
app.get('/api/responses', (_, res) => res.json(store.responses));

app.post('/api/responses', (req, res) => {
  const { question, answer, reason, operatorName, pendingId } = req.body;
  if (!question || !answer) return res.status(400).json({ error: 'question + answer required' });
  const r = { id: uid(), question, answer, reason: reason || '', operatorName: operatorName || 'Operator', time: now(), pendingId };
  store.responses.push(r);
  saveData('responses', store.responses);
  broadcast('responses', store.responses);
  res.json(r);
});

app.delete('/api/responses', (_, res) => {
  store.responses = [];
  saveData('responses', store.responses);
  broadcast('responses', store.responses);
  res.json({ ok: true });
});

// ─── Documents ────────────────────────────────────────────────
app.get('/api/docs', (_, res) =>
  res.json(store.docs.map(d => ({ id: d.id, name: d.name, size: d.size, uploadedAt: d.uploadedAt })))
);

app.post('/api/docs', (req, res) => {
  const { name, size, data } = req.body;
  if (!name || !data) return res.status(400).json({ error: 'name + data required' });
  const doc = { id: uid(), name, size, data, uploadedAt: now() };
  store.docs.push(doc);
  saveData('docs', store.docs);
  broadcast('docs', store.docs.map(d => ({ id: d.id, name: d.name, size: d.size, uploadedAt: d.uploadedAt })));
  res.json({ id: doc.id, name: doc.name, size: doc.size, uploadedAt: doc.uploadedAt });
});

app.get('/api/docs/:id', (req, res) => {
  const doc = store.docs.find(d => d.id === req.params.id);
  if (!doc) return res.status(404).json({ error: 'Not found' });
  res.json({ id: doc.id, name: doc.name, data: doc.data });
});

app.delete('/api/docs/:id', (req, res) => {
  store.docs = store.docs.filter(d => d.id !== req.params.id);
  saveData('docs', store.docs);
  broadcast('docs', store.docs.map(d => ({ id: d.id, name: d.name, size: d.size, uploadedAt: d.uploadedAt })));
  res.json({ ok: true });
});

// ─── Pending document ─────────────────────────────────────────
app.get('/api/pending-doc', (_, res) => res.json(store.pendingDoc));

app.post('/api/pending-doc', (req, res) => {
  const { docId } = req.body;
  const doc = store.docs.find(d => d.id === docId);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  store.pendingDoc = { id: uid(), docId: doc.id, name: doc.name, embedUrl: doc.data, sentAt: now() };
  broadcast('pending-doc', store.pendingDoc);
  res.json(store.pendingDoc);
});

app.delete('/api/pending-doc', (_, res) => {
  store.pendingDoc = null;
  broadcast('pending-doc', null);
  res.json({ ok: true });
});

// ─── Stats ────────────────────────────────────────────────────
app.get('/api/stats', (_, res) => {
  res.json({
    questions:  store.questions.length,
    responses:  store.responses.length,
    noAnswers:  store.responses.filter(r => r.answer === 'no').length,
    docs:       store.docs.length,
    machines:   store.machines.length,
    hasPending: !!store.pending,
  });
});

// ─── Start ────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n✅  Dashboard server running at http://localhost:${PORT}`);
  console.log(`\n📋  Demo credentials (all passwords: demo123)`);
  console.log(`    Management : manager1, manager2`);
  console.log(`    QA         : qa1, qa2`);
  console.log(`    Operator   : operator1, operator2, operator3\n`);
});
