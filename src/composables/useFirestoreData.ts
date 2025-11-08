/**
 * Composable for reactive Firestore data access
 */

import { computed, watch, type Ref } from 'vue';
import { useDebounceFn } from '@vueuse/core';
import { useFirestoreStore, type WidgetData } from '../stores/firestore';

/**
 * Get reactive dashboard data from Firestore
 */
export function useFirestoreData() {
  const firestoreStore = useFirestoreStore();
  
  // Expose interaction flag setter
  const setUserInteracting = (value: boolean) => {
    firestoreStore.setUserInteracting(value);
  };

  // Convert widgets to the old format for backward compatibility
  const entities = computed(() => {
    return Object.keys(firestoreStore.widgets || {});
  });

  const positions = computed(() => {
    const result: Record<string, string> = {};
    Object.entries(firestoreStore.widgets || {}).forEach(([widgetId, widget]) => {
      result[widgetId] = widget.position;
    });
    return result;
  });

  const sizes = computed(() => {
    const result: Record<string, string> = {};
    Object.entries(firestoreStore.widgets || {}).forEach(([widgetId, widget]) => {
      result[widgetId] = widget.size;
    });
    return result;
  });

  const icons = computed(() => {
    const result: Record<string, string> = {};
    Object.entries(firestoreStore.widgets || {}).forEach(([widgetId, widget]) => {
      if (widget.icon) {
        result[widgetId] = widget.icon;
      }
    });
    return result;
  });

  const actions = computed(() => {
    const result: Record<string, { tapAction?: any; holdAction?: any }> = {};
    Object.entries(firestoreStore.widgets || {}).forEach(([widgetId, widget]) => {
      if (widget.action) {
        result[widgetId] = widget.action;
      }
    });
    return result;
  });

  const labelOverrides = computed(() => {
    const result: Record<string, string> = {};
    Object.entries(firestoreStore.widgets || {}).forEach(([widgetId, widget]) => {
      if (widget.labelName) {
        result[widgetId] = widget.labelName;
      }
    });
    return result;
  });

  const haActions = computed(() => {
    const result: Record<string, { service: string; serviceData?: Record<string, any> }> = {};
    Object.entries(firestoreStore.widgets || {}).forEach(([widgetId, widget]) => {
      if (widget.haAction) {
        result[widgetId] = widget.haAction;
      }
    });
    return result;
  });

  const labelVisible = computed(() => {
    const result: Record<string, boolean> = {};
    Object.entries(firestoreStore.widgets || {}).forEach(([widgetId, widget]) => {
      // Default to true if not set
      result[widgetId] = widget.labelVisible !== undefined ? widget.labelVisible : true;
    });
    return result;
  });

  const stateVisible = computed(() => {
    const result: Record<string, boolean> = {};
    Object.entries(firestoreStore.widgets || {}).forEach(([widgetId, widget]) => {
      // Default to true if not set
      result[widgetId] = widget.stateVisible !== undefined ? widget.stateVisible : true;
    });
    return result;
  });

  const valuePrefixes = computed(() => {
    const result: Record<string, string> = {};
    Object.entries(firestoreStore.widgets || {}).forEach(([widgetId, widget]) => {
      if (widget.valuePrefix !== undefined) {
        result[widgetId] = widget.valuePrefix;
      }
    });
    return result;
  });

  const valueSuffixes = computed(() => {
    const result: Record<string, string> = {};
    Object.entries(firestoreStore.widgets || {}).forEach(([widgetId, widget]) => {
      if (widget.valueSuffix !== undefined) {
        result[widgetId] = widget.valueSuffix;
      }
    });
    return result;
  });

  /**
   * Save entities list (creates/updates widgets)
   */
  async function setEntities(value: string[]): Promise<void> {
    const currentWidgets = firestoreStore.widgets || {};
    const currentEntityIds = Object.keys(currentWidgets);
    
    // Delete widgets that are no longer in the list
    for (const widgetId of currentEntityIds) {
      if (!value.includes(widgetId)) {
        await firestoreStore.deleteWidget(widgetId);
      }
    }

    // Create/update widgets for new entities
    for (const entityId of value) {
      if (!currentWidgets[entityId]) {
        // Create new widget
        await firestoreStore.saveWidget(entityId, {
          entityName: entityId,
          position: '0 0',
          size: '80 40',
        });
      }
    }
  }

  /**
   * Save positions to Firestore
   * Only updates widgets whose positions have actually changed
   */
  async function setPositions(value: Record<string, string>): Promise<void> {
    const currentPositions = positions.value;
    for (const [widgetId, position] of Object.entries(value)) {
      // Only update if position actually changed
      if (currentPositions[widgetId] !== position) {
        await firestoreStore.updateWidget(widgetId, { position });
      }
    }
  }

  /**
   * Update a single widget's position (more efficient than setPositions for single updates)
   */
  async function updateWidgetPosition(widgetId: string, position: string): Promise<void> {
    await firestoreStore.updateWidget(widgetId, { position });
  }

  /**
   * Save sizes to Firestore
   * Only updates widgets whose sizes have actually changed
   */
  async function setSizes(value: Record<string, string>): Promise<void> {
    const currentSizes = sizes.value;
    for (const [widgetId, size] of Object.entries(value)) {
      // Only update if size actually changed
      if (currentSizes[widgetId] !== size) {
        await firestoreStore.updateWidget(widgetId, { size });
      }
    }
  }

  /**
   * Update a single widget's size (more efficient than setSizes for single updates)
   */
  async function updateWidgetSize(widgetId: string, size: string): Promise<void> {
    await firestoreStore.updateWidget(widgetId, { size });
  }

  /**
   * Save icons to Firestore
   * Only updates widgets whose icon has actually changed
   */
  async function setIcons(value: Record<string, string>): Promise<void> {
    const currentIcons = icons.value;
    
    // Update widgets whose icon has changed
    for (const [widgetId, icon] of Object.entries(value)) {
      const currentIcon = currentIcons[widgetId];
      // Only update if the icon has actually changed
      if (currentIcon !== icon) {
        await firestoreStore.updateWidget(widgetId, { icon: icon || undefined });
      }
    }

    // Remove icons that are no longer in the value (only if they existed before)
    for (const widgetId of Object.keys(currentIcons)) {
      if (!value[widgetId] && currentIcons[widgetId]) {
        // Only update if the widget had an icon before
        await firestoreStore.updateWidget(widgetId, { icon: undefined });
      }
    }
  }

  /**
   * Save actions to Firestore
   * Only updates widgets whose actions have actually changed
   */
  async function setActions(value: Record<string, { tapAction?: any; holdAction?: any }>): Promise<void> {
    const currentActions = actions.value;
    
    // Update widgets whose actions have changed
    for (const [widgetId, action] of Object.entries(value)) {
      const currentAction = currentActions[widgetId];
      // Only update if the action has actually changed
      // Compare by JSON stringify to handle object comparison
      const currentActionStr = JSON.stringify(currentAction || {});
      const newActionStr = JSON.stringify(action || {});
      if (currentActionStr !== newActionStr) {
        await firestoreStore.updateWidget(widgetId, { action: action || undefined });
      }
    }

    // Remove actions that are no longer in the value (only if they existed before)
    for (const widgetId of Object.keys(currentActions)) {
      if (!value[widgetId] && currentActions[widgetId]) {
        // Only update if the widget had an action before
        await firestoreStore.updateWidget(widgetId, { action: undefined });
      }
    }
  }

  /**
   * Save label overrides to Firestore
   * Only updates widgets whose label override has actually changed
   */
  async function setLabelOverrides(value: Record<string, string>): Promise<void> {
    const currentLabelOverrides = labelOverrides.value;
    
    // Update widgets whose label override has changed
    for (const [widgetId, labelName] of Object.entries(value)) {
      const currentLabel = currentLabelOverrides[widgetId];
      // Only update if the value has actually changed
      if (currentLabel !== labelName) {
        await firestoreStore.updateWidget(widgetId, { labelName: labelName || undefined });
      }
    }

    // Remove label overrides that are no longer in the value (only if they existed before)
    for (const widgetId of Object.keys(currentLabelOverrides)) {
      if (!value[widgetId] && currentLabelOverrides[widgetId]) {
        // Only update if the widget had a label override before
        await firestoreStore.updateWidget(widgetId, { labelName: undefined });
      }
    }
  }

  /**
   * Save HA actions to Firestore
   * Only updates widgets whose HA actions have actually changed
   */
  async function setHAActions(value: Record<string, { service: string; serviceData?: Record<string, any> }>): Promise<void> {
    const currentHAActions = haActions.value;
    
    // Update widgets whose HA actions have changed
    for (const [widgetId, haAction] of Object.entries(value)) {
      const currentHAAction = currentHAActions[widgetId];
      // Only update if the HA action has actually changed
      // Compare by JSON stringify to handle object comparison
      const currentHAActionStr = JSON.stringify(currentHAAction || {});
      const newHAActionStr = JSON.stringify(haAction || {});
      if (currentHAActionStr !== newHAActionStr) {
        await firestoreStore.updateWidget(widgetId, { haAction: haAction || undefined });
      }
    }

    // Remove HA actions that are no longer in the value (only if they existed before)
    for (const widgetId of Object.keys(currentHAActions)) {
      if (!value[widgetId] && currentHAActions[widgetId]) {
        // Only update if the widget had an HA action before
        await firestoreStore.updateWidget(widgetId, { haAction: undefined });
      }
    }
  }

  /**
   * Save label visibility to Firestore
   */
  async function setLabelVisible(widgetId: string, visible: boolean): Promise<void> {
    await firestoreStore.updateWidget(widgetId, { labelVisible: visible });
  }

  /**
   * Save state visibility to Firestore
   */
  async function setStateVisible(widgetId: string, visible: boolean): Promise<void> {
    await firestoreStore.updateWidget(widgetId, { stateVisible: visible });
  }

  /**
   * Save value prefix to Firestore
   */
  async function setValuePrefix(widgetId: string, prefix: string | undefined): Promise<void> {
    await firestoreStore.updateWidget(widgetId, { valuePrefix: prefix });
  }

  /**
   * Save value suffix to Firestore
   */
  async function setValueSuffix(widgetId: string, suffix: string | undefined): Promise<void> {
    await firestoreStore.updateWidget(widgetId, { valueSuffix: suffix });
  }

  return {
    entities,
    positions,
    sizes,
    icons,
    actions,
    labelOverrides,
    haActions,
    labelVisible,
    stateVisible,
    valuePrefixes,
    valueSuffixes,
    setEntities,
    setPositions,
    updateWidgetPosition,
    setSizes,
    updateWidgetSize,
    setIcons,
    setActions,
    setLabelOverrides,
    setHAActions,
    setLabelVisible,
    setStateVisible,
    setValuePrefix,
    setValueSuffix,
    setUserInteracting,
  };
}
