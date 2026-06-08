'use client';

import { useState, useRef, useEffect } from 'react';

interface Props {
  value: string;       // YYYY-MM-DD или ''
  onChange(v: string): void;
  disabled?: boolean;
}

const MONTHS = [
  'Январь','Февраль','Март','Апрель','Май','Июнь',
  'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь',
];
const DAYS = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

function toDisplay(val: string): string {
  if (!val) return '';
  const [y, m, d] = val.split('-');
  return `${d} / ${m} / ${y}`;
}

function toStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function todayStr(): string {
  const t = new Date();
  return toStr(t.getFullYear(), t.getMonth(), t.getDate());
}

export default function DatePicker({ value, onChange, disabled }: Props) {
  const today = todayStr();

  const initYear  = value ? parseInt(value.split('-')[0]) : new Date().getFullYear();
  const initMonth = value ? parseInt(value.split('-')[1]) - 1 : new Date().getMonth();

  const [open, setOpen]           = useState(false);
  const [dropUp, setDropUp]       = useState(false);
  const [viewYear, setViewYear]   = useState(initYear);
  const [viewMonth, setViewMonth] = useState(initMonth);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) {
      setViewYear(parseInt(value.split('-')[0]));
      setViewMonth(parseInt(value.split('-')[1]) - 1);
    }
  }, [value]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function handleToggle() {
    if (disabled) return;
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      // Высота дропдауна ~320px; если снизу меньше — открываем вверх
      setDropUp(window.innerHeight - rect.bottom < 340);
    }
    setOpen((o) => !o);
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  }

  function selectDay(day: number) {
    onChange(toStr(viewYear, viewMonth, day));
    setOpen(false);
  }

  const daysInMonth  = new Date(viewYear, viewMonth + 1, 0).getDate();
  // offset so Monday = column 0
  const firstDow     = new Date(viewYear, viewMonth, 1).getDay();
  const startOffset  = (firstDow + 6) % 7;

  return (
    <div ref={containerRef} style={{ position: 'relative', fontFamily: 'Arial, sans-serif' }}>
      {/* ── Trigger ── */}
      <div
        ref={triggerRef}
        onClick={handleToggle}
        style={{
          width: '100%', padding: '10px 12px',
          border: `1.5px solid ${open ? '#6366f1' : '#e5e7eb'}`,
          borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box',
          color: value ? '#1a1a2e' : '#9ca3af',
          backgroundColor: disabled ? '#f9fafb' : 'white',
          cursor: disabled ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          userSelect: 'none',
          boxShadow: open ? '0 0 0 3px #ede9fe' : 'none',
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
      >
        <span>{value ? toDisplay(value) : 'дд / мм / гггг'}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke={open ? '#6366f1' : '#9ca3af'} strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8"  y1="2" x2="8"  y2="6" />
          <line x1="3"  y1="10" x2="21" y2="10" />
        </svg>
      </div>

      {/* ── Calendar dropdown ── */}
      {open && !disabled && (
        <div style={{
          position: 'absolute',
          top:    dropUp ? 'auto' : 'calc(100% + 6px)',
          bottom: dropUp ? 'calc(100% + 6px)' : 'auto',
          left: 0, zIndex: 500,
          backgroundColor: 'white', border: '1.5px solid #e5e7eb',
          borderRadius: '14px', boxShadow: '0 8px 32px rgba(0,0,0,0.13)',
          padding: '16px', width: '264px',
        }}>
          {/* Month / year nav */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <button onClick={prevMonth} style={navBtn}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#1a1a2e' }}>
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button onClick={nextMonth} style={navBtn}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>

          {/* Weekday headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: '4px' }}>
            {DAYS.map((d) => (
              <div key={d} style={{
                textAlign: 'center', fontSize: '11px', fontWeight: 700,
                color: '#9ca3af', padding: '3px 0',
              }}>{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
            {Array.from({ length: startOffset }).map((_, i) => <div key={`e${i}`} />)}

            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
              const ds        = toStr(viewYear, viewMonth, day);
              const isSelected = ds === value;
              const isToday    = ds === today;

              return (
                <button
                  key={day}
                  onClick={() => selectDay(day)}
                  style={{
                    width: '100%', aspectRatio: '1',
                    border: isToday && !isSelected ? '1.5px solid #c7d2fe' : 'none',
                    borderRadius: '8px', fontSize: '13px', lineHeight: 1,
                    cursor: 'pointer',
                    fontWeight: isSelected || isToday ? 700 : 400,
                    backgroundColor: isSelected ? '#4f46e5' : 'transparent',
                    color: isSelected ? 'white' : isToday ? '#4f46e5' : '#374151',
                    transition: 'background 0.1s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected)
                      (e.currentTarget as HTMLElement).style.backgroundColor = '#f5f3ff';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected)
                      (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                  }}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #f3f4f6', display: 'flex', gap: '8px' }}>
            <button
              onClick={() => { onChange(today); setOpen(false); }}
              style={{
                flex: 1, padding: '7px', border: '1.5px solid #c7d2fe',
                borderRadius: '8px', background: '#f5f3ff', cursor: 'pointer',
                fontSize: '12px', fontWeight: 700, color: '#4f46e5',
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = '#ede9fe')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = '#f5f3ff')}
            >Сегодня</button>
            {value && (
              <button
                onClick={() => { onChange(''); setOpen(false); }}
                style={{
                  flex: 1, padding: '7px', border: '1.5px solid #e5e7eb',
                  borderRadius: '8px', background: 'white', cursor: 'pointer',
                  fontSize: '12px', fontWeight: 600, color: '#6b7280',
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = '#f9fafb')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'white')}
              >Очистить</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const navBtn: React.CSSProperties = {
  width: '28px', height: '28px', border: '1.5px solid #e5e7eb',
  borderRadius: '8px', background: 'white', cursor: 'pointer',
  color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 0,
};
