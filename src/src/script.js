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
  addDoc,
  deleteDoc,
  doc,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject
} from './firebase-config.js';
import { translate, setLanguage, currentLang } from './translations.js';
import { initTheme, toggleTheme } from './theme-switcher.js';
import { 
  showOfflineStatus,
  cachePDF,
  initOfflineHandler
} from './offline-handler.js';

// Main App Class
class PDFHubPro {
  constructor() {
    this.state = {
      pdfs: [],
      currentPDF: null,
      isAdmin: false,
      darkMode: localStorage.getItem('theme') === 'dark'
    };
    
    this.init();
  }

  async init() {
    this.cacheDOM();
    this.bindEvents();
    this.setupServiceWorker();
    
    initTheme();
    initOfflineHandler();
    await this.initAuth();
    
    await this.loadPDFs();
    
    if ('Notification' in window) {
      Notification.requestPermission();
    }
  }

  cacheDOM() {
    this.elements = {
      // Header
      header: document.querySelector('header'),
      themeToggle: document.getElementById('themeToggle'),
      adminToggle: document.getElementById('adminToggle'),
      langSelect: document.getElementById('languageSelect'),
      
      // Main Content
      pdfList: document.getElementById('pdfList'),
      searchInput: document.getElementById('search'),
      tabButtons: document.querySelectorAll('.tab'),
      
      // PDF Viewer
      previewContainer: document.getElementById('pdfPreview'),
      downloadBtn: document.getElementById('downloadBtn'),
      shareBtn: document.getElementById('shareBtn'),
      
      // Admin
      adminPanel: document.getElementById('adminPanel'),
      dropZone: document.getElementById('dropZone'),
      fileInput: document.getElementById('fileInput'),
      uploadProgress: document.getElementById('uploadProgress'),
      
      // Comments
      commentForm: document.getElementById('commentForm'),
      commentInput: document.getElementById('commentInput'),
      ratingStars: document.querySelectorAll('.star'),
      commentsList: document.getElementById('commentsList')
    };
  }

  bindEvents() {
    // Theme & Language
    this.elements.themeToggle.addEventListener('click', toggleTheme);
    this.elements.langSelect.addEventListener('change', (e) => {
      setLanguage(e.target.value);
      this.renderPDFList();
    });
    
    // PDF List Interactions
    this.elements.searchInput.addEventListener('input', (e) => {
      this.filterPDFs(e.target.value.toLowerCase());
    });
    
    this.elements.tabButtons.forEach(btn => {
      btn.addEventListener('click', () => this.filterByCategory(btn.dataset.category));
    });
    
    // PDF Actions
    this.elements.downloadBtn.addEventListener('click', () => this.downloadCurrentPDF());
    this.elements.shareBtn.addEventListener('click', () => this.shareCurrentPDF());
    
    // Admin Functions
    this.elements.adminToggle.addEventListener('click', () => this.toggleAdminPanel());
    this.elements.fileInput.addEventListener('change', (e) => this.handleFileUpload(e.target.files));
    
    // Drag & Drop for PDFs
    this.elements.dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.elements.dropZone.classList.add('dragover');
    });
    
    ['dragleave', 'dragend'].forEach(evt => {
      this.elements.dropZone.addEventListener(evt, () => {
        this.elements.dropZone.classList.remove('dragover');
      });
    });
    
    this.elements.dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      this.elements.dropZone.classList.remove('dragover');
      this.handleFileUpload(e.dataTransfer.files);
    });
    
    // Comments System
    this.elements.ratingStars.forEach(star => {
      star.addEventListener('click', (e) => {
        this.setRating(parseInt(e.target.dataset.rating));
      });
    });
    
    this.elements.commentForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.postComment();
    });
    
    // Online/Offline Events
    window.addEventListener('online', () => {
      this.showOnlineStatus();
      this.loadPDFs();
    });
    
    window.addEventListener('offline', () => {
      this.showOfflineStatus();
    });
  }

  // ==============
  // Core Functions
  // ==============
  
  async initAuth() {
    try {
      await signInAnonymousUser();
      onAuthStateChanged(auth, (user) => {
        if (user) {
          this.state.isAdmin = true; // For demo - in production use custom claims
          if (this.state.isAdmin) {
            this.elements.adminToggle.style.display = 'block';
          }
        }
      });
    } catch (error) {
      console.error("Auth error:", error);
    }
  }

  async loadPDFs() {
    try {
      const q = query(collection(db, "pdfs"));
      const snapshot = await getDocs(q);
      
      this.state.pdfs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      this.renderPDFList();
      this.cacheAllPDFs();
    } catch (error) {
      console.error("Error loading PDFs:", error);
    }
  }

  renderPDFList(pdfs = this.state.pdfs) {
    this.elements.pdfList.innerHTML = '';
    
    if (pdfs.length === 0) {
      this.elements.pdfList.innerHTML = `<div class="empty">${translate('noPDFs')}</div>`;
      return;
    }
    
    pdfs.forEach(pdf => {
      const item = document.createElement('div');
      item.className = 'pdf-item';
      item.dataset.id = pdf.id;
      
      item.innerHTML = `
        <div class="pdf-card" onclick="pdfHub.viewPDF('${pdf.id}')">
          <div class="pdf-thumbnail">
            <div class="pdf-icon">📄</div>
            ${pdf.pages ? `<span class="page-count">${pdf.pages} ${translate('pages')}</span>` : ''}
          </div>
          <h3>${pdf.name}</h3>
          <p class="meta">
            <span>${pdf.size || ''}</span>
            <span>${pdf.uploadedAt?.toDate?.().toLocaleDateString() || ''}</span>
          </p>
        </div>
        ${this.state.isAdmin ? `
          <button class="delete-btn" onclick="pdfHub.deletePDF('${pdf.id}')">
            🗑️ ${translate('delete')}
          </button>
        ` : ''}
      `;
      
      // Check if PDF is cached
      if (localStorage.getItem(`pdf_${pdf.id}`)) {
        item.classList.add('offline-available');
      }
      
      this.elements.pdfList.appendChild(item);
    });
  }

  // ===============
  // PDF Management
  // ===============
  
  async viewPDF(pdfId) {
    const pdf = this.state.pdfs.find(p => p.id === pdfId);
    if (!pdf) return;
    
    // Password protection check
    if (pdf.passwordProtected) {
      const password = prompt(translate('enterPassword'));
      if (password !== pdf.password) {
        alert(translate('wrongPassword'));
        return;
      }
    }
    
    this.state.currentPDF = pdf;
    
    // Display PDF preview
    this.elements.previewContainer.innerHTML = `
      <embed src="${pdf.url}#toolbar=0" type="application/pdf">
      <div class="pdf-info">
        <h2>${pdf.name}</h2>
        <p>${translate('uploadedOn')}: ${pdf.uploadedAt?.toDate?.().toLocaleDateString() || ''}</p>
      </div>
    `;
    
    // Load comments
    this.loadComments(pdf.id);
    
    // Cache for offline access
    cachePDF(pdf.id, pdf.url);
  }

  downloadCurrentPDF() {
    if (!this.state.currentPDF) return;
    
    const link = document.createElement('a');
    link.href = this.state.currentPDF.url;
    link.download = `${this.state.currentPDF.name}.pdf`;
    link.click();
  }

  async shareCurrentPDF() {
    if (!this.state.currentPDF) return;
    
    try {
      await navigator.share({
        title: this.state.currentPDF.name,
        text: `${translate('checkOutPDF')}: ${this.state.currentPDF.name}`,
        url: this.state.currentPDF.url
      });
    } catch (error) {
      // Fallback to copy URL
      await navigator.clipboard.writeText(this.state.currentPDF.url);
      alert(translate('linkCopied'));
    }
  }

  async deletePDF(pdfId) {
    if (!confirm(translate('confirmDelete'))) return;
    
    try {
      const pdf = this.state.pdfs.find(p => p.id === pdfId);
      
      // Delete from Firestore
      await deleteDoc(doc(db, "pdfs", pdfId));
      
      // Delete from Storage
      const fileRef = ref(storage, pdf.url);
      await deleteObject(fileRef);
      
      // Remove from cache
      localStorage.removeItem(`pdf_${pdfId}`);
      
      // Update UI
      this.state.pdfs = this.state.pdfs.filter(p => p.id !== pdfId);
      this.renderPDFList();
      
      alert(translate('deleteSuccess'));
    } catch (error) {
      console.error("Delete error:", error);
      alert(translate('deleteError'));
    }
  }

  // ==============
  // File Upload
  // ==============
  
  async handleFileUpload(files) {
    const pdfFiles = Array.from(files).filter(file => file.type === 'application/pdf');
    
    if (!pdfFiles.length) {
      alert(translate('onlyPDFs'));
      return;
    }
    
    for (const file of pdfFiles) {
      try {
        // Show progress
        this.elements.uploadProgress.style.width = '0%';
        this.elements.uploadProgress.style.display = 'block';
        
        // Upload file
        const storageRef = ref(storage, `pdfs/${Date.now()}_${file.name}`);
        const uploadTask = uploadBytesResumable(storageRef, file);
        
        await new Promise((resolve, reject) => {
          uploadTask.on('state_changed',
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              this.elements.uploadProgress.style.width = `${progress}%`;
            },
            reject,
            () => resolve()
          );
        });
        
        // Get download URL
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        
        // Add to Firestore
        await addDoc(collection(db, "pdfs"), {
          name: file.name.replace('.pdf', ''),
          url: downloadURL,
          uploadedAt: new Date(),
          size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
          category: 'general'
        });
        
        // Hide progress
        this.elements.uploadProgress.style.display = 'none';
        
        // Refresh list
        await this.loadPDFs();
        
        alert(translate('uploadSuccess'));
      } catch (error) {
        console.error("Upload error:", error);
        alert(translate('uploadError'));
      }
    }
  }

  // ===============
  // Comment System
  // ===============
  
  async loadComments(pdfId) {
    try {
      this.elements.commentsList.innerHTML = '<div class="loading">Loading comments...</div>';
      
      const q = query(collection(db, "comments"), where("pdfId", "==", pdfId));
      const snapshot = await getDocs(q);
      
      this.elements.commentsList.innerHTML = '';
      
      if (snapshot.empty) {
        this.elements.commentsList.innerHTML = `<div class="empty">${translate('noComments')}</div>`;
        return;
      }
      
      snapshot.forEach(doc => {
        const comment = doc.data();
        const commentEl = document.createElement('div');
        commentEl.className = 'comment';
        commentEl.innerHTML = `
          <div class="comment-header">
            <strong>${comment.userName || translate('anonymous')}</strong>
            <div class="rating">
              ${'★'.repeat(comment.rating)}${'☆'.repeat(5 - comment.rating)}
            </div>
          </div>
          <p>${comment.text}</p>
          <small>${comment.timestamp?.toDate?.().toLocaleString() || ''}</small>
        `;
        this.elements.commentsList.appendChild(commentEl);
      });
    } catch (error) {
      console.error("Comments error:", error);
      this.elements.commentsList.innerHTML = `<div class="error">${translate('loadError')}</div>`;
    }
  }

  setRating(rating) {
    document.querySelectorAll('.star').forEach((star, index) => {
      star.textContent = index < rating ? '★' : '☆';
    });
    this.state.currentRating = rating;
  }

  async postComment() {
    if (!this.state.currentPDF) {
      alert(translate('selectPDFFirst'));
      return;
    }
    
    const commentText = this.elements.commentInput.value.trim();
    if (!commentText || this.state.currentRating === 0) {
      alert(translate('provideRatingAndComment'));
      return;
    }
    
    try {
      await addDoc(collection(db, "comments"), {
        pdfId: this.state.currentPDF.id,
        text: commentText,
        rating: this.state.currentRating,
        userName: auth.currentUser?.displayName || translate('anonymous'),
        userId: auth.currentUser?.uid || 'anonymous',
        timestamp: new Date()
      });
      
      // Clear form
      this.elements.commentInput.value = '';
      this.state.currentRating = 0;
      this.setRating(0);
      
      // Refresh comments
      await this.loadComments(this.state.currentPDF.id);
      
      alert(translate('commentPosted'));
    } catch (error) {
      console.error("Comment error:", error);
      alert(translate('commentError'));
    }
  }

  // ==============
  // Helper Methods
  // ==============
  
  setupServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js')
        .then(reg => console.log('Service Worker registered'))
        .catch(err => console.log('Registration failed:', err));
    }
  }

  cacheAllPDFs() {
    this.state.pdfs.forEach(pdf => {
      cachePDF(pdf.id, pdf.url);
    });
  }

  filterPDFs(searchTerm) {
    const filtered = this.state.pdfs.filter(pdf => 
      pdf.name.toLowerCase().includes(searchTerm)
    );
    this.renderPDFList(filtered);
  }

  filterByCategory(category) {
    this.elements.tabButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.category === category);
    });
    
    if (category === 'all') {
      this.renderPDFList();
    } else {
      const filtered = this.state.pdfs.filter(pdf => pdf.category === category);
      this.renderPDFList(filtered);
    }
  }

  toggleAdminPanel() {
    this.state.isAdmin = !this.state.isAdmin;
    this.elements.adminPanel.style.display = this.state.isAdmin ? 'block' : 'none';
  }

  showOnlineStatus() {
    const banner = document.createElement('div');
    banner.className = 'online-banner';
    banner.textContent = translate('backOnline');
    document.body.prepend(banner);
    
    setTimeout(() => {
      banner.classList.add('fade-out');
      setTimeout(() => banner.remove(), 1000);
    }, 3000);
  }

  showOfflineStatus() {
    const banner = document.createElement('div');
    banner.className = 'offline-banner';
    banner.textContent = translate('offlineMode');
    document.body.prepend(banner);
  }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.pdfHub = new PDFHubPro();
});
