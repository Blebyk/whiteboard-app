'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import ShareButton from './ShareButton';

interface TopBarProps {
  boardId: number;
  boardName: string;
  isOwner: boolean;
  saveStatus: 'saved' | 'saving' | 'unsaved';
  zoom: number;
  canUndo: boolean;
  canRedo: boolean;
  hasSelection: boolean;
  onRename(name: string): void;
  onSave(): void;
  onUndo(): void;
  onRedo(): void;
  onZoomIn(): void;
  onZoomOut(): void;
  onFitToScreen(): void;
  onExportPNG(): void;
  onClear(): void;
  onDelete(): void;
}

const Btn = ({
  onClick,
  disabled,
  title,
  children,
  danger,
}: {
  onClick(): void;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
  danger?: boolean;
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    style={{
      padding: '6px 10px',
      borderRadius: '7px',
      border: '1px solid #e5e7eb',
      backgroundColor: 'white',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.4 : 1,
      fontSize: '13px',
      color: danger ? '#dc2626' : '#374151',
      display: 'flex',
      alignItems: 'center',
      gap: '5px',
      transition: 'all 0.15s',
      lineHeight: 1,
    }}
    onMouseEnter={(e) => {
      if (!disabled) {
        (e.currentTarget as HTMLElement).style.backgroundColor = danger ? '#fff0f0' : '#f5f5f5';
      }
    }}
    onMouseLeave={(e) => {
      (e.currentTarget as HTMLElement).style.backgroundColor = 'white';
    }}
  >
    {children}
  </button>
);

const IC = ({ d, size = 16 }: { d: React.ReactNode; size?: number }) => (
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
    {d}
  </svg>
);

export default function TopBar({
  boardId,
  boardName,
  isOwner,
  saveStatus,
  zoom,
  canUndo,
  canRedo,
  hasSelection,
  onRename,
  onSave,
  onUndo,
  onRedo,
  onZoomIn,
  onZoomOut,
  onFitToScreen,
  onExportPNG,
  onClear,
  onDelete,
}: TopBarProps) {
  const [editing, setEditing] = useState(false);
  const [nameVal, setNameVal] = useState(boardName);
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setNameVal(boardName), [boardName]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function commitRename() {
    setEditing(false);
    const trimmed = nameVal.trim() || 'Без названия';
    setNameVal(trimmed);
    if (trimmed !== boardName) onRename(trimmed);
  }

  const saveLabel =
    saveStatus === 'saving'
      ? 'Сохранение...'
      : saveStatus === 'saved'
      ? 'Сохранено'
      : 'Не сохранено';

  const saveColor =
    saveStatus === 'saving' ? '#6b7280' : saveStatus === 'saved' ? '#16a34a' : '#d97706';

  return (
    <header
      style={{
        height: '52px',
        backgroundColor: 'white',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        gap: '8px',
        flexShrink: 0,
        zIndex: 20,
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}
    >
      {/* ── Left: Back + Board name ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '0 0 auto' }}>
        <Link
          href="/dashboard"
          title="На дашборд"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '34px',
            height: '34px',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            color: '#555',
            textDecoration: 'none',
            fontSize: '16px',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = '#f5f5f5')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
        >
          ←
        </Link>

        {editing ? (
          <input
            ref={inputRef}
            value={nameVal}
            onChange={(e) => setNameVal(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') { setEditing(false); setNameVal(boardName); }
            }}
            style={{
              fontSize: '15px',
              fontWeight: 700,
              color: '#1a1a2e',
              border: '2px solid #6366f1',
              borderRadius: '6px',
              padding: '3px 8px',
              outline: 'none',
              minWidth: '120px',
              maxWidth: '240px',
            }}
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            title="Переименовать"
            style={{
              fontSize: '15px',
              fontWeight: 700,
              color: '#1a1a2e',
              background: 'none',
              border: 'none',
              cursor: 'text',
              padding: '3px 6px',
              borderRadius: '6px',
              maxWidth: '200px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = '#f5f5f5')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'none')}
          >
            {nameVal}
          </button>
        )}

        <span style={{ fontSize: '12px', color: saveColor, fontWeight: 500, minWidth: '100px' }}>
          {saveLabel}
        </span>
      </div>

      {/* ── Center: Undo / Redo + Delete ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, justifyContent: 'center' }}>
        <Btn onClick={onUndo} disabled={!canUndo} title="Отменить (Ctrl+Z)">
          <IC d={<><polyline points="9 14 4 9 9 4" /><path d="M20 20v-7a4 4 0 0 0-4-4H4" /></>} />
          Отмена
        </Btn>
        <Btn onClick={onRedo} disabled={!canRedo} title="Повторить (Ctrl+Y)">
          Повтор
          <IC d={<><polyline points="15 14 20 9 15 4" /><path d="M4 20v-7a4 4 0 0 1 4-4h12" /></>} />
        </Btn>
        {hasSelection && (
          <Btn onClick={onDelete} danger title="Удалить выбранное (Delete)">
            <IC d={<><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></>} />
            Удалить
          </Btn>
        )}
      </div>

      {/* ── Right: Zoom + Actions ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: '0 0 auto' }}>
        {/* Zoom controls */}
        <div style={{
          display: 'flex', alignItems: 'center',
          border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden',
        }}>
          <button
            onClick={onZoomOut}
            title="Уменьшить (Ctrl+-)"
            style={{ padding: '6px 9px', border: 'none', background: 'white', cursor: 'pointer', fontSize: '16px', color: '#555' }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = '#f5f5f5')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'white')}
          >−</button>
          <button
            onClick={onFitToScreen}
            title="По экрану"
            style={{ padding: '6px 8px', border: 'none', borderLeft: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: '#374151', minWidth: '52px' }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = '#f5f5f5')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'white')}
          >{zoom}%</button>
          <button
            onClick={onZoomIn}
            title="Увеличить (Ctrl++)"
            style={{ padding: '6px 9px', border: 'none', background: 'white', cursor: 'pointer', fontSize: '16px', color: '#555' }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = '#f5f5f5')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'white')}
          >+</button>
        </div>

        {/* Share — only the board owner can manage access */}
        {isOwner && <ShareButton boardId={boardId} />}

        {/* Save */}
        <Btn onClick={onSave} title="Сохранить (Ctrl+S)">
          <IC d={<><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></>} />
          Сохранить
        </Btn>

        {/* Menu */}
        <div style={{ position: 'relative' }} ref={menuRef}>
          <Btn onClick={() => setMenuOpen((v) => !v)} title="Ещё">
            <IC d={<><circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" /></>} />
          </Btn>
          {menuOpen && (
            <div style={{
              position: 'absolute', right: 0, top: '110%',
              backgroundColor: 'white', border: '1px solid #e5e7eb',
              borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              zIndex: 100, minWidth: '180px', overflow: 'hidden', padding: '4px',
            }}>
              {[
                { label: 'Экспорт PNG', action: () => { onExportPNG(); setMenuOpen(false); } },
                { label: 'Очистить доску', action: () => { if (confirm('Очистить всё содержимое доски?')) { onClear(); } setMenuOpen(false); }, danger: true },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={item.action}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '9px 14px', border: 'none', background: 'none',
                    cursor: 'pointer', fontSize: '13px',
                    color: (item as any).danger ? '#dc2626' : '#333',
                    borderRadius: '7px',
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = '#f5f5f5')}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'none')}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
