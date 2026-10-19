export interface ShortcutDefinition {
  readonly id: string;
  readonly keys: readonly string[];
  readonly name: string;
  readonly description: string;
  readonly group: 'View' | 'Editing' | 'Panels' | 'Zones';
  readonly context: string;
  readonly scope: 'dashboard' | 'application' | 'panel' | 'control';
  readonly repeat?: boolean;
  readonly unavailableReason?: string;
}

export const shortcuts = {
  fitScreen: {
    id: 'fit-screen',
    keys: ['z'],
    name: 'Fit to screen',
    description: 'Fit the floor plan in the available space.',
    group: 'View',
    context: 'Dashboard',
    scope: 'dashboard',
  },
  fitWidth: {
    id: 'fit-width',
    keys: ['w'],
    name: 'Fit to width',
    description: 'Fit the floor plan to the dashboard width.',
    group: 'View',
    context: 'Dashboard',
    scope: 'dashboard',
  },
  zoomIn: {
    id: 'zoom-in',
    keys: ['+', '='],
    name: 'Zoom in',
    description: 'Increase the floor plan zoom.',
    group: 'View',
    context: 'Dashboard',
    scope: 'dashboard',
    repeat: true,
  },
  zoomOut: {
    id: 'zoom-out',
    keys: ['-'],
    name: 'Zoom out',
    description: 'Decrease the floor plan zoom.',
    group: 'View',
    context: 'Dashboard',
    scope: 'dashboard',
    repeat: true,
  },
  clearSelection: {
    id: 'clear-selection',
    keys: ['Escape'],
    name: 'Clear selection',
    description: 'Deselect the current widget or zone.',
    group: 'Editing',
    context: 'Dashboard with no open panel',
    scope: 'dashboard',
  },
  deleteSelection: {
    id: 'delete-selection',
    keys: ['Backspace', 'Delete'],
    name: 'Delete selection',
    description: 'Ask for confirmation before deleting the selected widget or zone.',
    group: 'Editing',
    context: 'Selected widget or zone',
    scope: 'dashboard',
  },
  showShortcuts: {
    id: 'show-shortcuts',
    keys: ['?'],
    name: 'Keyboard shortcuts',
    description: 'Show this shortcut catalog.',
    group: 'Panels',
    context: 'Outside text fields',
    scope: 'application',
  },
  closePanel: {
    id: 'close-panel',
    keys: ['Escape'],
    name: 'Close panel',
    description: 'Close the top active panel, menu, or editor.',
    group: 'Panels',
    context: 'Open panel, including its text fields',
    scope: 'panel',
  },
  finishLabel: {
    id: 'finish-label',
    keys: ['Enter'],
    name: 'Save text label',
    description: 'Save the label text and close its inline editor.',
    group: 'Editing',
    context: 'Text label input',
    scope: 'control',
  },
  previousOption: {
    id: 'previous-option',
    keys: ['ArrowUp'],
    name: 'Previous option',
    description: 'Highlight the previous entity or icon option.',
    group: 'Editing',
    context: 'Entity search, icon search, or icon list',
    scope: 'control',
    repeat: true,
  },
  nextOption: {
    id: 'next-option',
    keys: ['ArrowDown'],
    name: 'Next option',
    description: 'Highlight the next entity or icon option.',
    group: 'Editing',
    context: 'Entity search, icon search, or icon list',
    scope: 'control',
    repeat: true,
  },
  selectOption: {
    id: 'select-option',
    keys: ['Enter'],
    name: 'Select option',
    description: 'Use the highlighted entity or icon.',
    group: 'Editing',
    context: 'Entity search or icon list',
    scope: 'control',
  },
  clearEntitySearch: {
    id: 'clear-entity-search',
    keys: ['Escape'],
    name: 'Clear entity search',
    description: 'Clear the entity search before closing the panel.',
    group: 'Editing',
    context: 'Entity search with text or a highlighted option',
    scope: 'control',
  },
} as const satisfies Record<string, ShortcutDefinition>;

export interface ShortcutZone {
  readonly id: string;
  readonly label: string;
  readonly shortcutKey?: string | undefined;
}

export interface ZoneShortcut {
  readonly zoneId: string;
  readonly shortcut: ShortcutDefinition;
}

export function getZoneShortcutError(
  key: string,
  zoneId: string,
  zones: readonly ShortcutZone[]
): string | null {
  if (!key) return null;
  if (!/^[a-z0-9]$/.test(key)) return 'Use one letter or number.';
  if (
    Object.values(shortcuts).some(shortcut =>
      shortcut.keys.some(value => value.toLowerCase() === key)
    )
  ) {
    return 'This key is reserved for an app shortcut.';
  }
  if (zones.some(zone => zone.id !== zoneId && zone.shortcutKey?.trim().toLowerCase() === key)) {
    return 'Another zone already uses this key.';
  }
  return null;
}

export function getZoneShortcuts(zones: readonly ShortcutZone[]): ZoneShortcut[] {
  const accepted: ShortcutZone[] = [];
  return zones
    .filter(zone => zone.shortcutKey?.trim())
    .map(zone => {
      const key = zone.shortcutKey?.trim().toLowerCase() ?? '';
      const unavailableReason = getZoneShortcutError(key, zone.id, accepted);
      if (!unavailableReason) accepted.push(zone);
      return {
        zoneId: zone.id,
        shortcut: {
          id: `zone:${zone.id}`,
          keys: [key],
          name: zone.label || 'Unnamed zone',
          description: `Zoom to ${zone.label || 'this zone'}.`,
          group: 'Zones',
          context: 'Dashboard',
          scope: 'dashboard',
          ...(unavailableReason ? { unavailableReason } : {}),
        },
      };
    });
}

export function formatShortcutKey(key: string): string {
  const labels: Record<string, string> = { Escape: 'Esc', ArrowUp: '↑', ArrowDown: '↓' };
  return labels[key] ?? (key.length === 1 ? key.toUpperCase() : key);
}
