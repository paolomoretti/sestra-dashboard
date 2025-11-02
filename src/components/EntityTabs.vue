<template>
  <div class="border-b border-[#3a3a3a]">
    <div class="flex overflow-x-auto">
      <button
        v-for="tab in tabs"
        :key="tab.value"
        @click="selectTab(tab.value)"
        class="px-3 py-2 text-xs font-medium transition-colors duration-200 whitespace-nowrap border-b-2 flex items-center gap-1"
        :class="{
          'text-white border-blue-500': activeTab === tab.value,
          'text-[#888888] border-transparent hover:text-white hover:border-[#555]': activeTab !== tab.value
        }"
      >
        <span>{{ tab.icon }}</span>
        <span>{{ tab.label }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineProps, defineEmits } from 'vue';

const props = defineProps({
  tabs: {
    type: Array,
    required: true
  },
  activeTab: {
    type: String,
    required: true
  }
});

const emit = defineEmits(['update:activeTab']);

function selectTab(value) {
  emit('update:activeTab', value);
}
</script>
