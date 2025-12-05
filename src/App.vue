<template>

  <div id="app" class="h-screen flex flex-col">
     <!-- Floating Controls -->
    <div class="absolute top-4 right-4 z-50 flex items-center gap-2 sm:gap-3">
       <SettingsButton @open="openSettings" />
    </div>

    <div class="flex flex-1 overflow-hidden relative">
       <Dashboard ref="dashboardRef" class="flex-1 bg-[#1a1a1a] overflow-hidden" /> <NumericValues />
      <ZoomControls /> <AddButton
        @add-action-button="handleAddActionButton"
        @add-image-widget="handleAddImageWidget"
        @add-zone="handleAddZone"
        @add-entity="openEntityModal"
      /> <ToastContainer /> <SettingsPanel :is-open="settingsOpen" @close="closeSettings" />
      <EntityModal :is-open="entityModalOpen" @close="closeEntityModal" />
    </div>

  </div>

</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useHotkeys } from './composables/useHotkeys';
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

function handleAddZone() {
  dashboardRef.value?.setRectangleDrawingMode(true);
}
</script>

