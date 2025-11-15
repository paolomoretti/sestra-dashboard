import { createApp, nextTick } from 'vue';
import { createPinia, type Pinia } from 'pinia';
import App from './App.vue';
import './style.css';
import { haConfig } from '../config';

// Extend Window interface for global properties
declare global {
  interface Window {
    pinia?: Pinia;
    diagramInstance?: any;
    allEntities?: any[];
    allEntitiesForFiltering?: any[];
    initPalette?: () => void;
    updatePaletteFilter?: (filter: string, searchQuery: string) => void;
    updateSensorStates?: (config: any) => Promise<void>;
    zoomIn?: () => void;
    zoomOut?: () => void;
    zoomReset?: () => void;
    zoomFitToWidth?: () => void;
    zoomToEntity?: (x: number, y: number) => void;
    zoomToZone?: (zone: any, padding?: number) => void;
    getZoomLevel?: () => number;
    addEntity?: (entity: any) => void;
    addEntityAtViewportCenter?: (entity: any) => Promise<void>;
    __entityDragOffsetX?: number; // For EntityWidget custom drag
    __entityDragOffsetY?: number; // For EntityWidget custom drag
  }
}

// Check if configuration is set
if (!haConfig.address || !haConfig.accessToken) {
  console.warn('⚠️ Home Assistant configuration not set!');
  console.warn('Please configure your HA address and access token in config.ts');
  console.warn('You can also use environment variables: HA_ADDRESS and HA_ACCESS_TOKEN');
}

// Create Vue app and Pinia store
const app = createApp(App);
const pinia = createPinia();
app.use(pinia);

// Expose Pinia instance to window for backward compatibility
window.pinia = pinia;

app.mount('#app');

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then(registration => {
        console.log('✅ Service Worker registered:', registration.scope);
      })
      .catch(error => {
        console.warn('⚠️ Service Worker registration failed:', error);
      });
  });
}

// Load entities after app is mounted
nextTick(async () => {
  // Import after Pinia is set up
  const { useEntitiesStore } = await import('./stores/entities');
  const { useFirestoreStore } = await import('./stores/firestore');

  const entitiesStore = useEntitiesStore();
  const firestoreStore = useFirestoreStore();

  // Initialize Firestore and migrate data
  try {
    console.log('🔧 Initializing Firestore...');
    const firestoreInitialized = await firestoreStore.initialize();

    if (!firestoreInitialized) {
      console.warn('⚠️ Firestore not initialized. Using localStorage fallback.');
      console.warn('   To enable Firestore:');
      console.warn('   1. Create a .env file (copy from env.example)');
      console.warn('   2. Add your Firebase config (get from Firebase Console)');
      console.warn('   3. Restart the dev server');
    }

    // Firestore is initialized and will automatically load widgets and UI settings
  } catch (error) {
    console.warn('⚠️ Firestore initialization failed, falling back to localStorage:', error);
    // Continue with localStorage fallback
  }

  if (haConfig.address && haConfig.accessToken) {
    try {
      await entitiesStore.loadEntities(haConfig);

      // Connect to WebSocket for real-time state updates
      entitiesStore.connectWebSocket(haConfig);

      // Also set up periodic polling as fallback (every 30 seconds instead of 5)
      // This ensures we still get updates if WebSocket disconnects
      setInterval(() => {
        entitiesStore.updateEntityStates(haConfig);
      }, 30000);
    } catch (error) {
      console.error('Failed to load entities:', error);
    }
  }
});
