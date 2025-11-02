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
    >
       <!-- Icon --> <img
        v-if="iconUrl"
        :src="iconUrl"
        class="entity-icon"
        :style="iconStyle"
        draggable="false"
        @click.stop="handleIconClick"
      /> <!-- Resize handles (shown when selected) --> <template v-if="isSelected"
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
      v-show="labelsVisible && !isSelected && !isPanelOpen"
      class="entity-label"
      :title="entity.name || entity.key"
      @click.stop="handleLabelClick"
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
           <!-- Entity details -->
          <div class="panel-content">

            <div class="detail-row">
               <span class="detail-label">Entity ID:</span> <span class="detail-value">{{
                entity.key || 'N/A'
              }}</span
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
             <!-- Icon selection -->
            <div class="detail-row">
               <span class="detail-label">Icon:</span> <select
                :value="currentIcon"
                @change="handleIconChange"
                @mousedown.stop
                @click.stop
                class="icon-select"
              >

                <option value="">(Use HA default)</option>

                <option v-for="icon in iconOptions" :key="icon.value" :value="icon.value">
                   {{ icon.label }}
                </option>
                 </select
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

          </div>

        </div>
         </transition
      >
    </div>

  </div>

</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
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
import { changeEntityIcon } from '../utils/entityUtils';
import { ICON_OPTIONS } from '../utils/mdiIconList';
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

  const color = getIconColor(props.entity.key, props.entity.state, iconName);
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

function toggleExpanded() {
  isExpanded.value = !isExpanded.value;
}

// Icon options
const iconOptions = ICON_OPTIONS;

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

// Handle icon change
function handleIconChange(event: Event) {
  const target = event.target as HTMLSelectElement;
  const newIcon = target.value;

  if (newIcon === '') {
    // Clear custom icon to use HA default
    const entityInfo = window.allEntities?.find(e => e.entityId === props.entity.key);
    let haIcon = 'radar'; // Default fallback

    if (entityInfo?.state) {
      haIcon =
        extractIconFromHA(entityInfo.state) ??
        getDefaultIcon(entityInfo.domain, entityInfo.state.attributes?.device_class);
    }

    // Update entity
    emit('update', props.entity.key, { icon: haIcon });

    // Remove from saved icons
    const savedIcons = JSON.parse(localStorage.getItem('ha_dashboard_icons') ?? '{}');
    delete savedIcons[props.entity.key];
    localStorage.setItem('ha_dashboard_icons', JSON.stringify(savedIcons));
  } else {
    changeEntityIcon(props.entity.key, newIcon);
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
  // Don't drag if clicking on resize handle or icon (for tap action)
  const target = e.target as HTMLElement;
  if (target.classList.contains('resize-handle') || target.classList.contains('entity-icon')) {
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
    if (e.key === 'Delete' && isSelected.value) {
      emit('delete', props.entity.key);
    }
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
</style>

