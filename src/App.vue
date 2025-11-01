<template>
  <div id="app" class="h-screen flex flex-col">
    <header class="px-8 py-4 bg-[#2a2a2a] border-b border-[#3a3a3a] flex-shrink-0 flex items-center justify-between">
      <h1 class="m-0 text-2xl">🏠 Sestra Dashboard</h1>
      <LabelToggleButton />
    </header>
    <div class="flex flex-1 overflow-hidden relative">
      <div id="diagramDiv" class="flex-1 bg-[#1a1a1a] overflow-hidden"></div>
      <EntityLabels />
      <EntityInfoPanel />
      <Sidebar />
      <ZoomControls />
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { initDashboard } from './dashboard.js';
import { haConfig } from '../config.js';
import Sidebar from './components/Sidebar.vue';
import ZoomControls from './components/ZoomControls.vue';
import EntityInfoPanel from './components/EntityInfoPanel.vue';
import EntityLabels from './components/EntityLabels.vue';
import LabelToggleButton from './components/LabelToggleButton.vue';
import './style.css';

onMounted(() => {
  // Initialize GoJS dashboard
  initDashboard(haConfig);
});
</script>
