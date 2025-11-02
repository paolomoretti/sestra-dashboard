<template>
  <div class="border-b border-[#3a3a3a] flex flex-col min-h-0" :class="{ collapsed: isCollapsed }" :style="$attrs.style">
    <div 
      class="px-4 py-4 cursor-pointer select-none flex items-center justify-between transition-colors duration-200 hover:bg-gray-800 flex-shrink-0"
      @click="toggle"
    >
      <h2 class="m-0 text-xl flex items-center gap-2">
        <span>{{ icon }}</span>
        <span>{{ title }}</span>
      </h2>
      <span 
        class="text-sm text-[#888888] flex-shrink-0 transition-transform duration-300"
        :class="{ 'rotate-[-90deg]': isCollapsed }"
      >
        ▼
      </span>
    </div>
    <div 
      class="px-4 pb-4 transition-all duration-300 flex flex-col min-h-0"
      :class="{
        'flex-1 opacity-100 overflow-auto': !isCollapsed,
        'max-h-0 opacity-0 py-0 overflow-hidden': isCollapsed
      }"
    >
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useLocalStorage } from '../composables/useLocalStorage';

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    required: true
  },
  icon: {
    type: String,
    default: '📋'
  },
  storageKey: {
    type: String,
    required: true
  }
});

const emit = defineEmits(['update:modelValue']);

const [storedValue, setStoredValue] = useLocalStorage(props.storageKey, props.modelValue);

// Sync with localStorage and props
const isCollapsed = computed({
  get: () => {
    // Prefer prop if provided, otherwise use stored value
    return props.modelValue !== undefined ? props.modelValue : storedValue.value;
  },
  set: (val) => {
    storedValue.value = val;
    setStoredValue(val);
    emit('update:modelValue', val);
  }
});

function toggle() {
  isCollapsed.value = !isCollapsed.value;
}
</script>
