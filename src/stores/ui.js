import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

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

  return {
    // Labels visibility
    labelsVisible,
    toggleLabels,
    setLabelsVisible,
    // Sidebar visibility
    sidebarVisible,
    toggleSidebar,
    setSidebarVisible
  };
});

