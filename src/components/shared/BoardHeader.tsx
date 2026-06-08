'use client';

import Link from 'next/link';
import ShareButton from '../whiteboard/ShareButton';
import PresenceAvatars from '../whiteboard/PresenceAvatars';
import BoardModeNav, { type BoardMode } from './BoardModeNav';
import type { PresenceUser } from '@/lib/boardPresence';
import { useIsMobile } from '@/lib/useIsMobile';

interface Props {
  boardId: number;
  boardName: string;
  active: BoardMode;
  currentUserId: number;
  isOwner?: boolean;
  canEdit?: boolean;
  presence?: PresenceUser[];
  /** Действия конкретной страницы (справа, после «Поделиться»). */
  children?: React.ReactNode;
}

// Единая шапка для страниц доски: канбан и аналитика выглядят так же, как доска
// (та же высота/стиль, навигация по режимам, presence-аватары, «Поделиться»).
export default function BoardHeader({
  boardId,
  boardName,
  active,
  currentUserId,
  isOwner = false,
  canEdit = true,
  presence = [],
  children,
}: Props) {
  const isMobile = useIsMobile();

  return (
    <header
      style={{
        height: '52px',
        backgroundColor: 'white',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        alignItems: 'center',
        padding: isMobile ? '0 8px' : '0 12px',
        gap: isMobile ? '6px' : '8px',
        flexShrink: 0,
        zIndex: 20,
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}
    >
      {/* ── Слева: назад + имя доски ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '8px', flex: isMobile ? '1 1 auto' : '0 0 auto', minWidth: 0 }}>
        <Link
          href="/dashboard"
          title="На дашборд"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '34px', height: '34px', borderRadius: '8px', flexShrink: 0,
            border: '1px solid #e5e7eb', color: '#555',
            textDecoration: 'none', fontSize: '16px', transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = '#f5f5f5')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
        >
          ←
        </Link>

        <span style={{
          fontSize: '15px', fontWeight: 700, color: '#1a1a2e',
          padding: '3px 6px', maxWidth: isMobile ? 'none' : '200px',
          minWidth: 0, flex: isMobile ? '1 1 auto' : '0 0 auto',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {boardName}
        </span>

        {!canEdit && !isMobile && (
          <span style={{
            fontSize: '11px', fontWeight: 600, color: '#6b7280',
            backgroundColor: '#f3f4f6', border: '1px solid #e5e7eb',
            borderRadius: '5px', padding: '2px 8px',
          }}>
            Только просмотр
          </span>
        )}
      </div>

      {/* ── Центр: навигация по режимам (на телефоне — компактные иконки) ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: isMobile ? '0 0 auto' : 1, justifyContent: 'center' }}>
        <BoardModeNav boardId={boardId} active={active} compact={isMobile} />
      </div>

      {/* ── Справа: presence + поделиться + действия страницы ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: '0 0 auto' }}>
        {!isMobile && <PresenceAvatars users={presence} currentUserId={currentUserId} />}
        {isOwner && <ShareButton boardId={boardId} compact={isMobile} />}
        {children}
      </div>
    </header>
  );
}
