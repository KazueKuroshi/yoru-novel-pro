// Translation data for all supported languages
const translations = {
  en: {
    title: "PDF Hub Pro",
    searchPlaceholder: "🔍 Search PDFs...",
    darkMode: "🌓 Dark Mode",
    adminMode: "🔒 Admin Mode",
    uploadText: "Drop PDFs here or click to upload",
    all: "All",
    tutorials: "Tutorials",
    cheatsheets: "Cheatsheets",
    preview: "🖥 Preview",
    download: "⬇️ Download",
    share: "🔗 Share",
    passwordPrompt: "This PDF is password protected. Enter password:",
    incorrectPassword: "Incorrect password!",
    comments: "💬 Comments",
    postComment: "Post Comment",
    pages: "Pages",
    size: "Size",
    uploaded: "Uploaded",
    uploadSuccess: "File uploaded successfully!",
    uploadError: "Error uploading file!",
    deleteConfirm: "Are you sure you want to delete this PDF?",
    deleteSuccess: "PDF deleted successfully!",
    deleteError: "Error deleting PDF!",
    noResults: "No PDFs found",
    loading: "Loading...",
    noComments: "No comments yet",
    addComment: "Add your comment...",
    rating: "Rating:",
    anonymous: "Anonymous",
    offline: "Offline",
    connectionRestored: "Connection restored!",
    retry: "Retry",
    cancel: "Cancel",
    confirm: "Confirm",
    error: "Error",
    success: "Success",
    warning: "Warning",
    info: "Info"
  },
  id: {
    title: "PDF Hub Pro",
    searchPlaceholder: "🔍 Cari PDF...",
    darkMode: "🌓 Mode Gelap",
    adminMode: "🔒 Mode Admin",
    uploadText: "Letakkan PDF di sini atau klik untuk mengunggah",
    all: "Semua",
    tutorials: "Tutorial",
    cheatsheets: "Cheatsheet",
    preview: "🖥 Pratinjau",
    download: "⬇️ Unduh",
    share: "🔗 Bagikan",
    passwordPrompt: "PDF ini dilindungi kata sandi. Masukkan kata sandi:",
    incorrectPassword: "Kata sandi salah!",
    comments: "💬 Komentar",
    postComment: "Kirim Komentar",
    pages: "Halaman",
    size: "Ukuran",
    uploaded: "Diunggah",
    uploadSuccess: "File berhasil diunggah!",
    uploadError: "Gagal mengunggah file!",
    deleteConfirm: "Apakah Anda yakin ingin menghapus PDF ini?",
    deleteSuccess: "PDF berhasil dihapus!",
    deleteError: "Gagal menghapus PDF!",
    noResults: "Tidak ada PDF yang ditemukan",
    loading: "Memuat...",
    noComments: "Belum ada komentar",
    addComment: "Tambahkan komentar Anda...",
    rating: "Rating:",
    anonymous: "Anonim",
    offline: "Offline",
    connectionRestored: "Koneksi dipulihkan!",
    retry: "Coba Lagi",
    cancel: "Batal",
    confirm: "Konfirmasi",
    error: "Error",
    success: "Berhasil",
    warning: "Peringatan",
    info: "Info"
  }
};

// Current language (default to English)
let currentLang = localStorage.getItem('language') || 'en';

// Function to set the current language
function setLanguage(lang) {
  if (!translations[lang]) {
    console.warn(`Language '${lang}' is not supported. Defaulting to 'en'.`);
    lang = 'en';
  }
  
  currentLang = lang;
  localStorage.setItem('language', lang);
  applyTranslations();
}

// Function to apply translations to the UI
function applyTranslations() {
  // Translate elements with data-i18n attribute
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (translations[currentLang][key]) {
      el.textContent = translations[currentLang][key];
    }
  });

  // Translate elements with data-i18n-placeholder attribute
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (translations[currentLang][key]) {
      el.placeholder = translations[currentLang][key];
    }
  });

  // Translate elements with data-i18n-title attribute
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    if (translations[currentLang][key]) {
      el.title = translations[currentLang][key];
    }
  });

  // Translate elements with data-i18n-aria-label attribute
  document.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
    const key = el.getAttribute('data-i18n-aria-label');
    if (translations[currentLang][key]) {
      el.setAttribute('aria-label', translations[currentLang][key]);
    }
  });
}

// Function to get a translated string
function translate(key, fallback = '') {
  return translations[currentLang][key] || fallback || key;
}

// Initialize translations on page load
document.addEventListener('DOMContentLoaded', () => {
  applyTranslations();
});

// Export the translation system
export {
  translations,
  currentLang,
  setLanguage,
  applyTranslations,
  translate
};
