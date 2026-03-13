// management.js – Management dashboard (without question management)

document.addEventListener('DOMContentLoaded', function() {
  const userName = localStorage.getItem('loggedInUser') || 'Manager';
  document.getElementById('userName').textContent = userName;
  updateClock();
  setInterval(updateClock, 1000);
  loadStats();
  loadDocuments();
  loadResponsesOverview();
});

function updateClock() {
  const now = new Date();
  document.getElementById('clock').textContent = now.toLocaleTimeString();
}

function loadStats() {
  const questions = window.loadQuestions ? loadQuestions() : [];
  document.getElementById('s-q').textContent = questions.length;

  const responses = JSON.parse(localStorage.getItem('qa_responses') || '[]');
  document.getElementById('s-r').textContent = responses.length;
  document.getElementById('s-no').textContent = responses.filter(r => r.answer === 'no').length;

  const docs = JSON.parse(localStorage.getItem('uploaded_docs') || '[]');
  document.getElementById('s-docs').textContent = docs.length;
}

function loadDocuments() {
  const list = document.getElementById('pdfList');
  const docs = JSON.parse(localStorage.getItem('uploaded_docs') || '[]');
  if (docs.length === 0) {
    list.innerHTML = '<div class="empty-hint">No documents uploaded</div>';
    return;
  }
  let html = '';
  docs.forEach((doc, i) => {
    html += `
      <div class="pdf-item">
        <div class="pdf-icon"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
        <div class="pdf-info">
          <div class="pdf-name">${escapeHtml(doc.name)}</div>
          <div class="pdf-meta">${doc.size} · ${doc.date}</div>
        </div>
        <div class="pdf-actions">
          <button class="btn-sm btn-view" onclick="openDoc('${doc.url}')">View</button>
          <button class="btn-sm btn-del" onclick="deleteDoc(${i})">Delete</button>
        </div>
      </div>
    `;
  });
  list.innerHTML = html;
}

// Upload handling (same as before)
window.handleFiles = function(files) {
  // ... (keep your existing upload logic)
};

window.deleteDoc = function(index) {
  let docs = JSON.parse(localStorage.getItem('uploaded_docs') || '[]');
  docs.splice(index, 1);
  localStorage.setItem('uploaded_docs', JSON.stringify(docs));
  loadDocuments();
  loadStats(); // update doc count
};

// Responses for overview
function loadResponsesOverview() {
  const container = document.getElementById('ov-responses');
  const responses = JSON.parse(localStorage.getItem('qa_responses') || '[]');
  const latest = responses.slice(-5).reverse();
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
          <span class="answer-meta">${r.time || ''}</span>
        </div>
        <div class="answer-q">${escapeHtml(r.question)}</div>
      </div>
    `;
  });
  container.innerHTML = html;
}

// Tab switching
window.showTab = function(tabId, element) {
  document.querySelectorAll('.main > div[id^="tab-"]').forEach(tab => tab.style.display = 'none');
  document.getElementById('tab-' + tabId).style.display = 'block';
  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
  element.classList.add('active');
};

window.openDoc = function(url) { /* ... modal logic ... */ };
window.closeModal = function() { /* ... */ };
window.logout = function() { /* ... */ };

function escapeHtml(unsafe) { /* same as before */ }
