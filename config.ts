/**
 * Home Assistant Configuration
 *
 * You can configure your Home Assistant instance here or via environment variables:
 * - VITE_HA_ADDRESS: Home Assistant URL (e.g., http://homeassistant.local:8123)
 * - VITE_HA_ACCESS_TOKEN: Home Assistant Long-Lived Access Token
 */

export interface HAConfig {
  address: string;
  accessToken: string;
}

export const haConfig: HAConfig = {
  address: import.meta.env.VITE_HA_ADDRESS || 'http://halaptop:8123',
  accessToken:
    import.meta.env.VITE_HA_ACCESS_TOKEN ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJhMzMyODIyODFmZjk0NGM2ODRhZjMxYWY4NjBlYTk1ZiIsImlhdCI6MTc2MTk5NDQ4OSwiZXhwIjoyMDc3MzU0NDg5fQ.3avq_pp9bDfmzaP-aXtwIW8i2HP4310709UuZqQ3THI',
};
