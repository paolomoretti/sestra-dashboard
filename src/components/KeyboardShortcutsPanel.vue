<template>
  <dialog ref="dialog" class="shortcuts-dialog" aria-labelledby="shortcuts-title" @cancel.prevent @click="handleBackdropClick">
    <header class="shortcuts-header">
      <div>
        <h2 id="shortcuts-title">Keyboard shortcuts</h2>
        <p>Use these keys outside text fields unless a context is shown.</p>
      </div>
      <button type="button" class="close-button" aria-label="Close keyboard shortcuts" autofocus @click="emit('close')">×</button>
    </header>
    <div class="shortcuts-content">
      <section v-for="group in groups" :key="group.name" :aria-label="group.name">
        <h3>{{ group.name }}</h3>
        <ul>
          <li v-for="shortcut in group.shortcuts" :key="shortcut.id">
            <div class="shortcut-heading">
              <span class="shortcut-name">{{ shortcut.name }}</span>
              <span class="shortcut-keys"><kbd v-for="key in shortcut.keys" :key="key">{{ formatShortcutKey(key) }}</kbd></span>
            </div>
            <p>{{ shortcut.description }}</p>
            <span class="shortcut-context">{{ shortcut.context }}</span>
            <p v-if="shortcut.unavailableReason" class="shortcut-warning">{{ shortcut.unavailableReason }}</p>
          </li>
        </ul>
        <p v-if="group.shortcuts.length === 0" class="empty-zones">{{ emptyZonesText }}</p>
      </section>
    </div>
    <footer>{{ footerText }}</footer>
  </dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useShortcutController, useShortcutLayer } from '../composables/useHotkeys';
import { formatShortcutKey, type ShortcutDefinition } from '../shortcuts/catalog';

const emptyZonesText = 'No zone keys are assigned. Set a key in a zone editor.';
const footerText = 'Dashboard keys pause while a panel is open. Ctrl, Command, and Alt combinations keep their normal behavior.';

const props = defineProps<{ isOpen: boolean }>();
const emit = defineEmits<{ close: [] }>();
const dialog = ref<HTMLDialogElement>();
const { catalog } = useShortcutController();
const groupNames: ShortcutDefinition['group'][] = ['View', 'Editing', 'Panels', 'Zones'];
const groups = computed(() =>
  groupNames.map(name => ({
    name,
    shortcuts: catalog.value.filter(shortcut => shortcut.group === name),
  }))
);

useShortcutLayer(
  () => props.isOpen,
  () => emit('close'),
  'help'
);

watch(
  [() => props.isOpen, dialog],
  ([open, element]) => {
    if (open && !element?.open) element?.showModal();
    else if (!open) element?.close();
  },
  { flush: 'post' }
);

function handleBackdropClick(event: MouseEvent) {
  if (event.target !== dialog.value) return;
  const bounds = dialog.value.getBoundingClientRect();
  if (
    event.clientX < bounds.left ||
    event.clientX > bounds.right ||
    event.clientY < bounds.top ||
    event.clientY > bounds.bottom
  )
    emit('close');
}
</script>

<style scoped>
.shortcuts-dialog {
  width: min(640px, calc(100vw - 32px));
  max-height: min(840px, calc(100dvh - 32px));
  margin: auto;
  padding: 0;
  border: 1px solid #4a4a4a;
  border-radius: 12px;
  background: #252525;
  color: #f5f5f5;
  box-shadow: 0 24px 80px #0008;
  white-space: normal;
}
.shortcuts-dialog[open] { display: flex; flex-direction: column; }
.shortcuts-dialog::backdrop { background: #0009; backdrop-filter: blur(4px); }
.shortcuts-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 24px; border-bottom: 1px solid #444; }
h2 { margin: 0; font-size: 21px; font-weight: 600; }
.shortcuts-header p { margin: 8px 0 0; color: #bbb; font-size: 13px; }
.close-button { border: 0; border-radius: 4px; background: transparent; color: #ddd; cursor: pointer; font-size: 28px; line-height: 1; padding: 2px 6px; }
.close-button:focus-visible { outline: 2px solid #60a5fa; outline-offset: 4px; }
.shortcuts-content { overflow-y: auto; padding: 0 24px 20px; }
h3 { margin: 22px 0 6px; color: #93b9f5; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; }
ul { list-style: none; margin: 0; padding: 0; }
li { padding: 14px 0; border-bottom: 1px solid #ffffff10; }
.shortcut-heading { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.shortcut-name { font-size: 14px; font-weight: 500; }
.shortcut-keys { display: flex; gap: 6px; }
kbd { min-width: 28px; padding: 3px 8px; border: 1px solid #666; border-bottom-width: 2px; border-radius: 5px; background: #333; text-align: center; font: 12px monospace; }
li p, .empty-zones { margin: 6px 0 0; color: #bbb; font-size: 13px; }
.shortcut-context { display: block; margin-top: 4px; color: #999; font-size: 12px; }
li .shortcut-warning { color: #fbbf24; }
footer { padding: 16px 24px; border-top: 1px solid #444; color: #aaa; font-size: 12px; }
@media (max-width: 480px) { .shortcuts-header, footer { padding: 16px; } .shortcuts-content { padding: 0 16px 16px; } }
</style>
