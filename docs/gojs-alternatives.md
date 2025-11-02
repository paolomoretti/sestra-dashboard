# GoJS Alternatives Analysis

## Current Situation

- **Bundle Size**: 3.9MB (1.1MB gzipped) - mostly GoJS
- **GoJS Size**: 9.2MB in node_modules
- **Code Complexity**: 2200+ lines dealing with GoJS abstractions

## What You Actually Need

1. ✅ Render entities on background image
2. ✅ Draggable entities
3. ✅ Resizable entities  
4. ✅ State persistence (position, scale, icon, actions)
5. ✅ Pan/zoom canvas (optional)

## Option 1: Vue Native + VueUse (RECOMMENDED)

**You already have `@vueuse/core` installed!**

### Pros:
- ✅ **Zero additional dependencies** (VueUse already installed)
- ✅ **~50KB bundle impact** (just VueUse composables you're already using)
- ✅ **100% Vue-native** - works seamlessly with Vue reactivity
- ✅ **TypeScript support** out of the box
- ✅ **Easy to maintain** - standard Vue components

### Implementation:
```vue
<template>
  <div class="dashboard-container" ref="containerRef">
    <img :src="floorplanImage" class="background" />
    <EntityWidget
      v-for="entity in entities"
      :key="entity.id"
      :entity="entity"
      @update="saveEntity"
    />
  </div>
</template>

<script setup lang="ts">
import { useDraggable } from '@vueuse/core'
import { useResizeObserver } from '@vueuse/core'

// Each entity is a Vue component with draggable/resizable
</script>
```

### Libraries Used:
- `@vueuse/core` - `useDraggable`, `useResizeObserver`, `useMouse`, `usePinch`
- Native Vue components for entities
- CSS transforms for positioning
- Pinia for state (already have)

**Estimated bundle size**: ~50KB additional  
**Maintenance**: Low - standard Vue patterns  
**Development time**: 2-3 days to migrate

---

## Option 2: Interact.js (Lightweight Library)

**Bundle size**: ~50KB minified

### Pros:
- ✅ Very lightweight
- ✅ Excellent drag & resize API
- ✅ Drop zones support
- ✅ Touch support
- ✅ Good documentation

### Cons:
- ❌ Not Vue-specific (works with any framework)
- ❌ Need to bridge with Vue reactivity
- ❌ Additional dependency

### Implementation:
```typescript
import interact from 'interactjs'

interact('.entity')
  .draggable({ /* ... */ })
  .resizable({ /* ... */ })
```

**Estimated bundle size**: +50KB  
**Maintenance**: Medium  
**Development time**: 3-4 days

---

## Option 3: Vue-Draggable-Plus

**Bundle size**: ~100KB

### Pros:
- ✅ Vue 3 native
- ✅ TypeScript support
- ✅ Good drag & drop API
- ✅ Active maintenance

### Cons:
- ❌ Need separate library for resizing
- ❌ Still requires custom zoom/pan logic

**Estimated bundle size**: +100KB  
**Maintenance**: Medium  
**Development time**: 3-4 days

---

## Option 4: Custom Solution (No Libraries)

### Pros:
- ✅ Zero dependencies
- ✅ Full control
- ✅ Perfect for your needs

### Cons:
- ❌ More development time
- ❌ Need to handle edge cases yourself

### Implementation:
```vue
<template>
  <div 
    @mousedown="startDrag"
    @mousemove="onDrag"
    @mouseup="endDrag"
    :style="{ transform: `translate(${x}px, ${y}px)` }"
  >
    <!-- Entity content -->
    <div class="resize-handle" @mousedown.stop="startResize" />
  </div>
</template>
```

**Estimated bundle size**: +0KB  
**Maintenance**: High initially, then low  
**Development time**: 5-7 days

---

## Recommendation: **VueUse (Option 1)**

### Why?
1. **You already have it** - no new dependencies
2. **Vue-native** - works perfectly with your Vue 3 + TypeScript setup
3. **Minimal bundle impact** (~50KB vs 3.9MB)
4. **Easy migration** - can be done incrementally
5. **Better maintainability** - standard Vue patterns

### Migration Path:

#### Phase 1: Create Entity Component
- Replace GoJS node templates with Vue component
- Use `useDraggable` from VueUse
- Use CSS transforms for positioning

#### Phase 2: Add Resize
- Use resize handles with mouse events or `useResizeObserver`
- Store width/height in Pinia state

#### Phase 3: Add Zoom/Pan
- Use `usePinch` for pinch-to-zoom
- Use `useMouse` for pan
- CSS transform on container

#### Phase 4: Remove GoJS
- Delete GoJS dependency
- Clean up 2200 lines of GoJS code
- Celebrate smaller bundle! 🎉

### Code Structure:
```
src/
  components/
    Dashboard.vue          # Main container with background
    EntityWidget.vue       # Draggable/resizable entity
    EntityPalette.vue      # Sidebar list (simple Vue list)
  composables/
    useEntityDrag.ts      # useDraggable wrapper
    useEntityResize.ts     # Resize logic
    useDashboardZoom.ts   # Zoom/pan logic
  stores/
    entities.ts           # Entity state (already have this)
```

---

## Bundle Size Comparison

| Solution | Bundle Size | Gzipped | Dependencies |
|----------|-------------|---------|--------------|
| **Current (GoJS)** | 3.9MB | 1.1MB | gojs |
| **VueUse** | ~50KB | ~20KB | (already installed) |
| **Interact.js** | ~50KB | ~20KB | interactjs |
| **Vue-Draggable-Plus** | ~100KB | ~40KB | vue-draggable-plus |
| **Custom** | 0KB | 0KB | none |

---

## Recommendation

**Go with VueUse (Option 1)** because:
1. ✅ Already installed
2. ✅ Minimal bundle impact
3. ✅ Better Vue integration
4. ✅ Easier to maintain
5. ✅ TypeScript ready

The migration would:
- Reduce bundle by **~3.85MB** (99% reduction!)
- Simplify codebase significantly
- Make it easier to customize and extend
- Better align with Vue best practices

