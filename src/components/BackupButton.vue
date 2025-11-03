<template>
  <button
    @click="handleBackup"
    class="backup-button"
    title="Create Backup Snapshot"
  >
    💾
  </button>
</template>

<script setup lang="ts">
import { createManualBackup } from '../utils/backupUtils';

async function handleBackup() {
  await createManualBackup();
}
</script>

<style scoped>
.backup-button {
  background-color: #2a2a2a;
  border: 1px solid #3a3a3a;
  border-radius: 4px;
  padding: 8px 12px;
  color: #ffffff;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.backup-button:hover {
  background-color: #3a3a3a;
  border-color: #4a4a4a;
}

.backup-button:active {
  transform: scale(0.95);
}
</style>

