<template>

  <div class="entity-palette">

    <div
      v-for="entity in filteredEntities"
      :key="entity.key"
      class="palette-item"
      @click="handleItemClick(entity)"
    >
       <!-- Icon --> <img
        v-if="getIconUrl(entity)"
        :src="getIconUrl(entity)"
        class="palette-icon"
        draggable="false"
      />
      <div v-else class="palette-icon-placeholder" />
       <!-- Entity info -->
      <div class="palette-info">

        <div class="palette-name" :title="entity.name || entity.key">
           {{ entity.name || entity.key }}
        </div>

        <div class="palette-entity-id" :title="entity.key">{{ entity.key }}</div>

        <div v-if="entity.state" class="palette-state" :title="`State: ${entity.state}`">
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
  roomFilter?: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'entity-selected': [entity: EntityData];
}>();

const filteredEntities = computed(() => {
  let filtered = props.entities;

  // Filter by type
  if (props.filter !== 'all') {
    filtered = filtered.filter(e => {
      const domain = e.key.split('.')[0];
      return domain === props.filter.replace('_', '-');
    });
  }

  // Filter by room
  if (props.roomFilter && props.roomFilter !== 'all') {
    filtered = filtered.filter(e => {
      return e.areaId === props.roomFilter;
    });
  }

  // Filter by search query
  if (props.searchQuery) {
    const query = props.searchQuery.toLowerCase();
    filtered = filtered.filter(e => {
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

  const color = getIconColor(entity.key, entity.state, entity.iconColorOn, entity.iconColorOff);
  return createIconSVG(path, color, 30);
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
  padding: 12px;
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  min-height: 60px;
}

@media (min-width: 640px) {
  .palette-item {
    padding: 8px;
    min-height: auto;
  }
}

.palette-item:hover {
  background: #333;
  border-color: #4a4a4a;
  transform: translateX(2px);
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
  font-size: 15px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.palette-entity-id {
  font-size: 12px;
  color: #888;
  font-family: monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.palette-state {
  font-size: 12px;
  color: #aaa;
  margin-top: 2px;
}

@media (min-width: 640px) {
  .palette-name {
    font-size: 13px;
  }
  
  .palette-entity-id {
    font-size: 11px;
  }
  
  .palette-state {
    font-size: 11px;
  }
}
</style>

