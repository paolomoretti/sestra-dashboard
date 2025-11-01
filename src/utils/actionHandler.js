// Import config or get from window
function getApiBaseUrl(config) {
  if (import.meta.env.DEV) {
    return '/api';
  }
  return `${config.address}/api`;
}

/**
 * Execute a tap action on an entity
 * @param {Object} action - Action configuration { action: 'toggle'|'more-info'|'navigate', navigation_path?: string }
 * @param {Object} entityData - Entity data from GoJS node
 * @param {Object} config - HA configuration with accessToken
 */
export async function executeTapAction(action, entityData, config) {
  console.log('executeTapAction called with:', { action, entityData, config });
  
  if (!action || !action.action) {
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
      return await toggleEntity(entityId, config);
    
    case 'more-info':
      return showMoreInfo(entityData);
    
    case 'navigate':
      if (action.navigation_path) {
        return navigateTo(action.navigation_path);
      }
      console.warn('Navigate action requires navigation_path');
      break;
    
    case 'call-service':
      return await callService(action.service, entityId, action.target, config);
    
    default:
      console.warn(`Unknown action type: ${action.action}`);
  }
}

/**
 * Toggle an entity (lights, switches, etc.)
 */
async function toggleEntity(entityId, config) {
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
 * Show more info dialog (for now, just log - can be enhanced later)
 */
function showMoreInfo(entityData) {
  console.log('More info for:', entityData);
  // TODO: Could open a modal or navigate to entity detail page
  // For now, we'll just select it (which shows the EntityInfoPanel)
  if (window.diagramInstance) {
    const node = window.diagramInstance.findNodeForKey(entityData.key || entityData.entityId);
    if (node) {
      window.diagramInstance.select(node);
    }
  }
}

/**
 * Navigate to a path (for now, just log - can be enhanced with Vue Router)
 */
function navigateTo(navigationPath) {
  console.log('Navigate to:', navigationPath);
  // TODO: Implement navigation if using Vue Router
  // For now, we can use window.location or a router if added later
  if (navigationPath.startsWith('http')) {
    window.open(navigationPath, '_blank');
  } else {
    // Relative path - could use router
    console.warn('Relative navigation not implemented yet');
  }
}

/**
 * Call a Home Assistant service
 */
async function callService(service, entityId, target, config) {
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

