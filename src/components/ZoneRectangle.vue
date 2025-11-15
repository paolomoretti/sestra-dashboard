<template>

  <div
    ref="rectangleRef"
    class="zone-rectangle-wrapper"
    :data-zone-id="zone.id"
    :style="rectangleStyle"
    @click.stop="handleClick"
    @mousedown.stop="handleMouseDown"
    @contextmenu.stop="handleRightClick"
  >
     <!-- Rectangle -->
    <div
      class="zone-rectangle"
      :class="{ selected: isSelected, dragging: isDragging, resizing: isResizing }"
    >
       <!-- Label -->
      <div
        v-if="showLabel"
        class="zone-label"
        :title="zone.label || 'Unnamed Zone'"
        :style="{ pointerEvents: 'auto' }"
        @click.stop="handleLabelClick"
        @mousedown.stop="handleLabelMouseDown"
        @contextmenu.stop="handleLabelRightClick"
      >
         <span class="label-text">{{ zone.label || 'Unnamed Zone' }}</span
        >
      </div>

    </div>
     <!-- Resize handles (shown when selected) --> <template v-if="isSelected"
      >
      <div class="resize-handle resize-handle-se" @mousedown.stop="startResize('se', $event)" />

      <div class="resize-handle resize-handle-sw" @mousedown.stop="startResize('sw', $event)" />

      <div class="resize-handle resize-handle-ne" @mousedown.stop="startResize('ne', $event)" />

      <div class="resize-handle resize-handle-nw" @mousedown.stop="startResize('nw', $event)" />
       </template
    > <!-- Edit Panel -->
    <div
      v-if="isPanelOpen"
      ref="panelRef"
      class="zone-edit-panel"
      :class="{ expanded: isExpanded }"
      @mousedown.stop
      @click.stop
    >
       <!-- Header -->
      <div
        class="panel-header"
        :class="{ collapsed: !isExpanded, expanded: isExpanded }"
        @click="toggleExpanded"
      >
         <span class="panel-title">{{ zone.label || 'Unnamed Zone' }}</span
        > <span class="expand-indicator" v-if="isExpanded">▲</span>
      </div>
       <!-- Expandable content --> <transition name="expand"
        >
        <div v-if="isExpanded">

          <div class="panel-divider"></div>

          <div class="panel-content">
             <!-- Label Input -->
            <div class="detail-row">
               <span class="detail-label">Label:</span> <input
                ref="labelInputRef"
                type="text"
                v-model="labelInput"
                @blur="handleLabelBlur"
                @mousedown.stop
                @click.stop
                class="text-input"
                placeholder="Zone label"
              />
            </div>
             <!-- Lock Toggle -->
            <div class="detail-row">
               <span class="detail-label">Lock Zone:</span> <label class="toggle-switch"
                > <input
                  type="checkbox"
                  :checked="zone.locked ?? false"
                  @change="handleLockChange"
                  @mousedown.stop
                  @click.stop
                /> <span class="toggle-slider"></span> </label
              >
            </div>
             <!-- Shortcut Key -->
            <div class="detail-row">
               <span class="detail-label">Shortcut Key:</span> <input
                type="text"
                :value="zone.shortcutKey || ''"
                @input="handleShortcutKeyChange"
                @mousedown.stop
                @click.stop
                @keydown="handleShortcutKeyKeydown"
                class="text-input"
                placeholder="e.g., 1, 2, a"
                maxlength="1"
              />
            </div>
             <!-- Delete Button -->
            <div class="detail-row delete-row">
               <button
                @click.stop="handleDelete"
                @mousedown.stop
                class="delete-button"
                title="Delete zone (or press Backspace)"
              >
                 🗑️ Delete Zone </button
              >
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
import { clearSelection } from '../composables/useEntitySelection';

export interface ZoneData {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string; // Optional color for the zone
  locked?: boolean; // Whether the zone is locked (cannot be dragged)
  shortcutKey?: string; // Keyboard shortcut key to zoom to this zone (e.g., '1', '2', 'a', etc.)
}

interface Props {
  zone: ZoneData;
  scale: number;
  selected?: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  select: [zone: ZoneData];
  update: [zoneId: string, updates: Partial<ZoneData>];
  delete: [zoneId: string];
}>();

const rectangleRef = ref<HTMLElement>();
const panelRef = ref<HTMLElement>();
const labelInputRef = ref<HTMLInputElement>();
const isSelected = computed(() => props.selected ?? false);
const isDragging = ref(false);
const isResizing = ref(false);
const hasDragged = ref(false);
const isPanelOpen = ref(false);
const isExpanded = ref(false);
const showLabel = ref(true);

// Position and size
const x = ref(props.zone.x);
const y = ref(props.zone.y);
const width = ref(props.zone.width);
const height = ref(props.zone.height);

// Label input
const labelInput = ref(props.zone.label || '');

// Styles
const rectangleStyle = computed(() => {
  // Zones should always be behind widgets (widgets have z-index 1+)
  // Only raise z-index when dragging or panel is open, but still keep it lower than widgets
  let zIndex = -1; // Behind widgets (which are at z-index 1+)
  if (isDragging.value) {
    zIndex = 1000; // Raise when dragging, but still below widgets (20000+)
  } else if (isPanelOpen.value) {
    zIndex = 1000; // Raise when panel open, but still below widgets (20000+)
  } else if (isSelected) {
    zIndex = 0; // Slightly raise when selected, but still below widgets (z-index 1+)
  }

  return {
    width: `${width.value}px`,
    height: `${height.value}px`,
    position: 'absolute' as const,
    left: `${x.value}px`,
    top: `${y.value}px`,
    cursor: isSelected ? 'move' : 'default',
    zIndex,
    // Allow pointer events to pass through when not selected/interacting
    // This ensures widgets behind the zone can be clicked
    pointerEvents:
      isSelected || isDragging.value || isResizing.value ? ('auto' as const) : ('none' as const),
  };
});

// Resize
let resizeStartDiagramX = 0;
let resizeStartDiagramY = 0;
let resizeStartWidth = 0;
let resizeStartHeight = 0;
let resizeStartX = 0;
let resizeStartY = 0;
let resizeDirection: 'se' | 'sw' | 'ne' | 'nw' | null = null;

function startResize(direction: 'se' | 'sw' | 'ne' | 'nw', e: MouseEvent) {
  e.preventDefault();
  e.stopPropagation();
  isResizing.value = true;
  resizeDirection = direction;

  const dashboardWrapper = document.querySelector('.dashboard-wrapper') as HTMLElement;
  if (!dashboardWrapper) return;

  const wrapperRect = dashboardWrapper.getBoundingClientRect();
  const panX = parseFloat(localStorage.getItem('ha_dashboard_pan_x') ?? '0');
  const panY = parseFloat(localStorage.getItem('ha_dashboard_pan_y') ?? '0');
  const scale = props.scale ?? 1;

  const mouseX = e.clientX - wrapperRect.left;
  const mouseY = e.clientY - wrapperRect.top;
  resizeStartDiagramX = (mouseX - panX) / scale;
  resizeStartDiagramY = (mouseY - panY) / scale;

  resizeStartWidth = width.value;
  resizeStartHeight = height.value;
  resizeStartX = x.value;
  resizeStartY = y.value;

  document.addEventListener('mousemove', handleResizeMove);
  document.addEventListener('mouseup', handleResizeEnd);
}

function handleResizeMove(e: MouseEvent) {
  if (!isResizing.value || !resizeDirection) return;

  const dashboardWrapper = document.querySelector('.dashboard-wrapper') as HTMLElement;
  if (!dashboardWrapper) return;

  const wrapperRect = dashboardWrapper.getBoundingClientRect();
  const panX = parseFloat(localStorage.getItem('ha_dashboard_pan_x') ?? '0');
  const panY = parseFloat(localStorage.getItem('ha_dashboard_pan_y') ?? '0');
  const scale = props.scale ?? 1;

  const mouseX = e.clientX - wrapperRect.left;
  const mouseY = e.clientY - wrapperRect.top;
  const currentDiagramX = (mouseX - panX) / scale;
  const currentDiagramY = (mouseY - panY) / scale;

  const deltaX = currentDiagramX - resizeStartDiagramX;
  const deltaY = currentDiagramY - resizeStartDiagramY;

  let newWidth = resizeStartWidth;
  let newHeight = resizeStartHeight;
  let newX = resizeStartX;
  let newY = resizeStartY;

  const minSize = 50;

  switch (resizeDirection) {
    case 'se':
      newWidth = Math.max(minSize, resizeStartWidth + deltaX);
      newHeight = Math.max(minSize, resizeStartHeight + deltaY);
      break;
    case 'sw':
      newWidth = Math.max(minSize, resizeStartWidth - deltaX);
      newHeight = Math.max(minSize, resizeStartHeight + deltaY);
      newX = resizeStartX + (resizeStartWidth - newWidth);
      break;
    case 'ne':
      newWidth = Math.max(minSize, resizeStartWidth + deltaX);
      newHeight = Math.max(minSize, resizeStartHeight - deltaY);
      newY = resizeStartY + (resizeStartHeight - newHeight);
      break;
    case 'nw':
      newWidth = Math.max(minSize, resizeStartWidth - deltaX);
      newHeight = Math.max(minSize, resizeStartHeight - deltaY);
      newX = resizeStartX + (resizeStartWidth - newWidth);
      newY = resizeStartY + (resizeStartHeight - newHeight);
      break;
  }

  width.value = newWidth;
  height.value = newHeight;
  x.value = newX;
  y.value = newY;
}

function handleResizeEnd() {
  isResizing.value = false;
  resizeDirection = null;
  document.removeEventListener('mousemove', handleResizeMove);
  document.removeEventListener('mouseup', handleResizeEnd);

  emit('update', props.zone.id, {
    x: x.value,
    y: y.value,
    width: width.value,
    height: height.value,
  });
}

// Click handlers
function handleClick(e: MouseEvent) {
  // Only handle clicks when the zone is selected or we're explicitly clicking on the zone
  // This prevents blocking widget interactions
  if (hasDragged.value) {
    hasDragged.value = false;
    return;
  }
  // If zone is locked, only allow selection from the label (handled by handleLabelClick)
  if (props.zone.locked) {
    return;
  }
  // Check if click is on the rectangle itself (not a child element)
  if (
    e.target === e.currentTarget ||
    (e.target as HTMLElement).classList.contains('zone-rectangle')
  ) {
    emit('select', props.zone);
  }
}

function handleLabelClick() {
  if (hasDragged.value) {
    hasDragged.value = false;
    return;
  }
  isPanelOpen.value = true;
  isExpanded.value = true;
  emit('select', props.zone);
  // Focus the input after opening
  void nextTick(() => {
    if (labelInputRef.value) {
      labelInputRef.value.focus();
      labelInputRef.value.select();
    }
  });
}

function handleLabelRightClick(e: MouseEvent) {
  e.preventDefault();
  e.stopPropagation();
  isPanelOpen.value = true;
  isExpanded.value = true;
  emit('select', props.zone);
  // Focus the input after opening
  void nextTick(() => {
    if (labelInputRef.value) {
      labelInputRef.value.focus();
      labelInputRef.value.select();
    }
  });
}

// Handle right-click on zone rectangle
function handleRightClick(e: MouseEvent) {
  e.preventDefault();
  e.stopPropagation();
  isPanelOpen.value = true;
  isExpanded.value = true;
  emit('select', props.zone);
}

function toggleExpanded() {
  isExpanded.value = !isExpanded.value;
}

function handleLabelBlur() {
  const newLabel = labelInput.value.trim();
  emit('update', props.zone.id, { label: newLabel || 'Unnamed Zone' });
}

function handleLockChange(event: Event) {
  const target = event.target as HTMLInputElement;
  emit('update', props.zone.id, { locked: target.checked });
}

function handleShortcutKeyChange(event: Event) {
  const target = event.target as HTMLInputElement;
  const key = target.value.trim().toLowerCase();
  // Only allow alphanumeric characters
  if (key === '' || /^[a-z0-9]$/.test(key)) {
    const updates: Partial<ZoneData> = {};
    if (key) {
      updates.shortcutKey = key;
    } else {
      // Explicitly clear shortcutKey by setting it to empty string
      // This will be handled in saveZoneToFirestore to remove it
      updates.shortcutKey = '';
    }
    emit('update', props.zone.id, updates);
  } else {
    // Reset to empty if invalid character
    target.value = props.zone.shortcutKey ?? '';
  }
}

function handleShortcutKeyKeydown(event: KeyboardEvent) {
  // Prevent the key from being entered if it's a special key
  if (event.key.length > 1 && !['Backspace', 'Delete', 'Tab'].includes(event.key)) {
    event.preventDefault();
  }
}

function handleDelete() {
  if (confirm('Are you sure you want to delete this zone?')) {
    emit('delete', props.zone.id);
    clearSelection();
    isPanelOpen.value = false;
    isExpanded.value = false;
  }
}

// Drag handling
function handleMouseDown(e: MouseEvent) {
  if (e.button === 2) return;

  // Don't allow dragging if zone is locked
  if (props.zone.locked) {
    return;
  }

  const target = e.target as HTMLElement;
  if (target.classList.contains('resize-handle')) {
    return;
  }

  const startX = e.clientX;
  const startY = e.clientY;
  (window as any).__zoneDragStartPos = { x: startX, y: startY };

  e.stopPropagation();
  isDragging.value = false;
  hasDragged.value = false;

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
}

function handleMouseMove(e: MouseEvent) {
  const dragStartPos = (window as any).__zoneDragStartPos;
  if (!dragStartPos) return;

  const dx = Math.abs(e.clientX - dragStartPos.x);
  const dy = Math.abs(e.clientY - dragStartPos.y);
  const moved = dx > 5 || dy > 5;

  if (!isDragging.value) {
    if (!moved) return;
    isDragging.value = true;
    e.preventDefault();
  }

  const dashboardWrapper = document.querySelector('.dashboard-wrapper') as HTMLElement;
  if (!dashboardWrapper) return;

  const wrapperRect = dashboardWrapper.getBoundingClientRect();
  const panX = parseFloat(localStorage.getItem('ha_dashboard_pan_x') ?? '0');
  const panY = parseFloat(localStorage.getItem('ha_dashboard_pan_y') ?? '0');
  const scale = props.scale ?? 1;

  const currentMouseX = e.clientX - wrapperRect.left;
  const currentMouseY = e.clientY - wrapperRect.top;
  const diagramMouseX = (currentMouseX - panX) / scale;
  const diagramMouseY = (currentMouseY - panY) / scale;

  let offsetX = (window as any).__zoneDragOffsetX;
  let offsetY = (window as any).__zoneDragOffsetY;

  if (offsetX === undefined || offsetY === undefined) {
    offsetX = diagramMouseX - x.value;
    offsetY = diagramMouseY - y.value;
    (window as any).__zoneDragOffsetX = offsetX;
    (window as any).__zoneDragOffsetY = offsetY;
  }

  const newX = diagramMouseX - offsetX;
  const newY = diagramMouseY - offsetY;

  x.value = newX;
  y.value = newY;
  hasDragged.value = true;
}

function handleMouseUp() {
  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('mouseup', handleMouseUp);

  if (isDragging.value) {
    isDragging.value = false;
    delete (window as any).__zoneDragOffsetX;
    delete (window as any).__zoneDragOffsetY;
    delete (window as any).__zoneDragStartPos;

    emit('update', props.zone.id, {
      x: x.value,
      y: y.value,
    });
  } else {
    hasDragged.value = false;
    delete (window as any).__zoneDragOffsetX;
    delete (window as any).__zoneDragOffsetY;
    delete (window as any).__zoneDragStartPos;
  }
}

function handleLabelMouseDown(e: MouseEvent) {
  handleMouseDown(e);
}

// Watch for selection changes to auto-open panel when zone is selected after creation
watch(
  () => props.selected,
  isSelected => {
    if (isSelected && !isPanelOpen.value) {
      // Auto-open panel when zone becomes selected (e.g., after creation)
      isPanelOpen.value = true;
      isExpanded.value = true;
      // Focus the input after opening
      void nextTick(() => {
        setTimeout(() => {
          if (labelInputRef.value) {
            labelInputRef.value.focus();
            labelInputRef.value.select();
          }
        }, 50);
      });
    }
  }
);

// Watch for external updates
watch(
  () => props.zone.x,
  newX => {
    x.value = newX;
  },
  { immediate: true }
);

watch(
  () => props.zone.y,
  newY => {
    y.value = newY;
  },
  { immediate: true }
);

watch(
  () => props.zone.width,
  newWidth => {
    width.value = newWidth;
  },
  { immediate: true }
);

watch(
  () => props.zone.height,
  newHeight => {
    height.value = newHeight;
  },
  { immediate: true }
);

watch(
  () => props.zone.label,
  newLabel => {
    labelInput.value = newLabel || '';
  },
  { immediate: true }
);

// Click outside detection
function handleClickOutside(event: MouseEvent) {
  if (isPanelOpen.value && panelRef.value && rectangleRef.value) {
    const target = event.target as HTMLElement;
    if (!panelRef.value.contains(target) && !rectangleRef.value.contains(target)) {
      isPanelOpen.value = false;
      isExpanded.value = false;
    }
  }
}

// Keyboard handler
function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (isPanelOpen.value) {
      isPanelOpen.value = false;
      isExpanded.value = false;
    }
    clearSelection();
  }
  // Delete key is now handled in Dashboard.vue to avoid duplicate handlers
  // Only handle it here if the panel is open and this zone is selected
  // (The Dashboard handler will take care of it)
}

onMounted(() => {
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown);
  document.removeEventListener('click', handleClickOutside);
  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('mouseup', handleMouseUp);
});
</script>

<style scoped>
.zone-rectangle-wrapper {
  position: absolute;
  overflow: visible;
}

.zone-rectangle {
  position: relative;
  width: 100%;
  height: 100%;
  border: 2px solid rgba(33, 150, 243, 0.6);
  background-color: rgba(33, 150, 243, 0.1);
  border-radius: 4px;
  transition: border-color 0.2s, background-color 0.2s;
  user-select: none;
  touch-action: none;
  box-sizing: border-box;
  /* Pointer events are controlled by the wrapper's inline style */
  pointer-events: inherit;
}

.zone-rectangle:hover {
  border-color: rgba(33, 150, 243, 0.8);
  background-color: rgba(33, 150, 243, 0.15);
}

.zone-rectangle.selected {
  border-color: #2196f3;
  background-color: rgba(33, 150, 243, 0.2);
  box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.3);
}

.zone-rectangle.dragging {
  cursor: grabbing !important;
}

.zone-rectangle.resizing {
  border-color: #4caf50;
}

.zone-label {
  position: absolute;
  top: 4px;
  left: 4px;
  pointer-events: auto;
  background-color: rgba(42, 42, 42, 0.95);
  border: 1px solid #4a4a4a;
  border-radius: 3px;
  padding: 4px 8px;
  cursor: pointer;
  transition: background-color 0.1s ease, border-color 0.1s ease;
  white-space: nowrap;
  font-size: 12px;
  color: #ffffff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  z-index: 10;
}

.zone-label:hover {
  background-color: rgba(51, 51, 51, 0.95);
  border-color: #5a5a5a;
}

.label-text {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
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
  pointer-events: auto;
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

.zone-edit-panel {
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
  z-index: 20001;
  pointer-events: auto;
  overflow: visible;
}

.zone-edit-panel.expanded {
  min-width: 280px;
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
}

.panel-header.collapsed {
  background-color: rgba(42, 42, 42, 0.9);
  padding: 4px 8px;
  border-radius: 3px;
  border: 1px solid #4a4a4a;
  font-size: 11px;
}

.panel-title {
  margin: 0;
  font-size: 16px;
  font-weight: bold;
  color: #ffffff;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.panel-header.collapsed .panel-title {
  font-size: 11px;
  font-weight: normal;
}

.expand-indicator {
  font-size: 10px;
  color: #aaaaaa;
  flex-shrink: 0;
}

.panel-divider {
  height: 1px;
  background-color: #4a4a4a;
  margin: 4px 0;
}

.panel-content {
  padding: 8px 14px 10px;
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

.detail-label {
  font-size: 11px;
  color: #aaaaaa;
  min-width: 90px;
  margin-right: 8px;
  flex-shrink: 0;
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

/* Toggle switch for lock */
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

