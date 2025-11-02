<template>
  <div id="app" class="h-screen flex flex-col">
    <header class="px-8 py-4 bg-[#2a2a2a] border-b border-[#3a3a3a] flex-shrink-0 flex items-center justify-between">
      <h1 class="m-0 text-2xl">🏠 Sestra Dashboard</h1>
      <div class="flex items-center gap-3">
        <LabelToggleButton />
        <SidebarToggleButton />
      </div>
    </header>
    <div class="flex flex-1 overflow-hidden relative">
      <div id="diagramDiv" class="flex-1 bg-[#1a1a1a] overflow-hidden"></div>
      <EntityLabels />
      <NumericValues />
      <EntityInfoPanel />
      <Sidebar v-if="sidebarVisible" />
      <ZoomControls />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, watch, nextTick } from 'vue';
import { storeToRefs } from 'pinia';
import { useUIStore } from './stores/ui';
import { initDashboard } from './dashboard';
import { haConfig } from '../config';
import Sidebar from './components/Sidebar.vue';
import ZoomControls from './components/ZoomControls.vue';
import EntityInfoPanel from './components/EntityInfoPanel.vue';
import EntityLabels from './components/EntityLabels.vue';
import NumericValues from './components/NumericValues.vue';
import LabelToggleButton from './components/LabelToggleButton.vue';
import SidebarToggleButton from './components/SidebarToggleButton.vue';
import './style.css';

const uiStore = useUIStore();
const { sidebarVisible } = storeToRefs(uiStore);

onMounted(() => {
  // Initialize GoJS dashboard
  initDashboard(haConfig);
});

// Watch for sidebar visibility and initialize palette when it becomes visible
watch(sidebarVisible, (visible) => {
  if (visible) {
    // Wait for the sidebar to be mounted
    nextTick(() => {
      if (window.initPalette) {
        window.initPalette();
      }
    });
  }
});
</script>
