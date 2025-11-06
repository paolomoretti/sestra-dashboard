<template>
  <div class="entity-filter-dropdown-container border-b border-[#3a3a3a]">
    <select
      :value="activeTab"
      @change="handleChange"
      class="entity-filter-dropdown"
    >
      <option
        v-for="tab in tabs"
        :key="tab.value"
        :value="tab.value"
      >
        {{ tab.icon }} {{ tab.label }}
      </option>
    </select>
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

function handleChange(event: Event) {
  const target = event.target as HTMLSelectElement;
  emit('update:activeTab', target.value);
}
</script>

<style scoped>
.entity-filter-dropdown-container {
  padding: 0;
}

.entity-filter-dropdown {
  width: 100%;
  background-color: #2a2a2a;
  border: none;
  border-bottom: 2px solid #3a3a3a;
  color: #ffffff;
  font-size: 14px;
  padding: 12px 16px;
  cursor: pointer;
  outline: none;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ffffff' d='M6 9L1 4h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 16px center;
  background-size: 12px;
  padding-right: 40px;
  transition: background-color 0.2s ease;
}

.entity-filter-dropdown:hover {
  background-color: #333333;
}

.entity-filter-dropdown:focus {
  background-color: #333333;
  border-bottom-color: #2d5aa0;
}

.entity-filter-dropdown option {
  background-color: #2a2a2a;
  color: #ffffff;
  padding: 8px;
}

@media (max-width: 768px) {
  .entity-filter-dropdown {
    font-size: 16px;
    padding: 14px 16px;
    padding-right: 40px;
    min-height: 44px;
  }
}
</style>
