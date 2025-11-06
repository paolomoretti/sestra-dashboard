<template>
  <div class="zoom-controls fixed bottom-4 left-4 sm:bottom-6 sm:left-6 flex flex-col gap-2 z-10">
    <button
      @click="zoomReset"
      class="zoom-button bg-[#2a2a2a] hover:bg-[#3a3a3a] border border-[#3a3a3a] rounded px-4 py-3 sm:px-3 sm:py-2 text-white text-lg sm:text-xs transition-colors duration-200 shadow-lg min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center"
      title="Fit to Screen (Z)"
    >
      ↺
    </button>
    <button
      @click="zoomFitToWidth"
      class="zoom-button bg-[#2a2a2a] hover:bg-[#3a3a3a] border border-[#3a3a3a] rounded px-4 py-3 sm:px-3 sm:py-2 text-white text-lg sm:text-xs transition-colors duration-200 shadow-lg min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center"
      title="Fit to Width (W)"
    >
      ⇄
    </button>
  </div>
</template>

<script setup lang="ts">
function zoomReset() {
  if (window.zoomReset) {
    window.zoomReset();
  }
}

function zoomFitToWidth() {
  if ((window as any).zoomFitToWidth) {
    (window as any).zoomFitToWidth();
  }
}
</script>
