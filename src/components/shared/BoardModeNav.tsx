'use client';

import Link from 'next/link';

export type BoardMode = 'board' | 'kanban' | 'analytics';

const IC = ({ d }: { d: React.ReactNode }) => (
  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
);

const TABS: { mode: BoardMode; label: string; path: (id: number) => string; icon: React.ReactNode }[] = [
  {
    mode: 'board',
    label: 'Доска',
    path: (id) => `/board/${id}`,
    icon: <IC d={<><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18" /></>} />,
  },
  {
    mode: 'kanban',
    label: 'Канбан',
    path: (id) => `/board/${id}/kanban`,
    icon: <IC d={<><rect x="3" y="3" width="7" height="18" rx="1" /><rect x="14" y="3" width="7" height="10" rx="1" /><rect x="14" y="17" width="7" height="4" rx="1" /></>} />,
  },
  {
    mode: 'analytics',
    label: 'Аналитика',
    path: (id) => `/board/${id}/analytics`,
    icon: <IC d={<><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>} />,
  },
];

// Единая навигация между режимами доски (Доска / Канбан / Аналитика).
// Активная вкладка подсвечена и некликабельна. Используется и в шапке доски, и на
// страницах канбана/аналитики, чтобы интерфейс был одинаковым.
export default function BoardModeNav({ boardId, active, compact = false }: { boardId: number; active: BoardMode; compact?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      {TABS.map((t) => {
        const isActive = t.mode === active;
        return (
          <Link
            key={t.mode}
            href={t.path(boardId)}
            title={t.label}
            aria-current={isActive ? 'page' : undefined}
            style={{
              padding: compact ? '8px' : '6px 11px',
              borderRadius: '7px',
              border: `1px solid ${isActive ? '#c7d2fe' : '#e5e7eb'}`,
              backgroundColor: isActive ? '#eef2ff' : 'white',
              color: isActive ? '#4f46e5' : '#374151',
              fontWeight: isActive ? 700 : 400,
              fontSize: '13px',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: compact ? 0 : '5px',
              lineHeight: 1,
              cursor: isActive ? 'default' : 'pointer',
              pointerEvents: isActive ? 'none' : 'auto',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = '#f5f5f5'; }}
            onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = 'white'; }}
          >
            {t.icon}
            {!compact && t.label}
          </Link>
        );
      })}
    </div>
  );
}
