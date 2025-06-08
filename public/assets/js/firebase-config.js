// Import the functions you need from the Firebase SDKs
import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  connectAuthEmulator
} from "firebase/auth";
import { 
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
  connectFirestoreEmulator
} from "firebase/firestore";
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  connectStorageEmulator
} from "firebase/storage";
import { getPerformance } from "firebase/performance";
import { getAnalytics, logEvent } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyYourAPIKeyHere",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:your-app-id",
  measurementId: "G-YourAnalyticsID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
let analytics;
let performance;

// Configure emulators during development
if (process.env.NODE_ENV === 'development') {
  try {
    connectAuthEmulator(auth, "http://localhost:9099");
    connectFirestoreEmulator(db, 'localhost', 8080);
    connectStorageEmulator(storage, 'localhost', 9199);
    console.log("Connected to Firebase Emulators");
  } catch (error) {
    console.warn("Failed to connect to emulators:", error);
  }
} else {
  // Initialize analytics and performance only in production
  try {
    analytics = getAnalytics(app);
    performance = getPerformance(app);
  } catch (error) {
    console.error("Firebase analytics/performance initialization failed:", error);
  }
}

// Authentication functions
const signInAnonymousUser = async () => {
  try {
    const userCredential = await signInAnonymously(auth);
    return userCredential.user;
  } catch (error) {
    console.error("Anonymous sign-in failed:", error);
    throw new Error("Could not authenticate user");
  }
};

// Firestore functions
const addPDFDocument = async (pdfData) => {
  try {
    const docRef = await addDoc(collection(db, "pdfs"), pdfData);
    return docRef.id;
  } catch (error) {
    console.error("Error adding PDF document:", error);
    throw error;
  }
};

const deletePDFDocument = async (pdfId) => {
  try {
    await deleteDoc(doc(db, "pdfs", pdfId));
  } catch (error) {
    console.error("Error deleting PDF document:", error);
    throw error;
  }
};

// Storage functions
const uploadPDFFile = async (file, onProgress) => {
  try {
    const storageRef = ref(storage, `pdfs/${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    return new Promise((resolve, reject) => {
      uploadTask.on('state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          if (typeof onProgress === 'function') {
            onProgress(progress);
          }
        },
        (error) => {
          console.error("Upload failed:", error);
          reject(error);
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(downloadURL);
          } catch (error) {
            reject(error);
          }
        }
      );
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    throw error;
  }
};

const deletePDFFile = async (fileUrl) => {
  try {
    const fileRef = ref(storage, fileUrl);
    await deleteObject(fileRef);
  } catch (error) {
    console.error("Error deleting file:", error);
    throw error;
  }
};

// Analytics functions
const trackEvent = (eventName, eventParams = {}) => {
  if (analytics) {
    try {
      logEvent(analytics, eventName, eventParams);
    } catch (error) {
      console.error("Analytics event failed:", error);
    }
  }
};

// Export all Firebase services and functions
export {
  auth,
  db,
  storage,
  analytics,
  performance,
  
  // Authentication
  signInAnonymousUser,
  onAuthStateChanged,
  
  // Firestore
  collection,
  query,
  where,
  getDocs,
  addPDFDocument,
  deletePDFDocument,
  
  // Storage
  ref,
  uploadPDFFile,
  deletePDFFile,
  getDownloadURL,
  
  // Analytics
  trackEvent,
  
  // Error codes for handling
  FIREBASE_ERRORS: {
    PERMISSION_DENIED: 'permission-denied',
    UNAUTHENTICATED: 'unauthenticated',
    NOT_FOUND: 'not-found'
  }
};
