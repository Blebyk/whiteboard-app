'use client';

import { useState, useEffect, useRef } from 'react';
import TaskModal, { type Task } from './TaskModal';
import BoardHeader from '../shared/BoardHeader';
import type { PresenceUser } from '@/lib/boardPresence';
import { useIsMobile } from '@/lib/useIsMobile';

interface Member {
  id: number;
  name: string;
  email: string;
}

interface ActivityLog {
  id: number;
  userId: number;
  userName: string;
  action: string;
  details: string;
  created_at: string;
}

interface Props {
  boardId: number;
  boardName: string;
  canEdit: boolean;
  currentUserId: number;
  isOwner: boolean;
}

const COLUMNS: { id: Task['status']; label: string; color: string }[] = [
  { id: 'todo',       label: 'К выполнению', color: '#6366f1' },
  { id: 'inprogress', label: 'В работе',     color: '#f59e0b' },
  { id: 'done',       label: 'Готово',       color: '#10b981' },
];

const PRIORITY: Record<string, { bg: string; text: string; label: string }> = {
  low:    { bg: '#f0fdf4', text: '#16a34a', label: 'Низкий'  },
  medium: { bg: '#fefce8', text: '#ca8a04', label: 'Средний' },
  high:   { bg: '#fef2f2', text: '#dc2626', label: 'Высокий' },
};

function actionLabel(action: string, detailsStr: string): string {
  try {
    const d = JSON.parse(detailsStr || '{}');
    const map: Record<string, string> = {
      task_created:        `создал(а) задачу «${d.title}»`,
      task_deleted:        `удалил(а) задачу «${d.title}»`,
      task_status_changed: `изменил(а) статус «${d.title}»`,
      comment_added:       `прокомментировал(а) «${d.title}»`,
    };
    return map[action] ?? action;
  } catch { return action; }
}

export default function KanbanBoard({ boardId, boardName, canEdit, currentUserId, isOwner }: Props) {
  const isMobile = useIsMobile();
  const [tasks, setTasks]       = useState<Task[]>([]);
  const [members, setMembers]   = useState<Member[]>([]);
  const [presence, setPresence] = useState<PresenceUser[]>([]);

  const [loading, setLoading]     = useState(true);
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [modal, setModal] = useState<
    | { mode: 'create'; status: Task['status'] }
    | { mode: 'edit';   task: Task }
    | null
  >(null);
  const [activity, setActivity]         = useState<ActivityLog[]>([]);
  const [showActivity, setShowActivity] = useState(false);
  const [activeTab, setActiveTab]       = useState<Task['status']>('todo');

  // Touch drag state stored in a ref (not React state) for use in non-passive event handlers
  const touchDrag = useRef<{
    taskId: number | null;
    cardEl: HTMLElement | null;
    ghost: HTMLElement | null;
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
    started: boolean;
    targetColId: Task['status'] | null;
  }>({
    taskId: null, cardEl: null, ghost: null,
    startX: 0, startY: 0, offsetX: 0, offsetY: 0,
    started: false, targetColId: null,
  });

  useEffect(() => { loadTasks(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const es = new EventSource(`/api/boards/${boardId}/events`);
    es.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'presence') setPresence(msg.users ?? []);
        if (msg.type === 'task_update' && msg.by !== currentUserId) loadTasks();
      } catch { /* ignore invalid frame */ }
    };
    return () => es.close();
  }, [boardId, currentUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Touch drag-and-drop (mobile only)
  useEffect(() => {
    if (!isMobile || !canEdit) return;

    function onTouchStart(e: TouchEvent) {
      const card = (e.target as HTMLElement).closest('[data-task-id]') as HTMLElement | null;
      if (!card) return;
      // Don't initiate if tapping action buttons (delete/move)
      if ((e.target as HTMLElement).closest('button')) return;

      const touch = e.touches[0];
      const state = touchDrag.current;
      state.taskId   = parseInt(card.getAttribute('data-task-id')!);
      state.cardEl   = card;
      state.startX   = touch.clientX;
      state.startY   = touch.clientY;
      state.started  = false;
      state.ghost    = null;
      state.targetColId = null;

      document.addEventListener('touchmove', onTouchMove, { passive: false });
      document.addEventListener('touchend', onTouchEnd);
    }

    function onTouchMove(e: TouchEvent) {
      const state = touchDrag.current;
      if (!state.cardEl || state.taskId === null) return;

      const touch  = e.touches[0];
      const dx     = touch.clientX - state.startX;
      const dy     = touch.clientY - state.startY;
      const dist   = Math.sqrt(dx * dx + dy * dy);

      if (!state.started) {
        if (dist < 10) return; // haven't moved enough yet
        state.started = true;

        const rect = state.cardEl.getBoundingClientRect();
        state.offsetX = state.startX - rect.left;
        state.offsetY = state.startY - rect.top;

        // Build ghost clone
        const ghost = state.cardEl.cloneNode(true) as HTMLElement;
        ghost.setAttribute('style', [
          `position:fixed`,
          `left:${rect.left}px`,
          `top:${rect.top}px`,
          `width:${rect.width}px`,
          `opacity:0.9`,
          `pointer-events:none`,
          `z-index:9999`,
          `transform:scale(1.04) rotate(1.5deg)`,
          `box-shadow:0 12px 32px rgba(0,0,0,0.22)`,
          `border-radius:10px`,
          `transition:none`,
        ].join(';'));
        document.body.appendChild(ghost);
        state.ghost = ghost;
        state.cardEl.style.opacity = '0.3';
        setDraggedId(state.taskId);
      }

      e.preventDefault(); // prevent scroll while dragging

      const state2 = touchDrag.current;
      if (state2.ghost) {
        state2.ghost.style.left = (touch.clientX - state2.offsetX) + 'px';
        state2.ghost.style.top  = (touch.clientY - state2.offsetY) + 'px';
      }

      // Detect column under finger
      if (state2.ghost) state2.ghost.style.display = 'none';
      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      if (state2.ghost) state2.ghost.style.display = '';

      const colEl     = el?.closest('[data-column-id]') as HTMLElement | null;
      const newColId  = (colEl?.getAttribute('data-column-id') ?? null) as Task['status'] | null;

      if (state2.targetColId !== newColId) {
        // Clear old highlight
        if (state2.targetColId) {
          const prev = document.querySelector(`[data-column-id="${state2.targetColId}"]`) as HTMLElement | null;
          if (prev) prev.style.borderColor = 'transparent';
        }
        state2.targetColId = newColId;
        if (newColId && colEl) {
          const col = COLUMNS.find(c => c.id === newColId);
          if (col) colEl.style.borderColor = col.color;
        }
      }
    }

    function onTouchEnd() {
      const state = touchDrag.current;

      if (state.ghost) { document.body.removeChild(state.ghost); state.ghost = null; }
      if (state.cardEl) { state.cardEl.style.opacity = ''; state.cardEl = null; }

      document.querySelectorAll('[data-column-id]').forEach(el => {
        (el as HTMLElement).style.borderColor = 'transparent';
      });

      if (state.started && state.taskId !== null && state.targetColId) {
        const taskId    = state.taskId;
        const targetCol = state.targetColId;
        fetch(`/api/boards/${boardId}/tasks/${taskId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: targetCol }),
        })
          .then(r => r.json())
          .then(data => {
            if (data.task) setTasks(prev => prev.map(t => t.id === taskId ? data.task : t));
          })
          .catch(console.error);
      }

      touchDrag.current = {
        taskId: null, cardEl: null, ghost: null,
        startX: 0, startY: 0, offsetX: 0, offsetY: 0,
        started: false, targetColId: null,
      };
      setDraggedId(null);

      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [isMobile, canEdit, boardId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadTasks() {
    try {
      const res  = await fetch(`/api/boards/${boardId}/tasks`);
      const data = await res.json();
      setTasks(data.tasks   ?? []);
      setMembers(data.members ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function loadActivity() {
    const res  = await fetch(`/api/boards/${boardId}/activity`);
    const data = await res.json();
    setActivity(data.logs ?? []);
  }

  async function handleDrop(status: Task['status']) {
    if (draggedId === null) return;
    const res  = await fetch(`/api/boards/${boardId}/tasks/${draggedId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (data.task) setTasks((prev) => prev.map((t) => t.id === draggedId ? data.task : t));
    setDraggedId(null);
  }

  async function handleMoveTask(taskId: number, status: Task['status']) {
    const res  = await fetch(`/api/boards/${boardId}/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (data.task) setTasks((prev) => prev.map((t) => t.id === taskId ? data.task : t));
  }

  async function handleDelete(taskId: number, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm('Удалить задачу?')) return;
    await fetch(`/api/boards/${boardId}/tasks/${taskId}`, { method: 'DELETE' });
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }

  function handleTaskSaved(task: Task) {
    setTasks((prev) => {
      const idx = prev.findIndex((t) => t.id === task.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = task; return next; }
      return [...prev, task];
    });
    setModal(null);
  }

  function isOverdue(task: Task) {
    if (!task.due_date || task.status === 'done') return false;
    return task.due_date < new Date().toISOString().slice(0, 10);
  }

  function fmt(dateStr: string) {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f6fa', fontFamily: 'Arial, sans-serif' }}>
      {/* ── Header ── */}
      <BoardHeader
        boardId={boardId}
        boardName={boardName}
        active="kanban"
        currentUserId={currentUserId}
        isOwner={isOwner}
        canEdit={canEdit}
        presence={presence}
      >
        <button
          onClick={() => { const next = !showActivity; setShowActivity(next); if (next) loadActivity(); }}
          style={headerBtn(showActivity, isMobile)}
          title="Активность"
        >
          {isMobile ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
          ) : 'Активность'}
        </button>
      </BoardHeader>

      <div style={{ display: 'flex', height: 'calc(100dvh - 52px)' }}>
        {/* ── Columns ── */}
        <main style={{ flex: 1, padding: isMobile ? '0' : '24px', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '80px', color: '#9ca3af' }}>Загрузка...</div>
          ) : isMobile ? (
            /* ── Mobile: tab-based single-column view ── */
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* Tab bar */}
              <div style={{ display: 'flex', backgroundColor: 'white', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
                {COLUMNS.map((col) => {
                  const count = tasks.filter((t) => t.status === col.id).length;
                  const isActive = activeTab === col.id;
                  return (
                    <button
                      key={col.id}
                      onClick={() => setActiveTab(col.id)}
                      style={{
                        flex: 1, padding: '12px 4px 10px',
                        border: 'none', background: 'none',
                        cursor: 'pointer', fontFamily: 'inherit',
                        borderBottom: isActive ? `2.5px solid ${col.color}` : '2.5px solid transparent',
                        color: isActive ? col.color : '#6b7280',
                        fontSize: '12px', fontWeight: isActive ? 700 : 500,
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                        WebkitTapHighlightColor: 'transparent',
                        transition: 'color 0.15s',
                      }}
                    >
                      <span>{col.label}</span>
                      <span style={{
                        fontSize: '11px', fontWeight: 700,
                        backgroundColor: isActive ? col.color : '#e5e7eb',
                        color: isActive ? 'white' : '#9ca3af',
                        borderRadius: '10px', padding: '1px 7px', minWidth: '20px', textAlign: 'center',
                      }}>{count}</span>
                    </button>
                  );
                })}
              </div>

              {/* Active column */}
              {COLUMNS.filter((col) => col.id === activeTab).map((col) => {
                const colTasks = tasks.filter((t) => t.status === col.id);
                return (
                  <div
                    key={col.id}
                    data-column-id={col.id}
                    style={{ flex: 1, overflowY: 'auto', padding: '16px 12px' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
                      {canEdit && (
                        <button
                          onClick={() => setModal({ mode: 'create', status: col.id })}
                          style={{
                            padding: '8px 16px', border: 'none', borderRadius: '8px',
                            background: col.color, color: 'white', cursor: 'pointer',
                            fontSize: '13px', fontWeight: 700, fontFamily: 'inherit',
                            WebkitTapHighlightColor: 'transparent',
                          }}
                        >+ Добавить задачу</button>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {colTasks.map((task) => (
                        <div
                          key={task.id}
                          data-task-id={String(task.id)}
                          onClick={() => setModal({ mode: 'edit', task })}
                          style={{
                            backgroundColor: 'white', borderRadius: '10px',
                            padding: '12px 14px', cursor: 'pointer',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                            border: '2px solid transparent',
                            overflow: 'hidden', minWidth: 0,
                            WebkitTapHighlightColor: 'transparent',
                            userSelect: 'none',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '7px' }}>
                            <span style={{
                              fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px',
                              backgroundColor: PRIORITY[task.priority]?.bg,
                              color: PRIORITY[task.priority]?.text,
                            }}>
                              {PRIORITY[task.priority]?.label}
                            </span>
                            {canEdit && (
                              <button
                                onClick={(e) => handleDelete(task.id, e)}
                                style={{
                                  border: 'none', background: 'none', cursor: 'pointer',
                                  fontSize: '18px', color: '#d1d5db', padding: '0', lineHeight: 1,
                                  WebkitTapHighlightColor: 'transparent',
                                }}
                                title="Удалить"
                              >×</button>
                            )}
                          </div>
                          <p style={{
                            margin: '0 0 6px', fontSize: '14px', fontWeight: 600,
                            color: '#1a1a2e', lineHeight: 1.4,
                            overflowWrap: 'break-word', wordBreak: 'break-word',
                          }}>
                            {task.title}
                          </p>
                          {task.description && (
                            <p style={{
                              margin: '0 0 8px', fontSize: '12px', color: '#6b7280',
                              lineHeight: 1.4, overflow: 'hidden', maxHeight: '36px',
                              overflowWrap: 'break-word', wordBreak: 'break-word',
                            }}>
                              {task.description}
                            </p>
                          )}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
                            {task.due_date ? (
                              <span style={{
                                fontSize: '11px',
                                color: isOverdue(task) ? '#dc2626' : '#6b7280',
                                fontWeight: isOverdue(task) ? 700 : 400,
                              }}>
                                {isOverdue(task) ? '⚠ ' : ''}{fmt(task.due_date)}
                              </span>
                            ) : <span />}
                            {task.assignee_name && (
                              <span title={task.assignee_name} style={{
                                width: '24px', height: '24px', borderRadius: '50%',
                                backgroundColor: '#4f46e5', color: 'white',
                                fontSize: '10px', fontWeight: 700,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>
                                {task.assignee_name.charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                          {/* Mobile: quick move-to-column buttons */}
                          {canEdit && (
                            <div style={{ display: 'flex', gap: '5px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #f3f4f6' }}>
                              {COLUMNS.filter(c => c.id !== task.status).map(c => (
                                <button
                                  key={c.id}
                                  onClick={(e) => { e.stopPropagation(); handleMoveTask(task.id, c.id); }}
                                  style={{
                                    flex: 1, padding: '5px 4px',
                                    fontSize: '10px', fontWeight: 600,
                                    border: `1px solid ${c.color}30`,
                                    borderRadius: '6px',
                                    background: `${c.color}10`,
                                    color: c.color,
                                    cursor: 'pointer', lineHeight: 1.3,
                                    WebkitTapHighlightColor: 'transparent',
                                  }}
                                >
                                  → {c.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                      {colTasks.length === 0 && (
                        <div style={{
                          textAlign: 'center', padding: '48px 24px', color: '#9ca3af',
                          fontSize: '13px', border: '1.5px dashed #e5e7eb', borderRadius: '8px',
                        }}>
                          Нет задач
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ── Desktop: horizontal flex layout ── */
            <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
              {COLUMNS.map((col) => {
                const colTasks = tasks.filter((t) => t.status === col.id);
                return (
                  <div
                    key={col.id}
                    data-column-id={col.id}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDrop(col.id)}
                    onDragEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = col.color; }}
                    onDragLeave={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node))
                        (e.currentTarget as HTMLElement).style.borderColor = 'transparent';
                    }}
                    style={{
                      flex: '0 0 290px', width: '290px', maxWidth: '290px',
                      backgroundColor: '#eef0f5',
                      overflow: 'hidden',
                      borderRadius: '14px', padding: '16px',
                      minHeight: '200px', border: '2px dashed transparent',
                      transition: 'border-color 0.2s', boxSizing: 'border-box',
                    }}
                  >
                    {/* Column header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          width: '9px', height: '9px', borderRadius: '50%',
                          backgroundColor: col.color, display: 'inline-block',
                        }} />
                        <span style={{ fontWeight: 700, color: '#1a1a2e', fontSize: '14px' }}>{col.label}</span>
                        <span style={{
                          fontSize: '12px', color: '#6b7280',
                          backgroundColor: 'white', border: '1px solid #e5e7eb',
                          padding: '0 7px', borderRadius: '12px', fontWeight: 600,
                        }}>{colTasks.length}</span>
                      </div>
                      {canEdit && (
                        <button
                          onClick={() => setModal({ mode: 'create', status: col.id })}
                          title="Добавить задачу"
                          style={{
                            width: '28px', height: '28px', borderRadius: '7px', border: 'none',
                            background: 'white', cursor: 'pointer', fontSize: '18px',
                            color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)', WebkitTapHighlightColor: 'transparent',
                          }}
                        >+</button>
                      )}
                    </div>

                    {/* Cards */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {colTasks.map((task) => (
                        <div
                          key={task.id}
                          data-task-id={String(task.id)}
                          draggable={canEdit && !isMobile}
                          onDragStart={() => setDraggedId(task.id)}
                          onDragEnd={() => setDraggedId(null)}
                          onClick={() => setModal({ mode: 'edit', task })}
                          style={{
                            backgroundColor: 'white', borderRadius: '10px',
                            padding: '12px 14px', cursor: 'pointer',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                            border: `2px solid ${draggedId === task.id ? col.color : 'transparent'}`,
                            opacity: draggedId === task.id ? 0.5 : 1,
                            transition: 'box-shadow 0.15s',
                            overflow: 'hidden', minWidth: 0,
                            WebkitTapHighlightColor: 'transparent',
                            userSelect: 'none',
                          }}
                          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.boxShadow = '0 4px 14px rgba(0,0,0,0.11)')}
                          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.07)')}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '7px' }}>
                            <span style={{
                              fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px',
                              backgroundColor: PRIORITY[task.priority]?.bg,
                              color: PRIORITY[task.priority]?.text,
                            }}>
                              {PRIORITY[task.priority]?.label}
                            </span>
                            {canEdit && (
                              <button
                                onClick={(e) => handleDelete(task.id, e)}
                                style={{
                                  border: 'none', background: 'none', cursor: 'pointer',
                                  fontSize: '18px', color: '#d1d5db', padding: '0', lineHeight: 1,
                                  WebkitTapHighlightColor: 'transparent',
                                }}
                                title="Удалить"
                              >×</button>
                            )}
                          </div>

                          <p style={{
                            margin: '0 0 6px', fontSize: '14px', fontWeight: 600,
                            color: '#1a1a2e', lineHeight: 1.4,
                            overflowWrap: 'break-word', wordBreak: 'break-word',
                          }}>
                            {task.title}
                          </p>

                          {task.description && (
                            <p style={{
                              margin: '0 0 8px', fontSize: '12px', color: '#6b7280',
                              lineHeight: 1.4, overflow: 'hidden', maxHeight: '36px',
                              overflowWrap: 'break-word', wordBreak: 'break-word',
                            }}>
                              {task.description}
                            </p>
                          )}

                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
                            {task.due_date ? (
                              <span style={{
                                fontSize: '11px',
                                color: isOverdue(task) ? '#dc2626' : '#6b7280',
                                fontWeight: isOverdue(task) ? 700 : 400,
                              }}>
                                {isOverdue(task) ? '⚠ ' : ''}{fmt(task.due_date)}
                              </span>
                            ) : <span />}

                            {task.assignee_name && (
                              <span
                                title={task.assignee_name}
                                style={{
                                  width: '24px', height: '24px', borderRadius: '50%',
                                  backgroundColor: '#4f46e5', color: 'white',
                                  fontSize: '10px', fontWeight: 700,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}
                              >
                                {task.assignee_name.charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>

                        </div>
                      ))}

                      {colTasks.length === 0 && (
                        <div style={{
                          textAlign: 'center', padding: '24px', color: '#9ca3af',
                          fontSize: '13px', border: '1.5px dashed #e5e7eb', borderRadius: '8px',
                        }}>
                          Перетащите задачу сюда
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>

        {/* ── Activity panel (mobile: slide-over) ── */}
        {showActivity && isMobile && (
          <div
            onClick={() => setShowActivity(false)}
            style={{ position: 'fixed', inset: 0, top: '52px', backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 49 }}
          />
        )}
        {showActivity && (
          <aside style={isMobile ? {
            position: 'fixed', top: '52px', right: 0, bottom: 0,
            width: 'min(85vw, 320px)', borderLeft: '1px solid #e5e7eb',
            backgroundColor: 'white', padding: '20px', overflow: 'auto',
            zIndex: 50, boxShadow: '-4px 0 24px rgba(0,0,0,0.18)',
          } : {
            width: '300px', borderLeft: '1px solid #e5e7eb',
            backgroundColor: 'white', padding: '20px',
            overflow: 'auto', flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#1a1a2e' }}>Активность</h3>
              <button
                onClick={() => setShowActivity(false)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '20px', color: '#9ca3af', WebkitTapHighlightColor: 'transparent' }}
              >×</button>
            </div>
            {activity.length === 0 ? (
              <p style={{ color: '#9ca3af', fontSize: '13px', textAlign: 'center', marginTop: '32px' }}>Нет активности</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {activity.map((log) => (
                  <div key={log.id} style={{ borderBottom: '1px solid #f3f4f6', paddingBottom: '12px' }}>
                    <p style={{ margin: '0 0 2px', fontSize: '13px', color: '#374151', lineHeight: 1.4 }}>
                      <strong>{log.userName}</strong> {actionLabel(log.action, log.details)}
                    </p>
                    <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af' }}>
                      {new Date(log.created_at.replace(' ', 'T') + (log.created_at.endsWith('Z') ? '' : 'Z')).toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </aside>
        )}
      </div>

      {/* ── Modal ── */}
      {modal && (
        <TaskModal
          boardId={boardId}
          mode={modal.mode}
          initialStatus={modal.mode === 'create' ? modal.status : modal.task.status}
          task={modal.mode === 'edit' ? modal.task : undefined}
          members={members}
          currentUserId={currentUserId}
          canEdit={canEdit}
          onSave={handleTaskSaved}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

function headerBtn(active: boolean, compact = false): React.CSSProperties {
  return {
    padding: compact ? '8px' : '6px 11px', border: `1px solid ${active ? '#c7d2fe' : '#e5e7eb'}`, borderRadius: '7px',
    background: active ? '#eef2ff' : 'white', cursor: 'pointer',
    fontSize: '13px', color: active ? '#4f46e5' : '#374151',
    fontWeight: active ? 700 : 400, lineHeight: 1, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    WebkitTapHighlightColor: 'transparent',
  };
}
