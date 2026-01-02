<template>

  <div id="app" class="h-screen flex flex-col">
     <!-- Floating Controls -->
    <div class="absolute top-4 right-4 z-50 flex items-center gap-2 sm:gap-3">

      <div class="flex items-center bg-black/50 backdrop-blur rounded-lg px-2 py-1 mr-2">
         <label class="flex items-center gap-2 cursor-pointer"
          > <span class="text-xs font-medium text-white/90 uppercase tracking-wider">Edit Mode</span
          >
          <div class="relative inline-flex items-center cursor-pointer">
             <input type="checkbox" v-model="isGlobalEditMode" class="sr-only peer" />
            <div
              class="w-9 h-5 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"
            ></div>

          </div>
           </label
        >
      </div>
       <SettingsButton @open="openSettings" />
    </div>

    <div class="flex flex-1 overflow-hidden relative">
       <Dashboard ref="dashboardRef" class="flex-1 bg-[#1a1a1a] overflow-hidden" /> <NumericValues />
      <ZoomControls /> <AddButton
        @add-action-button="handleAddActionButton"
        @add-image-widget="handleAddImageWidget"
        @add-text-label="handleAddTextLabel"
        @add-zone="handleAddZone"
        @add-entity="openEntityModal"
      /> <ToastContainer /> <SettingsPanel :is-open="settingsOpen" @close="closeSettings" />
      <EntityModal :is-open="entityModalOpen" @close="closeEntityModal" />
    </div>

  </div>

</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useHotkeys } from './composables/useHotkeys';
import { storeToRefs } from 'pinia';
import { useFirestoreStore } from './stores/firestore';
import { useUIStore } from './stores/ui';
import { useToast } from './composables/useToast';
import Dashboard from './components/Dashboard.vue';
import ZoomControls from './components/ZoomControls.vue';
import NumericValues from './components/NumericValues.vue';
import SettingsButton from './components/SettingsButton.vue';
import SettingsPanel from './components/SettingsPanel.vue';
import AddButton from './components/AddButton.vue';
import ToastContainer from './components/ToastContainer.vue';
import EntityModal from './components/EntityModal.vue';
import './style.css';

const dashboardRef = ref<InstanceType<typeof Dashboard>>();
const settingsOpen = ref(false);
const entityModalOpen = ref(false);
const firestoreStore = useFirestoreStore();
const uiStore = useUIStore();
const { isGlobalEditMode } = storeToRefs(uiStore);
const toast = useToast();

// Watch for Firestore errors
watch(
  () => firestoreStore.error,
  newError => {
    if (newError) {
      toast.error(`Firestore Error: ${newError}`, 10000);
    }
  }
);

function openSettings() {
  settingsOpen.value = true;
}

function closeSettings() {
  settingsOpen.value = false;
}

function openEntityModal() {
  entityModalOpen.value = true;
}

function closeEntityModal() {
  entityModalOpen.value = false;
}

// Setup hotkeys
useHotkeys([
  {
    key: 'z',
    handler: () => {
      dashboardRef.value?.zoomReset();
    },
    description: 'Reset zoom (Fit to Screen)',
    preventDefault: true,
  },
  {
    key: 'w',
    handler: () => {
      dashboardRef.value?.zoomFitToWidth();
    },
    description: 'Fit to width',
    preventDefault: true,
  },
  {
    key: '+',
    handler: () => {
      dashboardRef.value?.zoomIn();
    },
    description: 'Zoom in',
    preventDefault: true,
  },
  {
    key: '=',
    handler: () => {
      // Also handle '=' key (which is '+' without shift on some keyboards)
      dashboardRef.value?.zoomIn();
    },
    description: 'Zoom in',
    preventDefault: true,
  },
  {
    key: '-',
    handler: () => {
      dashboardRef.value?.zoomOut();
    },
    description: 'Zoom out',
    preventDefault: true,
  },
]);

// Expose dashboard functions to window for backward compatibility
onMounted(() => {
  if (dashboardRef.value) {
    window.zoomIn = () => dashboardRef.value?.zoomIn();
    window.zoomOut = () => dashboardRef.value?.zoomOut();
    window.zoomReset = () => dashboardRef.value?.zoomReset();
    window.zoomFitToWidth = () => dashboardRef.value?.zoomFitToWidth();
    window.zoomToEntity = (x: number, y: number) => dashboardRef.value?.zoomToEntity(x, y);
    window.zoomToZone = (zone: any, padding?: number) =>
      dashboardRef.value?.zoomToZone(zone, padding);
    window.getZoomLevel = () => dashboardRef.value?.getZoomLevel() ?? 1;
    window.addEntity = (entity: any) => dashboardRef.value?.addEntity(entity);
    window.addEntityAtViewportCenter = (entity: any) =>
      dashboardRef.value?.addEntityAtViewportCenter(entity) ?? Promise.resolve();
  }
});

function handleAddActionButton() {
  dashboardRef.value?.createActionButton();
}

function handleAddImageWidget() {
  dashboardRef.value?.createImageWidget();
}

function handleAddTextLabel() {
  dashboardRef.value?.createTextLabel();
}

function handleAddZone() {
  dashboardRef.value?.setRectangleDrawingMode(true);
}
</script>

