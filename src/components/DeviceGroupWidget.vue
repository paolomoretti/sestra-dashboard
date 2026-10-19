<template>
  <div class="device-group-content">
    <div class="group-heading"><span class="group-title">{{ group.deviceName }}</span><button v-if="group.automationId" type="button" class="run-button" :disabled="editing" @click="runAutomation">Run automation</button></div>
    <div class="rows">
      <button v-for="row in rows" :key="row.entityId" type="button" class="entity-row" :class="{ missing: row.kind === 'missing' }" @mousedown="handlePointerStart" @touchstart="handlePointerStart" @click="openMoreInfo(row, $event)">
        <span class="entity-name">{{ row.kind === 'available' ? row.entity.name || row.entityId : row.entityId }}</span>
        <span class="entity-state">{{ row.kind === 'available' ? row.entity.state || 'unknown' : 'Unavailable' }}</span>
      </button>
      <p v-if="rows.length === 0" class="empty">No entities selected.</p>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useEntitiesStore } from '../stores/entities';
import { executeTapAction } from '../utils/actionHandler';
import { haConfig } from '../../config';
import { resolveDeviceGroupRows } from '../utils/deviceGroup';
import type { DeviceGroupConfig, DeviceGroupRow } from '../types/deviceGroup';

const props = defineProps<{ group: DeviceGroupConfig; editing: boolean }>();
const emit = defineEmits<{ runAutomation: [] }>();
const { allEntities } = storeToRefs(useEntitiesStore());
const entitiesById = computed(() => new Map(allEntities.value.map(entity => [entity.key, entity])));
const rows = computed(() => resolveDeviceGroupRows(props.group, entitiesById.value));

function handlePointerStart(event: MouseEvent | TouchEvent) {
  if (!props.editing) event.stopPropagation();
}
function runAutomation(event: MouseEvent) {
  if (props.editing || !props.group.automationId) return;
  event.stopPropagation();
  emit('runAutomation');
}
async function openMoreInfo(row: DeviceGroupRow, event: MouseEvent) {
  if (props.editing) return;
  event.stopPropagation();
  if (row.kind === 'missing') return;
  await executeTapAction({ action: 'more-info' }, row.entity, haConfig);
}
</script>
<style scoped>
.device-group-content{width:100%;height:100%;min-width:0;box-sizing:border-box;padding:10px 12px;display:flex;flex-direction:column;gap:7px;background:rgba(30,30,30,.94);border:1px solid rgba(255,255,255,.14);border-radius:9px;color:#f4f4f4;overflow:hidden}.group-heading{display:flex;align-items:center;justify-content:space-between;gap:6px}.group-title{font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.run-button{display:flex;align-items:center;justify-content:center;gap:8px;min-height:28px;padding:5px 8px;border:1px solid #416ba4;border-radius:5px;background:#263d5a;color:#fff;text-align:left;cursor:pointer}.run-button:disabled{cursor:default}.rows{min-height:0;overflow:auto;display:flex;flex-direction:column}.entity-row{touch-action:pan-y;display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:31px;padding:4px 2px;border:0;border-bottom:1px solid #ffffff1a;background:transparent;color:#eee;text-align:left;cursor:pointer}.entity-row:hover{background:#ffffff0b}.entity-row.missing{color:#aaa}.entity-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.entity-state{font-size:12px;color:#b8c8da;white-space:nowrap}.empty{margin:8px 0;color:#aaa;font-size:12px}
</style>
