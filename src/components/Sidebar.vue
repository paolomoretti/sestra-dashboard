<template>
  <div id="sidebar" class="sidebar-container w-full sm:w-[300px] bg-[#2a2a2a] border-l border-[#3a3a3a] overflow-y-auto overflow-x-hidden flex flex-col sm:min-w-[200px] transition-all duration-300">
    <div class="flex flex-col h-full">
      <!-- Header -->
      <div class="px-4 py-3 sm:py-3 bg-[#333] border-b border-[#3a3a3a] flex-shrink-0">
        <h3 class="text-base sm:text-sm font-semibold text-white m-0 flex items-center gap-2">
          <span>📋</span>
          <span>Entities</span>
        </h3>
      </div>
      
      <!-- Content -->
      <div class="flex-1 flex flex-col min-h-0">
        <div class="px-4 py-3 flex-shrink-0 space-y-3">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search entities..."
            class="w-full px-3 py-3 sm:py-2 bg-[#1a1a1a] border border-[#3a3a3a] rounded text-base sm:text-sm text-white placeholder-[#666] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            @input="handleSearch"
          />
        </div>
        <div class="filter-dropdowns-container border-b border-[#3a3a3a] flex-shrink-0">
          <div class="filter-dropdown-wrapper">
            <select
              v-model="selectedRoom"
              class="filter-dropdown"
            >
              <option value="all">🏠 All Rooms</option>
              <option
                v-for="area in sortedAreas"
                :key="area.area_id"
                :value="area.area_id"
              >
                {{ area.name }}
              </option>
            </select>
          </div>
          <div class="filter-dropdown-wrapper">
            <select
              :value="activeEntityTab"
              @change="(e) => { 
                const newTab = (e.target as HTMLSelectElement).value;
                activeEntityTab = newTab;
                setStoredTab(newTab);
                if (window.updatePaletteFilter) {
                  window.updatePaletteFilter(newTab, searchQuery);
                }
              }"
              class="filter-dropdown"
            >
              <option
                v-for="tab in entityTabs"
                :key="tab.value"
                :value="tab.value"
              >
                {{ tab.icon }} {{ tab.label }}
              </option>
            </select>
          </div>
        </div>
        <div class="flex-1 min-h-0 overflow-hidden">
          <EntityPalette
            :entities="allEntities"
            :filter="activeEntityTab"
            :search-query="searchQuery"
            :room-filter="selectedRoom"
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
import EntityPalette from './EntityPalette.vue';
import type { EntityData } from '../composables/useEntitySelection';
const entitiesStore = useEntitiesStore();
const { allEntities, areas } = storeToRefs(entitiesStore);

// Entity tabs state
const [storedTab, setStoredTab] = useLocalStorage('activeEntityTab', 'all');
const activeEntityTab = ref(storedTab.value);

// Search query state
const searchQuery = ref('');

// Room filter state
const [storedRoom, setStoredRoom] = useLocalStorage('activeRoomFilter', 'all');
// Migrate old empty string values to 'all'
const selectedRoom = ref(storedRoom.value || 'all');
if (storedRoom.value === '') {
  setStoredRoom('all');
}

// Sorted areas for dropdown
const sortedAreas = computed(() => {
  return [...areas.value].sort((a, b) => a.name.localeCompare(b.name));
});

async function handleEntitySelected(entity: EntityData) {
  // On mobile or when clicking (not dragging), add entity at viewport center
  // Check if we're on mobile by checking if touch events are available
  const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  // Always use click-to-add for now (works better on mobile and desktop)
  if (window.addEntityAtViewportCenter) {
    await window.addEntityAtViewportCenter(entity);
  } else if (window.addEntity) {
    // Fallback to old method if new one doesn't exist
    window.addEntity(entity);
  }
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

// Watch for room filter changes
watch(selectedRoom, (newRoom) => {
  setStoredRoom(newRoom);
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

.filter-dropdowns-container {
  display: flex;
  padding: 0;
  border-top: 1px solid #3a3a3a;
}

.filter-dropdown-wrapper {
  flex: 1;
  border-right: 1px solid #3a3a3a;
}

.filter-dropdown-wrapper:last-child {
  border-right: none;
}

.filter-dropdown {
  width: 100%;
  background-color: #2a2a2a;
  border: none;
  border-bottom: 2px solid #3a3a3a;
  color: #ffffff;
  font-size: 14px;
  padding: 12px 16px;
  cursor: pointer;
  outline: none;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ffffff' d='M6 9L1 4h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 16px center;
  background-size: 12px;
  padding-right: 40px;
  transition: background-color 0.2s ease;
}

.filter-dropdown:hover {
  background-color: #333333;
}

.filter-dropdown:focus {
  background-color: #333333;
  border-bottom-color: #2d5aa0;
}

.filter-dropdown option {
  background-color: #2a2a2a;
  color: #ffffff;
  padding: 8px;
}

@media (max-width: 768px) {
  .filter-dropdown {
    font-size: 16px;
    padding: 14px 16px;
    padding-right: 40px;
    min-height: 44px;
  }
}
</style>
