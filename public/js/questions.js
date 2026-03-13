// questions.js – Shared question bank management

const QUESTIONS_KEY = 'qa_questions';

// Default questions (used if nothing in localStorage)
const DEFAULT_QUESTIONS = [
  { text: 'Minden gép megfelelően működik?', freq: 'Every 1 hour' },
  { text: 'Elvégezted a biztonsági ellenőrzést?', freq: 'Every shift' },
  { text: 'A munkaterület tiszta és rendezett?', freq: 'Every 2 hours' },
  { text: 'Van aktív minőségi probléma?', freq: 'Every 30 min' }
];

// Load questions from localStorage
function loadQuestions() {
  const stored = localStorage.getItem(QUESTIONS_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error('Failed to parse stored questions', e);
    }
  }
  // If nothing stored, set defaults
  localStorage.setItem(QUESTIONS_KEY, JSON.stringify(DEFAULT_QUESTIONS));
  return DEFAULT_QUESTIONS.slice(); // return a copy
}

// Save questions to localStorage
function saveQuestions(questions) {
  localStorage.setItem(QUESTIONS_KEY, JSON.stringify(questions));
}

// Add a new question
function addQuestion(text, freq) {
  if (!text.trim()) return false;
  const questions = loadQuestions();
  questions.push({ text: text.trim(), freq });
  saveQuestions(questions);
  return true;
}

// Delete a question by index
function deleteQuestion(index) {
  const questions = loadQuestions();
  if (index >= 0 && index < questions.length) {
    questions.splice(index, 1);
    saveQuestions(questions);
    return true;
  }
  return false;
}

// Render the question list into a given container
function renderQuestionList(containerId, withDelete = true) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const questions = loadQuestions();
  if (questions.length === 0) {
    container.innerHTML = '<div class="empty-hint">No questions yet.</div>';
    return;
  }

  let html = '';
  questions.forEach((q, idx) => {
    html += `
      <div class="q-item" data-index="${idx}">
        <span class="q-text">${escapeHtml(q.text)}</span>
        <span class="q-freq">${escapeHtml(q.freq)}</span>
        ${withDelete ? `
          <button class="btn-icon del" onclick="deleteQuestionHandler(${idx})" title="Delete">
            <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        ` : ''}
      </div>
    `;
  });
  container.innerHTML = html;
}

// Helper to escape HTML (prevent XSS)
function escapeHtml(unsafe) {
  return unsafe.replace(/[&<>"]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    if (m === '"') return '&quot;';
    return m;
  });
}

// Global delete handler (used by buttons)
window.deleteQuestionHandler = function(index) {
  if (deleteQuestion(index)) {
    // Re-render both management and QA lists if they exist
    if (document.getElementById('questionList')) renderQuestionList('questionList', true);
    if (document.getElementById('questionListManage')) renderQuestionList('questionListManage', true); // if used elsewhere
    // Also update QA send dropdown
    if (typeof populateQuestionSelect === 'function') populateQuestionSelect();
  }
};

// Populate a <select> with questions (for QA send tab)
function populateQuestionSelect(selectId) {
  const select = document.getElementById(selectId);
  if (!select) return;
  const questions = loadQuestions();
  select.innerHTML = '';
  if (questions.length === 0) {
    select.innerHTML = '<option value="">— No questions available —</option>';
    return;
  }
  questions.forEach((q, idx) => {
    const option = document.createElement('option');
    option.value = idx; // store index as value (or use text)
    option.textContent = q.text;
    select.appendChild(option);
  });
}

// Make functions globally available (for onclick attributes)
window.loadQuestions = loadQuestions;
window.addQuestion = addQuestion;
window.deleteQuestion = deleteQuestion;
window.renderQuestionList = renderQuestionList;
window.populateQuestionSelect = populateQuestionSelect;
