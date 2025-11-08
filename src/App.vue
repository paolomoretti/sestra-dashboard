<template>

  <div id="app" class="h-screen flex flex-col">

    <header
      class="header-container px-4 sm:px-8 py-3 sm:py-4 bg-[#2a2a2a] border-b border-[#3a3a3a] flex-shrink-0 flex items-center justify-between"
    >

      <h1 class="m-0 text-lg sm:text-2xl">🏠 Sestra Dashboard</h1>

      <div class="flex items-center gap-2 sm:gap-3">
         <LabelToggleButton /> <SidebarToggleButton />
      </div>

    </header>

    <div class="flex flex-1 overflow-hidden relative">
       <Dashboard ref="dashboardRef" class="flex-1 bg-[#1a1a1a] overflow-hidden" /> <NumericValues />
      <Sidebar v-if="sidebarVisible" /> <ZoomControls /> <AddButton
        @add-action-button="handleAddActionButton"
      />
      <ToastContainer />
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
import AddButton from './components/AddButton.vue';
import ToastContainer from './components/ToastContainer.vue';
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
  {
    key: 'k',
    handler: () => {
      dashboardRef.value?.zoomToLevel('kitchen');
    },
    description: 'Zoom to Kitchen',
    preventDefault: true,
  },
  {
    key: 'c',
    handler: () => {
      dashboardRef.value?.zoomToLevel('cellar');
    },
    description: 'Zoom to Cellar',
    preventDefault: true,
  },
  {
    key: 's',
    handler: () => {
      dashboardRef.value?.zoomToLevel('sara');
    },
    description: 'Zoom to Sara',
    preventDefault: true,
  },
  {
    key: 'p',
    handler: () => {
      dashboardRef.value?.zoomToLevel('paolo');
    },
    description: 'Zoom to Paolo',
    preventDefault: true,
  },
  {
    key: 'b',
    handler: () => {
      dashboardRef.value?.zoomToLevel('bedroom');
    },
    description: 'Zoom to Bedroom',
    preventDefault: true,
  },
  {
    key: 'g',
    handler: () => {
      dashboardRef.value?.zoomToLevel('garden');
    },
    description: 'Zoom to Garden',
    preventDefault: true,
  },
  {
    key: 'l',
    handler: () => {
      dashboardRef.value?.zoomToLevel('livingroom');
    },
    description: 'Zoom to Living Room',
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
    window.getZoomLevel = () => dashboardRef.value?.getZoomLevel() ?? 1;
    window.addEntity = (entity: any) => dashboardRef.value?.addEntity(entity);
    window.addEntityAtViewportCenter = (entity: any) => dashboardRef.value?.addEntityAtViewportCenter(entity);
  }

});

function handleAddActionButton() {
  dashboardRef.value?.createActionButton();
}
</script>

