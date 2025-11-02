<template>
  <div class="entity-palette">
    <div
      v-for="entity in filteredEntities"
      :key="entity.key"
      class="palette-item"
      draggable="true"
      @dragstart="handleDragStart($event, entity)"
      @click="handleItemClick(entity)"
    >
      <!-- Icon -->
      <img
        v-if="getIconUrl(entity)"
        :src="getIconUrl(entity)"
        class="palette-icon"
        draggable="false"
      />
      <div v-else class="palette-icon-placeholder" />

      <!-- Entity info -->
      <div class="palette-info">
        <div class="palette-name">{{ entity.name || entity.key }}</div>
        <div class="palette-entity-id">{{ entity.key }}</div>
        <div v-if="entity.state" class="palette-state">
          State: {{ entity.state }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { getMDIIconPath, createIconSVG, getIconColor } from '../utils/iconUtils';
import type { EntityData } from '../composables/useEntitySelection';

interface Props {
  entities: EntityData[];
  filter: string;
  searchQuery: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'entity-selected': [entity: EntityData];
}>();

const filteredEntities = computed(() => {
  let filtered = props.entities;

  // Filter by type
  if (props.filter !== 'all') {
    filtered = filtered.filter((e) => {
      const domain = e.key.split('.')[0];
      return domain === props.filter.replace('_', '-');
    });
  }

  // Filter by search query
  if (props.searchQuery) {
    const query = props.searchQuery.toLowerCase();
    filtered = filtered.filter((e) => {
      const name = (e.name || '').toLowerCase();
      const key = e.key.toLowerCase();
      return name.includes(query) || key.includes(query);
    });
  }

  return filtered;
});

function getIconUrl(entity: EntityData): string | null {
  const iconName = entity.icon || 'circle-outline';
  const path = getMDIIconPath(iconName);
  if (!path) return null;

  const color = getIconColor(entity.key, entity.state, iconName);
  return createIconSVG(path, color, 30);
}

function handleDragStart(e: DragEvent, entity: EntityData) {
  if (!e.dataTransfer) return;
  e.dataTransfer.effectAllowed = 'copy';
  e.dataTransfer.setData('application/json', JSON.stringify(entity));
}

function handleItemClick(entity: EntityData) {
  emit('entity-selected', entity);
}
</script>

<style scoped>
.entity-palette {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  max-height: 100%;
  overflow-y: auto;
}

.palette-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  border-radius: 4px;
  cursor: grab;
  transition: all 0.2s;
  user-select: none;
}

.palette-item:hover {
  background: #333;
  border-color: #4a4a4a;
  transform: translateX(2px);
}

.palette-item:active {
  cursor: grabbing;
  opacity: 0.8;
}

.palette-icon {
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  pointer-events: none;
}

.palette-icon-placeholder {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: #4a4a4a;
  flex-shrink: 0;
}

.palette-info {
  flex: 1;
  min-width: 0;
}

.palette-name {
  font-weight: 500;
  color: #fff;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.palette-entity-id {
  font-size: 11px;
  color: #888;
  font-family: monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.palette-state {
  font-size: 11px;
  color: #aaa;
  margin-top: 2px;
}
</style>

