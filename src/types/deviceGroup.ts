import type { EntityData } from '../composables/useEntitySelection';

export interface DeviceGroupConfig {
  deviceId: string;
  deviceName: string;
  entityIds: string[];
  automationId: string | null;
}

export type DeviceGroupRow =
  | { entityId: string; kind: 'available'; entity: EntityData }
  | { entityId: string; kind: 'missing' };

export function parseDeviceGroup(value: unknown): DeviceGroupConfig | null {
  if (typeof value !== 'object' || value === null) return null;
  if (
    !('deviceId' in value) ||
    typeof value.deviceId !== 'string' ||
    value.deviceId.length === 0
  ) return null;
  if (!('deviceName' in value) || typeof value.deviceName !== 'string') return null;
  if (!('entityIds' in value) || !Array.isArray(value.entityIds)) return null;
  if (!value.entityIds.every(id => typeof id === 'string' && id.length > 0)) return null;
  if (!('automationId' in value)) return null;
  if (
    value.automationId !== null &&
    (typeof value.automationId !== 'string' || !value.automationId.startsWith('automation.'))
  ) return null;
  return {
    deviceId: value.deviceId,
    deviceName: value.deviceName,
    entityIds: [...new Set(value.entityIds)],
    automationId: value.automationId,
  };
}
