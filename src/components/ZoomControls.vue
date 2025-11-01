<template>
  <div class="zoom-controls fixed bottom-6 left-6 flex flex-col gap-2 z-10">
    <button
      @click="zoomIn"
      class="bg-[#2a2a2a] hover:bg-[#3a3a3a] border border-[#3a3a3a] rounded px-3 py-2 text-white text-sm transition-colors duration-200 shadow-lg"
      title="Zoom In"
    >
      ➕
    </button>
    <div class="bg-[#2a2a2a] border border-[#3a3a3a] rounded px-3 py-2 text-white text-xs text-center min-w-[60px] shadow-lg">
      {{ zoomPercentage }}%
    </div>
    <button
      @click="zoomOut"
      class="bg-[#2a2a2a] hover:bg-[#3a3a3a] border border-[#3a3a3a] rounded px-3 py-2 text-white text-sm transition-colors duration-200 shadow-lg"
      title="Zoom Out"
    >
      ➖
    </button>
    <button
      @click="zoomReset"
      class="bg-[#2a2a2a] hover:bg-[#3a3a3a] border border-[#3a3a3a] rounded px-3 py-2 text-white text-xs transition-colors duration-200 shadow-lg"
      title="Reset Zoom"
    >
      ↺
    </button>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

const zoomPercentage = ref(100);

function updateZoomLevel() {
  if (window.getZoomLevel) {
    zoomPercentage.value = window.getZoomLevel();
  }
}

function zoomIn() {
  if (window.zoomIn) {
    window.zoomIn();
    setTimeout(updateZoomLevel, 100);
  }
}

function zoomOut() {
  if (window.zoomOut) {
    window.zoomOut();
    setTimeout(updateZoomLevel, 100);
  }
}

function zoomReset() {
  if (window.zoomReset) {
    window.zoomReset();
    setTimeout(updateZoomLevel, 300);
  }
}

// Update zoom level periodically and on viewport changes
let zoomCheckInterval = null;

onMounted(() => {
  updateZoomLevel();
  
  // Check zoom level periodically
  zoomCheckInterval = setInterval(() => {
    updateZoomLevel();
  }, 500);
  
  // Also listen for viewport changes if possible
  if (window.addEventListener) {
    const handleResize = () => {
      setTimeout(updateZoomLevel, 100);
    };
    window.addEventListener('resize', handleResize);
    
    onUnmounted(() => {
      window.removeEventListener('resize', handleResize);
    });
  }
});

onUnmounted(() => {
  if (zoomCheckInterval) {
    clearInterval(zoomCheckInterval);
  }
});
</script>
