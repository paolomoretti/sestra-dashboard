<template>
  <div class="zoom-controls fixed bottom-6 left-6 flex flex-col gap-2 z-10">
    <button
      @click="zoomReset"
      class="bg-[#2a2a2a] hover:bg-[#3a3a3a] border border-[#3a3a3a] rounded px-3 py-2 text-white text-xs transition-colors duration-200 shadow-lg"
      title="Fit to Screen"
    >
      ↺
    </button>
  </div>
</template>

<script setup lang="ts">
function zoomReset() {
  if (window.zoomReset) {
    window.zoomReset();
  }
}
</script>
