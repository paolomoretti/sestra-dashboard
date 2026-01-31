/**
 * Home Assistant iframe postMessage listener
 *
 * This script should be added to your Home Assistant configuration to handle
 * navigation and more-info requests from iframe-embedded dashboards.
 *
 * INSTALLATION:
 * 1. Copy this file to your Home Assistant's /config/www/ directory as:
 *    /config/www/ha-iframe-listener.js
 *
 * 2. Add it to your Lovelace dashboard resources:
 *    - Go to Settings > Dashboards > Resources (top right menu)
 *    - Click "Add Resource"
 *    - URL: /local/ha-iframe-listener.js
 *    - Resource type: JavaScript Module
 *
 * 3. Reload your dashboard
 *
 * WHAT IT DOES:
 * - Listens for postMessage events from iframe panels
 * - Handles 'navigate' messages to navigate within Home Assistant
 * - Handles 'show-more-info' messages to open entity detail dialogs
 */

(function() {
  'use strict';

  console.log('[HA iframe Listener] Initializing...');

  /**
   * Navigate to a path within Home Assistant
   */
  function navigateToPath(path) {
    console.log('[HA iframe Listener] Navigating to:', path);

    // Get the Home Assistant object
    const homeAssistant = document.querySelector('home-assistant');
    if (!homeAssistant || !homeAssistant.hass) {
      console.error('[HA iframe Listener] Home Assistant object not found');
      // Fallback to direct navigation
      window.location.href = path;
      return;
    }

    // Use Home Assistant's navigation method
    try {
      // Navigate using the history API
      if (window.history && window.history.pushState) {
        window.history.pushState(null, '', path);

        // Dispatch a location-changed event
        window.dispatchEvent(new CustomEvent('location-changed'));
      } else {
        // Fallback to direct navigation
        window.location.href = path;
      }
    } catch (error) {
      console.error('[HA iframe Listener] Navigation error:', error);
      window.location.href = path;
    }
  }

  /**
   * Show more info dialog for an entity
   */
  function showMoreInfo(entityId) {
    console.log('[HA iframe Listener] Showing more info for:', entityId);

    // Get the Home Assistant object
    const homeAssistant = document.querySelector('home-assistant');
    if (!homeAssistant) {
      console.error('[HA iframe Listener] Home Assistant object not found');
      return;
    }

    // Fire the hass-more-info event
    try {
      const event = new CustomEvent('hass-more-info', {
        bubbles: true,
        composed: true,
        detail: { entityId: entityId }
      });

      homeAssistant.dispatchEvent(event);
      console.log('[HA iframe Listener] Dispatched hass-more-info event');
    } catch (error) {
      console.error('[HA iframe Listener] Error showing more info:', error);
    }
  }

  /**
   * Message event handler
   */
  function handleMessage(event) {
    // For security, you can check event.origin here
    // For now, we'll accept messages from any origin
    // Uncomment and modify this line to restrict origins:
    // if (event.origin !== 'https://your-dashboard-domain.com') return;

    const data = event.data;

    // Ignore messages that don't have our expected structure
    if (!data || typeof data !== 'object' || !data.type) {
      return;
    }

    console.log('[HA iframe Listener] Received message:', data);

    switch (data.type) {
      case 'navigate':
        if (data.path) {
          navigateToPath(data.path);
        }
        break;

      case 'show-more-info':
        if (data.entityId) {
          showMoreInfo(data.entityId);
        }
        break;

      default:
        console.log('[HA iframe Listener] Unknown message type:', data.type);
    }
  }

  // Add the message event listener
  window.addEventListener('message', handleMessage, false);

  console.log('[HA iframe Listener] Listener installed successfully');

  // For debugging: expose a test function
  window.testIframeListener = function() {
    console.log('[HA iframe Listener] Test function called - listener is working!');
    return true;
  };
})();
