import type { HAConfig } from '../../config';
import type { EntityData } from '../composables/useEntitySelection';

// Import config or get from window
function getApiBaseUrl(config: HAConfig): string {
  if (import.meta.env.DEV) {
    return '/api';
  }
  return `${config.address}/api`;
}

export interface TapAction {
  action: 'toggle' | 'more-info' | 'navigate' | 'call-service';
  navigation_path?: string;
  service?: string;
  target?: {
    entity_id?: string;
  };
}

/**
 * Execute a tap action on an entity
 * @param action - Action configuration { action: 'toggle'|'more-info'|'navigate', navigation_path?: string }
 * @param entityData - Entity data from GoJS node
 * @param config - HA configuration with accessToken
 */
export async function executeTapAction(action: TapAction | null | undefined, entityData: EntityData, config: HAConfig): Promise<void> {
  console.log('executeTapAction called with:', { action, entityData, config });
  
  if (!action?.action) {
    console.warn('No action provided or action.action is missing');
    return;
  }

  const entityId = entityData.entityId || entityData.key;
  if (!entityId) {
    console.warn('No entity ID found in entity data');
    return;
  }

  console.log('Executing action:', action.action, 'for entity:', entityId);

  switch (action.action) {
    case 'toggle':
      console.log('Calling toggleEntity for:', entityId);
      return toggleEntity(entityId, config);
    
    case 'more-info':
      return showMoreInfo(entityData, config);
    
    case 'navigate':
      // If navigation_path is provided, use it; otherwise default to entity's history page
      const navigationPath = action.navigation_path || `/history?entity_id=${entityId}`;
      return navigateTo(navigationPath, config);
    
    case 'call-service':
      if (action.service) {
        return callService(action.service, entityId, action.target, config);
      }
      console.warn('Call-service action requires service');
      break;
    
    default:
      console.warn(`Unknown action type: ${action.action}`);
  }
}

/**
 * Toggle an entity (lights, switches, etc.)
 */
async function toggleEntity(entityId: string, config: HAConfig): Promise<void> {
  try {
    const [domain] = entityId.split('.');
    const url = `${getApiBaseUrl(config)}/services/${domain}/toggle`;
    console.log('Toggle entity - URL:', url, 'entityId:', entityId, 'domain:', domain);
    
    const requestBody = {
      entity_id: entityId
    };
    console.log('Toggle request body:', requestBody);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    console.log('Toggle response status:', response.status, response.statusText);

    if (!response.ok) {
      throw new Error(`Failed to toggle entity: ${response.statusText}`);
    }

    const result = await response.json();
    
    // Trigger state update after a short delay
    setTimeout(() => {
      if (window.diagramInstance && window.updateSensorStates) {
        window.updateSensorStates(config);
      }
    }, 500);

    return result;
  } catch (error) {
    console.error('Error toggling entity:', error);
    throw error;
  }
}

/**
 * Show more info - opens the entity's detail page in Home Assistant
 * @param entityData - Entity data
 * @param config - HA configuration with address
 */
function showMoreInfo(entityData: EntityData, config: HAConfig): void {
  const entityId = entityData.entityId || entityData.key;
  if (!entityId) {
    console.warn('No entity ID found for more-info action');
    return;
  }
  
  // Open entity's detail page in Home Assistant
  // This opens the entity configuration page where you can see all details, history, etc.
  const entityDetailPath = `/config/entities/${entityId}`;
  navigateTo(entityDetailPath, config);
}

/**
 * Navigate to a path in Home Assistant
 * @param navigationPath - Relative path (e.g., '/lovelace/dashboard1') or full URL
 * @param config - HA configuration with address
 */
function navigateTo(navigationPath: string, config: HAConfig): void {
  console.log('Navigate to:', navigationPath);
  
  let fullUrl: string;
  
  // If it's already a full URL, use it as-is
  if (navigationPath.startsWith('http://') || navigationPath.startsWith('https://')) {
    fullUrl = navigationPath;
  } else {
    // Construct full Home Assistant URL
    // Ensure navigation path starts with /
    const path = navigationPath.startsWith('/') ? navigationPath : `/${navigationPath}`;
    fullUrl = `${config.address}${path}`;
  }
  
  console.log('Opening Home Assistant URL:', fullUrl);
  // Open in a new tab
  window.open(fullUrl, '_blank');
}

/**
 * Call a Home Assistant service
 */
async function callService(service: string, entityId: string | undefined, target: { entity_id?: string } | undefined, config: HAConfig): Promise<void> {
  try {
    const [domain, serviceName] = service.split('.');
    if (!domain || !serviceName) {
      throw new Error(`Invalid service format: ${service}`);
    }

    const url = `${getApiBaseUrl(config)}/services/${domain}/${serviceName}`;
    
    const serviceData = target?.entity_id 
      ? { entity_id: target.entity_id }
      : entityId 
        ? { entity_id: entityId }
        : {};

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(serviceData)
    });

    if (!response.ok) {
      throw new Error(`Failed to call service: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error calling service:', error);
    throw error;
  }
}

