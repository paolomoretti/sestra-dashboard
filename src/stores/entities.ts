import { defineStore } from 'pinia';
import { ref, type Ref } from 'vue';
import type { EntityData } from '../composables/useEntitySelection';
import type { HAConfig } from '../../config';
import { extractIconFromHA, getDefaultIcon } from '../utils/iconUtils';

export interface HAEntityState {
  entity_id: string;
  state: string;
  attributes: {
    friendly_name?: string;
    icon?: string;
    device_class?: string;
    [key: string]: unknown;
  };
}

export const useEntitiesStore = defineStore('entities', () => {
  const allEntities: Ref<EntityData[]> = ref<EntityData[]>([]);
  const isLoading: Ref<boolean> = ref(false);
  const lastUpdated: Ref<Date | null> = ref<Date | null>(null);
  let wsConnection: WebSocket | null = null;
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

  function getApiBaseUrl(config: HAConfig): string {
    if (import.meta.env.DEV) {
      return '/api';
    }
    return `${config.address}/api`;
  }

  async function loadEntities(config: HAConfig): Promise<void> {
    isLoading.value = true;
    try {
      const url = `${getApiBaseUrl(config)}/states`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const states = (await response.json()) as HAEntityState[];

      // Filter and transform entities
      const entities: EntityData[] = states
        .filter(state => {
          const domain = state.entity_id.split('.')[0];
          if (!domain) return false;
          // Filter out entities we don't want to show
          const excludedDomains = [
            'automation',
            'script',
            'scene',
            'sun',
            'zone',
            'persistent_notification',
            'input_number',
            'input_select',
            'input_text',
            'input_boolean',
            // Note: input_datetime removed from exclusion list to allow entities like "Coffee magic override"
          ];
          return !excludedDomains.includes(domain);
        })
        .map(state => {
          const domain = state.entity_id.split('.')[0];
          const deviceClass = state.attributes.device_class;

          // Determine category for template
          let category = 'sensor';
          if (domain === 'light') category = 'light';
          else if (domain === 'switch') category = 'switch';
          else if (domain === 'camera') category = 'camera';
          else if (domain === 'binary_sensor') {
            if (deviceClass === 'door' || deviceClass === 'window') {
              category = 'door';
            } else {
              category = 'sensor';
            }
          }

          // Extract icon
          const extractedIcon = extractIconFromHA(state);
          const defaultIcon = getDefaultIcon(domain, deviceClass ?? null);
          const icon = extractedIcon ?? defaultIcon;

          return {
            key: state.entity_id,
            entityId: state.entity_id,
            category,
            name: state.attributes.friendly_name ?? state.entity_id,
            state: state.state,
            status: null,
            icon,
            deviceClass: deviceClass ?? null,
            loc: '0 0',
            size: null,
            tapAction: null,
            holdAction: null,
          } as EntityData;
        });

      allEntities.value = entities;
      lastUpdated.value = new Date();

      // Expose to window for backward compatibility
      window.allEntities = entities;
      window.allEntitiesForFiltering = entities;
    } catch (error) {
      console.error('Error loading entities:', error);
      throw error;
    } finally {
      isLoading.value = false;
    }
  }

  async function updateEntityStates(config: HAConfig): Promise<void> {
    try {
      const url = `${getApiBaseUrl(config)}/states`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) return;

      const states = (await response.json()) as HAEntityState[];
      const stateMap = new Map(states.map(s => [s.entity_id, s.state]));

      // Update states in allEntities
      allEntities.value = allEntities.value.map(entity => ({
        ...entity,
        state: stateMap.get(entity.key) ?? entity.state ?? '',
      }));

      // Also update window.allEntities
      if (window.allEntities) {
        window.allEntities = allEntities.value;
      }
    } catch (error) {
      console.error('Error updating entity states:', error);
    }
  }

  /**
   * Connect to Home Assistant WebSocket API for real-time state updates
   */
  function connectWebSocket(config: HAConfig): void {
    // Close existing connection if any
    if (wsConnection) {
      wsConnection.close();
      wsConnection = null;
    }

    // Clear any pending reconnect
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }

    // Determine WebSocket URL
    const wsProtocol = config.address.startsWith('https') ? 'wss' : 'ws';
    const baseUrl = config.address.replace(/^https?/, wsProtocol).replace(/\/api\/?$/, '');
    const wsUrl = `${baseUrl}/api/websocket`;

    // eslint-disable-next-line no-console
    console.log('Connecting to Home Assistant WebSocket:', wsUrl);

    try {
      const ws = new WebSocket(wsUrl);
      wsConnection = ws;

      ws.onopen = () => {
        // eslint-disable-next-line no-console
        console.log('WebSocket connected to Home Assistant');
      };

      ws.onmessage = event => {
        try {
          const message = JSON.parse(event.data);

          // Handle authentication response
          if (message.type === 'auth_required') {
            // eslint-disable-next-line no-console
            console.log('WebSocket authentication required');
            ws.send(
              JSON.stringify({
                type: 'auth',
                access_token: config.accessToken,
              })
            );
            return;
          }

          // Handle authentication result
          if (message.type === 'auth_ok') {
            // eslint-disable-next-line no-console
            console.log('WebSocket authenticated successfully');
            // Subscribe to state_changed events
            ws.send(
              JSON.stringify({
                id: 1,
                type: 'subscribe_events',
                event_type: 'state_changed',
              })
            );
            return;
          }

          // Handle authentication error
          if (message.type === 'auth_invalid') {
            console.error('WebSocket authentication failed:', message.message);
            ws.close();
            return;
          }

          // Handle state_changed events
          if (message.type === 'event' && message.event?.event_type === 'state_changed') {
            const eventData = message.event.data;
            if (eventData?.entity_id && eventData?.new_state) {
              const entityId = eventData.entity_id;
              const newState = eventData.new_state.state;

              // Update the entity state in real-time
              allEntities.value = allEntities.value.map(entity => {
                if (entity.key === entityId) {
                  return {
                    ...entity,
                    state: newState,
                  };
                }
                return entity;
              });

              // Also update window.allEntities for backward compatibility
              if (window.allEntities) {
                window.allEntities = allEntities.value;
              }

              lastUpdated.value = new Date();
            }
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = error => {
        console.error('WebSocket error:', error);
      };

      ws.onclose = () => {
        // eslint-disable-next-line no-console
        console.log('WebSocket connection closed, reconnecting in 5 seconds...');
        wsConnection = null;
        // Reconnect after 5 seconds
        reconnectTimeout = setTimeout(() => {
          connectWebSocket(config);
        }, 5000);
      };
    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      // Fallback to polling if WebSocket fails
      // eslint-disable-next-line no-console
      console.log('Falling back to polling for state updates');
    }
  }

  /**
   * Disconnect WebSocket connection
   */
  function disconnectWebSocket(): void {
    if (wsConnection) {
      wsConnection.close();
      wsConnection = null;
    }
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
  }

  return {
    allEntities,
    isLoading,
    lastUpdated,
    loadEntities,
    updateEntityStates,
    connectWebSocket,
    disconnectWebSocket,
  };
});
