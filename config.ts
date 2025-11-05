/**
 * Home Assistant Configuration
 *
 * Configuration priority (highest to lowest):
 * 1. localStorage (runtime configuration - best for multi-user scenarios)
 * 2. Environment variables (build-time configuration)
 * 3. Default fallback values
 *
 * Environment variables:
 * - VITE_HA_ADDRESS: Home Assistant URL (e.g., http://homeassistant.local:8123)
 * - VITE_HA_ACCESS_TOKEN: Home Assistant Long-Lived Access Token
 *
 * localStorage keys:
 * - ha_config_address: Home Assistant URL
 * - ha_config_access_token: Home Assistant Long-Lived Access Token
 */

export interface HAConfig {
  address: string;
  accessToken: string;
}

/**
 * Load HA config from localStorage if available
 */
function loadConfigFromLocalStorage(): Partial<HAConfig> {
  try {
    const address = localStorage.getItem('ha_config_address');
    const accessToken = localStorage.getItem('ha_config_access_token');

    return {
      ...(address ? { address } : {}),
      ...(accessToken ? { accessToken } : {}),
    };
  } catch (error) {
    console.warn('Error loading HA config from localStorage:', error);
    return {};
  }
}

/**
 * Save HA config to localStorage
 */
export function saveConfigToLocalStorage(config: HAConfig): void {
  try {
    localStorage.setItem('ha_config_address', config.address);
    localStorage.setItem('ha_config_access_token', config.accessToken);
  } catch (error) {
    console.warn('Error saving HA config to localStorage:', error);
  }
}

/**
 * Clear HA config from localStorage
 */
export function clearConfigFromLocalStorage(): void {
  try {
    localStorage.removeItem('ha_config_address');
    localStorage.removeItem('ha_config_access_token');
  } catch (error) {
    console.warn('Error clearing HA config from localStorage:', error);
  }
}

// Load config with priority: localStorage > env vars > defaults
const localStorageConfig = loadConfigFromLocalStorage();

export const haConfig: HAConfig = {
  address:
    localStorageConfig.address ?? import.meta.env['VITE_HA_ADDRESS'] ?? 'http://halaptop:8123',
  accessToken:
    localStorageConfig.accessToken ??
    import.meta.env['VITE_HA_ACCESS_TOKEN'] ??
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJhMzMyODIyODFmZjk0NGM2ODRhZjMxYWY4NjBlYTk1ZiIsImlhdCI6MTc2MTk5NDQ4OSwiZXhwIjoyMDc3MzU0NDg5fQ.3avq_pp9bDfmzaP-aXtwIW8i2HP4310709UuZqQ3THI',
};
