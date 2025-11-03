<template>

  <div
    ref="widgetRef"
    class="entity-widget-wrapper"
    :style="widgetStyle"
    @click.stop="handleClick"
    @mousedown.stop="handleMouseDown"
  >

    <div
      class="entity-widget"
      :class="{ selected: isSelected, resizing: isResizing, dragging: isDragging }"
      @touchstart.prevent.stop="handleTouchStart"
      @touchmove.prevent.stop="handleTouchMove"
      @touchend.prevent.stop="handleTouchEnd"
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
      /> <!-- Temperature display for temperature sensors -->
      <div v-if="temperatureDisplay" class="temperature-display"> {{ temperatureDisplay }} </div>
       <!-- Humidity display for humidity sensors -->
      <div v-if="humidityDisplay" class="temperature-display"> {{ humidityDisplay }} </div>
       <!-- Resize handles (shown when selected) --> <template v-if="isSelected"
        >
        <div class="resize-handle resize-handle-se" @mousedown.stop="startResize('se', $event)" />

        <div class="resize-handle resize-handle-sw" @mousedown.stop="startResize('sw', $event)" />

        <div class="resize-handle resize-handle-ne" @mousedown.stop="startResize('ne', $event)" />

        <div class="resize-handle resize-handle-nw" @mousedown.stop="startResize('nw', $event)" />
         </template
      >
    </div>
     <!-- Entity Label - positioned relative to wrapper -->
    <div
      v-show="showLabel && !isSelected && !isPanelOpen"
      class="entity-label"
      :title="entity.name || entity.key"
      @click.stop="handleLabelClick"
      @contextmenu.stop="handleLabelRightClick"
    >
       <span class="label-text">{{ entity.name || entity.key }}</span
      >
    </div>
     <!-- Entity Info Panel - positioned at label location -->
    <div
      v-if="isPanelOpen"
      ref="panelRef"
      class="entity-info-panel"
      :class="{ expanded: isExpanded }"
      @mousedown.stop
      @click.stop
    >
       <!-- Label/Header - always visible, clickable to collapse/expand -->
      <div
        class="panel-header"
        :class="{ collapsed: !isExpanded, expanded: isExpanded }"
        @click="toggleExpanded"
      >
         <span class="panel-title">{{ entity.name || 'Unknown Entity' }}</span
        > <span class="expand-indicator" v-if="isExpanded">▲</span>
      </div>
       <!-- Expandable content --> <transition name="expand"
        >
        <div v-if="isExpanded">
           <!-- Divider -->
          <div class="panel-divider"></div>
           <!-- Tabs -->
          <div class="panel-tabs">
             <button
              class="panel-tab"
              :class="{ active: activeTab === 'general' }"
              @click.stop="activeTab = 'general'"
              @mousedown.stop
            >
               General </button
            > <button
              class="panel-tab"
              :class="{ active: activeTab === 'style' }"
              @click.stop="activeTab = 'style'"
              @mousedown.stop
            >
               Style </button
            >
          </div>
           <!-- Entity details -->
          <div class="panel-content">
             <!-- General Tab -->
            <div v-show="activeTab === 'general'" class="tab-content">

              <div class="detail-row">
                 <span class="detail-label">Entity ID:</span> <span
                  class="detail-value entity-id-value"
                  >{{ entity.key || 'N/A' }}</span
                >
              </div>

              <div class="detail-row">
                 <span class="detail-label">State:</span> <span class="detail-value state-value">{{
                  entity.state || 'unknown'
                }}</span
                >
              </div>

              <div class="detail-row">
                 <span class="detail-label">Category:</span> <span class="detail-value">{{
                  entity.category || 'sensor'
                }}</span
                >
              </div>
               <!-- Tap Action -->
              <div class="detail-row">
                 <span class="detail-label">Tap Action:</span> <select
                  :value="currentTapAction"
                  @change="handleTapActionChange"
                  @mousedown.stop
                  @click.stop
                  class="icon-select"
                >

                  <option value="">None</option>

                  <option value="toggle">Toggle</option>

                  <option value="more-info">More Info</option>

                  <option value="navigate">Navigate</option>
                   </select
                >
              </div>
               <!-- Navigation Path (only show if navigate is selected) -->
              <div v-if="currentTapAction === 'navigate'" class="detail-row">
                 <span class="detail-label">Navigation Path:</span> <input
                  type="text"
                  :value="currentNavigationPath"
                  @input="handleNavigationPathChange"
                  @mousedown.stop
                  @click.stop
                  class="text-input"
                  placeholder="/dashboard/living-room"
                />
              </div>
               <!-- Delete Button -->
              <div class="detail-row delete-row">
                 <button
                  @click.stop="handleDelete"
                  @mousedown.stop
                  class="delete-button"
                  title="Delete widget (or press Backspace)"
                >
                   🗑️ Delete Widget </button
                >
              </div>

            </div>
             <!-- Style Tab -->
            <div v-show="activeTab === 'style'" class="tab-content">
               <!-- Label Visibility -->
              <div class="detail-row">
                 <span class="detail-label">Show Label:</span> <label class="toggle-switch"
                  > <input
                    type="checkbox"
                    :checked="widgetLabelVisible"
                    @change="handleLabelVisibilityChange"
                    @mousedown.stop
                    @click.stop
                  /> <span class="toggle-slider"></span> </label
                >
              </div>
               <!-- Icon selection -->
              <div class="detail-row">
                 <span class="detail-label">Icon:</span>
                <div class="icon-selector-wrapper">

                  <div class="icon-search-wrapper">
                     <input
                      type="text"
                      v-model="iconSearchQuery"
                      @mousedown.stop
                      @click.stop
                      @input.stop
                      @keydown="handleIconSearchKeydown"
                      @focus="handleIconSearchFocus"
                      placeholder="Search icons..."
                      class="icon-search-input"
                      ref="iconSearchInputRef"
                    />
                  </div>

                  <div
                    class="icon-dropdown"
                    @mousedown.stop
                    @click.stop
                    @keydown="handleIconDropdownKeydown"
                    @focus="handleIconDropdownFocus"
                    tabindex="0"
                    ref="iconDropdownRef"
                  >
                     <!-- Only show options if debounced search has at least 1 character -->
                    <template v-if="debouncedIconSearchQuery.trim().length > 0"
                      >
                      <div
                        class="icon-option"
                        :class="{
                          'icon-option-selected': currentIcon === '',
                          'icon-option-highlighted': highlightedIndex === 0,
                        }"
                        @click="selectIcon('')"
                        @mouseenter="highlightedIndex = 0"
                      >
                         <span class="icon-option-label">(Use HA default)</span>
                      </div>

                      <div v-if="isLoadingIcons" class="icon-loading"> Loading icons... </div>

                      <div
                        v-for="(icon, index) in filteredIconOptions"
                        :key="icon.value"
                        class="icon-option"
                        :class="{
                          'icon-option-selected': currentIcon === icon.value,
                          'icon-option-highlighted': highlightedIndex === index + 1,
                        }"
                        :ref="
                          el => {
                            if (el) iconOptionRefs[index] = el as HTMLElement;
                          }
                        "
                        @click="selectIcon(icon.value)"
                        @mouseenter="highlightedIndex = index + 1"
                      >
                         <img
                          v-if="getIconPreview(icon.value)"
                          :src="getIconPreview(icon.value) ?? ''"
                          class="icon-preview"
                          alt=""
                        /> <span class="icon-option-label">{{ icon.label }}</span
                        >
                      </div>
                       </template
                    >
                    <div
                      v-if="
                        iconSearchQuery.trim().length > 0 &&
                        debouncedIconSearchQuery.trim().length === 0
                      "
                      class="icon-search-hint"
                    >
                       Searching...
                    </div>

                    <div
                      v-else-if="
                        debouncedIconSearchQuery.trim().length > 0 &&
                        filteredIconOptions.length === 0 &&
                        !isLoadingIcons
                      "
                      class="icon-search-hint"
                    >
                       No icons found
                    </div>

                  </div>

                </div>

              </div>
               <!-- State Condition -->
              <div class="detail-row" v-if="isNumericEntity">
                 <span class="detail-label">Show State If:</span>
                <div class="condition-controls">
                   <select
                    :value="stateConditionOperator"
                    @change="handleStateConditionOperatorChange"
                    @mousedown.stop
                    @click.stop
                    class="icon-select condition-operator"
                  >

                    <option value="">Always</option>

                    <option value="equal">Equal (=)</option>

                    <option value="greater">Greater (>)</option>

                    <option value="lower">Lower (<)</option>

                    <option value="greaterEqual">Greater or Equal (≥)</option>

                    <option value="lowerEqual">Lower or Equal (≤)</option>
                     </select
                  > <input
                    v-if="stateConditionOperator"
                    type="number"
                    step="any"
                    :value="stateConditionValue"
                    @input="handleStateConditionValueChange"
                    @mousedown.stop
                    @click.stop
                    class="text-input condition-value"
                    placeholder="Value"
                  />
                </div>

              </div>

            </div>

          </div>

        </div>
         </transition
      >
    </div>

  </div>

</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { debouncedRef } from '@vueuse/core';
import { storeToRefs } from 'pinia';
import { useLocalStorage } from '../composables/useLocalStorage';
import {
  selectedEntity,
  selectedEntityPosition,
  clearSelection,
  type EntityData,
} from '../composables/useEntitySelection';
import {
  getMDIIconPath,
  createIconSVG,
  getIconColor,
  extractIconFromHA,
  getDefaultIcon,
} from '../utils/iconUtils';
import { executeTapAction, type TapAction } from '../utils/actionHandler';
import { useUIStore } from '../stores/ui';
import { getAllMDIIcons, COMMON_MDI_ICONS } from '../utils/mdiIconList';
import { haConfig } from '../../config';

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
const panelRef = ref<HTMLElement>();
const isResizing = ref(false);
const isDragging = ref(false);
const hasDragged = ref(false);
const hasDraggedFromLabel = ref(false);
const isPanelOpen = ref(false);
const isExpanded = ref(false);
const activeTab = ref<'general' | 'style'>('general');

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
  const iconName = props.entity.icon ?? 'circle-outline';
  const path = getMDIIconPath(iconName);
  if (!path) return null;

  const color = getIconColor(props.entity.key, props.entity.state);
  const iconSize = Math.max(24, Math.min(width.value, height.value) * 0.6);
  return createIconSVG(path, color, iconSize);
});

// Styles
const isSelected = computed(() => selectedEntity.value?.key === props.entity.key);
const widgetStyle = computed(() => {
  // Position is in diagram coordinates, no transform needed here
  // The dashboard container will apply the transform
  // Determine z-index: dragging > selected > normal
  let zIndex = 1;
  if (isDragging.value) {
    zIndex = 1001; // Highest priority when dragging
  } else if (isSelected.value) {
    zIndex = 1000; // High priority when selected
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

const temperatureDisplay = computed(() => {
  if (!isTemperatureSensor.value || !props.entity.state) {
    return null;
  }

  const state = props.entity.state.trim();
  if (!state || state === 'unknown' || state === 'unavailable') {
    return null;
  }

  // Check condition before displaying
  if (!stateConditionMet.value) {
    return null;
  }

  // Try to parse temperature value and unit
  // State might be: "21.5", "21.5°C", "21.5 °C", "70.5°F", etc.
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
});

// Humidity display for humidity sensors
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

const humidityDisplay = computed(() => {
  if (!isHumiditySensor.value || !props.entity.state) {
    return null;
  }

  const state = props.entity.state.trim();
  if (!state || state === 'unknown' || state === 'unavailable') {
    return null;
  }

  // Check condition before displaying
  if (!stateConditionMet.value) {
    return null;
  }

  // Try to parse humidity value (usually just a number, sometimes with %)
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
const { labelsVisible } = storeToRefs(uiStore);

// Widget-specific label visibility (stored per entity)
const widgetLabelsVisibleKey = `ha_dashboard_widget_label_visible_${props.entity.key}`;
const [widgetLabelVisible, setWidgetLabelVisible] = useLocalStorage<boolean>(
  widgetLabelsVisibleKey,
  true
);

// Combined label visibility: show only when both global AND widget are true
const showLabel = computed(() => labelsVisible.value && widgetLabelVisible.value);

// State condition settings (stored per entity)
const stateConditionOperatorKey = `ha_dashboard_state_condition_operator_${props.entity.key}`;
const stateConditionValueKey = `ha_dashboard_state_condition_value_${props.entity.key}`;
const [stateConditionOperator, setStateConditionOperator] = useLocalStorage<string>(
  stateConditionOperatorKey,
  ''
);
const [stateConditionValue, setStateConditionValue] = useLocalStorage<number | null>(
  stateConditionValueKey,
  null
);

// Check if entity has numeric state
const isNumericEntity = computed(() => {
  const state = props.entity.state;
  if (!state) return false;
  const trimmedState = state.trim();
  if (!trimmedState || trimmedState === 'unknown' || trimmedState === 'unavailable') return false;

  // Try to parse as number (handles temperature, humidity, power, etc.)
  const numericMatch = trimmedState.match(/^(-?\d+\.?\d*)/);
  if (!numericMatch?.[1]) return false;
  return !isNaN(parseFloat(numericMatch[1]));
});

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
  // Zoom to entity position
  if (window.zoomToEntity) {
    window.zoomToEntity(x.value + width.value / 2, y.value + height.value / 2);
  }
}

async function handleIconClick(e: MouseEvent) {
  // Prevent event from bubbling to widget wrapper
  e.stopPropagation();

  // If widget is selected, don't execute action - allow dragging instead
  if (isSelected.value) {
    return;
  }

  // Execute tap action if exists
  if (props.entity.tapAction?.action) {
    await executeTapAction(props.entity.tapAction, props.entity, haConfig);
    // Still zoom to entity after action (but don't select)
    if (window.zoomToEntity) {
      window.zoomToEntity(x.value + width.value / 2, y.value + height.value / 2);
    }
    // Don't select when there's a tap action - just execute it
    return;
  }

  // Otherwise, select entity and zoom
  emit('select', props.entity);
  if (window.zoomToEntity) {
    window.zoomToEntity(x.value + width.value / 2, y.value + height.value / 2);
  }
}

// Handle mousedown on icon - allows dragging when selected
function handleIconMouseDown(e: MouseEvent) {
  // If widget is selected, allow dragging from icon
  if (isSelected.value) {
    // Start drag by calling handleMouseDown
    // handleMouseDown will check if icon is selected and allow drag
    handleMouseDown(e);
  }
  // If not selected, let the click handler execute the action (don't start drag)
}

// Handle right-click on icon - always show info panel
function handleIconRightClick(e: MouseEvent) {
  // Prevent default browser context menu
  e.preventDefault();
  e.stopPropagation();

  // Always select the entity and open the panel, regardless of any conditions
  emit('select', props.entity);
  isPanelOpen.value = true;
  isExpanded.value = true;

  // Zoom to entity position (center of widget)
  if (window.zoomToEntity) {
    window.zoomToEntity(x.value + width.value / 2, y.value + height.value / 2);
  }
}

function handleLabelClick() {
  // Don't open panel if we just finished dragging from label
  if (hasDraggedFromLabel.value) {
    hasDraggedFromLabel.value = false;
    return;
  }
  // Select the entity so it can be dragged/resized
  emit('select', props.entity);
  // Open the panel
  isPanelOpen.value = true;
  isExpanded.value = true;
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

  // Always select the entity and open the panel, regardless of any conditions
  emit('select', props.entity);
  isPanelOpen.value = true;
  isExpanded.value = true;

  // Zoom to entity position (center of widget)
  if (window.zoomToEntity) {
    window.zoomToEntity(x.value + width.value / 2, y.value + height.value / 2);
  }
}

function toggleExpanded() {
  isExpanded.value = !isExpanded.value;
}

// Icon options - only load when panel is expanded
const iconSearchQuery = ref('');
// Debounced search query - only updates after 500ms of no typing
const debouncedIconSearchQuery = debouncedRef(iconSearchQuery, 500);
const highlightedIndex = ref(-1);
const iconDropdownRef = ref<HTMLElement>();
const iconSearchInputRef = ref<HTMLInputElement>();
const iconOptionRefs = ref<(HTMLElement | null)[]>([]);

// Icon options - load asynchronously to avoid blocking UI
const iconOptions = ref<typeof COMMON_MDI_ICONS | ReturnType<typeof getAllMDIIcons>>(
  COMMON_MDI_ICONS
);
const isLoadingIcons = ref(false);

// Only compute icon options when panel is expanded, and load asynchronously
watch(isExpanded, expanded => {
  if (expanded && iconOptions.value.length <= COMMON_MDI_ICONS.length) {
    // Start with common icons, then load all asynchronously
    isLoadingIcons.value = true;
    // Use setTimeout to defer to next event loop to avoid blocking UI
    setTimeout(() => {
      try {
        iconOptions.value = getAllMDIIcons();
      } catch (error) {
        console.error('Error loading all icons:', error);
        // Fallback to common icons on error
      } finally {
        isLoadingIcons.value = false;
      }
    }, 0);
  }
});

// Filter icons based on debounced search query
const filteredIconOptions = computed(() => {
  // Only show if debounced search has at least 1 character
  if (debouncedIconSearchQuery.value.trim().length === 0) {
    return [];
  }
  // Don't filter if panel is not expanded
  if (!isExpanded.value || iconOptions.value.length === 0) {
    return [];
  }
  const query = debouncedIconSearchQuery.value.toLowerCase();
  return iconOptions.value.filter(
    icon => icon.label.toLowerCase().includes(query) || icon.value.toLowerCase().includes(query)
  );
});

// Get all visible options for keyboard navigation (includes "Use HA default")
const allVisibleOptions = computed(() => {
  const options: Array<{ value: string; label: string }> = [];
  // Only include options if debounced search has at least 1 character
  if (debouncedIconSearchQuery.value.trim().length > 0 && isExpanded.value) {
    options.push({ value: '', label: '(Use HA default)' });
    options.push(...filteredIconOptions.value);
  }
  return options;
});

// Handle keyboard navigation in icon dropdown
function handleIconDropdownKeydown(e: KeyboardEvent) {
  if (!isExpanded.value) return;

  const options = allVisibleOptions.value;
  const totalOptions = options.length;
  if (totalOptions === 0) return;

  // Initialize highlighted index if not set and user presses Enter
  if (e.key === 'Enter' && highlightedIndex.value < 0 && totalOptions > 0) {
    // If no item is highlighted, select the first one (index 0)
    highlightedIndex.value = 0;
  }

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      highlightedIndex.value =
        highlightedIndex.value < totalOptions - 1 ? highlightedIndex.value + 1 : 0;
      scrollToHighlighted();
      break;
    case 'ArrowUp':
      e.preventDefault();
      highlightedIndex.value =
        highlightedIndex.value <= 0 ? totalOptions - 1 : highlightedIndex.value - 1;
      scrollToHighlighted();
      break;
    case 'Enter':
      e.preventDefault();
      if (highlightedIndex.value >= 0 && highlightedIndex.value < totalOptions) {
        const option = options[highlightedIndex.value];
        if (option) {
          selectIcon(option.value);
        }
      }
      break;
    case 'Escape':
      e.preventDefault();
      isExpanded.value = false;
      isPanelOpen.value = false;
      break;
  }
}

// Scroll to highlighted option
function scrollToHighlighted() {
  void nextTick(() => {
    if (highlightedIndex.value === 0) {
      // Scroll to "Use HA default" option
      const defaultOption = iconDropdownRef.value?.querySelector(
        '.icon-option:first-child'
      ) as HTMLElement;
      defaultOption?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } else if (highlightedIndex.value > 0) {
      // Scroll to filtered icon option (index is 1-based in allVisibleOptions, but 0-based in iconOptionRefs)
      const optionIndex = highlightedIndex.value - 1;
      if (iconOptionRefs.value[optionIndex]) {
        iconOptionRefs.value[optionIndex]?.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth',
        });
      }
    }
  });
}

// Handle keyboard navigation in search input
function handleIconSearchKeydown(e: KeyboardEvent) {
  // If user types ArrowDown/ArrowUp in search, focus dropdown and navigate
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    if (allVisibleOptions.value.length > 0) {
      // Initialize highlighted index when transitioning from search to dropdown
      if (highlightedIndex.value < 0) {
        highlightedIndex.value = e.key === 'ArrowDown' ? 0 : allVisibleOptions.value.length - 1;
      }
      iconDropdownRef.value?.focus();
    }
  }
  // If Escape, close panel
  if (e.key === 'Escape') {
    isExpanded.value = false;
    isPanelOpen.value = false;
  }
}

// Handle focus on search input
function handleIconSearchFocus() {
  // Reset highlighted when focusing search
  highlightedIndex.value = -1;
}

// Handle focus on dropdown
function handleIconDropdownFocus() {
  // Initialize highlighted index to first option when dropdown gets focus
  if (highlightedIndex.value < 0 && allVisibleOptions.value.length > 0) {
    highlightedIndex.value = 0;
  }
}

// Reset highlighted index when search changes
watch(iconSearchQuery, () => {
  highlightedIndex.value = -1;
});

// Get icon preview for display
function getIconPreview(iconName: string): string | null {
  if (!iconName) return null;
  const path = getMDIIconPath(iconName);
  if (!path) return null;
  return createIconSVG(path, '#ffffff', 20);
}

// Current icon value
const currentIcon = computed(() => {
  if (props.entity.icon) {
    return props.entity.icon;
  }
  if (props.entity.category === 'door') {
    return 'door';
  } else if (props.entity.category === 'camera') {
    return 'camera';
  }
  return 'radar';
});

// Current tap action value
const currentTapAction = computed(() => {
  return props.entity.tapAction?.action ?? '';
});

// Current navigation path
const currentNavigationPath = computed(() => {
  return props.entity.tapAction?.navigation_path ?? '';
});

// Handle icon selection
function selectIcon(iconValue: string) {
  handleIconChangeDirect(iconValue);
}

// Handle icon change directly (for new selector)
function handleIconChangeDirect(newIcon: string) {
  if (newIcon === '') {
    // Clear custom icon to use HA default
    const entityInfo = window.allEntities?.find(e => e.entityId === props.entity.key);
    let haIcon = 'radar'; // Default fallback

    if (entityInfo?.state) {
      haIcon =
        extractIconFromHA(entityInfo.state) ??
        getDefaultIcon(entityInfo.domain, entityInfo.state.attributes?.device_class);
    }

    // Update entity - this will trigger reactive update via handleEntityUpdate
    emit('update', props.entity.key, { icon: haIcon });
  } else {
    // Update entity - this will trigger reactive update via handleEntityUpdate
    emit('update', props.entity.key, { icon: newIcon });
  }
}

// Handle tap action change
function handleTapActionChange(event: Event) {
  const target = event.target as HTMLSelectElement;
  const actionType = target.value;

  let tapAction: TapAction | null = null;
  if (
    actionType &&
    (actionType === 'toggle' ||
      actionType === 'more-info' ||
      actionType === 'navigate' ||
      actionType === 'call-service')
  ) {
    tapAction = { action: actionType } as TapAction;
    // If navigate, preserve navigation path if it exists
    if (actionType === 'navigate' && props.entity.tapAction?.navigation_path) {
      tapAction.navigation_path = props.entity.tapAction.navigation_path;
    }
  }

  emit('update', props.entity.key, { tapAction });

  // Save actions to localStorage
  const actions = JSON.parse(localStorage.getItem('ha_dashboard_actions') ?? '{}');
  if (tapAction || props.entity.holdAction) {
    actions[props.entity.key] = {
      tapAction: tapAction ?? null,
      holdAction: props.entity.holdAction ?? null,
    };
  } else {
    delete actions[props.entity.key];
  }
  localStorage.setItem('ha_dashboard_actions', JSON.stringify(actions));
}

// Handle navigation path change
function handleLabelVisibilityChange(event: Event) {
  const target = event.target as HTMLInputElement;
  setWidgetLabelVisible(target.checked);
}

function handleStateConditionOperatorChange(event: Event) {
  const target = event.target as HTMLSelectElement;
  const operator = target.value;
  setStateConditionOperator(operator);

  // Clear value if operator is removed
  if (!operator) {
    setStateConditionValue(null);
  }
}

function handleStateConditionValueChange(event: Event) {
  const target = event.target as HTMLInputElement;
  const value = target.value ? parseFloat(target.value) : null;
  setStateConditionValue(value);
}

function handleNavigationPathChange(event: Event) {
  const target = event.target as HTMLInputElement;
  const path = target.value;

  const tapAction: TapAction = props.entity.tapAction ?? { action: 'navigate' };
  tapAction.navigation_path = path;

  emit('update', props.entity.key, { tapAction });

  // Save actions
  const actions = JSON.parse(localStorage.getItem('ha_dashboard_actions') ?? '{}');
  actions[props.entity.key] = {
    tapAction,
    holdAction: props.entity.holdAction ?? null,
  };
  localStorage.setItem('ha_dashboard_actions', JSON.stringify(actions));
}

// Handle delete button click
function handleDelete() {
  if (confirm('Are you sure you want to delete this widget?')) {
    emit('delete', props.entity.key);
    // Clear selection after deletion
    clearSelection();
    // Close panel
    isPanelOpen.value = false;
    isExpanded.value = false;
  }
}

// Click outside handler
function handleClickOutside(event: MouseEvent) {
  if (isPanelOpen.value && panelRef.value && widgetRef.value) {
    const target = event.target as HTMLElement;
    // Don't close if clicking on select options (they're rendered outside the panel)
    if (target.tagName === 'OPTION' || target.closest('select')) {
      return;
    }
    // Close if clicking outside both panel and widget
    if (!panelRef.value.contains(target) && !widgetRef.value.contains(target)) {
      isPanelOpen.value = false;
      isExpanded.value = false;
    }
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

  // Don't drag if clicking on icon AND widget is not selected
  // (when selected, icon should be draggable)
  if (target.classList.contains('entity-icon') && !isSelected.value) {
    return;
  }

  // Check if clicking on label - store target and position for drag detection
  const clickedOnLabel = target.closest('.entity-label') !== null;
  if (clickedOnLabel) {
    hasDraggedFromLabel.value = false;
    // Store drag start info to detect if it becomes a drag
    (window as any).__entityDragStartPos = { x: e.clientX, y: e.clientY };
    (window as any).__entityDragStartTarget = target;
  } else {
    // Not from label, clear flag
    hasDraggedFromLabel.value = false;
    delete (window as any).__entityDragStartPos;
    delete (window as any).__entityDragStartTarget;
  }

  e.preventDefault();
  e.stopPropagation();

  isDragging.value = true;
  hasDragged.value = false;

  // Get dashboard wrapper for coordinate conversion
  const dashboardWrapper = document.querySelector('.dashboard-wrapper') as HTMLElement;
  if (!dashboardWrapper) return;

  const wrapperRect = dashboardWrapper.getBoundingClientRect();

  // Get current pan and scale
  const panX = parseFloat(localStorage.getItem('ha_dashboard_pan_x') ?? '0');
  const panY = parseFloat(localStorage.getItem('ha_dashboard_pan_y') ?? '0');
  const scale = props.scale ?? 1;

  // Mouse position in wrapper coordinates
  const mouseX = e.clientX - wrapperRect.left;
  const mouseY = e.clientY - wrapperRect.top;

  // Convert mouse position to diagram coordinates
  const diagramMouseX = (mouseX - panX) / scale;
  const diagramMouseY = (mouseY - panY) / scale;

  // Current entity position in diagram coordinates
  const entityX = x.value;
  const entityY = y.value;

  // Calculate offset from click point to entity origin (so dragging feels natural)
  const offsetX = diagramMouseX - entityX;
  const offsetY = diagramMouseY - entityY;

  // Store offset for later use (so entity follows mouse exactly where clicked)
  (window as any).__entityDragOffsetX = offsetX;
  (window as any).__entityDragOffsetY = offsetY;

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
}

function handleMouseMove(e: MouseEvent) {
  if (!isDragging.value) return;

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

  // Get stored offset
  const offsetX = (window as any).__entityDragOffsetX ?? 0;
  const offsetY = (window as any).__entityDragOffsetY ?? 0;

  // Calculate new entity position (mouse position minus offset)
  const newX = diagramMouseX - offsetX;
  const newY = diagramMouseY - offsetY;

  // Update position in diagram coordinates
  setX(newX);
  setY(newY);

  // Mark that we've dragged (so click handler knows not to fire)
  hasDragged.value = true;

  // Mark if we dragged from label - check if drag started from label
  const dragStartPos = (window as any).__entityDragStartPos;
  if (dragStartPos) {
    const dx = Math.abs(e.clientX - dragStartPos.x);
    const dy = Math.abs(e.clientY - dragStartPos.y);
    if (dx > 5 || dy > 5) {
      // Moved more than 5px - it's a drag
      const startTarget = (window as any).__entityDragStartTarget;
      if (startTarget?.closest('.entity-label')) {
        hasDraggedFromLabel.value = true;
      }
    }
  }

  // Update selectedEntityPosition if this entity is selected (so panel follows during drag)
  if (isSelected.value && selectedEntity.value?.key === props.entity.key) {
    selectedEntityPosition.value = { x: newX, y: newY };
  }
}

function handleMouseUp() {
  if (isDragging.value) {
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

    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.removeEventListener('touchmove', handleTouchMove);
    document.removeEventListener('touchend', handleTouchEnd);
  }
}

// Touch handlers for mobile widget dragging
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

  // Don't drag if clicking on icon AND widget is not selected
  if (target.classList.contains('entity-icon') && !isSelected.value) {
    return;
  }

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

  e.preventDefault();
  e.stopPropagation();

  isDragging.value = true;
  hasDragged.value = false;

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

  document.addEventListener('touchmove', handleTouchMove);
  document.addEventListener('touchend', handleTouchEnd);
}

function handleTouchMove(e: TouchEvent) {
  if (!isDragging.value || e.touches.length !== 1) return;

  const touch = e.touches[0];
  if (!touch) return;
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

  // Get stored offset
  const offsetX = (window as any).__entityDragOffsetX ?? 0;
  const offsetY = (window as any).__entityDragOffsetY ?? 0;

  // Calculate new entity position
  const newX = diagramTouchX - offsetX;
  const newY = diagramTouchY - offsetY;

  // Update position in diagram coordinates
  setX(newX);
  setY(newY);

  // Mark that we've dragged
  hasDragged.value = true;

  // Mark if we dragged from label
  const dragStartPos = (window as any).__entityDragStartPos;
  if (dragStartPos) {
    const dx = Math.abs(touch.clientX - dragStartPos.x);
    const dy = Math.abs(touch.clientY - dragStartPos.y);
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

function handleTouchEnd() {
  if (isDragging.value) {
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

    // Remove event listeners
    document.removeEventListener('touchmove', handleTouchMove);
    document.removeEventListener('touchend', handleTouchEnd);
  }
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
        isExpanded.value = false;
      }
      // Clear selection on Escape
      clearSelection();
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

.entity-info-panel {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: 4px;
  min-width: 200px;
  max-width: 400px;
  background-color: #2a2a2a;
  border: 1px solid #4a4a4a;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  z-index: 10000;
  pointer-events: auto;
  overflow: visible;
}

.entity-info-panel.expanded {
  min-width: 280px;
}

.entity-info-panel:not(.expanded) {
  min-width: auto;
  max-width: 200px;
}

.panel-header {
  background-color: #333333;
  padding: 10px 14px;
  border-radius: 4px 4px 0 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: none;
}

.panel-header.collapsed {
  background-color: rgba(42, 42, 42, 0.9);
  padding: 4px 8px;
  border-radius: 3px;
  border: 1px solid #4a4a4a;
  font-size: 11px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.panel-header.collapsed:hover {
  background-color: rgba(51, 51, 51, 0.95);
  border-color: #5a5a5a;
}

.panel-header.expanded {
  border-radius: 4px 4px 0 0;
}

.panel-header.expanded:hover {
  background-color: #3a3a3a;
}

.expand-indicator {
  font-size: 10px;
  color: #aaaaaa;
  flex-shrink: 0;
}

.panel-title {
  margin: 0;
  font-size: 16px;
  font-weight: bold;
  color: #ffffff;
  line-height: 1.4;
  word-wrap: break-word;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.panel-header.collapsed .panel-title {
  font-size: 11px;
  font-weight: normal;
}

.panel-divider {
  height: 1px;
  background-color: #4a4a4a;
  margin: 4px 0;
}

.panel-tabs {
  display: flex;
  border-bottom: 1px solid #4a4a4a;
  margin: 0;
  padding: 0;
}

.panel-tab {
  flex: 1;
  padding: 6px 8px;
  background-color: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: #aaaaaa;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: center;
}

.panel-tab:hover {
  background-color: rgba(255, 255, 255, 0.05);
  color: #ffffff;
}

.panel-tab.active {
  color: #ffffff;
  border-bottom-color: #2d5aa0;
  background-color: rgba(45, 90, 160, 0.1);
}

.tab-content {
  min-height: 50px;
}

.panel-content {
  padding: 8px 14px 10px;
  overflow: visible;
}

.detail-row {
  display: flex;
  margin-bottom: 4px;
  align-items: flex-start;
}

.detail-row:last-child {
  margin-bottom: 0;
}

.delete-row {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #3a3a3a;
}

.delete-button {
  width: 100%;
  background-color: #d32f2f;
  border: 1px solid #b71c1c;
  border-radius: 3px;
  color: #ffffff;
  font-size: 11px;
  padding: 6px 12px;
  cursor: pointer;
  outline: none;
  transition: background-color 0.2s ease;
}

.delete-button:hover {
  background-color: #c62828;
}

.delete-button:active {
  background-color: #b71c1c;
}

.detail-label {
  font-size: 11px;
  color: #aaaaaa;
  min-width: 90px;
  margin-right: 8px;
  flex-shrink: 0;
}

.detail-value {
  font-size: 11px;
  color: #ffffff;
  flex: 1;
  word-break: break-word;
}

.detail-value.state-value {
  font-weight: bold;
  color: #4CAF50;
}

.detail-value.entity-id-value {
  font-family: 'Courier New', Courier, monospace;
  font-size: 10px;
  color: #cccccc;
}

.icon-select {
  flex: 1;
  background-color: #333333;
  border: 1px solid #4a4a4a;
  border-radius: 3px;
  color: #ffffff;
  font-size: 11px;
  padding: 4px 8px;
  cursor: pointer;
  outline: none;
  z-index: 10001;
  position: relative;
}

.icon-select:hover {
  border-color: #5a5a5a;
}

.icon-select:focus {
  border-color: #2196F3;
}

/* Icon selector with search and preview */
.icon-selector-wrapper {
  flex: 1;
  position: relative;
}

.icon-search-wrapper {
  margin-bottom: 6px;
}

.icon-search-input {
  width: 100%;
  background-color: #333333;
  border: 1px solid #4a4a4a;
  border-radius: 3px;
  color: #ffffff;
  font-size: 11px;
  padding: 4px 8px;
  outline: none;
}

.icon-search-input:focus {
  border-color: #2196F3;
}

.icon-dropdown {
  max-height: 200px;
  overflow-y: auto;
  background-color: #2a2a2a;
  border: 1px solid #4a4a4a;
  border-radius: 3px;
  z-index: 10002;
  position: relative;
}

.icon-option {
  display: flex;
  align-items: center;
  padding: 6px 8px;
  cursor: pointer;
  border-bottom: 1px solid #3a3a3a;
  transition: background-color 0.15s;
}

.icon-option:last-child {
  border-bottom: none;
}

.icon-option:hover {
  background-color: #3a3a3a;
}

.icon-option-selected {
  background-color: #2196f3;
}

.icon-option-selected:hover {
  background-color: #2196f3;
}

.icon-option-highlighted {
  background-color: #3a3a3a;
}

.icon-option-highlighted.icon-option-selected {
  background-color: #2196f3;
}

.icon-search-hint {
  padding: 12px;
  text-align: center;
  color: #888888;
  font-size: 11px;
  font-style: italic;
}

.icon-preview {
  width: 20px;
  height: 20px;
  margin-right: 8px;
  flex-shrink: 0;
}

.icon-option-label {
  font-size: 11px;
  color: #ffffff;
  flex: 1;
}

.icon-loading {
  padding: 12px;
  text-align: center;
  color: #888888;
  font-size: 11px;
  font-style: italic;
}

.text-input {
  flex: 1;
  background-color: #333333;
  border: 1px solid #4a4a4a;
  border-radius: 3px;
  color: #ffffff;
  font-size: 11px;
  padding: 4px 8px;
  outline: none;
}

.text-input:hover {
  border-color: #5a5a5a;
}

.text-input:focus {
  border-color: #2196F3;
}

/* Condition controls */
.condition-controls {
  display: flex;
  gap: 8px;
  align-items: center;
  flex: 1;
}

.condition-operator {
  flex: 0 0 auto;
  min-width: 120px;
}

.condition-value {
  flex: 0 0 auto;
  width: 80px;
}

/* Expand/collapse animation */
.expand-enter-active,
.expand-leave-active {
  transition: none;
  overflow: visible;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
}

.expand-enter-to,
.expand-leave-from {
  opacity: 1;
  max-height: 500px;
}

/* Toggle switch for label visibility */
.toggle-switch {
  position: relative;
  display: inline-block;
  width: 36px;
  height: 20px;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #555;
  transition: 0.3s;
  border-radius: 20px;
}

.toggle-slider:before {
  position: absolute;
  content: '';
  height: 14px;
  width: 14px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.3s;
  border-radius: 50%;
}

.toggle-switch input:checked + .toggle-slider {
  background-color: #2d5aa0;
}

.toggle-switch input:checked + .toggle-slider:before {
  transform: translateX(16px);
}

.toggle-switch input:focus + .toggle-slider {
  box-shadow: 0 0 1px #2d5aa0;
}
</style>

