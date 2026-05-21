'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Board {
  id: number;
  name: string;
  thumbnail: string | null;
  created_at: string;
  updated_at: string;
  shared?: number;          // 0 = owned, 1 = shared with me
  ownerName?: string | null; // name of the owner if shared
}

interface User {
  id: number;
  name: string;
  email: string;
}

export default function DashboardClient({ user }: { user: User }) {
  const router = useRouter();
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [menuId, setMenuId] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchBoards();
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuId(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function fetchBoards() {
    try {
      const res = await fetch('/api/boards');
      // Guard against empty response body (e.g., when the server crashed)
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      setBoards(data.boards || []);
    } catch (e) {
      console.error('Failed to load boards:', e);
      setBoards([]);
    } finally {
      setLoading(false);
    }
  }

  async function createBoard() {
    setCreating(true);
    try {
      const res = await fetch('/api/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Без названия' }),
      });
      const data = await res.json();
      router.push(`/board/${data.board.id}`);
    } finally {
      setCreating(false);
    }
  }

  async function deleteBoard(id: number, shared = false) {
    const msg = shared
      ? 'Убрать доску у себя? Доска останется у её владельца.'
      : 'Удалить доску? Это действие нельзя отменить.';
    if (!confirm(msg)) return;
    await fetch(`/api/boards/${id}`, { method: 'DELETE' });
    setBoards((prev) => prev.filter((b) => b.id !== id));
    setMenuId(null);
  }

  async function renameBoard(id: number) {
    if (!renameValue.trim()) return;
    await fetch(`/api/boards/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: renameValue.trim() }),
    });
    setBoards((prev) =>
      prev.map((b) => (b.id === id ? { ...b, name: renameValue.trim() } : b))
    );
    setRenamingId(null);
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f6fa', fontFamily: 'Arial, sans-serif' }}>
      {/* Header */}
      <header style={{
        backgroundColor: 'white',
        borderBottom: '1px solid #e5e7eb',
        padding: '0 32px',
        height: '60px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <span style={{ fontSize: '22px', fontWeight: 800, color: '#1a1a2e', letterSpacing: '-0.01em' }}>Whiteboard</span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '14px', color: '#555' }}>
            {user.name}
          </span>
          <button
            onClick={logout}
            style={{
              padding: '7px 16px',
              backgroundColor: 'transparent',
              border: '1.5px solid #ddd',
              borderRadius: '8px',
              fontSize: '13px',
              cursor: 'pointer',
              color: '#555',
            }}
          >
            Выйти
          </button>
        </div>
      </header>

      {/* Main */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 800, color: '#1a1a2e' }}>
            Мои доски
          </h1>
          <button
            onClick={createBoard}
            disabled={creating}
            style={{
              padding: '10px 22px',
              backgroundColor: '#4f46e5',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: creating ? 'not-allowed' : 'pointer',
              opacity: creating ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span style={{ fontSize: '18px' }}>+</span>
            {creating ? 'Создание...' : 'Новая доска'}
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px', color: '#999' }}>
            Загрузка...
          </div>
        ) : boards.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '80px',
            backgroundColor: 'white',
            borderRadius: '16px',
            border: '2px dashed #e5e7eb',
          }}>
            <div style={{ marginBottom: '16px', color: '#4f46e5', display: 'inline-flex' }}>
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <path d="M9 3v18" />
                <path d="M3 9h18" />
              </svg>
            </div>
            <h3 style={{ color: '#1a1a2e', marginBottom: '8px' }}>У вас ещё нет досок</h3>
            <p style={{ color: '#888', marginBottom: '24px' }}>Создайте первую доску, чтобы начать работу</p>
            <button
              onClick={createBoard}
              style={{
                padding: '12px 28px',
                backgroundColor: '#4f46e5',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontSize: '15px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Создать доску
            </button>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: '20px',
          }}>
            {/* New board card */}
            <div
              onClick={createBoard}
              style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                border: '2px dashed #c7d2fe',
                height: '200px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: creating ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                gap: '8px',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = '#4f46e5';
                (e.currentTarget as HTMLElement).style.backgroundColor = '#f5f3ff';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = '#c7d2fe';
                (e.currentTarget as HTMLElement).style.backgroundColor = 'white';
              }}
            >
              <span style={{ fontSize: '40px', color: '#a5b4fc' }}>+</span>
              <span style={{ fontSize: '14px', color: '#6366f1', fontWeight: 600 }}>Новая доска</span>
            </div>

            {boards.map((board) => (
              <div
                key={board.id}
                style={{
                  backgroundColor: 'white',
                  borderRadius: '12px',
                  border: '1.5px solid #e5e7eb',
                  overflow: 'hidden',
                  transition: 'box-shadow 0.2s',
                  position: 'relative',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.1)')}
                onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
              >
                {/* Thumbnail */}
                <Link href={`/board/${board.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                  <div style={{
                    height: '140px',
                    backgroundColor: '#f8f9ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    position: 'relative',
                    borderBottom: '1px solid #f0f0f0',
                  }}>
                    {board.thumbnail ? (
                      <img
                        src={board.thumbnail}
                        alt={board.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
                        <rect width="18" height="18" x="3" y="3" rx="2" />
                        <path d="M9 3v18" />
                        <path d="M3 9h18" />
                      </svg>
                    )}
                    {/* «Поделено» badge on shared boards */}
                    {board.shared === 1 && (
                      <div style={{
                        position: 'absolute',
                        top: 10,
                        left: 10,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '4px 8px',
                        backgroundColor: 'rgba(79, 70, 229, 0.95)',
                        color: 'white',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: '0.02em',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                      }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="18" cy="5" r="3" />
                          <circle cx="6" cy="12" r="3" />
                          <circle cx="18" cy="19" r="3" />
                          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                        </svg>
                        ПОДЕЛЕНО
                      </div>
                    )}
                  </div>
                </Link>

                {/* Info */}
                <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {renamingId === board.id ? (
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => renameBoard(board.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') renameBoard(board.id);
                          if (e.key === 'Escape') setRenamingId(null);
                        }}
                        style={{
                          width: '100%',
                          border: '1.5px solid #4f46e5',
                          borderRadius: '4px',
                          padding: '2px 6px',
                          fontSize: '14px',
                          outline: 'none',
                        }}
                      />
                    ) : (
                      <p style={{
                        margin: 0,
                        fontSize: '14px',
                        fontWeight: 700,
                        color: '#1a1a2e',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {board.name}
                      </p>
                    )}
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#999' }}>
                      {board.shared === 1 && board.ownerName
                        ? `от ${board.ownerName} · ${formatDate(board.updated_at)}`
                        : formatDate(board.updated_at)}
                    </p>
                  </div>

                  {/* Context menu button */}
                  <div style={{ position: 'relative' }} ref={menuId === board.id ? menuRef : undefined}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuId(menuId === board.id ? null : board.id);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        fontSize: '16px',
                        color: '#999',
                      }}
                    >
                      ⋯
                    </button>

                    {menuId === board.id && (
                      <div style={{
                        position: 'absolute',
                        right: 0,
                        bottom: '100%',
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                        zIndex: 100,
                        minWidth: '160px',
                        overflow: 'hidden',
                      }}>
                        <button
                          onClick={() => {
                            router.push(`/board/${board.id}`);
                            setMenuId(null);
                          }}
                          style={menuItemStyle}
                        >
                          Открыть
                        </button>
                        {/* Rename is owner-only */}
                        {board.shared !== 1 && (
                          <button
                            onClick={() => {
                              setRenamingId(board.id);
                              setRenameValue(board.name);
                              setMenuId(null);
                            }}
                            style={menuItemStyle}
                          >
                            Переименовать
                          </button>
                        )}
                        {/* Owner deletes the board for everyone; shared user only removes it from their list */}
                        <button
                          onClick={() => deleteBoard(board.id, board.shared === 1)}
                          style={{ ...menuItemStyle, color: '#dc2626' }}
                        >
                          {board.shared === 1 ? 'Убрать у себя' : 'Удалить'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

const menuItemStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '10px 16px',
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  fontSize: '13px',
  color: '#333',
};
