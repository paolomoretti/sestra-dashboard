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
      :class="{ 'drawing-mode': isDrawingRectangle }"
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
      /> <!-- Zone Rectangles (rendered first so they appear behind widgets) --> <ZoneRectangle
        v-for="zone in zones"
        :key="zone.id"
        :zone="zone"
        :scale="currentScale"
        :selected="selectedZoneId === zone.id"
        @select="handleZoneSelect"
        @update="handleZoneUpdate"
        @delete="handleZoneDelete"
      /> <!-- Entities (rendered after zones so they appear on top) --> <EntityWidget
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
     <!-- Temporary drawing rectangle (while drawing) - outside container for proper positioning -->

    <div
      v-if="isDrawingRectangle && drawingRectangle"
      class="drawing-rectangle"
      :style="drawingRectangleStyle"
    />

  </div>

</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { useDebounceFn } from '@vueuse/core';
import { storeToRefs } from 'pinia';
import { useFirestoreData } from '../composables/useFirestoreData';
import EntityWidget from './EntityWidget.vue';
import ZoneRectangle, { type ZoneData } from './ZoneRectangle.vue';
import {
  setSelectedEntity,
  clearSelection,
  selectedEntity,
  type EntityData,
} from '../composables/useEntitySelection';
import { useEntitiesStore } from '../stores/entities';
import { useFirestoreStore } from '../stores/firestore';
import { useUIStore } from '../stores/ui';

// Constants
const FLOORPLAN_WIDTH = 2190;
const FLOORPLAN_HEIGHT = 6501;
const floorplanImage = '/floorplan.png';

// Refs
const dashboardWrapperRef = ref<HTMLElement>();
const dashboardRef = ref<HTMLElement>();
const isDraggingFromPalette = ref(false);
const isAnimatingZoom = ref(false);
const entitiesStore = useEntitiesStore();

// Rectangle drawing state
const isDrawingRectangle = ref(false);
const drawingRectangle = ref<{ x: number; y: number; width: number; height: number } | null>(null);
const rectangleStartX = ref(0);
const rectangleStartY = ref(0);
const zones = ref<ZoneData[]>([]);
const selectedZoneId = ref<string | null>(null);

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
  stateVisible,
  valuePrefixes,
  valueSuffixes,
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
  setStateVisible,
  setValuePrefix,
  setValueSuffix,
} = useFirestoreData();

// UI store for scale and scroll position
const uiStore = useUIStore();
const { scale: uiScale } = storeToRefs(uiStore);
const { setScale: setUIScale } = uiStore;

// Watch for Firestore initialization
const { isInitialized: firestoreInitialized } = storeToRefs(firestoreStore);

// Local reactive state for pan (scroll position is managed by UI store)
const panX = ref(0);
const panY = ref(0);

// Computed scale that uses UI store scale if available, otherwise falls back to local
const scale = computed({
  get: () => uiScale.value ?? 1,
  set: (value: number) => {
    setUIScale(value);
  },
});

// Computed: Get full entity data for placed entities
const placedEntities = computed(() => {
  // Use Firestore data (reactive)
  const positionsData = positions.value;
  const sizesData = sizes.value;
  const iconsData = icons.value;
  const actionsData = actions.value;
  const labelOverridesData = labelOverrides.value;
  const haActionsData = haActions.value;
  const valuePrefixesData = valuePrefixes.value;
  const valueSuffixesData = valueSuffixes.value;

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
        labelVisible:
          labelVisible.value[entityId] !== undefined ? labelVisible.value[entityId] : true,
        stateVisible:
          stateVisible.value[entityId] !== undefined ? stateVisible.value[entityId] : true,
        valuePrefix: valuePrefixesData[entityId] ?? entity.valuePrefix,
        valueSuffix: valueSuffixesData[entityId] ?? entity.valueSuffix,
        iconColorOn: (firestoreStore.widgets[entityId] as any)?.iconColorOn ?? entity.iconColorOn,
        iconColorOff:
          (firestoreStore.widgets[entityId] as any)?.iconColorOff ?? entity.iconColorOff,
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
      selectedZoneId.value = null;
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      // Delete selected entity or zone when Backspace or Delete is pressed
      e.preventDefault();
      if (selectedEntity.value) {
        if (confirm('Are you sure you want to delete this widget?')) {
          handleEntityDelete(selectedEntity.value.key);
          clearSelection();
        }
      } else if (selectedZoneId.value) {
        if (confirm('Are you sure you want to delete this zone?')) {
          handleZoneDelete(selectedZoneId.value);
        }
      }
    }
  };
  document.addEventListener('keydown', escapeHandler);

  // Register keyboard shortcuts for zones
  zoneShortcutHandlerRef = (e: KeyboardEvent) => {
    // Don't trigger if user is typing in input fields
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    // Don't trigger if meta/ctrl keys are pressed
    if (e.metaKey || e.ctrlKey) {
      return;
    }

    // Find zone with matching shortcut key
    const key = e.key.toLowerCase();
    const zone = zones.value.find(z => z.shortcutKey?.toLowerCase() === key);
    if (zone) {
      e.preventDefault();
      e.stopPropagation();
      if (window.zoomToZone) {
        window.zoomToZone(zone, 50);
      }
    }
  };
  document.addEventListener('keydown', zoneShortcutHandlerRef);

  // Initialize scale: wait for Firestore to load, then restore from UI store if available, otherwise calculate initial
  let scaleInitialized = false;

  const initializeScaleOnce = () => {
    if (scaleInitialized || !dashboardWrapperRef.value) return;

    const wrapperWidth = dashboardWrapperRef.value.clientWidth;
    const wrapperHeight = dashboardWrapperRef.value.clientHeight;

    // If scale is already restored from Firestore, use it
    if (uiScale.value !== undefined) {
      const scaledWidth = FLOORPLAN_WIDTH * uiScale.value;
      const scaledHeight = FLOORPLAN_HEIGHT * uiScale.value;
      const newPanX = (wrapperWidth - scaledWidth) / 2;
      const newPanY = (wrapperHeight - scaledHeight) / 2;
      panX.value = newPanX;
      panY.value = newPanY;
      scaleInitialized = true;
      return;
    }

    // If Firestore is initialized but no scale was found, calculate initial
    // Only do this if Firestore has finished loading (to avoid setting before restore)
    if (firestoreInitialized.value) {
      const targetScale = calculateInitialScale();
      const scaledWidth = FLOORPLAN_WIDTH * targetScale;
      const scaledHeight = FLOORPLAN_HEIGHT * targetScale;
      const newPanX = (wrapperWidth - scaledWidth) / 2;
      const newPanY = (wrapperHeight - scaledHeight) / 2;

      setUIScale(targetScale);
      panX.value = newPanX;
      panY.value = newPanY;
      scaleInitialized = true;
    }
  };

  // Watch for Firestore initialization
  watch(firestoreInitialized, initialized => {
    if (initialized) {
      nextTick(() => {
        initializeScaleOnce();
      });
    }
  });

  // Watch for scale restoration from Firestore (this takes priority)
  watch(
    uiScale,
    newScale => {
      if (newScale !== undefined && dashboardWrapperRef.value && !scaleInitialized) {
        nextTick(() => {
          initializeScaleOnce();
        });
      }
    },
    { immediate: true }
  );

  // Fallback: if Firestore never initializes or takes too long, initialize after a delay
  nextTick(() => {
    setTimeout(() => {
      if (!scaleInitialized) {
        initializeScaleOnce();
      }
    }, 1000); // Wait 1 second for Firestore to load
  });

  // Load zones from Firestore
  watch(
    firestoreInitialized,
    initialized => {
      if (initialized) {
        loadZonesFromFirestore();
      }
    },
    { immediate: true }
  );

  // Watch for Firestore widget changes to update zones (debounced to avoid too many reloads)
  const debouncedLoadZones = useDebounceFn(() => {
    if (!isDrawingRectangle.value) {
      loadZonesFromFirestore();
    }
  }, 300);

  watch(
    () => firestoreStore.widgets,
    () => {
      // Only reload if we're not currently drawing or updating a zone
      debouncedLoadZones();
    },
    { deep: true }
  );
});

// Store zone shortcut handler reference for cleanup
let zoneShortcutHandlerRef: ((e: KeyboardEvent) => void) | null = null;

onUnmounted(() => {
  if (escapeHandler) {
    document.removeEventListener('keydown', escapeHandler);
  }
  if (zoneShortcutHandlerRef) {
    document.removeEventListener('keydown', zoneShortcutHandlerRef);
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

    // If in rectangle drawing mode, start drawing
    if (isDrawingRectangle.value) {
      const rect = dashboardWrapperRef.value.getBoundingClientRect();
      const currentScale = scale.value || 1;
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Convert to diagram coordinates
      const diagramX = (mouseX - panX.value) / currentScale;
      const diagramY = (mouseY - panY.value) / currentScale;

      rectangleStartX.value = diagramX;
      rectangleStartY.value = diagramY;
      drawingRectangle.value = {
        x: diagramX,
        y: diagramY,
        width: 0,
        height: 0,
      };
      e.preventDefault();
      return;
    }

    // Deselect any selected entity when clicking empty space
    clearSelection();
    selectedZoneId.value = null;

    isPanning = true;
    const rect = dashboardWrapperRef.value.getBoundingClientRect();
    // Store the initial mouse position in wrapper coordinates and current pan
    panStartX = e.clientX - rect.left; // Mouse X in wrapper
    panStartY = e.clientY - rect.top; // Mouse Y in wrapper
    e.preventDefault();
  }
}

function handleMouseMove(e: MouseEvent) {
  // Handle rectangle drawing
  if (isDrawingRectangle.value && drawingRectangle.value && dashboardWrapperRef.value) {
    const rect = dashboardWrapperRef.value.getBoundingClientRect();
    const currentScale = scale.value || 1;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Convert to diagram coordinates
    const diagramX = (mouseX - panX.value) / currentScale;
    const diagramY = (mouseY - panY.value) / currentScale;

    // Calculate rectangle dimensions
    const width = diagramX - rectangleStartX.value;
    const height = diagramY - rectangleStartY.value;

    drawingRectangle.value = {
      x: Math.min(rectangleStartX.value, diagramX),
      y: Math.min(rectangleStartY.value, diagramY),
      width: Math.abs(width),
      height: Math.abs(height),
    };
    return;
  }

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
  // Handle rectangle drawing completion
  if (isDrawingRectangle.value && drawingRectangle.value) {
    const rect = drawingRectangle.value;
    // Only create rectangle if it has minimum size
    if (rect.width > 20 && rect.height > 20) {
      createZone(rect.x, rect.y, rect.width, rect.height);
    }
    drawingRectangle.value = null;
    isDrawingRectangle.value = false;
    return;
  }

  isPanning = false;

  // Deselect if clicking on empty space (not on an entity)
  const target = e.target as HTMLElement;
  if (
    target.classList.contains('dashboard-container') ||
    target.classList.contains('dashboard-background') ||
    target.classList.contains('dashboard-wrapper')
  ) {
    clearSelection();
    selectedZoneId.value = null;
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

  if (updates.stateVisible !== undefined) {
    await setStateVisible(entityId, updates.stateVisible);
  }

  if ('valuePrefix' in updates) {
    // Always send the update - pass through empty string as-is
    // The updateWidget function will handle converting empty string to deleteField()
    await setValuePrefix(entityId, updates.valuePrefix === null ? undefined : updates.valuePrefix);
  }

  if ('valueSuffix' in updates) {
    // Always send the update - pass through empty string as-is
    // The updateWidget function will handle converting empty string to deleteField()
    await setValueSuffix(entityId, updates.valueSuffix === null ? undefined : updates.valueSuffix);
  }

  if ('iconColorOn' in updates) {
    await firestoreStore.updateWidget(entityId, { iconColorOn: updates.iconColorOn });
  }

  if ('iconColorOff' in updates) {
    await firestoreStore.updateWidget(entityId, { iconColorOff: updates.iconColorOff });
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

// Zone management
const drawingRectangleStyle = computed(() => {
  if (!drawingRectangle.value) return {};
  const currentScale = scale.value || 1;
  return {
    position: 'absolute' as const,
    left: `${drawingRectangle.value.x * currentScale + panX.value}px`,
    top: `${drawingRectangle.value.y * currentScale + panY.value}px`,
    width: `${drawingRectangle.value.width * currentScale}px`,
    height: `${drawingRectangle.value.height * currentScale}px`,
    border: '2px dashed rgba(33, 150, 243, 0.8)',
    backgroundColor: 'rgba(33, 150, 243, 0.15)',
    borderRadius: '4px',
    pointerEvents: 'none' as const,
    zIndex: 20000,
    boxSizing: 'border-box' as const,
  };
});

async function createZone(x: number, y: number, width: number, height: number) {
  const zoneId = `zone_${Date.now()}`;
  const newZone: ZoneData = {
    id: zoneId,
    label: 'New Zone',
    x,
    y,
    width,
    height,
  };

  zones.value.push(newZone);
  await saveZoneToFirestore(newZone);

  // Disable drawing mode after creating a zone
  isDrawingRectangle.value = false;
  drawingRectangle.value = null;

  // Select the newly created zone and open the panel for editing
  selectedZoneId.value = zoneId;
  clearSelection();

  // Wait for the zone component to render, then focus the input
  await nextTick();
  setTimeout(() => {
    // Find the zone's label input and focus it
    const zoneComponent = document.querySelector(`[data-zone-id="${zoneId}"]`);
    if (zoneComponent) {
      const input = zoneComponent.querySelector('input[type="text"]') as HTMLInputElement;
      if (input) {
        input.focus();
        input.select();
      }
    }
  }, 100);
}

function handleZoneSelect(zone: ZoneData) {
  selectedZoneId.value = zone.id;
  clearSelection();
}

async function handleZoneUpdate(zoneId: string, updates: Partial<ZoneData>) {
  const zoneIndex = zones.value.findIndex(z => z.id === zoneId);
  if (zoneIndex === -1) return;

  const existingZone = zones.value[zoneIndex];
  zones.value[zoneIndex] = {
    ...existingZone,
    ...updates,
  } as ZoneData;

  await saveZoneToFirestore(zones.value[zoneIndex]);
}

async function handleZoneDelete(zoneId: string) {
  // Make sure we're only deleting the specified zone
  if (!zoneId || !selectedZoneId.value || selectedZoneId.value !== zoneId) {
    console.warn('Zone delete: zoneId mismatch or no zone selected');
    return;
  }

  const zoneIndex = zones.value.findIndex(z => z.id === zoneId);
  if (zoneIndex === -1) {
    console.warn('Zone delete: zone not found in local state');
    return;
  }

  // Remove from local state first
  zones.value.splice(zoneIndex, 1);
  selectedZoneId.value = null;

  // Then delete from Firestore
  await deleteZoneFromFirestore(zoneId);
}

async function saveZoneToFirestore(zone: ZoneData) {
  try {
    console.log('Saving zone to Firestore:', zone);
    const widgetData: any = {
      entityName: zone.id,
      position: `${zone.x} ${zone.y}`,
      size: `${zone.width} ${zone.height}`,
      labelName: zone.label || 'Unnamed Zone',
    };
    // Only include locked if it's set
    if (zone.locked !== undefined) {
      widgetData.locked = zone.locked;
    }
    // Include shortcutKey if it's set and not empty, otherwise don't include it (clears it)
    if (zone.shortcutKey !== undefined && zone.shortcutKey !== '') {
      widgetData.shortcutKey = zone.shortcutKey;
    } else if (zone.shortcutKey === '') {
      // Explicitly clear shortcutKey by not including it (Firestore will remove it)
      // We could also use deleteField, but for simplicity, just don't include it
    }
    await firestoreStore.saveWidget(zone.id, widgetData);
    console.log('Zone saved successfully');
  } catch (error) {
    console.error('Error saving zone to Firestore:', error);
  }
}

async function deleteZoneFromFirestore(zoneId: string) {
  try {
    await firestoreStore.deleteWidget(zoneId);
  } catch (error) {
    console.error('Error deleting zone from Firestore:', error);
  }
}

async function loadZonesFromFirestore() {
  try {
    const widgets = firestoreStore.widgets;
    const loadedZones: ZoneData[] = [];

    for (const [widgetId, widget] of Object.entries(widgets)) {
      // Only load zones (widgets that start with "zone_")
      if (widgetId.startsWith('zone_')) {
        const [x, y] = widget.position.split(' ').map(Number);
        const [width, height] = widget.size.split(' ').map(Number);

        // Extract locked and shortcutKey from widget data
        const widgetData = widget as any;
        const locked = widgetData.locked ?? false;
        const shortcutKey = widgetData.shortcutKey;

        // Skip if we already have this zone (to avoid overwriting during updates)
        const existingZone = zones.value.find(z => z.id === widgetId);
        if (existingZone) {
          // Only update if the data actually changed
          if (
            existingZone.x !== x ||
            existingZone.y !== y ||
            existingZone.width !== width ||
            existingZone.height !== height ||
            existingZone.label !== (widget.labelName || 'Unnamed Zone') ||
            existingZone.locked !== locked ||
            existingZone.shortcutKey !== shortcutKey
          ) {
            const index = zones.value.findIndex(z => z.id === widgetId);
            if (index !== -1) {
              zones.value[index] = {
                id: widgetId,
                label: widget.labelName || 'Unnamed Zone',
                x: x || 0,
                y: y || 0,
                width: width || 100,
                height: height || 100,
                locked,
                shortcutKey,
              };
            }
          }
        } else {
          loadedZones.push({
            id: widgetId,
            label: widget.labelName || 'Unnamed Zone',
            x: x || 0,
            y: y || 0,
            width: width || 100,
            height: height || 100,
            locked,
            shortcutKey,
          });
        }
      }
    }

    // Add new zones that don't exist yet
    for (const zone of loadedZones) {
      if (!zones.value.find(z => z.id === zone.id)) {
        zones.value.push(zone);
      }
    }

    // Remove zones that no longer exist in Firestore
    zones.value = zones.value.filter(zone => {
      return widgets[zone.id] || zone.id.startsWith('zone_');
    });

    console.log(`Loaded ${zones.value.length} zones from Firestore`);
  } catch (error) {
    console.error('Error loading zones from Firestore:', error);
  }
}

// Function to enable/disable rectangle drawing mode
function setRectangleDrawingMode(enabled: boolean) {
  isDrawingRectangle.value = enabled;
  if (!enabled) {
    drawingRectangle.value = null;
  }
}

// Expose functions for external use
defineExpose({
  createActionButton,
  setRectangleDrawingMode,
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

    // Calculate the target position in viewport coordinates
    // Position entity at 35% from top (instead of 50%) to leave space at bottom for info panel
    const centerX = wrapperWidth / 2;
    const centerY = wrapperHeight * 0.35;

    // Calculate pan to position entity at the target viewport position
    const newPanX = centerX - x * targetScale;
    const newPanY = centerY - y * targetScale;

    // Update local state immediately
    scale.value = targetScale;
    panX.value = newPanX;
    panY.value = newPanY;
  },
  zoomToZone: (zone: ZoneData, padding: number = 50) => {
    if (!dashboardWrapperRef.value) return;
    const rect = dashboardWrapperRef.value.getBoundingClientRect();
    const wrapperWidth = rect.width;
    const wrapperHeight = rect.height;

    // Calculate zone center and dimensions with padding
    const zoneCenterX = zone.x + zone.width / 2;
    const zoneCenterY = zone.y + zone.height / 2;
    const zoneWidthWithPadding = zone.width + padding * 2;
    const zoneHeightWithPadding = zone.height + padding * 2;

    // Calculate scale so the zone takes up about 60% of the viewport width and height
    const scaleX = wrapperWidth / 1.67 / zoneWidthWithPadding;
    const scaleY = wrapperHeight / 1.67 / zoneHeightWithPadding;
    const targetScale = Math.min(scaleX, scaleY, maxScale);

    // Calculate pan to center the zone in the viewport
    const centerX = wrapperWidth / 2;
    const centerY = wrapperHeight / 2;
    const newPanX = centerX - zoneCenterX * targetScale;
    const newPanY = centerY - zoneCenterY * targetScale;

    // Enable animation for smooth transition
    isAnimatingZoom.value = true;

    // Update local state immediately
    scale.value = targetScale;
    panX.value = newPanX;
    panY.value = newPanY;

    // Disable animation after transition completes
    setTimeout(() => {
      isAnimatingZoom.value = false;
    }, 400);
  },
  getZoomLevel: () => scale.value || 1,
  addEntity: (entity: EntityData) => {
    if (!placedEntityIds.value.includes(entity.key)) {
      setPlacedEntityIds([...placedEntityIds.value, entity.key]);
    }
  },
  addEntityAtViewportCenter: async (entity: EntityData) => {
    if (!dashboardWrapperRef.value) return Promise.resolve();

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

.drawing-rectangle {
  pointer-events: none;
  position: absolute;
  top: 0;
  left: 0;
}

.dashboard-container.drawing-mode {
  cursor: crosshair;
}
</style>

