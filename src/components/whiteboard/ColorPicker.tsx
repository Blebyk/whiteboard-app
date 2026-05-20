'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';

// ─── Color math ────────────────────────────────────────────────
function hsvToHex(h: number, s: number, v: number): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  const r = Math.round(f(5) * 255);
  const g = Math.round(f(3) * 255);
  const b = Math.round(f(1) * 255);
  return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

function hexToHsv(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  if (h.length !== 6) return [0, 0, 1];
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let hue = 0;
  if (d !== 0) {
    if (max === r) hue = ((g - b) / d + 6) % 6;
    else if (max === g) hue = (b - r) / d + 2;
    else hue = (r - g) / d + 4;
    hue = hue * 60;
  }
  return [hue, max === 0 ? 0 : d / max, max];
}

function isValidHex(s: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(s);
}

const PRESETS = [
  '#1a1a2e', '#374151', '#6b7280', '#d1d5db', '#ffffff',
  '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#2563eb',
  '#7c3aed', '#db2777', '#0891b2', '#065f46', '#92400e',
  '#fef9c3', '#dbeafe', '#f3e8ff', '#d1fae5', '#ffe4e6',
];

const POPUP_W = 210;
const POPUP_H = 320;

// ─── Component ─────────────────────────────────────────────────
interface ColorPickerProps {
  value: string;
  onChange(hex: string): void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0 });
  const hsvRef = useRef<[number, number, number]>(hexToHsv(value));
  const [, forceRender] = useState(0);
  const [hexInput, setHexInput] = useState(value);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const svAreaRef = useRef<HTMLDivElement>(null);
  const hueBarRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<'sv' | 'hue' | null>(null);

  // Sync when external value changes
  useEffect(() => {
    if (!isValidHex(value)) return;
    const cur = hsvToHex(...hsvRef.current);
    if (cur !== value) {
      hsvRef.current = hexToHsv(value);
      setHexInput(value);
      forceRender((n) => n + 1);
    }
  }, [value]);

  // Compute position and open
  const openPicker = () => {
    const btn = triggerRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow >= POPUP_H + 8 ? rect.bottom + 8 : rect.top - POPUP_H - 8;
    const left = Math.min(rect.left, window.innerWidth - POPUP_W - 8);
    setPopupPos({ top, left });
    setOpen(true);
  };

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        popupRef.current && !popupRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const applyFromSV = useCallback((e: MouseEvent) => {
    const el = svAreaRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const sx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const sy = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    hsvRef.current = [hsvRef.current[0], sx, 1 - sy];
    const hex = hsvToHex(...hsvRef.current);
    setHexInput(hex);
    onChange(hex);
    forceRender((n) => n + 1);
  }, [onChange]);

  const applyFromHue = useCallback((e: MouseEvent) => {
    const el = hueBarRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const hx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    hsvRef.current = [hx * 360, hsvRef.current[1], hsvRef.current[2]];
    const hex = hsvToHex(...hsvRef.current);
    setHexInput(hex);
    onChange(hex);
    forceRender((n) => n + 1);
  }, [onChange]);

  // Global drag listeners
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (dragging.current === 'sv') applyFromSV(e);
      if (dragging.current === 'hue') applyFromHue(e);
    };
    const onUp = () => { dragging.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [applyFromSV, applyFromHue]);

  const [h, s, v] = hsvRef.current;
  const hueHex = hsvToHex(h, 1, 1);
  const currentHex = hsvToHex(h, s, v);

  const popup = open && typeof window !== 'undefined' ? createPortal(
    <div
      ref={popupRef}
      style={{
        position: 'fixed',
        top: popupPos.top,
        left: popupPos.left,
        zIndex: 9999,
        width: POPUP_W,
        backgroundColor: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: '14px',
        boxShadow: '0 12px 40px rgba(0,0,0,0.16)',
        padding: '14px',
      }}
    >
      {/* SV gradient area */}
      <div
        ref={svAreaRef}
        onMouseDown={(e) => {
          dragging.current = 'sv';
          applyFromSV(e.nativeEvent);
          e.preventDefault();
        }}
        style={{
          width: '100%',
          height: '130px',
          borderRadius: '8px',
          position: 'relative',
          cursor: 'crosshair',
          marginBottom: '10px',
          background: `linear-gradient(to bottom, transparent, #000),
                       linear-gradient(to right, #fff, ${hueHex})`,
          userSelect: 'none',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: `${s * 100}%`,
            top: `${(1 - v) * 100}%`,
            width: '13px',
            height: '13px',
            borderRadius: '50%',
            border: '2.5px solid #fff',
            boxShadow: '0 0 0 1.5px rgba(0,0,0,0.25)',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            backgroundColor: currentHex,
          }}
        />
      </div>

      {/* Hue slider */}
      <div
        ref={hueBarRef}
        onMouseDown={(e) => {
          dragging.current = 'hue';
          applyFromHue(e.nativeEvent);
          e.preventDefault();
        }}
        style={{
          width: '100%',
          height: '13px',
          borderRadius: '7px',
          position: 'relative',
          cursor: 'pointer',
          marginBottom: '12px',
          background: 'linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)',
          userSelect: 'none',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: `${(h / 360) * 100}%`,
            top: '50%',
            width: '17px',
            height: '17px',
            borderRadius: '50%',
            border: '2.5px solid #fff',
            boxShadow: '0 0 0 1.5px rgba(0,0,0,0.25)',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            backgroundColor: hueHex,
          }}
        />
      </div>

      {/* Preview + hex input */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <div
          style={{
            width: '30px',
            height: '30px',
            borderRadius: '7px',
            backgroundColor: currentHex,
            border: '1px solid #e5e7eb',
            flexShrink: 0,
            boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
          }}
        />
        <input
          type="text"
          value={hexInput}
          onChange={(e) => {
            setHexInput(e.target.value);
            if (isValidHex(e.target.value)) {
              hsvRef.current = hexToHsv(e.target.value);
              onChange(e.target.value);
              forceRender((n) => n + 1);
            }
          }}
          onBlur={() => setHexInput(currentHex)}
          maxLength={7}
          placeholder="#000000"
          style={{
            flex: 1,
            padding: '6px 8px',
            border: '1.5px solid #e5e7eb',
            borderRadius: '7px',
            fontSize: '12px',
            fontFamily: 'monospace',
            outline: 'none',
            color: '#374151',
            letterSpacing: '0.05em',
          }}
          onFocus={(e) => (e.target.style.borderColor = '#4f46e5')}
        />
      </div>

      {/* Preset swatches */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
        {PRESETS.map((c) => (
          <button
            key={c}
            onClick={() => {
              hsvRef.current = hexToHsv(c);
              setHexInput(c);
              onChange(c);
              forceRender((n) => n + 1);
            }}
            style={{
              width: '22px',
              height: '22px',
              borderRadius: '5px',
              border: currentHex === c ? '2.5px solid #4f46e5' : '1px solid #e5e7eb',
              backgroundColor: c,
              cursor: 'pointer',
              padding: 0,
              outline: 'none',
              boxShadow: currentHex === c ? '0 0 0 1px #4f46e5' : undefined,
            }}
          />
        ))}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => open ? setOpen(false) : openPicker()}
        title="Выбрать цвет"
        style={{
          width: '28px',
          height: '28px',
          borderRadius: '6px',
          border: open ? '2px solid #4f46e5' : '1.5px solid #d1d5db',
          cursor: 'pointer',
          padding: 0,
          backgroundColor: isValidHex(value) ? value : '#ffffff',
          boxShadow: open ? '0 0 0 2px #c7d2fe' : '0 1px 3px rgba(0,0,0,0.1)',
          flexShrink: 0,
          transition: 'box-shadow 0.15s',
        }}
      />
      {popup}
    </>
  );
}
