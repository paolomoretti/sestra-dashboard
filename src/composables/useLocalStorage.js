import { ref, watch } from 'vue';

/**
 * Composable for localStorage with Vue reactivity
 * @param {string} key - localStorage key
 * @param {any} defaultValue - default value if key doesn't exist
 * @returns {[Ref, Function]} - tuple of [ref, setter]
 */
export function useLocalStorage(key, defaultValue) {
  // Read from localStorage
  const stored = localStorage.getItem(key);
  const initialValue = stored ? JSON.parse(stored) : defaultValue;
  
  const state = ref(initialValue);
  
  // Watch for changes and sync to localStorage
  watch(state, (newValue) => {
    try {
      if (newValue === null || newValue === undefined) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, JSON.stringify(newValue));
      }
    } catch (error) {
      console.error(`Error saving to localStorage for key "${key}":`, error);
    }
  }, { deep: true });
  
  // Setter function
  const setValue = (value) => {
    state.value = value;
  };
  
  return [state, setValue];
}
