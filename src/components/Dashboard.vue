<template>

  <div
    ref="dashboardWrapperRef"
    class="dashboard-wrapper"
    @wheel="handleWheel"
    @touchstart.prevent="handleTouchStart"
    @touchmove.prevent="handleTouchMove"
    @touchend.prevent="handleTouchEnd"
  >

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
  selectedEntity,
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

// Reactive trigger for localStorage updates
const localStorageUpdateTrigger = ref(0);

// Computed: Get full entity data for placed entities
const placedEntities = computed(() => {
  // Read trigger to make this reactive to localStorage changes
  void localStorageUpdateTrigger.value;

  // Load persisted data
  const positions = JSON.parse(localStorage.getItem('ha_dashboard_positions') || '{}');
  const sizes = JSON.parse(localStorage.getItem('ha_dashboard_sizes') || '{}');
  const icons = JSON.parse(localStorage.getItem('ha_dashboard_icons') || '{}');
  const actions = JSON.parse(localStorage.getItem('ha_dashboard_actions') || '{}');
  const labelOverrides = JSON.parse(localStorage.getItem('ha_dashboard_label_overrides') ?? '{}');
  const haActions = JSON.parse(localStorage.getItem('ha_dashboard_ha_actions') ?? '{}');

  return placedEntityIds.value
    .map(entityId => {
      // Check if this is an action button
      const isActionButton = entityId.startsWith('action_button_');

      // Find entity in store (or create synthetic entity for action buttons)
      let entity: EntityData | null =
        entitiesStore.allEntities.find(e => e.key === entityId) ?? null;

      // If not found and it's an action button, create a synthetic entity
      if (!entity && isActionButton) {
        entity = {
          key: entityId,
          isActionButton: true,
          category: 'action_button',
          name: labelOverrides[entityId] || 'Action Button',
          state: 'idle',
          icon: icons[entityId] || 'gesture-tap-button',
          loc: positions[entityId] || '0 0',
          size: sizes[entityId] || '80 40',
          tapAction: actions[entityId]?.tapAction || { action: 'call-service', service: '' },
          labelOverride: labelOverrides[entityId] || 'Action Button',
          haAction: haActions[entityId] || { service: '' },
        };
      }

      if (!entity) return null;

      return {
        ...entity,
        loc: positions[entityId] || entity.loc,
        size: sizes[entityId] || entity.size,
        icon: icons[entityId] || entity.icon,
        tapAction: actions[entityId]?.tapAction ?? entity.tapAction,
        holdAction: actions[entityId]?.holdAction ?? entity.holdAction,
        labelOverride: labelOverrides[entityId] ?? entity.labelOverride,
        haAction: haActions[entityId] ?? entity.haAction,
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
let escapeHandler: ((_e: KeyboardEvent) => void) | null = null;

// Initialize scale on mount if not set
onMounted(() => {
  // Listen for palette drag events
  window.addEventListener('dragstart', () => {
    isDraggingFromPalette.value = true;
  });
  window.addEventListener('dragend', () => {
    isDraggingFromPalette.value = false;
  });

  // Handle Escape key to deselect and Backspace/Delete to remove selected entity
  escapeHandler = (e: KeyboardEvent) => {
    // Don't trigger if user is typing in input fields
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    if (e.key === 'Escape') {
      clearSelection();
    } else if ((e.key === 'Backspace' || e.key === 'Delete') && selectedEntity.value) {
      // Delete selected entity when Backspace or Delete is pressed
      e.preventDefault();
      if (confirm('Are you sure you want to delete this widget?')) {
        handleEntityDelete(selectedEntity.value.key);
        clearSelection();
      }
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

// Touch handling for mobile
let touchStartX = 0;
let touchStartY = 0;
let touchStartPanX = 0;
let touchStartPanY = 0;
let touchStartScale = 1;
let initialTouchDistance = 0;
let isPinching = false;

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

// Touch handlers for mobile panning and pinch-to-zoom
function handleTouchStart(e: TouchEvent) {
  if (!dashboardWrapperRef.value) return;

  if (e.touches.length === 1) {
    // Single touch - prepare for panning
    const touch = e.touches[0];
    if (!touch) return;
    const rect = dashboardWrapperRef.value.getBoundingClientRect();
    touchStartX = touch.clientX - rect.left;
    touchStartY = touch.clientY - rect.top;
    touchStartPanX = panX.value;
    touchStartPanY = panY.value;

    // Check if touching background
    const target = e.target as HTMLElement;
    if (
      target.classList.contains('dashboard-container') ||
      target.classList.contains('dashboard-background') ||
      target.classList.contains('dashboard-wrapper')
    ) {
      isPanning = true;
      clearSelection();
    }
  } else if (e.touches.length === 2) {
    // Two touches - prepare for pinch-to-zoom
    isPinching = true;
    isPanning = false;
    const touch1 = e.touches[0];
    const touch2 = e.touches[1];
    if (!touch1 || !touch2) return;

    // Calculate initial distance between touches
    initialTouchDistance = Math.hypot(
      touch2.clientX - touch1.clientX,
      touch2.clientY - touch1.clientY
    );
    touchStartScale = scale.value || 1;

    // Get center point for zoom
    const rect = dashboardWrapperRef.value.getBoundingClientRect();
    const centerX = (touch1.clientX + touch2.clientX) / 2 - rect.left;
    const centerY = (touch1.clientY + touch2.clientY) / 2 - rect.top;
    touchStartX = centerX;
    touchStartY = centerY;
    touchStartPanX = panX.value;
    touchStartPanY = panY.value;
  }
}

function handleTouchMove(e: TouchEvent) {
  if (!dashboardWrapperRef.value) return;

  if (e.touches.length === 1 && isPanning) {
    // Single touch panning
    const touch = e.touches[0];
    if (!touch) return;
    const rect = dashboardWrapperRef.value.getBoundingClientRect();
    const currentX = touch.clientX - rect.left;
    const currentY = touch.clientY - rect.top;

    // Calculate pan delta
    const deltaX = currentX - touchStartX;
    const deltaY = currentY - touchStartY;

    // Apply pan
    setPanX(touchStartPanX + deltaX);
    setPanY(touchStartPanY + deltaY);
  } else if (e.touches.length === 2 && isPinching) {
    // Pinch-to-zoom
    const touch1 = e.touches[0];
    const touch2 = e.touches[1];
    if (!touch1 || !touch2) return;

    // Calculate current distance between touches
    const currentDistance = Math.hypot(
      touch2.clientX - touch1.clientX,
      touch2.clientY - touch1.clientY
    );

    // Calculate scale change
    const scaleChange = currentDistance / initialTouchDistance;
    const newScale = Math.max(minScale, Math.min(maxScale, touchStartScale * scaleChange));

    if (newScale !== scale.value) {
      // Get center point in wrapper coordinates
      const rect = dashboardWrapperRef.value.getBoundingClientRect();
      const centerX = (touch1.clientX + touch2.clientX) / 2 - rect.left;
      const centerY = (touch1.clientY + touch2.clientY) / 2 - rect.top;

      // Calculate the point in diagram coordinates before zoom
      const diagramX = (centerX - touchStartPanX) / touchStartScale;
      const diagramY = (centerY - touchStartPanY) / touchStartScale;

      // Adjust pan to keep the center point in the same diagram position
      const newPanX = centerX - diagramX * newScale;
      const newPanY = centerY - diagramY * newScale;

      setScale(newScale);
      setPanX(newPanX);
      setPanY(newPanY);
    }
  }
}

function handleTouchEnd(e: TouchEvent) {
  if (e.touches.length === 0) {
    // All touches ended
    isPanning = false;
    isPinching = false;
    initialTouchDistance = 0;
  } else if (e.touches.length === 1) {
    // One touch remaining - switch to panning
    isPinching = false;
    const touch = e.touches[0];
    if (!touch) return;
    const rect = dashboardWrapperRef.value?.getBoundingClientRect();
    if (rect) {
      touchStartX = touch.clientX - rect.left;
      touchStartY = touch.clientY - rect.top;
      touchStartPanX = panX.value;
      touchStartPanY = panY.value;
    }
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

  if (updates.icon !== undefined) {
    const icons = JSON.parse(localStorage.getItem('ha_dashboard_icons') ?? '{}');
    if (updates.icon) {
      icons[entityId] = updates.icon;
    } else {
      delete icons[entityId];
    }
    localStorage.setItem('ha_dashboard_icons', JSON.stringify(icons));
    // Trigger reactive update
    localStorageUpdateTrigger.value++;
  }

  if (updates.tapAction !== undefined || updates.holdAction !== undefined) {
    const actions = JSON.parse(localStorage.getItem('ha_dashboard_actions') ?? '{}');
    if (!actions[entityId]) actions[entityId] = {};
    if (updates.tapAction !== undefined) actions[entityId].tapAction = updates.tapAction;
    if (updates.holdAction !== undefined) actions[entityId].holdAction = updates.holdAction;
    localStorage.setItem('ha_dashboard_actions', JSON.stringify(actions));
    // Trigger reactive update
    localStorageUpdateTrigger.value++;
  }

  if (updates.labelOverride !== undefined) {
    const labelOverrides = JSON.parse(localStorage.getItem('ha_dashboard_label_overrides') ?? '{}');
    if (updates.labelOverride) {
      labelOverrides[entityId] = updates.labelOverride;
    } else {
      delete labelOverrides[entityId];
    }
    localStorage.setItem('ha_dashboard_label_overrides', JSON.stringify(labelOverrides));
    // Trigger reactive update
    localStorageUpdateTrigger.value++;
  }

  if (updates.haAction !== undefined) {
    const haActions = JSON.parse(localStorage.getItem('ha_dashboard_ha_actions') ?? '{}');
    if (updates.haAction) {
      haActions[entityId] = updates.haAction;
    } else {
      delete haActions[entityId];
    }
    localStorage.setItem('ha_dashboard_ha_actions', JSON.stringify(haActions));
    // Trigger reactive update
    localStorageUpdateTrigger.value++;
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

// Create action button
function createActionButton() {
  if (!dashboardWrapperRef.value) {
    return;
  }

  // Calculate center position in diagram coordinates
  const rect = dashboardWrapperRef.value.getBoundingClientRect();
  const wrapperWidth = rect.width;
  const wrapperHeight = rect.height;

  // Center of viewport in wrapper coordinates
  const centerX = wrapperWidth / 2;
  const centerY = wrapperHeight / 2;

  // Convert to diagram coordinates
  const currentScale = scale.value || 1;
  const diagramX = (centerX - panX.value) / currentScale;
  const diagramY = (centerY - panY.value) / currentScale;

  // Generate unique key for action button
  const actionButtonKey = `action_button_${Date.now()}`;

  // Create action button entity
  const actionButton: EntityData = {
    key: actionButtonKey,
    isActionButton: true,
    category: 'action_button',
    name: 'Action Button',
    labelOverride: 'Action Button',
    state: 'idle',
    icon: 'gesture-tap-button',
    loc: `${diagramX} ${diagramY}`,
    size: '80 40',
    tapAction: {
      action: 'call-service',
      service: '',
    },
    haAction: {
      service: '',
    },
  };

  // Add to placed entities
  if (!placedEntityIds.value.includes(actionButtonKey)) {
    setPlacedEntityIds([...placedEntityIds.value, actionButtonKey]);
  }

  // Save position and size
  const positions = JSON.parse(localStorage.getItem('ha_dashboard_positions') ?? '{}');
  positions[actionButtonKey] = `${diagramX} ${diagramY}`;
  localStorage.setItem('ha_dashboard_positions', JSON.stringify(positions));

  const sizes = JSON.parse(localStorage.getItem('ha_dashboard_sizes') ?? '{}');
  sizes[actionButtonKey] = '80 40';
  localStorage.setItem('ha_dashboard_sizes', JSON.stringify(sizes));

  // Save label override
  const labelOverrides = JSON.parse(localStorage.getItem('ha_dashboard_label_overrides') ?? '{}');
  labelOverrides[actionButtonKey] = 'Action Button';
  localStorage.setItem('ha_dashboard_label_overrides', JSON.stringify(labelOverrides));

  // Save HA action
  const haActions = JSON.parse(localStorage.getItem('ha_dashboard_ha_actions') ?? '{}');
  haActions[actionButtonKey] = { service: '' };
  localStorage.setItem('ha_dashboard_ha_actions', JSON.stringify(haActions));

  // Trigger reactive update so the button appears
  localStorageUpdateTrigger.value++;

  // Select the newly created button
  setTimeout(() => {
    setSelectedEntity(actionButton, { x: diagramX, y: diagramY });
  }, 100);
}

// Expose functions for external use
defineExpose({
  createActionButton,
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
  zoomFitToWidth: () => {
    if (!dashboardWrapperRef.value) return;
    const rect = dashboardWrapperRef.value.getBoundingClientRect();
    const wrapperWidth = rect.width;

    // Calculate scale to fit width exactly
    const scaleToFitWidth = wrapperWidth / FLOORPLAN_WIDTH;

    // Align to top
    setScale(scaleToFitWidth);
    setPanX(0); // No horizontal pan needed, image fills width
    setPanY(0); // Align to top
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

