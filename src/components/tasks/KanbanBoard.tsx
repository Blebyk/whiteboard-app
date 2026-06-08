'use client';

import { useState, useEffect } from 'react';
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
  const [presence, setPresence] = useState<PresenceUser[]>([]); // кто сейчас на доске

  const [loading, setLoading]   = useState(true);
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [modal, setModal] = useState<
    | { mode: 'create'; status: Task['status'] }
    | { mode: 'edit';   task: Task }
    | null
  >(null);
  const [activity, setActivity]     = useState<ActivityLog[]>([]);
  const [showActivity, setShowActivity] = useState(false);

  useEffect(() => { loadTasks(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Real-time синхронизация: подписываемся на SSE-поток доски и перезагружаем
  // задачи, когда другой пользователь создаёт / обновляет / удаляет задачу.
  useEffect(() => {
    const es = new EventSource(`/api/boards/${boardId}/events`);
    es.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'presence') setPresence(msg.users ?? []);
        if (msg.type === 'task_update' && msg.by !== currentUserId) {
          loadTasks();
        }
      } catch { /* игнорируем невалидный фрейм */ }
    };
    return () => es.close();
  }, [boardId, currentUserId]); // eslint-disable-line react-hooks/exhaustive-deps

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
      {/* ── Шапка (единая с доской) ── */}
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
        <main style={{ flex: 1, padding: isMobile ? '16px 12px' : '24px', overflow: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '80px', color: '#9ca3af' }}>Загрузка...</div>
          ) : (
            <div style={{ display: 'flex', gap: isMobile ? '12px' : '20px', alignItems: 'flex-start' }}>
              {COLUMNS.map((col) => {
                const colTasks = tasks.filter((t) => t.status === col.id);
                return (
                  <div
                    key={col.id}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDrop(col.id)}
                    onDragEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = col.color; }}
                    onDragLeave={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node))
                        (e.currentTarget as HTMLElement).style.borderColor = 'transparent';
                    }}
                    style={{
                      flex: isMobile ? '0 0 min(82vw, 300px)' : '0 0 290px',
                      width: isMobile ? 'min(82vw, 300px)' : '290px',
                      maxWidth: isMobile ? 'min(82vw, 300px)' : '290px',
                      backgroundColor: '#eef0f5', overflow: 'hidden',
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
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                          }}
                        >+</button>
                      )}
                    </div>

                    {/* Cards */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {colTasks.map((task) => (
                        <div
                          key={task.id}
                          draggable={canEdit}
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

        {/* ── Activity panel (на телефоне — выезжающая панель поверх) ── */}
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
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '20px', color: '#9ca3af' }}
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
                      {new Date(log.created_at).toLocaleString('ru-RU')}
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
  };
}
