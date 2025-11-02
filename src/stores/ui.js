import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { useThrottleFn } from '@vueuse/core';

export const useUIStore = defineStore('ui', () => {
  // Labels visibility
  const getLabelsVisibilityStoredValue = () => {
    try {
      const item = window.localStorage.getItem('ha_dashboard_labels_visible');
      return item !== null ? JSON.parse(item) : true;
    } catch (error) {
      console.warn('Error reading labels visibility from localStorage:', error);
      return true;
    }
  };

  const labelsVisible = ref(getLabelsVisibilityStoredValue());

  watch(labelsVisible, (newValue) => {
    try {
      window.localStorage.setItem('ha_dashboard_labels_visible', JSON.stringify(newValue));
    } catch (error) {
      console.warn('Error saving labels visibility to localStorage:', error);
    }
  }, { immediate: false });

  function toggleLabels() {
    labelsVisible.value = !labelsVisible.value;
  }

  function setLabelsVisible(value) {
    labelsVisible.value = value;
  }

  // Sidebar visibility
  const getSidebarVisibilityStoredValue = () => {
    try {
      const item = window.localStorage.getItem('ha_dashboard_sidebar_visible');
      return item !== null ? JSON.parse(item) : true;
    } catch (error) {
      console.warn('Error reading sidebar visibility from localStorage:', error);
      return true;
    }
  };

  const sidebarVisible = ref(getSidebarVisibilityStoredValue());

  watch(sidebarVisible, (newValue) => {
    try {
      window.localStorage.setItem('ha_dashboard_sidebar_visible', JSON.stringify(newValue));
    } catch (error) {
      console.warn('Error saving sidebar visibility to localStorage:', error);
    }
  }, { immediate: false });

  function toggleSidebar() {
    sidebarVisible.value = !sidebarVisible.value;
  }

  function setSidebarVisible(value) {
    sidebarVisible.value = value;
  }

  // Scroll position (viewport center point)
  const getScrollPositionStoredValue = () => {
    try {
      const item = window.localStorage.getItem('ha_dashboard_scroll_position');
      if (item) {
        const parsed = JSON.parse(item);
        return parsed && typeof parsed.x === 'number' && typeof parsed.y === 'number' 
          ? parsed 
          : { x: 0, y: 0 };
      }
      return { x: 0, y: 0 };
    } catch (error) {
      console.warn('Error reading scroll position from localStorage:', error);
      return { x: 0, y: 0 };
    }
  };

  const scrollPosition = ref(getScrollPositionStoredValue());

  // Throttled function to save scroll position (every 500ms)
  const saveScrollPosition = useThrottleFn((position) => {
    try {
      window.localStorage.setItem('ha_dashboard_scroll_position', JSON.stringify(position));
    } catch (error) {
      console.warn('Error saving scroll position to localStorage:', error);
    }
  }, 500);

  watch(scrollPosition, (newValue) => {
    saveScrollPosition(newValue);
  }, { deep: true });

  function setScrollPosition(x, y) {
    scrollPosition.value = { x, y };
  }

  return {
    // Labels visibility
    labelsVisible,
    toggleLabels,
    setLabelsVisible,
    // Sidebar visibility
    sidebarVisible,
    toggleSidebar,
    setSidebarVisible,
    // Scroll position
    scrollPosition,
    setScrollPosition
  };
});

