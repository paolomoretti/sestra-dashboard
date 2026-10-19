import {
  computed,
  inject,
  onMounted,
  onScopeDispose,
  onUnmounted,
  provide,
  shallowRef,
  toValue,
  watch,
  type InjectionKey,
  type MaybeRefOrGetter,
} from 'vue';
import {
  createShortcutController,
  shortcutLayerPriority,
  type ShortcutBinding,
} from '../shortcuts/controller';

const shortcutControllerKey: InjectionKey<ReturnType<typeof createShortcutController>> =
  Symbol('shortcuts');

export function provideShortcuts() {
  const controller = createShortcutController();
  provide(shortcutControllerKey, controller);
  onMounted(() => document.addEventListener('keydown', controller.dispatch));
  onUnmounted(() => document.removeEventListener('keydown', controller.dispatch));
  return controller;
}

export function useShortcutController() {
  const controller = inject(shortcutControllerKey);
  if (!controller) throw new Error('Call provideShortcuts() in an ancestor component.');
  return controller;
}

export function useHotkeys(bindings: MaybeRefOrGetter<readonly ShortcutBinding[]>): void {
  const controller = useShortcutController();
  onScopeDispose(controller.register(() => toValue(bindings)));
}

export function useShortcutLayer(
  open: MaybeRefOrGetter<boolean>,
  close: () => void,
  kind: keyof typeof shortcutLayerPriority = 'editor'
) {
  const controller = useShortcutController();
  const activeLayer = shallowRef<ReturnType<typeof controller.openLayer>>();
  watch(
    () => toValue(open),
    (isOpen, _previous, onCleanup) => {
      activeLayer.value = undefined;
      if (isOpen) {
        const layer = controller.openLayer({ close, priority: shortcutLayerPriority[kind] });
        activeLayer.value = layer;
        onCleanup(layer.dispose);
      }
    },
    { immediate: true, flush: 'sync' }
  );
  return {
    zIndex: computed(() => activeLayer.value?.zIndex.value),
    isActive: computed(() => activeLayer.value?.isActive.value === true),
  };
}
