/**
 * Firebase initialization and configuration
 */

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getAuth, type Auth } from 'firebase/auth';

// Firebase configuration
// These values should be set via environment variables or from Firebase Console
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'sestra-dashboard',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

/**
 * Initialize Firebase (only once)
 */
export function initFirebase(): { app: FirebaseApp; db: Firestore; auth: Auth } | null {
  if (app && db && auth) {
    return { app, db, auth };
  }

  // Check if Firebase is already initialized
  const existingApps = getApps();
  if (existingApps.length > 0) {
    app = existingApps[0];
  } else {
    // Validate config
    if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
      console.warn(
        '⚠️ Firebase configuration incomplete. Falling back to localStorage.'
      );
      console.warn('   Please create a .env file with VITE_FIREBASE_* variables (see env.example)');
      console.warn('   Current config:', {
        hasApiKey: !!firebaseConfig.apiKey,
        projectId: firebaseConfig.projectId,
        hasAuthDomain: !!firebaseConfig.authDomain,
      });
      return null;
    }

    try {
      app = initializeApp(firebaseConfig);
    } catch (error) {
      console.warn('⚠️ Failed to initialize Firebase. Falling back to localStorage:', error);
      return null;
    }
  }

  try {
    db = getFirestore(app);
    auth = getAuth(app);
    return { app, db, auth };
  } catch (error) {
    console.warn('⚠️ Failed to initialize Firestore. Falling back to localStorage:', error);
    return null;
  }
}

/**
 * Get Firestore instance
 */
export function getFirestoreInstance(): Firestore {
  if (!db) {
    initFirebase();
  }
  return db!;
}

/**
 * Get Auth instance
 */
export function getAuthInstance(): Auth {
  if (!auth) {
    initFirebase();
  }
  return auth!;
}

