<template>
   <Teleport to="body"
    > <Transition name="fade"
      >
      <div v-if="isOpen" class="settings-overlay" @click.self="close">
         <Transition name="slide"
          >
          <div v-if="isOpen" class="settings-panel" @click.stop>
             <!-- Header -->
            <div class="settings-header">

              <h2 class="settings-title">Settings</h2>
               <button
                class="settings-close-button"
                @click="close"
                title="Close settings"
                aria-label="Close settings"
              >
                 <span class="close-icon">✕</span> </button
              >
            </div>
             <!-- Content -->
            <div class="settings-content">
               <!-- Label Visibility Toggle -->
              <div class="settings-section">
                 <label class="settings-label"
                  > <input
                    type="checkbox"
                    :checked="labelsVisible"
                    @change="toggleLabels"
                    class="settings-checkbox"
                  /> <span class="settings-label-text">Show Labels</span> </label
                >
                <p class="settings-description">
                   Toggle visibility of entity labels on the dashboard
                </p>

              </div>
               <!-- Clear Cache -->
              <div class="settings-section">

                <div class="settings-section-header">

                  <h3 class="settings-section-title">Cache Management</h3>

                </div>
                 <button
                  @click="handleClearCache"
                  class="clear-cache-button"
                  :disabled="isClearingCache"
                >
                   <span v-if="!isClearingCache">🗑️ Clear Cache & Reload</span> <span v-else
                    >Clearing...</span
                  > </button
                >
                <p class="settings-description">
                   <span v-if="isProduction"
                    > Clear all cached data and reload the app. Use this after updating to ensure
                    you have the latest version. </span
                  > <span v-else
                    > <strong>Development mode:</strong> Clear service worker caches and reload.
                    Useful for testing cache clearing functionality. </span
                  >
                </p>

              </div>

            </div>

          </div>
           </Transition
        >
      </div>
       </Transition
    > </Teleport
  >
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useUIStore } from '../stores/ui';

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

const uiStore = useUIStore();
const { labelsVisible } = storeToRefs(uiStore);
const { toggleLabels } = uiStore;

const isProduction = import.meta.env.PROD;
const isClearingCache = ref(false);

function close() {
  emit('close');
}

async function handleClearCache() {
  const confirmMessage = isProduction
    ? 'Clear all cached data and reload the app? This will ensure you have the latest version.'
    : 'Clear all cached data and reload the app? (Development mode)';

  // eslint-disable-next-line no-alert
  if (!confirm(confirmMessage)) {
    return;
  }

  isClearingCache.value = true;

  try {
    // Clear all caches
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => {
          // eslint-disable-next-line no-console
          console.log('Deleting cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
      // eslint-disable-next-line no-console
      console.log('✅ All caches cleared');
    }

    // Unregister all service workers
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations.map(registration => {
          // eslint-disable-next-line no-console
          console.log('Unregistering service worker:', registration.scope);
          return registration.unregister();
        })
      );
      // eslint-disable-next-line no-console
      console.log('✅ All service workers unregistered');
    }

    // Clear localStorage cache-related data (optional - you might want to keep some data)
    // Uncomment if you want to clear localStorage too:
    // localStorage.clear();

    // Small delay to ensure everything is cleared
    await new Promise(resolve => setTimeout(resolve, 500));

    // Reload the page
    window.location.reload();
  } catch (error) {
    console.error('Error clearing cache:', error);
    // eslint-disable-next-line no-alert
    alert('Error clearing cache. Please try a hard refresh (Ctrl+Shift+R or Cmd+Shift+R)');
    isClearingCache.value = false;
  }
}

// Close on Escape key

function handleEscape(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.isOpen) {
    close();
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleEscape);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleEscape);
});
</script>

<style scoped>
.settings-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  backdrop-filter: blur(4px);
}

.settings-panel {
  background-color: #2a2a2a;
  border: 1px solid #3a3a3a;
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  overflow: hidden;
}

.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid #3a3a3a;
}

.settings-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #ffffff;
}

.settings-close-button {
  background: none;
  border: none;
  color: #ffffff;
  cursor: pointer;
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background-color 0.2s ease;
  min-width: 32px;
  min-height: 32px;
}

.settings-close-button:hover {
  background-color: #3a3a3a;
}

.close-icon {
  font-size: 20px;
  line-height: 1;
  font-weight: 300;
}

.settings-content {
  padding: 24px;
  overflow-y: auto;
  flex: 1;
}

.settings-section {
  margin-bottom: 24px;
}

.settings-section:last-child {
  margin-bottom: 0;
}

.settings-label {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  user-select: none;
}

.settings-checkbox {
  width: 20px;
  height: 20px;
  cursor: pointer;
  accent-color: #2d5aa0;
}

.settings-label-text {
  font-size: 16px;
  font-weight: 500;
  color: #ffffff;
}

.settings-description {
  margin: 8px 0 0 32px;
  font-size: 14px;
  color: #a0a0a0;
  line-height: 1.5;
}

.settings-section-header {
  margin-bottom: 12px;
}

.settings-section-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
}

.clear-cache-button {
  width: 100%;
  padding: 12px 16px;
  background-color: #d32f2f;
  border: 1px solid #b71c1c;
  border-radius: 6px;
  color: #ffffff;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.clear-cache-button:hover:not(:disabled) {
  background-color: #c62828;
  border-color: #a01515;
}

.clear-cache-button:active:not(:disabled) {
  background-color: #b71c1c;
  transform: translateY(1px);
}

.clear-cache-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-enter-active,
.slide-leave-active {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.slide-enter-from,
.slide-leave-to {
  transform: scale(0.95);
  opacity: 0;
}

/* Scrollbar styling */
.settings-content::-webkit-scrollbar {
  width: 8px;
}

.settings-content::-webkit-scrollbar-track {
  background: #1a1a1a;
}

.settings-content::-webkit-scrollbar-thumb {
  background: #4a4a4a;
  border-radius: 4px;
}

.settings-content::-webkit-scrollbar-thumb:hover {
  background: #5a5a5a;
}
</style>

