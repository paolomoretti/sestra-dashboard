<template>
  <div class="toast-container">
    <TransitionGroup name="toast" tag="div">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        :class="['toast', `toast-${toast.type}`]"
        @click="removeToast(toast.id)"
      >
        <div class="toast-content">
          <span class="toast-icon">{{ getToastIcon(toast.type) }}</span>
          <span class="toast-message">{{ toast.message }}</span>
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import { useToast } from '../composables/useToast';

const { toasts, removeToast } = useToast();

function getToastIcon(type: string): string {
  switch (type) {
    case 'success':
      return '✓';
    case 'error':
      return '✕';
    case 'info':
      return 'ℹ';
    default:
      return '•';
  }
}
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10000;
  display: flex;
  flex-direction: column;
  gap: 12px;
  pointer-events: none;
  align-items: center;
}

.toast {
  min-width: 250px;
  max-width: 400px;
  padding: 12px 16px;
  background-color: #ffffff;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  pointer-events: auto;
  cursor: pointer;
  transition: all 0.3s ease;
}

.toast:hover {
  background-color: #f5f5f5;
  border-color: #d0d0d0;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
}

.toast-success {
  border-left: 3px solid #4caf50;
}

.toast-error {
  border-left: 3px solid #f44336;
}

.toast-info {
  border-left: 3px solid #2196f3;
}

.toast-content {
  display: flex;
  align-items: center;
  gap: 10px;
}

.toast-icon {
  font-size: 18px;
  font-weight: bold;
  flex-shrink: 0;
  line-height: 1;
}

.toast-success .toast-icon {
  color: #4caf50;
}

.toast-error .toast-icon {
  color: #f44336;
}

.toast-info .toast-icon {
  color: #2196f3;
}

.toast-message {
  color: #1a1a1a;
  font-size: 14px;
  line-height: 1.4;
  flex: 1;
}

/* Toast animations */
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateY(-20px);
}

.toast-enter-to {
  opacity: 1;
  transform: translateY(0);
}

.toast-leave-from {
  opacity: 1;
  transform: translateY(0);
}

.toast-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}

/* Mobile responsiveness */
@media (max-width: 768px) {
  .toast-container {
    top: 16px;
    left: 50%;
    transform: translateX(-50%);
    right: auto;
    width: calc(100% - 32px);
    max-width: 400px;
  }

  .toast {
    min-width: auto;
    max-width: 100%;
    padding: 14px 16px;
  }

  .toast-message {
    font-size: 15px;
  }
}
</style>

