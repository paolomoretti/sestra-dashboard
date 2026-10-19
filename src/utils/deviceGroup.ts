import type { EntityData } from '../composables/useEntitySelection';
import type { DeviceGroupConfig, DeviceGroupRow } from '../types/deviceGroup';

export function resolveDeviceGroupRows(
  group: DeviceGroupConfig,
  entitiesById: ReadonlyMap<string, EntityData>
): DeviceGroupRow[] {
  return group.entityIds.map(entityId => {
    const entity = entitiesById.get(entityId);
    return entity ? { entityId, kind: 'available', entity } : { entityId, kind: 'missing' };
  });
}

export function deviceGroupInitialSize(rowCount: number): string {
  return `220 ${Math.max(120, 82 + Math.min(rowCount, 5) * 36)}`;
}
