<template>

  <div ref="dashboardWrapperRef" class="dashboard-wrapper" @wheel="handleWheel">

    <div
      ref="dashboardRef"
      class="dashboard-container"
      :style="containerStyle"
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @mouseup="handleMouseUp"
      @mouseleave="handleMouseUp"
    >
       <!-- Background image --> <img
        :src="floorplanImage"
        class="dashboard-background"
        :style="backgroundStyle"
        draggable="false"
        alt="Floor plan"
      /> <!-- Entities --> <EntityWidget
        v-for="entity in placedEntities"
        :key="entity.key"
        :entity="entity"
        :scale="currentScale"
        @select="handleEntitySelect"
        @update="handleEntityUpdate"
        @delete="handleEntityDelete"
      /> <!-- Drop zone overlay for palette items -->
      <div
        v-if="isDraggingFromPalette"
        class="drop-zone-overlay"
        @drop="handleDrop"
        @dragover.prevent
        @dragenter.prevent
      />

    </div>

  </div>

</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { useLocalStorage } from '../composables/useLocalStorage';
import EntityWidget from './EntityWidget.vue';
import {
  setSelectedEntity,
  clearSelection,
  type EntityData,
} from '../composables/useEntitySelection';
import { useEntitiesStore } from '../stores/entities';

// Constants
const FLOORPLAN_WIDTH = 2190;
const FLOORPLAN_HEIGHT = 6501;
const floorplanImage = '/floorplan.png';

// Refs
const dashboardWrapperRef = ref<HTMLElement>();
const dashboardRef = ref<HTMLElement>();
const isDraggingFromPalette = ref(false);
const entitiesStore = useEntitiesStore();

// State
const [placedEntityIds, setPlacedEntityIds] = useLocalStorage<string[]>(
  'ha_dashboard_entities',
  []
);

// Computed: Get full entity data for placed entities
const placedEntities = computed(() => {
  return placedEntityIds.value
    .map(entityId => {
      // Find entity in store
      const entity = entitiesStore.allEntities.find(e => e.key === entityId);
      if (!entity) return null;

      // Load persisted data
      const positions = JSON.parse(localStorage.getItem('ha_dashboard_positions') || '{}');
      const sizes = JSON.parse(localStorage.getItem('ha_dashboard_sizes') || '{}');
      const icons = JSON.parse(localStorage.getItem('ha_dashboard_icons') || '{}');
      const actions = JSON.parse(localStorage.getItem('ha_dashboard_actions') || '{}');

      return {
        ...entity,
        loc: positions[entityId] || entity.loc,
        size: sizes[entityId] || entity.size,
        icon: icons[entityId] || entity.icon,
        tapAction: actions[entityId]?.tapAction || entity.tapAction,
        holdAction: actions[entityId]?.holdAction || entity.holdAction,
      } as EntityData;
    })
    .filter((e): e is EntityData => e !== null);
});
// Calculate initial scale to fit image in viewport
function calculateInitialScale(): number {
  if (!dashboardWrapperRef.value) return 1;
  const wrapper = dashboardWrapperRef.value;
  const wrapperWidth = wrapper.clientWidth;
  const wrapperHeight = wrapper.clientHeight;

  // Calculate scale to fit both width and height, use the smaller one
  const scaleX = wrapperWidth / FLOORPLAN_WIDTH;
  const scaleY = wrapperHeight / FLOORPLAN_HEIGHT;
  const initialScale = Math.min(scaleX, scaleY, 1); // Don't scale up beyond 1

  return Math.max(0.1, initialScale); // Minimum scale
}

const [scale, setScale] = useLocalStorage<number>('ha_dashboard_scale', 0);
const [panX, setPanX] = useLocalStorage<number>('ha_dashboard_pan_x', 0);
const [panY, setPanY] = useLocalStorage<number>('ha_dashboard_pan_y', 0);

// Handle Escape key to deselect
let escapeHandler: ((event: KeyboardEvent) => void) | null = null;

// Initialize scale on mount if not set
onMounted(() => {
  // Listen for palette drag events
  window.addEventListener('dragstart', () => {
    isDraggingFromPalette.value = true;
  });
  window.addEventListener('dragend', () => {
    isDraggingFromPalette.value = false;
  });

  // Handle Escape key to deselect
  escapeHandler = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      clearSelection();
    }
  };
  document.addEventListener('keydown', escapeHandler);

  // Initialize scale if not already set
  if (scale.value === 0) {
    nextTick(() => {
      const initialScale = calculateInitialScale();
      setScale(initialScale);
      // Center the image
      if (dashboardWrapperRef.value) {
        const wrapperWidth = dashboardWrapperRef.value.clientWidth;
        const wrapperHeight = dashboardWrapperRef.value.clientHeight;
        const scaledWidth = FLOORPLAN_WIDTH * initialScale;
        const scaledHeight = FLOORPLAN_HEIGHT * initialScale;
        setPanX((wrapperWidth - scaledWidth) / 2);
        setPanY((wrapperHeight - scaledHeight) / 2);
      }
    });
  }
});

onUnmounted(() => {
  if (escapeHandler) {
    document.removeEventListener('keydown', escapeHandler);
  }
});

// Computed
const currentScale = computed(() => scale.value || 1);
const containerStyle = computed(() => {
  const currentScaleValue = scale.value || 1;
  return {
    transform: `translate(${panX.value}px, ${panY.value}px) scale(${currentScaleValue})`,
    transformOrigin: '0 0',
    width: `${FLOORPLAN_WIDTH}px`,
    height: `${FLOORPLAN_HEIGHT}px`,
  };
});
const backgroundStyle = computed(() => ({
  width: `${FLOORPLAN_WIDTH}px`,
  height: `${FLOORPLAN_HEIGHT}px`,
  display: 'block',
}));

// Zoom
const minScale = 0.1;
const maxScale = 3;
const zoomStep = 0.1;

function handleWheel(e: WheelEvent) {
  e.preventDefault();

  if (!dashboardWrapperRef.value) return;

  // Get mouse position relative to wrapper
  const rect = dashboardWrapperRef.value.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  // Calculate zoom factor
  const delta = e.deltaY > 0 ? -zoomStep : zoomStep;
  const oldScale = scale.value || 1;
  const newScale = Math.max(minScale, Math.min(maxScale, oldScale + delta));

  if (oldScale === newScale) return;

  // Calculate the point in diagram coordinates before zoom
  const diagramX = (mouseX - panX.value) / oldScale;
  const diagramY = (mouseY - panY.value) / oldScale;

  // Adjust pan to keep the mouse point in the same diagram position
  const newPanX = mouseX - diagramX * newScale;
  const newPanY = mouseY - diagramY * newScale;

  setScale(newScale);
  setPanX(newPanX);
  setPanY(newPanY);
}

// Pan
let isPanning = false;
let panStartX = 0;
let panStartY = 0;

function handleMouseDown(e: MouseEvent) {
  // Only pan if clicking on background or container (not on entity)
  const target = e.target as HTMLElement;
  if (
    target.classList.contains('dashboard-container') ||
    target.classList.contains('dashboard-background') ||
    target.classList.contains('dashboard-wrapper')
  ) {
    if (!dashboardWrapperRef.value) return;

    // Deselect any selected entity when clicking empty space
    clearSelection();

    isPanning = true;
    const rect = dashboardWrapperRef.value.getBoundingClientRect();
    // Store the initial mouse position in wrapper coordinates and current pan
    panStartX = e.clientX - rect.left; // Mouse X in wrapper
    panStartY = e.clientY - rect.top; // Mouse Y in wrapper
    e.preventDefault();
  }
}

function handleMouseMove(e: MouseEvent) {
  if (isPanning && dashboardWrapperRef.value) {
    const rect = dashboardWrapperRef.value.getBoundingClientRect();
    const currentMouseX = e.clientX - rect.left;
    const currentMouseY = e.clientY - rect.top;

    // Calculate pan delta (difference from start position)
    const deltaX = currentMouseX - panStartX;
    const deltaY = currentMouseY - panStartY;

    // Apply delta to current pan position
    setPanX(panX.value + deltaX);
    setPanY(panY.value + deltaY);

    // Update start position for next move to make it smooth
    panStartX = currentMouseX;
    panStartY = currentMouseY;
  }
}

function handleMouseUp(e: MouseEvent) {
  isPanning = false;

  // Deselect if clicking on empty space (not on an entity)
  const target = e.target as HTMLElement;
  if (
    target.classList.contains('dashboard-container') ||
    target.classList.contains('dashboard-background') ||
    target.classList.contains('dashboard-wrapper')
  ) {
    clearSelection();
  }
}

// Entity management
function handleEntitySelect(entity: EntityData) {
  setSelectedEntity(entity, {
    x: parsePosition(entity.loc).x,
    y: parsePosition(entity.loc).y,
  });
}

function handleEntityUpdate(entityId: string, updates: Partial<EntityData>) {
  // Update localStorage directly
  if (updates.loc) {
    const positions = JSON.parse(localStorage.getItem('ha_dashboard_positions') ?? '{}');
    positions[entityId] = updates.loc;
    localStorage.setItem('ha_dashboard_positions', JSON.stringify(positions));
  }

  if (updates.size) {
    const sizes = JSON.parse(localStorage.getItem('ha_dashboard_sizes') ?? '{}');
    sizes[entityId] = updates.size;
    localStorage.setItem('ha_dashboard_sizes', JSON.stringify(sizes));
  }

  if (updates.icon) {
    const icons = JSON.parse(localStorage.getItem('ha_dashboard_icons') ?? '{}');
    icons[entityId] = updates.icon;
    localStorage.setItem('ha_dashboard_icons', JSON.stringify(icons));
  }

  if (updates.tapAction !== undefined || updates.holdAction !== undefined) {
    const actions = JSON.parse(localStorage.getItem('ha_dashboard_actions') ?? '{}');
    if (!actions[entityId]) actions[entityId] = {};
    if (updates.tapAction !== undefined) actions[entityId].tapAction = updates.tapAction;
    if (updates.holdAction !== undefined) actions[entityId].holdAction = updates.holdAction;
    localStorage.setItem('ha_dashboard_actions', JSON.stringify(actions));
  }
}

function handleEntityDelete(entityId: string) {
  setPlacedEntityIds(placedEntityIds.value.filter(id => id !== entityId));

  // Clean up localStorage
  const positions = JSON.parse(localStorage.getItem('ha_dashboard_positions') || '{}');
  delete positions[entityId];
  localStorage.setItem('ha_dashboard_positions', JSON.stringify(positions));

  const sizes = JSON.parse(localStorage.getItem('ha_dashboard_sizes') || '{}');
  delete sizes[entityId];
  localStorage.setItem('ha_dashboard_sizes', JSON.stringify(sizes));

  const icons = JSON.parse(localStorage.getItem('ha_dashboard_icons') || '{}');
  delete icons[entityId];
  localStorage.setItem('ha_dashboard_icons', JSON.stringify(icons));

  const actions = JSON.parse(localStorage.getItem('ha_dashboard_actions') || '{}');
  delete actions[entityId];
  localStorage.setItem('ha_dashboard_actions', JSON.stringify(actions));
}

// Drag and drop from palette
function handleDrop(e: DragEvent) {
  e.preventDefault();
  isDraggingFromPalette.value = false;

  const entityData = e.dataTransfer?.getData('application/json');
  if (!entityData) return;

  try {
    const entity = JSON.parse(entityData) as EntityData;
    const rect = dashboardWrapperRef.value?.getBoundingClientRect();
    if (!rect) return;

    // Calculate drop position relative to dashboard
    // Account for scale and pan correctly
    const currentScale = scale.value || 1;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const x = (mouseX - panX.value) / currentScale;
    const y = (mouseY - panY.value) / currentScale;

    // Add entity at drop position
    // Add to placed entities list
    if (!placedEntityIds.value.includes(entity.key)) {
      setPlacedEntityIds([...placedEntityIds.value, entity.key]);
    }

    // Save position
    const positions = JSON.parse(localStorage.getItem('ha_dashboard_positions') || '{}');
    positions[entity.key] = `${x} ${y}`;
    localStorage.setItem('ha_dashboard_positions', JSON.stringify(positions));
  } catch (error) {
    console.error('Error dropping entity:', error);
  }
}

// Expose functions for external use
defineExpose({
  zoomIn: () => {
    if (!dashboardWrapperRef.value) return;
    const rect = dashboardWrapperRef.value.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const oldScale = scale.value || 1;
    const newScale = Math.min(maxScale, oldScale + zoomStep);

    if (oldScale === newScale) return;

    // Zoom towards center, adjusting pan
    const diagramX = (centerX - panX.value) / oldScale;
    const diagramY = (centerY - panY.value) / oldScale;
    const newPanX = centerX - diagramX * newScale;
    const newPanY = centerY - diagramY * newScale;

    setScale(newScale);
    setPanX(newPanX);
    setPanY(newPanY);
  },
  zoomOut: () => {
    if (!dashboardWrapperRef.value) return;
    const rect = dashboardWrapperRef.value.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const oldScale = scale.value || 1;
    const newScale = Math.max(minScale, oldScale - zoomStep);

    if (oldScale === newScale) return;

    // Zoom towards center, adjusting pan
    const diagramX = (centerX - panX.value) / oldScale;
    const diagramY = (centerY - panY.value) / oldScale;
    const newPanX = centerX - diagramX * newScale;
    const newPanY = centerY - diagramY * newScale;

    setScale(newScale);
    setPanX(newPanX);
    setPanY(newPanY);
  },
  zoomReset: () => {
    if (!dashboardWrapperRef.value) return;
    const rect = dashboardWrapperRef.value.getBoundingClientRect();
    const initialScale = calculateInitialScale();
    const wrapperWidth = rect.width;
    const wrapperHeight = rect.height;
    const scaledWidth = FLOORPLAN_WIDTH * initialScale;
    const scaledHeight = FLOORPLAN_HEIGHT * initialScale;

    setScale(initialScale);
    setPanX((wrapperWidth - scaledWidth) / 2);
    setPanY((wrapperHeight - scaledHeight) / 2);
  },
  zoomToEntity: (x: number, y: number) => {
    if (!dashboardWrapperRef.value) return;
    const rect = dashboardWrapperRef.value.getBoundingClientRect();
    const wrapperWidth = rect.width;
    const wrapperHeight = rect.height;

    // Zoom level to show entity nicely (1.2x zoom, but cap at maxScale)
    const targetScale = Math.min(1.2, maxScale);

    // Calculate the center of the viewport in diagram coordinates
    const centerX = wrapperWidth / 2;
    const centerY = wrapperHeight / 2;

    // Calculate pan to center entity at viewport center
    const newPanX = centerX - x * targetScale;
    const newPanY = centerY - y * targetScale;

    setScale(targetScale);
    setPanX(newPanX);
    setPanY(newPanY);
  },
  getZoomLevel: () => scale.value || 1,
  addEntity: (entity: EntityData) => {
    if (!placedEntityIds.value.includes(entity.key)) {
      setPlacedEntityIds([...placedEntityIds.value, entity.key]);
    }
  },
});

// Helper function
function parsePosition(loc?: string): { x: number; y: number } {
  if (!loc) return { x: 0, y: 0 };
  const [x, y] = loc.split(' ').map(Number);
  return { x: x || 0, y: y || 0 };
}

// Listen for palette drag start (moved to main onMounted)
</script>

<style scoped>
.dashboard-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.dashboard-container {
  position: absolute;
  width: 100%;
  height: 100%;
  cursor: grab;
}

.dashboard-container:active {
  cursor: grabbing;
}

.dashboard-background {
  display: block;
  user-select: none;
  pointer-events: none;
  max-width: none;
  max-height: none;
}

.drop-zone-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.1);
  pointer-events: all;
  z-index: 10;
}
</style>

