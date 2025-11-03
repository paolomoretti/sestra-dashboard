import { onMounted, onUnmounted, type Ref } from 'vue';

export interface HotkeyHandler {
  key: string;
  handler: (event: KeyboardEvent) => void;
  description?: string;
  // Whether to prevent default behavior
  preventDefault?: boolean;
  // Whether to stop propagation
  stopPropagation?: boolean;
}

/**
 * Composable for handling global keyboard shortcuts
 * Only triggers when not typing in input fields
 */
export function useHotkeys(handlers: HotkeyHandler[]): void {
  let handler: ((event: KeyboardEvent) => void) | null = null;

  onMounted(() => {
    handler = (event: KeyboardEvent) => {
      // Don't trigger hotkeys when user is typing in input fields
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // Find matching handler
      const matchedHandler = handlers.find(h => {
        // Case-insensitive key matching
        return h.key.toLowerCase() === event.key.toLowerCase();
      });

      if (matchedHandler) {
        if (matchedHandler.preventDefault) {
          event.preventDefault();
        }
        if (matchedHandler.stopPropagation) {
          event.stopPropagation();
        }
        matchedHandler.handler(event);
      }
    };

    document.addEventListener('keydown', handler);
  });

  onUnmounted(() => {
    if (handler) {
      document.removeEventListener('keydown', handler);
    }
  });
}

