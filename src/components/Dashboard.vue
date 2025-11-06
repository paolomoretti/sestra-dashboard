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
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { useDebounceFn } from '@vueuse/core';
import { useLocalStorage } from '../composables/useLocalStorage';
import { useFirestoreData } from '../composables/useFirestoreData';
import EntityWidget from './EntityWidget.vue';
import {
  setSelectedEntity,
  clearSelection,
  selectedEntity,
  type EntityData,
} from '../composables/useEntitySelection';
import { useEntitiesStore } from '../stores/entities';
import { useFirestoreStore } from '../stores/firestore';

// Constants
const FLOORPLAN_WIDTH = 2190;
const FLOORPLAN_HEIGHT = 6501;
const floorplanImage = '/floorplan.png';

// Predefined zoom levels (using percentages relative to floorplan dimensions)
interface ZoomLevel {
  scalePercent: number; // Scale as percentage (e.g., 96.7 means 0.967 scale)
  panXPercent: number; // Pan X as percentage of floorplan width
  panYPercent: number; // Pan Y as percentage of floorplan height
}

const PREDEFINED_ZOOM_LEVELS: Record<string, ZoomLevel> = {
  kitchen: {
    scalePercent: 96.7,
    panXPercent: 13.53,
    panYPercent: -21.82,
  },
  cellar: {
    scalePercent: 66.7,
    panXPercent: -7.67,
    panYPercent: -21.77,
  },
  sara: {
    scalePercent: 76.7,
    panXPercent: 20.98,
    panYPercent: -63.35,
  },
  paolo: {
    scalePercent: 76.7,
    panXPercent: 28.62,
    panYPercent: -31.37,
  },
  bedroom: {
    scalePercent: 76.7,
    panXPercent: 26.15,
    panYPercent: -43.44,
  },
  garden: {
    scalePercent: 56.7,
    panXPercent: 47.01,
    panYPercent: -35.41,
  },
};

// Refs
const dashboardWrapperRef = ref<HTMLElement>();
const dashboardRef = ref<HTMLElement>();
const isDraggingFromPalette = ref(false);
const isAnimatingZoom = ref(false);
const entitiesStore = useEntitiesStore();

// Firestore data
const firestoreStore = useFirestoreStore();
const {
  entities: placedEntityIds,
  positions,
  sizes,
  icons,
  actions,
  labelOverrides,
  haActions,
  labelVisible,
  setEntities: setPlacedEntityIds,
  setPositions,
  updateWidgetPosition,
  setSizes,
  updateWidgetSize,
  setIcons,
  setActions,
  setLabelOverrides,
  setHAActions,
  setLabelVisible,
} = useFirestoreData();

// Local reactive state for pan/zoom (not stored in Firestore, always starts fresh)
const scale = ref(1);
const panX = ref(0);
const panY = ref(0);

// Computed: Get full entity data for placed entities
const placedEntities = computed(() => {
  // Use Firestore data (reactive)
  const positionsData = positions.value;
  const sizesData = sizes.value;
  const iconsData = icons.value;
  const actionsData = actions.value;
  const labelOverridesData = labelOverrides.value;
  const haActionsData = haActions.value;

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
          name: labelOverridesData[entityId] || 'Action Button',
          state: 'idle',
          icon: iconsData[entityId] || 'gesture-tap-button',
          loc: positionsData[entityId] || '0 0',
          size: sizesData[entityId] || (isActionButton ? '120 80' : '80 40'),
          tapAction: actionsData[entityId]?.tapAction || { action: 'call-service', service: '' },
          labelOverride: labelOverridesData[entityId] || 'Action Button',
          haAction: haActionsData[entityId] || { service: '' },
        };
      }

      if (!entity) return null;

      return {
        ...entity,
        loc: positionsData[entityId] || entity.loc,
        size: sizesData[entityId] || entity.size,
        icon: iconsData[entityId] || entity.icon,
        tapAction: actionsData[entityId]?.tapAction ?? entity.tapAction,
        holdAction: actionsData[entityId]?.holdAction ?? entity.holdAction,
        labelOverride: labelOverridesData[entityId] ?? entity.labelOverride,
        labelVisible: labelVisible.value[entityId] !== undefined ? labelVisible.value[entityId] : true,
        haAction: haActionsData[entityId] ?? entity.haAction,
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

// Scale and pan are now from Firestore (defined above)

// Debounced function to log position and scale as percentages
const logViewState = useDebounceFn(() => {
  const currentScale = scale.value || 1;
  const scalePercent = (currentScale * 100).toFixed(1);

  // Pan as percentage of floorplan dimensions
  // Negative pan means we're showing content to the right/bottom of origin
  // Positive pan means we're showing content to the left/top of origin
  const panXPercent = ((panX.value / FLOORPLAN_WIDTH) * 100).toFixed(2);
  const panYPercent = ((panY.value / FLOORPLAN_HEIGHT) * 100).toFixed(2);

  console.log(`📊 Dashboard View State:
  Scale: ${scalePercent}%
  Pan X: ${panXPercent}% (${panX.value.toFixed(1)}px)
  Pan Y: ${panYPercent}% (${panY.value.toFixed(1)}px)`);
}, 500);

// Watch for changes in scale, panX, panY and log them
watch(
  [scale, panX, panY],
  () => {
    void logViewState();
  },
  { immediate: false }
);

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
  if (!scale.value || scale.value === 0) {
    nextTick(() => {
      const initialScale = calculateInitialScale();
      // Center the image
      if (dashboardWrapperRef.value) {
        const wrapperWidth = dashboardWrapperRef.value.clientWidth;
        const wrapperHeight = dashboardWrapperRef.value.clientHeight;
        const scaledWidth = FLOORPLAN_WIDTH * initialScale;
        const scaledHeight = FLOORPLAN_HEIGHT * initialScale;
        const newPanX = (wrapperWidth - scaledWidth) / 2;
        const newPanY = (wrapperHeight - scaledHeight) / 2;

        // Update local state immediately
        scale.value = initialScale;
        panX.value = newPanX;
        panY.value = newPanY;
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
    // Only animate when using predefined zoom levels, not during manual panning/zooming
    transition: isAnimatingZoom.value ? 'transform 0.4s ease-in-out' : 'none',
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

  // Update local state immediately
  scale.value = newScale;
  panX.value = newPanX;
  panY.value = newPanY;
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

    // Update local state immediately
    panX.value = panX.value + deltaX;
    panY.value = panY.value + deltaY;

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

    // Update local state immediately
    panX.value = touchStartPanX + deltaX;
    panY.value = touchStartPanY + deltaY;
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

      // Update local state immediately
      scale.value = newScale;
      panX.value = newPanX;
      panY.value = newPanY;
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

async function handleEntityUpdate(entityId: string, updates: Partial<EntityData>) {
  // Update Firestore
  if (updates.loc) {
    // Directly update only the widget that changed
    await updateWidgetPosition(entityId, updates.loc);
  }

  if (updates.size) {
    // Directly update only the widget that changed
    await updateWidgetSize(entityId, updates.size);
  }

  if (updates.icon !== undefined) {
    const newIcons = { ...icons.value };
    if (updates.icon) {
      newIcons[entityId] = updates.icon;
    } else {
      delete newIcons[entityId];
    }
    await setIcons(newIcons);
  }

  if (updates.tapAction !== undefined || updates.holdAction !== undefined) {
    const newActions = { ...actions.value };
    if (!newActions[entityId]) newActions[entityId] = {};
    if (updates.tapAction !== undefined) newActions[entityId].tapAction = updates.tapAction;
    if (updates.holdAction !== undefined) newActions[entityId].holdAction = updates.holdAction;
    await setActions(newActions);
  }

  if (updates.labelOverride !== undefined) {
    const newLabelOverrides = { ...labelOverrides.value };
    if (updates.labelOverride) {
      newLabelOverrides[entityId] = updates.labelOverride;
    } else {
      delete newLabelOverrides[entityId];
    }
    await setLabelOverrides(newLabelOverrides);
  }

  if (updates.haAction !== undefined) {
    const newHAActions = { ...haActions.value };
    if (updates.haAction) {
      newHAActions[entityId] = updates.haAction;
    } else {
      delete newHAActions[entityId];
    }
    await setHAActions(newHAActions);
  }

  if (updates.labelVisible !== undefined) {
    await setLabelVisible(entityId, updates.labelVisible);
  }
}

async function handleEntityDelete(entityId: string) {
  await setPlacedEntityIds(placedEntityIds.value.filter(id => id !== entityId));

  // Clean up Firestore
  const newPositions = { ...positions.value };
  delete newPositions[entityId];
  await setPositions(newPositions);

  const newSizes = { ...sizes.value };
  delete newSizes[entityId];
  await setSizes(newSizes);

  const newIcons = { ...icons.value };
  delete newIcons[entityId];
  await setIcons(newIcons);

  const newActions = { ...actions.value };
  delete newActions[entityId];
  await setActions(newActions);

  const newLabelOverrides = { ...labelOverrides.value };
  delete newLabelOverrides[entityId];
  await setLabelOverrides(newLabelOverrides);

  const newHAActions = { ...haActions.value };
  delete newHAActions[entityId];
  await setHAActions(newHAActions);
}

// Drag and drop from palette
async function handleDrop(e: DragEvent) {
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
      await setPlacedEntityIds([...placedEntityIds.value, entity.key]);
    }

    // Save position
    const newPositions = { ...positions.value };
    newPositions[entity.key] = `${x} ${y}`;
    await setPositions(newPositions);
  } catch (error) {
    console.error('Error dropping entity:', error);
  }
}

// Create action button
async function createActionButton() {
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
    size: '120 80',
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
    await setPlacedEntityIds([...placedEntityIds.value, actionButtonKey]);
  }

  // Save position and size
  const newPositions = { ...positions.value };
  newPositions[actionButtonKey] = `${diagramX} ${diagramY}`;
  await setPositions(newPositions);

  const newSizes = { ...sizes.value };
  newSizes[actionButtonKey] = '120 80';
  await setSizes(newSizes);

  // Save label override
  const newLabelOverrides = { ...labelOverrides.value };
  newLabelOverrides[actionButtonKey] = 'Action Button';
  await setLabelOverrides(newLabelOverrides);

  // Save HA action
  const newHAActions = { ...haActions.value };
  newHAActions[actionButtonKey] = { service: '' };
  await setHAActions(newHAActions);

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

    // Update local state immediately
    scale.value = newScale;
    panX.value = newPanX;
    panY.value = newPanY;
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

    // Update local state immediately
    scale.value = newScale;
    panX.value = newPanX;
    panY.value = newPanY;
  },
  zoomReset: () => {
    if (!dashboardWrapperRef.value) return;
    const rect = dashboardWrapperRef.value.getBoundingClientRect();
    const initialScale = calculateInitialScale();
    const wrapperWidth = rect.width;
    const wrapperHeight = rect.height;
    const scaledWidth = FLOORPLAN_WIDTH * initialScale;
    const scaledHeight = FLOORPLAN_HEIGHT * initialScale;

    const newPanX = (wrapperWidth - scaledWidth) / 2;
    const newPanY = (wrapperHeight - scaledHeight) / 2;

    // Update local state immediately
    scale.value = initialScale;
    panX.value = newPanX;
    panY.value = newPanY;
  },
  zoomFitToWidth: () => {
    if (!dashboardWrapperRef.value) return;
    const rect = dashboardWrapperRef.value.getBoundingClientRect();
    const wrapperWidth = rect.width;

    // Calculate scale to fit width exactly
    const scaleToFitWidth = wrapperWidth / FLOORPLAN_WIDTH;

    // Update local state immediately
    scale.value = scaleToFitWidth;
    panX.value = 0;
    panY.value = 0;
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

    // Update local state immediately
    scale.value = targetScale;
    panX.value = newPanX;
    panY.value = newPanY;
  },
  getZoomLevel: () => scale.value || 1,
  zoomToLevel: (levelName: string) => {
    const level = PREDEFINED_ZOOM_LEVELS[levelName];
    if (!level) {
      console.warn(`Zoom level "${levelName}" not found`);
      return;
    }

    // Convert percentages to actual values
    // Scale: percentage to decimal (96.7% -> 0.967)
    const targetScale = level.scalePercent / 100;

    // Pan: percentage of floorplan dimensions to pixels
    // panXPercent of 13.53 means 13.53% of floorplan width
    const targetPanX = (level.panXPercent / 100) * FLOORPLAN_WIDTH;
    const targetPanY = (level.panYPercent / 100) * FLOORPLAN_HEIGHT;

    // Enable animation for smooth transition
    isAnimatingZoom.value = true;

    // Update local state immediately
    scale.value = targetScale;
    panX.value = targetPanX;
    panY.value = targetPanY;

    // Disable animation after transition completes
    setTimeout(() => {
      isAnimatingZoom.value = false;
    }, 400); // Match the transition duration
  },
  addEntity: (entity: EntityData) => {
    if (!placedEntityIds.value.includes(entity.key)) {
      setPlacedEntityIds([...placedEntityIds.value, entity.key]);
    }
  },
  addEntityAtViewportCenter: async (entity: EntityData) => {
    if (!dashboardWrapperRef.value) return;
    
    const rect = dashboardWrapperRef.value.getBoundingClientRect();
    const currentScale = scale.value || 1;
    
    // Calculate center of viewport in wrapper coordinates
    const viewportCenterX = rect.width / 2;
    const viewportCenterY = rect.height / 2;
    
    // Convert to diagram coordinates (accounting for pan and scale)
    const x = (viewportCenterX - panX.value) / currentScale;
    const y = (viewportCenterY - panY.value) / currentScale;
    
    // Add entity to placed entities if not already there
    if (!placedEntityIds.value.includes(entity.key)) {
      await setPlacedEntityIds([...placedEntityIds.value, entity.key]);
    }
    
    // Save position at viewport center
    const newPositions = { ...positions.value };
    newPositions[entity.key] = `${x} ${y}`;
    await setPositions(newPositions);
    
    // Select the newly added entity so user can see it
    setSelectedEntity(entity);
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

