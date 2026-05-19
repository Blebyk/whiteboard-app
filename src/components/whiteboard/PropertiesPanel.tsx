'use client';

import { useState } from 'react';
import type { Tool } from './Canvas';

interface Props {
  tool: Tool;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  fontSize: number;
  bgStyle: 'none' | 'grid' | 'dots';
  hasSelection: boolean;
  onStrokeColorChange(c: string): void;
  onFillColorChange(c: string): void;
  onStrokeWidthChange(n: number): void;
  onFontSizeChange(n: number): void;
  onBgStyleChange(s: 'none' | 'grid' | 'dots'): void;
  onDelete(): void;
}

const STROKE_COLORS = [
  '#1a1a2e', '#374151', '#dc2626', '#ea580c',
  '#ca8a04', '#16a34a', '#2563eb', '#7c3aed',
  '#db2777', '#ffffff',
];

const FILL_COLORS = [
  'transparent',
  '#ffffff', '#f3f4f6', '#fef2f2',
  '#fff7ed', '#fefce8', '#f0fdf4',
  '#eff6ff', '#f5f3ff', '#fdf2f8',
  '#FFF176', '#80D8FF', '#CCFF90', '#FFD180',
];

function ColorSwatch({
  color,
  active,
  onClick,
}: {
  color: string;
  active: boolean;
  onClick(): void;
}) {
  return (
    <button
      onClick={onClick}
      title={color === 'transparent' ? 'Без заливки' : color}
      style={{
        width: '22px',
        height: '22px',
        borderRadius: '5px',
        border: active ? '2.5px solid #4f46e5' : '1.5px solid #ddd',
        cursor: 'pointer',
        backgroundColor: color === 'transparent' ? 'white' : color,
        backgroundImage:
          color === 'transparent'
            ? 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)'
            : undefined,
        backgroundSize: color === 'transparent' ? '8px 8px' : undefined,
        backgroundPosition:
          color === 'transparent' ? '0 0, 0 4px, 4px -4px, -4px 0px' : undefined,
        flexShrink: 0,
        boxShadow: active ? '0 0 0 1px #4f46e5' : undefined,
        outline: 'none',
      }}
    />
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {title}
      </p>
      {children}
    </div>
  );
}

const SHOW_FONT_TOOLS: Tool[] = ['text', 'sticky'];
const SHOW_FILL_TOOLS: Tool[] = ['rect', 'ellipse', 'triangle', 'diamond', 'select'];

export default function PropertiesPanel({
  tool,
  strokeColor,
  fillColor,
  strokeWidth,
  fontSize,
  bgStyle,
  hasSelection,
  onStrokeColorChange,
  onFillColorChange,
  onStrokeWidthChange,
  onFontSizeChange,
  onBgStyleChange,
  onDelete,
}: Props) {
  const [strokeCustom, setStrokeCustom] = useState(strokeColor);
  const [fillCustom, setFillCustom] = useState(fillColor === 'transparent' ? '#ffffff' : fillColor);

  const showFill = SHOW_FILL_TOOLS.includes(tool) || hasSelection;
  const showFont = SHOW_FONT_TOOLS.includes(tool);
  const showStroke = tool !== 'image' && tool !== 'pan' && tool !== 'select';

  return (
    <div
      style={{
        width: '200px',
        backgroundColor: 'white',
        borderLeft: '1px solid #e5e7eb',
        padding: '16px 14px',
        overflowY: 'auto',
        flexShrink: 0,
        fontSize: '13px',
        color: '#374151',
        boxShadow: '-2px 0 8px rgba(0,0,0,0.04)',
      }}
    >
      {/* ── Stroke color ── */}
      {showStroke && (
        <Section title="Цвет контура">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '8px' }}>
            {STROKE_COLORS.map((c) => (
              <ColorSwatch
                key={c}
                color={c}
                active={strokeColor === c}
                onClick={() => onStrokeColorChange(c)}
              />
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input
              type="color"
              value={strokeCustom}
              onChange={(e) => {
                setStrokeCustom(e.target.value);
                onStrokeColorChange(e.target.value);
              }}
              style={{ width: '28px', height: '28px', border: '1.5px solid #ddd', borderRadius: '6px', cursor: 'pointer', padding: '1px' }}
            />
            <span style={{ fontSize: '11px', color: '#9ca3af', fontFamily: 'monospace' }}>
              {strokeColor.toUpperCase()}
            </span>
          </div>
        </Section>
      )}

      {/* ── Fill color ── */}
      {showFill && (
        <Section title="Заливка">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '8px' }}>
            {FILL_COLORS.map((c) => (
              <ColorSwatch
                key={c}
                color={c}
                active={fillColor === c}
                onClick={() => onFillColorChange(c)}
              />
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input
              type="color"
              value={fillCustom}
              onChange={(e) => {
                setFillCustom(e.target.value);
                onFillColorChange(e.target.value);
              }}
              style={{ width: '28px', height: '28px', border: '1.5px solid #ddd', borderRadius: '6px', cursor: 'pointer', padding: '1px' }}
            />
            <span style={{ fontSize: '11px', color: '#9ca3af', fontFamily: 'monospace' }}>
              {fillColor === 'transparent' ? 'ПРОЗРАЧНО' : fillColor.toUpperCase()}
            </span>
          </div>
        </Section>
      )}

      {/* ── Stroke width ── */}
      {showStroke && (
        <Section title={`Толщина: ${strokeWidth}px`}>
          <input
            type="range"
            min="1"
            max="24"
            value={strokeWidth}
            onChange={(e) => onStrokeWidthChange(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#4f46e5' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#9ca3af', marginTop: '2px' }}>
            <span>1</span><span>24</span>
          </div>
        </Section>
      )}

      {/* ── Font size ── */}
      {showFont && (
        <Section title={`Размер шрифта: ${fontSize}px`}>
          <input
            type="range"
            min="8"
            max="72"
            value={fontSize}
            onChange={(e) => onFontSizeChange(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#4f46e5' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#9ca3af', marginTop: '2px' }}>
            <span>8</span><span>72</span>
          </div>
        </Section>
      )}

      {/* ── Background ── */}
      <Section title="Фон доски">
        <div style={{ display: 'flex', gap: '6px' }}>
          {(['none', 'dots', 'grid'] as const).map((s) => (
            <button
              key={s}
              onClick={() => onBgStyleChange(s)}
              title={s === 'none' ? 'Чистый' : s === 'dots' ? 'Точки' : 'Сетка'}
              style={{
                flex: 1,
                padding: '6px 4px',
                borderRadius: '7px',
                border: bgStyle === s ? '2px solid #4f46e5' : '1.5px solid #e5e7eb',
                backgroundColor: bgStyle === s ? '#eef2ff' : 'white',
                cursor: 'pointer',
                fontSize: '10px',
                color: bgStyle === s ? '#4f46e5' : '#555',
                fontWeight: bgStyle === s ? 700 : 400,
              }}
            >
              {s === 'none' ? '▭' : s === 'dots' ? '⠿' : '⊞'}
            </button>
          ))}
        </div>
      </Section>

      {/* ── Delete ── */}
      {hasSelection && (
        <Section title="">
          <button
            onClick={onDelete}
            style={{
              width: '100%',
              padding: '8px',
              borderRadius: '8px',
              border: '1.5px solid #fca5a5',
              backgroundColor: '#fff0f0',
              cursor: 'pointer',
              fontSize: '13px',
              color: '#dc2626',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = '#fee2e2')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = '#fff0f0')}
          >
            🗑 Удалить выбранное
          </button>
        </Section>
      )}

      {/* ── Keyboard hints ── */}
      <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '12px', marginTop: '4px' }}>
        <p style={{ margin: '0 0 8px', fontSize: '10px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Горячие клавиши
        </p>
        {[
          ['V', 'Выбор'], ['H', 'Рука'], ['P', 'Карандаш'],
          ['R', 'Прямоугольник'], ['O', 'Эллипс'], ['T', 'Треугольник'],
          ['D', 'Ромб'], ['L', 'Линия'], ['A', 'Стрелка'],
          ['X', 'Текст'], ['S', 'Стикер'], ['E', 'Ластик'],
          ['Ctrl+Z', 'Отмена'], ['Ctrl+Y', 'Повтор'], ['Del', 'Удалить'],
        ].map(([k, label]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <kbd style={{
              fontSize: '10px', backgroundColor: '#f3f4f6', border: '1px solid #e5e7eb',
              borderRadius: '4px', padding: '1px 5px', color: '#555',
            }}>{k}</kbd>
            <span style={{ fontSize: '10px', color: '#9ca3af' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
