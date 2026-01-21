# Design Decisions & Critical Logic

## Entity Widget Resizing Logic

### Problem History

The resize functionality has been broken multiple times due to:

1.  **Variable Shadowing**: A local ref `isEditing` (intended for text label editing) shadowed the prop `isEditing` (intended for global edit mode state), causing resize handles to hide.
2.  **Logic Gaps**: Resize handles were only shown when the "Edit Panel" was open (via the pencil icon), but users expect to resize immediately upon selection in global edit mode.

### Current Implementation (Use This!)

- **Global Edit Mode**: Controls whether the dashboard is in a state where widgets can be moved/resized.
- **Selection**: A widget is selected when clicked.
- **Resize Visibility**: Resize handles must be visible when:
  - `isGlobalEditMode` is `true`
  - `isSelected` is `true`
  - This is encapsulated in the `canResize` computed property.

### Rules for Future Changes

1.  **Do NOT** use `isEditing` (prop) alone to determine resize handle visibility.
2.  **Do NOT** name local variables `isEditing` in `EntityWidget.vue`. Use specific names like `isTextEditing`.
3.  **Always** use the `canResize` computed property for `v-if` on resize handles.

```typescript
// Correct Logic in EntityWidget.vue
const canResize = computed(() => isGlobalEditMode.value && isSelected.value);
```

## Testing

Currently, there is no automated test suite. Regression testing is manual:

1.  Enable "Edit Mode" in the dashboard.
2.  Click a widget (Action Button, Image, etc.) to select it.
3.  **Verify**: 4 resize handles (corners) appear immediately.
4.  **Verify**: Dragging a handle resizes the widget.
