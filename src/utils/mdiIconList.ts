import * as mdiIcons from '@mdi/js';
import { getMDIIconPath } from './iconUtils';

export interface MDIIconOption {
  value: string;
  label: string;
}

/**
 * Common MDI icons for entity selection
 * These are commonly used icons from Material Design Icons
 */
export const COMMON_MDI_ICONS: MDIIconOption[] = [
  { value: 'camera', label: 'Camera' },
  { value: 'camera-outline', label: 'Camera Outline' },
  { value: 'camera-security', label: 'Security Camera' },
  { value: 'lightbulb', label: 'Light Bulb' },
  { value: 'lightbulb-on', label: 'Light Bulb On' },
  { value: 'thermometer', label: 'Thermometer' },
  { value: 'thermometer-lines', label: 'Thermometer Lines' },
  { value: 'water-percent', label: 'Humidity' },
  { value: 'gauge', label: 'Gauge' },
  { value: 'door', label: 'Door' },
  { value: 'door-open', label: 'Door Open' },
  { value: 'window-open', label: 'Window Open' },
  { value: 'motion-sensor', label: 'Motion Sensor' },
  { value: 'toggle-switch', label: 'Switch' },
  { value: 'toggle-switch-off', label: 'Switch Off' },
  { value: 'lock', label: 'Lock' },
  { value: 'lock-open', label: 'Lock Open' },
  { value: 'window-shutter', label: 'Cover' },
  { value: 'thermostat', label: 'Thermostat' },
  { value: 'fan', label: 'Fan' },
  { value: 'radar', label: 'Sensor' },
  { value: 'battery', label: 'Battery' },
  { value: 'battery-charging', label: 'Battery Charging' },
  { value: 'signal', label: 'Signal' },
  { value: 'wifi', label: 'WiFi' },
  { value: 'smoke-detector', label: 'Smoke Detector' },
  { value: 'fire', label: 'Fire' },
  { value: 'flash', label: 'Flash' },
  { value: 'lightning-bolt', label: 'Lightning' },
  { value: 'power', label: 'Power' },
  { value: 'cellphone', label: 'Phone' },
  { value: 'account', label: 'Person' },
  { value: 'home', label: 'Home' },
  { value: 'home-variant', label: 'Home Variant' },
  { value: 'weather-sunny', label: 'Sun' },
  { value: 'weather-cloudy', label: 'Cloud' },
  { value: 'security', label: 'Security' },
  { value: 'shield', label: 'Shield' },
];

// Cache for all MDI icons - computed only once
let cachedAllMDIIcons: MDIIconOption[] | null = null;

/**
 * Get all available MDI icons dynamically from @mdi/js
 * Converts PascalCase icon names to kebab-case for consistency
 * Results are cached after first call
 * Note: Does not verify each icon exists (performance optimization)
 */
export function getAllMDIIcons(): MDIIconOption[] {
  // Return cached result if available
  if (cachedAllMDIIcons !== null) {
    return cachedAllMDIIcons;
  }
  
  const icons: MDIIconOption[] = [];
  
  // Iterate through all exported icons from @mdi/js
  // Skip verification for performance - if the key exists in mdiIcons, the icon exists
  for (const key of Object.keys(mdiIcons)) {
    // MDI icons are exported as mdiIconName (e.g., mdiCamera, mdiLightbulb)
    if (key.startsWith('mdi') && key.length > 3) {
      // Convert PascalCase to kebab-case (e.g., mdiCamera -> camera)
      const iconName = key
        .replace(/^mdi/, '') // Remove mdi prefix
        .replace(/([A-Z])/g, '-$1') // Add dash before capital letters
        .toLowerCase()
        .replace(/^-/, ''); // Remove leading dash if any
      
      // Create a human-readable label from the icon name
      const label = iconName
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      icons.push({
        value: iconName,
        label,
      });
    }
  }
  
  // Sort alphabetically by label
  icons.sort((a, b) => a.label.localeCompare(b.label));
  
  // Cache the result
  cachedAllMDIIcons = icons;
  
  return icons;
}

// Export as ICON_OPTIONS for backward compatibility
export const ICON_OPTIONS = COMMON_MDI_ICONS;
