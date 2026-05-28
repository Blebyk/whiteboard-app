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
  isOwner: boolean;
  canEdit: boolean;
  currentUserId: number;
  initialRev: number;
}

export default function WhiteboardApp({
  boardId, boardName, initialState, initialBgStyle,
  isOwner, canEdit, currentUserId, initialRev,
}: Props) {
  const canvasRef = useRef<CanvasRef>(null);

  const [tool, setTool] = useState<Tool>(canEdit ? 'select' : 'pan');
  const [strokeColor, setStrokeColor] = useState('#1a1a2e');
  const [fillColor, setFillColor] = useState('transparent');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [fontSize, setFontSize] = useState(16);
  const [bgStyle, setBgStyle] = useState<'none' | 'grid' | 'dots'>(initialBgStyle ?? 'dots');
  const isMounted = useRef(false);

  const [zoom, setZoom] = useState(100);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  const [selectionInfo, setSelectionInfo] = useState<SelectionInfo | null>(null);
  const [name, setName] = useState(boardName);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');

  // ─── Object-level sync state ──────────────────────────────────
  const lastRev = useRef<number>(initialRev);              // highest server rev we've applied
  const syncedSnapshot = useRef<Record<string, string>>({}); // id → JSON of last-synced object
  const readyRef = useRef(false);                          // canvas finished initial load
  const isSyncing = useRef(false);                         // a pull is in flight
  const savingRef = useRef(false);                         // a push is in flight
  const pendingSaveRef = useRef(false);                    // local edits await a push
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pushRef = useRef<() => void>(() => {});            // always-latest pushChanges

  // ─── Save bgStyle immediately on change (skip first mount) ────
  useEffect(() => {
    if (!isMounted.current) { isMounted.current = true; return; }
    if (!canEdit) return;
    fetch(`/api/boards/${boardId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bgStyle }),
    });
  }, [bgStyle, boardId, canEdit]);

  // Build the baseline snapshot once the canvas has loaded the initial state.
  const handleReady = useCallback(() => {
    const state = canvasRef.current?.getSyncState();
    if (state) {
      const snap: Record<string, string> = {};
      for (const id in state.objects) snap[id] = JSON.stringify(state.objects[id]);
      syncedSnapshot.current = snap;
    }
    readyRef.current = true;
  }, []);

  // ─── Push local object changes (diff vs last-synced snapshot) ──
  const pushChanges = useCallback(async () => {
    const c = canvasRef.current;
    if (!c || !canEdit || !readyRef.current || savingRef.current) return;
    // null ⇒ a gesture makes coordinates unstable (drawing/dragging/multi-select).
    // Retry shortly. Note: this does NOT block while text-editing — committed
    // objects still push; only the in-progress one is held back (see `held`).
    const state = c.getSyncState();
    if (!state) {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => pushRef.current(), 250);
      return;
    }

    const current: Record<string, string> = {};
    for (const id in state.objects) current[id] = JSON.stringify(state.objects[id]);
    const held = new Set(state.held);

    const changes: Array<{ objectId: string; data?: any; deleted?: boolean }> = [];
    for (const id in current) {
      if (current[id] !== syncedSnapshot.current[id]) changes.push({ objectId: id, data: state.objects[id] });
    }
    for (const id in syncedSnapshot.current) {
      // Absent because it's being edited (held) ⇒ not a deletion.
      if (!(id in current) && !held.has(id)) changes.push({ objectId: id, deleted: true });
    }

    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    pendingSaveRef.current = false;
    if (changes.length === 0) { setSaveStatus('saved'); return; }

    savingRef.current = true;
    setSaveStatus('saving');
    try {
      const res = await fetch(`/api/boards/${boardId}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changes, meta: state.meta, thumbnail: c.getThumbnail() }),
      });
      if (!res.ok) throw new Error('save failed');
      const { rev } = await res.json();
      if (typeof rev === 'number') lastRev.current = rev;
      // Commit exactly what we sent; edits made during the request stay dirty.
      for (const ch of changes) {
        if (ch.deleted) delete syncedSnapshot.current[ch.objectId];
        else syncedSnapshot.current[ch.objectId] = JSON.stringify(ch.data);
      }
      setSaveStatus('saved');
    } catch {
      pendingSaveRef.current = true;
      setSaveStatus('unsaved');
    } finally {
      savingRef.current = false;
      // Edits that landed mid-request (or a failed push) get flushed promptly.
      if (pendingSaveRef.current) {
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => pushRef.current(), 200);
      }
    }
  }, [boardId, canEdit]);

  useEffect(() => { pushRef.current = pushChanges; }, [pushChanges]);

  // Debounced save fired on every local edit.
  const scheduleSave = useCallback(() => {
    if (!canEdit) return;
    pendingSaveRef.current = true;
    setSaveStatus('unsaved');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => pushRef.current(), 200);
  }, [canEdit]);

  // ─── Pull peer changes and merge them object-by-object ────────
  // Triggered instantly by SSE; also runs on a slow fallback interval.
  const pullNow = useCallback(async () => {
    if (!readyRef.current || isSyncing.current) return;
    isSyncing.current = true;
    try {
      const res = await fetch(`/api/boards/${boardId}/sync?since=${lastRev.current}`);
      if (!res.ok) return;
      const { rev, changes } = await res.json();
      if (typeof rev !== 'number') return;

      const incoming = (changes ?? []).filter((ch: any) => ch.updated_by !== currentUserId);
      if (incoming.length === 0) { lastRev.current = rev; return; }

      // Don't merge while the local user is mid-interaction; retry next tick.
      if (canvasRef.current?.isBusy()) return;

      const { applied } = await canvasRef.current!.applyRemoteChanges(incoming);
      const appliedSet = new Set(applied);
      for (const ch of incoming) {
        if (!appliedSet.has(ch.objectId)) continue;
        if (ch.deleted) delete syncedSnapshot.current[ch.objectId];
        else syncedSnapshot.current[ch.objectId] = JSON.stringify(ch.data);
      }
      // Advance the cursor only once the whole batch is merged, so anything
      // deferred (a locked object) is re-offered on the next pull.
      if (applied.length === incoming.length) lastRev.current = rev;
    } catch {
      // ignore network errors
    } finally {
      isSyncing.current = false;
    }
  }, [boardId, currentUserId]);

  // Real-time: server pushes a "rev changed" signal → pull immediately.
  useEffect(() => {
    let es: EventSource | null = null;
    let closed = false;
    try {
      es = new EventSource(`/api/boards/${boardId}/events`);
      es.onmessage = (e) => {
        if (closed) return;
        try {
          const { rev, by } = JSON.parse(e.data);
          if (typeof rev === 'number' && by !== currentUserId && rev > lastRev.current) pullNow();
        } catch { /* ignore malformed */ }
      };
      // EventSource reconnects automatically on error; nothing to do here.
    } catch { /* EventSource unavailable */ }
    return () => { closed = true; es?.close(); };
  }, [boardId, currentUserId, pullNow]);

  // Fallback poll (covers missed SSE events / multi-process / SSE down).
  useEffect(() => {
    const interval = setInterval(() => pullNow(), 5_000);
    return () => clearInterval(interval);
  }, [pullNow]);

  // ─── Backstop: flush pending edits if a push previously failed ─
  useEffect(() => {
    if (!canEdit) return;
    const interval = setInterval(() => { if (pendingSaveRef.current) pushRef.current(); }, 15_000);
    return () => clearInterval(interval);
  }, [canEdit]);

  // Flush any pending save on unmount / tab close.
  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  // ─── Keyboard shortcuts ───────────────────────────────────────
  useEffect(() => {
    if (!canEdit) return;
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const inInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (inInput) return;

      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl) {
        if (e.key === 'z') { e.preventDefault(); canvasRef.current?.undo(); return; }
        if (e.key === 'y' || (e.shiftKey && e.key === 'Z')) { e.preventDefault(); canvasRef.current?.redo(); return; }
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
        x: 'text', n: 'sticker', e: 'eraser', i: 'image',
      };
      const next = keyMap[e.key.toLowerCase()];
      if (next) setTool(next);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hasSelection, canEdit]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Save (explicit flush: Ctrl+S / toolbar button) ───────────
  const triggerSave = useCallback(() => { pushChanges(); }, [pushChanges]);

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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', fontFamily: 'Arial, sans-serif' }}>
      <TopBar
        boardId={boardId}
        boardName={name}
        isOwner={isOwner}
        canEdit={canEdit}
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
        {canEdit && (
          <Toolbar tool={tool} onToolChange={setTool} onImageUpload={handleImageUpload} />
        )}

        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <Canvas
            ref={canvasRef}
            tool={canEdit ? tool : 'pan'}
            readOnly={!canEdit}
            strokeColor={strokeColor}
            fillColor={fillColor}
            strokeWidth={strokeWidth}
            fontSize={fontSize}
            bgStyle={bgStyle}
            initialState={initialState}
            onReady={handleReady}
            onChange={scheduleSave}
            onHistoryChange={(u, r) => { setCanUndo(u); setCanRedo(r); }}
            onZoomChange={setZoom}
            onSelectionChange={(active, info) => {
              setHasSelection(active);
              setSelectionInfo(active && info ? info : null);
            }}
          />

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

        {canEdit && selectionInfo && (
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

        {canEdit && (
          <PropertiesPanel
            tool={tool}
            strokeColor={strokeColor}
            fillColor={fillColor}
            strokeWidth={strokeWidth}
            fontSize={fontSize}
            bgStyle={bgStyle}
            hasSelection={hasSelection}
            isStickerSelected={!!selectionInfo?.isSticker}
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
        )}
      </div>
    </div>
  );
}
