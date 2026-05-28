'use client';

import React, {
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from 'react';

export type Tool =
  | 'select'
  | 'pan'
  | 'pencil'
  | 'rect'
  | 'ellipse'
  | 'triangle'
  | 'diamond'
  | 'line'
  | 'arrow'
  | 'text'
  | 'sticker'
  | 'eraser'
  | 'image';

export interface SelectionInfo {
  bounds: { x: number; y: number; w: number; h: number };
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  fontSize: number;
  objectType: string;
  isMulti: boolean;
  isSticker: boolean;
}


export interface RemoteChange {
  objectId: string;
  data?: any;
  deleted?: boolean;
  updated_by?: number | null;
}

export interface CanvasRef {
  undo(): void;
  redo(): void;
  zoomIn(): void;
  zoomOut(): void;
  fitToScreen(): void;
  exportPNG(): void;
  getThumbnail(): string;
  clear(): void;
  deleteSelected(): void;
  getState(): string;
  loadState(state: string): void;
  addImage(dataUrl: string): void;
  applyToSelection(props: { stroke?: string; fill?: string; strokeWidth?: number; fontSize?: number }): void;
  /** True while the user is actively drawing/panning/dragging/editing or has a multi-selection. */
  isBusy(): boolean;
  /** Per-object snapshot (keyed by stable id) + canvas-level meta, for diffing.
   *  `held` lists ids being edited right now: excluded from the push but must NOT
   *  be treated as deletions. Returns null while a gesture makes coords unstable. */
  getSyncState(): { objects: Record<string, any>; meta: any; held: string[] } | null;
  /** Merge peer object changes in place. Returns the ids it resolved (applied/already-current/already-gone). */
  applyRemoteChanges(changes: RemoteChange[]): Promise<{ applied: string[] }>;
}

export interface CanvasProps {
  tool: Tool;
  readOnly?: boolean;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  fontSize: number;
  bgStyle: 'none' | 'grid' | 'dots';
  initialState?: string | null;
  onHistoryChange(canUndo: boolean, canRedo: boolean): void;
  onZoomChange(zoom: number): void;
  onSelectionChange(active: boolean, info?: SelectionInfo): void;
  /** Fired once after the initial canvas state has been loaded. */
  onReady?(): void;
  /** Fired on every committed local mutation (for debounced sync). */
  onChange?(): void;
}

/** Stable id for an object, used to merge changes across collaborators. */
function genId(): string {
  const c = (globalThis as any).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

const CURSORS: Record<string, string> = {
  select: 'default',
  pan: 'grab',
  pencil: 'crosshair',
  rect: 'crosshair',
  ellipse: 'crosshair',
  triangle: 'crosshair',
  diamond: 'crosshair',
  line: 'crosshair',
  arrow: 'crosshair',
  text: 'text',
  sticker: 'crosshair',
  eraser: 'cell',
  image: 'crosshair',
};

const STICKER_SIZE = 200;
const STICKER_PAD = 14;
const STICKER_COLOR = '#FFF176';
const STICKER_FONT_SIZE = 18;
const STICKER_MIN_FONT = 6;
const STICKER_TEXT_COLOR = '#1a1a2e';

// Miro-like sticker palette. Used by PropertiesPanel and as the
// allow-list when deciding whether the current fillColor is a
// valid sticker color (otherwise falls back to STICKER_COLOR).
export const STICKER_COLORS = [
  '#FFF176', // yellow
  '#FFD180', // orange
  '#FF8A80', // pink/red
  '#F48FB1', // pink
  '#CE93D8', // purple
  '#80D8FF', // light blue
  '#A7FFEB', // mint
  '#CCFF90', // light green
];

const Canvas = forwardRef<CanvasRef, CanvasProps>(function Canvas(props, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fc = useRef<any>(null);
  const fm = useRef<any>(null);

  // Always-current props via ref (avoids stale closures in event handlers)
  const pRef = useRef(props);
  useEffect(() => {
    pRef.current = props;
  });

  // History
  const history = useRef<string[]>([]);
  const hIdx = useRef(-1);

  // Drawing state
  const drawing = useRef(false);
  const startPt = useRef({ x: 0, y: 0 });
  const drawObj = useRef<any>(null);

  // Pan state (tool-based)
  const panning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });

  // Middle-mouse pan state (works with any tool)
  const midPanning = useRef(false);
  const midPanStart = useRef({ x: 0, y: 0 });

  // True while an object is being moved/scaled/rotated (used to defer remote
  // merges and toolbar repositioning so we never yank an object mid-drag).
  const draggingRef = useRef(false);

  // Id of the sticker group currently being text-edited. While editing, the
  // group is decomposed into transient pieces; we "hold" this id so the sync
  // layer doesn't push the half-baked state or mistake the absence for a delete.
  const editingStickerId = useRef<string | null>(null);


  // Background handler ref (for cleanup on style change)
  const bgHandlerRef = useRef<(() => void) | null>(null);

  // ─── History helpers ───────────────────────────────────────────
  const pushHistory = useCallback(() => {
    const c = fc.current;
    if (!c) return;
    const snap = JSON.stringify(c.toObject(['data']));
    history.current = history.current.slice(0, hIdx.current + 1);
    history.current.push(snap);
    if (history.current.length > 60) history.current.shift();
    hIdx.current = history.current.length - 1;
    pRef.current.onHistoryChange(hIdx.current > 0, false);
    pRef.current.onChange?.();
  }, []);

  // ─── Apply tool to canvas ──────────────────────────────────────
  const applyTool = useCallback((canvas: any, tool: Tool) => {
    if (!canvas) return;
    canvas.isDrawingMode = tool === 'pencil';
    canvas.selection = tool === 'select';
    if (!drawing.current) {
      canvas.forEachObject((o: any) => {
        o.selectable = tool === 'select';
        o.evented = tool === 'select' || tool === 'eraser';
      });
    }
    if (tool === 'pencil' && canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.color = pRef.current.strokeColor;
      canvas.freeDrawingBrush.width = pRef.current.strokeWidth;
    }
    canvas.defaultCursor = CURSORS[tool] ?? 'default';
    canvas.hoverCursor = tool === 'select' ? 'move' : (CURSORS[tool] ?? 'default');
  }, []);

  // ─── Background (grid / dots / plain) via CSS on container ────
  // CSS approach is reliable regardless of DPR / canvas resize timing.
  // The Fabric canvas is made transparent; the container div carries the bg.
  const applyBackground = useCallback((canvas: any, bgStyle: string) => {
    const container = containerRef.current;
    if (!canvas || !container) return;

    // Detach previous after:render sync handler
    if (bgHandlerRef.current) {
      canvas.off('after:render', bgHandlerRef.current);
      bgHandlerRef.current = null;
    }
    // No internal Fabric background – canvas pixels are transparent
    canvas.backgroundColor = '';

    if (bgStyle === 'none') {
      container.style.backgroundImage = 'none';
      container.style.backgroundColor = '#fafafa';
      canvas.requestRenderAll();
      return;
    }

    // Viewport snapshot (sentinel -999 ensures first sync always runs)
    let lastZoom = -999;
    let lastOx   = -999;
    let lastOy   = -999;

    const sync = () => {
      if (!canvas.viewportTransform) return;
      const [zoom, , , , ox, oy] = canvas.viewportTransform as number[];

      // Round to 1 decimal for pan, 4 sig-figs for zoom —
      // changes smaller than this are invisible and must NOT update CSS.
      const rz = Math.round(zoom * 1000) / 1000;
      const rx = Math.round(ox * 10) / 10;
      const ry = Math.round(oy * 10) / 10;

      // Skip entirely when viewport hasn't meaningfully changed.
      // This covers: object move, selection, text editing, etc.
      if (rz === lastZoom && rx === lastOx && ry === lastOy) return;
      lastZoom = rz; lastOx = rx; lastOy = ry;

      if (bgStyle === 'grid') {
        // Clamp so grid never gets denser than 24px (prevents visual noise on zoom-out)
        const base = 40 * zoom;
        const size = base < 24 ? Math.ceil(24 / base) * base : base;
        const bx = ((ox % size) + size) % size;
        const by = ((oy % size) + size) % size;
        container.style.backgroundImage =
          'linear-gradient(to right, #c8d0dc 1px, transparent 1px),' +
          'linear-gradient(to bottom, #c8d0dc 1px, transparent 1px)';
        container.style.backgroundSize = `${size}px ${size}px`;
        container.style.backgroundPosition = `${bx}px ${by}px`;
      } else {
        // Clamp so dots never get denser than 24px (prevents visual noise on zoom-out)
        const base = 28 * zoom;
        const size = base < 24 ? Math.ceil(24 / base) * base : base;
        const bx = ((ox % size) + size) % size;
        const by = ((oy % size) + size) % size;
        container.style.backgroundImage =
          'radial-gradient(circle, #9aa5b4 1.4px, transparent 1.4px)';
        container.style.backgroundSize = `${size}px ${size}px`;
        container.style.backgroundPosition = `${bx}px ${by}px`;
      }
    };

    bgHandlerRef.current = sync;
    canvas.on('after:render', sync);
    sync();               // paint immediately without waiting for next render
    canvas.requestRenderAll();
  }, []);

  useEffect(() => {
    if (fc.current) applyBackground(fc.current, props.bgStyle);
  }, [props.bgStyle, applyBackground]);

  // ─── Sync pencil brush when props change ──────────────────────
  useEffect(() => {
    const c = fc.current;
    if (!c || props.tool !== 'pencil') return;
    if (c.freeDrawingBrush) {
      c.freeDrawingBrush.color = props.strokeColor;
      c.freeDrawingBrush.width = props.strokeWidth;
    }
  }, [props.strokeColor, props.strokeWidth, props.tool]);

  // ─── Sync tool mode ───────────────────────────────────────────
  useEffect(() => {
    if (fc.current && fm.current) {
      const c = fc.current;
      applyTool(c, props.tool);
      if (props.tool === 'pencil' && !c.freeDrawingBrush) {
        c.freeDrawingBrush = new fm.current.PencilBrush(c);
        c.freeDrawingBrush.color = props.strokeColor;
        c.freeDrawingBrush.width = props.strokeWidth;
      }
      c.requestRenderAll();
    }
  }, [props.tool, applyTool, props.strokeColor, props.strokeWidth]);

  // ─── Read-only mode ───────────────────────────────────────────
  useEffect(() => {
    const c = fc.current;
    if (!c) return;
    if (props.readOnly) {
      c.isDrawingMode = false;
      c.selection = false;
      c.skipTargetFind = true;
      c.defaultCursor = 'default';
      c.hoverCursor = 'default';
    } else {
      c.skipTargetFind = false;
      c.defaultCursor = 'default';
      c.hoverCursor = 'move';
      applyTool(c, pRef.current.tool);
    }
    c.requestRenderAll();
  }, [props.readOnly, applyTool]);

  // ─── Initialize Fabric.js canvas (runs once) ─────────────────
  useEffect(() => {
    if (!canvasElRef.current || !containerRef.current) return;
    let canvas: any;
    let resizeObs: ResizeObserver;
    let aborted = false; // guards against HMR / StrictMode double-invoke

    // Middle-mouse listener refs (stored here so cleanup can remove them)
    let onMidDown: ((e: MouseEvent) => void) | null = null;
    let onMidMove: ((e: MouseEvent) => void) | null = null;
    let onMidUp: ((e: MouseEvent) => void) | null = null;
    let onAuxClick: ((e: MouseEvent) => void) | null = null;


    import('fabric').then(async (fab) => {
      if (aborted) return; // cleanup already ran before promise resolved

      fm.current = fab;
      const container = containerRef.current!;

      // Dispose any leftover Fabric instance on this element (HMR safety)
      if (fc.current) {
        try { fc.current.dispose(); } catch (_) {}
        fc.current = null;
      }

      canvas = new fab.Canvas(canvasElRef.current!, {
        width: container.clientWidth,
        height: container.clientHeight,
        preserveObjectStacking: true,
        stopContextMenu: true,
        fireRightClick: true,
      });

      canvas.freeDrawingBrush = new fab.PencilBrush(canvas);
      canvas.freeDrawingBrush.color = pRef.current.strokeColor;
      canvas.freeDrawingBrush.width = pRef.current.strokeWidth;

      fc.current = canvas;
      applyTool(canvas, pRef.current.tool);
      applyBackground(canvas, pRef.current.bgStyle);

      // Load initial state
      const initState = pRef.current.initialState;
      if (initState) {
        try {
          await canvas.loadFromJSON(JSON.parse(initState));
          canvas.renderAll();
          applyTool(canvas, pRef.current.tool);
        } catch (e) {
          console.warn('Failed to load initial canvas state:', e);
        }
      }

      history.current = [JSON.stringify(canvas.toObject(['data']))];
      hIdx.current = 0;
      pRef.current.onReady?.();

      // ── Sticker helpers ─────────────────────────────────────
      // A sticker is a Group(Rect + Textbox). To edit the inner
      // textbox we ungroup via fabric's removeAll() (which bakes
      // the group's transform into the children's world coords),
      // then re-group on editing exit. Resize is handled by
      // `normalizeSticker`, which absorbs the group's scale into
      // the children's unscaled dimensions — otherwise the text
      // gets stretched and wraps at the original width.

      // Shrink fontSize so text fits inside the rect in both
      // dimensions. Width/height are unscaled; scale cancels
      // because rect and textbox share the group's transform.
      const fitStickerText = (rect: any, textbox: any) => {
        const targetH = (rect.height || STICKER_SIZE) - STICKER_PAD * 2;
        const targetW = (rect.width || STICKER_SIZE) - STICKER_PAD * 2;
        // Defensive: fabric silently expands `width` to fit a
        // single wide "word" via dynamicMinWidth.
        textbox.set('width', targetW);
        let fs = STICKER_FONT_SIZE;
        textbox.set('fontSize', fs);
        textbox.initDimensions?.();

        const overflows = (): boolean => {
          if (textbox.calcTextHeight() > targetH) return true;
          const lines = (textbox as any)._textLines || [];
          for (let i = 0; i < lines.length; i++) {
            if (textbox.getLineWidth(i) > targetW) return true;
          }
          return false;
        };

        while (overflows() && fs > STICKER_MIN_FONT) {
          fs -= 1;
          textbox.set('fontSize', fs);
          textbox.initDimensions?.();
        }
        textbox.setCoords();
      };

      // After user resize, bake group's scaleX/scaleY into the
      // rect's width/height and reset scale to 1, so the text
      // stops being stretched and re-wraps at the new width.
      const normalizeSticker = (sticker: any) => {
        if (!sticker || !sticker.data?.isSticker) return false;
        if ((sticker.scaleX ?? 1) === 1 && (sticker.scaleY ?? 1) === 1) return false;

        const stickerId = sticker.data?.id;
        const items: any[] = sticker.removeAll();
        canvas.remove(sticker);

        const rect = items.find((o: any) => o.type === 'rect');
        const textbox = items.find((o: any) => o.type === 'textbox');
        if (!rect || !textbox) {
          items.forEach((o) => canvas.add(o));
          return false;
        }

        const newW = (rect.width || STICKER_SIZE) * (rect.scaleX || 1);
        const newH = (rect.height || STICKER_SIZE) * (rect.scaleY || 1);
        const rectLeft = rect.left;
        const rectTop = rect.top;

        rect.set({
          left: rectLeft,
          top: rectTop,
          width: newW,
          height: newH,
          scaleX: 1,
          scaleY: 1,
        });
        rect.setCoords();

        textbox.set({
          left: rectLeft + STICKER_PAD,
          top: rectTop + STICKER_PAD,
          width: newW - STICKER_PAD * 2,
          scaleX: 1,
          scaleY: 1,
        });
        fitStickerText(rect, textbox);

        const newGroup = new fab.Group([rect, textbox], {
          selectable: true,
          evented: true,
          subTargetCheck: false,
        });
        (newGroup as any).data = { isSticker: true, id: stickerId };
        canvas.add(newGroup);
        canvas.setActiveObject(newGroup);
        canvas.requestRenderAll();
        return true;
      };

      const enterStickerEdit = (sticker: any) => {
        if (!sticker || !sticker.data?.isSticker) return;

        const stickerId = sticker.data?.id;
        const items: any[] = sticker.removeAll();
        canvas.remove(sticker);

        const rect = items.find((o: any) => o.type === 'rect');
        const textbox = items.find((o: any) => o.type === 'textbox');
        if (!rect || !textbox) return;

        rect.set({ selectable: false, evented: false });
        textbox.set({ selectable: true, evented: true });
        rect.setCoords();
        textbox.setCoords();

        // While editing, these are transient pieces — keep them out of sync and
        // hold the group's id so peers don't see the sticker vanish/flicker.
        rect.excludeFromSync = true;
        textbox.excludeFromSync = true;
        editingStickerId.current = stickerId ?? null;

        const onChange = () => fitStickerText(rect, textbox);
        fitStickerText(rect, textbox);

        canvas.add(rect);
        canvas.add(textbox);
        canvas.setActiveObject(textbox);
        textbox.enterEditing();
        textbox.selectAll?.();
        textbox.on('changed', onChange);

        const onExit = () => {
          textbox.off('changed', onChange);
          textbox.off('editing:exited', onExit);
          fitStickerText(rect, textbox);

          canvas.remove(rect);
          canvas.remove(textbox);

          // Editing done: clear the transient markers and re-group.
          delete rect.excludeFromSync;
          delete textbox.excludeFromSync;
          editingStickerId.current = null;

          rect.set({ selectable: true, evented: true });
          const newGroup = new fab.Group([rect, textbox], {
            selectable: pRef.current.tool === 'select',
            evented: pRef.current.tool === 'select' || pRef.current.tool === 'eraser',
            subTargetCheck: false,
          });
          (newGroup as any).data = { isSticker: true, id: stickerId };
          canvas.add(newGroup);
          if (pRef.current.tool === 'select') {
            canvas.setActiveObject(newGroup);
          }
          canvas.requestRenderAll();
          pushHistory();
        };
        textbox.on('editing:exited', onExit);
        canvas.requestRenderAll();
      };

      // Normalize sticker after resize — must run BEFORE the
      // generic pushHistory handler so the snapshot records the
      // post-normalization state, not the stretched intermediate.
      canvas.on('object:modified', (opt: any) => {
        const t = opt.target;
        if (t?.data?.isSticker) normalizeSticker(t);
      });

      // Double-click on a sticker → enter text edit mode
      canvas.on('mouse:dblclick', (opt: any) => {
        const target = opt.target;
        if (target && target.data?.isSticker && !drawing.current) {
          enterStickerEdit(target);
        }
      });

      // ── Zoom on wheel ───────────────────────────────────────
      canvas.on('mouse:wheel', (opt: any) => {
        const delta = opt.e.deltaY;
        let zoom = canvas.getZoom();
        zoom *= 0.999 ** delta;
        zoom = Math.min(Math.max(zoom, 0.05), 20);
        canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
        opt.e.preventDefault();
        opt.e.stopPropagation();
        pRef.current.onZoomChange(Math.round(zoom * 100));
      });

      // ── Mouse down ─────────────────────────────────────────
      canvas.on('mouse:down', (opt: any) => {
        const tool = pRef.current.tool;
        const pointer = canvas.getPointer(opt.e);

        if (tool === 'pan') {
          panning.current = true;
          panStart.current = { x: opt.e.clientX, y: opt.e.clientY };
          canvas.defaultCursor = 'grabbing';
          return;
        }
        if (tool === 'select' || tool === 'pencil') return;
        if (tool === 'eraser') { drawing.current = true; return; }

        if (tool === 'text') {
          const txt = new fab.IText('', {
            left: pointer.x,
            top: pointer.y,
            fontSize: pRef.current.fontSize,
            fill: pRef.current.strokeColor,
            fontFamily: 'Arial, sans-serif',
            selectable: true,
            evented: true,
          });
          canvas.add(txt);
          canvas.setActiveObject(txt);
          txt.enterEditing();
          txt.on('editing:exited', () => { if (txt.text === '') canvas.remove(txt); pushHistory(); });
          return;
        }

        if (tool === 'sticker') {
          const stickerColor =
            pRef.current.fillColor && pRef.current.fillColor.startsWith('#')
              ? pRef.current.fillColor
              : STICKER_COLOR;
          // Top-left origin in world coords; sticker is centered on click point.
          const sx = pointer.x - STICKER_SIZE / 2;
          const sy = pointer.y - STICKER_SIZE / 2;
          const rect = new fab.Rect({
            left: sx,
            top: sy,
            width: STICKER_SIZE,
            height: STICKER_SIZE,
            fill: stickerColor,
            stroke: 'transparent',
            strokeWidth: 0,
            rx: 2, ry: 2,
            shadow: new fab.Shadow({
              color: 'rgba(0,0,0,0.18)',
              blur: 10,
              offsetX: 0,
              offsetY: 3,
            }),
          });
          const textbox = new fab.Textbox('', {
            left: sx + STICKER_PAD,
            top: sy + STICKER_PAD,
            width: STICKER_SIZE - STICKER_PAD * 2,
            fontSize: STICKER_FONT_SIZE,
            fontFamily: 'Arial, sans-serif',
            fill: STICKER_TEXT_COLOR,
            textAlign: 'center',
            // Wrap by grapheme so long unbroken strings stay
            // inside the sticker; otherwise fabric would expand
            // the textbox width to fit a single long "word".
            splitByGrapheme: true,
            dynamicMinWidth: 0,
            lockScalingFlip: true,
          });
          const sticker = new fab.Group([rect, textbox], {
            selectable: true,
            evented: true,
            subTargetCheck: false,
          });
          (sticker as any).data = { isSticker: true };
          canvas.add(sticker);
          canvas.setActiveObject(sticker);
          canvas.requestRenderAll();
          pushHistory();
          setTimeout(() => enterStickerEdit(sticker), 0);
          return;
        }

        // ── Shape drawing ───────────────────────────────────
        drawing.current = true;
        startPt.current = { x: pointer.x, y: pointer.y };

        const stroke = pRef.current.strokeColor;
        const fill = pRef.current.fillColor;
        const sw = pRef.current.strokeWidth;
        const base = {
          stroke,
          strokeWidth: sw,
          strokeUniform: true,   // keep stroke width constant when scaling
          fill: fill === 'transparent' ? 'transparent' : fill,
          selectable: false,
          evented: false,
          originX: 'left' as const,
          originY: 'top' as const,
        };

        let obj: any;
        const px = pointer.x, py = pointer.y;

        switch (tool) {
          case 'rect':
            obj = new fab.Rect({ ...base, left: px, top: py, width: 1, height: 1 });
            break;
          case 'ellipse':
            obj = new fab.Ellipse({ ...base, left: px, top: py, rx: 1, ry: 1 });
            break;
          case 'triangle':
            obj = new fab.Triangle({ ...base, left: px, top: py, width: 1, height: 1 });
            break;
          case 'diamond':
            obj = new fab.Rect({
              ...base,
              left: px, top: py, width: 1, height: 1, angle: 45,
              originX: 'center', originY: 'center',
            });
            break;
          case 'line':
            obj = new fab.Line([px, py, px, py], {
              stroke, strokeWidth: sw, selectable: false, evented: false,
            });
            break;
          case 'arrow':
            obj = new fab.Line([px, py, px, py], {
              stroke, strokeWidth: sw, selectable: false, evented: false,
              data: { isArrowTemp: true },
            });
            break;
        }
        if (obj) { canvas.add(obj); drawObj.current = obj; }
      });

      // ── Mouse move ──────────────────────────────────────────
      canvas.on('mouse:move', (opt: any) => {
        const tool = pRef.current.tool;

        if (tool === 'pan' && panning.current) {
          const vpt = canvas.viewportTransform as number[];
          vpt[4] += opt.e.clientX - panStart.current.x;
          vpt[5] += opt.e.clientY - panStart.current.y;
          panStart.current = { x: opt.e.clientX, y: opt.e.clientY };
          canvas.requestRenderAll();
          return;
        }

        if (tool === 'eraser' && (drawing.current || opt.e.buttons === 1)) {
          const pointer = canvas.getPointer(opt.e);
          const removed: any[] = [];
          canvas.getObjects().forEach((o: any) => {
            if (o.containsPoint(pointer)) removed.push(o);
          });
          removed.forEach((o) => canvas.remove(o));
          if (removed.length) { canvas.requestRenderAll(); }
          return;
        }

        if (!drawing.current || !drawObj.current) return;
        const pointer = canvas.getPointer(opt.e);
        const { x: sx, y: sy } = startPt.current;
        const obj = drawObj.current;
        const dw = pointer.x - sx, dh = pointer.y - sy;
        const aw = Math.max(Math.abs(dw), 1), ah = Math.max(Math.abs(dh), 1);
        const left = dw >= 0 ? sx : pointer.x, top = dh >= 0 ? sy : pointer.y;

        switch (tool) {
          case 'rect':
          case 'triangle':
            obj.set({ left, top, width: aw, height: ah }); break;
          case 'diamond':
            obj.set({ left: sx, top: sy, width: aw, height: ah }); break;
          case 'ellipse':
            obj.set({ left, top, rx: aw / 2, ry: ah / 2 }); break;
          case 'line':
          case 'arrow':
            obj.set({ x2: pointer.x, y2: pointer.y }); break;
        }
        obj.setCoords();
        canvas.requestRenderAll();
      });

      // ── Mouse up ────────────────────────────────────────────
      canvas.on('mouse:up', () => {
        const tool = pRef.current.tool;

        if (tool === 'pan') {
          panning.current = false;
          canvas.defaultCursor = 'grab';
          return;
        }
        if (tool === 'eraser') {
          drawing.current = false;
          pushHistory();
          return;
        }
        if (!drawing.current) return;
        drawing.current = false;

        const obj = drawObj.current;
        drawObj.current = null;
        if (!obj) return;

        if (tool === 'arrow') {
          canvas.remove(obj);
          const x1 = obj.x1, y1 = obj.y1, x2 = obj.x2, y2 = obj.y2;
          const lineLen = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
          if (lineLen < 5) return; // too short
          const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI) + 90;
          const hs = Math.max(14, pRef.current.strokeWidth * 5);
          const arrowLine = new fab.Line([x1, y1, x2, y2], {
            stroke: pRef.current.strokeColor,
            strokeWidth: pRef.current.strokeWidth,
            strokeUniform: true,
          });
          const arrowHead = new fab.Triangle({
            left: x2, top: y2, width: hs, height: hs,
            fill: pRef.current.strokeColor, stroke: 'transparent',
            strokeUniform: true,
            angle, originX: 'center', originY: 'center',
          });
          const group = new fab.Group([arrowLine, arrowHead], {
            selectable: true, evented: true,
            strokeUniform: true,
          });
          canvas.add(group);
          canvas.setActiveObject(group);
        } else {
          obj.set({ selectable: true, evented: true });
          canvas.setActiveObject(obj);
        }

        canvas.renderAll();
        pushHistory();
      });

      // ── Selection helpers ───────────────────────────────────
      const getSelectionInfo = (): SelectionInfo | undefined => {
        const obj = canvas.getActiveObject();
        if (!obj) return undefined;
        const rect = obj.getBoundingRect();
        const cr = containerRef.current!.getBoundingClientRect();
        const isMulti = obj.type === 'active-selection';
        const first = isMulti ? (obj as any).getObjects()[0] : obj;
        const isSticker = !!((obj as any)?.data?.isSticker || (first as any)?.data?.isSticker);

        let fillColor = first?.fill == null || first?.fill === '' ? 'transparent' : (first?.fill as string);
        if (isSticker) {
          const innerRect = (first?.getObjects?.() || []).find((o: any) => o.type === 'rect');
          if (innerRect?.fill) fillColor = innerRect.fill as string;
        }

        return {
          bounds: { x: cr.left + rect.left, y: cr.top + rect.top, w: rect.width, h: rect.height },
          strokeColor: (first?.stroke as string) || '#1a1a2e',
          fillColor,
          strokeWidth: typeof first?.strokeWidth === 'number' ? first.strokeWidth : 2,
          fontSize: typeof first?.fontSize === 'number' ? first.fontSize : 16,
          objectType: obj.type || 'unknown',
          isMulti,
          isSticker,
        };
      };

      // ── Selection events ────────────────────────────────────
      canvas.on('selection:created', () => pRef.current.onSelectionChange(true, getSelectionInfo()));
      canvas.on('selection:updated', () => pRef.current.onSelectionChange(true, getSelectionInfo()));
      canvas.on('selection:cleared', () => pRef.current.onSelectionChange(false));

      // Hide floating toolbar while dragging/resizing to avoid jitter
      canvas.on('object:moving', () => {
        if (!draggingRef.current) {
          draggingRef.current = true;
          pRef.current.onSelectionChange(false);
        }
      });
      canvas.on('object:scaling', () => {
        if (!draggingRef.current) {
          draggingRef.current = true;
          pRef.current.onSelectionChange(false);
        }
      });
      canvas.on('object:rotating', () => {
        if (!draggingRef.current) {
          draggingRef.current = true;
          pRef.current.onSelectionChange(false);
        }
      });
      canvas.on('object:modified', () => {
        draggingRef.current = false;
        pRef.current.onSelectionChange(true, getSelectionInfo());
      });

      // Update toolbar position on pan/zoom (not during drag), throttled via RAF
      let rafPending = false;
      canvas.on('after:render', () => {
        if (rafPending || draggingRef.current) return;
        const obj = canvas.getActiveObject();
        if (!obj) return;
        rafPending = true;
        requestAnimationFrame(() => {
          rafPending = false;
          if (!canvas.getActiveObject() || draggingRef.current) return;
          pRef.current.onSelectionChange(true, getSelectionInfo());
        });
      });


      // ── Object modified ─────────────────────────────────────
      canvas.on('object:modified', pushHistory);
      canvas.on('path:created', () => {
        canvas.forEachObject((o: any) => {
          if (!drawing.current) {
            o.selectable = pRef.current.tool === 'select';
            o.evented = pRef.current.tool === 'select' || pRef.current.tool === 'eraser';
          }
        });
        pushHistory();
      });

      // ── Resize ──────────────────────────────────────────────
      resizeObs = new ResizeObserver(() => {
        const c = containerRef.current;
        if (!c || !canvas) return;
        canvas.setWidth(c.clientWidth);
        canvas.setHeight(c.clientHeight);
        canvas.renderAll();
      });
      resizeObs.observe(container);

      // ── Middle-mouse pan (works with any tool, like Miro) ───
      onMidDown = (e: MouseEvent) => {
        if (e.button !== 1) return;
        e.preventDefault(); // prevent browser autoscroll icon
        midPanning.current = true;
        midPanStart.current = { x: e.clientX, y: e.clientY };
        container.style.cursor = 'grabbing';
      };
      onMidMove = (e: MouseEvent) => {
        if (!midPanning.current) return;
        const vpt = canvas.viewportTransform as number[];
        vpt[4] += e.clientX - midPanStart.current.x;
        vpt[5] += e.clientY - midPanStart.current.y;
        midPanStart.current = { x: e.clientX, y: e.clientY };
        canvas.requestRenderAll();
      };
      onMidUp = (e: MouseEvent) => {
        if (e.button !== 1) return;
        midPanning.current = false;
        container.style.cursor = '';
      };
      onAuxClick = (e: MouseEvent) => { if (e.button === 1) e.preventDefault(); };

      container.addEventListener('mousedown', onMidDown);
      container.addEventListener('mousemove', onMidMove);
      container.addEventListener('mouseup', onMidUp);
      container.addEventListener('auxclick', onAuxClick);
    });

    return () => {
      aborted = true;       // stop the async chain if still pending
      resizeObs?.disconnect();
      if (bgHandlerRef.current && canvas) {
        canvas.off('after:render', bgHandlerRef.current);
        bgHandlerRef.current = null;
      }
      const el = containerRef.current;
      if (el) {
        if (onMidDown) el.removeEventListener('mousedown', onMidDown);
        if (onMidMove) el.removeEventListener('mousemove', onMidMove);
        if (onMidUp)   el.removeEventListener('mouseup', onMidUp);
        if (onAuxClick) el.removeEventListener('auxclick', onAuxClick);
      }
      try { canvas?.dispose(); } catch (_) {}
      fc.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Imperative API ────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    undo() {
      const c = fc.current;
      if (!c || hIdx.current <= 0) return;
      hIdx.current--;
      c.loadFromJSON(JSON.parse(history.current[hIdx.current])).then(() => {
        c.renderAll();
        applyTool(c, pRef.current.tool);
        pRef.current.onHistoryChange(
          hIdx.current > 0,
          hIdx.current < history.current.length - 1
        );
        pRef.current.onChange?.();
      });
    },
    redo() {
      const c = fc.current;
      if (!c || hIdx.current >= history.current.length - 1) return;
      hIdx.current++;
      c.loadFromJSON(JSON.parse(history.current[hIdx.current])).then(() => {
        c.renderAll();
        applyTool(c, pRef.current.tool);
        pRef.current.onHistoryChange(
          hIdx.current > 0,
          hIdx.current < history.current.length - 1
        );
        pRef.current.onChange?.();
      });
    },
    zoomIn() {
      const c = fc.current;
      if (!c) return;
      const z = Math.min(c.getZoom() * 1.25, 20);
      c.setZoom(z); c.renderAll();
      pRef.current.onZoomChange(Math.round(z * 100));
    },
    zoomOut() {
      const c = fc.current;
      if (!c) return;
      const z = Math.max(c.getZoom() / 1.25, 0.05);
      c.setZoom(z); c.renderAll();
      pRef.current.onZoomChange(Math.round(z * 100));
    },
    fitToScreen() {
      const c = fc.current;
      if (!c) return;
      const objects = c.getObjects();
      if (objects.length === 0) {
        c.setViewportTransform([1, 0, 0, 1, 0, 0]);
        c.renderAll();
        pRef.current.onZoomChange(100);
        return;
      }
      // Reset transform first so getBoundingRect returns world coords
      c.setViewportTransform([1, 0, 0, 1, 0, 0]);
      const padding = 60;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      objects.forEach((o: any) => {
        const r = o.getBoundingRect(true);
        minX = Math.min(minX, r.left);
        minY = Math.min(minY, r.top);
        maxX = Math.max(maxX, r.left + r.width);
        maxY = Math.max(maxY, r.top + r.height);
      });
      const contentW = maxX - minX + padding * 2;
      const contentH = maxY - minY + padding * 2;
      const zoom = Math.min(c.width / contentW, c.height / contentH, 2);
      c.setViewportTransform([
        zoom, 0, 0, zoom,
        -(minX - padding) * zoom,
        -(minY - padding) * zoom,
      ]);
      c.renderAll();
      pRef.current.onZoomChange(Math.round(zoom * 100));
    },
    exportPNG() {
      const c = fc.current;
      if (!c) return;
      const url = c.toDataURL({ format: 'png', multiplier: 2, quality: 1 });
      const a = document.createElement('a');
      a.href = url;
      a.download = 'whiteboard.png';
      a.click();
    },
    getThumbnail() {
      const c = fc.current;
      if (!c) return '';
      return c.toDataURL({ format: 'png', multiplier: 0.25, quality: 0.6 });
    },
    clear() {
      const c = fc.current;
      if (!c) return;
      c.clear();
      applyBackground(c, pRef.current.bgStyle);
      c.renderAll();
      pushHistory();
    },
    deleteSelected() {
      const c = fc.current;
      if (!c) return;
      const objs = c.getActiveObjects();
      c.discardActiveObject();
      objs.forEach((o: any) => c.remove(o));
      c.renderAll();
      pushHistory();
    },
    getState() {
      const c = fc.current;
      if (!c) return '';
      return JSON.stringify(c.toObject(['data']));
    },
    loadState(state: string) {
      const c = fc.current;
      if (!c || !state) return;
      try {
        const json = typeof state === 'string' ? JSON.parse(state) : state;
        c.loadFromJSON(json).then(() => {
          c.renderAll();
          applyTool(c, pRef.current.tool);
          applyBackground(c, pRef.current.bgStyle);
          history.current = [JSON.stringify(c.toObject(['data']))];
          hIdx.current = 0;
          pRef.current.onHistoryChange(false, false);
        });
      } catch (e) {
        console.error('loadState error', e);
      }
    },
    addImage(dataUrl: string) {
      const c = fc.current;
      const fab = fm.current;
      if (!c || !fab) return;
      fab.FabricImage.fromURL(dataUrl, { crossOrigin: 'anonymous' }).then((img: any) => {
        const maxW = Math.min(c.width * 0.55, 560);
        if (img.width > maxW) img.scaleToWidth(maxW);
        img.set({
          left: c.width / 2 - (img.width * img.scaleX) / 2,
          top: c.height / 2 - (img.height * img.scaleY) / 2,
          selectable: true,
          evented: true,
        });
        c.add(img);
        c.setActiveObject(img);
        c.renderAll();
        pushHistory();
      });
    },
    applyToSelection({ stroke, fill, strokeWidth, fontSize }) {
      const c = fc.current;
      if (!c) return;
      c.getActiveObjects().forEach((obj: any) => {
        // Sticker: recolor the inner rect (the group itself has
        // no visible fill).
        if (obj?.data?.isSticker) {
          if (fill !== undefined && fill !== 'transparent') {
            const innerRect = obj.getObjects?.().find((o: any) => o.type === 'rect');
            if (innerRect) {
              innerRect.set({ fill });
              obj.dirty = true;
              obj._set?.('dirty', true);
            }
          }
          return;
        }
        if (stroke !== undefined) obj.set({ stroke });
        if (fill !== undefined) {
          if (obj.type === 'i-text' || obj.type === 'textbox') {
            obj.set({ fill });
          } else if (obj.type !== 'textbox') {
            obj.set({ fill });
          }
        }
        if (strokeWidth !== undefined) {
          const oldSW = typeof obj.strokeWidth === 'number' ? obj.strokeWidth : 0;
          const halfDelta = (strokeWidth - oldSW) / 2;
          // Shift position so stroke grows equally on all 4 sides, not just right/bottom
          obj.set({
            strokeWidth,
            left: (obj.left ?? 0) - halfDelta,
            top:  (obj.top  ?? 0) - halfDelta,
          });
          obj.setCoords();
        }
        if (fontSize !== undefined && (obj.type === 'i-text' || obj.type === 'textbox')) {
          obj.set({ fontSize });
        }
      });
      c.requestRenderAll();
      pushHistory();
    },
    isBusy() {
      if (drawing.current || panning.current || midPanning.current || draggingRef.current) return true;
      const c = fc.current;
      if (!c) return false;
      const ao = c.getActiveObject();
      // Editing text or holding a multi-selection ⇒ coordinates are in flux;
      // defer both pushing and applying remote changes until idle.
      if (ao && (ao.isEditing || ao.type === 'activeselection')) return true;
      return false;
    },
    getSyncState() {
      const c = fc.current;
      if (!c) return null;
      // Coordinates are globally unstable mid-gesture / multi-selection — retry later.
      if (drawing.current || panning.current || midPanning.current || draggingRef.current) return null;
      const ao = c.getActiveObject();
      if (ao && ao.type === 'activeselection') return null;

      // Assign ids to any object that still lacks one (new shapes, legacy data),
      // but never to transient pieces of a sticker that's mid-text-edit.
      c.getObjects().forEach((o: any) => {
        if (o.excludeFromSync) return;
        if (!o.data || typeof o.data !== 'object') o.data = {};
        if (!o.data.id) o.data.id = genId();
      });

      // The object the user is editing right now is excluded from the push (its
      // content is in flux) and reported as "held" so the caller keeps it rather
      // than treating its absence as a deletion. For a sticker the live group is
      // decomposed into transient pieces, so we hold the original group id.
      const held: string[] = [];
      let editingId: string | null = null;
      if (ao && ao.isEditing) {
        editingId = editingStickerId.current || (ao.data && ao.data.id) || null;
        if (editingId) held.push(editingId);
      }

      const full = c.toObject(['data']);
      const objects: Record<string, any> = {};
      for (const o of full.objects ?? []) {
        if (o.excludeFromSync) continue;       // transient sticker-edit pieces
        const id = o?.data?.id;
        if (!id || id === editingId) continue; // skip the in-progress object
        objects[id] = o;
      }
      const meta: any = { ...full };
      delete meta.objects;
      return { objects, meta, held };
    },
    async applyRemoteChanges(changes) {
      const c = fc.current;
      const fab = fm.current;
      if (!c || !fab) return { applied: [] };

      const active = c.getActiveObject();
      const activeChildren =
        active?.type === 'activeselection' ? new Set(active.getObjects?.() ?? []) : null;
      const byId = new Map<string, any>();
      c.getObjects().forEach((o: any) => {
        const id = o?.data?.id;
        if (id) byId.set(id, o);
      });

      const isLocked = (obj: any) =>
        obj && (obj === active || obj.isEditing || activeChildren?.has(obj));

      const applied: string[] = [];
      let changed = false;

      for (const ch of changes) {
        const existing = byId.get(ch.objectId);

        if (ch.deleted) {
          if (!existing) { applied.push(ch.objectId); continue; }   // already gone
          if (isLocked(existing)) continue;                          // defer
          c.remove(existing);
          changed = true;
          applied.push(ch.objectId);
          continue;
        }

        if (!ch.data) { applied.push(ch.objectId); continue; }

        if (existing) {
          try {
            if (JSON.stringify(existing.toObject(['data'])) === JSON.stringify(ch.data)) {
              applied.push(ch.objectId);   // already up to date
              continue;
            }
          } catch { /* fall through to replace */ }
          if (isLocked(existing)) continue; // defer overwriting what they're editing
        }

        let enlivened: any[] = [];
        try {
          enlivened = await fab.util.enlivenObjects([ch.data]);
        } catch { enlivened = []; }
        const next = enlivened[0];
        if (!next) continue;
        next.data = { ...(ch.data.data || {}), id: ch.objectId };

        if (existing) {
          const idx = c.getObjects().indexOf(existing);
          c.remove(existing);
          try { c.insertAt(idx, next); } catch { c.add(next); }
        } else {
          c.add(next);
        }
        changed = true;
        applied.push(ch.objectId);
      }

      if (changed) {
        applyTool(c, pRef.current.tool);
        c.requestRenderAll();
        // Reset the undo baseline so a later undo can't delete objects a peer
        // just merged in (collaborative undo is out of scope).
        history.current = [JSON.stringify(c.toObject(['data']))];
        hIdx.current = 0;
        pRef.current.onHistoryChange(false, false);
      }
      return { applied };
    },
  }), [applyTool, applyBackground, pushHistory]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      <canvas ref={canvasElRef} />
    </div>
  );
});

Canvas.displayName = 'WhiteboardCanvas';
export default Canvas;
