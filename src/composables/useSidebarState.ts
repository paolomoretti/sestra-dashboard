import { useLocalStorage } from './useLocalStorage';
import type { Ref } from 'vue';

/**
 * Composable for managing sidebar panel states
 */
export function useSidebarState() {
  const [paletteCollapsed, setPaletteCollapsed] = useLocalStorage<boolean>('paletteCollapsed', false);
  const [eventLogCollapsed, setEventLogCollapsed] = useLocalStorage<boolean>('eventLogCollapsed', false);

  return {
    paletteCollapsed,
    setPaletteCollapsed,
    eventLogCollapsed,
    setEventLogCollapsed
  };
}

