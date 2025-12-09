/**
 * Firebase initialization and configuration
 */

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getAuth, type Auth } from 'firebase/auth';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

// Firebase configuration
// These values should be set via environment variables or from Firebase Console
// Get runtime configuration from window.env (injected by entrypoint.sh) or build-time env
const runtimeEnv = (window as any).env || {};

const firebaseConfig = {
  apiKey: runtimeEnv.FIREBASE_API_KEY || import.meta.env['VITE_FIREBASE_API_KEY'] || '',
  authDomain: runtimeEnv.FIREBASE_AUTH_DOMAIN || import.meta.env['VITE_FIREBASE_AUTH_DOMAIN'] || '',
  projectId:
    runtimeEnv.FIREBASE_PROJECT_ID ||
    import.meta.env['VITE_FIREBASE_PROJECT_ID'] ||
    'sestra-dashboard',
  storageBucket:
    runtimeEnv.FIREBASE_STORAGE_BUCKET || import.meta.env['VITE_FIREBASE_STORAGE_BUCKET'] || '',
  messagingSenderId:
    runtimeEnv.FIREBASE_MESSAGING_SENDER_ID ||
    import.meta.env['VITE_FIREBASE_MESSAGING_SENDER_ID'] ||
    '',
  appId: runtimeEnv.FIREBASE_APP_ID || import.meta.env['VITE_FIREBASE_APP_ID'] || '',
};

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;
let storage: FirebaseStorage | null = null;

/**
 * Initialize Firebase (only once)
 */
export function initFirebase(): {
  app: FirebaseApp;
  db: Firestore;
  auth: Auth;
  storage: FirebaseStorage;
} | null {
  if (app && db && auth && storage) {
    return { app, db, auth, storage };
  }

  // Check if Firebase is already initialized
  const existingApps = getApps();
  if (existingApps.length > 0) {
    app = existingApps[0] ?? null;
  } else {
    // Validate config
    if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
      console.warn('⚠️ Firebase configuration incomplete. Falling back to localStorage.');
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

  // Ensure app is initialized before creating services
  if (!app) {
    return null;
  }

  try {
    db = getFirestore(app);
    auth = getAuth(app);
    storage = getStorage(app);
    return { app, db, auth, storage };
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

/**
 * Get Storage instance
 */
export function getStorageInstance(): FirebaseStorage {
  if (!storage) {
    initFirebase();
  }
  return storage!;
}
