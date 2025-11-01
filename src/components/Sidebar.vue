<template>
  <div id="sidebar" class="w-[300px] bg-[#2a2a2a] border-l border-[#3a3a3a] overflow-y-auto overflow-x-hidden flex flex-col min-w-[200px] transition-all duration-300">
    <CollapsiblePanel
      v-model="paletteCollapsed"
      title="Entities"
      icon="📋"
      storage-key="paletteCollapsed"
      :style="{ flex: paletteCollapsed ? '0 0 auto' : eventLogCollapsed ? '1 1 100%' : '1 1 auto' }"
    >
      <div>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search entities..."
          class="w-full px-3 py-2 bg-[#1a1a1a] border border-[#3a3a3a] rounded text-sm text-white placeholder-[#666] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          @input="handleSearch"
        />
      </div>
      <EntityTabs 
        :tabs="entityTabs" 
        :active-tab="activeEntityTab"
        @update:active-tab="activeEntityTab = $event"
      />
      <div id="paletteDiv" class="border border-[#3a3a3a] rounded bg-[#1a1a1a] min-h-0" :style="paletteHeightStyle"></div>
    </CollapsiblePanel>
    
    <CollapsiblePanel
      v-model="eventLogCollapsed"
      title="Event Log"
      icon="📝"
      storage-key="eventLogCollapsed"
      :style="{ flex: eventLogCollapsed ? '0 0 auto' : '1 1 auto' }"
    >
      <div id="eventLog" class="max-h-[600px] overflow-y-auto"></div>
    </CollapsiblePanel>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useSidebarState } from '../composables/useSidebarState.js';
import { useLocalStorage } from '../composables/useLocalStorage.js';
import CollapsiblePanel from './CollapsiblePanel.vue';
import EntityTabs from './EntityTabs.vue';

const { paletteCollapsed, eventLogCollapsed } = useSidebarState();

// Entity tabs state
const [storedTab, setStoredTab] = useLocalStorage('activeEntityTab', 'all');
const activeEntityTab = ref(storedTab.value);

// Search query state
const searchQuery = ref('');

// Debounce function for search
let searchTimeout = null;
function handleSearch() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    if (window.updatePaletteFilter) {
      window.updatePaletteFilter(activeEntityTab.value, searchQuery.value);
    }
  }, 300); // 300ms debounce
}

// Calculate palette height/style dynamically based on sidebar space
const paletteHeightStyle = computed(() => {
  if (paletteCollapsed.value) return { height: '0px', flex: '0 0 auto' };
  // When event log is collapsed, let flex-1 class handle it; otherwise use fixed height
  return eventLogCollapsed.value 
    ? { flex: '1 1 auto', minHeight: 0 } 
    : { height: '400px', flex: '0 0 auto' };
});

// Entity tabs configuration
const entityTabs = computed(() => [
  { value: 'all', label: 'All', icon: '📦' },
  { value: 'sensor', label: 'Sensors', icon: '📊' },
  { value: 'binary_sensor', label: 'Binary Sensors', icon: '🔘' },
  { value: 'switch', label: 'Switches', icon: '🔌' },
  { value: 'light', label: 'Lights', icon: '💡' },
  { value: 'cover', label: 'Covers', icon: '🚪' },
  { value: 'climate', label: 'Climate', icon: '🌡️' },
  { value: 'camera', label: 'Cameras', icon: '📷' },
  { value: 'device_tracker', label: 'Devices', icon: '📱' },
]);

// Watch for tab changes and update palette
watch(activeEntityTab, (newTab) => {
  setStoredTab(newTab);
  // Notify dashboard.js to filter entities
  if (window.updatePaletteFilter) {
    window.updatePaletteFilter(newTab, searchQuery.value);
  }
});

// Watch for search query changes
watch(searchQuery, () => {
  handleSearch();
});

onMounted(() => {
  // Initialize palette if it hasn't been initialized yet (sidebar was hidden on load)
  if (window.initPalette) {
    window.initPalette();
  }
  
  // Notify dashboard.js of initial tab and search
  if (window.updatePaletteFilter) {
    window.updatePaletteFilter(activeEntityTab.value, searchQuery.value);
  }
});
</script>

<style scoped>
#paletteDiv canvas {
  cursor: grab;
}

#paletteDiv canvas:active {
  cursor: grabbing;
}
</style>
