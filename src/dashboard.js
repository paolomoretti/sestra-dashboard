import * as go from 'gojs';
import { setSelectedEntity, clearSelection } from './composables/useEntitySelection.js';
import { extractIconFromHA, getDefaultIcon, getMDIIconPath, createIconSVG } from './utils/iconUtils.js';
// Edit mode is accessed via window.__editMode (set by Vue component) to avoid reactivity issues in non-Vue context

let diagram;
let palette;
let eventLog = [];
let backgroundPart = null;
let hasBackground = false;
let allEntities = []; // Store all available entities
let isLoadingEntities = false; // Flag to prevent saving during initial load
let currentEntityFilter = 'all'; // Current filter for entity types
let currentSearchQuery = ''; // Current search query

// Storage keys
const STORAGE_KEY_POSITIONS = 'ha_dashboard_positions';
const STORAGE_KEY_ENTITIES = 'ha_dashboard_entities'; // Which entities are on the floor plan
const STORAGE_KEY_SCALE = 'ha_dashboard_scale'; // Diagram scale/zoom level
const STORAGE_KEY_SIZES = 'ha_dashboard_sizes'; // Node sizes
const STORAGE_KEY_ICONS = 'ha_dashboard_icons'; // Custom icon preferences per entity
const STORAGE_KEY_ACTIONS = 'ha_dashboard_actions'; // Tap and hold actions per entity

// Floor plan dimensions
const FLOORPLAN_WIDTH = 2190;
const FLOORPLAN_HEIGHT = 6501;
const FLOORPLAN_IMAGE = '/floorplan.png';

// Import MDI icon list for selection
import { COMMON_MDI_ICONS } from './utils/mdiIconList.js';

// Export for use in components
export const ICON_OPTIONS = COMMON_MDI_ICONS;

/**
 * Get the API base URL - use proxy in development, direct URL in production
 */
function getApiBaseUrl(config) {
  // In development, use the Vite proxy
  if (import.meta.env.DEV) {
    return '/api';
  }
  // In production, use the full Home Assistant address
  return `${config.address}/api`;
}

/**
 * Initialize the dashboard with GoJS diagram
 */
export function initDashboard(config) {
  // Set loading flag immediately to prevent saves during initialization
  isLoadingEntities = true;
  
  // Initialize GoJS diagram
  // Create a "no-op" layout that doesn't reposition nodes - satisfies GoJS requirement
  // while allowing manual positioning
  const noOpLayout = new go.Layout();
  noOpLayout.doLayout = function(parts) {
    // Do nothing - nodes stay where they are positioned
    return;
  };
  
  // Check if diagram already exists and clean it up
  if (diagram) {
    diagram.div = null;
  }
  
  diagram = new go.Diagram('diagramDiv', {
    'undoManager.isEnabled': true,
    allowCopy: false,
    allowDelete: true, // Allow deleting nodes with Delete key
    'toolManager.mouseWheelBehavior': go.ToolManager.WheelZoom,
    layout: noOpLayout,
    'toolManager.showToolTip': true, // Enable tooltips
    maxSelectionCount: 1 // Only allow selecting one node at a time (better for menu)
  });

  // Expose diagram instance to Vue components for coordinate conversion
  window.diagramInstance = diagram;
  
  // Expose updateSensorStates globally for action handler
  window.updateSensorStates = updateSensorStates;
  
  // Override default selection handles - we'll use our custom adornment
  // But keep resize handles by making them part of our custom adornment
  
  // Listen for scale/viewport changes to update panel position and save zoom level
  diagram.addDiagramListener('ViewportBoundsChanged', () => {
    // Update Vue panel position if entity is selected
    if (diagram.selection.count > 0) {
      const node = diagram.selection.first();
      if (node instanceof go.Node && node.data) {
        const bounds = node.actualBounds;
        setSelectedEntity(node.data, {
          x: bounds.center.x,
          y: bounds.bottom
        });
      }
    }
    // Debounce scale saves
    setTimeout(() => {
      saveScale();
    }, 300);
  });

  // Define node templates for different entity types
  defineTemplates();

  // Create initial empty model (this won't trigger saves because isLoadingEntities is true)
  diagram.model = new go.GraphLinksModel([], []);
  
  // Initialize palette for drag-and-drop
  initPalette();
  
  // Enable drag-and-drop from palette to diagram
  diagram.allowDrop = true;
  setupDragDrop();

  // Allow clicking on background to deselect nodes (closes menu)
  diagram.addDiagramListener('BackgroundSingleClicked', (e) => {
    diagram.clearSelection();
  });
  
  // Override ClickSelectingTool.doMouseUp to intercept BEFORE selection happens
  // Clicking on an icon executes the action, clicking on a label selects the node
  const clickSelectingTool = diagram.toolManager.clickSelectingTool;
  const originalDoMouseUp = clickSelectingTool.doMouseUp.bind(clickSelectingTool);
  
  clickSelectingTool.doMouseUp = function() {
    // Check what was clicked
    const obj = this.diagram.findObjectAt(this.diagram.lastInput.documentPoint, null, null);
    
    // If clicking on a node, check if it has a tap action
    if (obj && obj.part && obj.part instanceof go.Node && obj.part.data) {
      const tapAction = obj.part.data.tapAction;
      
      // If clicking on the icon/picture (name === 'ICON') and there's a tap action, execute it
      if (obj.name === 'ICON' && tapAction && tapAction.action) {
        // Prevent selection - execute action instead
        (async () => {
          try {
            const { executeTapAction } = await import('./utils/actionHandler.js');
            await executeTapAction(tapAction, obj.part.data, config);
          } catch (error) {
            console.error('Error executing tap action:', error);
            addEvent(`Error: ${error.message}`, 'error');
          }
        })();
        return; // Don't call originalDoMouseUp - prevents selection
      }
    }
    
    // Clicking on label (Vue component handles it) or no tap action - allow normal selection
    return originalDoMouseUp.call(this);
  };
  
  // Listen for selection changes and update Vue state
  diagram.addDiagramListener('ChangedSelection', (e) => {
    if (diagram.selection.count > 0) {
      const node = diagram.selection.first();
      if (node instanceof go.Node && node.data) {
        // Get node position in diagram coordinates
        const bounds = node.actualBounds;
        const position = {
          x: bounds.center.x,
          y: bounds.bottom
        };
        // Update Vue state with selected entity and position
        setSelectedEntity(node.data, position);
      }
    } else {
      // No selection, clear Vue state (but keep labels visible)
      clearSelection();
    }
    
    // Also save positions after selection change (debounced)
    setTimeout(() => {
      savePositions();
      savePlacedEntities();
    }, 300);
  });
  
    // Also save after any transaction completes (catches all changes)
    // But skip if we're currently loading entities
    diagram.addModelChangedListener((e) => {
      if (e.isTransactionFinished && !isLoadingEntities) {
        // Final save after any transaction (but not during initial load)
        setTimeout(() => {
          savePlacedEntities();
          savePositions();
          saveActions();
        }, 200);
      }
    });
  
  // Listen for when parts are dragged/moved - update panel position
  diagram.addDiagramListener('SelectionMoved', () => {
    savePositions();
    // Update Vue panel position if entity is selected
    if (diagram.selection.count > 0) {
      const node = diagram.selection.first();
      if (node instanceof go.Node && node.data) {
        const bounds = node.actualBounds;
        setSelectedEntity(node.data, {
          x: bounds.center.x,
          y: bounds.bottom
        });
      }
    }
  });
  
  // Debounce timer for saving sizes after resize completes
  let resizeSaveTimeout = null;
  let resizeTransactionActive = false;
  
  // Listen for when nodes are resized (fires continuously during resize)
  diagram.addDiagramListener('PartResized', (e) => {
    const part = e.subject;
    if (part && part.data && part instanceof go.Node) {
      // Store reference to the node being resized
      const resizedNode = part;
      
      // Always save the entire node bounds, not just the shape
      const bounds = part.actualBounds;
      const width = bounds.width;
      const height = bounds.height;
      const sizeStr = `${width} ${height}`;
      
      // Update size in model data within a transaction
      if (!resizeTransactionActive) {
        resizeTransactionActive = true;
        diagram.startTransaction('resizeNode');
      }
      diagram.model.setDataProperty(part.data, 'size', sizeStr);
      
      // Force update by invalidating the layout
      part.invalidateLayout();
      
      // Debounce the save - wait 600ms after last resize event
      // This ensures we capture the final size when user releases mouse
      clearTimeout(resizeSaveTimeout);
      resizeSaveTimeout = setTimeout(() => {
        // Commit any pending transaction first
        if (resizeTransactionActive) {
          diagram.commitTransaction('resizeNode');
          resizeTransactionActive = false;
        }
        
        // Wait a bit more for GoJS to finalize, then update only the resized node
        setTimeout(() => {
          // Only update the specific node that was resized, not all nodes
          if (resizedNode && resizedNode.data && !resizedNode.isDeleted) {
            diagram.startTransaction('resizeFinalSave');
            const finalBounds = resizedNode.actualBounds;
            const finalSizeStr = `${finalBounds.width} ${finalBounds.height}`;
            
            // Only update if different (avoid unnecessary updates)
            if (resizedNode.data.size !== finalSizeStr) {
              diagram.model.setDataProperty(resizedNode.data, 'size', finalSizeStr);
            }
            diagram.commitTransaction('resizeFinalSave');
          }
          
          // Now save to localStorage
          saveSizes();
          savePositions();
          
          // Update Vue panel position if this node is selected
          if (diagram.selection.count > 0) {
            const selectedNode = diagram.selection.first();
            if (selectedNode === resizedNode && selectedNode instanceof go.Node && selectedNode.data) {
              const bounds = selectedNode.actualBounds;
              setSelectedEntity(selectedNode.data, {
                x: bounds.center.x,
                y: bounds.bottom
              });
            }
          }
        }, 100);
      }, 600);
    }
  });
  
  // Listen for model changes (for programmatic changes and palette drops)
  // Note: We also have a final save listener above that catches all transactions
  let processingInsert = false;
  diagram.addModelChangedListener((e) => {
    if (e.isTransactionFinished) {
      if (e.change === go.ChangedEvent.Property && e.propertyName === 'loc') {
        setTimeout(() => savePositions(), 100);
      } else if (e.change === go.ChangedEvent.Insert && !processingInsert) {
        processingInsert = true;
        // Entity added - could be from palette or programmatic
        const nodeData = e.newValue;
        
        // Check if this came from palette (has entityId)
        if (nodeData && nodeData.entityId) {
          const entityId = nodeData.entityId;
          const entityInfo = allEntities.find(e => e.entityId === entityId);
          
          if (entityInfo) {
            // Wait a bit for the node to be fully created
            setTimeout(() => {
              // This came from palette - update it with proper entity info
              // Use transaction to avoid errors
              diagram.startTransaction('updatePaletteNode');
              
              diagram.model.setDataProperty(nodeData, 'key', entityId);
              diagram.model.setDataProperty(nodeData, 'name', entityInfo.friendlyName);
              diagram.model.setDataProperty(nodeData, 'state', entityInfo.state.state);
              if (entityInfo.state.attributes.status) {
                diagram.model.setDataProperty(nodeData, 'status', entityInfo.state.attributes.status);
              }
              
              // Set icon from entity info or use default
              const iconName = extractIconFromHA(entityInfo.state) || 
                              getDefaultIcon(entityInfo.domain, entityInfo.state.attributes.device_class);
              diagram.model.setDataProperty(nodeData, 'icon', iconName);
              diagram.model.setDataProperty(nodeData, 'deviceClass', entityInfo.state.attributes.device_class || null);
              
              // Ensure location is set
              const part = diagram.findPartForData(nodeData);
              if (part) {
                const loc = part.location;
                diagram.model.setDataProperty(nodeData, 'loc', `${loc.x} ${loc.y}`);
                
                // Set default size if not present
                if (!nodeData.size) {
                  const defaultSize = part.actualBounds.width + ' ' + part.actualBounds.height;
                  diagram.model.setDataProperty(nodeData, 'size', defaultSize);
                }
              }
              
              diagram.commitTransaction('updatePaletteNode');
              
              addEvent(`Added ${entityInfo.friendlyName}`, 'success');
              
              // Save after transaction completes
              setTimeout(() => {
                savePlacedEntities();
                savePositions();
              }, 100);
            }, 150);
          }
        } else {
          // Regular node insertion (not from palette)
          setTimeout(() => {
            savePlacedEntities();
            processingInsert = false;
          }, 100);
        }
        setTimeout(() => { processingInsert = false; }, 500);
      } else if (e.change === go.ChangedEvent.Remove) {
        // Entity removed
        setTimeout(() => savePlacedEntities(), 100);
      }
    }
  });

  // Load floor plan background automatically
  loadFloorPlanBackground();

  // Test connection to Home Assistant
  if (config.address && config.accessToken) {
    testHAConnection(config)
      .then(() => {
        addEvent('Connected to Home Assistant', 'success');
        loadEntities(config).then(() => {
          // Load entities that were previously placed on the floor plan
          loadPlacedEntities(config).then(() => {
            // After loading completes, allow saves
            isLoadingEntities = false;
            console.log('✓ Initial load complete, saving enabled. Diagram has', diagram.nodes.count, 'nodes');
          }).catch((error) => {
            console.error('Error in loadPlacedEntities:', error);
            isLoadingEntities = false;
          });
        }).catch((error) => {
          console.error('Error in loadEntities:', error);
        });
      })
      .catch((error) => {
        addEvent(`Failed to connect: ${error.message}`, 'error');
        console.error('Home Assistant connection error:', error);
        isLoadingEntities = false; // Enable saves even if connection fails
      });
  } else {
    addEvent('Please configure Home Assistant credentials in config.js', 'warning');
    isLoadingEntities = false; // Enable saves even without config
  }

  // Set up periodic updates
  if (config.address && config.accessToken) {
    setInterval(() => {
      updateSensorStates(config);
    }, 5000); // Update every 5 seconds
  }
  
  // Expose filter function to window for Vue components
  window.updatePaletteFilter = (filterValue, searchValue = '') => {
    currentEntityFilter = filterValue;
    currentSearchQuery = searchValue || '';
    filterAndUpdatePalette();
  };
  
  // Expose zoom functions to window for Vue components
  window.zoomIn = () => {
    if (diagram) {
      diagram.commandHandler.increaseZoom();
      saveScale();
    }
  };
  
  window.zoomOut = () => {
    if (diagram) {
      diagram.commandHandler.decreaseZoom();
      saveScale();
    }
  };
  
  window.zoomReset = () => {
    if (diagram && hasBackground) {
      fitDiagramToViewport(FLOORPLAN_WIDTH, FLOORPLAN_HEIGHT);
      saveScale();
    }
  };
  
  window.getZoomLevel = () => {
    return diagram ? Math.round(diagram.scale * 100) : 100;
  };
  
  // Expose updateSensorStates globally for action handler
  window.updateSensorStates = updateSensorStates;
  
  // Expose initPalette function for when sidebar becomes visible
  window.initPalette = initPalette;
}


/**
 * Define GoJS node templates for sensors, doors, cameras, etc.
 */
function defineTemplates() {
  // Define a menu-style selection adornment that appears when clicking an entity
  // Using 'Auto' with a Spot panel inside to position the menu below the node
  // The resize handles are handled separately by GoJS for resizable nodes
  const selectionAdornmentTemplate = 
    go.GraphObject.make(go.Adornment, 'Auto',
      {
        isShadowed: true,
        shadowColor: 'rgba(0, 0, 0, 0.5)',
        shadowBlur: 10,
        shadowOffset: new go.Point(0, 3)
      },
      // Background/border shape
      go.GraphObject.make(go.Shape,
        {
          figure: 'Rectangle',
          fill: '#2a2a2a',
          stroke: '#4a4a4a',
          strokeWidth: 1
        }
      ),
      // Content panel
      go.GraphObject.make(go.Panel, 'Vertical',
        // Border shape - first element in Auto panel fills the panel
        go.GraphObject.make(go.Shape,
          {
            figure: 'Rectangle',
            fill: '#2a2a2a',
            stroke: '#4a4a4a',
            strokeWidth: 1
          }
        ),
        go.GraphObject.make(go.Panel, 'Vertical',
          {
            padding: new go.Margin(4, 0, 4, 0)
          },
          // Entity name header
          go.GraphObject.make(go.Panel, 'Horizontal',
            {
              background: '#333333',
              padding: new go.Margin(10, 14, 10, 14),
              defaultAlignment: go.Spot.Left
            },
            go.GraphObject.make(go.TextBlock,
              {
                font: 'bold 16px sans-serif',
                stroke: '#ffffff',
                textAlign: 'left',
                maxLines: 2,
                wrap: go.TextBlock.WrapFit,
                overflow: go.TextOverflow.Ellipsis,
                width: 280
              },
              new go.Binding('text', 'name')
            )
          ),
          // Divider
          go.GraphObject.make(go.Shape,
            {
              figure: 'Rectangle',
              height: 1,
              stroke: '#4a4a4a',
              margin: new go.Margin(4, 0, 4, 0)
            }
          ),
          // Entity details
          go.GraphObject.make(go.Panel, 'Table',
            {
              padding: new go.Margin(8, 14, 10, 14),
              defaultColumnSeparatorStroke: 'transparent',
              defaultRowSeparatorStroke: '#3a3a3a',
              defaultAlignment: go.Spot.Left
            },
            go.GraphObject.make(go.RowColumnDefinition, { column: 0, width: 90 }),
            go.GraphObject.make(go.RowColumnDefinition, { column: 1, width: 220 }),
            // Entity ID row
            go.GraphObject.make(go.TextBlock,
              {
                column: 0,
                row: 0,
                font: '11px sans-serif',
                stroke: '#aaaaaa',
                text: 'Entity ID:',
                margin: new go.Margin(0, 8, 4, 0)
              }
            ),
            go.GraphObject.make(go.TextBlock,
              {
                column: 1,
                row: 0,
                font: '11px sans-serif',
                stroke: '#ffffff',
                maxLines: 1,
                overflow: go.TextOverflow.Ellipsis,
                margin: new go.Margin(0, 0, 4, 0)
              },
              new go.Binding('text', 'key', (key) => key || 'N/A')
            ),
            // State row
            go.GraphObject.make(go.TextBlock,
              {
                column: 0,
                row: 1,
                font: '11px sans-serif',
                stroke: '#aaaaaa',
                text: 'State:',
                margin: new go.Margin(0, 8, 4, 0)
              }
            ),
            go.GraphObject.make(go.TextBlock,
              {
                column: 1,
                row: 1,
                font: 'bold 11px sans-serif',
                stroke: '#4CAF50',
                margin: new go.Margin(0, 0, 4, 0)
              },
              new go.Binding('text', 'state', (state) => state || 'unknown')
            ),
            // Category row
            go.GraphObject.make(go.TextBlock,
              {
                column: 0,
                row: 2,
                font: '11px sans-serif',
                stroke: '#aaaaaa',
                text: 'Category:',
                margin: new go.Margin(0, 8, 4, 0)
              }
            ),
            go.GraphObject.make(go.TextBlock,
              {
                column: 1,
                row: 2,
                font: '11px sans-serif',
                stroke: '#ffffff',
                margin: new go.Margin(0, 0, 4, 0)
              },
              new go.Binding('text', 'category', (cat) => cat || 'sensor')
            )
          ),
          // Divider before menu items
          go.GraphObject.make(go.Shape,
            {
              figure: 'Rectangle',
              height: 1,
              stroke: '#4a4a4a',
              margin: new go.Margin(4, 0, 4, 0)
            }
          ),
          // Menu items container (ready for future options)
          go.GraphObject.make(go.Panel, 'Vertical',
            {
              name: 'MENUITEMS',
              padding: new go.Margin(0, 0, 0, 0)
            },
            // Placeholder for future menu items like "Change Shape", "Delete", etc.
            // Example menu item structure (ready to be uncommented and customized):
            // go.GraphObject.make(go.Panel, 'Horizontal',
            //   {
            //     click: (e, obj) => {
            //       const node = obj.part.adornedPart;
            //       if (node) {
            //         // Example: Change shape category
            //         e.diagram.startTransaction('changeShape');
            //         e.diagram.model.setDataProperty(node.data, 'category', 'sensor');
            //         e.diagram.commitTransaction('changeShape');
            //       }
            //       e.diagram.clearSelection();
            //     },
            //     cursor: 'pointer',
            //     padding: new go.Margin(6, 12, 6, 12),
            //     background: 'rgba(255, 255, 255, 0)',
            //     mouseEnter: (e, obj) => {
            //       obj.background = 'rgba(255, 255, 255, 0.1)';
            //     },
            //     mouseLeave: (e, obj) => {
            //       obj.background = 'rgba(255, 255, 255, 0)';
            //     }
            //   },
            //   go.GraphObject.make(go.TextBlock,
            //     {
            //       font: '13px sans-serif',
            //       stroke: '#ffffff',
            //       text: 'Change Shape'
            //     }
            //   )
            // )
          )
        )
      )
    );

  // Define a reusable tooltip template for all nodes
  // This can be extended later for menu functionality
  const tooltipTemplate = 
    go.GraphObject.make(go.Adornment, 'Auto',
      {
        isShadowed: true,
        shadowColor: 'rgba(0, 0, 0, 0.5)',
        shadowBlur: 10,
        shadowOffset: new go.Point(0, 3)
      },
      go.GraphObject.make(go.Panel, 'Vertical',
        {
          background: '#2a2a2a'
        },
        go.GraphObject.make(go.TextBlock,
          {
            font: 'bold 14px sans-serif',
            stroke: '#ffffff',
            margin: new go.Margin(8, 10, 4, 10),
            textAlign: 'left',
            maxLines: 2,
            overflow: go.TextOverflow.Ellipsis,
            width: 250
          },
          new go.Binding('text', 'name')
        ),
        go.GraphObject.make(go.Shape,
          {
            figure: 'Rectangle',
            height: 1,
            width: 250,
            stroke: '#4a4a4a',
            margin: new go.Margin(0, 0, 4, 0)
          }
        ),
        go.GraphObject.make(go.Panel, 'Table',
          {
            defaultColumnSeparatorStroke: 'transparent',
            defaultRowSeparatorStroke: '#3a3a3a',
            defaultAlignment: go.Spot.Left,
            padding: new go.Margin(4, 10, 8, 10)
          },
          go.GraphObject.make(go.RowColumnDefinition, { column: 0, width: 100 }),
          go.GraphObject.make(go.RowColumnDefinition, { column: 1, width: 200 }),
          // Entity ID row
          go.GraphObject.make(go.TextBlock,
            {
              column: 0,
              row: 0,
              font: '11px sans-serif',
              stroke: '#aaaaaa',
              text: 'Entity ID:',
              margin: new go.Margin(0, 8, 4, 0)
            }
          ),
          go.GraphObject.make(go.TextBlock,
            {
              column: 1,
              row: 0,
              font: '11px sans-serif',
              stroke: '#ffffff',
              maxLines: 1,
              overflow: go.TextOverflow.Ellipsis,
              margin: new go.Margin(0, 0, 4, 0)
            },
            new go.Binding('text', 'key', (key) => key || 'N/A')
          ),
          // State row
          go.GraphObject.make(go.TextBlock,
            {
              column: 0,
              row: 1,
              font: '11px sans-serif',
              stroke: '#aaaaaa',
              text: 'State:',
              margin: new go.Margin(0, 8, 4, 0)
            }
          ),
          go.GraphObject.make(go.TextBlock,
            {
              column: 1,
              row: 1,
              font: 'bold 11px sans-serif',
              stroke: '#4CAF50',
              margin: new go.Margin(0, 0, 4, 0)
            },
            new go.Binding('text', 'state', (state) => state || 'unknown')
          ),
          // Category row
          go.GraphObject.make(go.TextBlock,
            {
              column: 0,
              row: 2,
              font: '11px sans-serif',
              stroke: '#aaaaaa',
              text: 'Category:',
              margin: new go.Margin(0, 8, 4, 0)
            }
          ),
          go.GraphObject.make(go.TextBlock,
            {
              column: 1,
              row: 2,
              font: '11px sans-serif',
              stroke: '#ffffff',
              margin: new go.Margin(0, 0, 4, 0)
            },
            new go.Binding('text', 'category', (cat) => cat || 'sensor')
          ),
          // Status row (if available, for cameras)
          go.GraphObject.make(go.TextBlock,
            {
              column: 0,
              row: 3,
              font: '11px sans-serif',
              stroke: '#aaaaaa',
              text: 'Status:',
              margin: new go.Margin(0, 8, 4, 0),
              visible: false
            },
            new go.Binding('visible', 'status', (status) => !!status)
          ),
          go.GraphObject.make(go.TextBlock,
            {
              column: 1,
              row: 3,
              font: '11px sans-serif',
              stroke: '#2196F3',
              margin: new go.Margin(0, 0, 4, 0),
              visible: false
            },
            new go.Binding('text', 'status', (status) => status || 'N/A'),
            new go.Binding('visible', 'status', (status) => !!status)
          )
        )
      )
    );

  // Helper function to create icon display
  function createIconDisplay() {
    return new go.Picture({
      name: 'ICON',
      source: '', // Empty string instead of null
      imageStretch: go.GraphObject.Uniform
    })
    .bind('source', 'icon', (iconName) => {
      if (!iconName) return '';
      const path = getMDIIconPath(iconName);
      if (!path) return '';
      return createIconSVG(path, '#ffffff', 24);
    })
    .bind('width', 'size', (size) => {
      if (!size) return 50;
      const nodeWidth = parseFloat(size.split(' ')[0]);
      return Math.max(24, nodeWidth * 0.6);
    })
    .bind('height', 'size', (size) => {
      if (!size) return 50;
      const nodeWidth = parseFloat(size.split(' ')[0]);
      return Math.max(24, nodeWidth * 0.6);
    })
    .bind('visible', 'source', (source) => source && source !== '');
  }

  // Template for sensors - shows name and value (resizable)
  diagram.nodeTemplateMap.add('sensor',
    new go.Node('Vertical', {
      resizable: true,
      selectable: true,
      minSize: new go.Size(60, 80),
      maxSize: new go.Size(1000, 1000),
      padding: new go.Margin(4, 4, 4, 4)
    }).set({ 
      toolTip: tooltipTemplate,
      selectionAdornmentTemplate: selectionAdornmentTemplate
    })
      .add(createIconDisplay())
  );

  // Template for doors - shows name and open/closed state (resizable)
  diagram.nodeTemplateMap.add('door',
    new go.Node('Vertical', {
      resizable: true,
      selectable: true,
      minSize: new go.Size(50, 50),
      maxSize: new go.Size(1000, 1000),
      padding: new go.Margin(4, 4, 4, 4)
    }).set({ 
      toolTip: tooltipTemplate,
      selectionAdornmentTemplate: selectionAdornmentTemplate
    })
      .add(createIconDisplay())
  );

  // Template for cameras - shows name and status (resizable)
  diagram.nodeTemplateMap.add('camera',
    new go.Node('Vertical', {
      resizable: true,
      selectable: true,
      minSize: new go.Size(50, 50),
      maxSize: new go.Size(1000, 1000),
      padding: new go.Margin(4, 4, 4, 4)
    }).set({ 
      toolTip: tooltipTemplate,
      selectionAdornmentTemplate: selectionAdornmentTemplate
    })
      .add(createIconDisplay())
  );

  // Default template (resizable)
  diagram.nodeTemplate =
    new go.Node('Vertical', {
      resizable: true,
      selectable: true,
      minSize: new go.Size(40, 40),
      maxSize: new go.Size(1000, 1000),
      padding: new go.Margin(4, 4, 4, 4)
    }).set({ 
      toolTip: tooltipTemplate,
      selectionAdornmentTemplate: selectionAdornmentTemplate
    })
      .add(createIconDisplay());
}

/**
 * Test connection to Home Assistant API
 */
async function testHAConnection(config) {
  const url = `${getApiBaseUrl(config)}/`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${config.accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Initialize the palette for drag-and-drop
 */
function initPalette() {
  const paletteDiv = document.getElementById('paletteDiv');
  if (!paletteDiv) {
    // Palette div doesn't exist yet (sidebar might be hidden)
    // We'll initialize it later when the sidebar becomes visible
    return;
  }
  
  // Check if palette already exists and clean it up
  if (palette) {
    palette.div = null;
  }
  
  palette = new go.Palette('paletteDiv');
  
  // Use the same node templates as the diagram
  definePaletteTemplates();
  
  // Set palette to use list layout for better organization (single column)
  palette.layout = new go.GridLayout({
    wrappingColumn: 1,
    cellSize: new go.Size(NaN, NaN), // Auto-size based on content
    spacing: new go.Size(0, 4) // Small vertical spacing between items
  });
  
  // Make sure palette allows dragging
  palette.allowDragOut = true;
  
  // Override the copy function to preserve entityId
  const originalCopyNodeData = go.Node.prototype.copyNodeData;
  go.Node.prototype.copyNodeData = function(data) {
    const copy = originalCopyNodeData.call(this, data);
    // Preserve entityId when copying from palette
    if (data.entityId) {
      copy.entityId = data.entityId;
    }
    return copy;
  };
}

/**
 * Define templates for palette (smaller versions)
 */
function definePaletteTemplates() {
  // Helper function to create horizontal template with icon on left, text on right
  const createHorizontalTemplate = (iconSize = 30) => {
    return new go.Node('Horizontal', {
      padding: new go.Margin(6, 6, 6, 6),
      minSize: new go.Size(250, 55),
      maxSize: new go.Size(NaN, NaN)
    })
      .add(
        // Icon on the left (MDI icon or fallback shape)
        new go.Panel('Auto').add(
          // Fallback shape (hidden if icon exists)
          new go.Shape('Circle', {
            name: 'FALLBACK_SHAPE',
            fill: '#4CAF50',
            stroke: '#2E7D32',
            strokeWidth: 2,
            width: iconSize,
            height: iconSize,
            visible: false
          })
          .bind('visible', 'icon', (icon) => !icon || !getMDIIconPath(icon)),
          // MDI Icon picture
          new go.Picture({
            name: 'PALETTE_ICON',
            source: '', // Empty string instead of null
            width: iconSize,
            height: iconSize,
            imageStretch: go.GraphObject.Uniform
          })
          .bind('source', 'icon', (iconName) => {
            if (!iconName) return '';
            const path = getMDIIconPath(iconName);
            if (!path) return '';
            return createIconSVG(path, '#ffffff', iconSize);
          })
          .bind('visible', 'source', (source) => source && source !== '')
        ).set({
          alignment: go.Spot.Center,
          margin: new go.Margin(0, 10, 0, 0)
        }),
        // Text content on the right
        new go.Panel('Vertical', {
          alignment: go.Spot.Left,
          defaultAlignment: go.Spot.Left
        })
          .add(
            // Name (larger, bold)
            new go.TextBlock({
              font: '13px sans-serif',
              stroke: '#ffffff',
              fontWeight: 'bold',
              textAlign: 'left',
              maxLines: 1,
              overflow: go.TextOverflow.Ellipsis,
              width: 180
            }).bind('text', 'name'),
            // Entity ID / Description (smaller, gray)
            new go.TextBlock({
              font: '10px sans-serif',
              stroke: '#aaaaaa',
              textAlign: 'left',
              maxLines: 1,
              overflow: go.TextOverflow.Ellipsis,
              width: 180
            }).bind('text', 'entityId', (id) => id || ''),
            // Current state/value (medium, colored)
            new go.TextBlock({
              font: '11px sans-serif',
              stroke: '#4CAF50',
              textAlign: 'left',
              maxLines: 1,
              overflow: go.TextOverflow.Ellipsis,
              width: 180
            }).bind('text', 'state', (val) => val ? `State: ${val}` : '')
          )
      );
  };
  
  // All palette templates use the same template with dynamic icons
  palette.nodeTemplateMap.add('sensor', createHorizontalTemplate());
  palette.nodeTemplateMap.add('door', createHorizontalTemplate());
  palette.nodeTemplateMap.add('camera', createHorizontalTemplate());
  
  // Default template
  palette.nodeTemplate = createHorizontalTemplate();
}

/**
 * Load all entities from Home Assistant and populate palette
 */
async function loadEntities(config) {
  try {
    const url = `${getApiBaseUrl(config)}/states`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch states: ${response.statusText}`);
    }

    const states = await response.json();
    
    // Filter entities and store for palette
    const paletteNodes = [];
    const excludedPatterns = [
      /^sensor\.date/,
      /^sensor\.time/,
      /^sensor\.uptime/,
      /^sensor\.ip_address/,
      /^sensor\.last_boot/,
      /^sensor\.hostname/,
    ];
    
    states.forEach((state) => {
      const entityId = state.entity_id;
      
      // Skip excluded sensors
      if (excludedPatterns.some(pattern => pattern.test(entityId))) {
        return;
      }
      
      // Extract domain (first part before dot)
      const domain = entityId.split('.')[0];
      
      // Determine category and domain mapping
      let category = null;
      let entityDomain = domain;
      
      // Map to visual categories
      if (entityId.startsWith('binary_sensor.door') || entityId.includes('door')) {
        category = 'door';
        entityDomain = 'binary_sensor';
      } else if (entityId.startsWith('camera.')) {
        category = 'camera';
        entityDomain = 'camera';
      } else if (entityId.startsWith('sensor.')) {
        category = 'sensor';
        entityDomain = 'sensor';
      } else if (entityId.startsWith('binary_sensor.')) {
        category = 'sensor'; // Use sensor template for binary sensors
        entityDomain = 'binary_sensor';
      } else if (entityId.startsWith('switch.')) {
        category = 'sensor'; // Use sensor template
        entityDomain = 'switch';
      } else if (entityId.startsWith('light.')) {
        category = 'sensor'; // Use sensor template
        entityDomain = 'light';
      } else if (entityId.startsWith('cover.')) {
        category = 'sensor'; // Use sensor template
        entityDomain = 'cover';
      } else if (entityId.startsWith('climate.')) {
        category = 'sensor'; // Use sensor template
        entityDomain = 'climate';
      } else if (entityId.startsWith('device_tracker.')) {
        category = 'sensor'; // Use sensor template
        entityDomain = 'device_tracker';
      }

      // Add all relevant entities (no filtering by category here - we'll filter when displaying)
      if (category) {
        const friendlyName = state.attributes.friendly_name || entityId.replace(/^[^.]+\./, '');
        
        // Store entity info for later use
        allEntities.push({
          entityId,
          category,
          domain: entityDomain,
          friendlyName,
          state: state
        });
        
        // Extract icon from HA or use default
        const iconName = extractIconFromHA(state) || 
                        getDefaultIcon(entityDomain, state.attributes.device_class);
        
        // Add to palette (with negative keys so they don't conflict)
        paletteNodes.push({
          key: -Math.abs(entityId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)),
          entityId: entityId, // Store actual entity ID
          category: category,
          domain: entityDomain, // Store domain for filtering
          name: friendlyName,
          state: state.state,
          status: state.attributes.status || null,
          icon: iconName, // Store MDI icon name
          deviceClass: state.attributes.device_class || null
        });
      }
    });

    // Store all entities for filtering
    window.allEntitiesForFiltering = paletteNodes;
    // Also expose allEntities globally for EntityInfoPanel
    window.allEntities = allEntities;
    
    // Filter and populate palette based on current filter
    filterAndUpdatePalette();
    
    addEvent(`Loaded ${paletteNodes.length} entities in palette`, 'info');

  } catch (error) {
    addEvent(`Error loading sensors: ${error.message}`, 'error');
    console.error('Error loading sensors:', error);
  }
}

/**
 * Filter entities by domain and search query, then update palette
 */
function filterAndUpdatePalette() {
  if (!window.allEntitiesForFiltering || !palette) return;
  
  let filteredNodes = [...window.allEntitiesForFiltering];
  
  // Filter by domain
  if (currentEntityFilter !== 'all') {
    filteredNodes = filteredNodes.filter(node => {
      return node.domain === currentEntityFilter;
    });
  }
  
  // Filter by search query (case-insensitive)
  if (currentSearchQuery && currentSearchQuery.trim()) {
    const query = currentSearchQuery.toLowerCase().trim();
    filteredNodes = filteredNodes.filter(node => {
      const name = (node.name || '').toLowerCase();
      const entityId = (node.entityId || '').toLowerCase();
      return name.includes(query) || entityId.includes(query);
    });
  }
  
  // Update palette with filtered nodes
  palette.model = new go.GraphLinksModel(filteredNodes, []);
}

/**
 * Load entities that were previously placed on the floor plan
 */
async function loadPlacedEntities(config) {
  isLoadingEntities = true; // Prevent saves during load
  
  const savedEntities = loadSavedEntities();
  const savedPositions = loadPositions();
  
  console.log('loadPlacedEntities: Found', savedEntities.length, 'saved entities');
  console.log('Saved entities:', savedEntities);
  
  if (savedEntities.length === 0) {
    addEvent('No saved entities found. Drag entities from the palette to add them.', 'info');
    isLoadingEntities = false;
    return;
  }
  
  // Fetch current states for placed entities
  try {
    const url = `${getApiBaseUrl(config)}/states`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      isLoadingEntities = false;
      return;
    }

    const states = await response.json();
    const stateMap = new Map(states.map(s => [s.entity_id, s]));
    
    // Create nodes for saved entities
    const nodes = [];
    savedEntities.forEach(entityId => {
      const state = stateMap.get(entityId);
      if (!state) {
        console.warn('State not found for entity:', entityId);
        return;
      }
      
      // Determine category and domain (must match logic in loadEntities)
      let category = null;
      let entityDomain = entityId.split('.')[0];
      
      if (entityId.startsWith('binary_sensor.door') || entityId.includes('door')) {
        category = 'door';
        entityDomain = 'binary_sensor';
      } else if (entityId.startsWith('camera.')) {
        category = 'camera';
        entityDomain = 'camera';
      } else if (entityId.startsWith('sensor.')) {
        category = 'sensor';
        entityDomain = 'sensor';
      } else if (entityId.startsWith('binary_sensor.')) {
        category = 'sensor'; // Use sensor template for binary sensors
        entityDomain = 'binary_sensor';
      } else if (entityId.startsWith('switch.')) {
        category = 'sensor'; // Use sensor template
        entityDomain = 'switch';
      } else if (entityId.startsWith('light.')) {
        category = 'sensor'; // Use sensor template
        entityDomain = 'light';
      } else if (entityId.startsWith('cover.')) {
        category = 'sensor'; // Use sensor template
        entityDomain = 'cover';
      } else if (entityId.startsWith('climate.')) {
        category = 'sensor'; // Use sensor template
        entityDomain = 'climate';
      } else if (entityId.startsWith('device_tracker.')) {
        category = 'sensor'; // Use sensor template
        entityDomain = 'device_tracker';
      }
      
      if (!category) {
        console.warn('No category for entity:', entityId);
        return;
      }
      
      const friendlyName = state.attributes.friendly_name || entityId.replace(/^[^.]+\./, '');
      
      // Extract icon from HA or use default
      const iconName = extractIconFromHA(state) || 
                      getDefaultIcon(entityDomain, state.attributes.device_class);
      
      // Get saved location and validate it
      let location = savedPositions[entityId] || '100 100';
      if (typeof location === 'string') {
        const [x, y] = location.split(' ').map(Number);
        // Validate the location - if it's NaN, use default
        if (isNaN(x) || isNaN(y)) {
          console.warn('Invalid saved position for', entityId, ':', location, '- using default');
          location = '100 100';
        }
      }
      
      // Get saved size if available
      const savedSizes = loadSizes();
      const savedSize = savedSizes[entityId] || null;
      
      // Get saved icon if available
      const savedIcons = loadIcons();
      const savedIcon = savedIcons[entityId];
      
      // Get saved actions if available
      let savedActionData = {};
      try {
        const savedActions = loadActions();
        savedActionData = savedActions[entityId] || {};
      } catch (error) {
        console.warn('Error loading actions for', entityId, ':', error);
        savedActionData = {};
      }
      
      const nodeData = {
        key: entityId,
        category: category,
        name: friendlyName,
        state: state.state,
        status: state.attributes.status || null,
        loc: location,
        size: savedSize, // Add saved size if available
        icon: savedIcon || iconName, // Use saved icon or HA icon
        deviceClass: state.attributes.device_class || null,
        tapAction: savedActionData.tapAction || null, // Load saved tap action
        holdAction: savedActionData.holdAction || null // Load saved hold action
      };
      
      nodes.push(nodeData);
    });
    
    console.log('Loading', nodes.length, 'entities onto diagram');
    if (nodes.length > 0) {
      console.log('First node sample:', JSON.stringify(nodes[0], null, 2));
    }
    
    // Update diagram with placed entities (this will trigger model changes, so we're already flagged)
    if (nodes.length > 0) {
      try {
        diagram.model = new go.GraphLinksModel(nodes, []);
        console.log('Diagram model updated with', nodes.length, 'nodes');
        console.log('Diagram now has', diagram.nodes.count, 'nodes visible');
        
        // Check if nodes are actually in the diagram
        const nodeCount = diagram.nodes.count;
        if (nodeCount === 0) {
          console.error('WARNING: Model set but no nodes visible in diagram!');
          console.log('Node data array length:', diagram.model.nodeDataArray.length);
        }
      } catch (error) {
        console.error('Error setting diagram model:', error);
        addEvent(`Error loading entities: ${error.message}`, 'error');
      }
    } else {
      console.warn('No nodes to add to diagram');
    }
    
    // After model is set, update node positions from saved locations
    // This ensures positions are correctly applied even if they were saved as strings
    setTimeout(() => {
      diagram.startTransaction('applyPositions');
      let positionsUpdated = false;
      
      // First, migrate any negative key positions to entityId keys
      const migratedPositions = { ...savedPositions };
      const negativeKeys = Object.keys(savedPositions).filter(k => k.toString().startsWith('-'));
      
      if (negativeKeys.length > 0) {
        // For each negative key, try to find matching entity
        negativeKeys.forEach(negKey => {
          let found = false;
          // Try to match by checking if there's an entity that doesn't have a position yet
          // and we have a negative key position
          diagram.nodes.each(node => {
            const nodeData = node.data;
            const entityId = nodeData.entityId || nodeData.key;
            
            // If this entity doesn't have a position yet, and we have a negative key position,
            // and this is the only node without a position, assign it
            if (!migratedPositions[entityId] && typeof entityId === 'string') {
              if (!found) {
                migratedPositions[entityId] = savedPositions[negKey];
                delete migratedPositions[negKey];
                found = true;
              }
            }
          });
        });
        
        // Save migrated positions
        localStorage.setItem(STORAGE_KEY_POSITIONS, JSON.stringify(migratedPositions));
      }
      
      // Also load saved sizes
      const savedSizes = loadSizes();
      
      diagram.nodes.each(node => {
        const key = node.data.key;
        let savedLoc = migratedPositions[key];
        
        if (savedLoc && typeof savedLoc === 'string') {
          const [x, y] = savedLoc.split(' ').map(Number);
          if (!isNaN(x) && !isNaN(y)) {
            node.location = new go.Point(x, y);
            // Also update the model data
            diagram.model.setDataProperty(node.data, 'loc', savedLoc);
            positionsUpdated = true;
          } else {
            console.warn('Invalid position for', key, ':', savedLoc);
          }
        } else {
          console.warn('No saved position found for', key, 'Available keys:', Object.keys(migratedPositions));
        }
        
        // Apply saved size if available
        const savedSize = savedSizes[key];
        if (savedSize && typeof savedSize === 'string') {
          const [width, height] = savedSize.split(' ').map(Number);
          if (!isNaN(width) && !isNaN(height)) {
            diagram.model.setDataProperty(node.data, 'size', savedSize);
            // Update the node size
            const shape = node.findObject('SHAPE');
            if (shape) {
              shape.width = width;
              shape.height = height;
            }
          }
        }
      });
      
      diagram.commitTransaction('applyPositions');
      
      console.log('After applying positions, diagram has', diagram.nodes.count, 'nodes');
      
      // Verify nodes are visible and positioned correctly
      let visibleCount = 0;
      diagram.nodes.each(node => {
        const bounds = node.actualBounds;
        console.log('Node:', node.data.key || node.data.name, 
                    'Location:', node.location.toString(), 
                    'Bounds:', bounds.toString(),
                    'Visible:', bounds.width > 0 && bounds.height > 0);
        if (bounds.width > 0 && bounds.height > 0) {
          visibleCount++;
        }
      });
      console.log('Visible nodes:', visibleCount, 'out of', diagram.nodes.count);
      
      // Save positions after fixing them (with proper entityId keys)
      // This ensures all positions use entityId keys, not negative keys
      if (positionsUpdated) {
        setTimeout(() => {
          savePositions();
        }, 200);
      }
    }, 200);
    
    addEvent(`Loaded ${nodes.length} placed entities`, 'success');
    
    // Note: isLoadingEntities will be set to false by the caller after this completes
    
  } catch (error) {
    console.error('Error loading placed entities:', error);
    isLoadingEntities = false;
  }
}

/**
 * Handle drag-and-drop from palette to diagram
 */
function setupDragDrop() {
  // Use CommandHandler to intercept copy operations from palette
  const cmdHandler = diagram.commandHandler;
  
  // Override copySelection to handle palette drops
  const originalCopySelection = cmdHandler.copySelection.bind(cmdHandler);
  cmdHandler.copySelection = function() {
    const result = originalCopySelection();
    
    // After copy, check if any nodes need entityId -> key conversion
    setTimeout(() => {
      diagram.nodes.each(node => {
        const nodeData = node.data;
        if (nodeData && nodeData.entityId && nodeData.key !== nodeData.entityId) {
          const entityId = nodeData.entityId;
          const entityInfo = allEntities.find(e => e.entityId === entityId);
          
          if (entityInfo) {
            // Check if this node already has the correct key (avoid duplicate processing)
            if (nodeData.key === entityId) {
              return; // Already processed
            }
            
            // Update with proper key and entity info
            diagram.startTransaction('fixPaletteNode');
            
            diagram.model.setDataProperty(nodeData, 'key', entityId);
            diagram.model.setDataProperty(nodeData, 'name', entityInfo.friendlyName);
            diagram.model.setDataProperty(nodeData, 'state', entityInfo.state.state);
            if (entityInfo.state.attributes.status) {
              diagram.model.setDataProperty(nodeData, 'status', entityInfo.state.attributes.status);
            }
            
            // Get location from the node
            const loc = node.location;
            diagram.model.setDataProperty(nodeData, 'loc', `${loc.x} ${loc.y}`);
            
            diagram.commitTransaction('fixPaletteNode');
            
            addEvent(`Added ${entityInfo.friendlyName}`, 'success');
            
            // Save after transaction
            setTimeout(() => {
              savePlacedEntities();
              savePositions();
            }, 50);
          }
        }
      });
    }, 100);
    
    return result;
  };
  
  // Also listen for external drops as backup
  diagram.addDiagramListener('ExternalObjectsDropped', (e) => {
    setTimeout(() => {
      diagram.nodes.each(node => {
        const nodeData = node.data;
        if (nodeData && nodeData.entityId) {
          const entityId = nodeData.entityId;
          if (nodeData.key !== entityId) {
            const entityInfo = allEntities.find(e => e.entityId === entityId);
            
            if (entityInfo) {
              // Remember the old key and position before updating
              const oldKey = nodeData.key;
              const loc = node.location;
              
              // Start a transaction to avoid "Change not within a transaction" error
              diagram.startTransaction('updateEntity');
              
              diagram.model.setDataProperty(nodeData, 'key', entityId);
              diagram.model.setDataProperty(nodeData, 'name', entityInfo.friendlyName);
              diagram.model.setDataProperty(nodeData, 'loc', `${loc.x} ${loc.y}`);
              
              // Set default size if not present
              if (!nodeData.size) {
                const defaultSize = node.location ? `${node.location.x} ${node.location.y}` : '40 40';
                // Actually, get the actual node size
                const actualSize = node.actualBounds.width + ' ' + node.actualBounds.height;
                diagram.model.setDataProperty(nodeData, 'size', actualSize);
              }
              
              diagram.commitTransaction('updateEntity');
              
              // Immediately save position with correct entityId key
              // This must happen BEFORE any other save calls, right after changing the key
              if (typeof oldKey === 'number' && oldKey < 0) {
                const existingPositions = loadPositions();
                // Save position with entityId (correct key), removing old negative key
                const oldKeyStr = oldKey.toString();
                if (existingPositions[oldKeyStr]) {
                  // Migrate existing position
                  existingPositions[entityId] = existingPositions[oldKeyStr];
                  delete existingPositions[oldKeyStr];
                } else {
                  // Save current location
                  existingPositions[entityId] = `${loc.x} ${loc.y}`;
                }
                // Also remove any other negative keys for this entityId
                Object.keys(existingPositions).forEach(key => {
                  if (key.startsWith('-') && existingPositions[key] === existingPositions[entityId]) {
                    delete existingPositions[key];
                  }
                });
                localStorage.setItem(STORAGE_KEY_POSITIONS, JSON.stringify(existingPositions));
              }
              
              // Save after transaction completes
              setTimeout(() => {
                savePlacedEntities();
                savePositions(); // This will now use the correct entityId keys
              }, 100);
            }
          }
        }
      });
    }, 100);
  });
}

/**
 * Update sensor states
 */
async function updateSensorStates(config) {
  try {
    const url = `${getApiBaseUrl(config)}/states`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) return;

    const states = await response.json();
    const model = diagram.model;

    // Update existing nodes with new states
    diagram.startTransaction('updateStates');
    states.forEach(state => {
      const nodeData = model.findNodeDataForKey(state.entity_id);
      if (nodeData) {
        // Update node appearance based on state
        model.setDataProperty(nodeData, 'state', state.state);
        if (state.attributes.status) {
          model.setDataProperty(nodeData, 'status', state.attributes.status);
        }
        model.setDataProperty(nodeData, 'lastUpdated', state.last_updated);
      }
    });
    diagram.commitTransaction('updateStates');

  } catch (error) {
    console.error('Error updating states:', error);
  }
}

/**
 * Add an event to the event log
 */
function addEvent(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  eventLog.unshift({ timestamp, message, type });
  
  // Keep only last 50 events
  if (eventLog.length > 50) {
    eventLog.pop();
  }

  // Update UI
  const eventLogDiv = document.getElementById('eventLog');
  if (eventLogDiv) {
    eventLogDiv.innerHTML = eventLog.map(event => `
      <div class="event-item" style="border-left: 3px solid ${
        event.type === 'error' ? '#f44336' :
        event.type === 'success' ? '#4CAF50' :
        event.type === 'warning' ? '#ff9800' : '#2196F3'
      }">
        <div class="event-time">${event.timestamp}</div>
        <div>${event.message}</div>
      </div>
    `).join('');
  }
}

/**
 * Load floor plan background automatically
 */
function loadFloorPlanBackground() {
  setBackgroundImage(FLOORPLAN_IMAGE, FLOORPLAN_WIDTH, FLOORPLAN_HEIGHT);
}

/**
 * Set background image in the diagram
 */
function setBackgroundImage(imageUrl, width, height) {
  // Remove existing background if any
  if (backgroundPart) {
    diagram.remove(backgroundPart);
  }

  // Create background part using a Picture node directly
  // We'll use a layer instead of adding to model
  let layer = diagram.findLayer('Background');
  if (!layer) {
    const gridLayer = diagram.findLayer('Grid');
    layer = new go.Layer('Background');
    diagram.addLayerBefore(layer, gridLayer || null);
  }

  // Create a simple background part
  backgroundPart = new go.Part({
    layerName: 'Background',
    pickable: false,
    selectable: false,
    isLayoutPositioned: false
  });

  const backgroundShape = new go.Picture();
  backgroundShape.source = imageUrl;
  backgroundShape.desiredSize = new go.Size(width, height);
  backgroundPart.add(backgroundShape);
  backgroundPart.position = new go.Point(0, 0);

  diagram.add(backgroundPart);

  // Set diagram bounds to match floor plan dimensions
  diagram.contentBounds = new go.Rect(0, 0, width, height);

  // Load saved scale or fit to viewport
  const savedScale = loadSavedScale();
  if (savedScale) {
    diagram.scale = savedScale;
    // Center the diagram
    diagram.centerRect(new go.Rect(0, 0, width, height));
  } else {
    // Set initial scale to fit viewport width
    setTimeout(() => fitDiagramToViewport(width, height), 100);
  }

  hasBackground = true;
  addEvent('Floor plan loaded', 'success');
}

/**
 * Fit diagram to viewport width (for tall images)
 */
function fitDiagramToViewport(width, height) {
  // Calculate scale to fit the viewport width
  const diagramDiv = document.getElementById('diagramDiv');
  if (!diagramDiv || !diagram) return;

  const viewportWidth = diagramDiv.clientWidth;
  const viewportHeight = diagramDiv.clientHeight;

  if (viewportWidth === 0 || viewportHeight === 0) {
    // Viewport not ready yet, try again
    setTimeout(() => fitDiagramToViewport(width, height), 100);
    return;
  }

  // Scale to fit width (since image is very tall)
  const scale = viewportWidth / width;
  
  // Don't scale up beyond 100%
  const finalScale = Math.min(scale, 1);

  diagram.scale = finalScale;
  
  // Center the diagram vertically and horizontally
  diagram.centerRect(new go.Rect(0, 0, width, height));
}

/**
 * Handle window resize to maintain aspect ratio
 */
function handleResize() {
  if (hasBackground) {
    fitDiagramToViewport(FLOORPLAN_WIDTH, FLOORPLAN_HEIGHT);
  }
}

// Listen for window resize
window.addEventListener('resize', handleResize);

/**
 * Save node sizes to localStorage
 */
function saveSizes() {
  if (!diagram || !diagram.model) return;

  const sizes = {};
  
  diagram.nodes.each(node => {
    const nodeData = node.data;
    const key = nodeData.entityId || nodeData.key;
    
    if (key && typeof key === 'string') {
      // Read from data.size first (most accurate), fallback to actualBounds
      const size = nodeData.size || (node.actualBounds.width + ' ' + node.actualBounds.height);
      sizes[key] = size;
    }
  });

  try {
    localStorage.setItem(STORAGE_KEY_SIZES, JSON.stringify(sizes));
  } catch (e) {
    console.error('Failed to save sizes:', e);
  }
}

/**
 * Load node sizes from localStorage
 */
function loadSizes() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_SIZES);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load sizes:', e);
  }
  return {};
}

/**
 * Save positions to localStorage
 */
function savePositions() {
  if (!diagram || !diagram.model) return;

  const positions = {};
  
  // Load existing positions to preserve old ones during key changes
  const existingPositions = loadPositions();
  
  // Get positions from actual node parts in the diagram (more reliable than model data)
  diagram.nodes.each(node => {
    const nodeData = node.data;
    
    // CRITICAL: Always prefer entityId over key when saving positions
    // This ensures positions are saved with entityId even if key hasn't been updated yet
    let entityId = null;
    
    // Priority 1: Use entityId if available (most reliable)
    if (nodeData.entityId && typeof nodeData.entityId === 'string') {
      entityId = nodeData.entityId;
    }
    // Priority 2: Use key if it's a string (should be entityId)
    else if (nodeData.key && typeof nodeData.key === 'string' && !nodeData.key.toString().startsWith('-')) {
      entityId = nodeData.key;
    }
    // Priority 3: If key is negative, try to find entityId elsewhere or skip
    else if (nodeData.key && typeof nodeData.key === 'number' && nodeData.key < 0) {
      console.warn('Node has negative key and no entityId - cannot save position:', nodeData);
      return; // Skip nodes with negative keys and no entityId
    }
    
    // Only save if we have a valid entityId
    if (entityId && typeof entityId === 'string') {
      const loc = node.location;
      // Only save valid positions (not NaN)
      if (loc && !isNaN(loc.x) && !isNaN(loc.y) && isFinite(loc.x) && isFinite(loc.y)) {
        positions[entityId] = `${loc.x} ${loc.y}`;
        
        // If key was negative, migrate any old position
        if (nodeData.key && typeof nodeData.key === 'number' && nodeData.key < 0) {
          const negKey = nodeData.key.toString();
          // Position migration handled silently
        }
      } else {
        console.warn('Skipping invalid position for', entityId, ':', loc);
      }
    }
  });

  // Merge with existing positions for entities not currently in the diagram
  // But skip negative keys - we'll migrate them below
  Object.keys(existingPositions).forEach(key => {
    if (!key.toString().startsWith('-') && !positions[key]) {
      // Keep positions for entities that aren't currently displayed
      positions[key] = existingPositions[key];
    }
  });
  
  // Clean up old negative keys (positions should now be migrated to entityIds)
  // But don't delete them yet - wait until after all nodes are processed
  const cleanedPositions = {};
  Object.keys(positions).forEach(key => {
    if (!key.toString().startsWith('-')) {
      cleanedPositions[key] = positions[key];
    }
  });

  try {
    localStorage.setItem(STORAGE_KEY_POSITIONS, JSON.stringify(cleanedPositions));
  } catch (e) {
    console.error('Failed to save positions:', e);
  }
}

/**
 * Save which entities are placed on the floor plan
 */
function savePlacedEntities() {
  // Don't save during initial load
  if (isLoadingEntities) {
    return;
  }
  
  if (!diagram || !diagram.model) {
    return;
  }

  const entitiesSet = new Set(); // Use Set to avoid duplicates
  
  diagram.model.nodeDataArray.forEach(nodeData => {
    // Use key (entity ID) - should already be set correctly
    const entityId = nodeData.key;
    if (entityId && typeof entityId === 'string' && !entityId.toString().startsWith('-')) {
      // Only save string keys (entity IDs), not negative numeric palette keys
      entitiesSet.add(entityId);
    }
  });

  const entities = Array.from(entitiesSet);
  
  // CRITICAL: Never save empty arrays - this would overwrite existing saved data!
  if (entities.length === 0) {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY_ENTITIES, JSON.stringify(entities));
  } catch (e) {
    console.error('Failed to save entities:', e);
  }
}

/**
 * Load saved entities from localStorage
 */
function loadSavedEntities() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_ENTITIES);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load saved entities:', e);
  }
  return [];
}

/**
 * Load icon preferences from localStorage
 */
function loadIcons() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_ICONS);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load icons:', e);
  }
  return {};
}

/**
 * Save icon preferences to localStorage
 */
function saveIcons() {
  if (isLoadingEntities || !diagram || !diagram.model) return;

  const icons = {};
  
  diagram.model.nodeDataArray.forEach(nodeData => {
    const entityId = nodeData.key;
    if (entityId && typeof entityId === 'string' && !entityId.toString().startsWith('-') && nodeData.icon) {
      icons[entityId] = nodeData.icon;
    }
  });

  try {
    localStorage.setItem(STORAGE_KEY_ICONS, JSON.stringify(icons));
  } catch (e) {
    console.error('Failed to save icons:', e);
  }
}

/**
 * Save tap and hold actions to localStorage
 */
function saveActions() {
  try {
    if (isLoadingEntities || !diagram || !diagram.model) return;
    
    const actions = {};
    diagram.nodes.each(node => {
      const data = node.data;
      if (data && data.key && typeof data.key === 'string' && !data.key.toString().startsWith('-')) {
        const entityId = data.key;
        if (data.tapAction || data.holdAction) {
          actions[entityId] = {
            tapAction: data.tapAction || null,
            holdAction: data.holdAction || null
          };
        }
      }
    });
    localStorage.setItem(STORAGE_KEY_ACTIONS, JSON.stringify(actions));
  } catch (error) {
    console.error('Error saving actions:', error);
  }
}

/**
 * Load tap and hold actions from localStorage
 */
function loadActions() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_ACTIONS);
    return saved ? JSON.parse(saved) : {};
  } catch (error) {
    console.error('Error loading actions:', error);
    return {};
  }
}

/**
 * Change the icon/shape of an entity
 * @param {string} entityId - The entity ID
 * @param {string} iconValue - The icon value (circle, rectangle, etc.)
 */
export function changeEntityIcon(entityId, iconValue) {
  if (!diagram || !entityId) return;
  
  const nodeData = diagram.model.findNodeDataForKey(entityId);
  if (!nodeData) return;
  
  // Validate icon exists in options
  const iconExists = ICON_OPTIONS.find(opt => opt.value === iconValue);
  if (!iconExists) return;
  
  diagram.startTransaction('changeIcon');
  diagram.model.setDataProperty(nodeData, 'icon', iconValue);
  diagram.commitTransaction('changeIcon');
  
  // Save icons to localStorage
  setTimeout(() => saveIcons(), 100);
}

/**
 * Save scale to localStorage
 */
function saveScale() {
  if (!diagram) return;
  
  try {
    localStorage.setItem(STORAGE_KEY_SCALE, JSON.stringify(diagram.scale));
  } catch (e) {
    console.error('Failed to save scale:', e);
  }
}

/**
 * Load saved scale from localStorage
 */
function loadSavedScale() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_SCALE);
    if (saved) {
      const scale = JSON.parse(saved);
      // Validate scale (between 0.1 and 5.0)
      if (scale && scale >= 0.1 && scale <= 5.0) {
        return scale;
      }
    }
  } catch (e) {
    console.error('Failed to load saved scale:', e);
  }
  return null;
}

/**
 * Load positions from localStorage
 */
function loadPositions() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_POSITIONS);
    if (saved) {
      const parsed = JSON.parse(saved);
      
      // Migrate any negative keys to entityIds if we can match them
      const cleaned = {};
      const negativeKeyPositions = {};
      
      Object.keys(parsed).forEach(key => {
        if (key.toString().startsWith('-')) {
          // Store negative key positions for potential migration
          negativeKeyPositions[key] = parsed[key];
        } else {
          cleaned[key] = parsed[key];
        }
      });
      
      // If we have negative keys, try to migrate them using the diagram nodes
      if (Object.keys(negativeKeyPositions).length > 0 && diagram && diagram.nodes.count > 0) {
        diagram.nodes.each(node => {
          const nodeData = node.data;
          const entityId = nodeData.entityId || nodeData.key;
          
          // If we find a node with a negative key but we know its entityId,
          // and we have a position saved with that negative key, migrate it
          if (typeof nodeData.key === 'number' && nodeData.key < 0 && nodeData.entityId) {
            const negKey = nodeData.key.toString();
            if (negativeKeyPositions[negKey] && !cleaned[nodeData.entityId]) {
              cleaned[nodeData.entityId] = negativeKeyPositions[negKey];
            }
          }
        });
        
        // Save the cleaned positions back
        if (Object.keys(negativeKeyPositions).length > 0) {
          localStorage.setItem(STORAGE_KEY_POSITIONS, JSON.stringify(cleaned));
        }
      }
      
      return cleaned;
    }
  } catch (e) {
    console.error('Failed to load positions:', e);
  }
  return {};
}


// Export for use in other modules
export { addEvent };

