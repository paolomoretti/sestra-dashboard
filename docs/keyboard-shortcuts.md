# Change keyboard shortcuts

Read this guide before changes to shortcuts, keyboard events, panel dismissal, or focused control navigation.

## Add or edit a shortcut

1. Read `src/shortcuts/catalog.ts` and the action's current owner.
2. Add or edit a definition in `shortcuts`.
3. Set a stable ID, keys, name, description, group, context, and scope.
4. Bind the definition to an action with `useHotkeys` in the component that owns the action.
5. Use an `enabled` callback when the action needs selection or other state.
6. Set `repeat: true` only for actions that can safely repeat.
7. Run the focused shortcut checks.
8. Open Settings > Keyboard shortcuts and verify the generated row.

```ts
useHotkeys([{ shortcut: shortcuts.zoomIn, handler: zoomIn }]);
```

The catalog panel reads the same definitions as dispatch.
Do not add a separate list of shortcut names, keys, or descriptions to the panel.
Fixed definitions stay visible when their controls are not mounted.

## Add a panel or editor

1. Register its visible state with `useShortcutLayer`.
2. Supply the close action.
3. Choose `canvas`, `menu`, `editor`, `modal`, or `help` to match its visual layer.
4. Apply the returned `zIndex` to the element that creates the panel's stacking context.
5. Check the returned `isActive` before handling custom keys inside the panel.
6. Verify Escape closes only the top active layer.
7. Verify dashboard keys pause for the full open lifetime.

```ts
const { zIndex, isActive } = useShortcutLayer(
  () => props.isOpen,
  () => emit('close'),
  'modal'
);
```

`App.vue` calls `provideShortcuts()` once.
`src/composables/useHotkeys.ts` owns the only document keydown listener.
The controller owns event guards, panel priority, opening order, and dispatch.
`canvas` covers zone and inline label editors inside the transformed floor plan.
These editors stay below floating menus and the fixed widget editor.
The Vue adapter removes registrations when their component scope ends.
Do not add document or window key listeners to components.

## Change a focused control

1. Define its custom action with `scope: 'control'` in the catalog.
2. Keep the keydown handler on the focused control.
3. Return when the control's layer has `isActive.value === false`.
4. Match the key with `matchesShortcut(event, shortcuts.selectOption)`.
5. Call `event.preventDefault()` when the handler uses the key.
6. Verify the event does not also trigger a panel or dashboard action.

Native Tab navigation, button activation, and select navigation stay native.
Zone key input validation stays local because it checks input rather than invokes a shortcut.
Allow Escape and native cursor movement through that input.

## Change a zone key

1. Use `getZoneShortcuts` to generate metadata and bindings from current zones.
2. Use `getZoneShortcutError` before saving an assignment.
3. Keep the stored zone ID as the dynamic shortcut ID.
4. Verify zone renames, key edits, and deletions update the catalog.
5. Reject new keys that conflict with a fixed shortcut or another zone.

Zone keys use one letter or number.
Fixed keys take priority over old conflicting zone keys.
The first zone in the current array retains an old duplicate key.
Other conflicting rows stay in the catalog with an explanation.
Do not rewrite saved zones to resolve old conflicts.

## Remove a shortcut

1. Remove its action binding.
2. Remove its fixed definition if no control uses it.
3. Remove unused local handlers.
4. Verify its row is absent from the catalog.
5. Update tests for the removed behavior.

## Verify behavior

1. Run `npm run test:shortcuts`.
2. Run `~/.conductor/bin/serialized-type-check bun run type-check` when the change needs a type check.
3. Open the catalog from Settings and with `?`.
4. Verify names, descriptions, groups, keys, and contexts.
5. Test inputs, textareas, selects, nested contenteditable elements, and custom textbox controls.
6. Test Ctrl, Command, Alt, composition, and held keys.
7. Open two layers and verify one Escape closes only the top layer.
8. Verify confirmed deletion still affects only the selected item.
9. Inspect changed text for visible indentation or blank first lines.

Run expensive checks one at a time.
Use the serialized wrapper for every type check.

The matcher uses the produced `event.key`, rather than a physical key position.
Letter keys remain case insensitive, including Shift.
Shift can produce `+` and `?` on layouts that require it.
Ctrl, Command, Alt, IME composition, and already handled events do not invoke shortcuts.
Zoom and option navigation can repeat.
Deletion, selection clearing, panel close, and confirmation do not repeat.
Escape works in panel inputs unless a local control uses it first.
Entity search uses the first Escape to clear its query or highlight.
A later Escape closes the panel.
Enter saves a text label through its existing save-on-exit watcher.
