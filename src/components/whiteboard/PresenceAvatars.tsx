'use client';

import type { PresenceUser } from '@/lib/boardPresence';

// Инициалы для аватара: одно слово → первая буква, два и больше → первые буквы
// первого и последнего слова.
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const avatar = (bg: string, overlap: boolean): React.CSSProperties => ({
  width: 30,
  height: 30,
  borderRadius: '50%',
  backgroundColor: bg,
  border: '2px solid white',
  boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
  marginLeft: overlap ? -8 : 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'white',
  fontSize: 12,
  fontWeight: 700,
  lineHeight: 1,
  userSelect: 'none',
  flexShrink: 0,
});

const MAX_VISIBLE = 4;

// Стек аватаров пользователей, которые сейчас на доске. Текущий пользователь
// идёт первым. Если ты на доске один — ничего не показываем.
export default function PresenceAvatars({
  users,
  currentUserId,
}: {
  users: PresenceUser[];
  currentUserId: number;
}) {
  const others = users.filter((u) => u.id !== currentUserId);
  if (others.length === 0) return null;

  const self = users.find((u) => u.id === currentUserId);
  const ordered = self ? [self, ...others] : others;

  const visible = ordered.slice(0, MAX_VISIBLE);
  const overflow = ordered.length - visible.length;

  return (
    <div
      style={{ display: 'flex', alignItems: 'center' }}
      title={`Сейчас на доске: ${ordered.length}`}
    >
      {visible.map((u, i) => {
        const isSelf = u.id === currentUserId;
        return (
          <div
            key={u.id}
            title={isSelf ? `${u.name} (вы)` : u.name}
            style={avatar(u.color, i > 0)}
          >
            {initials(u.name)}
          </div>
        );
      })}
      {overflow > 0 && (
        <div style={avatar('#6b7280', true)} title={`Ещё ${overflow}`}>
          +{overflow}
        </div>
      )}
    </div>
  );
}
