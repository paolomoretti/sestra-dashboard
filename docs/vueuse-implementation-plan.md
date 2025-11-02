# VueUse Implementation Plan

## Overview

Replace GoJS with Vue-native solution using VueUse composables.

## Architecture

### Component Structure

```
Dashboard.vue (main container)
├── BackgroundImage.vue
└── EntityWidget.vue (for each entity)
    ├── Draggable via useDraggable
    ├── Resizable via resize handles
    └── Clickable for actions
```

## Step-by-Step Implementation

### 1. Create EntityWidget Component

```vue
<template>
  <div
    ref="widgetRef"
    class="entity-widget"
    :class="{ 'selected': isSelected }"
    :style="widgetStyle"
    @click="handleClick"
    @mousedown.stop
  >
    <!-- Icon -->
    <img :src="iconUrl" class="entity-icon" />
    
    <!-- Resize handles -->
    <div
      v-if="isSelected"
      class="resize-handle resize-handle-se"
      @mousedown.stop="startResize"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDraggable } from '@vueuse/core'
import type { EntityData } from '@/composables/useEntitySelection'

interface Props {
  entity: EntityData
}

const props = defineProps<Props>()

const widgetRef = ref<HTMLElement>()
const isSelected = computed(() => false) // From store

// Draggable
const { x, y, style: dragStyle } = useDraggable(widgetRef, {
  initialValue: { 
    x: parsePosition(props.entity.loc).x, 
    y: parsePosition(props.entity.loc).y 
  },
  onEnd: () => {
    // Save position
    savePosition()
  }
})

// Resize
const width = ref(props.entity.size?.width || 60)
const height = ref(props.entity.size?.height || 80)

const widgetStyle = computed(() => ({
  ...dragStyle.value,
  width: `${width.value}px`,
  height: `${height.value}px`,
}))

function startResize(e: MouseEvent) {
  // Resize logic
}

function handleClick() {
  // Click logic
}

function savePosition() {
  // Persist to localStorage
}
</script>
```

### 2. Create Dashboard Container

```vue
<template>
  <div
    ref="dashboardRef"
    class="dashboard"
    :style="dashboardStyle"
    @wheel="handleZoom"
  >
    <img :src="floorplanImage" class="dashboard-background" />
    
    <EntityWidget
      v-for="entity in entities"
      :key="entity.key"
      :entity="entity"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { usePinch, useMouse } from '@vueuse/core'
import EntityWidget from './EntityWidget.vue'

const dashboardRef = ref<HTMLElement>()
const scale = ref(1)
const panX = ref(0)
const panY = ref(0)

// Zoom with pinch
const { scale: pinchScale } = usePinch(dashboardRef)

// Pan with mouse
const { x: mouseX, y: mouseY } = useMouse()

const dashboardStyle = computed(() => ({
  transform: `translate(${panX.value}px, ${panY.value}px) scale(${scale.value})`,
  transformOrigin: '0 0',
}))
</script>
```

### 3. Migration Checklist

- [ ] Create `EntityWidget.vue` component
- [ ] Implement drag with `useDraggable`
- [ ] Implement resize with resize handles
- [ ] Add zoom/pan functionality
- [ ] Create palette component (simple Vue list)
- [ ] Migrate entity state management
- [ ] Update persistence logic
- [ ] Remove GoJS dependency
- [ ] Clean up old GoJS code
- [ ] Test all functionality

## Key VueUse Composables Needed

1. **`useDraggable`** - Drag entities
2. **`useMouse`** - Track mouse for pan
3. **`usePinch`** - Pinch to zoom (mobile)
4. **`useResizeObserver`** - Watch resize (optional)
5. **`useLocalStorage`** - Already have this

## Benefits

- ✅ Native Vue components
- ✅ Reactivity works perfectly
- ✅ TypeScript support
- ✅ Easier to test
- ✅ Better debugging
- ✅ Smaller bundle

