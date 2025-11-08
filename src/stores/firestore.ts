/**
 * Firestore store for dashboard data
 */

import { defineStore } from 'pinia';
import { ref, type Ref } from 'vue';
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  onSnapshot,
  deleteField,
  type DocumentData,
  type Unsubscribe,
  type QuerySnapshot,
} from 'firebase/firestore';
import { initFirebase } from '../utils/firebase';
import { signInAnonymously, type User } from 'firebase/auth';

export interface WidgetData {
  entityName: string; // The entity key/id
  labelName?: string; // Label override
  labelVisible?: boolean; // Whether to show the label for this widget (default: true)
  stateVisible?: boolean; // Whether to show the state value for this widget (default: true)
  icon?: string;
  position: string; // Format: "x y"
  size: string; // Format: "width height"
  action?: { tapAction?: any; holdAction?: any };
  haAction?: { service: string; serviceData?: Record<string, any> };
  valuePrefix?: string; // Prefix to display before the numeric value
  valueSuffix?: string; // Suffix to display after the numeric value
  iconColorOn?: string; // Custom color for icon when state is "on" (hex color, e.g., "#FFC107")
  iconColorOff?: string; // Custom color for icon when state is "off" or default (hex color, e.g., "#888888")
}

export interface UIData {
  labelsVisible?: boolean; // Global labels visibility (default: true)
  sidebarVisible?: boolean; // Sidebar visibility (default: true)
  scrollPosition?: { x: number; y: number }; // Scroll position
  scale?: number; // Zoom/scale level
}

const COLLECTION_NAME = 'widgets';
const UI_COLLECTION_NAME = 'ui';
const UI_DOCUMENT_ID = 'settings';

export const useFirestoreStore = defineStore('firestore', () => {
  const isInitialized: Ref<boolean> = ref(false);
  const isAuthenticated: Ref<boolean> = ref(false);
  const user: Ref<User | null> = ref(null);
  const widgets: Ref<Record<string, WidgetData>> = ref({}); // widgetId -> WidgetData
  const uiData: Ref<UIData> = ref({}); // UI settings
  const isLoading: Ref<boolean> = ref(false);
  const error: Ref<string | null> = ref(null);
  const useFirestore: Ref<boolean> = ref(false); // Whether to use Firestore or localStorage
  let unsubscribe: Unsubscribe | null = null;
  let uiUnsubscribe: Unsubscribe | null = null;
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

      // Load widgets
      await loadWidgets();

      // Load UI settings
      await loadUISettings();

      // Set up real-time listeners
      setupRealtimeListener();
      setupUIRealtimeListener();

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
   * Load widgets from localStorage (fallback)
   */
  function loadFromLocalStorage(): void {
    const widgetsData: Record<string, WidgetData> = {};
    
    // Load from old localStorage format and convert
    const entities = JSON.parse(localStorage.getItem('ha_dashboard_entities') ?? '[]');
    const positions = JSON.parse(localStorage.getItem('ha_dashboard_positions') ?? '{}');
    const sizes = JSON.parse(localStorage.getItem('ha_dashboard_sizes') ?? '{}');
    const icons = JSON.parse(localStorage.getItem('ha_dashboard_icons') ?? '{}');
    const actions = JSON.parse(localStorage.getItem('ha_dashboard_actions') ?? '{}');
    const labelOverrides = JSON.parse(localStorage.getItem('ha_dashboard_label_overrides') ?? '{}');
    const haActions = JSON.parse(localStorage.getItem('ha_dashboard_ha_actions') ?? '{}');

    // Convert old format to new format
    for (const entityId of entities) {
      // Try to load label visibility from old localStorage key
      const oldLabelVisibleKey = `ha_dashboard_widget_label_visible_${entityId}`;
      const oldLabelVisible = localStorage.getItem(oldLabelVisibleKey);
      let labelVisible: boolean | undefined = undefined;
      if (oldLabelVisible !== null) {
        try {
          labelVisible = JSON.parse(oldLabelVisible);
        } catch {
          // Ignore parse errors, use undefined (defaults to true)
        }
      }

      widgetsData[entityId] = {
        entityName: entityId,
        labelName: labelOverrides[entityId],
        labelVisible: labelVisible,
        icon: icons[entityId],
        position: positions[entityId] || '0 0',
        size: sizes[entityId] || '80 40',
        action: actions[entityId],
        haAction: haActions[entityId],
      };
    }

    widgets.value = widgetsData;
  }

  /**
   * Load widgets from Firestore
   */
  async function loadWidgets(): Promise<void> {
    if (!useFirestore.value || !db) {
      loadFromLocalStorage();
      return;
    }

    try {
      const widgetsCollection = collection(db, COLLECTION_NAME);
      const querySnapshot = await getDocs(widgetsCollection);
      
      const widgetsData: Record<string, WidgetData> = {};
      
      querySnapshot.forEach((docSnap) => {
        const widgetId = docSnap.id;
        const data = docSnap.data() as WidgetData;
        widgetsData[widgetId] = data;
      });

      widgets.value = widgetsData;
      console.log(`✅ Loaded ${Object.keys(widgetsData).length} widgets from Firestore`);
    } catch (err: any) {
      // Check if it's a permission error
      if (err?.code === 'permission-denied' || err?.message?.includes('permissions')) {
        console.warn('⚠️ Permission denied for Firestore. Falling back to localStorage.');
        console.warn('   Please deploy Firestore rules: firebase deploy --only firestore:rules');
        useFirestore.value = false;
        loadFromLocalStorage();
        return;
      }
      
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      error.value = errorMessage;
      console.error('❌ Failed to load widgets:', err);
      // Fall back to localStorage on error
      useFirestore.value = false;
      loadFromLocalStorage();
    }
  }

  /**
   * Set up real-time listener for widget changes
   */
  function setupRealtimeListener(): void {
    if (!useFirestore.value || !db) {
      return;
    }

    if (unsubscribe) {
      unsubscribe();
    }

    const widgetsCollection = collection(db, COLLECTION_NAME);
    
    unsubscribe = onSnapshot(
      widgetsCollection,
      (querySnapshot: QuerySnapshot) => {
        const widgetsData: Record<string, WidgetData> = {};
        
        querySnapshot.forEach((docSnap) => {
          const widgetId = docSnap.id;
          const data = docSnap.data() as WidgetData;
          widgetsData[widgetId] = data;
        });

        widgets.value = widgetsData;
        console.log('🔄 Widgets updated from Firestore');
      },
      (err) => {
        error.value = err.message;
        console.error('❌ Firestore listener error:', err);
      }
    );
  }

  /**
   * Remove undefined fields from an object (Firestore doesn't allow undefined)
   */
  function removeUndefinedFields(obj: any): any {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = value;
      }
    }
    return cleaned;
  }

  /**
   * Save or update a widget
   */
  async function saveWidget(widgetId: string, widgetData: WidgetData): Promise<void> {
    // Update local state immediately
    widgets.value = {
      ...widgets.value,
      [widgetId]: widgetData,
    };

    if (useFirestore.value && db) {
      try {
        const docRef = doc(db, COLLECTION_NAME, widgetId);
        // Remove undefined fields before saving (Firestore doesn't allow undefined)
        const cleanedData = removeUndefinedFields(widgetData);
        await setDoc(docRef, cleanedData, { merge: true });
        console.log(`✅ Widget ${widgetId} saved to Firestore`);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        error.value = errorMessage;
        console.error(`❌ Failed to save widget ${widgetId} to Firestore:`, err);
        // Fall back to localStorage
        saveWidgetToLocalStorage(widgetId, widgetData);
      }
    } else {
      // Save to localStorage
      saveWidgetToLocalStorage(widgetId, widgetData);
    }
  }

  /**
   * Update a widget field
   */
  async function updateWidget(widgetId: string, updates: Partial<WidgetData>): Promise<void> {
    const currentWidget = widgets.value[widgetId];
    if (!currentWidget) {
      console.warn(`⚠️ Widget ${widgetId} not found, cannot update`);
      return;
    }

    // For valuePrefix and valueSuffix, if undefined or empty string is passed, we need to delete the field
    const processedUpdates: any = { ...updates };
    const fieldsToDelete: string[] = [];
    
    if ('valuePrefix' in updates && (updates.valuePrefix === undefined || updates.valuePrefix === '')) {
      // Mark for deletion in Firestore
      processedUpdates.valuePrefix = deleteField();
      fieldsToDelete.push('valuePrefix');
    }
    if ('valueSuffix' in updates && (updates.valueSuffix === undefined || updates.valueSuffix === '')) {
      // Mark for deletion in Firestore
      processedUpdates.valueSuffix = deleteField();
      fieldsToDelete.push('valueSuffix');
    }
    
    // Remove undefined values from updates (but keep deleteField() for prefix/suffix)
    const cleanedUpdates = removeUndefinedFields(processedUpdates);
    
    // Update local state
    const updatedWidget: WidgetData = {
      ...currentWidget,
    };
    
    // Apply updates, but remove fields marked for deletion
    for (const [key, value] of Object.entries(cleanedUpdates)) {
      if (fieldsToDelete.includes(key)) {
        // Remove from local state
        delete (updatedWidget as any)[key];
      } else {
        (updatedWidget as any)[key] = value;
      }
    }
    
    widgets.value = {
      ...widgets.value,
      [widgetId]: updatedWidget,
    };

    // Save to Firestore
    if (useFirestore.value && db) {
      try {
        const docRef = doc(db, COLLECTION_NAME, widgetId);
        await setDoc(docRef, cleanedUpdates, { merge: true });
        console.log(`✅ Widget ${widgetId} updated in Firestore`);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        error.value = errorMessage;
        console.error(`❌ Failed to update widget ${widgetId} in Firestore:`, err);
        // Fall back to localStorage
        saveWidgetToLocalStorage(widgetId, updatedWidget);
      }
    } else {
      // Save to localStorage
      saveWidgetToLocalStorage(widgetId, updatedWidget);
    }
  }

  /**
   * Delete a widget
   */
  async function deleteWidget(widgetId: string): Promise<void> {
    // Update local state
    const newWidgets = { ...widgets.value };
    delete newWidgets[widgetId];
    widgets.value = newWidgets;

    if (useFirestore.value && db) {
      try {
        const docRef = doc(db, COLLECTION_NAME, widgetId);
        await deleteDoc(docRef);
        console.log(`✅ Widget ${widgetId} deleted from Firestore`);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        error.value = errorMessage;
        console.error(`❌ Failed to delete widget ${widgetId} from Firestore:`, err);
        // Fall back to localStorage
        deleteWidgetFromLocalStorage(widgetId);
      }
    } else {
      // Delete from localStorage
      deleteWidgetFromLocalStorage(widgetId);
    }
  }

  /**
   * Save widget to localStorage
   */
  function saveWidgetToLocalStorage(widgetId: string, widgetData: WidgetData): void {
    // Convert to old format for localStorage compatibility
    const entities = JSON.parse(localStorage.getItem('ha_dashboard_entities') ?? '[]');
    const positions = JSON.parse(localStorage.getItem('ha_dashboard_positions') ?? '{}');
    const sizes = JSON.parse(localStorage.getItem('ha_dashboard_sizes') ?? '{}');
    const icons = JSON.parse(localStorage.getItem('ha_dashboard_icons') ?? '{}');
    const actions = JSON.parse(localStorage.getItem('ha_dashboard_actions') ?? '{}');
    const labelOverrides = JSON.parse(localStorage.getItem('ha_dashboard_label_overrides') ?? '{}');
    const haActions = JSON.parse(localStorage.getItem('ha_dashboard_ha_actions') ?? '{}');

    // Update old format
    if (!entities.includes(widgetId)) {
      entities.push(widgetId);
    }
    positions[widgetId] = widgetData.position;
    sizes[widgetId] = widgetData.size;
    if (widgetData.icon) icons[widgetId] = widgetData.icon;
    if (widgetData.action) actions[widgetId] = widgetData.action;
    if (widgetData.labelName) labelOverrides[widgetId] = widgetData.labelName;
    if (widgetData.haAction) haActions[widgetId] = widgetData.haAction;

    // Save back
    localStorage.setItem('ha_dashboard_entities', JSON.stringify(entities));
    localStorage.setItem('ha_dashboard_positions', JSON.stringify(positions));
    localStorage.setItem('ha_dashboard_sizes', JSON.stringify(sizes));
    localStorage.setItem('ha_dashboard_icons', JSON.stringify(icons));
    localStorage.setItem('ha_dashboard_actions', JSON.stringify(actions));
    localStorage.setItem('ha_dashboard_label_overrides', JSON.stringify(labelOverrides));
    localStorage.setItem('ha_dashboard_ha_actions', JSON.stringify(haActions));
  }

  /**
   * Delete widget from localStorage
   */
  function deleteWidgetFromLocalStorage(widgetId: string): void {
    const entities = JSON.parse(localStorage.getItem('ha_dashboard_entities') ?? '[]');
    const positions = JSON.parse(localStorage.getItem('ha_dashboard_positions') ?? '{}');
    const sizes = JSON.parse(localStorage.getItem('ha_dashboard_sizes') ?? '{}');
    const icons = JSON.parse(localStorage.getItem('ha_dashboard_icons') ?? '{}');
    const actions = JSON.parse(localStorage.getItem('ha_dashboard_actions') ?? '{}');
    const labelOverrides = JSON.parse(localStorage.getItem('ha_dashboard_label_overrides') ?? '{}');
    const haActions = JSON.parse(localStorage.getItem('ha_dashboard_ha_actions') ?? '{}');

    // Remove from arrays/objects
    const entityIndex = entities.indexOf(widgetId);
    if (entityIndex > -1) entities.splice(entityIndex, 1);
    delete positions[widgetId];
    delete sizes[widgetId];
    delete icons[widgetId];
    delete actions[widgetId];
    delete labelOverrides[widgetId];
    delete haActions[widgetId];

    // Save back
    localStorage.setItem('ha_dashboard_entities', JSON.stringify(entities));
    localStorage.setItem('ha_dashboard_positions', JSON.stringify(positions));
    localStorage.setItem('ha_dashboard_sizes', JSON.stringify(sizes));
    localStorage.setItem('ha_dashboard_icons', JSON.stringify(icons));
    localStorage.setItem('ha_dashboard_actions', JSON.stringify(actions));
    localStorage.setItem('ha_dashboard_label_overrides', JSON.stringify(labelOverrides));
    localStorage.setItem('ha_dashboard_ha_actions', JSON.stringify(haActions));
  }

  /**
   * Load UI settings from Firestore
   */
  async function loadUISettings(): Promise<void> {
    if (!useFirestore.value || !db) {
      loadUISettingsFromLocalStorage();
      return;
    }

    try {
      const uiDocRef = doc(db, UI_COLLECTION_NAME, UI_DOCUMENT_ID);
      const uiDocSnap = await getDoc(uiDocRef);
      
      if (uiDocSnap.exists()) {
        const data = uiDocSnap.data() as UIData;
        uiData.value = {
          labelsVisible: data.labelsVisible,
          sidebarVisible: data.sidebarVisible,
          scrollPosition: data.scrollPosition,
          scale: data.scale,
        };
        console.log('✅ UI settings loaded from Firestore');
      } else {
        // No UI data yet, try to migrate from localStorage
        await migrateUISettingsFromLocalStorage();
      }
    } catch (err: any) {
      // Check if it's a permission error
      if (err?.code === 'permission-denied' || err?.message?.includes('permissions')) {
        console.warn('⚠️ Permission denied for Firestore UI settings. Falling back to localStorage.');
        useFirestore.value = false;
        loadUISettingsFromLocalStorage();
        return;
      }
      
      console.error('❌ Failed to load UI settings:', err);
      // Fall back to localStorage on error
      loadUISettingsFromLocalStorage();
    }
  }

  /**
   * Load UI settings from localStorage (fallback)
   */
  function loadUISettingsFromLocalStorage(): void {
    try {
      const labelsVisible = JSON.parse(localStorage.getItem('ha_dashboard_labels_visible') ?? 'true');
      const sidebarVisible = JSON.parse(localStorage.getItem('ha_dashboard_sidebar_visible') ?? 'true');
      const scrollPositionStr = localStorage.getItem('ha_dashboard_scroll_position');
      let scrollPosition: { x: number; y: number } | undefined = undefined;
      
      if (scrollPositionStr) {
        try {
          const parsed = JSON.parse(scrollPositionStr);
          if (parsed && typeof parsed.x === 'number' && typeof parsed.y === 'number') {
            scrollPosition = parsed;
          }
        } catch {
          // Ignore parse errors
        }
      }

      uiData.value = {
        labelsVisible,
        sidebarVisible,
        scrollPosition,
      };
    } catch (err) {
      console.warn('Error loading UI settings from localStorage:', err);
      uiData.value = {
        labelsVisible: true,
        sidebarVisible: true,
      };
    }
  }

  /**
   * Migrate UI settings from localStorage to Firestore
   */
  async function migrateUISettingsFromLocalStorage(): Promise<void> {
    if (!useFirestore.value || !db) {
      return;
    }

    try {
      const labelsVisible = JSON.parse(localStorage.getItem('ha_dashboard_labels_visible') ?? 'true');
      const sidebarVisible = JSON.parse(localStorage.getItem('ha_dashboard_sidebar_visible') ?? 'true');
      const scrollPositionStr = localStorage.getItem('ha_dashboard_scroll_position');
      let scrollPosition: { x: number; y: number } | undefined = undefined;
      
      if (scrollPositionStr) {
        try {
          const parsed = JSON.parse(scrollPositionStr);
          if (parsed && typeof parsed.x === 'number' && typeof parsed.y === 'number') {
            scrollPosition = parsed;
          }
        } catch {
          // Ignore parse errors
        }
      }

      const uiDataToSave: UIData = {
        labelsVisible,
        sidebarVisible,
        scrollPosition,
      };

      const cleanedData = removeUndefinedFields(uiDataToSave);
      const uiDocRef = doc(db, UI_COLLECTION_NAME, UI_DOCUMENT_ID);
      await setDoc(uiDocRef, cleanedData);
      
      uiData.value = uiDataToSave;
      console.log('✅ Migrated UI settings to Firestore');
    } catch (err) {
      console.error('❌ Failed to migrate UI settings:', err);
      loadUISettingsFromLocalStorage();
    }
  }

  /**
   * Save UI settings to Firestore
   */
  async function saveUISettings(updates: Partial<UIData>): Promise<void> {
    // Update local state immediately
    uiData.value = {
      ...uiData.value,
      ...updates,
    };

    if (useFirestore.value && db) {
      try {
        const uiDocRef = doc(db, UI_COLLECTION_NAME, UI_DOCUMENT_ID);
        const cleanedData = removeUndefinedFields(uiData.value);
        await setDoc(uiDocRef, cleanedData, { merge: true });
        console.log('✅ UI settings saved to Firestore');
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        error.value = errorMessage;
        console.error('❌ Failed to save UI settings to Firestore:', err);
        // Fall back to localStorage
        saveUISettingsToLocalStorage(uiData.value);
      }
    } else {
      // Save to localStorage
      saveUISettingsToLocalStorage(uiData.value);
    }
  }

  /**
   * Save UI settings to localStorage (fallback)
   */
  function saveUISettingsToLocalStorage(data: UIData): void {
    try {
      if (data.labelsVisible !== undefined) {
        localStorage.setItem('ha_dashboard_labels_visible', JSON.stringify(data.labelsVisible));
      }
      if (data.sidebarVisible !== undefined) {
        localStorage.setItem('ha_dashboard_sidebar_visible', JSON.stringify(data.sidebarVisible));
      }
      if (data.scrollPosition) {
        localStorage.setItem('ha_dashboard_scroll_position', JSON.stringify(data.scrollPosition));
      }
    } catch (err) {
      console.warn('Error saving UI settings to localStorage:', err);
    }
  }

  /**
   * Set up real-time listener for UI settings changes
   */
  function setupUIRealtimeListener(): void {
    if (!useFirestore.value || !db) {
      return;
    }

    if (uiUnsubscribe) {
      uiUnsubscribe();
    }

    const uiDocRef = doc(db, UI_COLLECTION_NAME, UI_DOCUMENT_ID);
    
    uiUnsubscribe = onSnapshot(
      uiDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as UIData;
          uiData.value = {
            labelsVisible: data.labelsVisible,
            sidebarVisible: data.sidebarVisible,
            scrollPosition: data.scrollPosition,
          };
          console.log('🔄 UI settings updated from Firestore');
        }
      },
      (err) => {
        error.value = err.message;
        console.error('❌ Firestore UI listener error:', err);
      }
    );
  }

  /**
   * Cleanup listener on store destruction
   */
  function cleanup(): void {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    if (uiUnsubscribe) {
      uiUnsubscribe();
      uiUnsubscribe = null;
    }
  }

  /**
   * Set user interacting flag (for preventing auto-save during interactions)
   */
  function setUserInteracting(value: boolean): void {
    // This can be used for future optimizations
  }

  return {
    isInitialized,
    isAuthenticated,
    user,
    widgets,
    uiData,
    isLoading,
    error,
    initialize,
    loadWidgets,
    saveWidget,
    updateWidget,
    deleteWidget,
    loadUISettings,
    saveUISettings,
    setUserInteracting,
    cleanup,
  };
});

