# Picture Elements Feature Analysis

## Element Types Found

### 1. State Icons (Most Common - 26 instances)
- Shows icon that changes color based on state (`state_color: true`)
- Actions: `toggle`, `more-info`
- Icons: Custom MDI icons
- Position: Percentage-based (left/top)

### 2. State Badges (10 instances)
- Shows entity state as text/badge
- Some have `color: transparent` for minimal visibility
- Can have conditions attached
- Actions: `toggle` (on one instance)

### 3. State Labels (2 instances)
- Shows state/attribute with optional prefix
- Simple text display

### 4. Icons (3 instances)
- Static icons with actions
- Navigation support (`navigate`)
- Can reference entities

### 5. Images (4 instances)
- Camera live views
- Configurable size (width, aspect ratio)
- Auto camera view mode

### 6. Conditional Elements (3 instances)
- Shows elements based on conditions
- Conditions: `numeric_state` (above), `state` (on/off)
- Nested elements within conditions

### 7. Action Buttons (1 instance)
- Triggers automations/services
- Custom styling

## Key Features to Implement

### Priority 1: Core Functionality
1. **State-based visual changes**
   - Icon color changes (`state_color`)
   - Conditional visibility
   
2. **Actions**
   - Tap action: `toggle`, `more-info`, `navigate`
   - Hold action: `more-info`
   - Service calls (automation triggers)

3. **Element types**
   - State badges (text display)
   - State labels (with prefixes)
   - Conditional elements

### Priority 2: Advanced Features
4. **Camera images**
   - Live camera feeds
   - Configurable size/aspect ratio

5. **Conditional logic**
   - Numeric state conditions
   - State conditions
   - Nested conditional elements

6. **Styling options**
   - Transparent backgrounds
   - Custom colors
   - Height/width constraints

## Implementation Recommendations

### Data Model Extension
```javascript
{
  key: 'entity_id',
  name: 'Friendly Name',
  entityId: 'entity_id',
  // Current properties
  category: 'sensor',
  icon: 'mdi:lightbulb',
  state: 'on',
  
  // New properties needed
  elementType: 'state-icon' | 'state-badge' | 'state-label' | 'icon' | 'image' | 'conditional' | 'action-button',
  tapAction: {
    action: 'toggle' | 'more-info' | 'navigate' | 'call-service',
    navigation_path?: string,
    service?: string,
    entity_id?: string
  },
  holdAction?: { ... },
  stateColor?: boolean,
  conditional?: {
    conditions: Array<{
      condition: 'numeric_state' | 'state',
      entity: string,
      above?: number,
      below?: number,
      state?: string
    }>,
    elements: Array<...>
  },
  prefix?: string,
  attribute?: string,
  cameraImage?: string,
  cameraView?: 'auto',
  aspectRatio?: string,
  customStyle?: {
    color?: string,
    backgroundColor?: string,
    // ... other CSS properties
  }
}
```

### UI Components Needed
1. **Enhanced EntityInfoPanel**
   - Element type selector
   - Action configuration (tap/hold)
   - Conditional editor
   - Camera image selector

2. **Condition Editor**
   - Visual condition builder
   - Entity selector
   - Operator selector (>, <, ==, etc.)

3. **Action Editor**
   - Action type selector
   - Navigation path input
   - Service call builder

4. **Visual State Manager**
   - State color toggle
   - Custom color picker
   - Visibility rules

### Backend/Logic Components
1. **Action Handler**
   - Toggle entities
   - Show more-info dialog
   - Navigation router
   - Service call executor

2. **Condition Evaluator**
   - Evaluate conditions in real-time
   - Update visibility/styles based on conditions

3. **State Color Manager**
   - Map entity states to colors
   - Apply colors to icons dynamically

4. **Camera Image Loader**
   - Fetch camera images from HA
   - Cache and refresh logic

## Migration Path

### Phase 1: Basic Actions (Week 1)
- Add tap_action support (toggle, more-info)
- Add state_color support for icons
- Update EntityInfoPanel with action editor

### Phase 2: Element Types (Week 2)
- State badges (text display)
- State labels (with prefixes)
- Basic conditional visibility

### Phase 3: Advanced Features (Week 3-4)
- Camera images
- Full conditional logic
- Hold actions
- Service calls

### Phase 4: Polish (Week 5)
- UI improvements
- Performance optimization
- Advanced styling options

