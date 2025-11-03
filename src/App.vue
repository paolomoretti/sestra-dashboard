<template>

  <div id="app" class="h-screen flex flex-col">

    <header
      class="px-8 py-4 bg-[#2a2a2a] border-b border-[#3a3a3a] flex-shrink-0 flex items-center justify-between"
    >

      <h1 class="m-0 text-2xl">🏠 Sestra Dashboard</h1>

      <div class="flex items-center gap-3">
         <BackupButton /> <LabelToggleButton /> <SidebarToggleButton />
      </div>

    </header>

    <div class="flex flex-1 overflow-hidden relative">
       <Dashboard ref="dashboardRef" class="flex-1 bg-[#1a1a1a] overflow-hidden" /> <NumericValues />
      <Sidebar v-if="sidebarVisible" /> <ZoomControls /> <AddButton
        @add-action-button="handleAddActionButton"
      />
    </div>

  </div>

</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useUIStore } from './stores/ui';
import { useHotkeys } from './composables/useHotkeys';
import Dashboard from './components/Dashboard.vue';
import Sidebar from './components/Sidebar.vue';
import ZoomControls from './components/ZoomControls.vue';
import NumericValues from './components/NumericValues.vue';
import LabelToggleButton from './components/LabelToggleButton.vue';
import SidebarToggleButton from './components/SidebarToggleButton.vue';
import BackupButton from './components/BackupButton.vue';
import AddButton from './components/AddButton.vue';
import { createDailyBackup } from './utils/backupUtils';
import './style.css';

const uiStore = useUIStore();
const { sidebarVisible } = storeToRefs(uiStore);
const dashboardRef = ref<InstanceType<typeof Dashboard>>();

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
]);

// Expose dashboard functions to window for backward compatibility
onMounted(() => {
  if (dashboardRef.value) {
    window.zoomIn = () => dashboardRef.value?.zoomIn();
    window.zoomOut = () => dashboardRef.value?.zoomOut();
    window.zoomReset = () => dashboardRef.value?.zoomReset();
    window.zoomFitToWidth = () => dashboardRef.value?.zoomFitToWidth();
    window.zoomToEntity = (x: number, y: number) => dashboardRef.value?.zoomToEntity(x, y);
    window.getZoomLevel = () => dashboardRef.value?.getZoomLevel() ?? 1;
  }

  // Create daily backup if needed
  void createDailyBackup();
});

function handleAddActionButton() {
  dashboardRef.value?.createActionButton();
}
</script>

