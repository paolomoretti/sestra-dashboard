# Implementation Roadmap: Picture Elements Support

## Analysis Summary

Your Picture Elements config has:
- **26 state-icons** (most common)
- **10 state-badges** (text displays)
- **4 camera images**
- **3 conditional elements**
- **2 state-labels**
- **3 static icons**
- **1 action-button**

Key actions: `toggle`, `more-info`, `navigate`, `call-service`

## Implementation Plan

### Phase 1: Basic Actions & State Colors (Highest Priority)

#### 1.1 Add Tap Action Support
**Files to modify:**
- `src/dashboard.js` - Add action handler
- `src/utils/actionHandler.js` - NEW: Action execution logic
- `src/components/EntityInfoPanel.vue` - Add action configuration UI

**Implementation:**
```javascript
// In dashboard.js - Add click handler instead of just selection
diagram.addDiagramListener('ObjectSingleClicked', (e) => {
  const node = e.subject;
  if (node instanceof go.Node && node.data) {
    const tapAction = node.data.tapAction;
    if (tapAction) {
      executeAction(tapAction, node.data);
      e.handled = true; // Prevent selection if action exists
    }
  }
});

// src/utils/actionHandler.js
export async function executeAction(action, entityData, config) {
  switch(action.action) {
    case 'toggle':
      return await toggleEntity(entityData.entityId, config);
    case 'more-info':
      return showMoreInfo(entityData);
    case 'navigate':
      return navigateTo(action.navigation_path);
    case 'call-service':
      return await callService(action.service, action.entity_id, config);
  }
}
```

#### 1.2 State Color Support
**Implementation:**
```javascript
// In defineTemplates() - Update icon color based on state
function createIconDisplay() {
  return new go.Picture({
    name: 'ICON',
    // ...
  })
  .bind('source', 'icon', (iconName) => { /* ... */ })
  .bind('opacity', 'stateColor', 'state', (stateColor, state) => {
    if (!stateColor) return 1.0;
    // Change icon color based on state
    return state === 'on' ? 1.0 : 0.5;
  })
  // Or use different approach - modify SVG fill color
}
```

**Better approach:** Update `createIconSVG` to accept state and apply color:
```javascript
// In iconUtils.js
export function createIconSVG(path, fill, size, stateColor, state) {
  let iconColor = fill;
  if (stateColor && state === 'on') {
    iconColor = '#4CAF50'; // Green when on
  } else if (stateColor && state === 'off') {
    iconColor = '#888888'; // Gray when off
  }
  // ...
}
```

#### 1.3 EntityInfoPanel Updates
Add action configuration section:
```vue
<!-- In EntityInfoPanel.vue -->
<div class="detail-row">
  <span class="detail-label">Tap Action:</span>
  <select v-model="tapActionType" @change="updateTapAction">
    <option value="">None</option>
    <option value="toggle">Toggle</option>
    <option value="more-info">More Info</option>
    <option value="navigate">Navigate</option>
  </select>
</div>
```

### Phase 2: Element Types

#### 2.1 State Badge Template
Create new template for state badges:
```javascript
// In defineTemplates()
diagram.nodeTemplateMap.add('state-badge',
  new go.Node('Auto', {
    resizable: true,
    // ...
  })
  .add(
    go.GraphObject.make(go.TextBlock, {
      font: '14px sans-serif',
      stroke: '#ffffff',
      textAlign: 'center'
    })
    .bind('text', 'state', (state) => state || 'unknown')
  )
);
```

#### 2.2 State Label Template
Similar but with prefix support:
```javascript
diagram.nodeTemplateMap.add('state-label',
  new go.Node('Auto', {
    // ...
  })
  .add(
    go.GraphObject.make(go.TextBlock)
      .bind('text', ['prefix', 'state'], (prefix, state) => {
        return `${prefix || ''}${state || ''}`;
      })
  )
);
```

#### 2.3 Element Type Selector in EntityInfoPanel
```vue
<div class="detail-row">
  <span class="detail-label">Element Type:</span>
  <select v-model="elementType" @change="updateElementType">
    <option value="state-icon">State Icon</option>
    <option value="state-badge">State Badge</option>
    <option value="state-label">State Label</option>
    <option value="icon">Icon</option>
    <option value="image">Image</option>
  </select>
</div>
```

### Phase 3: Conditional Elements

#### 3.1 Condition Evaluator
```javascript
// src/utils/conditionEvaluator.js
export function evaluateCondition(condition, entityState) {
  switch(condition.condition) {
    case 'numeric_state':
      const value = parseFloat(entityState.state);
      if (condition.above !== undefined) {
        return value > condition.above;
      }
      if (condition.below !== undefined) {
        return value < condition.below;
      }
      break;
    case 'state':
      return entityState.state === condition.state;
  }
  return false;
}

export function evaluateConditions(conditions, allStates) {
  return conditions.every(cond => {
    const entityState = allStates.find(s => s.entity_id === cond.entity);
    if (!entityState) return false;
    return evaluateCondition(cond, entityState);
  });
}
```

#### 3.2 Update Node Visibility Based on Conditions
```javascript
// In dashboard.js - Periodic condition check
function updateConditionalElements(config) {
  diagram.nodes.each(node => {
    const data = node.data;
    if (data.conditional) {
      const visible = evaluateConditions(
        data.conditional.conditions,
        window.allEntityStates // Need to fetch current states
      );
      node.visible = visible;
    }
  });
}
```

### Phase 4: Camera Images

#### 4.1 Image Template
```javascript
diagram.nodeTemplateMap.add('image',
  new go.Node('Auto', {
    resizable: true,
    // ...
  })
  .add(
    go.GraphObject.make(go.Picture, {
      name: 'CAMERA_IMAGE',
      source: '',
      imageStretch: go.GraphObject.Uniform
    })
    .bind('source', 'cameraImage', (cameraEntity) => {
      if (!cameraEntity) return '';
      return `${getApiBaseUrl()}/camera_proxy/${cameraEntity}`;
    })
    .bind('width', 'size', (size) => {
      // Parse from size or custom width property
    })
  )
);
```

#### 4.2 Camera Image Loader
```javascript
// src/utils/cameraLoader.js
export async function loadCameraImage(cameraEntity, config) {
  const url = `${getApiBaseUrl(config)}/camera_proxy/${cameraEntity}`;
  // Fetch with auth headers
  // Return as data URI or URL
}
```

### Phase 5: Advanced Features

#### 5.1 Hold Action Support
```javascript
// Track mouse down/up for hold detection
let mouseDownTime = null;
let holdTimer = null;

diagram.addDiagramListener('ObjectMouseDown', (e) => {
  const node = e.subject;
  if (node instanceof go.Node) {
    mouseDownTime = Date.now();
    holdTimer = setTimeout(() => {
      if (node.data.holdAction) {
        executeAction(node.data.holdAction, node.data);
      }
    }, 500); // 500ms hold
  }
});

diagram.addDiagramListener('ObjectMouseUp', (e) => {
  if (holdTimer) {
    clearTimeout(holdTimer);
    holdTimer = null;
  }
  mouseDownTime = null;
});
```

#### 5.2 Service Calls
```javascript
// src/utils/actionHandler.js
export async function callService(service, entityId, config) {
  const [domain, serviceName] = service.split('.');
  const url = `${getApiBaseUrl(config)}/services/${domain}/${serviceName}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      entity_id: entityId
    })
  });
  
  return await response.json();
}
```

## Data Persistence

### Storage Schema Update
```javascript
// New localStorage keys
const STORAGE_KEY_ACTIONS = 'ha_dashboard_actions';
const STORAGE_KEY_ELEMENT_TYPES = 'ha_dashboard_element_types';
const STORAGE_KEY_CONDITIONALS = 'ha_dashboard_conditionals';
const STORAGE_KEY_STATE_COLORS = 'ha_dashboard_state_colors';

// Enhanced entity data structure
{
  key: 'entity_id',
  entityId: 'entity_id',
  category: 'sensor',
  elementType: 'state-icon', // NEW
  tapAction: { action: 'toggle' }, // NEW
  holdAction: { action: 'more-info' }, // NEW
  stateColor: true, // NEW
  conditional: { // NEW
    conditions: [...],
    elements: [...]
  },
  prefix: 'H: ', // NEW for state-label
  cameraImage: 'camera.entity', // NEW for image type
  // ... existing properties
}
```

## Migration from Picture Elements Config

### Import Script
```javascript
// src/utils/pictureElementsImporter.js
export function importPictureElementsConfig(config, diagram) {
  const nodes = [];
  
  config.elements.forEach(element => {
    const node = {
      key: element.entity || `element_${Date.now()}`,
      elementType: element.type,
      entityId: element.entity,
      icon: element.icon?.replace('mdi:', ''),
      title: element.title,
      stateColor: element.state_color || false,
      tapAction: element.tap_action,
      holdAction: element.hold_action,
      prefix: element.prefix,
      attribute: element.attribute,
      cameraImage: element.camera_image,
      // Convert percentage to GoJS coordinates
      loc: `${convertPercentToCoord(element.style.left, 'x')} ${convertPercentToCoord(element.style.top, 'y')}`
    };
    
    if (element.type === 'conditional') {
      node.conditional = {
        conditions: element.conditions,
        elements: element.elements
      };
    }
    
    nodes.push(node);
  });
  
  diagram.model = new go.GraphLinksModel(nodes, []);
}
```

## Next Steps

1. **Start with Phase 1** - Most impactful features
2. **Add UI in EntityInfoPanel** - Make it easy to configure
3. **Test with your actual entities** - Use your Picture Elements config as test data
4. **Iterate** - Add more features based on what you use most

## Recommended Order

1. ✅ Tap actions (toggle, more-info)
2. ✅ State color support
3. ✅ State badge element type
4. ✅ Conditional visibility
5. ✅ Camera images
6. ✅ Hold actions
7. ✅ Service calls
8. ✅ Import tool for Picture Elements config

