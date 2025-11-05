/**
 * Firestore store for dashboard data
 */

import { defineStore } from 'pinia';
import { ref, type Ref } from 'vue';
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';
import { initFirebase } from '../utils/firebase';
import { signInAnonymously, type User } from 'firebase/auth';

export interface DashboardData {
  entities: string[];
  positions: Record<string, string>;
  sizes: Record<string, string>;
  icons: Record<string, string>;
  actions: Record<string, { tapAction?: any; holdAction?: any }>;
  labelOverrides: Record<string, string>;
  haActions: Record<string, { service: string; serviceData?: Record<string, any> }>;
  scale: number;
  panX: number;
  panY: number;
}

const COLLECTION_NAME = 'dashboards';
const DOCUMENT_ID = 'default'; // For now, using a single shared dashboard

export const useFirestoreStore = defineStore('firestore', () => {
  const isInitialized: Ref<boolean> = ref(false);
  const isAuthenticated: Ref<boolean> = ref(false);
  const user: Ref<User | null> = ref(null);
  const dashboardData: Ref<DashboardData | null> = ref(null);
  const isLoading: Ref<boolean> = ref(false);
  const error: Ref<string | null> = ref(null);
  const useFirestore: Ref<boolean> = ref(false); // Whether to use Firestore or localStorage
  let unsubscribe: Unsubscribe | null = null;
  let db: Firestore | null = null;
  let auth: Auth | null = null;

  /**
   * Initialize Firebase and authenticate
   */
  async function initialize(): Promise<boolean> {
    try {
      isLoading.value = true;
      error.value = null;

      // Try to initialize Firebase
      const firebaseInit = initFirebase();
      if (!firebaseInit) {
        console.warn('⚠️ Firebase not available, using localStorage fallback');
        useFirestore.value = false;
        // Load from localStorage instead
        loadFromLocalStorage();
        isInitialized.value = true;
        return false;
      }

      db = firebaseInit.db;
      auth = firebaseInit.auth;
      useFirestore.value = true;

      // Sign in anonymously (or use existing auth)
      if (!auth.currentUser) {
        try {
          await signInAnonymously(auth);
          user.value = auth.currentUser;
          isAuthenticated.value = true;
        } catch (authError: any) {
          console.error('❌ Failed to sign in anonymously:', authError);
          if (authError.code === 'auth/operation-not-allowed') {
            console.error('   Anonymous authentication is not enabled in Firebase Console.');
            console.error('   Please enable it: Firebase Console → Authentication → Sign-in method → Anonymous');
            throw new Error('Anonymous authentication not enabled');
          } else if (authError.code === 'auth/api-key-not-valid' || authError.message?.includes('400')) {
            console.error('   Firebase API key or configuration may be invalid.');
            throw authError;
          } else {
            throw authError;
          }
        }
      } else {
        user.value = auth.currentUser;
        isAuthenticated.value = true;
      }

      // Load dashboard data
      await loadDashboardData();

      // Set up real-time listener
      setupRealtimeListener();

      isInitialized.value = true;
      console.log('✅ Firestore initialized and connected');
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      error.value = errorMessage;
      console.warn('⚠️ Failed to initialize Firestore, using localStorage fallback:', err);
      useFirestore.value = false;
      loadFromLocalStorage();
      isInitialized.value = true;
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Load dashboard data from localStorage (fallback)
   */
  function loadFromLocalStorage(): void {
    dashboardData.value = {
      entities: JSON.parse(localStorage.getItem('ha_dashboard_entities') ?? '[]'),
      positions: JSON.parse(localStorage.getItem('ha_dashboard_positions') ?? '{}'),
      sizes: JSON.parse(localStorage.getItem('ha_dashboard_sizes') ?? '{}'),
      icons: JSON.parse(localStorage.getItem('ha_dashboard_icons') ?? '{}'),
      actions: JSON.parse(localStorage.getItem('ha_dashboard_actions') ?? '{}'),
      labelOverrides: JSON.parse(localStorage.getItem('ha_dashboard_label_overrides') ?? '{}'),
      haActions: JSON.parse(localStorage.getItem('ha_dashboard_ha_actions') ?? '{}'),
      scale: parseFloat(localStorage.getItem('ha_dashboard_scale') ?? '1'),
      panX: parseFloat(localStorage.getItem('ha_dashboard_pan_x') ?? '0'),
      panY: parseFloat(localStorage.getItem('ha_dashboard_pan_y') ?? '0'),
    };
  }

  /**
   * Load dashboard data from Firestore
   */
  async function loadDashboardData(): Promise<void> {
    if (!useFirestore.value || !db) {
      loadFromLocalStorage();
      return;
    }

    try {
      const docRef = doc(db, COLLECTION_NAME, DOCUMENT_ID);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data() as DashboardData;
        dashboardData.value = {
          entities: data.entities || [],
          positions: data.positions || {},
          sizes: data.sizes || {},
          icons: data.icons || {},
          actions: data.actions || {},
          labelOverrides: data.labelOverrides || {},
          haActions: data.haActions || {},
          scale: data.scale ?? 1,
          panX: data.panX ?? 0,
          panY: data.panY ?? 0,
        };
        console.log('✅ Dashboard data loaded from Firestore');
      } else {
        // No data yet, use defaults
        dashboardData.value = {
          entities: [],
          positions: {},
          sizes: {},
          icons: {},
          actions: {},
          labelOverrides: {},
          haActions: {},
          scale: 1,
          panX: 0,
          panY: 0,
        };
        console.log('ℹ️ No dashboard data found in Firestore, using defaults');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      error.value = errorMessage;
      console.error('❌ Failed to load dashboard data:', err);
      throw err;
    }
  }

  /**
   * Set up real-time listener for dashboard changes
   */
  function setupRealtimeListener(): void {
    if (!useFirestore.value || !db) {
      return;
    }

    if (unsubscribe) {
      unsubscribe();
    }

    const docRef = doc(db, COLLECTION_NAME, DOCUMENT_ID);
    
    unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as DashboardData;
          dashboardData.value = {
            entities: data.entities || [],
            positions: data.positions || {},
            sizes: data.sizes || {},
            icons: data.icons || {},
            actions: data.actions || {},
            labelOverrides: data.labelOverrides || {},
            haActions: data.haActions || {},
            scale: data.scale ?? 1,
            panX: data.panX ?? 0,
            panY: data.panY ?? 0,
          };
          console.log('🔄 Dashboard data updated from Firestore');
        }
      },
      (err) => {
        error.value = err.message;
        console.error('❌ Firestore listener error:', err);
      }
    );
  }

  /**
   * Save dashboard data to Firestore or localStorage
   */
  async function saveDashboardData(data: Partial<DashboardData>): Promise<void> {
    if (!dashboardData.value) {
      if (useFirestore.value) {
        await loadDashboardData();
      } else {
        loadFromLocalStorage();
      }
    }

    const currentData = dashboardData.value || {
      entities: [],
      positions: {},
      sizes: {},
      icons: {},
      actions: {},
      labelOverrides: {},
      haActions: {},
      scale: 1,
      panX: 0,
      panY: 0,
    };

    const updatedData: DashboardData = {
      ...currentData,
      ...data,
    };

    if (useFirestore.value && db) {
      try {
        const docRef = doc(db, COLLECTION_NAME, DOCUMENT_ID);
        await setDoc(docRef, updatedData, { merge: true });
        dashboardData.value = updatedData;
        console.log('✅ Dashboard data saved to Firestore');
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        error.value = errorMessage;
        console.error('❌ Failed to save dashboard data to Firestore:', err);
        // Fall back to localStorage
        saveToLocalStorage(updatedData);
      }
    } else {
      // Save to localStorage
      saveToLocalStorage(updatedData);
    }
  }

  /**
   * Save dashboard data to localStorage
   */
  function saveToLocalStorage(data: DashboardData): void {
    localStorage.setItem('ha_dashboard_entities', JSON.stringify(data.entities));
    localStorage.setItem('ha_dashboard_positions', JSON.stringify(data.positions));
    localStorage.setItem('ha_dashboard_sizes', JSON.stringify(data.sizes));
    localStorage.setItem('ha_dashboard_icons', JSON.stringify(data.icons));
    localStorage.setItem('ha_dashboard_actions', JSON.stringify(data.actions));
    localStorage.setItem('ha_dashboard_label_overrides', JSON.stringify(data.labelOverrides));
    localStorage.setItem('ha_dashboard_ha_actions', JSON.stringify(data.haActions));
    localStorage.setItem('ha_dashboard_scale', JSON.stringify(data.scale));
    localStorage.setItem('ha_dashboard_pan_x', JSON.stringify(data.panX));
    localStorage.setItem('ha_dashboard_pan_y', JSON.stringify(data.panY));
    dashboardData.value = data;
    console.log('✅ Dashboard data saved to localStorage');
  }

  /**
   * Migrate localStorage data to Firestore
   */
  async function migrateFromLocalStorage(): Promise<void> {
    if (!useFirestore.value || !db) {
      console.warn('⚠️ Firestore not available, cannot migrate');
      return;
    }

    try {
      console.log('📦 Migrating localStorage data to Firestore...');

      const localStorageData: DashboardData = {
        entities: JSON.parse(localStorage.getItem('ha_dashboard_entities') ?? '[]'),
        positions: JSON.parse(localStorage.getItem('ha_dashboard_positions') ?? '{}'),
        sizes: JSON.parse(localStorage.getItem('ha_dashboard_sizes') ?? '{}'),
        icons: JSON.parse(localStorage.getItem('ha_dashboard_icons') ?? '{}'),
        actions: JSON.parse(localStorage.getItem('ha_dashboard_actions') ?? '{}'),
        labelOverrides: JSON.parse(localStorage.getItem('ha_dashboard_label_overrides') ?? '{}'),
        haActions: JSON.parse(localStorage.getItem('ha_dashboard_ha_actions') ?? '{}'),
        scale: parseFloat(localStorage.getItem('ha_dashboard_scale') ?? '1'),
        panX: parseFloat(localStorage.getItem('ha_dashboard_pan_x') ?? '0'),
        panY: parseFloat(localStorage.getItem('ha_dashboard_pan_y') ?? '0'),
      };

      await saveDashboardData(localStorageData);
      console.log('✅ Migration complete! Dashboard data saved to Firestore.');
    } catch (err) {
      console.error('❌ Migration failed:', err);
      throw err;
    }
  }

  /**
   * Cleanup listener on store destruction
   */
  function cleanup(): void {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  }

  return {
    isInitialized,
    isAuthenticated,
    user,
    dashboardData,
    isLoading,
    error,
    initialize,
    loadDashboardData,
    saveDashboardData,
    migrateFromLocalStorage,
    cleanup,
  };
});

