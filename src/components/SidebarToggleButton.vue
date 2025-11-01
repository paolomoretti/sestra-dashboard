<template>
  <button
    @click="toggleSidebar"
    class="sidebar-toggle-button"
    :class="{ 'active': sidebarVisible }"
    :title="sidebarVisible ? 'Hide Sidebar' : 'Show Sidebar'"
  >
    <span class="button-icon">📋</span>
    <span class="button-text">{{ sidebarVisible ? 'Hide Sidebar' : 'Show Sidebar' }}</span>
  </button>
</template>

<script setup>
import { storeToRefs } from 'pinia';
import { useUIStore } from '../stores/ui';

const uiStore = useUIStore();
const { sidebarVisible } = storeToRefs(uiStore);
const { toggleSidebar } = uiStore;
</script>

<style scoped>
.sidebar-toggle-button {
  display: flex;
  align-items: center;
  gap: 6px;
  background-color: #333333;
  border: 1px solid #4a4a4a;
  border-radius: 4px;
  padding: 6px 12px;
  color: #ffffff;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.sidebar-toggle-button:hover {
  background-color: #3a3a3a;
  border-color: #5a5a5a;
}

.sidebar-toggle-button.active {
  background-color: #2d5aa0;
  border-color: #4a7bc8;
}

.sidebar-toggle-button.active:hover {
  background-color: #3570c4;
  border-color: #5a8fd8;
}

.button-icon {
  font-size: 16px;
}

.button-text {
  font-weight: 500;
}
</style>

