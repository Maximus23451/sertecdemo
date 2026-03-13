// theme.js – reliable light/dark theme toggling with localStorage
(function() {
  const THEME_KEY = 'dashboard_theme';

  function setTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem(THEME_KEY, theme);
  }

  function initTheme() {
    const stored = localStorage.getItem(THEME_KEY);
    // Default to light if no stored preference
    setTheme(stored === 'dark' ? 'dark' : 'light');
  }

  window.toggleTheme = function() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    setTheme(isDark ? 'light' : 'dark');
  };

  // Initialize immediately (before page paints)
  initTheme();

  // Optional: log current theme for debugging (remove in production)
  console.log('Theme initialized:', document.documentElement.getAttribute('data-theme') || 'light');
})();
