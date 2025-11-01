<template>
  <div
    v-if="selectedEntity"
    ref="panelRef"
    class="entity-info-panel"
    :class="{ 'expanded': isExpanded }"
    :style="panelStyle"
  >
    <!-- Label/Header - always visible, clickable to collapse/expand -->
    <div 
      class="panel-header"
      :class="{ 'collapsed': !isExpanded, 'expanded': isExpanded }"
      @click="toggleExpanded"
    >
      <span class="panel-title">{{ selectedEntity.name || 'Unknown Entity' }}</span>
      <span class="expand-indicator" v-if="isExpanded">▲</span>
    </div>

    <!-- Expandable content -->
    <transition name="expand">
      <div v-if="isExpanded">
        <!-- Divider -->
        <div class="panel-divider"></div>

        <!-- Entity details -->
        <div class="panel-content">
          <div class="detail-row">
            <span class="detail-label">Entity ID:</span>
            <span class="detail-value">{{ selectedEntity.key || 'N/A' }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">State:</span>
            <span class="detail-value state-value">{{ selectedEntity.state || 'unknown' }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Category:</span>
            <span class="detail-value">{{ selectedEntity.category || 'sensor' }}</span>
          </div>
          
          <!-- Icon selection -->
          <div class="detail-row">
            <span class="detail-label">Icon:</span>
            <select 
              :value="currentIcon"
              @change="handleIconChange"
              @click.stop
              class="icon-select"
            >
              <option value="">(Use HA default)</option>
              <option 
                v-for="icon in iconOptions" 
                :key="icon.value" 
                :value="icon.value"
              >
                {{ icon.label }}
              </option>
            </select>
          </div>
          
          <!-- Tap Action -->
          <div class="detail-row">
            <span class="detail-label">Tap Action:</span>
            <select 
              :value="currentTapAction"
              @change="handleTapActionChange"
              @click.stop
              class="icon-select"
            >
              <option value="">None</option>
              <option value="toggle">Toggle</option>
              <option value="more-info">More Info</option>
              <option value="navigate">Navigate</option>
            </select>
          </div>
          
          <!-- Navigation Path (only show if navigate is selected) -->
          <div v-if="currentTapAction === 'navigate'" class="detail-row">
            <span class="detail-label">Navigation Path:</span>
            <input
              type="text"
              :value="currentNavigationPath"
              @input="handleNavigationPathChange"
              @click.stop
              class="text-input"
              placeholder="/dashboard/living-room"
            />
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted, watch } from 'vue';
import * as go from 'gojs';
import { selectedEntity, selectedEntityPosition } from '../composables/useEntitySelection';
import { changeEntityIcon, ICON_OPTIONS } from '../dashboard.js';
import { extractIconFromHA, getDefaultIcon } from '../utils/iconUtils.js';

const panelRef = ref(null);
const viewportUpdateTrigger = ref(0); // Trigger to force position recalculation
const isExpanded = ref(false); // Panel expanded state

// Icon options from dashboard
const iconOptions = ICON_OPTIONS;

// Toggle panel expansion
function toggleExpanded() {
  isExpanded.value = !isExpanded.value;
}

// Watch for entity changes
watch(selectedEntity, (newEntity) => {
  if (newEntity) {
    // Immediately expand when entity is selected (user clicked label)
    isExpanded.value = true;
  } else {
    // Collapse when entity is deselected
    isExpanded.value = false;
  }
}, { immediate: true });

// Current icon value for the selected entity
const currentIcon = computed(() => {
  // Return the icon from entity data, or a default based on category
  if (selectedEntity.value?.icon) {
    return selectedEntity.value.icon;
  }
  // Default icons based on category
  if (selectedEntity.value?.category === 'door') {
    return 'door';
  } else if (selectedEntity.value?.category === 'camera') {
    return 'camera';
  }
  return 'radar'; // Default for sensors
});

// Current tap action value
const currentTapAction = computed(() => {
  return selectedEntity.value?.tapAction?.action || '';
});

// Current navigation path
const currentNavigationPath = computed(() => {
  return selectedEntity.value?.tapAction?.navigation_path || '';
});

// Handle icon change
function handleIconChange(event) {
  const newIcon = event.target.value;
  if (selectedEntity.value && selectedEntity.value.key) {
    if (newIcon === '') {
      // Clear custom icon to use HA default
      const entityId = selectedEntity.value.key;
      // Find the original HA icon from allEntities
      const entityInfo = window.allEntities?.find(e => e.entityId === entityId);
      let haIcon = 'radar'; // Default fallback
      
      if (entityInfo && entityInfo.state) {
        haIcon = extractIconFromHA(entityInfo.state) || 
                 getDefaultIcon(entityInfo.domain, entityInfo.state.attributes?.device_class);
      }
      
      const nodeData = window.diagramInstance?.model?.findNodeDataForKey(entityId);
      if (nodeData) {
        window.diagramInstance.startTransaction('clearIcon');
        window.diagramInstance.model.setDataProperty(nodeData, 'icon', haIcon);
        window.diagramInstance.commitTransaction('clearIcon');
        
        // Remove from saved icons
        const savedIcons = JSON.parse(localStorage.getItem('ha_dashboard_icons') || '{}');
        delete savedIcons[entityId];
        localStorage.setItem('ha_dashboard_icons', JSON.stringify(savedIcons));
        
        // Update the selected entity icon
        selectedEntity.value.icon = haIcon;
      }
    } else {
      changeEntityIcon(selectedEntity.value.key, newIcon);
    }
  }
}

// Handle tap action change
function handleTapActionChange(event) {
  const actionType = event.target.value;
  const entityId = selectedEntity.value?.key;
  if (!entityId || !window.diagramInstance) return;
  
  const nodeData = window.diagramInstance.model.findNodeDataForKey(entityId);
  if (!nodeData) return;
  
  window.diagramInstance.startTransaction('updateTapAction');
  
  if (!actionType || actionType === '') {
    // Remove tap action
    window.diagramInstance.model.setDataProperty(nodeData, 'tapAction', null);
    selectedEntity.value.tapAction = null;
  } else {
    // Set tap action
    const tapAction = { action: actionType };
    
    // If navigate, preserve navigation path if it exists
    if (actionType === 'navigate' && selectedEntity.value?.tapAction?.navigation_path) {
      tapAction.navigation_path = selectedEntity.value.tapAction.navigation_path;
    }
    
    window.diagramInstance.model.setDataProperty(nodeData, 'tapAction', tapAction);
    selectedEntity.value.tapAction = tapAction;
  }
  
  window.diagramInstance.commitTransaction('updateTapAction');
  
  // Save actions to localStorage
  const actions = {};
  window.diagramInstance.nodes.each(node => {
    const data = node.data;
    if (data && data.key && typeof data.key === 'string' && !data.key.toString().startsWith('-')) {
      if (data.tapAction || data.holdAction) {
        actions[data.key] = {
          tapAction: data.tapAction || null,
          holdAction: data.holdAction || null
        };
      }
    }
  });
  localStorage.setItem('ha_dashboard_actions', JSON.stringify(actions));
}

// Handle navigation path change
function handleNavigationPathChange(event) {
  const path = event.target.value;
  const entityId = selectedEntity.value?.key;
  if (!entityId || !window.diagramInstance) return;
  
  const nodeData = window.diagramInstance.model.findNodeDataForKey(entityId);
  if (!nodeData) return;
  
  window.diagramInstance.startTransaction('updateNavigationPath');
  
  const tapAction = nodeData.tapAction || { action: 'navigate' };
  tapAction.navigation_path = path;
  
  window.diagramInstance.model.setDataProperty(nodeData, 'tapAction', tapAction);
  selectedEntity.value.tapAction = tapAction;
  
  window.diagramInstance.commitTransaction('updateNavigationPath');
  
  // Save actions
  const actions = {};
  window.diagramInstance.nodes.each(node => {
    const data = node.data;
    if (data && data.key && typeof data.key === 'string' && !data.key.toString().startsWith('-')) {
      if (data.tapAction || data.holdAction) {
        actions[data.key] = {
          tapAction: data.tapAction || null,
          holdAction: data.holdAction || null
        };
      }
    }
  });
  localStorage.setItem('ha_dashboard_actions', JSON.stringify(actions));
}

/**
 * Convert GoJS diagram coordinates to DOM pixel coordinates
 */
function diagramToDOM(diagram, point) {
  if (!diagram) return { x: 0, y: 0 };
  
  const diagramDiv = document.getElementById('diagramDiv');
  if (!diagramDiv) return { x: 0, y: 0 };

  // Use GoJS's built-in method to convert document point to viewport point
  const viewPoint = diagram.transformDocToView(point);
  
  // Get diagram div position to offset correctly
  const divRect = diagramDiv.getBoundingClientRect();
  
  return {
    x: divRect.left + viewPoint.x,
    y: divRect.top + viewPoint.y
  };
}

/**
 * Get the position of the selected entity in DOM coordinates
 */
const domPosition = computed(() => {
  // Access viewportUpdateTrigger to make this reactive to viewport changes
  void viewportUpdateTrigger.value;
  
  const diagram = window.diagramInstance;
  
  if (!diagram || !selectedEntityPosition.value || !selectedEntity.value) {
    return { x: 0, y: 0 };
  }

  // Use GoJS coordinate conversion
  const diagramPoint = new go.Point(selectedEntityPosition.value.x, selectedEntityPosition.value.y);
  return diagramToDOM(diagram, diagramPoint);
});

/**
 * Panel style with absolute positioning
 */
const panelStyle = computed(() => {
  if (!selectedEntity.value) {
    return { display: 'none' };
  }

  const diagramDiv = document.getElementById('diagramDiv');
  if (!diagramDiv) return { display: 'none' };

  const divRect = diagramDiv.getBoundingClientRect();
  const panelWidth = isExpanded.value ? 320 : 'auto'; // Auto width when collapsed (fits content)
  const offsetY = isExpanded.value ? 20 : 5; // Closer offset when collapsed (matches label position)

  // Position relative to parent container (which has position: relative)
  // domPosition is already in screen coordinates, so we need to convert relative to parent
  const parentContainer = diagramDiv.parentElement;
  if (!parentContainer) return { display: 'none' };
  
  const parentRect = parentContainer.getBoundingClientRect();
  // When collapsed, center based on content; when expanded, center on entity
  const panelWidthPx = typeof panelWidth === 'number' ? panelWidth : 150; // Estimate for collapsed
  const left = domPosition.value.x - parentRect.left - (panelWidthPx / 2);
  const top = domPosition.value.y - parentRect.top + offsetY;

  return {
    position: 'absolute',
    left: `${left}px`,
    top: `${top}px`,
    display: 'block',
    zIndex: 1000,
    pointerEvents: 'auto',
    transition: 'all 0.2s ease',
    width: typeof panelWidth === 'number' ? `${panelWidth}px` : panelWidth
  };
});

// Update viewport trigger periodically when entity is selected (for zoom/pan tracking)
let updateFrame = null;

onMounted(() => {
  function updateViewport() {
    if (selectedEntity.value && window.diagramInstance) {
      // Force reactive update
      viewportUpdateTrigger.value = Date.now();
      updateFrame = requestAnimationFrame(updateViewport);
    } else {
      updateFrame = null;
    }
  }
  
  // Start update loop when entity is selected
  const stopWatcher = () => {
    if (selectedEntity.value) {
      updateFrame = requestAnimationFrame(updateViewport);
    } else if (updateFrame) {
      cancelAnimationFrame(updateFrame);
      updateFrame = null;
    }
  };
  
  // Watch for selection changes
  watch(selectedEntity, stopWatcher, { immediate: true });
});

onUnmounted(() => {
  if (updateFrame) {
    cancelAnimationFrame(updateFrame);
  }
});
</script>

<style scoped>
.entity-info-panel {
  min-width: 200px;
  max-width: 400px;
  background-color: #2a2a2a;
  border: 1px solid #4a4a4a;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  z-index: 1000;
  pointer-events: auto;
  overflow: hidden;
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
  transition: all 0.2s ease;
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
  min-width: 0; /* Allow text to shrink */
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
}

.icon-select:hover {
  border-color: #5a5a5a;
}

.icon-select:focus {
  border-color: #2196F3;
}

/* Expand/collapse animation */
.expand-enter-active,
.expand-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
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

