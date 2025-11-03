<template>
  <div class="add-button-container">
    <button
      class="add-button"
      :class="{ active: isMenuOpen }"
      @click="toggleMenu"
      title="Add widget"
    >
      <span class="add-icon">{{ isMenuOpen ? '✕' : '+' }}</span>
    </button>
    
    <div v-if="isMenuOpen" class="add-menu">
      <button
        class="add-menu-item"
        @click="handleAddActionButton"
      >
        <span class="menu-icon">⚡</span>
        <span class="menu-label">Action Button</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const emit = defineEmits<{
  addActionButton: [];
}>();

const isMenuOpen = ref(false);

function toggleMenu() {
  isMenuOpen.value = !isMenuOpen.value;
}

function handleAddActionButton() {
  emit('addActionButton');
  isMenuOpen.value = false;
}

// Close menu when clicking outside
function handleClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement;
  if (!target.closest('.add-button-container')) {
    isMenuOpen.value = false;
  }
}

import { onMounted, onUnmounted } from 'vue';
onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<style scoped>
.add-button-container {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 1000;
}

.add-button {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background-color: #2d5aa0;
  border: none;
  color: #ffffff;
  font-size: 24px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.add-button:hover {
  background-color: #3a6bc0;
  transform: scale(1.1);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
}

.add-button.active {
  background-color: #c62828;
  transform: rotate(45deg);
}

.add-icon {
  display: block;
  line-height: 1;
}

.add-menu {
  position: absolute;
  bottom: 70px;
  right: 0;
  background-color: #2a2a2a;
  border: 1px solid #4a4a4a;
  border-radius: 8px;
  padding: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  min-width: 180px;
}

.add-menu-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background-color: transparent;
  border: none;
  color: #ffffff;
  font-size: 14px;
  cursor: pointer;
  border-radius: 4px;
  text-align: left;
  transition: background-color 0.2s ease;
}

.add-menu-item:hover {
  background-color: #3a3a3a;
}

.menu-icon {
  font-size: 18px;
}

.menu-label {
  flex: 1;
}
</style>
