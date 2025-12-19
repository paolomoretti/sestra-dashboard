<template>

  <div
    ref="widgetRef"
    class="entity-widget-wrapper"
    :style="widgetStyle"
    @click.stop="entity.isActionButton ? undefined : handleClick"
    @mousedown.stop="entity.isActionButton ? undefined : handleMouseDown"
  >
     <!-- Action Button Style -->
    <div
      v-if="entity.isActionButton"
      class="entity-widget action-button-widget"
      :class="{ selected: isSelected, resizing: isResizing, dragging: isDragging }"
      @touchstart="handleActionButtonTouchStart"
      @touchmove="handleActionButtonTouchMove"
      @touchend="handleActionButtonTouchEnd"
      @contextmenu.prevent.stop="handleActionButtonRightClick"
    >
       <button
        class="action-button"
        :class="{ selected: isSelected }"
        :style="actionButtonStyle"
        @click.stop="handleActionButtonClick"
        @mousedown.stop="handleActionButtonMouseDown"
      >
         <img v-if="iconUrl" :src="iconUrl" class="action-button-icon" draggable="false" /> <span
          v-if="actionButtonLabel"
          class="action-button-label"
          >{{ actionButtonLabel }}</span
        > </button
      > <!-- Resize handles (shown when selected) --> <template v-if="isSelected"
        >
        <div class="resize-handle resize-handle-se" @mousedown.stop="startResize('se', $event)" />

        <div class="resize-handle resize-handle-sw" @mousedown.stop="startResize('sw', $event)" />

        <div class="resize-handle resize-handle-ne" @mousedown.stop="startResize('ne', $event)" />

        <div class="resize-handle resize-handle-nw" @mousedown.stop="startResize('nw', $event)" />
         </template
      >
    </div>
     <!-- Image Widget Style -->
    <div
      v-else-if="entity.isImageWidget"
      class="entity-widget image-widget"
      :class="{ selected: isSelected, resizing: isResizing, dragging: isDragging }"
      @touchstart="handleTouchStart"
      @touchmove="handleTouchMove"
      @touchend="handleTouchEnd"
    >
       <!-- Image --> <img
        v-if="shouldShowImage && imageUrl"
        :src="imageUrl"
        class="image-widget-image"
        :style="imageStyle"
        draggable="false"
        @click.stop="handleIconClick"
        @mousedown.stop="handleIconMouseDown"
        @contextmenu.stop="handleIconRightClick"
      /> <!-- Placeholder when no image or condition not met -->
      <div
        v-else
        class="image-widget-placeholder"
        @click.stop="handleIconClick"
        @mousedown.stop="handleIconMouseDown"
        @contextmenu.stop="handleIconRightClick"
      >
         <span class="placeholder-text">{{ imageUrl ? 'Condition not met' : 'No image' }}</span
        >
      </div>
       <!-- Resize handles (shown when selected) --> <template v-if="isSelected"
        >
        <div class="resize-handle resize-handle-se" @mousedown.stop="startResize('se', $event)" />

        <div class="resize-handle resize-handle-sw" @mousedown.stop="startResize('sw', $event)" />

        <div class="resize-handle resize-handle-ne" @mousedown.stop="startResize('ne', $event)" />

        <div class="resize-handle resize-handle-nw" @mousedown.stop="startResize('nw', $event)" />
         </template
      >
    </div>
     <!-- Regular Entity Widget Style -->
    <div
      v-else
      class="entity-widget"
      :class="{ selected: isSelected, resizing: isResizing, dragging: isDragging }"
      @touchstart="handleTouchStart"
      @touchmove="handleTouchMove"
      @touchend="handleTouchEnd"
    >
       <!-- Icon --> <img
        v-if="iconUrl"
        :src="iconUrl"
        class="entity-icon"
        :style="iconStyle"
        draggable="false"
        @click.stop="handleIconClick"
        @mousedown.stop="handleIconMouseDown"
        @contextmenu.stop="handleIconRightClick"
      /> <!-- State value display (numeric or string) -->
      <div v-if="stateDisplay" class="temperature-display" :style="stateDisplayStyle">
         {{ stateDisplay }}
      </div>
       <!-- Resize handles (shown when selected) --> <template v-if="isSelected"
        >
        <div class="resize-handle resize-handle-se" @mousedown.stop="startResize('se', $event)" />

        <div class="resize-handle resize-handle-sw" @mousedown.stop="startResize('sw', $event)" />

        <div class="resize-handle resize-handle-ne" @mousedown.stop="startResize('ne', $event)" />

        <div class="resize-handle resize-handle-nw" @mousedown.stop="startResize('nw', $event)" />
         </template
      >
    </div>
     <!-- Entity Label - positioned relative to wrapper (only for non-action buttons) -->
    <div
      v-if="!entity.isActionButton"
      v-show="showLabel && !isSelected"
      class="entity-label"
      :style="labelStyle"
      :title="displayLabel"
      @click.stop="handleLabelClick"
      @mousedown.stop="handleLabelMouseDown"
      @contextmenu.stop="handleLabelRightClick"
    >
       <span class="label-text">{{ displayLabel }}</span
      >
    </div>
     <!-- Entity Info Panel - positioned at label location --> <EntityInfoPanel
      v-if="isPanelOpen"
      :entity="entity"
      :is-open="isPanelOpen"
      :scale="scale"
      :display-label="displayLabel"
      @update="(entityId, updates) => emit('update', entityId, updates)"
      @delete="entityId => emit('delete', entityId)"
      @close="isPanelOpen = false"
    /> <!-- Camera Modal --> <CameraModal
      v-if="entity.category === 'camera'"
      :is-open="isCameraModalOpen"
      :entity-id="entity.key"
      :entity-name="displayLabel"
      :video-url="entity.videoUrl"
      :entity-picture="entity.entityPicture"
      @close="isCameraModalOpen = false"
    />
  </div>

</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useLocalStorage } from '../composables/useLocalStorage';
import { useToast } from '../composables/useToast';
import {
  selectedEntity,
  selectedEntityPosition,
  clearSelection,
  type EntityData,
} from '../composables/useEntitySelection';
import { getMDIIconPath, createIconSVG, getIconColor } from '../utils/iconUtils';
import { executeTapAction } from '../utils/actionHandler';
import { useUIStore } from '../stores/ui';
import { useEntitiesStore } from '../stores/entities';
import { haConfig } from '../../config';
import { getApiBaseUrl } from '../utils/haServices';
import EntityInfoPanel from './EntityInfoPanel.vue';
import CameraModal from './CameraModal.vue';

interface Props {
  entity: EntityData;
  scale: number;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  select: [entity: EntityData];
  update: [entityId: string, updates: Partial<EntityData>];
  delete: [entityId: string];
}>();

const widgetRef = ref<HTMLElement>();
const isResizing = ref(false);
const isDragging = ref(false);
const hasDragged = ref(false);
const hasDraggedFromLabel = ref(false);
const isPanelOpen = ref(false);
const isCameraModalOpen = ref(false);

// Position in diagram coordinates (not screen coordinates)
const initialPos = parsePosition(props.entity.loc);
const [x, setX] = useLocalStorage<number>(`entity_${props.entity.key}_x`, initialPos.x);
const [y, setY] = useLocalStorage<number>(`entity_${props.entity.key}_y`, initialPos.y);

// Drag state (offset stored in window temporarily during drag)

// Size (from entity.size or defaults)
const parsedSize = computed(() => parseSize(props.entity.size));
const [width, setWidth] = useLocalStorage<number>(
  `entity_${props.entity.key}_width`,
  parsedSize.value.width ?? 60
);
const [height, setHeight] = useLocalStorage<number>(
  `entity_${props.entity.key}_height`,
  parsedSize.value.height ?? 80
);

// Icon URL
const iconUrl = computed(() => {
  // For cameras, use entity_picture if available
  if (props.entity.category === 'camera' && props.entity.entityPicture) {
    // entity_picture might be relative (e.g., /api/camera_proxy/...) or absolute
    let pictureUrl = props.entity.entityPicture;
    if (pictureUrl.startsWith('/')) {
      // Relative URL - prepend Home Assistant base URL
      pictureUrl = `${haConfig.address}${pictureUrl}`;
    }
    return pictureUrl;
  }

  // For other entities, use the MDI icon
  const iconName = props.entity.icon ?? 'circle-outline';
  const path = getMDIIconPath(iconName);
  if (!path) return null;

  const color = getIconColor(
    props.entity.key,
    props.entity.state,
    props.entity.iconColorOn,
    props.entity.iconColorOff
  );
  const iconSize = Math.max(24, Math.min(width.value, height.value) * 0.6);
  return createIconSVG(path, color, iconSize);
});

// Styles
const isSelected = computed(() => selectedEntity.value?.key === props.entity.key);

// Watch for selection changes to toggle panel
watch(isSelected, newVal => {
  isPanelOpen.value = newVal;
});

const widgetStyle = computed(() => {
  // Position is in diagram coordinates, no transform needed here
  // The dashboard container will apply the transform
  // Determine z-index: dragging > panel open > selected > normal
  // When panel is open, widget needs high z-index to be above other widgets
  let zIndex = 1;
  if (isDragging.value) {
    zIndex = 20002; // Highest priority when dragging (above everything)
  } else if (isPanelOpen.value) {
    zIndex = 20000; // High priority when panel is open (ensures widget is above other widgets)
  } else if (isSelected.value) {
    zIndex = 20000; // Very high priority when selected (below dragging, above everything else)
  }

  return {
    width: `${width.value}px`,
    height: `${height.value}px`,
    position: 'absolute' as const,
    left: `${x.value}px`,
    top: `${y.value}px`,
    cursor: isSelected.value ? 'move' : 'pointer',
    zIndex,
  };
});
const iconStyle = computed(() => ({
  width: '100%',
  height: '100%',
  objectFit: 'contain' as const,
}));

// Image widget properties
const imageUrl = computed(() => props.entity.imageUrl || '');
const imageStyle = computed(() => ({
  width: '100%',
  height: '100%',
  objectFit: 'cover' as const,
}));

// Get linked entity state for condition checking
const entitiesStore = useEntitiesStore();
const linkedEntityState = computed(() => {
  if (!props.entity.linkedEntityId) return null;
  const linkedEntity = entitiesStore.allEntities.find(e => e.key === props.entity.linkedEntityId);
  return linkedEntity?.state || null;
});

// Image condition settings (stored per entity) - only read values, setters are in panel
const imageConditionOperatorKey = `ha_dashboard_image_condition_operator_${props.entity.key}`;
const imageConditionValueKey = `ha_dashboard_image_condition_value_${props.entity.key}`;
const [imageConditionOperator] = useLocalStorage<string>(
  imageConditionOperatorKey,
  props.entity.imageConditionOperator || ''
);
const [imageConditionValue] = useLocalStorage<string | null>(
  imageConditionValueKey,
  props.entity.imageConditionValue !== undefined && props.entity.imageConditionValue !== null
    ? String(props.entity.imageConditionValue)
    : null
);

// Check if image condition is met
const shouldShowImage = computed(() => {
  // If no image URL, don't show
  if (!imageUrl.value || imageUrl.value.trim() === '') {
    return false;
  }

  // If no condition is set, always show if image URL exists
  if (!imageConditionOperator.value || imageConditionValue.value === null) {
    return true;
  }

  // If no linked entity, don't show
  if (!props.entity.linkedEntityId || !linkedEntityState.value) {
    return false;
  }

  const state = linkedEntityState.value.trim();
  if (!state || state === 'unknown' || state === 'unavailable') {
    return false;
  }

  // Check if condition value is numeric
  const conditionValue = imageConditionValue.value;

  // Try to parse condition value as number
  const numConditionValue = Number.parseFloat(String(conditionValue));
  const isNumericCondition = !isNaN(numConditionValue);

  if (isNumericCondition) {
    // Numeric comparison
    const numericValue = parseNumericState(state);
    if (numericValue === null) return false;

    const threshold = numConditionValue;

    switch (imageConditionOperator.value) {
      case 'equal':
        return Math.abs(numericValue - threshold) < 0.001;
      case 'greater':
        return numericValue > threshold;
      case 'lower':
        return numericValue < threshold;
      case 'greaterEqual':
        return numericValue >= threshold;
      case 'lowerEqual':
        return numericValue <= threshold;
      default:
        return true;
    }
  } else {
    // String comparison
    const conditionState = String(conditionValue).trim().toLowerCase();
    const entityState = state.toLowerCase();

    switch (imageConditionOperator.value) {
      case 'equal':
        return entityState === conditionState;
      case 'notEqual':
        return entityState !== conditionState;
      default:
        return true;
    }
  }
});

// Helper to compute scale factor for label scaling (using square root for gradual scaling)
const labelScaleFactor = computed(() => {
  const scale = uiScale.value ?? props.scale ?? 1;
  // Clamp scale to prevent division by zero or extreme values
  // Minimum scale of 0.1 to prevent labels from becoming too large
  const clampedScale = Math.max(0.1, scale);
  // Use square root for more gradual scaling - labels will scale but not as dramatically
  return Math.sqrt(clampedScale);
});

// Label style - scales inversely with zoom to stay readable
const labelStyle = computed(() => {
  const scaleFactor = labelScaleFactor.value;
  // Base font-size is 1.5rem
  // At scale 0.5: fontSize = 1.5 / sqrt(0.5) ≈ 2.12rem (instead of 3rem linear)
  // At scale 2: fontSize = 1.5 / sqrt(2) ≈ 1.06rem (instead of 0.75rem linear)
  const fontSize = 1.5 / scaleFactor;
  // Also scale padding and other dimensions proportionally
  const padding = `${4 / scaleFactor}px ${8 / scaleFactor}px`;
  const marginTop = `${4 / scaleFactor}px`;
  const borderRadius = `${3 / scaleFactor}px`;
  const maxWidth = `${250 / scaleFactor}px`;

  return {
    fontSize: `${fontSize}rem`,
    padding,
    marginTop,
    borderRadius,
    maxWidth,
  };
});

// State display style (temperature, humidity, power, etc.) - scales with zoom
const stateDisplayStyle = computed(() => {
  const scaleFactor = labelScaleFactor.value;
  // Base font-size is 2rem
  const fontSize = 2 / scaleFactor;
  // Scale padding and other dimensions proportionally
  const padding = `${6 / scaleFactor}px ${12 / scaleFactor}px`;
  const borderRadius = `${8 / scaleFactor}px`;
  const marginLeft = `${8 / scaleFactor}px`;

  return {
    fontSize: `${fontSize}rem`,
    padding,
    borderRadius,
    marginLeft,
  };
});

// Action button style - scales entire button with zoom using transform
const actionButtonStyle = computed(() => {
  const scaleFactor = labelScaleFactor.value;
  // Scale the entire button inversely to zoom (when zoomed out, button gets bigger)
  // scaleFactor is sqrt(zoom), so we scale by 1/scaleFactor
  const scale = 1 / scaleFactor;

  return {
    transform: `scale(${scale})`,
    transformOrigin: 'center center',
  };
});

// Temperature display for temperature sensors
const isTemperatureSensor = computed(() => {
  const deviceClass = props.entity.deviceClass?.toLowerCase();
  const iconName = props.entity.icon?.toLowerCase() ?? '';
  const entityId = props.entity.key?.toLowerCase() ?? '';

  return (
    deviceClass === 'temperature' ||
    iconName.includes('thermometer') ||
    iconName.includes('temperature') ||
    entityId.includes('temperature') ||
    entityId.includes('thermometer')
  );
});

// Unified state display (numeric or string) that uses prefix/suffix when available
const stateDisplay = computed(() => {
  // Check if state visibility is enabled
  if (!widgetStateVisible.value) {
    return null;
  }

  if (!props.entity.state) {
    return null;
  }

  const state = props.entity.state.trim();
  if (!state || state === 'unknown' || state === 'unavailable') {
    return null;
  }

  // Check if state is numeric
  const numericValue = parseNumericState(props.entity.state);
  const isNumeric = numericValue !== null;

  // For numeric states, check condition before displaying
  if (isNumeric && !stateConditionMet.value) {
    return null;
  }

  // Handle numeric states with formatting
  if (isNumeric) {
    // If custom prefix/suffix are set, use them
    const customPrefix = props.entity.valuePrefix;
    const customSuffix = props.entity.valueSuffix;

    if (customPrefix !== undefined || customSuffix !== undefined) {
      const prefix = customPrefix || '';
      const suffix = customSuffix || '';
      // Determine decimal places based on value
      const decimals = Math.abs(numericValue) < 1 ? 2 : Math.abs(numericValue) < 10 ? 1 : 0;
      return `${prefix}${numericValue.toFixed(decimals)}${suffix}`;
    }

    // Otherwise, use type-specific defaults
    if (isTemperatureSensor.value) {
      // Temperature display
      const tempMatch = state.match(/^(-?\d+\.?\d*)\s*°?([CF])?/i);
      if (!tempMatch?.[1]) {
        // If no match, try to parse just the number
        const numMatch = state.match(/^(-?\d+\.?\d*)/);
        if (numMatch?.[1]) {
          const value = parseFloat(numMatch[1]);
          if (!isNaN(value)) {
            // Infer unit: if > 50, likely Fahrenheit, else Celsius
            const unit = value > 50 ? 'F' : 'C';
            return `${value.toFixed(1)}°${unit}`;
          }
        }
        return null;
      }

      const value = parseFloat(tempMatch[1]);
      if (isNaN(value)) {
        return null;
      }

      // Get unit from match or infer
      const matchedUnit = tempMatch[2];
      let unit = matchedUnit ? matchedUnit.toUpperCase() : null;
      if (!unit) {
        // Infer unit: if > 50, likely Fahrenheit, else Celsius
        unit = value > 50 ? 'F' : 'C';
      }

      return `${value.toFixed(1)}°${unit}`;
    }

    if (isHumiditySensor.value) {
      // Humidity display
      const humidityMatch = state.match(/^(\d+\.?\d*)\s*%?/);
      if (!humidityMatch?.[1]) {
        return null;
      }

      const value = parseFloat(humidityMatch[1]);
      if (isNaN(value)) {
        return null;
      }

      // Clamp value between 0 and 100
      const clampedValue = Math.max(0, Math.min(100, value));

      return `${clampedValue.toFixed(0)}%`;
    }

    if (isPowerSensor.value) {
      // Power display
      const powerMatch = state.match(/^(-?\d+\.?\d*)\s*W?/i);
      if (!powerMatch?.[1]) {
        return null;
      }

      const value = parseFloat(powerMatch[1]);
      if (isNaN(value)) {
        return null;
      }

      // Display with W unit
      return `${value.toFixed(1)}W`;
    }

    // Generic numeric display (no prefix/suffix, no type-specific formatting)
    const decimals = Math.abs(numericValue) < 1 ? 2 : Math.abs(numericValue) < 10 ? 1 : 0;
    return numericValue.toFixed(decimals);
  }

  // For non-numeric states, display as string
  return state;
});

// Humidity sensor detection
const isHumiditySensor = computed(() => {
  const deviceClass = props.entity.deviceClass?.toLowerCase();
  const iconName = props.entity.icon?.toLowerCase() ?? '';
  const entityId = props.entity.key?.toLowerCase() ?? '';

  return (
    deviceClass === 'humidity' ||
    iconName.includes('water-percent') ||
    iconName.includes('humidity') ||
    entityId.includes('humidity')
  );
});

// Power sensor detection
const isPowerSensor = computed(() => {
  const deviceClass = props.entity.deviceClass?.toLowerCase();
  const iconName = props.entity.icon?.toLowerCase() ?? '';
  const entityId = props.entity.key?.toLowerCase() ?? '';

  return (
    deviceClass === 'power' ||
    iconName.includes('power') ||
    iconName.includes('lightning') ||
    iconName.includes('bolt') ||
    iconName.includes('watt') ||
    entityId.includes('power') ||
    entityId.includes('energy') ||
    entityId.includes('watt')
  );
});

// Resize
let resizeStartDiagramX = 0;
let resizeStartDiagramY = 0;
let resizeStartWidth = 0;
let resizeStartHeight = 0;
let resizeStartEntityX = 0;
let resizeStartEntityY = 0;
let resizeDirection: 'se' | 'sw' | 'ne' | 'nw' | null = null;

function startResize(direction: 'se' | 'sw' | 'ne' | 'nw', e: MouseEvent) {
  e.preventDefault();
  e.stopPropagation();
  isResizing.value = true;
  resizeDirection = direction;

  // Get dashboard wrapper for coordinate conversion
  const dashboardWrapper = document.querySelector('.dashboard-wrapper') as HTMLElement;
  if (!dashboardWrapper) return;

  const wrapperRect = dashboardWrapper.getBoundingClientRect();

  // Get current pan and scale
  const panX = parseFloat(localStorage.getItem('ha_dashboard_pan_x') ?? '0');
  const panY = parseFloat(localStorage.getItem('ha_dashboard_pan_y') ?? '0');
  const scale = props.scale ?? 1;

  // Convert mouse position to diagram coordinates
  const mouseX = e.clientX - wrapperRect.left;
  const mouseY = e.clientY - wrapperRect.top;
  resizeStartDiagramX = (mouseX - panX) / scale;
  resizeStartDiagramY = (mouseY - panY) / scale;

  // Store initial size and position
  resizeStartWidth = width.value;
  resizeStartHeight = height.value;
  resizeStartEntityX = x.value;
  resizeStartEntityY = y.value;

  document.addEventListener('mousemove', handleResizeMove);
  document.addEventListener('mouseup', handleResizeEnd);
}

function handleResizeMove(e: MouseEvent) {
  if (!isResizing.value || !resizeDirection) return;

  // Get dashboard wrapper for coordinate conversion
  const dashboardWrapper = document.querySelector('.dashboard-wrapper') as HTMLElement;
  if (!dashboardWrapper) return;

  const wrapperRect = dashboardWrapper.getBoundingClientRect();

  // Get current pan and scale
  const panX = parseFloat(localStorage.getItem('ha_dashboard_pan_x') ?? '0');
  const panY = parseFloat(localStorage.getItem('ha_dashboard_pan_y') ?? '0');
  const scale = props.scale ?? 1;

  // Convert current mouse position to diagram coordinates
  const mouseX = e.clientX - wrapperRect.left;
  const mouseY = e.clientY - wrapperRect.top;
  const currentDiagramX = (mouseX - panX) / scale;
  const currentDiagramY = (mouseY - panY) / scale;

  // Calculate delta in diagram coordinates
  const deltaX = currentDiagramX - resizeStartDiagramX;
  const deltaY = currentDiagramY - resizeStartDiagramY;

  let newWidth = resizeStartWidth;
  let newHeight = resizeStartHeight;
  let newX = resizeStartEntityX;
  let newY = resizeStartEntityY;

  const minSize = 40;
  const maxSize = 1000;

  switch (resizeDirection) {
    case 'se':
      // South-east: adjust width and height, position stays the same (top-left corner fixed)
      newWidth = Math.max(minSize, Math.min(maxSize, resizeStartWidth + deltaX));
      newHeight = Math.max(minSize, Math.min(maxSize, resizeStartHeight + deltaY));
      break;
    case 'sw':
      // South-west: adjust width (left) and height, position X adjusts, Y stays
      newWidth = Math.max(minSize, Math.min(maxSize, resizeStartWidth - deltaX));
      newHeight = Math.max(minSize, Math.min(maxSize, resizeStartHeight + deltaY));
      newX = resizeStartEntityX + (resizeStartWidth - newWidth);
      break;
    case 'ne':
      // North-east: adjust width and height (top), position Y adjusts, X stays
      newWidth = Math.max(minSize, Math.min(maxSize, resizeStartWidth + deltaX));
      newHeight = Math.max(minSize, Math.min(maxSize, resizeStartHeight - deltaY));
      newY = resizeStartEntityY + (resizeStartHeight - newHeight);
      break;
    case 'nw':
      // North-west: adjust width (left) and height (top), position adjusts both
      newWidth = Math.max(minSize, Math.min(maxSize, resizeStartWidth - deltaX));
      newHeight = Math.max(minSize, Math.min(maxSize, resizeStartHeight - deltaY));
      newX = resizeStartEntityX + (resizeStartWidth - newWidth);
      newY = resizeStartEntityY + (resizeStartHeight - newHeight);
      break;
  }

  setWidth(newWidth);
  setHeight(newHeight);
  setX(newX);
  setY(newY);
}

function handleResizeEnd() {
  isResizing.value = false;
  resizeDirection = null;
  document.removeEventListener('mousemove', handleResizeMove);
  document.removeEventListener('mouseup', handleResizeEnd);

  // Save size
  const newSize = `${width.value} ${height.value}`;
  emit('update', props.entity.key, { size: newSize });
  saveSize();
}

// Labels visibility
const uiStore = useUIStore();
const { labelsVisible, scale: uiScale } = storeToRefs(uiStore);

// Widget-specific label visibility (from Firestore, default to true)
const widgetLabelVisible = computed(() => {
  return props.entity.labelVisible !== undefined ? props.entity.labelVisible : true;
});

// Widget-specific state visibility (from Firestore)
// Defaults to false for binary states (on/off) since icon color already indicates state
// Defaults to true for other states
const widgetStateVisible = computed(() => {
  // If explicitly set, use that value
  if (props.entity.stateVisible !== undefined) {
    return props.entity.stateVisible;
  }
  // Default to false for binary states (on/off)
  const state = props.entity.state?.toLowerCase().trim();
  if (state === 'on' || state === 'off') {
    return false;
  }
  // Default to true for other states
  return true;
});

// Combined label visibility: show only when both global AND widget are true
const showLabel = computed(() => labelsVisible.value && widgetLabelVisible.value);

// Display label: use override if set, otherwise use entity name
const displayLabel = computed(() => {
  if (props.entity.labelOverride !== undefined && props.entity.labelOverride !== '') {
    return props.entity.labelOverride;
  }
  return props.entity.name || props.entity.key;
});

// Check if this is a Ring camera
const isRingCamera = computed(() => {
  if (props.entity.category !== 'camera') return false;
  const entityIdLower = props.entity.key.toLowerCase();
  return entityIdLower.includes('ring') || entityIdLower.includes('doorbell');
});

// Action button label: show label if set, hide if explicitly empty string
const actionButtonLabel = computed(() => {
  if (!props.entity.isActionButton) return '';

  // If labelOverride is explicitly set (including empty string), use it
  if (props.entity.labelOverride !== undefined) {
    // If it's empty string, return empty (label won't show)
    // If it has a value, return that value
    return props.entity.labelOverride;
  }

  // If labelOverride is not set (undefined), show entity name as fallback
  return props.entity.name || props.entity.key;
});

// State condition settings (stored per entity) - only read values, setters are in panel
const stateConditionOperatorKey = `ha_dashboard_state_condition_operator_${props.entity.key}`;
const stateConditionValueKey = `ha_dashboard_state_condition_value_${props.entity.key}`;
const [stateConditionOperator] = useLocalStorage<string>(stateConditionOperatorKey, '');
const [stateConditionValue] = useLocalStorage<number | null>(stateConditionValueKey, null);

// Parse numeric value from state (handles temperature, humidity, power, etc.)
function parseNumericState(state: string | undefined): number | null {
  if (!state) return null;
  const trimmedState = state.trim();
  if (!trimmedState || trimmedState === 'unknown' || trimmedState === 'unavailable') return null;

  // Try to extract numeric value (handles "21.5°C", "45%", "120W", etc.)
  const numericMatch = trimmedState.match(/^(-?\d+\.?\d*)/);
  if (!numericMatch?.[1]) return null;

  const value = parseFloat(numericMatch[1]);
  return isNaN(value) ? null : value;
}

// Check if state condition is met
const stateConditionMet = computed(() => {
  if (!stateConditionOperator.value || stateConditionValue.value === null) {
    return true; // No condition set, always show
  }

  const numericValue = parseNumericState(props.entity.state);
  if (numericValue === null) return false;

  const threshold = stateConditionValue.value;

  switch (stateConditionOperator.value) {
    case 'equal':
      return Math.abs(numericValue - threshold) < 0.001; // Use small epsilon for float comparison
    case 'greater':
      return numericValue > threshold;
    case 'lower':
      return numericValue < threshold;
    case 'greaterEqual':
      return numericValue >= threshold;
    case 'lowerEqual':
      return numericValue <= threshold;
    default:
      return true;
  }
});

// Click handlers
function handleClick() {
  // Don't handle click if we just finished dragging
  if (hasDragged.value) {
    hasDragged.value = false;
    return;
  }
  emit('select', props.entity);
  // Toggle panel - if open, close it; if closed, open it
  isPanelOpen.value = !isPanelOpen.value;
  // Zoom to entity position
  if (window.zoomToEntity) {
    window.zoomToEntity(x.value + width.value / 2, y.value + height.value / 2);
  }
}

async function handleIconClick(e: MouseEvent) {
  // Prevent event from bubbling to widget wrapper
  e.stopPropagation();

  // Don't handle click if we just finished dragging
  if (hasDragged.value) {
    hasDragged.value = false;
    return;
  }

  // For all cameras, open modal (Ring cameras will have recording support)
  if (props.entity.category === 'camera') {
    isCameraModalOpen.value = true;
    return;
  }

  // For action buttons, execute HA action if set
  if (props.entity.isActionButton && props.entity.haAction?.service) {
    const service = props.entity.haAction.service;
    const [domain, serviceName] = service.split('.');
    if (domain && serviceName) {
      try {
        // Use proxy in dev, direct URL in production
        const apiBaseUrl = getApiBaseUrl(haConfig);
        const url = `${apiBaseUrl}/services/${domain}/${serviceName}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${haConfig.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(props.entity.haAction.serviceData || {}),
        });
        if (!response.ok) {
          throw new Error(`Failed to call service: ${response.statusText}`);
        }
        // Show success toast
        const { success } = useToast();
        success(`Action executed: ${serviceName}`);
      } catch (error) {
        console.error('Error executing HA action:', error);
        // Show error toast
        const { error: showError } = useToast();
        showError(`Failed to execute action: ${serviceName}`);
      }
    }
    return;
  }

  // Execute tap action if exists
  if (props.entity.tapAction?.action) {
    try {
      await executeTapAction(props.entity.tapAction, props.entity, haConfig);
      // Show success toast
      const { success } = useToast();
      const actionName =
        props.entity.tapAction.action === 'toggle'
          ? 'Toggled'
          : props.entity.tapAction.action === 'navigate'
            ? 'Navigated'
            : 'Action executed';
      success(`${actionName}: ${displayLabel.value}`);

      // Still zoom to entity after action (but don't select)
      if (window.zoomToEntity) {
        window.zoomToEntity(x.value + width.value / 2, y.value + height.value / 2);
      }
    } catch (error) {
      console.error('Error executing tap action:', error);
      const { error: showError } = useToast();
      showError(`Failed to execute action: ${(error as Error).message}`);
    }
    // Don't select when there's a tap action - just execute it
    return;
  }

  // Otherwise, select entity, open panel, and zoom
  emit('select', props.entity);
  isPanelOpen.value = true;
  if (window.zoomToEntity) {
    window.zoomToEntity(x.value + width.value / 2, y.value + height.value / 2);
  }
}

// Handle mousedown on icon - allows dragging from anywhere
function handleIconMouseDown(e: MouseEvent) {
  // Don't start long press on right-click
  if (e.button === 2) {
    handleMouseDown(e);
    return;
  }

  // Start long press timer for icon
  iconLongPressStarted = false;
  iconLongPressTimer = setTimeout(() => {
    // Long press detected - execute hold action if exists
    if (props.entity.holdAction?.action && !hasDragged.value) {
      iconLongPressStarted = true;
      void executeLongPressAction();
    }
  }, LONG_PRESS_DURATION);

  // Always allow dragging from icon
  // If user drags, hasDragged will be set and click handler won't fire
  // If user just clicks, hasDragged will be false and click handler will execute
  handleMouseDown(e);
}

// Execute long press action
async function executeLongPressAction() {
  if (!props.entity.holdAction?.action) return;

  // Cancel any pending click actions
  hasDragged.value = true;

  // Stop dragging
  isDragging.value = false;
  // Clear any global drag state
  delete (window as any).__entityDragOffsetX;
  delete (window as any).__entityDragOffsetY;
  delete (window as any).__entityDragStartPos;
  delete (window as any).__entityDragStartTarget;

  try {
    // Execute the hold action
    await executeTapAction(props.entity.holdAction, props.entity, haConfig);

    // Show success toast
    const { success } = useToast();
    const actionName =
      props.entity.holdAction.action === 'toggle'
        ? 'Toggled'
        : props.entity.holdAction.action === 'navigate'
          ? 'Navigated'
          : 'Action executed';
    success(`${actionName} (long press): ${displayLabel.value}`);
  } catch (error) {
    console.error('Error executing long press action:', error);
    const { error: showError } = useToast();
    showError(`Failed to execute action: ${(error as Error).message}`);
  }

  // Zoom to entity position
  if (window.zoomToEntity) {
    window.zoomToEntity(x.value + width.value / 2, y.value + height.value / 2);
  }
}

// Handle right-click on icon - always show info panel
function handleIconRightClick(e: MouseEvent) {
  // Prevent default browser context menu
  e.preventDefault();
  e.stopPropagation();

  // Always select the entity and open the panel, regardless of any conditions
  emit('select', props.entity);
  isPanelOpen.value = true;

  // Zoom to entity position (center of widget)
  if (window.zoomToEntity) {
    window.zoomToEntity(x.value + width.value / 2, y.value + height.value / 2);
  }
}

// Action button handlers
let longPressTimer: ReturnType<typeof setTimeout> | null = null;
const LONG_PRESS_DURATION = 500; // ms

// Long press detection for icon (mouse events)
let iconLongPressTimer: ReturnType<typeof setTimeout> | null = null;
let iconLongPressStarted = false;

// Handle action button click - execute action
async function handleActionButtonClick(e: MouseEvent) {
  e.stopPropagation();

  // Don't execute if we just finished dragging
  if (hasDragged.value) {
    hasDragged.value = false;
    return;
  }

  // Don't execute if widget is selected - allow dragging/resizing instead
  if (isSelected.value) {
    return;
  }

  // Execute HA action if set
  if (props.entity.haAction?.service) {
    const service = props.entity.haAction.service;
    const [domain, serviceName] = service.split('.');
    if (domain && serviceName) {
      try {
        const apiBaseUrl = getApiBaseUrl(haConfig);
        const url = `${apiBaseUrl}/services/${domain}/${serviceName}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${haConfig.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(props.entity.haAction.serviceData || {}),
        });
        if (!response.ok) {
          throw new Error(`Failed to call service: ${response.statusText}`);
        }
        // Show success toast
        const { success } = useToast();
        success(`Action executed: ${serviceName}`);
      } catch (error) {
        console.error('Error executing HA action:', error);
        // Show error toast
        const { error: showError } = useToast();
        showError(`Failed to execute action: ${serviceName}`);
      }
    }
  }
}

// Handle action button right-click - open panel
function handleActionButtonRightClick(e: MouseEvent) {
  e.preventDefault();
  e.stopPropagation();

  // Always select the entity and open the panel
  emit('select', props.entity);
  isPanelOpen.value = true;

  // Zoom to entity position
  if (window.zoomToEntity) {
    window.zoomToEntity(x.value + width.value / 2, y.value + height.value / 2);
  }
}

// Handle action button mouse down - allow dragging from anywhere
function handleActionButtonMouseDown(e: MouseEvent) {
  // Don't drag on right-click
  if (e.button === 2) {
    return;
  }

  // Always allow dragging from action button
  // If user drags, hasDragged will be set and click handler won't fire
  // If user just clicks, hasDragged will be false and click handler will execute action
  handleMouseDown(e);
}

// Touch handlers for action buttons (with long-press detection)
let actionButtonTouchStartTime = 0;
let actionButtonTouchMoved = false;

function handleActionButtonTouchStart(e: TouchEvent) {
  // Only handle single touch
  if (e.touches.length !== 1) return;

  const touch = e.touches[0];
  if (!touch) return;
  const target = touch.target as HTMLElement;

  // Don't drag if clicking on resize handle
  if (target.classList.contains('resize-handle')) {
    return;
  }

  actionButtonTouchStartTime = Date.now();
  actionButtonTouchMoved = false;

  // Store touch start position for movement detection
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;

  // Start long-press timer
  longPressTimer = setTimeout(() => {
    // Long press detected - open panel
    handleActionButtonRightClick(
      new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    );
  }, LONG_PRESS_DURATION);

  // If selected, allow dragging (use regular touch handlers)
  if (isSelected.value) {
    e.preventDefault();
    e.stopPropagation();
    handleTouchStart(e);
  }
  // If not selected, don't prevent default - let click events fire
}

function handleActionButtonTouchMove(e: TouchEvent) {
  if (e.touches.length !== 1) return;

  const touch = e.touches[0];
  if (!touch) return;

  // Calculate movement distance
  const dx = Math.abs(touch.clientX - touchStartX);
  const dy = Math.abs(touch.clientY - touchStartY);
  const moved = dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD;

  // If we've moved, cancel long-press and allow dragging
  if (moved && !actionButtonTouchMoved) {
    actionButtonTouchMoved = true;
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }

    // If selected, start dragging
    if (isSelected.value) {
      e.preventDefault();
      e.stopPropagation();
      if (!isDragging.value) {
        handleTouchStart(e);
      }
    }
  }

  // If selected and dragging, continue with drag
  if (isSelected.value && isDragging.value) {
    handleTouchMove(e);
  }
}

async function handleActionButtonTouchEnd(e: TouchEvent) {
  // Clear long-press timer
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }

  // If we were dragging, handle it
  if (isDragging.value) {
    handleTouchEnd(e);
    actionButtonTouchMoved = false;
    return;
  }

  // Check if it was a tap (not a drag)
  const touchEndTime = Date.now();
  const timeDiff = touchEndTime - actionButtonTouchStartTime;
  const dx = Math.abs((e.changedTouches[0]?.clientX ?? 0) - touchStartX);
  const dy = Math.abs((e.changedTouches[0]?.clientY ?? 0) - touchStartY);
  const moved = dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD;
  const wasQuickTap = timeDiff < TAP_TIME_THRESHOLD && !moved && !actionButtonTouchMoved;

  // If it was a quick tap, execute action
  if (wasQuickTap) {
    if (!isSelected.value && props.entity.haAction?.service) {
      const service = props.entity.haAction.service;
      const [domain, serviceName] = service.split('.');
      if (domain && serviceName) {
        try {
          const apiBaseUrl = getApiBaseUrl(haConfig);
          const url = `${apiBaseUrl}/services/${domain}/${serviceName}`;
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${haConfig.accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(props.entity.haAction.serviceData || {}),
          });
          if (!response.ok) {
            throw new Error(`Failed to call service: ${response.statusText}`);
          }
          // Show success toast
          const { success } = useToast();
          success(`Action executed: ${serviceName}`);
        } catch (error) {
          console.error('Error executing HA action:', error);
          // Show error toast
          const { error: showError } = useToast();
          showError(`Failed to execute action: ${serviceName}`);
        }
      }
    }
  }

  actionButtonTouchMoved = false;
}

// Handle mousedown on label - allows dragging from label
function handleLabelMouseDown(e: MouseEvent) {
  // Always allow dragging from label
  // If user drags, hasDraggedFromLabel will be set and click handler won't fire
  // If user just clicks, hasDraggedFromLabel will be false and click handler will execute
  handleMouseDown(e);
}

function handleLabelClick() {
  // Don't handle click if we just finished dragging
  if (hasDragged.value) {
    hasDragged.value = false;
    return;
  }
  // Select the entity and toggle panel
  emit('select', props.entity);
  // Toggle panel - if open, close it; if closed, open it
  isPanelOpen.value = !isPanelOpen.value;
  // Zoom to entity position (center of widget)
  if (window.zoomToEntity) {
    window.zoomToEntity(x.value + width.value / 2, y.value + height.value / 2);
  }
}

// Handle right-click on label - always show info panel
function handleLabelRightClick(e: MouseEvent) {
  // Prevent default browser context menu
  e.preventDefault();
  e.stopPropagation();

  // Always select the entity and open the panel (don't toggle, always open)
  emit('select', props.entity);
  isPanelOpen.value = true;

  // Zoom to entity position (center of widget)
  if (window.zoomToEntity) {
    window.zoomToEntity(x.value + width.value / 2, y.value + height.value / 2);
  }
}

// Persistence
function savePosition() {
  const positions = JSON.parse(localStorage.getItem('ha_dashboard_positions') ?? '{}');
  positions[props.entity.key] = `${x.value} ${y.value}`;
  localStorage.setItem('ha_dashboard_positions', JSON.stringify(positions));
}

function saveSize() {
  const sizes = JSON.parse(localStorage.getItem('ha_dashboard_sizes') ?? '{}');
  sizes[props.entity.key] = `${width.value} ${height.value}`;
  localStorage.setItem('ha_dashboard_sizes', JSON.stringify(sizes));
}

// Drag handling
function handleMouseDown(e: MouseEvent) {
  // Don't drag on right-click (button 2) - allow context menu handlers to work
  if (e.button === 2) {
    return;
  }

  // Don't drag if clicking on resize handle
  const target = e.target as HTMLElement;
  if (target.classList.contains('resize-handle')) {
    return;
  }

  // Store initial mouse position to detect if it's a drag or click
  const startX = e.clientX;
  const startY = e.clientY;
  (window as any).__entityDragStartPos = { x: startX, y: startY };

  // Check if clicking on label - store target for drag detection
  const clickedOnLabel = target.closest('.entity-label') !== null;
  if (clickedOnLabel) {
    hasDraggedFromLabel.value = false;
    (window as any).__entityDragStartTarget = target;
  } else {
    // Not from label, clear flag
    hasDraggedFromLabel.value = false;
    delete (window as any).__entityDragStartTarget;
  }

  // Don't prevent default yet - wait to see if it's a drag
  // This allows click events to fire if user doesn't drag
  e.stopPropagation();

  isDragging.value = false; // Start as false, only set to true if we detect movement
  hasDragged.value = false;

  // Store initial position for offset calculation (will be calculated when drag starts)
  // We'll calculate offset in handleMouseMove after we confirm it's a drag

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
}

function handleMouseMove(e: MouseEvent) {
  const dragStartPos = (window as any).__entityDragStartPos;
  if (!dragStartPos) return;

  // Check if mouse moved enough to consider it a drag (threshold: 5px)
  const dx = Math.abs(e.clientX - dragStartPos.x);
  const dy = Math.abs(e.clientY - dragStartPos.y);
  const moved = dx > 5 || dy > 5;

  // Only start dragging if we've moved enough
  if (!isDragging.value) {
    if (!moved) {
      // Haven't moved enough yet, don't start dragging
      return;
    }
    // Moved enough - start dragging
    isDragging.value = true;
    // Cancel long press timer if we're dragging
    if (iconLongPressTimer) {
      clearTimeout(iconLongPressTimer);
      iconLongPressTimer = null;
      iconLongPressStarted = false;
    }
    // Now prevent default to stop text selection, etc.
    e.preventDefault();
  }

  const dashboardWrapper = document.querySelector('.dashboard-wrapper') as HTMLElement;
  if (!dashboardWrapper) return;

  const wrapperRect = dashboardWrapper.getBoundingClientRect();

  // Get current pan and scale
  const panX = parseFloat(localStorage.getItem('ha_dashboard_pan_x') ?? '0');
  const panY = parseFloat(localStorage.getItem('ha_dashboard_pan_y') ?? '0');
  const scale = props.scale ?? 1;

  // Current mouse position in wrapper coordinates
  const currentMouseX = e.clientX - wrapperRect.left;
  const currentMouseY = e.clientY - wrapperRect.top;

  // Convert mouse position to diagram coordinates
  const diagramMouseX = (currentMouseX - panX) / scale;
  const diagramMouseY = (currentMouseY - panY) / scale;

  // Get stored offset (only set after we start dragging)
  let offsetX = (window as any).__entityDragOffsetX;
  let offsetY = (window as any).__entityDragOffsetY;

  // If offset not set yet, calculate it now
  if (offsetX === undefined || offsetY === undefined) {
    const entityX = x.value;
    const entityY = y.value;
    offsetX = diagramMouseX - entityX;
    offsetY = diagramMouseY - entityY;
    (window as any).__entityDragOffsetX = offsetX;
    (window as any).__entityDragOffsetY = offsetY;
  }

  // Calculate new entity position (mouse position minus offset)
  const newX = diagramMouseX - offsetX;
  const newY = diagramMouseY - offsetY;

  // Update position in diagram coordinates
  setX(newX);
  setY(newY);

  // Mark that we've dragged (so click handler knows not to fire)
  hasDragged.value = true;

  // Mark if we dragged from label - check if drag started from label
  const startTarget = (window as any).__entityDragStartTarget;
  if (startTarget?.closest('.entity-label')) {
    hasDraggedFromLabel.value = true;
  }

  // Update selectedEntityPosition if this entity is selected (so panel follows during drag)
  if (isSelected.value && selectedEntity.value?.key === props.entity.key) {
    selectedEntityPosition.value = { x: newX, y: newY };
  }
}

function handleMouseUp() {
  // Clean up event listeners
  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('mouseup', handleMouseUp);
  document.removeEventListener('touchmove', handleTouchMove);
  document.removeEventListener('touchend', handleTouchEnd);

  // Clear long press timer if it's still running
  if (iconLongPressTimer) {
    clearTimeout(iconLongPressTimer);
    iconLongPressTimer = null;
  }

  // If long press was executed, prevent click action
  if (iconLongPressStarted) {
    iconLongPressStarted = false;
    hasDragged.value = true; // Prevent click handler from firing
  }

  if (isDragging.value) {
    // We were dragging - save position
    isDragging.value = false;

    // Clean up offset and drag start info
    delete (window as any).__entityDragOffsetX;
    delete (window as any).__entityDragOffsetY;
    delete (window as any).__entityDragStartPos;
    delete (window as any).__entityDragStartTarget;

    // Save position
    const newLoc = `${x.value} ${y.value}`;
    emit('update', props.entity.key, { loc: newLoc });
    savePosition();

    // Keep hasDragged true if we actually dragged, so click handlers can check it
    // Click handlers will reset it after checking
  } else {
    // We weren't dragging - reset hasDragged so click handlers can fire
    // (unless long press was executed)
    if (!iconLongPressStarted) {
      hasDragged.value = false;
    }
    // Clean up
    delete (window as any).__entityDragOffsetX;
    delete (window as any).__entityDragOffsetY;
    delete (window as any).__entityDragStartPos;
    delete (window as any).__entityDragStartTarget;
  }
}

// Touch handlers for mobile widget dragging
let touchStartTime = 0;
let touchStartX = 0;
let touchStartY = 0;
const DRAG_THRESHOLD = 10; // pixels
const TAP_TIME_THRESHOLD = 300; // milliseconds

function handleTouchStart(e: TouchEvent) {
  // Only handle single touch
  if (e.touches.length !== 1) return;

  const touch = e.touches[0];
  if (!touch) return;
  const target = touch.target as HTMLElement;

  // Don't drag if clicking on resize handle
  if (target.classList.contains('resize-handle')) {
    return;
  }

  // Store touch start info for tap detection
  touchStartTime = Date.now();
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;

  // Check if touching label
  const clickedOnLabel = target.closest('.entity-label') !== null;
  if (clickedOnLabel) {
    hasDraggedFromLabel.value = false;
    (window as any).__entityDragStartPos = { x: touch.clientX, y: touch.clientY };
    (window as any).__entityDragStartTarget = target;
  } else {
    hasDraggedFromLabel.value = false;
    delete (window as any).__entityDragStartPos;
    delete (window as any).__entityDragStartTarget;
  }

  // Don't prevent default yet - wait to see if it's a drag or tap
  // Only prevent if we're selected (to allow dragging)
  if (isSelected.value) {
    e.preventDefault();
    e.stopPropagation();
    isDragging.value = true;
    hasDragged.value = false;
  } else {
    // If not selected, don't prevent default - let click events fire
    isDragging.value = false;
    hasDragged.value = false;
  }

  // Only set up drag tracking if we're actually dragging
  if (isDragging.value) {
    // Get dashboard wrapper for coordinate conversion
    const dashboardWrapper = document.querySelector('.dashboard-wrapper') as HTMLElement;
    if (!dashboardWrapper) return;

    const wrapperRect = dashboardWrapper.getBoundingClientRect();

    // Get current pan and scale
    const panX = parseFloat(localStorage.getItem('ha_dashboard_pan_x') ?? '0');
    const panY = parseFloat(localStorage.getItem('ha_dashboard_pan_y') ?? '0');
    const scale = props.scale ?? 1;

    // Touch position in wrapper coordinates
    const touchX = touch.clientX - wrapperRect.left;
    const touchY = touch.clientY - wrapperRect.top;

    // Convert touch position to diagram coordinates
    const diagramTouchX = (touchX - panX) / scale;
    const diagramTouchY = (touchY - panY) / scale;

    // Current entity position in diagram coordinates
    const entityX = x.value;
    const entityY = y.value;

    // Calculate offset from touch point to entity origin
    const offsetX = diagramTouchX - entityX;
    const offsetY = diagramTouchY - entityY;

    // Store offset for later use
    (window as any).__entityDragOffsetX = offsetX;
    (window as any).__entityDragOffsetY = offsetY;

    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
  }
}

function handleTouchMove(e: TouchEvent) {
  if (e.touches.length !== 1) return;

  const touch = e.touches[0];
  if (!touch) return;

  // Calculate movement distance
  const dx = Math.abs(touch.clientX - touchStartX);
  const dy = Math.abs(touch.clientY - touchStartY);
  const moved = dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD;

  // If we moved enough, start dragging
  if (moved && !isDragging.value) {
    isDragging.value = true;
    hasDragged.value = true;
    // Now prevent default to stop scrolling and other behaviors
    e.preventDefault();
    e.stopPropagation();
  }

  // Only handle dragging if we're actually dragging
  if (!isDragging.value) return;

  const dashboardWrapper = document.querySelector('.dashboard-wrapper') as HTMLElement;
  if (!dashboardWrapper) return;

  const wrapperRect = dashboardWrapper.getBoundingClientRect();

  // Get current pan and scale
  const panX = parseFloat(localStorage.getItem('ha_dashboard_pan_x') ?? '0');
  const panY = parseFloat(localStorage.getItem('ha_dashboard_pan_y') ?? '0');
  const scale = props.scale ?? 1;

  // Current touch position in wrapper coordinates
  const currentTouchX = touch.clientX - wrapperRect.left;
  const currentTouchY = touch.clientY - wrapperRect.top;

  // Convert touch position to diagram coordinates
  const diagramTouchX = (currentTouchX - panX) / scale;
  const diagramTouchY = (currentTouchY - panY) / scale;

  // Get stored offset (set it if not already set)
  if (!(window as any).__entityDragOffsetX) {
    const entityX = x.value;
    const entityY = y.value;
    const offsetX = diagramTouchX - entityX;
    const offsetY = diagramTouchY - entityY;
    (window as any).__entityDragOffsetX = offsetX;
    (window as any).__entityDragOffsetY = offsetY;
  }

  const offsetX = (window as any).__entityDragOffsetX ?? 0;
  const offsetY = (window as any).__entityDragOffsetY ?? 0;

  // Calculate new entity position
  const newX = diagramTouchX - offsetX;
  const newY = diagramTouchY - offsetY;

  // Update position in diagram coordinates
  setX(newX);
  setY(newY);

  // Mark if we dragged from label
  const dragStartPos = (window as any).__entityDragStartPos;
  if (dragStartPos) {
    if (dx > 5 || dy > 5) {
      const startTarget = (window as any).__entityDragStartTarget;
      if (startTarget?.closest('.entity-label')) {
        hasDraggedFromLabel.value = true;
      }
    }
  }

  // Update selectedEntityPosition if this entity is selected
  if (isSelected.value && selectedEntity.value?.key === props.entity.key) {
    selectedEntityPosition.value = { x: newX, y: newY };
  }
}

function handleTouchEnd(e: TouchEvent) {
  // Remove document listeners
  document.removeEventListener('touchmove', handleTouchMove);
  document.removeEventListener('touchend', handleTouchEnd);

  const touchEndTime = Date.now();
  const timeDiff = touchEndTime - touchStartTime;
  const dx = Math.abs((e.changedTouches[0]?.clientX ?? 0) - touchStartX);
  const dy = Math.abs((e.changedTouches[0]?.clientY ?? 0) - touchStartY);
  const moved = dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD;
  const wasQuickTap = timeDiff < TAP_TIME_THRESHOLD && !moved;

  if (isDragging.value) {
    // We were dragging - save position
    isDragging.value = false;

    // Clean up offset and drag start info
    delete (window as any).__entityDragOffsetX;
    delete (window as any).__entityDragOffsetY;
    delete (window as any).__entityDragStartPos;
    delete (window as any).__entityDragStartTarget;

    // Save position
    const newLoc = `${x.value} ${y.value}`;
    emit('update', props.entity.key, { loc: newLoc });
    savePosition();
  } else if (wasQuickTap) {
    // It was a tap, not a drag - trigger click behavior
    const target = e.changedTouches[0]?.target as HTMLElement;
    if (!target) return;

    // Check if we tapped on the label
    const clickedOnLabel = target.closest('.entity-label') !== null;
    if (clickedOnLabel) {
      // Trigger label click
      handleLabelClick();
      return;
    }

    // Check if we tapped on the icon
    const clickedOnIcon =
      target.closest('.entity-icon') !== null || target.closest('.action-button-icon') !== null;
    if (clickedOnIcon) {
      // Trigger icon click
      void handleIconClick(e as any);
      return;
    }

    // Otherwise, trigger widget click (for action buttons)
    if (props.entity.isActionButton) {
      void handleActionButtonClick(e as any);
    } else {
      // For regular widgets, select them
      emit('select', props.entity);
    }
  }

  // Clean up
  hasDragged.value = false;
  hasDraggedFromLabel.value = false;
}

// Watch for entity updates
watch(
  () => props.entity.loc,
  newLoc => {
    if (newLoc) {
      const pos = parsePosition(newLoc);
      setX(pos.x);
      setY(pos.y);
    }
  },
  { immediate: true }
);

watch(
  () => props.entity.size,
  newSize => {
    if (newSize) {
      const size = parseSize(newSize);
      if (size.width !== undefined) setWidth(size.width);
      if (size.height !== undefined) setHeight(size.height);
    }
  },
  { immediate: true }
);

// Watch for icon changes
watch(
  () => props.entity.icon,
  () => {
    // Icon URL computed will automatically update
  }
);

// Click outside detection
onMounted(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Delete key is now handled in Dashboard.vue
    if (e.key === 'Escape') {
      if (isPanelOpen.value) {
        isPanelOpen.value = false;
      }
      // Clear selection on Escape
      clearSelection();
    }
  };

  const handleClickOutside = (e: MouseEvent) => {
    // Don't close if clicking on the panel or widget
    const target = e.target as HTMLElement;
    if (!target) return;

    // Don't close if clicking on select options (they're rendered outside the panel)
    if (target.tagName === 'OPTION' || target.closest('select')) {
      return;
    }

    // Don't close if clicking on the widget, panel, or label
    if (
      widgetRef.value?.contains(target) ||
      target.closest('.entity-info-panel') ||
      target.closest('.entity-label')
    ) {
      return;
    }

    // Close panel if clicking outside
    if (isPanelOpen.value) {
      isPanelOpen.value = false;
    }
  };

  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('click', handleClickOutside);
  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('click', handleClickOutside);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  });
});

// Helpers
function parsePosition(loc?: string): { x: number; y: number } {
  if (!loc) return { x: 0, y: 0 };
  const parts = loc.split(' ');
  const posX = parts[0] ? Number.parseFloat(parts[0]) : 0;
  const posY = parts[1] ? Number.parseFloat(parts[1]) : 0;
  return { x: Number.isNaN(posX) ? 0 : posX, y: Number.isNaN(posY) ? 0 : posY };
}

function parseSize(size?: string | null): { width?: number; height?: number } {
  if (!size) return {};
  const parts = size.split(' ');
  const w = parts[0] ? Number.parseFloat(parts[0]) : Number.NaN;
  const h = parts[1] ? Number.parseFloat(parts[1]) : Number.NaN;
  const result: { width?: number; height?: number } = {};
  if (!Number.isNaN(w)) result.width = w;
  if (!Number.isNaN(h)) result.height = h;
  return result;
}
</script>

<style scoped>
.entity-widget-wrapper {
  position: absolute;
  overflow: visible;
  /* z-index is set dynamically via inline styles */
}

.entity-widget {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid transparent;
  border-radius: 4px;
  transition: border-color 0.2s;
  user-select: none;
  touch-action: none;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
}

.entity-widget.dragging {
  cursor: grabbing !important;
  /* z-index is handled by the wrapper */
}

.entity-widget:hover {
  border-color: rgba(255, 255, 255, 0.3);
}

.entity-widget.selected {
  border-color: #2196f3;
  box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.3);
}

.entity-widget.resizing {
  border-color: #4caf50;
}

/* Action Button Widget Styles */
.action-button-widget {
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-button {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  background: linear-gradient(135deg, #2d5aa0 0%, #1e3f73 100%);
  border: 2px solid #3a6bc0;
  border-radius: 8px;
  color: #ffffff;
  cursor: pointer;
  transition: all 0.2s ease;
  padding: 8px 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  outline: none;
  font-family: inherit;
}

.action-button:hover {
  background: linear-gradient(135deg, #3a6bc0 0%, #2d5aa0 100%);
  border-color: #4a7bc0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  transform: translateY(-1px);
}

.action-button:active {
  transform: translateY(0);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.action-button.selected {
  border-color: #FFC107;
  box-shadow: 0 0 0 2px rgba(255, 193, 7, 0.3);
}

.action-button-icon {
  width: 24px;
  height: 24px;
  object-fit: contain;
  filter: brightness(0) invert(1); /* Make icon white */
  flex-shrink: 0;
}

.action-button-label {
  font-size: 16px;
  font-weight: 600;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  line-height: 1.3;
  min-width: 0;
}

/* Image Widget Styles */
.image-widget {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(42, 42, 42, 0.5);
  border-radius: 4px;
  overflow: hidden;
}

.image-widget-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: auto;
}

.image-widget-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(42, 42, 42, 0.8);
  border: 2px dashed #4a4a4a;
  border-radius: 4px;
  pointer-events: auto;
}

.placeholder-text {
  color: #888;
  font-size: 0.875rem;
  text-align: center;
  padding: 8px;
}

.entity-icon {
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: auto;
}

.temperature-display {
  position: absolute;
  left: 100%;
  top: 50%;
  transform: translateY(-50%);
  font-size: 2rem;
  color: #ffffff;
  background: linear-gradient(135deg, rgba(33, 150, 243, 0.95) 0%, rgba(21, 101, 192, 0.95) 100%);
  padding: 6px 12px;
  border-radius: 8px;
  white-space: nowrap;
  pointer-events: none;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1);
  margin-left: 8px;
  letter-spacing: 0.5px;
}

.resize-handle {
  position: absolute;
  width: 12px;
  height: 12px;
  background: #2196f3;
  border: 2px solid #fff;
  border-radius: 50%;
  cursor: nwse-resize;
  z-index: 10;
}

@media (max-width: 768px) {
  .resize-handle {
    width: 20px;
    height: 20px;
    border-width: 3px;
  }
  
  .resize-handle-se {
    bottom: -10px;
    right: -10px;
  }
  
  .resize-handle-sw {
    bottom: -10px;
    left: -10px;
  }
  
  .resize-handle-ne {
    top: -10px;
    right: -10px;
  }
  
  .resize-handle-nw {
    top: -10px;
    left: -10px;
  }
}

.resize-handle-se {
  bottom: -6px;
  right: -6px;
  cursor: nwse-resize;
}

.resize-handle-sw {
  bottom: -6px;
  left: -6px;
  cursor: nesw-resize;
}

.resize-handle-ne {
  top: -6px;
  right: -6px;
  cursor: nesw-resize;
}

.resize-handle-nw {
  top: -6px;
  left: -6px;
  cursor: nwse-resize;
}

.entity-label {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: 4px;
  pointer-events: auto;
  background-color: rgba(42, 42, 42, 0.9);
  border: 1px solid #4a4a4a;
  border-radius: 3px;
  padding: 4px 8px;
  cursor: pointer;
  transition: background-color 0.1s ease, border-color 0.1s ease;
  white-space: nowrap;
  font-size: 1.5rem;
  color: #ffffff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  max-width: 250px;
  overflow: hidden;
  text-overflow: ellipsis;
  z-index: 10;
}

.entity-label:hover {
  background-color: rgba(51, 51, 51, 0.95);
  border-color: #5a5a5a;
}

.label-text {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>

