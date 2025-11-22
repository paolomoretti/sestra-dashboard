<template>
  <button
    @click="openSettings"
    class="settings-button"
    title="Settings"
    aria-label="Open settings"
  >
    <span class="button-icon">⚙️</span>
  </button>
</template>

<script setup lang="ts">
const emit = defineEmits<{
  open: [];
}>();

function openSettings() {
  emit('open');
}
</script>

<style scoped>
.settings-button {
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #333333;
  border: 1px solid #4a4a4a;
  border-radius: 50%;
  width: 44px;
  height: 44px;
  padding: 0;
  color: #ffffff;
  cursor: pointer;
  transition: all 0.2s ease;
}

@media (min-width: 640px) {
  .settings-button {
    width: 36px;
    height: 36px;
  }
}

.settings-button:hover {
  background-color: #3a3a3a;
  border-color: #5a5a5a;
}

.settings-button.active {
  background-color: #2d5aa0;
  border-color: #4a7bc8;
}

.settings-button.active:hover {
  background-color: #3570c4;
  border-color: #5a8fd8;
}

.button-icon {
  font-size: 18px;
  line-height: 1;
}

@media (min-width: 640px) {
  .button-icon {
    font-size: 16px;
  }
}
</style>

