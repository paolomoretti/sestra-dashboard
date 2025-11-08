import { defineStore } from 'pinia';
import { ref, watch, type Ref } from 'vue';
import { useDebounceFn } from '@vueuse/core';
import { useFirestoreStore } from './firestore';

interface ScrollPosition {
  x: number;
  y: number;
}

export const useUIStore = defineStore('ui', () => {
  const firestoreStore = useFirestoreStore();

  // Flags to prevent circular updates
  let isSyncingFromFirestore = false;

  // Labels visibility - synced with Firestore
  const labelsVisible: Ref<boolean> = ref(true);

  // Watch Firestore and sync to local ref
  watch(
    () => firestoreStore.uiData?.labelsVisible,
    newValue => {
      if (newValue !== undefined && newValue !== labelsVisible.value) {
        isSyncingFromFirestore = true;
        labelsVisible.value = newValue;
        isSyncingFromFirestore = false;
      }
    },
    { immediate: true }
  );

  // Watch local ref and save to Firestore (only if not syncing from Firestore)
  watch(labelsVisible, async newValue => {
    if (!isSyncingFromFirestore) {
      await firestoreStore.saveUISettings({ labelsVisible: newValue });
    }
  });

  function toggleLabels(): void {
    labelsVisible.value = !labelsVisible.value;
  }

  function setLabelsVisible(value: boolean): void {
    labelsVisible.value = value;
  }

  // Sidebar visibility - synced with Firestore
  const sidebarVisible: Ref<boolean> = ref(true);

  // Watch Firestore and sync to local ref
  watch(
    () => firestoreStore.uiData?.sidebarVisible,
    newValue => {
      if (newValue !== undefined && newValue !== sidebarVisible.value) {
        isSyncingFromFirestore = true;
        sidebarVisible.value = newValue;
        isSyncingFromFirestore = false;
      }
    },
    { immediate: true }
  );

  // Watch local ref and save to Firestore (only if not syncing from Firestore)
  watch(sidebarVisible, async newValue => {
    if (!isSyncingFromFirestore) {
      await firestoreStore.saveUISettings({ sidebarVisible: newValue });
    }
  });

  function toggleSidebar(): void {
    sidebarVisible.value = !sidebarVisible.value;
  }

  function setSidebarVisible(value: boolean): void {
    sidebarVisible.value = value;
  }

  // Scroll position (viewport center point) - synced with Firestore
  const scrollPosition: Ref<ScrollPosition> = ref({ x: 0, y: 0 });

  // Watch Firestore and sync to local ref
  watch(
    () => firestoreStore.uiData?.scrollPosition,
    newValue => {
      if (newValue && JSON.stringify(newValue) !== JSON.stringify(scrollPosition.value)) {
        isSyncingFromFirestore = true;
        scrollPosition.value = newValue;
        isSyncingFromFirestore = false;
      }
    },
    { immediate: true, deep: true }
  );

  // Debounced function to save scroll position (after 1 second of inactivity)
  const saveScrollPosition = useDebounceFn(async (position: ScrollPosition) => {
    if (!isSyncingFromFirestore) {
      void firestoreStore.saveUISettings({ scrollPosition: position });
    }
  }, 1000);

  watch(
    scrollPosition,
    (newValue: ScrollPosition) => {
      void saveScrollPosition(newValue);
    },
    { deep: true }
  );

  function setScrollPosition(x: number, y: number): void {
    scrollPosition.value = { x, y };
  }

  // Scale (zoom level) - synced with Firestore
  const scale: Ref<number | undefined> = ref(undefined);
  let hasRestoredScale = false;

  // Watch Firestore and sync to local ref (only on initial load)
  watch(
    () => firestoreStore.uiData?.scale,
    newValue => {
      // Only restore scale on initial load (first time it's set from Firestore)
      if (newValue !== undefined && !hasRestoredScale && scale.value === undefined) {
        isSyncingFromFirestore = true;
        scale.value = newValue;
        hasRestoredScale = true;
        isSyncingFromFirestore = false;
      }
    },
    { immediate: true }
  );

  // Debounced function to save scale (after 1 second of inactivity)
  const saveScale = useDebounceFn(async (scaleValue: number) => {
    if (!isSyncingFromFirestore) {
      void firestoreStore.saveUISettings({ scale: scaleValue });
    }
  }, 1000);

  watch(scale, (newValue: number | undefined) => {
    // Only save if scale is defined and we've already restored it (to avoid saving during initial restore)
    if (newValue !== undefined && hasRestoredScale && !isSyncingFromFirestore) {
      void saveScale(newValue);
    }
  });

  function setScale(value: number): void {
    // Mark that we've restored scale if it was undefined and now we're setting it
    if (scale.value === undefined) {
      hasRestoredScale = true;
    }
    scale.value = value;
  }

  return {
    // Labels visibility
    labelsVisible,
    toggleLabels,
    setLabelsVisible,
    // Sidebar visibility
    sidebarVisible,
    toggleSidebar,
    setSidebarVisible,
    // Scroll position
    scrollPosition,
    setScrollPosition,
    // Scale
    scale,
    setScale,
    hasRestoredScale: () => hasRestoredScale,
  };
});
