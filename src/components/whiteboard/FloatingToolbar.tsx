'use client';

import { useState, useEffect } from 'react';
import { ColorPicker } from './ColorPicker';
import type { SelectionInfo } from './Canvas';

interface Props {
  info: SelectionInfo;
  onApply(props: { stroke?: string; fill?: string; strokeWidth?: number; fontSize?: number }): void;
  onDelete(): void;
}

const TOOLBAR_H = 52;
const GAP = 10;
const TOPBAR_H = 48;
const LEFT_PANEL_W = 44;
const RIGHT_PANEL_W = 208;

function Divider() {
  return <div style={{ width: 1, height: 28, background: '#e5e7eb', flexShrink: 0 }} />;
}

function Label({ children }: { children: string }) {
  return (
    <span style={{ fontSize: 9, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', lineHeight: 1 }}>
      {children}
    </span>
  );
}

export default function FloatingToolbar({ info, onApply, onDelete }: Props) {
  const [stroke, setStroke] = useState(info.strokeColor);
  const [fill, setFill] = useState(info.fillColor);
  const [sw, setSw] = useState(info.strokeWidth);
  const [fs, setFs] = useState(info.fontSize);

  // Sync when a different object is selected
  useEffect(() => {
    setStroke(info.strokeColor);
    setFill(info.fillColor);
    setSw(info.strokeWidth);
    setFs(info.fontSize);
  }, [info.strokeColor, info.fillColor, info.strokeWidth, info.fontSize, info.objectType]);

  if (info.isSticky) return null;

  const isText = info.objectType === 'i-text' || info.objectType === 'textbox';
  const isImage = info.objectType === 'image';
  const isLine = info.objectType === 'line' || info.objectType === 'path' || info.objectType === 'group';
  const showFill = !isText && !isImage && !isLine;
  const showStroke = !isImage;
  const showFontSize = isText;

  // Position: above selection, or below if too close to topbar
  const above = info.bounds.y - TOPBAR_H > TOOLBAR_H + GAP * 2;
  const top = above
    ? info.bounds.y - TOOLBAR_H - GAP
    : info.bounds.y + info.bounds.h + GAP;

  // Center on selection, clamp to canvas area
  const estimatedW = 80
    + (showFill ? 90 : 0)
    + (showStroke ? 60 : 0)
    + (showFontSize ? 100 : 0)
    + (!isImage ? 80 : 0)
    + 48;
  const maxLeft = window.innerWidth - RIGHT_PANEL_W - estimatedW - 8;
  const left = Math.max(
    LEFT_PANEL_W + 8,
    Math.min(info.bounds.x + info.bounds.w / 2 - estimatedW / 2, maxLeft)
  );

  return (
    <div
      style={{
        position: 'fixed',
        top,
        left,
        zIndex: 1000,
        height: TOOLBAR_H,
        backgroundColor: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
        padding: '0 12px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        userSelect: 'none',
        pointerEvents: 'auto',
      }}
    >
      {/* Fill color */}
      {showFill && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <Label>Заливка</Label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <ColorPicker
                value={fill.startsWith('#') ? fill : '#ffffff'}
                onChange={(hex) => { setFill(hex); onApply({ fill: hex }); }}
              />
              <button
                onClick={() => { setFill('transparent'); onApply({ fill: 'transparent' }); }}
                title="Прозрачная заливка"
                style={{
                  width: 22, height: 22, borderRadius: 4, padding: 0, cursor: 'pointer', flexShrink: 0,
                  border: fill === 'transparent' ? '2px solid #4f46e5' : '1.5px solid #d1d5db',
                  background: 'white',
                  backgroundImage: 'linear-gradient(45deg,#ccc 25%,transparent 25%),linear-gradient(-45deg,#ccc 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#ccc 75%),linear-gradient(-45deg,transparent 75%,#ccc 75%)',
                  backgroundSize: '6px 6px',
                  backgroundPosition: '0 0,0 3px,3px -3px,-3px 0',
                }}
              />
            </div>
          </div>
          <Divider />
        </>
      )}

      {/* Text color */}
      {showFontSize && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <Label>Цвет текста</Label>
            <ColorPicker
              value={fill.startsWith('#') ? fill : '#1a1a2e'}
              onChange={(hex) => { setFill(hex); onApply({ fill: hex }); }}
            />
          </div>
          <Divider />
        </>
      )}

      {/* Stroke color */}
      {showStroke && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <Label>Контур</Label>
            <ColorPicker
              value={stroke.startsWith('#') ? stroke : '#1a1a2e'}
              onChange={(hex) => { setStroke(hex); onApply({ stroke: hex }); }}
            />
          </div>
          <Divider />
        </>
      )}

      {/* Stroke width */}
      {showStroke && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <Label>Толщина</Label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
                type="range" min={1} max={24} value={sw}
                onChange={(e) => { const v = Number(e.target.value); setSw(v); onApply({ strokeWidth: v }); }}
                style={{ width: 64, accentColor: '#4f46e5', margin: 0, cursor: 'pointer' }}
              />
              <span style={{ fontSize: 11, color: '#6b7280', minWidth: 18, fontFamily: 'monospace', textAlign: 'right' }}>{sw}</span>
            </div>
          </div>
          <Divider />
        </>
      )}

      {/* Font size */}
      {showFontSize && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <Label>Размер</Label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
                type="range" min={8} max={72} value={fs}
                onChange={(e) => { const v = Number(e.target.value); setFs(v); onApply({ fontSize: v }); }}
                style={{ width: 64, accentColor: '#4f46e5', margin: 0, cursor: 'pointer' }}
              />
              <span style={{ fontSize: 11, color: '#6b7280', minWidth: 18, fontFamily: 'monospace', textAlign: 'right' }}>{fs}</span>
            </div>
          </div>
          <Divider />
        </>
      )}

      {/* Delete */}
      <button
        onClick={onDelete}
        title="Удалить (Del)"
        style={{
          width: 30, height: 30, borderRadius: 7, padding: 0, flexShrink: 0,
          border: '1px solid #fca5a5', backgroundColor: '#fff0f0',
          color: '#dc2626', cursor: 'pointer', fontSize: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background-color 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fee2e2')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#fff0f0')}
      >
        🗑
      </button>
    </div>
  );
}
