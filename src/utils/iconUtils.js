import * as mdiIcons from '@mdi/js';

/**
 * Get SVG path data for an MDI icon name
 * @param {string} iconName - MDI icon name (e.g., 'camera', 'thermometer', 'lightbulb')
 * @returns {string|null} SVG path data or null if not found
 */
export function getMDIIconPath(iconName) {
  if (!iconName) return null;
  
  // Remove 'mdi:' prefix if present
  const cleanName = iconName.replace(/^mdi:/, '');
  
  // Convert kebab-case to PascalCase (e.g., 'light-bulb' -> 'mdiLightBulb')
  const pascalName = 'mdi' + cleanName
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
  
  // Look up in MDI icons
  return mdiIcons[pascalName] || null;
}

/**
 * Create SVG data URI from MDI icon path
 * @param {string} path - SVG path data
 * @param {string} fill - Fill color (default: '#ffffff')
 * @param {number} size - Icon size in pixels (default: 24)
 * @returns {string} SVG data URI
 */
export function createIconSVG(path, fill = '#ffffff', size = 24) {
  if (!path) return null;
  
  // Create clean SVG without stroke - just the path fill
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}"><path fill="${fill}" stroke="none" d="${path}"/></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

/**
 * Extract icon from Home Assistant state
 * @param {Object} state - HA entity state object
 * @returns {string|null} MDI icon name (without mdi: prefix) or null
 */
export function extractIconFromHA(state) {
  if (!state || !state.attributes) return null;
  
  const icon = state.attributes.icon;
  if (!icon) return null;
  
  // Return icon name without 'mdi:' prefix
  return icon.replace(/^mdi:/, '');
}

/**
 * Get default icon based on entity domain and device class
 * @param {string} domain - Entity domain (sensor, light, camera, etc.)
 * @param {string} deviceClass - Device class (temperature, humidity, etc.)
 * @returns {string} MDI icon name
 */
export function getDefaultIcon(domain, deviceClass) {
  // Map device classes to icons
  const deviceClassIcons = {
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
  const domainIcons = {
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
  
  return domainIcons[domain] || 'circle-outline';
}

