<template>
  <div class="collapsible-panel">
    <div
      class="panel-header"
      @click="toggle"
    >
      <span class="panel-icon">{{ icon }}</span>
      <span class="panel-title">{{ title }}</span>
      <span class="panel-chevron">{{ collapsed ? '▶' : '▼' }}</span>
    </div>
    <transition name="collapse">
      <div v-show="!collapsed" class="panel-content">
        <slot />
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useLocalStorage } from '../composables/useLocalStorage';

interface Props {
  title: string;
  icon: string;
  storageKey: string;
  modelValue?: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

// Use localStorage to persist collapsed state, or use modelValue if provided
const [storedCollapsed, setStoredCollapsed] = useLocalStorage<boolean>(props.storageKey, props.modelValue ?? false);
const collapsed = ref(props.modelValue ?? storedCollapsed.value);

// Watch for external changes to modelValue
watch(() => props.modelValue, (newValue) => {
  if (newValue !== undefined) {
    collapsed.value = newValue;
  }
});

// Watch for changes to collapsed state and emit
watch(collapsed, (newValue) => {
  setStoredCollapsed(newValue);
  emit('update:modelValue', newValue);
});

function toggle() {
  collapsed.value = !collapsed.value;
}
</script>

<style scoped>
.collapsible-panel {
  display: flex;
  flex-direction: column;
  border-bottom: 1px solid #3a3a3a;
}

.panel-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background-color: #2a2a2a;
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s;
}

.panel-header:hover {
  background-color: #333333;
}

.panel-icon {
  margin-right: 8px;
  font-size: 16px;
}

.panel-title {
  flex: 1;
  font-weight: 600;
  color: #ffffff;
  font-size: 14px;
}

.panel-chevron {
  color: #888888;
  font-size: 12px;
  margin-left: 8px;
}

.panel-content {
  overflow: hidden;
}

.collapse-enter-active,
.collapse-leave-active {
  transition: max-height 0.3s ease, opacity 0.3s ease;
}

.collapse-enter-from,
.collapse-leave-to {
  max-height: 0;
  opacity: 0;
}

.collapse-enter-to,
.collapse-leave-from {
  max-height: 2000px;
  opacity: 1;
}
</style>

