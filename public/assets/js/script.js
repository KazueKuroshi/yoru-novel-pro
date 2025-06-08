import { 
  auth, 
  db, 
  storage,
  signInAnonymousUser,
  onAuthStateChanged,
  collection,
  query,
  where,
  getDocs,
  addPDFDocument,
  deletePDFDocument,
  uploadPDFFile,
  deletePDFFile,
  getDownloadURL,
  trackEvent,
  FIREBASE_ERRORS
} from './firebase-config.js';
import { 
  translations, 
  currentLang, 
  setLanguage, 
  translate 
} from './translations.js';

// DOM Elements Cache
const elements = {
  // Header
  header: document.querySelector('.app-header'),
  darkModeToggle: document.getElementById('darkModeToggle'),
  adminToggle: document.getElementById('adminToggle'),
  languageSelect: document.getElementById('languageSelect'),

  // Main Content
  pdfList: document.getElementById('pdf-list'),
  searchInput: document.getElementById('search'),
  tabs: document.querySelectorAll('.tab'),

  // PDF Preview
  pdfPreviewContainer: document.getElementById('pdf-preview-container'),
  pdfPreview: document.getElementById('pdf-preview'),
  downloadBtn: document.getElementById('downloadBtn'),
  shareBtn: document.getElementById('shareBtn'),

  // Admin Panel
  adminPanel: document.getElementById('adminPanel'),
  dropZone: document.getElementById('dropZone'),
  fileInput: document.getElementById('fileInput'),
  uploadProgress: document.getElementById('uploadProgress'),
  uploadPercentage: document.getElementById('uploadPercentage'),

  // Comments
  commentsSection: document.getElementById('commentsSection'),
  commentsList: document.getElementById('commentsList'),
  commentInput: document.getElementById('commentInput'),
  postCommentBtn: document.getElementById('postCommentBtn'),
  stars: document.querySelectorAll('.star')
};

// App State
const state = {
  currentPDF: null,
  currentRating: 0,
  pdfDocuments: [],
  isAdmin: false,
  isDarkMode: localStorage.getItem('theme') === 'dark'
};

// Initialize the application
async function initApp() {
  setupEventListeners();
  applyInitialTheme();
  await initAuth();
  loadPDFs();
  trackEvent('app_loaded');
}

// Authentication
async function initAuth() {
  try {
    await signInAnonymousUser();
    onAuthStateChanged(auth, (user) => {
      if (user) {
        state.isAdmin = user.isAnonymous === false; // Example admin check
        trackEvent('auth_state_changed', { isAdmin: state.isAdmin });
      }
    });
  } catch (error) {
    showNotification(translate('error'), 'error');
    console.error("Authentication error:", error);
  }
}

// PDF Management
async function loadPDFs() {
  try {
    elements.pdfList.innerHTML = `<li class="loading">${translate('loading')}</li>`;
    
    const q = query(collection(db, "pdfs"));
    const querySnapshot = await getDocs(q);
    
    state.pdfDocuments = [];
    querySnapshot.forEach((doc) => {
      state.pdfDocuments.push({ id: doc.id, ...doc.data() });
    });
    
    renderPDFList(state.pdfDocuments);
    trackEvent('pdfs_loaded', { count: state.pdfDocuments.length });
  } catch (error) {
    showNotification(translate('error'), 'error');
    console.error("Error loading PDFs:", error);
  }
}

function renderPDFList(pdfs) {
  elements.pdfList.innerHTML = '';
  
  if (pdfs.length === 0) {
    elements.pdfList.innerHTML = `<li class="no-results">${translate('noResults')}</li>`;
    return;
  }
  
  pdfs.forEach(pdf => {
    const listItem = document.createElement('li');
    listItem.className = 'pdf-item';
    listItem.dataset.id = pdf.id;
    listItem.dataset.category = pdf.category || 'all';
    
    listItem.innerHTML = `
      <a href="#" class="pdf-link">
        <span class="pdf-icon">📄</span>
        <span class="pdf-name">${pdf.name}</span>
        <span class="pdf-meta">
          <span>${pdf.pages || 'N/A'} ${translate('pages')}</span>
          <span>${pdf.size || 'N/A'}</span>
        </span>
      </a>
      ${state.isAdmin ? `
        <div class="pdf-actions">
          <button class="pdf-delete" data-id="${pdf.id}" aria-label="${translate('delete')}">
            🗑️
          </button>
        </div>
      ` : ''}
    `;
    
    elements.pdfList.appendChild(listItem);
  });

  // Add event listeners to PDF items
  document.querySelectorAll('.pdf-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const pdfId = e.target.closest('.pdf-item').dataset.id;
      const pdf = state.pdfDocuments.find(p => p.id === pdfId);
      if (pdf) handlePDFClick(pdf);
    });
  });

  // Add event listeners to delete buttons
  document.querySelectorAll('.pdf-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const pdfId = e.target.dataset.id;
      await handleDeletePDF(pdfId);
    });
  });
}

function handlePDFClick(pdf) {
  if (pdf.password) {
    const password = prompt(translate('passwordPrompt'));
    if (password !== pdf.password) {
      alert(translate('incorrectPassword'));
      return;
    }
  }
  
  state.currentPDF = pdf;
  showPDFPreview(pdf);
  trackEvent('pdf_preview', { pdf_id: pdf.id });
}

function showPDFPreview(pdf) {
  elements.pdfPreview.innerHTML = `
    <div class="pdf-viewer-container">
      <embed src="${pdf.url}#toolbar=0" type="application/pdf" width="100%" height="100%">
      <div class="pdf-meta-info">
        <p><strong>${translate('pages')}:</strong> ${pdf.pages || 'N/A'}</p>
        <p><strong>${translate('size')}:</strong> ${pdf.size || 'N/A'}</p>
        <p><strong>${translate('uploaded')}:</strong> ${
          pdf.uploadedAt?.toDate ? 
          pdf.uploadedAt.toDate().toLocaleDateString() : 
          'N/A'
        }</p>
      </div>
    </div>
  `;
  
  loadComments(pdf.id);
}

// File Uploads
function setupFileUpload() {
  // Drag and drop events
  elements.dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    elements.dropZone.classList.add('highlight');
  });

  elements.dropZone.addEventListener('dragleave', () => {
    elements.dropZone.classList.remove('highlight');
  });

  elements.dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    elements.dropZone.classList.remove('highlight');
    handleFiles(e.dataTransfer.files);
  });

  elements.fileInput.addEventListener('change', () => {
    if (elements.fileInput.files.length > 0) {
      handleFiles(elements.fileInput.files);
    }
  });
}

async function handleFiles(files) {
  for (const file of files) {
    if (file.type !== 'application/pdf') continue;
    
    try {
      // Show upload progress
      elements.uploadProgress.style.display = 'block';
      elements.uploadPercentage.style.display = 'block';
      
      // Upload file to storage
      const downloadURL = await uploadPDFFile(file, (progress) => {
        elements.uploadProgress.value = progress;
        elements.uploadPercentage.textContent = `${Math.round(progress)}%`;
      });
      
      // Add document to Firestore
      await addPDFDocument({
        name: file.name.replace('.pdf', ''),
        url: downloadURL,
        category: 'tutorial',
        size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
        uploadedAt: new Date(),
        pages: 0
      });
      
      // Reset upload UI
      elements.uploadProgress.style.display = 'none';
      elements.uploadPercentage.style.display = 'none';
      elements.uploadProgress.value = 0;
      
      showNotification(translate('uploadSuccess'), 'success');
      loadPDFs(); // Refresh the list
      trackEvent('pdf_uploaded', { size: file.size });
    } catch (error) {
      console.error('Error uploading file:', error);
      showNotification(translate('uploadError'), 'error');
      trackEvent('upload_failed', { error: error.message });
    }
  }
}

async function handleDeletePDF(pdfId) {
  if (!confirm(translate('deleteConfirm'))) return;
  
  try {
    const pdf = state.pdfDocuments.find(p => p.id === pdfId);
    if (pdf) {
      await deletePDFDocument(pdfId);
      await deletePDFFile(pdf.url);
      showNotification(translate('deleteSuccess'), 'success');
      loadPDFs(); // Refresh the list
      trackEvent('pdf_deleted', { pdf_id: pdfId });
    }
  } catch (error) {
    console.error('Error deleting PDF:', error);
    showNotification(translate('deleteError'), 'error');
  }
}

// Comments System
async function loadComments(pdfId) {
  elements.commentsList.innerHTML = `<div class="loading">${translate('loading')}</div>`;
  
  try {
    const q = query(collection(db, "comments"), where("pdfId", "==", pdfId));
    const querySnapshot = await getDocs(q);
    
    elements.commentsList.innerHTML = '';
    
    if (querySnapshot.empty) {
      elements.commentsList.innerHTML = `<div class="no-comments">${translate('noComments')}</div>`;
      return;
    }
    
    querySnapshot.forEach((doc) => {
      const comment = doc.data();
      const commentEl = document.createElement('div');
      commentEl.className = 'comment';
      commentEl.innerHTML = `
        <div class="comment-header">
          <strong>${comment.userName || translate('anonymous')}</strong>
          <div class="comment-rating">${'★'.repeat(comment.rating)}${'☆'.repeat(5 - comment.rating)}</div>
        </div>
        <p class="comment-text">${comment.text}</p>
        <small class="comment-date">${
          comment.timestamp?.toDate ? 
          comment.timestamp.toDate().toLocaleString() : 
          new Date().toLocaleString()
        }</small>
      `;
      elements.commentsList.appendChild(commentEl);
    });
  } catch (error) {
    console.error("Error loading comments:", error);
    elements.commentsList.innerHTML = `<div class="error">${translate('error')}</div>`;
  }
}

async function postComment() {
  if (!state.currentPDF) return;
  
  const commentText = elements.commentInput.value.trim();
  if (!commentText || state.currentRating === 0) {
    showNotification(translate('warning'), 'warning');
    return;
  }
  
  try {
    await addDoc(collection(db, "comments"), {
      pdfId: state.currentPDF.id,
      text: commentText,
      rating: state.currentRating,
      userName: auth.currentUser?.displayName || translate('anonymous'),
      userId: auth.currentUser?.uid || 'anonymous',
      timestamp: new Date()
    });
    
    // Clear form
    elements.commentInput.value = '';
    state.currentRating = 0;
    updateStarRating();
    
    // Refresh comments
    loadComments(state.currentPDF.id);
    showNotification(translate('success'), 'success');
    trackEvent('comment_posted', { pdf_id: state.currentPDF.id });
  } catch (error) {
    console.error('Error posting comment:', error);
    showNotification(translate('error'), 'error');
  }
}

function updateStarRating() {
  elements.stars.forEach((star, index) => {
    star.textContent = index < state.currentRating ? '★' : '☆';
    star.style.color = index < state.currentRating ? '#ffc107' : '#ccc';
  });
}

// UI Helpers
function applyInitialTheme() {
  document.documentElement.setAttribute('data-theme', state.isDarkMode ? 'dark' : 'light');
}

function toggleDarkMode() {
  state.isDarkMode = !state.isDarkMode;
  document.documentElement.setAttribute('data-theme', state.isDarkMode ? 'dark' : 'light');
  localStorage.setItem('theme', state.isDarkMode ? 'dark' : 'light');
  trackEvent('theme_changed', { theme: state.isDarkMode ? 'dark' : 'light' });
}

function toggleAdminPanel() {
  state.isAdmin = !state.isAdmin;
  elements.adminPanel.style.display = state.isAdmin ? 'block' : 'none';
  trackEvent('admin_toggled', { state: state.isAdmin });
}

function showNotification(message, type) {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.classList.add('fade-out');
    setTimeout(() => notification.remove(), 500);
  }, 3000);
}

// Event Listeners
function setupEventListeners() {
  // Theme Toggle
  elements.darkModeToggle.addEventListener('click', toggleDarkMode);
  
  // Admin Toggle
  elements.adminToggle.addEventListener('click', toggleAdminPanel);
  
  // Language Selector
  elements.languageSelect.addEventListener('change', (e) => {
    setLanguage(e.target.value);
    trackEvent('language_changed', { language: e.target.value });
  });
  
  // Search Functionality
  elements.searchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const filtered = state.pdfDocuments.filter(pdf => 
      pdf.name.toLowerCase().includes(searchTerm)
    );
    renderPDFList(filtered);
  });
  
  // Tabs
  elements.tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      elements.tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      const category = tab.dataset.category;
      const filtered = category === 'all' 
        ? state.pdfDocuments 
        : state.pdfDocuments.filter(pdf => pdf.category === category);
      
      renderPDFList(filtered);
      trackEvent('category_filter', { category });
    });
  });
  
  // PDF Actions
  elements.downloadBtn.addEventListener('click', () => {
    if (!state.currentPDF) return;
    const link = document.createElement('a');
    link.href = state.currentPDF.url;
    link.download = `${state.currentPDF.name}.pdf`;
    link.click();
    trackEvent('pdf_downloaded', { pdf_id: state.currentPDF.id });
  });
  
  elements.shareBtn.addEventListener('click', async () => {
    if (!state.currentPDF) return;
    
    try {
      if (navigator.share) {
        await navigator.share({
          title: state.currentPDF.name,
          text: `Check out this PDF: ${state.currentPDF.name}`,
          url: state.currentPDF.url
        });
        trackEvent('pdf_shared', { method: 'native' });
      } else {
        await navigator.clipboard.writeText(state.currentPDF.url);
        showNotification(translate('success'), 'success');
        trackEvent('pdf_shared', { method: 'clipboard' });
      }
    } catch (error) {
      console.error('Sharing failed:', error);
    }
  });
  
  // File Upload
  setupFileUpload();
  
  // Comments
  elements.stars.forEach(star => {
    star.addEventListener('click', (e) => {
      state.currentRating = parseInt(e.target.dataset.rating);
      updateStarRating();
    });
  });
  
  elements.postCommentBtn.addEventListener('click', postComment);
  elements.commentInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      postComment();
    }
  });
}

// Initialize the app
document.addEventListener('DOMContentLoaded', initApp);
