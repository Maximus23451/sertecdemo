// theme.js — shared light/dark mode logic
// Light mode is the default. Call initTheme() on every page.

const THEME_KEY = 'dashboard_theme';

function initTheme() {
  // Default is light; only switch to dark if stored preference exists
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
  // else: light mode (default, no attribute needed)
}

function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  if (isDark) {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem(THEME_KEY, 'light');
  } else {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem(THEME_KEY, 'dark');
  }
}

// Run immediately (before render to avoid flash)
initTheme();
