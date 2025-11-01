import { useLocalStorage } from './useLocalStorage';

/**
 * Composable for managing labels visibility state
 * Exports both the composable and direct access functions
 */
const [labelsVisible, setLabelsVisible] = useLocalStorage('ha_dashboard_labels_visible', true);

/**
 * Composable function for Vue components
 */
export function useLabelsVisibility() {
  return {
    labelsVisible,
    setLabelsVisible,
    toggleLabels: () => setLabelsVisible(!labelsVisible.value)
  };
}

/**
 * Direct exports for non-Vue contexts (like dashboard.js)
 */
export { labelsVisible, setLabelsVisible };

