import { ref, type Ref, watch } from 'vue';

/**
 * Composable for localStorage with Vue reactivity
 * @param key - localStorage key
 * @param defaultValue - default value if key doesn't exist
 * @returns tuple of [ref, setter]
 */
export function useLocalStorage<T>(key: string, defaultValue: T): [Ref<T>, (value: T) => void] {
  // Read from localStorage
  const stored = localStorage.getItem(key);
  const initialValue = stored ? JSON.parse(stored) : defaultValue;
  
  const state = ref<T>(initialValue) as Ref<T>;
  
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
  const setValue = (value: T): void => {
    state.value = value;
  };
  
  return [state, setValue];
}

