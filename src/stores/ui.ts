import { defineStore } from 'pinia';
import { ref, watch, type Ref } from 'vue';
import { useThrottleFn } from '@vueuse/core';
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

  // Throttled function to save scroll position (every 500ms)
  const saveScrollPosition = useThrottleFn(async (position: ScrollPosition) => {
    if (!isSyncingFromFirestore) {
      await firestoreStore.saveUISettings({ scrollPosition: position });
    }
  }, 500);

  watch(
    scrollPosition,
    (newValue: ScrollPosition) => {
      saveScrollPosition(newValue);
    },
    { deep: true }
  );

  function setScrollPosition(x: number, y: number): void {
    scrollPosition.value = { x, y };
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
  };
});
