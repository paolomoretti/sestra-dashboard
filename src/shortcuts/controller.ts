import { computed, shallowReactive } from 'vue';
import { shortcuts, type ShortcutDefinition } from './catalog';

export interface ShortcutBinding {
  readonly shortcut: ShortcutDefinition;
  readonly handler: () => void;
  readonly enabled?: () => boolean;
}

export const shortcutLayerPriority = {
  canvas: 20,
  menu: 30,
  editor: 40,
  modal: 50,
  help: 60,
} as const;

interface ShortcutLayer {
  readonly close: () => void;
  readonly priority: number;
}

export function matchesShortcut(event: KeyboardEvent, shortcut: ShortcutDefinition): boolean {
  return (
    !event.defaultPrevented &&
    !event.isComposing &&
    event.keyCode !== 229 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.altKey &&
    (!event.repeat || shortcut.repeat === true) &&
    shortcut.keys.some(key => key.toLowerCase() === event.key.toLowerCase())
  );
}

function isEditing(event: KeyboardEvent): boolean {
  return event
    .composedPath()
    .some(
      target =>
        target instanceof HTMLElement &&
        (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
          target.isContentEditable ||
          ['textbox', 'combobox'].includes(target.getAttribute('role') ?? ''))
    );
}

export function createShortcutController() {
  const providers = shallowReactive(new Set<() => readonly ShortcutBinding[]>());
  const layers = shallowReactive<ShortcutLayer[]>([]);
  const topLayer = computed(() =>
    layers.reduce<ShortcutLayer | undefined>(
      (top, layer) => (!top || layer.priority >= top.priority ? layer : top),
      undefined
    )
  );
  const catalog = computed(() => {
    const definitions = new Map<string, ShortcutDefinition>(
      Object.values(shortcuts).map(shortcut => [shortcut.id, shortcut])
    );
    for (const provider of providers) {
      for (const binding of provider()) definitions.set(binding.shortcut.id, binding.shortcut);
    }
    return [...definitions.values()];
  });

  function register(provider: () => readonly ShortcutBinding[]): () => void {
    providers.add(provider);
    return () => {
      providers.delete(provider);
    };
  }

  function openLayer(layer: ShortcutLayer) {
    layers.push(layer);
    return {
      zIndex: computed(() => 10000 + layer.priority * 1000 + layers.indexOf(layer)),
      isActive: computed(() => topLayer.value === layer),
      dispose: () => {
        const index = layers.indexOf(layer);
        if (index >= 0) layers.splice(index, 1);
      },
    };
  }

  function dispatch(event: KeyboardEvent): void {
    if (topLayer.value && matchesShortcut(event, shortcuts.closePanel)) {
      event.preventDefault();
      event.stopPropagation();
      topLayer.value.close();
      return;
    }
    if (isEditing(event)) return;
    for (const provider of providers) {
      for (const binding of provider()) {
        if (topLayer.value && binding.shortcut.scope !== 'application') continue;
        if (binding.shortcut.scope === 'control' || binding.shortcut.scope === 'panel') continue;
        if (
          binding.shortcut.unavailableReason ||
          binding.enabled?.() === false ||
          !matchesShortcut(event, binding.shortcut)
        )
          continue;
        event.preventDefault();
        event.stopPropagation();
        binding.handler();
        return;
      }
    }
  }

  return { catalog, register, openLayer, dispatch };
}
