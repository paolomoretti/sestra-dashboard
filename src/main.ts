import { createApp, nextTick } from 'vue';
import { createPinia, type Pinia } from 'pinia';
import App from './App.vue';
import './style.css';
import { initDashboard } from './dashboard';
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
    getZoomLevel?: () => number;
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

// Load entities after app is mounted
nextTick(async () => {
  // Import after Pinia is set up
  const { useEntitiesStore } = await import('./stores/entities');
  const entitiesStore = useEntitiesStore();
  if (haConfig.address && haConfig.accessToken) {
    try {
      await entitiesStore.loadEntities(haConfig);
      
      // Set up periodic state updates
      setInterval(() => {
        entitiesStore.updateEntityStates(haConfig);
      }, 5000);
    } catch (error) {
      console.error('Failed to load entities:', error);
    }
  }
});

