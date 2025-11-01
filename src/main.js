import { createApp, nextTick } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import './style.css';
import { initDashboard } from './dashboard.js';
import { haConfig } from '../config.js';

// Check if configuration is set
if (!haConfig.address || !haConfig.accessToken) {
  console.warn('⚠️ Home Assistant configuration not set!');
  console.warn('Please configure your HA address and access token in config.js');
  console.warn('You can also use environment variables: HA_ADDRESS and HA_ACCESS_TOKEN');
}

// Create Vue app and Pinia store
const app = createApp(App);
const pinia = createPinia();
app.use(pinia);

// Expose Pinia instance to window for dashboard.js access
window.pinia = pinia;

app.mount('#app');

// Initialize dashboard after Vue app is mounted
nextTick(() => {
  initDashboard(haConfig);
});

