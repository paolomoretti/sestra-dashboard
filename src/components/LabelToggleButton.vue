<template>
  <button
    @click="toggleLabels"
    class="label-toggle-button"
    :class="{ 'active': labelsVisible }"
    :title="labelsVisible ? 'Hide Labels' : 'Show Labels'"
  >
    <span class="button-icon">🏷️</span>
    <span class="button-text">{{ labelsVisible ? 'Hide Labels' : 'Show Labels' }}</span>
  </button>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useUIStore } from '../stores/ui';

const uiStore = useUIStore();
const { labelsVisible } = storeToRefs(uiStore);
const { toggleLabels } = uiStore;
</script>

<style scoped>
.label-toggle-button {
  display: flex;
  align-items: center;
  gap: 6px;
  background-color: #333333;
  border: 1px solid #4a4a4a;
  border-radius: 4px;
  padding: 8px 12px;
  color: #ffffff;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 44px;
  min-width: 44px;
}

@media (min-width: 640px) {
  .label-toggle-button {
    padding: 6px 12px;
    min-height: auto;
    min-width: auto;
  }
}

.label-toggle-button:hover {
  background-color: #3a3a3a;
  border-color: #5a5a5a;
}

.label-toggle-button.active {
  background-color: #2d5aa0;
  border-color: #4a7bc8;
}

.label-toggle-button.active:hover {
  background-color: #3570c4;
  border-color: #5a8fd8;
}

.button-icon {
  font-size: 16px;
}

.button-text {
  font-weight: 500;
}

@media (max-width: 639px) {
  .button-text {
    display: none;
  }
}
</style>

