<template>
  <div v-if="isOpen" class="overlay" @click.self="emit('close')">
    <section class="modal" role="dialog" aria-modal="true" aria-labelledby="device-group-title">
      <header class="header">
        <h2 id="device-group-title">{{ initialConfig ? 'Edit device group' : 'Add device group' }}</h2>
        <button type="button" class="close" aria-label="Close" @click="emit('close')">×</button>
      </header>
      <div class="body">
        <label class="field-label" for="device-search">Home Assistant device</label>
        <input id="device-search" v-model="deviceQuery" class="search" placeholder="Search devices..." />
        <div class="list">
          <button v-for="device in filteredDevices" :key="device.id" type="button" class="option" :class="{ active: selectedDeviceId === device.id }" @click="selectDevice(device.id)">{{ device.name_by_user || device.name || device.id }}</button>
          <p v-if="filteredDevices.length === 0" class="empty">No devices found.</p>
        </div>
        <div v-if="selectedDevice" class="section">
          <div class="section-heading"><span class="field-label">Entities on this device</span><button type="button" class="text-button" @click="toggleAllEntities">{{ allCurrentSelected ? 'Clear available' : 'Select all available' }}</button></div>
          <input v-model="entityQuery" class="search" placeholder="Search device entities..." />
          <div class="list entity-list">
            <div v-for="entity in filteredDeviceEntities" :key="entity.key" class="entity-choice">
              <label><input type="checkbox" :checked="selectedEntityIds.includes(entity.key)" @change="toggleEntity(entity.key)" /> <span>{{ entity.name || entity.key }}</span></label>
              <span class="entity-id">{{ entity.key }}</span>
            </div>
            <p v-if="filteredDeviceEntities.length === 0" class="empty">No state-backed entities found for this device.</p>
          </div>
          <p class="help">Use the arrows to set the row order.</p>
          <ol class="selected-list">
            <li v-for="(entityId, index) in selectedEntityIds" :key="entityId">
              <span class="selected-name">{{ entityName(entityId) }}</span>
              <span v-if="!availableEntityIds.has(entityId)" class="missing">Unavailable</span>
              <button type="button" class="order" :disabled="index === 0" aria-label="Move up" @click="moveEntity(index, -1)">↑</button>
              <button type="button" class="order" :disabled="index === selectedEntityIds.length - 1" aria-label="Move down" @click="moveEntity(index, 1)">↓</button>
              <button type="button" class="order remove" aria-label="Remove entity" @click="removeEntity(entityId)">×</button>
            </li>
          </ol>
        </div>
        <div class="section">
          <label class="field-label" for="automation-search">Automation action (optional)</label>
          <input id="automation-search" v-model="automationQuery" class="search" placeholder="Search automations..." />
          <p class="help">Click Run automation to run its actions. This does not reproduce a physical trigger.</p>
          <div class="list automation-list">
            <button type="button" class="option" :class="{ active: automationId === null }" @click="automationId = null">No automation</button>
            <button v-for="automation in filteredAutomations" :key="automation.entity_id" type="button" class="option automation-option" :class="{ active: automationId === automation.entity_id }" @click="automationId = automation.entity_id">{{ automation.name }} <span>{{ automation.entity_id }}</span></button>
            <p v-if="automations.length === 0" class="empty">No automations are available.</p>
          </div>
        </div>
      </div>
      <footer class="footer">
        <span class="help">Rows stay available as separate dashboard widgets.</span>
        <div><button type="button" class="secondary" @click="emit('close')">Cancel</button><button type="button" class="save" :disabled="!canSave" @click="save">{{ initialConfig ? 'Save changes' : 'Add device group' }}</button></div>
      </footer>
    </section>
  </div>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useEntitiesStore, type HADevice } from '../stores/entities';
import { fetchAutomations } from '../utils/haServices';
import { haConfig } from '../../config';
import type { DeviceGroupConfig } from '../types/deviceGroup';

const props = defineProps<{ isOpen: boolean; initialConfig?: DeviceGroupConfig | null }>();
const emit = defineEmits<{ close: []; save: [config: DeviceGroupConfig] }>();
const entitiesStore = useEntitiesStore();
const { devices, allEntities } = storeToRefs(entitiesStore);
const selectedDeviceId = ref('');
const selectedEntityIds = ref<string[]>([]);
const automationId = ref<string | null>(null);
const deviceQuery = ref('');
const entityQuery = ref('');
const automationQuery = ref('');
const automations = ref<Array<{ entity_id: string; name: string }>>([]);
const deviceOptions = computed<HADevice[]>(() => {
  const options = [...devices.value];
  if (props.initialConfig && !options.some(device => device.id === props.initialConfig?.deviceId)) {
    options.push({ id: props.initialConfig.deviceId, area_id: null, name: props.initialConfig.deviceName, identifiers: [], connections: [] });
  }
  return options;
});
const selectedDevice = computed(() => deviceOptions.value.find(device => device.id === selectedDeviceId.value) ?? null);
const filteredDevices = computed(() => deviceOptions.value.filter(device => ((device.name_by_user || device.name || '') + ' ' + device.id).toLowerCase().includes(deviceQuery.value.toLowerCase())).sort((a, b) => (a.name_by_user || a.name || a.id).localeCompare(b.name_by_user || b.name || b.id)));
const deviceEntities = computed(() => allEntities.value.filter(entity => entity.deviceId === selectedDeviceId.value));
const filteredDeviceEntities = computed(() => deviceEntities.value.filter(entity => ((entity.name || '') + ' ' + entity.key).toLowerCase().includes(entityQuery.value.toLowerCase())));
const availableEntityIds = computed(() => new Set(deviceEntities.value.map(entity => entity.key)));
const allCurrentSelected = computed(() => deviceEntities.value.length > 0 && deviceEntities.value.every(entity => selectedEntityIds.value.includes(entity.key)));
const filteredAutomations = computed(() => automations.value.filter(item => (item.name + ' ' + item.entity_id).toLowerCase().includes(automationQuery.value.toLowerCase())));
const canSave = computed(() => Boolean(selectedDevice.value) && (selectedEntityIds.value.length > 0 || automationId.value !== null));

watch(() => [props.isOpen, props.initialConfig] as const, async ([isOpen, config]) => {
  if (!isOpen) return;
  selectedDeviceId.value = config?.deviceId ?? '';
  selectedEntityIds.value = config ? [...config.entityIds] : [];
  automationId.value = config?.automationId ?? null;
  deviceQuery.value = '';
  entityQuery.value = '';
  automationQuery.value = '';
  try { automations.value = await fetchAutomations(haConfig); } catch { automations.value = []; }
}, { immediate: true });

function selectDevice(deviceId: string) {
  if (deviceId === selectedDeviceId.value) return;
  selectedDeviceId.value = deviceId;
  selectedEntityIds.value = [];
  automationId.value = null;
}
function toggleEntity(entityId: string) {
  selectedEntityIds.value = selectedEntityIds.value.includes(entityId)
    ? selectedEntityIds.value.filter(id => id !== entityId)
    : [...selectedEntityIds.value, entityId];
}
function toggleAllEntities() {
  if (allCurrentSelected.value) {
    selectedEntityIds.value = selectedEntityIds.value.filter(id => !availableEntityIds.value.has(id));
  } else {
    selectedEntityIds.value = [...new Set([...selectedEntityIds.value, ...deviceEntities.value.map(entity => entity.key)])];
  }
}
function moveEntity(index: number, direction: -1 | 1) {
  const destination = index + direction;
  if (destination < 0 || destination >= selectedEntityIds.value.length) return;
  const ids = [...selectedEntityIds.value];
  [ids[index], ids[destination]] = [ids[destination], ids[index]];
  selectedEntityIds.value = ids;
}
function removeEntity(entityId: string) {
  selectedEntityIds.value = selectedEntityIds.value.filter(id => id !== entityId);
}
function entityName(entityId: string): string {
  return allEntities.value.find(entity => entity.key === entityId)?.name ?? entityId;
}
function save() {
  if (!canSave.value || !selectedDevice.value) return;
  emit('save', {
    deviceId: selectedDevice.value.id,
    deviceName: selectedDevice.value.name_by_user || selectedDevice.value.name || selectedDevice.value.id,
    entityIds: [...selectedEntityIds.value],
    automationId: automationId.value,
  });
}
</script>
<style scoped>
.overlay{position:fixed;inset:0;z-index:110;display:flex;align-items:center;justify-content:center;background:#0009}.modal{width:min(620px,calc(100vw - 32px));max-height:88vh;display:flex;flex-direction:column;background:#252525;border:1px solid #444;border-radius:10px;color:#f5f5f5;box-shadow:0 20px 50px #0009}.header,.footer{display:flex;align-items:center;justify-content:space-between;padding:16px;border-bottom:1px solid #3d3d3d;gap:12px}.header h2{font-size:18px;margin:0}.close,.order{border:0;background:#333;color:#eee;border-radius:5px;padding:5px 9px;cursor:pointer}.body{overflow:auto;padding:16px}.field-label{display:block;font-size:13px;font-weight:600;margin-bottom:7px}.search{width:100%;box-sizing:border-box;background:#171717;border:1px solid #454545;border-radius:5px;padding:9px;color:white}.list{max-height:150px;overflow:auto;margin-top:7px;border:1px solid #3d3d3d;border-radius:5px}.option{width:100%;display:flex;justify-content:space-between;text-align:left;padding:8px 10px;background:transparent;border:0;color:#eee;cursor:pointer}.option:hover,.option.active{background:#28456c}.section{margin-top:18px}.section-heading{display:flex;align-items:center;justify-content:space-between}.text-button{background:transparent;border:0;color:#8dbbff;cursor:pointer}.entity-choice{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 9px;border-bottom:1px solid #333}.entity-choice label{display:flex;align-items:center;gap:8px}.entity-id,.automation-option span{font-size:11px;color:#aaa}.help,.empty{font-size:12px;color:#aaa;margin:8px 0}.selected-list{list-style:none;padding:0;margin:8px 0}.selected-list li{display:flex;align-items:center;gap:5px;padding:5px;border-bottom:1px solid #333}.selected-name{flex:1}.missing{font-size:11px;color:#ffbf69}.order:disabled{opacity:.4;cursor:default}.remove{color:#ffaaaa}.footer{border-top:1px solid #3d3d3d;border-bottom:0}.footer>div{display:flex;gap:8px;white-space:nowrap}.secondary,.save{padding:8px 11px;border-radius:5px;border:1px solid #555;background:#333;color:#eee;cursor:pointer}.save{background:#2d5aa0;border-color:#2d5aa0}.save:disabled{opacity:.45;cursor:default}
</style>
