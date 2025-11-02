<template>
  <div 
    v-show="labelsVisible"
    class="entity-labels-container"
  >
    <div
      v-for="entity in entities"
      :key="entity.key"
      v-show="!isSelected(entity.key)"
      class="entity-label"
      :class="{ 'selected': isSelected(entity.key) }"
      :style="getLabelStyle(entity)"
      @click.stop="selectEntity(entity)"
      :title="entity.name || entity.key"
    >
      <span class="label-text">{{ entity.name || entity.key }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { storeToRefs } from 'pinia';
import * as go from 'gojs';
import { selectedEntity, setSelectedEntity } from '../composables/useEntitySelection';
import { useUIStore } from '../stores/ui';

// Use UI store for labels visibility
const uiStore = useUIStore();
const { labelsVisible } = storeToRefs(uiStore);

const entities = ref([]);
const viewportUpdateTrigger = ref(0);

/**
 * Convert GoJS diagram coordinates to DOM pixel coordinates
 */
function diagramToDOM(diagram, point) {
  if (!diagram) return { x: 0, y: 0 };
  
  const diagramDiv = document.getElementById('diagramDiv');
  if (!diagramDiv) return { x: 0, y: 0 };

  const viewPoint = diagram.transformDocToView(point);
  const divRect = diagramDiv.getBoundingClientRect();
  
  return {
    x: divRect.left + viewPoint.x,
    y: divRect.top + viewPoint.y
  };
}

/**
 * Get label style for positioning
 */
function getLabelStyle(entity) {
  // Access trigger to make this reactive to viewport changes
  void viewportUpdateTrigger.value;
  
  const diagram = window.diagramInstance;
  if (!diagram || !entity.loc) return { display: 'none' };

  // Get actual node bounds for more accurate positioning
  const node = diagram.findNodeForKey(entity.key);
  if (node) {
    const bounds = node.actualBounds;
    const centerPoint = new go.Point(bounds.center.x, bounds.bottom);
    const domPos = diagramToDOM(diagram, centerPoint);
    
    // Get the parent container (the flex container that holds diagramDiv and EntityLabels)
    const diagramDiv = document.getElementById('diagramDiv');
    if (!diagramDiv) return { display: 'none' };
    
    const parentContainer = diagramDiv.parentElement;
    if (!parentContainer) return { display: 'none' };
    
    const parentRect = parentContainer.getBoundingClientRect();
    
    return {
      position: 'absolute',
      left: `${domPos.x - parentRect.left}px`,
      top: `${domPos.y - parentRect.top + 5}px`, // Small offset below entity
      transform: 'translateX(-50%)',
      zIndex: 999,
      whiteSpace: 'nowrap'
    };
  }
  
  // Fallback to loc-based positioning
  const [x, y] = entity.loc.split(' ').map(Number);
  if (isNaN(x) || isNaN(y)) return { display: 'none' };
  
  const point = new go.Point(x, y);
  const domPos = diagramToDOM(diagram, point);
  
  // Get the parent container
  const diagramDiv = document.getElementById('diagramDiv');
  if (!diagramDiv) return { display: 'none' };
  
  const parentContainer = diagramDiv.parentElement;
  if (!parentContainer) return { display: 'none' };
  
  const parentRect = parentContainer.getBoundingClientRect();
  
  return {
    position: 'absolute',
    left: `${domPos.x - parentRect.left}px`,
    top: `${domPos.y - parentRect.top + 40}px`,
    transform: 'translateX(-50%)',
    zIndex: 999,
    whiteSpace: 'nowrap'
  };
}

/**
 * Check if entity is selected
 */
function isSelected(entityKey) {
  return selectedEntity.value?.key === entityKey;
}

/**
 * Select an entity (expand panel)
 */
function selectEntity(entity) {
  const diagram = window.diagramInstance;
  if (!diagram) return;
  
  // Find the node in the diagram
  const node = diagram.findNodeForKey(entity.key);
  if (node) {
    const bounds = node.actualBounds;
    setSelectedEntity(entity, {
      x: bounds.center.x,
      y: bounds.bottom
    });
    // Also select the node in GoJS
    diagram.select(node);
  }
}

/**
 * Update entities list from diagram
 */
function updateEntities() {
  const diagram = window.diagramInstance;
  if (!diagram) return;
  
  const newEntities = [];
  diagram.nodes.each(node => {
    const data = node.data;
    if (data?.key && typeof data.key === 'string' && !data.key.toString().startsWith('-')) {
      newEntities.push({
        key: data.key,
        name: data.name || data.key,
        loc: data.loc || '0 0',
        state: data.state,
        category: data.category,
        icon: data.icon
      });
    }
  });
  
  entities.value = newEntities;
}

// Watch for diagram changes and viewport updates
let updateInterval = null;

onMounted(() => {
  // Wait for diagram to be initialized
  function waitForDiagram(callback, maxAttempts = 50) {
    let attempts = 0;
    const checkInterval = setInterval(() => {
      if (window.diagramInstance) {
        clearInterval(checkInterval);
        callback();
      } else {
        attempts++;
        if (attempts >= maxAttempts) {
          clearInterval(checkInterval);
          console.warn('Diagram not initialized after waiting');
        }
      }
    }, 100);
  }
  
  waitForDiagram(() => {
    const diagram = window.diagramInstance;
    
    // Initial update
    updateEntities();
    
    function updateLoop() {
      if (window.diagramInstance) {
        // Update entities list
        updateEntities();
        // Trigger viewport update for position recalculation
        viewportUpdateTrigger.value = Date.now();
        updateInterval = requestAnimationFrame(updateLoop);
      }
    }
    
    // Start update loop for viewport tracking
    updateInterval = requestAnimationFrame(updateLoop);
    
    // Listen to model changes (entities added/removed)
    diagram.addModelChangedListener((e) => {
      if (e.isTransactionFinished) {
        updateEntities();
      }
    });
    
    // Listen for viewport changes
    diagram.addDiagramListener('ViewportBoundsChanged', () => {
      viewportUpdateTrigger.value = Date.now();
    });
  });
});

onUnmounted(() => {
  if (updateInterval) {
    cancelAnimationFrame(updateInterval);
  }
});
</script>

<style scoped>
.entity-labels-container {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 998;
  overflow: visible;
}

.entity-label {
  pointer-events: auto;
  background-color: rgba(42, 42, 42, 0.9);
  border: 1px solid #4a4a4a;
  border-radius: 3px;
  padding: 4px 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  font-size: 11px;
  color: #ffffff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.entity-label:hover {
  background-color: rgba(51, 51, 51, 0.95);
  border-color: #5a5a5a;
  transform: translateX(-50%) scale(1.05);
}

.entity-label.selected {
  background-color: rgba(51, 51, 51, 0.95);
  border-color: #2196F3;
  box-shadow: 0 2px 8px rgba(33, 150, 243, 0.4);
}

.label-text {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>

