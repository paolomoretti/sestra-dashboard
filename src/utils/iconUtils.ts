import * as mdiIcons from '@mdi/js';

export interface HAEntityState {
  entity_id?: string;
  state?: string;
  attributes?: {
    icon?: string;
    friendly_name?: string;
    device_class?: string;
    [key: string]: any;
  };
}

/**
 * Get SVG path data for an MDI icon name
 * @param iconName - MDI icon name (e.g., 'camera', 'thermometer', 'lightbulb')
 * @returns SVG path data or null if not found
 */
export function getMDIIconPath(iconName: string | null | undefined): string | null {
  if (!iconName) return null;

  // Remove 'mdi:' prefix if present
  const cleanName = iconName.replace(/^mdi:/, '');

  // Convert kebab-case to PascalCase (e.g., 'light-bulb' -> 'mdiLightBulb')
  const pascalName = `mdi${cleanName
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('')}`;

  // Look up in MDI icons
  return (mdiIcons as any)[pascalName] || null;
}

/**
 * Create SVG data URI from MDI icon path
 * @param path - SVG path data
 * @param fill - Fill color (default: '#ffffff')
 * @param size - Icon size in pixels (default: 24)
 * @returns SVG data URI
 */
export function createIconSVG(
  path: string | null,
  fill: string = '#ffffff',
  size: number = 24
): string | null {
  if (!path) return null;

  // Create clean SVG without stroke - just the path fill
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}"><path fill="${fill}" stroke="none" d="${path}"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Get icon color based on entity domain and state
 * @param entityId - Entity ID (e.g., 'light.living_room')
 * @param state - Entity state (e.g., 'on', 'off', 'unavailable')
 * @param iconColorOn - Optional custom color for "on" state (overrides default)
 * @param iconColorOff - Optional custom color for "off" state (overrides default)
 * @returns Color hex code
 */
export function getIconColor(
  entityId: string | null | undefined,
  state: string | null | undefined,
  iconColorOn?: string | null | undefined,
  iconColorOff?: string | null | undefined
): string {
  if (!entityId || !state) {
    // Use custom off color if provided, otherwise default gray
    return iconColorOff || '#888888';
  }

  const normalizedState = (state || '').toLowerCase();

  // Handle unavailable/unknown states
  if (normalizedState === 'unavailable' || normalizedState === 'unknown') {
    return '#555555'; // Dark gray for unavailable (always use this, not override)
  }

  // Check for custom color overrides first
  if (normalizedState === 'on') {
    return iconColorOn || '#FFC107'; // Use custom on color if provided, otherwise default yellow
  } else {
    return iconColorOff || '#888888'; // Use custom off color if provided, otherwise default gray
  }
}

/**
 * Extract icon from Home Assistant state
 * @param state - HA entity state object
 * @returns MDI icon name (without mdi: prefix) or null
 */
export function extractIconFromHA(state: HAEntityState | null | undefined): string | null {
  if (!state?.attributes) return null;

  const icon = state.attributes.icon;
  if (!icon) return null;

  // Return icon name without 'mdi:' prefix
  return icon.replace(/^mdi:/, '');
}

/**
 * Get default icon based on entity domain and device class
 * @param domain - Entity domain (sensor, light, camera, etc.)
 * @param deviceClass - Device class (temperature, humidity, etc.)
 * @returns MDI icon name
 */
export function getDefaultIcon(
  domain: string | null | undefined,
  deviceClass: string | null | undefined
): string {
  // Map device classes to icons
  const deviceClassIcons: Record<string, string> = {
    temperature: 'thermometer',
    humidity: 'water-percent',
    pressure: 'gauge',
    power: 'lightning-bolt',
    energy: 'flash',
    battery: 'battery',
    signal_strength: 'signal',
    illuminance: 'lightbulb-on',
    motion: 'motion-sensor',
    door: 'door',
    window: 'window-open',
    smoke: 'smoke-detector',
    co: 'smoke-detector-variant',
    tamper: 'security',
  };

  if (deviceClass && deviceClassIcons[deviceClass]) {
    return deviceClassIcons[deviceClass];
  }

  // Map domains to icons
  const domainIcons: Record<string, string> = {
    camera: 'camera',
    light: 'lightbulb',
    switch: 'toggle-switch',
    lock: 'lock',
    cover: 'window-shutter',
    climate: 'thermostat',
    fan: 'fan',
    sensor: 'radar',
    binary_sensor: 'radar',
    device_tracker: 'cellphone',
    person: 'account',
    sun: 'weather-sunny',
    weather: 'weather-cloudy',
  };

  return domainIcons[domain || ''] || 'circle-outline';
}
