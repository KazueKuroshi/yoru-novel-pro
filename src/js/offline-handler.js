/**
 * Offline Handler Module
 * Manages offline functionality including:
 * - Connection state detection
 * - Caching strategies
 * - Offline UI indicators
 * - Queue for deferred actions
 */

import { showNotification } from './notifications.js';
import { translate } from './translations.js';
import { trackEvent } from './analytics.js';

// Service Worker Configuration
const SW_CONFIG = {
  cacheName: 'pdfhub-v1',
  offlinePage: '/offline.html',
  assets: [
    '/',
    '/index.html',
    '/assets/css/main.css',
    '/assets/js/app.js',
    '/assets/images/logo.png'
  ]
};

// Action queue for deferred operations when offline
const actionQueue = [];

// DOM Elements
let offlineBanner;
let retryButtons;

/**
 * Initialize offline handler
 */
export function initOfflineHandler() {
  // Create offline banner
  createOfflineBanner();
  
  // Set up service worker
  registerServiceWorker();
  
  // Set up event listeners
  setupEventListeners();
  
  // Check initial connection state
  checkConnectionState();
}

/**
 * Register service worker
 */
async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('ServiceWorker registration successful:', registration);
      
      // Periodically check for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            showNotification(translate('updateAvailable'), 'info');
          }
        });
      });
    } catch (error) {
      console.error('ServiceWorker registration failed:', error);
    }
  }
}

/**
 * Set up connection event listeners
 */
function setupEventListeners() {
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  // Custom event for retrying failed actions
  document.addEventListener('retryFailedActions', retryFailedActions);
}

/**
 * Create and manage offline banner
 */
function createOfflineBanner() {
  offlineBanner = document.createElement('div');
  offlineBanner.className = 'offline-banner hidden';
  offlineBanner.innerHTML = `
    <div class="offline-content">
      <span class="offline-icon">⚠️</span>
      <span class="offline-message">${translate('offlineMessage')}</span>
      <button class="retry-btn">${translate('retry')}</button>
    </div>
  `;
  document.body.prepend(offlineBanner);
  
  // Set up retry button
  const retryBtn = offlineBanner.querySelector('.retry-btn');
  retryBtn.addEventListener('click', () => {
    window.location.reload();
    trackEvent('offline_retry_click');
  });
}

/**
 * Check and display current connection state
 */
function checkConnectionState() {
  if (!navigator.onLine) {
    handleOffline();
  }
}

/**
 * Handle offline state
 */
function handleOffline() {
  // Show offline banner
  offlineBanner.classList.remove('hidden');
  
  // Update app state
  document.documentElement.setAttribute('data-offline', 'true');
  
  // Track event
  trackEvent('offline_mode');
  
  // Show notification
  showNotification(translate('offlineWarning'), 'warning');
}

/**
 * Handle online state
 */
function handleOnline() {
  // Hide offline banner
  offlineBanner.classList.add('hidden');
  
  // Update app state
  document.documentElement.removeAttribute('data-offline');
  
  // Process queued actions
  processActionQueue();
  
  // Show notification
  showNotification(translate('backOnline'), 'success');
  
  // Track event
  trackEvent('online_mode');
}

/**
 * Cache PDF for offline access
 * @param {string} pdfId - Unique PDF identifier
 * @param {string} pdfUrl - PDF file URL
 */
export async function cachePDF(pdfId, pdfUrl) {
  try {
    const cache = await caches.open(SW_CONFIG.cacheName);
    const response = await fetch(pdfUrl);
    
    if (response.ok) {
      await cache.put(pdfUrl, response.clone());
      localStorage.setItem(`cached_${pdfId}`, 'true');
      markAsOfflineAvailable(pdfId);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to cache PDF:', error);
    return false;
  }
}

/**
 * Mark PDF as available offline in UI
 * @param {string} pdfId - Unique PDF identifier
 */
function markAsOfflineAvailable(pdfId) {
  const pdfElement = document.querySelector(`[data-pdf-id="${pdfId}"]`);
  if (pdfElement) {
    pdfElement.classList.add('offline-available');
    pdfElement.setAttribute('title', translate('availableOffline'));
  }
}

/**
 * Queue action for when connection is restored
 * @param {Object} action - Action to queue
 */
export function queueAction(action) {
  actionQueue.push(action);
  localStorage.setItem('actionQueue', JSON.stringify(actionQueue));
  showNotification(translate('actionQueued'), 'info');
}

/**
 * Process all queued actions
 */
async function processActionQueue() {
  if (actionQueue.length === 0) return;
  
  showNotification(translate('processingQueue'), 'info');
  
  const successes = [];
  const failures = [];
  
  for (const action of actionQueue) {
    try {
      // Execute the action (this would be your actual implementation)
      const result = await executeAction(action);
      if (result) {
        successes.push(action);
      } else {
        failures.push(action);
      }
    } catch (error) {
      failures.push(action);
      console.error('Failed to process action:', action, error);
    }
  }
  
  // Update queue
  actionQueue.length = 0; // Clear array
  localStorage.setItem('actionQueue', JSON.stringify(actionQueue));
  
  // Show results
  if (successes.length > 0) {
    showNotification(translate('queueProcessed', { count: successes.length }), 'success');
  }
  if (failures.length > 0) {
    showNotification(translate('queueFailed', { count: failures.length }), 'error');
  }
  
  trackEvent('queue_processed', {
    successes: successes.length,
    failures: failures.length
  });
}

/**
 * Retry failed actions
 */
export function retryFailedActions() {
  const storedQueue = localStorage.getItem('actionQueue');
  if (storedQueue) {
    actionQueue.push(...JSON.parse(storedQueue));
    processActionQueue();
  }
}

/**
 * Check if a PDF is available offline
 * @param {string} pdfId - Unique PDF identifier
 * @returns {boolean} - True if available offline
 */
export function isAvailableOffline(pdfId) {
  return localStorage.getItem(`cached_${pdfId}`) === 'true';
}

/**
 * Get cached PDF
 * @param {string} pdfUrl - PDF file URL
 * @returns {Promise<Response|null>} - Cached response or null
 */
export async function getCachedPDF(pdfUrl) {
  try {
    const cache = await caches.open(SW_CONFIG.cacheName);
    return await cache.match(pdfUrl);
  } catch (error) {
    console.error('Error accessing cache:', error);
    return null;
  }
}

// Initialize immediately if in browser context
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    // Load any queued actions from storage
    const storedQueue = localStorage.getItem('actionQueue');
    if (storedQueue) {
      actionQueue.push(...JSON.parse(storedQueue));
    }
    
    initOfflineHandler();
  });
}
