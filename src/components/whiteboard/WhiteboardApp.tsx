'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Canvas from './Canvas';
import Toolbar from './Toolbar';
import TopBar from './TopBar';
import PropertiesPanel from './PropertiesPanel';
import FloatingToolbar from './FloatingToolbar';
import type { Tool, CanvasRef, SelectionInfo } from './Canvas';

interface Props {
  boardId: number;
  boardName: string;
  initialState: string | null;
  initialBgStyle?: 'none' | 'grid' | 'dots';
}

export default function WhiteboardApp({ boardId, boardName, initialState, initialBgStyle }: Props) {
  const canvasRef = useRef<CanvasRef>(null);

  // Tool & drawing properties
  const [tool, setTool] = useState<Tool>('select');
  const [strokeColor, setStrokeColor] = useState('#1a1a2e');
  const [fillColor, setFillColor] = useState('transparent');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [fontSize, setFontSize] = useState(16);
  const [bgStyle, setBgStyle] = useState<'none' | 'grid' | 'dots'>(initialBgStyle ?? 'dots');
  const bgStyleRef = useRef(bgStyle);
  const isMounted = useRef(false);
  useEffect(() => { bgStyleRef.current = bgStyle; }, [bgStyle]);

  // Save bgStyle immediately on change (skip first mount)
  useEffect(() => {
    if (!isMounted.current) { isMounted.current = true; return; }
    fetch(`/api/boards/${boardId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bgStyle }),
    });
  }, [bgStyle, boardId]);

  // State
  const [zoom, setZoom] = useState(100);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  const [selectionInfo, setSelectionInfo] = useState<SelectionInfo | null>(null);
  const [name, setName] = useState(boardName);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');

  // ─── Auto-save every 30s ──────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      triggerSave();
    }, 30_000);
    return () => clearInterval(interval);
  }, [boardId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Keyboard shortcuts ───────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const inInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;
      if (inInput) return;

      const ctrl = e.ctrlKey || e.metaKey;

      if (ctrl) {
        if (e.key === 'z') { e.preventDefault(); canvasRef.current?.undo(); return; }
        if (e.key === 'y' || (e.shiftKey && e.key === 'Z')) {
          e.preventDefault(); canvasRef.current?.redo(); return;
        }
        if (e.key === 's') { e.preventDefault(); triggerSave(); return; }
        if (e.key === '+' || e.key === '=') { e.preventDefault(); canvasRef.current?.zoomIn(); return; }
        if (e.key === '-') { e.preventDefault(); canvasRef.current?.zoomOut(); return; }
        if (e.key === '0') { e.preventDefault(); canvasRef.current?.fitToScreen(); return; }
      }

      if (e.key === 'Escape') { setTool('select'); return; }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (hasSelection) { e.preventDefault(); canvasRef.current?.deleteSelected(); }
        return;
      }

      const keyMap: Record<string, Tool> = {
        v: 'select', h: 'pan', p: 'pencil',
        r: 'rect', o: 'ellipse', t: 'triangle',
        d: 'diamond', l: 'line', a: 'arrow',
        x: 'text', s: 'sticky', e: 'eraser', i: 'image',
      };
      const next = keyMap[e.key.toLowerCase()];
      if (next) setTool(next);
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hasSelection]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Save ─────────────────────────────────────────────────────
  const triggerSave = useCallback(async () => {
    const c = canvasRef.current;
    if (!c) return;
    setSaveStatus('saving');
    try {
      const canvasState = c.getState();
      const thumbnail = c.getThumbnail();
      await fetch(`/api/boards/${boardId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canvasState, thumbnail, bgStyle: bgStyleRef.current }),
      });
      setSaveStatus('saved');
    } catch {
      setSaveStatus('unsaved');
    }
  }, [boardId]);

  // ─── Rename ───────────────────────────────────────────────────
  const handleRename = useCallback(async (newName: string) => {
    setName(newName);
    await fetch(`/api/boards/${boardId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    });
  }, [boardId]);

  // ─── Image upload ─────────────────────────────────────────────
  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !canvasRef.current) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      canvasRef.current?.addImage(dataUrl);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
    setTool('select');
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <TopBar
        boardName={name}
        saveStatus={saveStatus}
        zoom={zoom}
        canUndo={canUndo}
        canRedo={canRedo}
        hasSelection={hasSelection}
        onRename={handleRename}
        onSave={triggerSave}
        onUndo={() => canvasRef.current?.undo()}
        onRedo={() => canvasRef.current?.redo()}
        onZoomIn={() => canvasRef.current?.zoomIn()}
        onZoomOut={() => canvasRef.current?.zoomOut()}
        onFitToScreen={() => canvasRef.current?.fitToScreen()}
        onExportPNG={() => canvasRef.current?.exportPNG()}
        onClear={() => canvasRef.current?.clear()}
        onDelete={() => canvasRef.current?.deleteSelected()}
      />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Toolbar
          tool={tool}
          onToolChange={setTool}
          onImageUpload={handleImageUpload}
        />

        {/* Canvas area */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <Canvas
            ref={canvasRef}
            tool={tool}
            strokeColor={strokeColor}
            fillColor={fillColor}
            strokeWidth={strokeWidth}
            fontSize={fontSize}
            bgStyle={bgStyle}
            initialState={initialState}
            onHistoryChange={(u, r) => { setCanUndo(u); setCanRedo(r); }}
            onZoomChange={setZoom}
            onSelectionChange={(active, info) => {
              setHasSelection(active);
              setSelectionInfo(active && info ? info : null);
            }}
          />

          {/* Zoom quick-access bottom-right */}
          <div style={{
            position: 'absolute', bottom: '16px', right: '16px',
            display: 'flex', gap: '6px', alignItems: 'center',
            backgroundColor: 'white', borderRadius: '10px',
            border: '1px solid #e5e7eb', padding: '5px 8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            fontSize: '12px', color: '#555',
          }}>
            <button onClick={() => canvasRef.current?.zoomOut()}
              style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '16px', color: '#555', padding: '0 2px' }}>−</button>
            <span style={{ fontWeight: 600, minWidth: '40px', textAlign: 'center' }}>{zoom}%</span>
            <button onClick={() => canvasRef.current?.zoomIn()}
              style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '16px', color: '#555', padding: '0 2px' }}>+</button>
            <div style={{ width: '1px', height: '16px', backgroundColor: '#e5e7eb', margin: '0 2px' }} />
            <button onClick={() => canvasRef.current?.fitToScreen()}
              title="По экрану (Ctrl+0)"
              style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '11px', color: '#777', padding: '0 2px' }}>⊡ Fit</button>
          </div>
        </div>

        {selectionInfo && (
          <FloatingToolbar
            info={selectionInfo}
            onApply={(props) => {
              canvasRef.current?.applyToSelection(props);
              if (props.stroke !== undefined) setStrokeColor(props.stroke);
              if (props.fill !== undefined) setFillColor(props.fill);
              if (props.strokeWidth !== undefined) setStrokeWidth(props.strokeWidth);
              if (props.fontSize !== undefined) setFontSize(props.fontSize);
            }}
            onDelete={() => canvasRef.current?.deleteSelected()}
          />
        )}


        <PropertiesPanel
          tool={tool}
          strokeColor={strokeColor}
          fillColor={fillColor}
          strokeWidth={strokeWidth}
          fontSize={fontSize}
          bgStyle={bgStyle}
          hasSelection={hasSelection}
          onStrokeColorChange={(c) => {
            setStrokeColor(c);
            if (hasSelection) canvasRef.current?.applyToSelection({ stroke: c });
          }}
          onFillColorChange={(c) => {
            setFillColor(c);
            if (hasSelection) canvasRef.current?.applyToSelection({ fill: c });
          }}
          onStrokeWidthChange={(n) => {
            setStrokeWidth(n);
            if (hasSelection) canvasRef.current?.applyToSelection({ strokeWidth: n });
          }}
          onFontSizeChange={setFontSize}
          onBgStyleChange={setBgStyle}
          onDelete={() => canvasRef.current?.deleteSelected()}
        />
      </div>
    </div>
  );
}
