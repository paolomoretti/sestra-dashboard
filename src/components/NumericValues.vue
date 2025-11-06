<template>
  <div class="numeric-values-container">
    <div
      v-for="entity in numericEntities"
      :key="entity.key"
      class="numeric-value"
      :style="getValueStyle(entity)"
    >
      <span class="value-text">{{ formatNumber(entity.state) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import * as go from 'gojs';

const numericEntities = ref([]);
const viewportUpdateTrigger = ref(0);

/**
 * Check if a value is numeric
 */
function isNumeric(value) {
  if (value === null || value === undefined || value === '') return false;
  const num = parseFloat(value);
  return !isNaN(num) && isFinite(num) && value.toString().trim() !== '';
}

/**
 * Format number for display
 */
function formatNumber(value) {
  if (!isNumeric(value)) return '';
  const num = parseFloat(value);
  // Remove unnecessary decimal places but keep significant ones
  return num.toString();
}

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
 * Get style for positioning numeric value next to icon
 */
function getValueStyle(entity) {
  // Access trigger to make this reactive to viewport changes
  void viewportUpdateTrigger.value;
  
  const diagram = window.diagramInstance;
  if (!diagram || !entity.loc) return { display: 'none' };

  // Get actual node bounds
  const node = diagram.findNodeForKey(entity.key);
  if (!node) return { display: 'none' };
  
  const bounds = node.actualBounds;
  // Position to the right of the icon (icon is typically at the top center of node)
  // For vertical layout, icon is at top, so position number to the right of the node center
  const iconRightPoint = new go.Point(bounds.right, bounds.top + bounds.height * 0.3);
  const domPos = diagramToDOM(diagram, iconRightPoint);
  
  // Get the parent container
  const diagramDiv = document.getElementById('diagramDiv');
  if (!diagramDiv) return { display: 'none' };
  
  const parentContainer = diagramDiv.parentElement;
  if (!parentContainer) return { display: 'none' };
  
  const parentRect = parentContainer.getBoundingClientRect();
  
  return {
    position: 'absolute',
    left: `${domPos.x - parentRect.left + 8}px`, // 8px offset to the right of icon
    top: `${domPos.y - parentRect.top - 8}px`, // Slightly above icon center
    transform: 'translateY(-50%)',
    zIndex: 999,
    whiteSpace: 'nowrap'
  };
}

/**
 * Update entities list from diagram - only numeric ones
 */
function updateNumericEntities() {
  const diagram = window.diagramInstance;
  if (!diagram) return;
  
  const newEntities = [];
  diagram.nodes.each(node => {
    const data = node.data;
    if (data?.key && typeof data.key === 'string' && !data.key.toString().startsWith('-')) {
      // Only include entities with numeric states
      if (isNumeric(data.state)) {
        newEntities.push({
          key: data.key,
          name: data.name || data.key,
          loc: data.loc || '0 0',
          state: data.state,
          category: data.category
        });
      }
    }
  });
  
  numericEntities.value = newEntities;
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
    updateNumericEntities();
    
    function updateLoop() {
      if (window.diagramInstance) {
        // Update entities list
        updateNumericEntities();
        // Trigger viewport update for position recalculation
        viewportUpdateTrigger.value = Date.now();
        updateInterval = requestAnimationFrame(updateLoop);
      }
    }
    
    // Start update loop for viewport tracking
    updateInterval = requestAnimationFrame(updateLoop);
    
    // Listen to model changes (entities added/removed or state changes)
    diagram.addModelChangedListener((e) => {
      if (e.isTransactionFinished) {
        updateNumericEntities();
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
.numeric-values-container {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 998;
  overflow: visible;
}

.numeric-value {
  pointer-events: auto;
  background-color: rgba(26, 26, 26, 0.9);
  border: 1px solid #4a4a4a;
  border-radius: 4px;
  padding: 6px 10px;
  cursor: default;
  transition: all 0.2s ease;
  white-space: nowrap;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
}

.value-text {
  display: block;
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
  line-height: 1.2;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}
</style>




