<template>
  <div id="sidebar" class="w-[300px] bg-[#2a2a2a] border-l border-[#3a3a3a] overflow-y-auto overflow-x-hidden flex flex-col min-w-[200px] transition-all duration-300">
    <div class="flex flex-col h-full">
      <!-- Header -->
      <div class="px-4 py-3 bg-[#333] border-b border-[#3a3a3a] flex-shrink-0">
        <h3 class="text-sm font-semibold text-white m-0 flex items-center gap-2">
          <span>📋</span>
          <span>Entities</span>
        </h3>
      </div>
      
      <!-- Content -->
      <div class="flex-1 flex flex-col min-h-0">
        <div class="px-4 py-3 flex-shrink-0">
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
          class="flex-shrink-0"
        />
        <div class="flex-1 min-h-0 overflow-hidden">
          <EntityPalette
            :entities="allEntities"
            :filter="activeEntityTab"
            :search-query="searchQuery"
            @entity-selected="handleEntitySelected"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useLocalStorage } from '../composables/useLocalStorage';
import { useEntitiesStore } from '../stores/entities';
import EntityTabs from './EntityTabs.vue';
import EntityPalette from './EntityPalette.vue';
import type { EntityData } from '../composables/useEntitySelection';
const entitiesStore = useEntitiesStore();
const { allEntities } = storeToRefs(entitiesStore);

// Entity tabs state
const [storedTab, setStoredTab] = useLocalStorage('activeEntityTab', 'all');
const activeEntityTab = ref(storedTab.value);

// Search query state
const searchQuery = ref('');

function handleEntitySelected(entity: EntityData) {
  // For now, just log - can be used to add entity directly
  console.log('Entity selected:', entity);
}

// Debounce function for search
let searchTimeout: ReturnType<typeof setTimeout> | null = null;
function handleSearch() {
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
  searchTimeout = setTimeout(() => {
    if (window.updatePaletteFilter) {
      window.updatePaletteFilter(activeEntityTab.value, searchQuery.value);
    }
  }, 300); // 300ms debounce
}

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
