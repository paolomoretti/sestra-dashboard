import { ref } from 'vue';

// Global reactive state for selected entity
export const selectedEntity = ref(null);
export const selectedEntityPosition = ref({ x: 0, y: 0 });

/**
 * Set the selected entity and its position
 * @param {Object|null} entity - The entity data (or null to deselect)
 * @param {Object} position - The position {x, y} in diagram coordinates
 */
export function setSelectedEntity(entity, position = { x: 0, y: 0 }) {
  selectedEntity.value = entity;
  selectedEntityPosition.value = position;
}

/**
 * Clear the selection
 */
export function clearSelection() {
  selectedEntity.value = null;
  selectedEntityPosition.value = { x: 0, y: 0 };
}

/**
 * Composable for managing entity selection state (for use in Vue components)
 */
export function useEntitySelection() {
  return {
    selectedEntity,
    selectedEntityPosition,
    setSelectedEntity,
    clearSelection
  };
}

