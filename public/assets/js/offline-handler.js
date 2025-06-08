// Function to show offline status banner
function showOfflineStatus() {
  // Check if the banner already exists
  if (document.querySelector('.offline-banner')) return;

  // Create the offline banner
  const offlineBanner = document.createElement('div');
  offlineBanner.className = 'offline-banner';
  offlineBanner.textContent = translate('offline');
  document.body.prepend(offlineBanner);

  // Add animation for smooth appearance
  setTimeout(() => {
    offlineBanner.style.opacity = '1';
    offlineBanner.style.transform = 'translateY(0)';
  }, 10);

  // Listen for online event
  window.addEventListener('online', () => {
    // Update banner text
    offlineBanner.textContent = translate('connectionRestored');
    offlineBanner.style.backgroundColor = '#2ecc71'; // Green for success

    // Remove banner after 3 seconds
    setTimeout(() => {
      offlineBanner.style.opacity = '0';
      offlineBanner.style.transform = 'translateY(-100%)';
      setTimeout(() => offlineBanner.remove(), 500);
    }, 3000);
  });
}

// Function to check initial connection status
function checkInitialConnection() {
  if (!navigator.onLine) {
    showOfflineStatus();
  }
}

// Function to handle offline PDFs
function markOfflinePDFs() {
  const pdfItems = document.querySelectorAll('.pdf-item');
  pdfItems.forEach(item => {
    const pdfId = item.dataset.id;
    const isOffline = localStorage.getItem(`pdf_${pdfId}`) === 'true';

    if (isOffline) {
      item.classList.add('offline');
      const offlineLabel = document.createElement('span');
      offlineLabel.className = 'offline-label';
      offlineLabel.textContent = translate('offline');
      item.appendChild(offlineLabel);
    }
  });
}

// Function to cache PDF for offline access
function cachePDF(pdfId, pdfUrl) {
  caches.open('pdf-cache').then(cache => {
    fetch(pdfUrl).then(response => {
      if (response.ok) {
        cache.put(pdfUrl, response);
        localStorage.setItem(`pdf_${pdfId}`, 'true');
        markOfflinePDFs();
      }
    });
  });
}

// Function to handle offline retries
function setupOfflineRetry() {
  document.querySelectorAll('.offline-retry').forEach(button => {
    button.addEventListener('click', async () => {
      const pdfId = button.dataset.pdfId;
      const pdfUrl = button.dataset.pdfUrl;

      if (navigator.onLine) {
        try {
          const response = await fetch(pdfUrl);
          if (response.ok) {
            cachePDF(pdfId, pdfUrl);
            button.textContent = translate('success');
            setTimeout(() => button.remove(), 2000);
          }
        } catch (error) {
          console.error('Retry failed:', error);
          button.textContent = translate('error');
        }
      } else {
        button.textContent = translate('offline');
      }
    });
  });
}

// Initialize offline handler
function initOfflineHandler() {
  // Check initial connection
  checkInitialConnection();

  // Listen for offline/online events
  window.addEventListener('offline', showOfflineStatus);
  window.addEventListener('online', () => {
    markOfflinePDFs();
    setupOfflineRetry();
  });

  // Mark offline PDFs on page load
  markOfflinePDFs();

  // Setup retry buttons
  setupOfflineRetry();
}

// Export functions
export {
  showOfflineStatus,
  checkInitialConnection,
  markOfflinePDFs,
  cachePDF,
  setupOfflineRetry,
  initOfflineHandler
};

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', initOfflineHandler);
