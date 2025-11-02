/**
 * Type definitions for GoJS library
 * Since @types/gojs doesn't exist, we define minimal types here
 */

declare module 'gojs' {
  export = go;
}

declare namespace go {
  class Diagram {
    div: HTMLElement | null;
    model: Model;
    selection: Selection;
    scale: number;
    undoManager: UndoManager;
    toolManager: ToolManager;
    layout: Layout;
    allowDrop: boolean;
    maxSelectionCount: number;
    
    constructor(divIdOrDiv: string | HTMLElement, options?: Partial<DiagramOptions>);
    
    findNodeForData(data: any): Node | null;
    findObjectAt(point: Point, fn?: (obj: any) => boolean, part?: any): any;
    select(obj: Node | null): void;
    clearSelection(): void;
    addDiagramListener(eventName: string, listener: (e: any) => void): void;
    startTransaction(name?: string): void;
    commitTransaction(name?: string): void;
    rollbackTransaction(): void;
    transformViewToDoc(point: Point): Point;
    
    lastInput: InputEvent;
  }
  
  interface DiagramOptions {
    'undoManager.isEnabled'?: boolean;
    allowCopy?: boolean;
    allowDelete?: boolean;
    'toolManager.mouseWheelBehavior'?: number;
    'toolManager.showToolTip'?: boolean;
    layout?: Layout;
    maxSelectionCount?: number;
    'animationManager.isEnabled'?: boolean;
  }
  
  class Model {
    findNodeDataForKey(key: any): any;
    setDataProperty(data: any, property: string, value: any): void;
  }
  
  class GraphLinksModel extends Model {
    constructor(nodeDataArray?: any[], linkDataArray?: any[]);
  }
  
  class Selection {
    count: number;
    first(): Node | null;
  }
  
  class Node extends Part {
    data: any;
    div: HTMLElement | null;
  }
  
  class Part {
    data: any;
    actualBounds: Rect;
    findObject(name: string): any;
    invalidateLayout(): void;
  }
  
  class Palette extends Diagram {
    allowDragOut: boolean;
  }
  
  class Layout {
    doLayout(coll: any): void;
  }
  
  class UndoManager {
    isEnabled: boolean;
  }
  
  class ToolManager {
    clickSelectingTool: ClickSelectingTool;
    showToolTip: boolean;
    mouseWheelBehavior: number;
  }
  
  class ClickSelectingTool extends Tool {
    canStart: () => boolean;
    doMouseUp: () => void;
    standardMouseSelect: () => void;
  }
  
  class Tool {
    diagram: Diagram;
  }
  
  interface InputEvent {
    documentPoint: Point;
    targetPoint: Point;
  }
  
  class Point {
    x: number;
    y: number;
    constructor(x: number, y: number);
  }
  
  class Size {
    width: number;
    height: number;
    constructor(width: number, height: number);
  }
  
  class Rect {
    x: number;
    y: number;
    width: number;
    height: number;
    constructor(x: number, y: number, width: number, height: number);
  }
  
  class Margin {
    top: number;
    right: number;
    bottom: number;
    left: number;
    constructor(top: number, right?: number, bottom?: number, left?: number);
  }
  
  class GraphObject {
    static Fill: any;
    static Uniform: any;
    static Auto: any;
    static Center: Spot;
    static Spot: typeof Spot;
    static TextOverflow: typeof TextOverflow;
  }
  
  class Spot {
    static Center: Spot;
    static Top: Spot;
    static Bottom: Spot;
    static Left: Spot;
    static Right: Spot;
    static TopLeft: Spot;
    static TopRight: Spot;
    static BottomLeft: Spot;
    static BottomRight: Spot;
    x: number;
    y: number;
    offsetX: number;
    offsetY: number;
    constructor(x: number, y: number, offsetX?: number, offsetY?: number);
  }
  
  class TextOverflow {
    static Ellipsis: string;
    static Clip: string;
  }
  
  class Shape extends GraphObject {
    figure: string;
    fill: string;
    stroke: string;
    strokeWidth: number;
    width: number;
    height: number;
    stretch: any;
    visible: boolean;
  }
  
  class Picture extends GraphObject {
    source: string;
    imageStretch: any;
    width: number;
    height: number;
    visible: boolean;
    div: HTMLElement | null;
    name: string;
  }
  
  class TextBlock extends GraphObject {
    text: string;
    font: string;
    stroke: string;
    textAlign: string;
    maxLines: number;
    overflow: string;
    wrap: any;
    width: number;
    visible: boolean;
  }
  
  class Panel extends GraphObject {
    type: string;
    padding: Margin;
    minSize: Size;
    maxSize: Size;
    defaultAlignment: Spot;
    defaultStretch: any;
  }
  
  class Adornment extends Part {
    adornedPart: Part;
    locationSpot: Spot;
    locationAdornmentSpot: Spot;
    isShadowed: boolean;
    shadowColor: string;
    shadowBlur: number;
    shadowOffset: Point;
  }
  
  class Binding {
    constructor(targetProp: string, sourceProp: string, converter?: (value: any, obj: any) => any);
  }
  
  class GraphObject {
    bind(prop: string, sourceProp: string, converter?: (value: any, obj: any) => any): this;
    bind(binding: Binding): this;
    set(props: Partial<this>): this;
    add(...objects: GraphObject[]): this;
  }
  
  namespace GraphObject {
    function make(constructor: any, ...args: any[]): any;
  }
  
  class ToolManager {
    static WheelZoom: number;
  }
  
  class TextBlock {
    static WrapFit: any;
  }
  
  const GraphObject: any;
  const Spot: typeof Spot;
}

