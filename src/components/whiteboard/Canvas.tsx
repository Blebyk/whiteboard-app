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
  | 'sticky'
  | 'eraser'
  | 'image';

export interface SelectionInfo {
  bounds: { x: number; y: number; w: number; h: number };
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  fontSize: number;
  objectType: string;
  isSticky: boolean;
  isMulti: boolean;
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
}

export interface CanvasProps {
  tool: Tool;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  fontSize: number;
  bgStyle: 'none' | 'grid' | 'dots';
  initialState?: string | null;
  onHistoryChange(canUndo: boolean, canRedo: boolean): void;
  onZoomChange(zoom: number): void;
  onSelectionChange(active: boolean, info?: SelectionInfo): void;
}

// Miro-inspired sticky note palette
const STICKY_COLORS = [
  '#fff9b1', '#ffd966',   // yellows
  '#f5a623', '#f47373',   // orange, coral
  '#f9a8d4', '#d8b4fe',   // pink, lavender
  '#93c5fd', '#6ee7b7',   // blue, mint
];

/** Darken a CSS hex colour by `amount` (0–255 per channel). */
function darkenHex(hex: string, amount: number): string {
  if (!hex.startsWith('#')) return hex;
  const c = hex.replace('#', '');
  const full = c.length === 3 ? c.split('').map(x => x + x).join('') : c;
  const n = parseInt(full, 16);
  const r = Math.max(0, (n >> 16) - amount);
  const g = Math.max(0, ((n >> 8) & 0xff) - amount);
  const b = Math.max(0, (n & 0xff) - amount);
  return `rgb(${r},${g},${b})`;
}

/**
 * Override _renderBackground on a Fabric Textbox instance so it draws:
 *  - rounded-rect background matching the note's backgroundColor
 *  - a subtle drop-shadow
 *  - a Miro-style folded corner (top-right)
 */
function applyStickyRenderBg(note: any): void {
  (note as any)._renderBackground = function (this: any, ctx: CanvasRenderingContext2D) {
    const w = this.width;
    const h = this.height;
    const r = 4;       // corner radius
    const fold = 16;   // folded corner size
    const color: string = this.backgroundColor || '#fff9b1';

    // ── Main background with shadow ──────────────────────────────
    ctx.save();
    ctx.shadowColor   = 'rgba(0,0,0,0.18)';
    ctx.shadowBlur    = 14;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = color;
    ctx.beginPath();
    // top-left arc
    ctx.moveTo(-w / 2 + r, -h / 2);
    // top edge → top-right fold notch
    ctx.lineTo(w / 2 - fold, -h / 2);
    // diagonal fold cut
    ctx.lineTo(w / 2, -h / 2 + fold);
    // right edge ↓
    ctx.lineTo(w / 2, h / 2 - r);
    ctx.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
    // bottom edge ←
    ctx.lineTo(-w / 2 + r, h / 2);
    ctx.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
    // left edge ↑
    ctx.lineTo(-w / 2, -h / 2 + r);
    ctx.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // ── Folded-corner triangle (darker shade, no shadow) ─────────
    ctx.save();
    ctx.fillStyle = darkenHex(color, 30);
    ctx.beginPath();
    ctx.moveTo(w / 2 - fold, -h / 2);
    ctx.lineTo(w / 2,        -h / 2 + fold);
    ctx.lineTo(w / 2 - fold, -h / 2 + fold);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };
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
  sticky: 'cell',
  eraser: 'cell',
  image: 'crosshair',
};

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

  // Background handler ref (for cleanup on style change)
  const bgHandlerRef = useRef<(() => void) | null>(null);

  // ─── History helpers ───────────────────────────────────────────
  const pushHistory = useCallback(() => {
    const c = fc.current;
    if (!c) return;
    const snap = JSON.stringify(c.toJSON(['data']));
    history.current = history.current.slice(0, hIdx.current + 1);
    history.current.push(snap);
    if (history.current.length > 60) history.current.shift();
    hIdx.current = history.current.length - 1;
    pRef.current.onHistoryChange(hIdx.current > 0, false);
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

  // ─── Restore sticky-note behaviour after JSON load ────────────
  // `data.isSticky` and `data.minH` are stored inside Fabric's standard `data`
  // property, which IS always serialised by Fabric. Runtime-only things
  // (_stickyMinH, _renderBackground, event handlers) are re-applied here.
  const patchStickyNote = useCallback((obj: any) => {
    if (obj._stickyPatched || !obj.data?.isSticky) return;
    obj._stickyPatched = true;

    // Restore runtime min-height from the always-serialised data.minH
    const minH: number = obj.data.minH ?? 200;
    obj._stickyMinH = minH;

    // Custom background rendering (rounded rect + fold)
    applyStickyRenderBg(obj);
    obj.clipPath = null; // remove stale clipPath from older saves

    // Enforce minimum height whenever Fabric recalculates dimensions
    const _origInit: () => void = obj.initDimensions.bind(obj);
    obj.initDimensions = function (this: any) {
      _origInit();
      const min = this._stickyMinH ?? minH;
      if (this.height < min) this.height = min;
    };
    // Apply immediately — Fabric may have already shrunk height to fit text
    obj.initDimensions();
    obj.setCoords();

    // Controls: sides + bottom + rotation only
    obj.setControlsVisibility({
      tl: false, tr: false, bl: false, br: false,
      mt: false, mb: true, ml: true, mr: true, mtr: true,
    });

    // Height resize (mb handle uses scaling; ml/mr are Textbox-native)
    obj.on('scaling', function (this: any) {
      const newH = Math.max(60, this.height * this.scaleY);
      this._stickyMinH = newH;
      this.data = { ...this.data, minH: newH }; // persist into serialisable data
      this.height = newH;
      this.scaleX = 1;
      this.scaleY = 1;
      this.setCoords();
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

      // ── Restore sticky patches on every object:added ────────────
      // Must be registered BEFORE loadFromJSON so initial load is covered.
      canvas.on('object:added', (e: any) => patchStickyNote(e.target));

      // Load initial state
      const initState = pRef.current.initialState;
      if (initState) {
        try {
          await canvas.loadFromJSON(JSON.parse(initState));
          // loadFromJSON fires object:added for each object, but the promise
          // resolves after all objects are enlivened. Apply patches explicitly
          // here as a safety net (handles edge cases where object:added timing
          // differs across Fabric versions).
          canvas.getObjects().forEach((o: any) => patchStickyNote(o));
          canvas.renderAll();
          applyTool(canvas, pRef.current.tool);
        } catch (e) {
          console.warn('Failed to load initial canvas state:', e);
        }
      }

      history.current = [JSON.stringify(canvas.toJSON(['data']))];
      hIdx.current = 0;

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

        if (tool === 'sticky') {
          const bg = STICKY_COLORS[Math.floor(Math.random() * STICKY_COLORS.length)];
          const SIZE = 200; // square by default, like Miro

          const note = new fab.Textbox('', {
            left: pointer.x - SIZE / 2,
            top:  pointer.y - SIZE / 2,
            width: SIZE,
            fontSize: 16,
            fontFamily: "'Helvetica Neue', Arial, sans-serif",
            fill: '#1f2937',
            textAlign: 'center',
            backgroundColor: bg,
            padding: 20,
            selectable: true,
            evented: true,
            lockScalingFlip: true,
            // `data` is Fabric's standard serialisable bag — always saved in toJSON.
            // isSticky lets patchStickyNote identify this object after loading.
            // minH is the user-set minimum height, persisted across saves.
            data: { isSticky: true, minH: SIZE },
          } as any);

          // ── Custom background: rounded corners + Miro-style fold ──
          applyStickyRenderBg(note);

          // ── Runtime min-height (mirrors data.minH for fast access) ──
          (note as any)._stickyMinH = SIZE;
          const _origInit: () => void = (note as any).initDimensions.bind(note);
          (note as any).initDimensions = function (this: any) {
            _origInit();
            const min = this._stickyMinH ?? SIZE;
            if (this.height < min) this.height = min;
          };
          (note as any).initDimensions();

          // ── Controls: sides + bottom + rotation; no corners ──────
          note.setControlsVisibility({
            tl: false, tr: false, bl: false, br: false,
            mt: false,
            mb: true,  // ↕ drag down to make taller
            ml: true,  // ↔ Fabric Textbox handles ml/mr natively (no scaling event)
            mr: true,
            mtr: true, // rotation
          });

          // ── Height resize (mb fires scaling; ml/mr are Textbox-native) ──
          note.on('scaling', function (this: any) {
            const newH = Math.max(60, this.height * this.scaleY);
            this._stickyMinH = newH;
            this.data = { ...this.data, minH: newH }; // keep data.minH in sync
            this.height = newH;
            this.scaleX = 1;
            this.scaleY = 1;
            this.setCoords();
          });

          // Mark as fully set up BEFORE canvas.add so patchStickyNote skips it.
          (note as any)._stickyPatched = true;
          canvas.add(note);
          canvas.setActiveObject(note);
          note.enterEditing();
          note.on('editing:exited', () => {
            if (!note.text) {
              // Keep the note even if empty — user can type later
            }
            pushHistory();
          });
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
        return {
          bounds: { x: cr.left + rect.left, y: cr.top + rect.top, w: rect.width, h: rect.height },
          strokeColor: (first?.stroke as string) || '#1a1a2e',
          fillColor: first?.fill == null || first?.fill === '' ? 'transparent' : (first?.fill as string),
          strokeWidth: typeof first?.strokeWidth === 'number' ? first.strokeWidth : 2,
          fontSize: typeof first?.fontSize === 'number' ? first.fontSize : 16,
          objectType: obj.type || 'unknown',
          isSticky: !!(first as any)?.data?.isSticky,
          isMulti,
        };
      };

      // ── Selection events ────────────────────────────────────
      canvas.on('selection:created', () => pRef.current.onSelectionChange(true, getSelectionInfo()));
      canvas.on('selection:updated', () => pRef.current.onSelectionChange(true, getSelectionInfo()));
      canvas.on('selection:cleared', () => pRef.current.onSelectionChange(false));

      // Update toolbar position on every render (pan/zoom/move), throttled via RAF
      let rafPending = false;
      canvas.on('after:render', () => {
        if (rafPending) return;
        const obj = canvas.getActiveObject();
        if (!obj) return;
        rafPending = true;
        requestAnimationFrame(() => {
          rafPending = false;
          if (!canvas.getActiveObject()) return;
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
  }, [patchStickyNote]); // eslint-disable-line react-hooks/exhaustive-deps

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
      return JSON.stringify(c.toJSON(['data']));
    },
    loadState(state: string) {
      const c = fc.current;
      if (!c || !state) return;
      try {
        const json = typeof state === 'string' ? JSON.parse(state) : state;
        c.loadFromJSON(json).then(() => {
          c.getObjects().forEach((o: any) => patchStickyNote(o));
          c.renderAll();
          applyTool(c, pRef.current.tool);
          applyBackground(c, pRef.current.bgStyle);
          history.current = [JSON.stringify(c.toJSON(['data']))];
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
        if (stroke !== undefined) obj.set({ stroke });
        if (fill !== undefined) {
          if (obj.type === 'i-text' || (obj.type === 'textbox' && !obj.data?.isSticky)) {
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
  }), [applyTool, applyBackground, pushHistory]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      <canvas ref={canvasElRef} />
    </div>
  );
});

Canvas.displayName = 'WhiteboardCanvas';
export default Canvas;
