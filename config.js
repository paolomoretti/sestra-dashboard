// Home Assistant Configuration
// Edit this file directly with your Home Assistant credentials
// Alternatively, create a .env file with VITE_HA_ADDRESS and VITE_HA_ACCESS_TOKEN

export const haConfig = {
  // Your Home Assistant instance URL (e.g., "http://homeassistant.local:8123" or "https://ha.example.com")
  address: import.meta.env.VITE_HA_ADDRESS || 'http://halaptop:8123',
  
  // Your Home Assistant Long-Lived Access Token
  // Generate one at: http://your-ha-address/profile → Long-Lived Access Tokens
  accessToken: import.meta.env.VITE_HA_ACCESS_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJhMzMyODIyODFmZjk0NGM2ODRhZjMxYWY4NjBlYTk1ZiIsImlhdCI6MTc2MTk5NDQ4OSwiZXhwIjoyMDc3MzU0NDg5fQ.3avq_pp9bDfmzaP-aXtwIW8i2HP4310709UuZqQ3THI',
};

