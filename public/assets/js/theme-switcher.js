// Function to initialize theme based on user preference
function initTheme() {
  // Get the saved theme from localStorage or default to 'light'
  const savedTheme = localStorage.getItem('theme') || 'light';

  // Apply the saved theme to the document
  document.documentElement.setAttribute('data-theme', savedTheme);

  // Update the theme toggle button state
  updateThemeToggleButton(savedTheme);

  // Log the initial theme for analytics
  logThemeEvent(savedTheme);
}

// Function to toggle between dark and light themes
function toggleTheme() {
  // Get the current theme from the document
  const currentTheme = document.documentElement.getAttribute('data-theme');

  // Determine the new theme
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

  // Apply the new theme to the document
  document.documentElement.setAttribute('data-theme', newTheme);

  // Save the new theme to localStorage
  localStorage.setItem('theme', newTheme);

  // Update the theme toggle button state
  updateThemeToggleButton(newTheme);

  // Log the theme change for analytics
  logThemeEvent(newTheme);
}

// Function to update the theme toggle button
function updateThemeToggleButton(theme) {
  const themeToggleButton = document.getElementById('darkModeToggle');
  if (themeToggleButton) {
    themeToggleButton.textContent = theme === 'dark' ? '🌞 Light Mode' : '🌓 Dark Mode';
    themeToggleButton.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
  }
}

// Function to log theme changes for analytics
function logThemeEvent(theme) {
  if (typeof gtag === 'function') {
    gtag('event', 'theme_change', {
      theme: theme
    });
  }
  console.log(`Theme changed to: ${theme}`);
}

// Add event listener to the theme toggle button
function setupThemeToggle() {
  const themeToggleButton = document.getElementById('darkModeToggle');
  if (themeToggleButton) {
    themeToggleButton.addEventListener('click', toggleTheme);
  }
}

// Initialize the theme when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  setupThemeToggle();
});

// Export the theme functions
export {
  initTheme,
  toggleTheme,
  setupThemeToggle
};
