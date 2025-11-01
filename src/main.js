import { createApp } from 'vue';
import App from './App.vue';
import { haConfig } from '../config.js';

// Check if configuration is set
if (!haConfig.address || !haConfig.accessToken) {
  console.warn('⚠️ Home Assistant configuration not set!');
  console.warn('Please configure your HA address and access token in config.js');
  console.warn('You can also use environment variables: HA_ADDRESS and HA_ACCESS_TOKEN');
}

// Create Vue app
const app = createApp(App);
app.mount('#app');

