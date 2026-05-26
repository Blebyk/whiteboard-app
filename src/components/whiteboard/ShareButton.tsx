'use client';

import { useState, useRef, useEffect } from 'react';

type Role = 'editor' | 'viewer';

interface SharedUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  created_at: string;
}

interface ShareButtonProps {
  boardId: number;
}

const ROLE_LABEL: Record<Role, string> = { editor: 'Редактор', viewer: 'Зритель' };
const ROLE_COLOR: Record<Role, { bg: string; text: string }> = {
  editor: { bg: '#eef2ff', text: '#4f46e5' },
  viewer: { bg: '#f3f4f6', text: '#6b7280' },
};

export default function ShareButton({ boardId }: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('editor');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [users, setUsers] = useState<SharedUser[] | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setError('');
        setSuccess('');
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setLoadingList(true);
    fetch(`/api/boards/${boardId}/share`)
      .then((r) => r.json())
      .then((d) => setUsers(d.users || []))
      .catch(() => setUsers([]))
      .finally(() => setLoadingList(false));
  }, [open, boardId]);

  async function handleShare(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    const trimmed = email.trim();
    if (!trimmed) { setError('Введите email'); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/boards/${boardId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed, role }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Не удалось поделиться'); return; }
      setSuccess(`Доступ выдан: ${data.user.name}`);
      setEmail('');
      setUsers((prev) =>
        prev
          ? [{ ...data.user, created_at: new Date().toISOString() }, ...prev.filter((u) => u.id !== data.user.id)]
          : null
      );
    } catch {
      setError('Ошибка подключения к серверу');
    } finally {
      setSubmitting(false);
    }
  }

  async function changeRole(userId: number, newRole: Role) {
    try {
      const res = await fetch(`/api/boards/${boardId}/share`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole }),
      });
      if (res.ok) {
        setUsers((prev) => prev ? prev.map((u) => u.id === userId ? { ...u, role: newRole } : u) : null);
      }
    } catch {/* ignore */}
  }

  async function revoke(userId: number) {
    try {
      const res = await fetch(`/api/boards/${boardId}/share?userId=${userId}`, { method: 'DELETE' });
      if (res.ok) setUsers((prev) => prev ? prev.filter((u) => u.id !== userId) : null);
    } catch {/* ignore */}
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Поделиться доской"
        style={{
          padding: '6px 14px', borderRadius: 7,
          border: '1px solid #4f46e5',
          backgroundColor: open ? '#eef2ff' : '#4f46e5',
          color: open ? '#4f46e5' : '#ffffff',
          cursor: 'pointer', fontSize: 13, fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 6,
          transition: 'all 0.15s', lineHeight: 1, fontFamily: 'inherit',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
        Поделиться
      </button>

      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 8px)',
          width: 360, backgroundColor: 'white',
          border: '1px solid #e5e7eb', borderRadius: 12,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: 16, zIndex: 200,
        }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>
            Поделиться доской
          </h3>

          {/* Role picker */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {(['editor', 'viewer'] as Role[]).map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                style={{
                  flex: 1, padding: '7px 0', borderRadius: 7, fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                  border: role === r ? '2px solid #4f46e5' : '2px solid #e5e7eb',
                  backgroundColor: role === r ? '#eef2ff' : 'white',
                  color: role === r ? '#4f46e5' : '#6b7280',
                }}
              >
                {ROLE_LABEL[r]}
              </button>
            ))}
          </div>

          <div style={{
            fontSize: 11, color: '#9ca3af', marginBottom: 10, padding: '0 2px',
          }}>
            {role === 'editor'
              ? 'Может рисовать и редактировать доску'
              : 'Может только просматривать доску'}
          </div>

          <form onSubmit={handleShare}>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email пользователя"
                disabled={submitting}
                autoFocus
                style={{
                  flex: 1, padding: '8px 12px',
                  border: '1.5px solid #ddd', borderRadius: 7,
                  fontSize: 13, outline: 'none', fontFamily: 'inherit', color: '#1a1a2e',
                  transition: 'border-color 0.15s',
                }}
                onFocus={(e) => (e.target.style.borderColor = '#4f46e5')}
                onBlur={(e) => (e.target.style.borderColor = '#ddd')}
              />
              <button
                type="submit"
                disabled={submitting || !email.trim()}
                style={{
                  padding: '8px 14px', borderRadius: 7, border: 'none',
                  backgroundColor: submitting || !email.trim() ? '#a5b4fc' : '#4f46e5',
                  color: 'white', fontSize: 13, fontWeight: 600,
                  cursor: submitting || !email.trim() ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {submitting ? '...' : 'Добавить'}
              </button>
            </div>
          </form>

          {error && (
            <div style={{ marginTop: 10, padding: '8px 10px', fontSize: 12, color: '#dc2626', backgroundColor: '#fff0f0', border: '1px solid #fca5a5', borderRadius: 6 }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{ marginTop: 10, padding: '8px 10px', fontSize: 12, color: '#16a34a', backgroundColor: '#e8f5e9', border: '1px solid #86efac', borderRadius: 6 }}>
              {success}
            </div>
          )}

          {/* Existing shares */}
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Доступ есть у
            </div>
            {loadingList ? (
              <div style={{ fontSize: 12, color: '#9ca3af' }}>Загрузка...</div>
            ) : users && users.length > 0 ? (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: 200, overflowY: 'auto' }}>
                {users.map((u) => (
                  <li key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, color: '#1a1a2e', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {u.name}
                      </div>
                      <div style={{ fontSize: 11, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {u.email}
                      </div>
                    </div>

                    {/* Role toggle */}
                    <button
                      onClick={() => changeRole(u.id, u.role === 'editor' ? 'viewer' : 'editor')}
                      title={`Сменить роль на ${u.role === 'editor' ? 'Зритель' : 'Редактор'}`}
                      style={{
                        marginLeft: 8, padding: '3px 8px', borderRadius: 5, fontSize: 11, fontWeight: 600,
                        cursor: 'pointer', border: `1px solid ${ROLE_COLOR[u.role].text}`,
                        backgroundColor: ROLE_COLOR[u.role].bg, color: ROLE_COLOR[u.role].text,
                        fontFamily: 'inherit', transition: 'opacity 0.15s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.75')}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                    >
                      {ROLE_LABEL[u.role]}
                    </button>

                    {/* Revoke */}
                    <button
                      onClick={() => revoke(u.id)}
                      title="Убрать доступ"
                      style={{ marginLeft: 6, padding: '4px 8px', border: 'none', background: 'none', color: '#dc2626', fontSize: 12, cursor: 'pointer', borderRadius: 5 }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#fff0f0')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                    >
                      Убрать
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div style={{ fontSize: 12, color: '#9ca3af' }}>Пока никого нет</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
