import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { Window } from 'happy-dom';
import { getZoneShortcutError, getZoneShortcuts, shortcuts } from '../src/shortcuts/catalog';

const browser = new Window({ url: 'http://localhost' });
for (const name of ['window', 'document', 'HTMLElement', 'Element', 'SVGElement', 'Node']) {
  Object.defineProperty(globalThis, name, {
    configurable: true,
    value: name === 'window' ? browser : Reflect.get(browser, name),
  });
}
const { createApp, defineComponent, h, nextTick, ref } = await import('vue');
const { createShortcutController, matchesShortcut, shortcutLayerPriority } = await import(
  '../src/shortcuts/controller'
);
const { provideShortcuts, useHotkeys, useShortcutLayer } = await import(
  '../src/composables/useHotkeys'
);

type Controller = ReturnType<typeof createShortcutController>;
function press(key: string, target = browser.document.body, options: KeyboardEventInit = {}) {
  const event = new browser.KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...options,
  });
  target.dispatchEvent(event);
  return event;
}
function listen(controller: Controller, context: TestContext) {
  browser.document.addEventListener('keydown', controller.dispatch);
  context.after(() => browser.document.removeEventListener('keydown', controller.dispatch));
  browser.document.body.innerHTML = '';
}

test('existing zoom keys and shifted letter aliases invoke one action each', context => {
  const controller = createShortcutController();
  listen(controller, context);
  const actions: string[] = [];
  controller.register(() =>
    [shortcuts.fitScreen, shortcuts.fitWidth, shortcuts.zoomIn, shortcuts.zoomOut].map(
      shortcut => ({
        shortcut,
        handler: () => actions.push(shortcut.id),
      })
    )
  );
  for (const key of ['z', 'Z', 'w', '+', '=', '-']) assert.equal(press(key).defaultPrevented, true);
  assert.deepEqual(actions, [
    'fit-screen',
    'fit-screen',
    'fit-width',
    'zoom-in',
    'zoom-in',
    'zoom-out',
  ]);
});

test('modifiers, composition, dead keys, consumed events, and held destructive keys do not dispatch', context => {
  const controller = createShortcutController();
  listen(controller, context);
  let calls = 0;
  controller.register(() => [{ shortcut: shortcuts.deleteSelection, handler: () => calls++ }]);
  for (const options of [
    { ctrlKey: true },
    { metaKey: true },
    { altKey: true },
    { isComposing: true },
    { keyCode: 229 },
    { repeat: true },
  ]) {
    assert.equal(press('Delete', undefined, options).defaultPrevented, false);
  }
  const consumed = new browser.KeyboardEvent('keydown', {
    key: 'Delete',
    bubbles: true,
    cancelable: true,
  });
  consumed.preventDefault();
  browser.document.body.dispatchEvent(consumed);
  press('Dead');
  assert.equal(calls, 0);
  press('Delete');
  assert.equal(calls, 1);
});

test('repeated zoom and option navigation are allowed explicitly', context => {
  const controller = createShortcutController();
  listen(controller, context);
  let calls = 0;
  controller.register(() => [{ shortcut: shortcuts.zoomIn, handler: () => calls++ }]);
  press('+', undefined, { shiftKey: true, repeat: true });
  assert.equal(calls, 1);
  const event = new browser.KeyboardEvent('keydown', { key: 'ArrowDown', repeat: true });
  assert.equal(matchesShortcut(event, shortcuts.nextOption), true);
  assert.equal(
    matchesShortcut(
      new browser.KeyboardEvent('keydown', { key: 'Enter', isComposing: true }),
      shortcuts.selectOption
    ),
    false
  );
});

test('editable controls and editable ancestors block dashboard shortcuts', context => {
  const controller = createShortcutController();
  listen(controller, context);
  let calls = 0;
  controller.register(() => [{ shortcut: shortcuts.fitScreen, handler: () => calls++ }]);
  for (const html of [
    '<input>',
    '<textarea></textarea>',
    '<select></select>',
    '<div contenteditable="true"><span></span></div>',
    '<div role="textbox"><span></span></div>',
    '<div role="combobox"><span></span></div>',
  ]) {
    browser.document.body.innerHTML = html;
    const target =
      browser.document.body.querySelector('span') ?? browser.document.body.firstElementChild;
    assert.ok(target);
    press('z', target);
  }
  assert.equal(calls, 0);
  browser.document.body.innerHTML = '';
  press('z');
  assert.equal(calls, 1);
});

test('a focused control can consume Escape before panel dismissal', context => {
  const controller = createShortcutController();
  listen(controller, context);
  let closes = 0;
  controller.openLayer({ priority: shortcutLayerPriority.editor, close: () => closes++ });
  const input = browser.document.createElement('input');
  browser.document.body.append(input);
  const consume = (event: KeyboardEvent) => event.preventDefault();
  input.addEventListener('keydown', consume);
  press('Escape', input);
  assert.equal(closes, 0);
  input.removeEventListener('keydown', consume);
  press('Escape', input);
  assert.equal(closes, 1);
});

test('layers block background commands and Escape closes only the visible top layer', context => {
  const controller = createShortcutController();
  listen(controller, context);
  const actions: string[] = [];
  controller.register(() =>
    [
      shortcuts.fitScreen,
      shortcuts.deleteSelection,
      shortcuts.clearSelection,
      shortcuts.showShortcuts,
    ].map(shortcut => ({
      shortcut,
      handler: () => actions.push(shortcut.id),
    }))
  );
  const editor = controller.openLayer({
    priority: shortcutLayerPriority.editor,
    close: () => {
      actions.push('editor');
      editor.dispose();
    },
  });
  const modal = controller.openLayer({
    priority: shortcutLayerPriority.modal,
    close: () => {
      actions.push('modal');
      modal.dispose();
    },
  });
  const secondEditor = controller.openLayer({
    priority: shortcutLayerPriority.editor,
    close: () => {
      actions.push('second-editor');
      secondEditor.dispose();
    },
  });
  assert.ok(modal.zIndex.value > secondEditor.zIndex.value);
  press('z');
  press('Delete');
  press('Escape', undefined, { repeat: true });
  assert.deepEqual(actions, []);
  press('?');
  press('Escape');
  assert.deepEqual(actions, ['show-shortcuts', 'modal']);
  assert.ok(secondEditor.zIndex.value > editor.zIndex.value);
  press('Escape');
  press('Escape');
  press('Escape');
  assert.deepEqual(actions, [
    'show-shortcuts',
    'modal',
    'second-editor',
    'editor',
    'clear-selection',
  ]);
});

test('disabled and unregistered actions keep their native behavior', context => {
  const controller = createShortcutController();
  listen(controller, context);
  let enabled = false;
  let calls = 0;
  const dispose = controller.register(() => [
    { shortcut: shortcuts.deleteSelection, handler: () => calls++, enabled: () => enabled },
  ]);
  assert.equal(press('Delete').defaultPrevented, false);
  enabled = true;
  assert.equal(press('Delete').defaultPrevented, true);
  dispose();
  assert.equal(press('Delete').defaultPrevented, false);
  assert.equal(calls, 1);
});

test('zone catalog follows live names, keys, deletion, and provider cleanup', context => {
  const controller = createShortcutController();
  listen(controller, context);
  const zones = ref([{ id: 'one', label: 'Kitchen', shortcutKey: '1' }]);
  const calls: string[] = [];
  const dispose = controller.register(() =>
    getZoneShortcuts(zones.value).map(({ zoneId, shortcut }) => ({
      shortcut,
      handler: () => calls.push(zoneId),
    }))
  );
  assert.equal(
    controller.catalog.value.find(shortcut => shortcut.id === 'zone:one')?.name,
    'Kitchen'
  );
  press('1');
  zones.value = [{ id: 'one', label: 'Dining room', shortcutKey: '2' }];
  assert.equal(
    controller.catalog.value.find(shortcut => shortcut.id === 'zone:one')?.name,
    'Dining room'
  );
  assert.equal(press('1').defaultPrevented, false);
  press('2');
  zones.value = [];
  assert.equal(
    controller.catalog.value.some(shortcut => shortcut.group === 'Zones'),
    false
  );
  assert.equal(press('2').defaultPrevented, false);
  dispose();
  assert.deepEqual(calls, ['one', 'one']);
});

test('old zone conflicts stay visible but only the first valid zone can run', context => {
  const controller = createShortcutController();
  listen(controller, context);
  const zones = [
    { id: 'reserved', label: 'Reserved', shortcutKey: 'Z' },
    { id: 'first', label: 'First', shortcutKey: '1' },
    { id: 'duplicate', label: 'Duplicate', shortcutKey: '1' },
  ];
  const rows = getZoneShortcuts(zones);
  assert.match(rows[0]!.shortcut.unavailableReason!, /reserved/);
  assert.equal(rows[1]!.shortcut.unavailableReason, undefined);
  assert.match(rows[2]!.shortcut.unavailableReason!, /already uses/);
  const calls: string[] = [];
  controller.register(() =>
    rows.map(({ zoneId, shortcut }) => ({ shortcut, handler: () => calls.push(zoneId) }))
  );
  press('z');
  press('1');
  assert.deepEqual(calls, ['first']);
  assert.equal(getZoneShortcutError('', 'first', zones), null);
  assert.equal(getZoneShortcutError('1', 'first', [zones[1]!]), null);
  assert.match(getZoneShortcutError('w', 'first', zones)!, /reserved/);
  assert.match(getZoneShortcutError('1', 'new', zones)!, /already uses/);
});

test('Vue scopes clean up bindings and layers, reopen in order, and remove the app listener', async () => {
  browser.document.body.innerHTML = '<div id="mount"></div>';
  const visible = ref(true);
  const first = ref(false);
  const second = ref(false);
  const calls: string[] = [];
  const Child = defineComponent({
    setup() {
      useHotkeys([{ shortcut: shortcuts.fitScreen, handler: () => calls.push('zoom') }]);
      useShortcutLayer(
        first,
        () => {
          calls.push('first');
          first.value = false;
        },
        'modal'
      );
      useShortcutLayer(
        second,
        () => {
          calls.push('second');
          second.value = false;
        },
        'modal'
      );
      return () => h('div');
    },
  });
  const Root = defineComponent({
    setup() {
      provideShortcuts();
      return () => (visible.value ? h(Child) : null);
    },
  });
  const app = createApp(Root);
  app.mount('#mount');
  press('z');
  first.value = true;
  second.value = true;
  press('Escape');
  second.value = true;
  first.value = false;
  first.value = true;
  press('Escape');
  assert.deepEqual(calls, ['zoom', 'second', 'first']);
  visible.value = false;
  await nextTick();
  assert.equal(press('z').defaultPrevented, false);
  assert.equal(press('Escape').defaultPrevented, false);
  visible.value = true;
  second.value = false;
  await nextTick();
  press('z');
  app.unmount();
  assert.equal(press('z').defaultPrevented, false);
  assert.deepEqual(calls, ['zoom', 'second', 'first', 'zoom']);
});

test('catalog metadata is complete and has no visible whitespace', () => {
  const definitions = Object.values(shortcuts);
  assert.equal(new Set(definitions.map(shortcut => shortcut.id)).size, definitions.length);
  for (const shortcut of definitions) {
    for (const text of [
      shortcut.id,
      shortcut.name,
      shortcut.description,
      shortcut.context,
      shortcut.group,
      ...shortcut.keys,
    ]) {
      assert.ok(text.length > 0);
      assert.equal(text.trim(), text);
    }
  }
});

test('components cannot add document or window keyboard listeners outside the shared adapter', () => {
  for (const path of readdirSync(new URL('../src/', import.meta.url), { recursive: true })) {
    if (
      typeof path !== 'string' ||
      !/\.(vue|ts|tsx)$/.test(path) ||
      path === 'composables/useHotkeys.ts'
    )
      continue;
    const source = readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
    assert.doesNotMatch(
      source,
      /(?:document|window)\s*\.\s*addEventListener\s*\(\s*['"]key(?:down|up|press)['"]/,
      path
    );
  }
});

test('focused controls in a covered editor leave Escape for the active modal', async () => {
  browser.document.body.innerHTML = '<div id="mount"></div>';
  const modalOpen = ref(true);
  const calls: string[] = [];
  const Child = defineComponent({
    setup() {
      const { isActive } = useShortcutLayer(true, () => calls.push('editor'));
      useShortcutLayer(
        modalOpen,
        () => {
          calls.push('modal');
          modalOpen.value = false;
        },
        'modal'
      );
      return () =>
        h('input', {
          onKeydown: (event: KeyboardEvent) => {
            if (!isActive.value || !matchesShortcut(event, shortcuts.closePanel)) return;
            event.preventDefault();
            calls.push('local-editor');
          },
        });
    },
  });
  const Root = defineComponent({
    setup() {
      provideShortcuts();
      return () => h(Child);
    },
  });
  const app = createApp(Root);
  app.mount('#mount');
  const input = browser.document.querySelector('input');
  assert.ok(input);
  press('Escape', input);
  assert.deepEqual(calls, ['modal']);
  press('Escape', input);
  assert.deepEqual(calls, ['modal', 'local-editor']);
  app.unmount();
  await nextTick();
});

test('fixed editors stay above canvas editors even when a canvas editor opens later', context => {
  const controller = createShortcutController();
  listen(controller, context);
  const calls: string[] = [];
  const editor = controller.openLayer({
    priority: shortcutLayerPriority.editor,
    close: () => {
      calls.push('fixed');
      editor.dispose();
    },
  });
  const canvas = controller.openLayer({
    priority: shortcutLayerPriority.canvas,
    close: () => {
      calls.push('canvas');
      canvas.dispose();
    },
  });
  assert.equal(editor.isActive.value, true);
  assert.equal(canvas.isActive.value, false);
  press('Escape');
  assert.equal(canvas.isActive.value, true);
  press('Escape');
  assert.deepEqual(calls, ['fixed', 'canvas']);
});
