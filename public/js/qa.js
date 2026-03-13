// qa.js – QA dashboard logic

let activeQuestion = null; // for tracking sent question (optional)

document.addEventListener('DOMContentLoaded', function() {
  // Set user name (from login)
  const userName = localStorage.getItem('loggedInUser') || 'QA User';
  document.getElementById('userName').textContent = userName;

  // Start clock
  updateClock();
  setInterval(updateClock, 1000);

  // Load initial data
  loadStats();
  loadLatestResponses();
  loadAllResponses();
  loadDocuments();
  populateQuestionSelect('questionSelect'); // fill dropdown in send tab
});

// Tab switching
window.showTab = function(tabId, element) {
  // Hide all tabs inside .main (those with id starting with "tab-")
  document.querySelectorAll('.main > div[id^="tab-"]').forEach(tab => {
    tab.style.display = 'none';
  });
  // Show selected tab
  const targetTab = document.getElementById('tab-' + tabId);
  if (targetTab) targetTab.style.display = 'block';

  // Update active class on nav items
  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
  if (element) element.classList.add('active');

  // If switching to manage-questions, refresh the list
  if (tabId === 'manage-questions') {
    renderQuestionList('questionList', true);
  }
};

// Add question handler (called from Manage Questions tab)
window.addQuestionHandler = function() {
  const textInput = document.getElementById('newQText');
  const freqSelect = document.getElementById('newQFreq');
  const text = textInput.value.trim();
  const freq = freqSelect.value;

  if (!text) {
    alert('Please enter a question.');
    return;
  }

  if (addQuestion(text, freq)) {
    textInput.value = ''; // clear input
    renderQuestionList('questionList', true);   // refresh list
    populateQuestionSelect('questionSelect');   // update send dropdown
  }
};

// Clock update
function updateClock() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  document.getElementById('clock').textContent = timeStr;
}

// Stats (counts)
function loadStats() {
  const questions = loadQuestions();
  document.getElementById('s-qcount').textContent = questions.length;

  // Responses counts – these should come from an API or localStorage
  // For demo, we'll use static or fetch from responses store
  // Assume we have a responses array in localStorage
  const responses = JSON.parse(localStorage.getItem('qa_responses') || '[]');
  const total = responses.length;
  const noAnswers = responses.filter(r => r.answer === 'no').length;

  document.getElementById('s-rcount').textContent = total;
  document.getElementById('s-nocount').textContent = noAnswers;
}

// Latest responses (for send tab)
function loadLatestResponses() {
  const container = document.getElementById('latest-responses');
  const responses = JSON.parse(localStorage.getItem('qa_responses') || '[]');
  const latest = responses.slice(-5).reverse(); // show most recent first

  if (latest.length === 0) {
    container.innerHTML = '<div class="empty-hint">No responses yet</div>';
    return;
  }

  let html = '';
  latest.forEach(r => {
    const answerClass = r.answer === 'yes' ? 'badge-yes' : 'badge-no';
    const answerText = r.answer === 'yes' ? 'Igen' : 'Nem';
    html += `
      <div class="answer-item">
        <div class="answer-top">
          <span class="badge ${answerClass}">${answerText}</span>
          <span class="answer-meta">${r.time || ''} · ${r.operator || 'Operator'}</span>
        </div>
        <div class="answer-q">${escapeHtml(r.question)}</div>
        ${r.reason ? `<div class="answer-reason">${escapeHtml(r.reason)}</div>` : ''}
      </div>
    `;
  });
  container.innerHTML = html;
}

// All responses (for Responses tab)
function loadAllResponses() {
  const container = document.getElementById('all-responses');
  const responses = JSON.parse(localStorage.getItem('qa_responses') || '[]');
  if (responses.length === 0) {
    container.innerHTML = '<div class="empty-hint">No responses yet</div>';
    return;
  }

  let html = '';
  responses.slice().reverse().forEach(r => {
    const answerClass = r.answer === 'yes' ? 'badge-yes' : 'badge-no';
    const answerText = r.answer === 'yes' ? 'Igen' : 'Nem';
    html += `
      <div class="answer-item">
        <div class="answer-top">
          <span class="badge ${answerClass}">${answerText}</span>
          <span class="answer-meta">${r.time || ''} · ${r.operator || 'Operator'}</span>
        </div>
        <div class="answer-q">${escapeHtml(r.question)}</div>
        ${r.reason ? `<div class="answer-reason">${escapeHtml(r.reason)}</div>` : ''}
      </div>
    `;
  });
  container.innerHTML = html;
}

// Documents (shared)
function loadDocuments() {
  const container = document.getElementById('doc-list');
  const docs = JSON.parse(localStorage.getItem('uploaded_docs') || '[]');
  if (docs.length === 0) {
    container.innerHTML = '<div class="empty-hint">No documents uploaded by management</div>';
    return;
  }

  let html = '';
  docs.forEach(doc => {
    html += `
      <div class="pdf-item" onclick="openDoc('${doc.url}')">
        <div class="pdf-icon"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
        <div class="pdf-info">
          <div class="pdf-name">${escapeHtml(doc.name)}</div>
          <div class="pdf-meta">${doc.size} · ${doc.date}</div>
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
}

// Open document modal (same as before)
window.openDoc = function(url) {
  document.getElementById('pdfFrame').src = url;
  document.getElementById('modalTitle').textContent = 'Document';
  document.getElementById('pdfModal').classList.add('open');
};

window.closeModal = function() {
  document.getElementById('pdfModal').classList.remove('open');
  document.getElementById('pdfFrame').src = '';
};

// Send question (from send tab)
window.sendQuestion = function() {
  const select = document.getElementById('questionSelect');
  const idx = select.value;
  if (idx === '') {
    alert('Please select a question.');
    return;
  }

  const questions = loadQuestions();
  const question = questions[idx];
  if (!question) return;

  // Store as active question (for operators to see)
  const active = {
    text: question.text,
    freq: question.freq,
    sentAt: new Date().toLocaleString()
  };
  localStorage.setItem('active_question', JSON.stringify(active));

  // Show flash message
  const flash = document.getElementById('sentFlash');
  flash.style.display = 'block';
  setTimeout(() => { flash.style.display = 'none'; }, 3000);

  // Also mark that a new question is pending for operators
  localStorage.setItem('new_question_flag', 'true');
};

// Logout
window.logout = function() {
  localStorage.removeItem('loggedInUser');
  window.location.href = 'pre_login.html';
};

// Helper escape (same as in questions.js, but redeclared locally if needed)
function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return unsafe.replace(/[&<>"]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    if (m === '"') return '&quot;';
    return m;
  });
}

// Initialise by showing first tab
showTab('send', document.querySelector('.nav-item.active') || document.querySelector('.nav-item'));
