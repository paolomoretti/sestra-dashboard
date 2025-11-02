import { ref, type Ref } from 'vue';
import type { TapAction } from '../utils/actionHandler';

export interface EntityData {
  key: string;
  entityId?: string;
  category?: string;
  name?: string;
  state?: string;
  status?: string | null;
  icon?: string;
  deviceClass?: string | null;
  loc?: string;
  size?: string | null;
  tapAction?: TapAction | null;
  holdAction?: any;
}

export interface Position {
  x: number;
  y: number;
}

// Global reactive state for selected entity
export const selectedEntity: Ref<EntityData | null> = ref<EntityData | null>(null);
export const selectedEntityPosition: Ref<Position> = ref<Position>({ x: 0, y: 0 });

/**
 * Set the selected entity and its position
 * @param entity - The entity data (or null to deselect)
 * @param position - The position {x, y} in diagram coordinates
 */
export function setSelectedEntity(entity: EntityData | null, position: Position = { x: 0, y: 0 }): void {
  selectedEntity.value = entity;
  selectedEntityPosition.value = position;
}

/**
 * Clear the selection
 */
export function clearSelection(): void {
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

