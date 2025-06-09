/**
 * Theme Switcher Module
 * Handles dark/light mode toggling with system preference detection
 * and localStorage persistence.
 */

// Theme configuration constants
const THEMES = {
  LIGHT: {
    name: 'light',
    icon: '☀️',
    label: 'Light Mode',
    className: 'light-theme'
  },
  DARK: {
    name: 'dark',
    icon: '🌙',
    label: 'Dark Mode',
    className: 'dark-theme'
  }
};

// DOM Elements
let themeToggleBtn;
let themeIcon;
let themeLabel;

// Current theme state
let currentTheme = null;

/**
 * Initialize the theme switcher
 */
export function initThemeSwitcher() {
  // Cache DOM elements
  themeToggleBtn = document.getElementById('theme-toggle');
  themeIcon = document.getElementById('theme-icon');
  themeLabel = document.getElementById('theme-label');

  // Set initial theme
  setInitialTheme();

  // Add event listeners
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', toggleTheme);
  }

  // Watch for system theme changes
  const colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
  colorSchemeQuery.addEventListener('change', handleSystemThemeChange);
}

/**
 * Set the initial theme based on user preference or system setting
 */
function setInitialTheme() {
  const savedTheme = localStorage.getItem('theme');
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  if (savedTheme) {
    // Use saved theme if available
    applyTheme(savedTheme === 'dark' ? THEMES.DARK : THEMES.LIGHT);
  } else {
    // Use system preference if no saved theme
    applyTheme(systemPrefersDark ? THEMES.DARK : THEMES.LIGHT);
  }
}

/**
 * Toggle between light and dark themes
 */
export function toggleTheme() {
  const newTheme = currentTheme === THEMES.LIGHT ? THEMES.DARK : THEMES.LIGHT;
  applyTheme(newTheme);
}

/**
 * Apply the specified theme to the document
 * @param {Object} theme - Theme object (THEMES.LIGHT or THEMES.DARK)
 */
function applyTheme(theme) {
  // Update document attributes
  document.documentElement.classList.remove(THEMES.LIGHT.className, THEMES.DARK.className);
  document.documentElement.classList.add(theme.className);
  document.documentElement.setAttribute('data-theme', theme.name);

  // Update UI elements
  if (themeIcon) themeIcon.textContent = theme.icon;
  if (themeLabel) themeLabel.textContent = theme.label;
  if (themeToggleBtn) {
    themeToggleBtn.setAttribute('aria-label', `Switch to ${theme === THEMES.LIGHT ? 'dark' : 'light'} mode`);
  }

  // Save to localStorage
  localStorage.setItem('theme', theme.name);

  // Update current theme
  currentTheme = theme;

  // Dispatch custom event
  const themeChangeEvent = new CustomEvent('themeChanged', {
    detail: { theme: theme.name }
  });
  document.dispatchEvent(themeChangeEvent);
}

/**
 * Handle system theme changes when no preference is set
 * @param {MediaQueryListEvent} e - Media query event
 */
function handleSystemThemeChange(e) {
  // Only respond if user hasn't set a preference
  if (!localStorage.getItem('theme')) {
    applyTheme(e.matches ? THEMES.DARK : THEMES.LIGHT);
  }
}

/**
 * Get the current active theme
 * @returns {string} - Current theme name ('light' or 'dark')
 */
export function getCurrentTheme() {
  return currentTheme ? currentTheme.name : null;
}

/**
 * Check if dark mode is currently active
 * @returns {boolean} - True if dark mode is active
 */
export function isDarkMode() {
  return currentTheme === THEMES.DARK;
}

// Initialize immediately if in browser context
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', initThemeSwitcher);
}
