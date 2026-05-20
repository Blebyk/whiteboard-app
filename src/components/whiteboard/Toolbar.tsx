'use client';

import React, { useRef } from 'react';
import type { Tool } from './Canvas';

interface ToolbarProps {
  tool: Tool;
  onToolChange(t: Tool): void;
  onImageUpload(e: React.ChangeEvent<HTMLInputElement>): void;
}

interface ToolDef {
  id: Tool;
  label: string;
  shortcut: string;
  icon: React.ReactNode;
}

const IC = ({ children, size = 20 }: { children: React.ReactNode; size?: number }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </svg>
);

const TOOLS: ToolDef[] = [
  {
    id: 'select',
    label: 'Выбор',
    shortcut: 'V',
    icon: <IC><path d="M5 3l14 9-7 1-4 6z" /></IC>,
  },
  {
    id: 'pan',
    label: 'Рука',
    shortcut: 'H',
    icon: (
      <IC>
        <path d="M18 11V6a2 2 0 0 0-4 0v1M14 7V4a2 2 0 0 0-4 0v3M10 7.5V6a2 2 0 0 0-4 0v6" />
        <path d="M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
      </IC>
    ),
  },
  {
    id: 'pencil',
    label: 'Карандаш',
    shortcut: 'P',
    icon: (
      <IC>
        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
      </IC>
    ),
  },
  {
    id: 'rect',
    label: 'Прямоугольник',
    shortcut: 'R',
    icon: <IC><rect x="3" y="3" width="18" height="18" rx="2" /></IC>,
  },
  {
    id: 'ellipse',
    label: 'Эллипс',
    shortcut: 'O',
    icon: <IC><ellipse cx="12" cy="12" rx="10" ry="7" /></IC>,
  },
  {
    id: 'triangle',
    label: 'Треугольник',
    shortcut: 'T',
    icon: <IC><polygon points="12 2 22 21 2 21" /></IC>,
  },
  {
    id: 'diamond',
    label: 'Ромб',
    shortcut: 'D',
    icon: <IC><polygon points="12 2 22 12 12 22 2 12" /></IC>,
  },
  {
    id: 'line',
    label: 'Линия',
    shortcut: 'L',
    icon: <IC><line x1="4" y1="20" x2="20" y2="4" /></IC>,
  },
  {
    id: 'arrow',
    label: 'Стрелка',
    shortcut: 'A',
    icon: (
      <IC>
        <line x1="5" y1="19" x2="19" y2="5" />
        <polyline points="9 5 19 5 19 15" />
      </IC>
    ),
  },
  {
    id: 'text',
    label: 'Текст',
    shortcut: 'X',
    icon: (
      <IC>
        <polyline points="4 7 4 4 20 4 20 7" />
        <line x1="9" y1="20" x2="15" y2="20" />
        <line x1="12" y1="4" x2="12" y2="20" />
      </IC>
    ),
  },
  {
    id: 'sticky',
    label: 'Стикер',
    shortcut: 'S',
    icon: (
      <IC>
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="8" y1="13" x2="16" y2="13" />
        <line x1="8" y1="17" x2="12" y2="17" />
      </IC>
    ),
  },
  {
    id: 'eraser',
    label: 'Ластик',
    shortcut: 'E',
    icon: (
      <IC>
        <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
        <path d="M22 21H7" />
        <path d="m5 11 9 9" />
      </IC>
    ),
  },
  {
    id: 'image',
    label: 'Изображение',
    shortcut: 'I',
    icon: (
      <IC>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </IC>
    ),
  },
];

const DIVIDER_AFTER: Tool[] = ['pan', 'pencil', 'arrow', 'sticky'];

export default function Toolbar({ tool, onToolChange, onImageUpload }: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      style={{
        width: '56px',
        backgroundColor: 'white',
        borderRight: '1px solid #e5e7eb',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '8px 0',
        gap: '2px',
        userSelect: 'none',
        overflowY: 'auto',
        flexShrink: 0,
        boxShadow: '2px 0 8px rgba(0,0,0,0.04)',
      }}
    >
      {TOOLS.map((t) => {
        const isActive = tool === t.id;
        return (
          <React.Fragment key={t.id}>
            <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
              <button
                onClick={() => {
                  if (t.id === 'image') {
                    fileInputRef.current?.click();
                    return;
                  }
                  onToolChange(t.id);
                }}
                title={`${t.label} (${t.shortcut})`}
                style={{
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: isActive ? '#eef2ff' : 'transparent',
                  color: isActive ? '#4f46e5' : '#555',
                  transition: 'all 0.15s',
                  outline: isActive ? '2px solid #c7d2fe' : 'none',
                  outlineOffset: '1px',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.backgroundColor = '#f5f5f5';
                    (e.currentTarget as HTMLElement).style.color = '#333';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                    (e.currentTarget as HTMLElement).style.color = '#555';
                  }
                }}
              >
                {t.icon}
              </button>
            </div>
            {DIVIDER_AFTER.includes(t.id) && (
              <div
                style={{
                  width: '32px',
                  height: '1px',
                  backgroundColor: '#e5e7eb',
                  margin: '4px 0',
                }}
              />
            )}
          </React.Fragment>
        );
      })}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          onImageUpload(e);
          onToolChange('select');
        }}
      />
    </div>
  );
}
