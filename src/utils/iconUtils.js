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
 * Get icon color based on entity domain, state, and icon name
 * @param {string} entityId - Entity ID (e.g., 'light.living_room')
 * @param {string} state - Entity state (e.g., 'on', 'off', 'unavailable')
 * @param {string} iconName - Optional icon name (e.g., 'thermometer', 'lightbulb')
 * @returns {string} Color hex code
 */
export function getIconColor(entityId, state, iconName = null) {
  if (!entityId || !state) return '#888888'; // Default gray
  
  const domain = entityId.split('.')[0];
  const normalizedState = (state || '').toLowerCase();
  
  // Handle unavailable/unknown states
  if (normalizedState === 'unavailable' || normalizedState === 'unknown') {
    return '#555555'; // Dark gray for unavailable
  }
  
  // Check if it's a thermometer icon - always use gray like off lights
  if (iconName && (iconName.toLowerCase().includes('thermometer') || iconName.toLowerCase().includes('temperature'))) {
    return '#888888'; // Same gray as off lights
  }
  
  // Check if it's a power/lightning icon (power sockets, energy meters) - always use gray
  if (iconName && (iconName.toLowerCase().includes('lightning') || iconName.toLowerCase().includes('power') || iconName.toLowerCase().includes('bolt'))) {
    return '#888888'; // Same gray as off lights
  }
  
  // Check entity ID for temperature sensors (fallback if icon name not provided)
  if (entityId.toLowerCase().includes('temperature') || entityId.toLowerCase().includes('thermometer')) {
    return '#888888'; // Same gray as off lights
  }
  
  // Check entity ID for power/energy sensors (fallback if icon name not provided)
  if (entityId.toLowerCase().includes('power') || entityId.toLowerCase().includes('energy') || entityId.toLowerCase().includes('watt')) {
    return '#888888'; // Same gray as off lights
  }
  
  // Domain-specific color logic
  switch (domain) {
    case 'light':
      return normalizedState === 'on' ? '#FFC107' : '#888888'; // Yellow when on, gray when off
    
    case 'switch':
      return normalizedState === 'on' ? '#4CAF50' : '#888888'; // Green when on, gray when off
    
    case 'binary_sensor':
      // Binary sensors: 'on' typically means active/detected
      if (normalizedState === 'on') {
        // Check device class for more specific colors
        // This would require access to attributes, but we can use a general green
        return '#4CAF50'; // Green for active
      }
      return '#888888'; // Gray for inactive
    
    case 'sensor':
    case 'camera':
    default:
      // For other entities, use white/gray based on availability
      return normalizedState === 'unavailable' ? '#555555' : '#CCCCCC';
  }
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

