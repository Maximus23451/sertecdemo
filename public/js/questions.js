// questions.js – kept for compatibility; all data operations now go through API.
// qa.js (loaded after this file) overrides deleteQuestionHandler, populateQuestionSelect,
// addQuestionHandler, and renderQuestionList with API-backed versions.

function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return String(unsafe).replace(/[&<>"]/g, m =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m])
  );
}

// Stub — overridden by qa.js after this script loads
window.deleteQuestionHandler = function () {};
window.populateQuestionSelect = function () {};
window.renderQuestionList     = function () {};
window.loadQuestions          = function () { return []; };
window.addQuestion            = function () { return false; };
window.deleteQuestion         = function () { return false; };

console.log('✅ questions.js loaded (API mode — stubs only)');
