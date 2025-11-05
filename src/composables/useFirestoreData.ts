/**
 * Composable for reactive Firestore data access
 */

import { computed, watch, type Ref } from 'vue';
import { useFirestoreStore } from '../stores/firestore';

/**
 * Get reactive dashboard data from Firestore
 */
export function useFirestoreData() {
  const firestoreStore = useFirestoreStore();

  const entities = computed(() => firestoreStore.dashboardData?.entities ?? []);
  const positions = computed(() => firestoreStore.dashboardData?.positions ?? {});
  const sizes = computed(() => firestoreStore.dashboardData?.sizes ?? {});
  const icons = computed(() => firestoreStore.dashboardData?.icons ?? {});
  const actions = computed(() => firestoreStore.dashboardData?.actions ?? {});
  const labelOverrides = computed(() => firestoreStore.dashboardData?.labelOverrides ?? {});
  const haActions = computed(() => firestoreStore.dashboardData?.haActions ?? {});
  const scale = computed(() => firestoreStore.dashboardData?.scale ?? 1);
  const panX = computed(() => firestoreStore.dashboardData?.panX ?? 0);
  const panY = computed(() => firestoreStore.dashboardData?.panY ?? 0);

  /**
   * Save entities to Firestore
   */
  async function setEntities(value: string[]): Promise<void> {
    await firestoreStore.saveDashboardData({ entities: value });
  }

  /**
   * Save positions to Firestore
   */
  async function setPositions(value: Record<string, string>): Promise<void> {
    await firestoreStore.saveDashboardData({ positions: value });
  }

  /**
   * Save sizes to Firestore
   */
  async function setSizes(value: Record<string, string>): Promise<void> {
    await firestoreStore.saveDashboardData({ sizes: value });
  }

  /**
   * Save icons to Firestore
   */
  async function setIcons(value: Record<string, string>): Promise<void> {
    await firestoreStore.saveDashboardData({ icons: value });
  }

  /**
   * Save actions to Firestore
   */
  async function setActions(value: Record<string, { tapAction?: any; holdAction?: any }>): Promise<void> {
    await firestoreStore.saveDashboardData({ actions: value });
  }

  /**
   * Save label overrides to Firestore
   */
  async function setLabelOverrides(value: Record<string, string>): Promise<void> {
    await firestoreStore.saveDashboardData({ labelOverrides: value });
  }

  /**
   * Save HA actions to Firestore
   */
  async function setHAActions(value: Record<string, { service: string; serviceData?: Record<string, any> }>): Promise<void> {
    await firestoreStore.saveDashboardData({ haActions: value });
  }

  /**
   * Save scale to Firestore
   */
  async function setScale(value: number): Promise<void> {
    await firestoreStore.saveDashboardData({ scale: value });
  }

  /**
   * Save panX to Firestore
   */
  async function setPanX(value: number): Promise<void> {
    await firestoreStore.saveDashboardData({ panX: value });
  }

  /**
   * Save panY to Firestore
   */
  async function setPanY(value: number): Promise<void> {
    await firestoreStore.saveDashboardData({ panY: value });
  }

  return {
    entities,
    positions,
    sizes,
    icons,
    actions,
    labelOverrides,
    haActions,
    scale,
    panX,
    panY,
    setEntities,
    setPositions,
    setSizes,
    setIcons,
    setActions,
    setLabelOverrides,
    setHAActions,
    setScale,
    setPanX,
    setPanY,
  };
}

