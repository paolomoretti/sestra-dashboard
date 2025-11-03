/**
 * Home Assistant Services utilities
 */

import type { HAConfig } from '../../config';

export function getApiBaseUrl(config: HAConfig): string {
  if (import.meta.env.DEV) {
    return '/api';
  }
  return `${config.address}/api`;
}

export interface HAService {
  domain: string;
  services: {
    [serviceName: string]: {
      description: string;
      fields?: {
        [fieldName: string]: {
          description: string;
          example?: any;
          required?: boolean;
          selector?: any;
        };
      };
    };
  };
}

/**
 * Fetch all Home Assistant services
 */
export async function fetchHAServices(config: HAConfig): Promise<HAService[]> {
  try {
    const url = `${getApiBaseUrl(config)}/services`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch services: ${response.statusText}`);
    }

    const services = await response.json();
    return services as HAService[];
  } catch (error) {
    console.error('Error fetching HA services:', error);
    throw error;
  }
}

/**
 * Format service name for display (e.g., "light.turn_on" -> "Turn On")
 */
export function formatServiceName(service: string): string {
  const [, serviceName] = service.split('.');
  if (!serviceName) return service;
  
  return serviceName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Get all available services as a flat list with domain
 */
export function getAllServices(services: HAService[]): Array<{ service: string; label: string; domain: string }> {
  const allServices: Array<{ service: string; label: string; domain: string }> = [];
  
  services.forEach(serviceDomain => {
    Object.keys(serviceDomain.services).forEach(serviceName => {
      const fullService = `${serviceDomain.domain}.${serviceName}`;
      const label = formatServiceName(fullService);
      allServices.push({
        service: fullService,
        label: `${label} (${serviceDomain.domain})`,
        domain: serviceDomain.domain,
      });
    });
  });
  
  // Sort alphabetically
  allServices.sort((a, b) => a.label.localeCompare(b.label));
  
  return allServices;
}

/**
 * Fetch automations from Home Assistant
 */
export async function fetchAutomations(config: HAConfig): Promise<Array<{ entity_id: string; name: string }>> {
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
      throw new Error(`Failed to fetch states: ${response.statusText}`);
    }

    const states = await response.json() as Array<{ entity_id: string; attributes: { friendly_name?: string } }>;
    
    // Filter for automation entities
    const automations = states
      .filter(state => state.entity_id.startsWith('automation.'))
      .map(state => ({
        entity_id: state.entity_id,
        name: state.attributes.friendly_name || state.entity_id.replace('automation.', ''),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return automations;
  } catch (error) {
    console.error('Error fetching automations:', error);
    throw error;
  }
}
