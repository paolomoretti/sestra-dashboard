import { ref, watch } from 'vue';
import { useLocalStorage } from './useLocalStorage.js';

/**
 * Composable for managing sidebar panel states
 */
export function useSidebarState() {
  const [paletteCollapsed, setPaletteCollapsed] = useLocalStorage('paletteCollapsed', false);
  const [eventLogCollapsed, setEventLogCollapsed] = useLocalStorage('eventLogCollapsed', false);

  return {
    paletteCollapsed,
    setPaletteCollapsed,
    eventLogCollapsed,
    setEventLogCollapsed
  };
}
