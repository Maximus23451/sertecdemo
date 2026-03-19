/**
 * api.js — shared API helpers for all dashboard pages
 * Place this file at: public/api.js
 */

const API = {
  base: '',

  async login(username, password) {
    const r = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!r.ok) throw new Error((await r.json()).error || 'Login failed');
    return r.json();
  },

  setUser(user)  { sessionStorage.setItem('dashboard_user', JSON.stringify(user)); },
  getUser()      { try { return JSON.parse(sessionStorage.getItem('dashboard_user')); } catch { return null; } },
  clearUser()    { sessionStorage.removeItem('dashboard_user'); },

  requireRole(allowed) {
    const user = this.getUser();
    if (!user || !allowed.includes(user.role)) {
      window.location.href = '/pre_login.html';
      return null;
    }
    return user;
  },

  // ── Questions ─────────────────────────────────────────────────
  async getQuestions() { return (await fetch('/api/questions')).json(); },
  async addQuestion(text, freq) {
    return (await fetch('/api/questions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, freq }),
    })).json();
  },
  async deleteQuestion(id) { return (await fetch(`/api/questions/${id}`, { method: 'DELETE' })).json(); },

  // ── Pending ───────────────────────────────────────────────────
  async getPending() { return (await fetch('/api/pending')).json(); },
  async sendPending(questionId) {
    return (await fetch('/api/pending', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId }),
    })).json();
  },
  async clearPending() { return (await fetch('/api/pending', { method: 'DELETE' })).json(); },

  // ── Responses ─────────────────────────────────────────────────
  async getResponses() { return (await fetch('/api/responses')).json(); },
  async addResponse(data) {
    return (await fetch('/api/responses', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })).json();
  },
  async clearResponses() { return (await fetch('/api/responses', { method: 'DELETE' })).json(); },

  // ── Machines & Parts ──────────────────────────────────────────
  async getMachines() { return (await fetch('/api/machines')).json(); },
  async addMachine(name) {
    return (await fetch('/api/machines', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })).json();
  },
  async addPartToMachine(id, part) {
    return (await fetch(`/api/machines/${id}/parts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ part }),
    })).json();
  },
  async deleteMachine(id) { return (await fetch(`/api/machines/${id}`, { method: 'DELETE' })).json(); },

  // ── Documents ─────────────────────────────────────────────────
  async getDocs() { return (await fetch('/api/docs')).json(); },
  async uploadDoc(name, size, data) {
    return (await fetch('/api/docs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, size, data }),
    })).json();
  },
  async getDocData(id) { return (await fetch(`/api/docs/${id}`)).json(); },
  async deleteDoc(id)  { return (await fetch(`/api/docs/${id}`, { method: 'DELETE' })).json(); },

  // ── Stats ─────────────────────────────────────────────────────
  async getStats() { return (await fetch('/api/stats')).json(); },

  // ── SSE real-time events ──────────────────────────────────────
  subscribe(handlers) {
    const es = new EventSource('/api/stream');
    es.addEventListener('init',      e => handlers.init?.(JSON.parse(e.data)));
    es.addEventListener('questions', e => handlers.questions?.(JSON.parse(e.data)));
    es.addEventListener('responses', e => handlers.responses?.(JSON.parse(e.data)));
    es.addEventListener('docs',      e => handlers.docs?.(JSON.parse(e.data)));
    es.addEventListener('machines',  e => handlers.machines?.(JSON.parse(e.data)));
    es.addEventListener('pending',   e => handlers.pending?.(JSON.parse(e.data)));
    es.onerror = () => setTimeout(() => this.subscribe(handlers), 3000);
    return es;
  },

  // ── Utilities ─────────────────────────────────────────────────
  escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  },
  formatSize(b) {
    return b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : (b / 1024).toFixed(0) + ' KB';
  },
};
