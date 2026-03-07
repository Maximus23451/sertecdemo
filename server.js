/**
 * Dashboard App — Backend Server
 * Express + SSE (Server-Sent Events) for real-time cross-device sync
 * In-memory store (resets on restart) — swap for a DB for production
 */

const express  = require('express');
const multer   = require('multer');
const path     = require('path');
const crypto   = require('crypto');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── Root redirect ───────────────────────────────────────────
app.get('/', (req, res) => res.redirect('/pre_login.html'));

// ─── In-Memory Store ──────────────────────────────────────────
const store = {
  questions:  [],   // { id, text, freq, createdAt }
  responses:  [],   // { id, question, answer, reason, time, operatorName }
  docs:       [],   // { id, name, size, uploadedAt, data (base64) }
  pending:    null, // { id, text, sentAt } — active question sent to operators
  sseClients: [],   // SSE connections
};

// ─── Demo Users ───────────────────────────────────────────────
const USERS = [
  { username: 'manager1',  password: 'demo123', role: 'management', displayName: 'Kovács Péter' },
  { username: 'manager2',  password: 'demo123', role: 'management', displayName: 'Nagy Anna' },
  { username: 'qa1',       password: 'demo123', role: 'qa',         displayName: 'Szabó Gábor' },
  { username: 'qa2',       password: 'demo123', role: 'qa',         displayName: 'Tóth Eszter' },
  { username: 'operator1', password: 'demo123', role: 'operator',   displayName: 'Horváth Béla' },
  { username: 'operator2', password: 'demo123', role: 'operator',   displayName: 'Varga Zsolt' },
  { username: 'operator3', password: 'demo123', role: 'operator',   displayName: 'Kiss Mónika' },
];

// Seed some demo questions
store.questions = [
  { id: uid(), text: 'Minden gép megfelelően működik?',        freq: 'Every 1 hour',  createdAt: now() },
  { id: uid(), text: 'Elvégezted a biztonsági ellenőrzést?',   freq: 'Every shift',   createdAt: now() },
  { id: uid(), text: 'A munkaterület tiszta és rendezett?',    freq: 'Every 2 hours', createdAt: now() },
  { id: uid(), text: 'Van aktív minőségi probléma?',           freq: 'Every 30 min',  createdAt: now() },
];

// ─── Helpers ──────────────────────────────────────────────────
function uid()  { return crypto.randomBytes(8).toString('hex'); }
function now()  { return new Date().toLocaleString('hu-HU'); }

// Broadcast to all SSE clients
function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  store.sseClients = store.sseClients.filter(client => {
    try { client.res.write(msg); return true; }
    catch { return false; }
  });
}

// ─── Auth ─────────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = USERS.find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ error: 'Invalid username or password' });
  res.json({ username: user.username, role: user.role, displayName: user.displayName });
});

// ─── SSE — Real-time stream ────────────────────────────────────
app.get('/api/stream', (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  // Send current state immediately on connect
  res.write(`event: init\ndata: ${JSON.stringify({
    questions: store.questions,
    responses: store.responses,
    docs:      store.docs.map(d => ({ id: d.id, name: d.name, size: d.size, uploadedAt: d.uploadedAt })),
    pending:   store.pending,
  })}\n\n`);

  const client = { id: uid(), res };
  store.sseClients.push(client);

  // Keepalive ping every 25s
  const ping = setInterval(() => {
    try { res.write(': ping\n\n'); } catch { clearInterval(ping); }
  }, 25000);

  req.on('close', () => {
    clearInterval(ping);
    store.sseClients = store.sseClients.filter(c => c.id !== client.id);
  });
});

// ─── Questions ────────────────────────────────────────────────
app.get('/api/questions', (_, res) => res.json(store.questions));

app.post('/api/questions', (req, res) => {
  const { text, freq } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'text required' });
  const q = { id: uid(), text: text.trim(), freq: freq || 'Every 1 hour', createdAt: now() };
  store.questions.push(q);
  broadcast('questions', store.questions);
  res.json(q);
});

app.delete('/api/questions/:id', (req, res) => {
  store.questions = store.questions.filter(q => q.id !== req.params.id);
  broadcast('questions', store.questions);
  res.json({ ok: true });
});

// ─── Send / clear pending question ───────────────────────────
app.post('/api/pending', (req, res) => {
  const { questionId } = req.body;
  const q = store.questions.find(q => q.id === questionId);
  if (!q) return res.status(404).json({ error: 'Question not found' });
  store.pending = { id: uid(), text: q.text, sentAt: now() };
  broadcast('pending', store.pending);
  res.json(store.pending);
});

app.delete('/api/pending', (_, res) => {
  store.pending = null;
  broadcast('pending', null);
  res.json({ ok: true });
});

app.get('/api/pending', (_, res) => res.json(store.pending));

// ─── Responses ────────────────────────────────────────────────
app.get('/api/responses', (_, res) => res.json(store.responses));

app.post('/api/responses', (req, res) => {
  const { question, answer, reason, operatorName, pendingId } = req.body;
  if (!question || !answer) return res.status(400).json({ error: 'question + answer required' });
  const r = { id: uid(), question, answer, reason: reason || '', operatorName: operatorName || 'Operator', time: now(), pendingId };
  store.responses.push(r);
  broadcast('responses', store.responses);
  res.json(r);
});

// ─── Documents ────────────────────────────────────────────────
app.get('/api/docs', (_, res) => {
  // Return metadata only (no base64 data in list)
  res.json(store.docs.map(d => ({ id: d.id, name: d.name, size: d.size, uploadedAt: d.uploadedAt })));
});

app.post('/api/docs', (req, res) => {
  const { name, size, data } = req.body;
  if (!name || !data) return res.status(400).json({ error: 'name + data required' });
  const doc = { id: uid(), name, size, data, uploadedAt: now() };
  store.docs.push(doc);
  broadcast('docs', store.docs.map(d => ({ id: d.id, name: d.name, size: d.size, uploadedAt: d.uploadedAt })));
  res.json({ id: doc.id, name: doc.name, size: doc.size, uploadedAt: doc.uploadedAt });
});

app.get('/api/docs/:id', (req, res) => {
  const doc = store.docs.find(d => d.id === req.params.id);
  if (!doc) return res.status(404).json({ error: 'Not found' });
  // Return base64 data for viewing (no Content-Disposition: attachment header = no download prompt)
  res.json({ id: doc.id, name: doc.name, data: doc.data });
});

app.delete('/api/docs/:id', (req, res) => {
  store.docs = store.docs.filter(d => d.id !== req.params.id);
  broadcast('docs', store.docs.map(d => ({ id: d.id, name: d.name, size: d.size, uploadedAt: d.uploadedAt })));
  res.json({ ok: true });
});

// ─── Stats helper ─────────────────────────────────────────────
app.get('/api/stats', (_, res) => {
  res.json({
    questionCount:  store.questions.length,
    responseCount:  store.responses.length,
    noCount:        store.responses.filter(r => r.answer === 'no').length,
    docCount:       store.docs.length,
    hasPending:     !!store.pending,
  });
});

// ─── Start ────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n✅ Dashboard server running at http://localhost:${PORT}`);
  console.log(`\n📋 Demo credentials (all passwords: demo123)`);
  console.log(`   Management : manager1, manager2`);
  console.log(`   QA         : qa1, qa2`);
  console.log(`   Operator   : operator1, operator2, operator3\n`);
});
