'use client';

import { useState, useEffect } from 'react';
import DatePicker from './DatePicker';
import { useIsMobile } from '@/lib/useIsMobile';

export interface Task {
  id: number;
  title: string;
  description: string;
  status: 'todo' | 'inprogress' | 'done';
  priority: 'low' | 'medium' | 'high';
  assignee_id: number | null;
  assignee_name: string | null;
  due_date: string | null;
  created_by: number;
  creator_name: string;
  position: number;
  created_at: string;
  updated_at: string;
}

interface Member {
  id: number;
  name: string;
  email: string;
}

interface Comment {
  id: number;
  userId: number;
  user_name: string;
  content: string;
  created_at: string;
}

interface Props {
  boardId: number;
  mode: 'create' | 'edit';
  initialStatus: string;
  task?: Task;
  members: Member[];
  canEdit: boolean;
  currentUserId?: number;
  onSave(task: Task): void;
  onClose(): void;
}

export default function TaskModal({
  boardId, mode, initialStatus, task, members, canEdit, onSave, onClose,
}: Props) {
  const isMobile = useIsMobile();
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [status, setStatus] = useState<Task['status']>((task?.status ?? initialStatus) as Task['status']);
  const [priority, setPriority] = useState<Task['priority']>(task?.priority ?? 'medium');
  const [assigneeId, setAssigneeId] = useState<number | ''>(task?.assignee_id ?? '');
  const [dueDate, setDueDate] = useState(task?.due_date ?? '');
  const [saving, setSaving] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);

  useEffect(() => {
    if (mode === 'edit' && task) {
      fetch(`/api/boards/${boardId}/tasks/${task.id}`)
        .then((r) => r.json())
        .then((d) => setComments(d.comments ?? []));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const url = mode === 'create'
        ? `/api/boards/${boardId}/tasks`
        : `/api/boards/${boardId}/tasks/${task!.id}`;
      const res = await fetch(url, {
        method: mode === 'create' ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description,
          status,
          priority,
          assignee_id: assigneeId || null,
          due_date: dueDate || null,
        }),
      });
      const data = await res.json();
      if (data.task) onSave(data.task);
    } finally {
      setSaving(false);
    }
  }

  async function handleComment() {
    if (!commentText.trim() || !task) return;
    setSendingComment(true);
    try {
      const res = await fetch(`/api/boards/${boardId}/tasks/${task.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: commentText.trim() }),
      });
      const data = await res.json();
      if (data.comment) {
        setComments((prev) => [...prev, data.comment]);
        setCommentText('');
      }
    } finally {
      setSendingComment(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: isMobile ? 'flex-end' : 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: isMobile ? 0 : '16px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        backgroundColor: 'white',
        borderRadius: isMobile ? '20px 20px 0 0' : '16px',
        width: '100%',
        maxWidth: isMobile ? '100%' : '580px',
        maxHeight: isMobile ? '92dvh' : '90vh',
        overflow: 'auto',
        padding: isMobile ? '0 20px calc(env(safe-area-inset-bottom, 0px) + 24px)' : 'clamp(20px, 4vw, 28px)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        {/* Drag handle (mobile only) */}
        {isMobile && (
          <div style={{ position: 'sticky', top: 0, backgroundColor: 'white', paddingTop: '12px', paddingBottom: '4px', zIndex: 1 }}>
            <div style={{ width: '40px', height: '4px', backgroundColor: '#e5e7eb', borderRadius: '2px', margin: '0 auto' }} />
          </div>
        )}

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '22px', marginTop: isMobile ? '14px' : 0 }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#1a1a2e' }}>
            {mode === 'create' ? 'Новая задача' : 'Задача'}
          </h2>
          <button
            onClick={onClose}
            style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '24px', color: '#9ca3af', lineHeight: 1, WebkitTapHighlightColor: 'transparent' }}
          >×</button>
        </div>

        {/* Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Название *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
              disabled={!canEdit}
              placeholder="Что нужно сделать?"
              style={inputStyle(canEdit)}
              autoFocus={!isMobile}
            />
          </div>

          <div>
            <label style={labelStyle}>Описание</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!canEdit}
              placeholder="Подробности задачи..."
              rows={3}
              style={{ ...inputStyle(canEdit), resize: 'vertical', minHeight: '76px' }}
            />
          </div>

          {/* Status / Priority — 2 cols on desktop, 1 col on mobile */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Статус</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Task['status'])}
                disabled={!canEdit}
                style={inputStyle(canEdit)}
              >
                <option value="todo">К выполнению</option>
                <option value="inprogress">В работе</option>
                <option value="done">Готово</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Приоритет</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Task['priority'])}
                disabled={!canEdit}
                style={inputStyle(canEdit)}
              >
                <option value="low">Низкий</option>
                <option value="medium">Средний</option>
                <option value="high">Высокий</option>
              </select>
            </div>
          </div>

          {/* Assignee / Due date — 2 cols on desktop, 1 col on mobile */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Исполнитель</label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value ? Number(e.target.value) : '')}
                disabled={!canEdit}
                style={inputStyle(canEdit)}
              >
                <option value="">Не назначен</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Дедлайн</label>
              <DatePicker
                value={dueDate}
                onChange={setDueDate}
                disabled={!canEdit}
              />
            </div>
          </div>

          {canEdit && (
            <div style={{
              display: 'flex',
              flexDirection: isMobile ? 'column-reverse' : 'row',
              gap: '10px',
              justifyContent: isMobile ? 'stretch' : 'flex-end',
              paddingTop: '4px',
            }}>
              <button
                onClick={onClose}
                style={{
                  padding: isMobile ? '13px 20px' : '10px 20px',
                  border: '1.5px solid #e5e7eb', borderRadius: '8px',
                  background: 'white', cursor: 'pointer',
                  fontSize: isMobile ? '15px' : '14px', color: '#555',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >Отмена</button>
              <button
                onClick={handleSave}
                disabled={saving || !title.trim()}
                style={{
                  padding: isMobile ? '13px 24px' : '10px 24px',
                  backgroundColor: '#4f46e5', color: 'white',
                  border: 'none', borderRadius: '8px',
                  fontSize: isMobile ? '15px' : '14px', fontWeight: 700,
                  cursor: saving || !title.trim() ? 'not-allowed' : 'pointer',
                  opacity: saving || !title.trim() ? 0.7 : 1,
                  WebkitTapHighlightColor: 'transparent',
                }}
              >{saving ? 'Сохранение...' : mode === 'create' ? 'Создать' : 'Сохранить'}</button>
            </div>
          )}
        </div>

        {/* Comments (edit mode only) */}
        {mode === 'edit' && (
          <div style={{ marginTop: '24px', borderTop: '1px solid #f3f4f6', paddingTop: '20px' }}>
            <h3 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: 700, color: '#1a1a2e' }}>
              Комментарии{comments.length > 0 && ` (${comments.length})`}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '14px' }}>
              {comments.length === 0 ? (
                <p style={{ color: '#9ca3af', fontSize: '13px', margin: 0 }}>Пока нет комментариев</p>
              ) : comments.map((c) => (
                <div key={c.id} style={{ display: 'flex', gap: '10px' }}>
                  <span style={avatarStyle}>{c.user_name.charAt(0).toUpperCase()}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '3px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#374151' }}>{c.user_name}</span>
                      <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                        {new Date(c.created_at).toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' })}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '13px', color: '#4b5563', lineHeight: 1.5 }}>{c.content}</p>
                  </div>
                </div>
              ))}
            </div>

            {canEdit && (
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleComment(); }
                  }}
                  placeholder="Написать комментарий..."
                  style={{ ...inputStyle(true), flex: 1 }}
                />
                <button
                  onClick={handleComment}
                  disabled={sendingComment || !commentText.trim()}
                  style={{
                    padding: isMobile ? '10px 14px' : '10px 16px',
                    backgroundColor: '#4f46e5', color: 'white',
                    border: 'none', borderRadius: '8px',
                    fontSize: '13px', fontWeight: 700,
                    cursor: sendingComment || !commentText.trim() ? 'not-allowed' : 'pointer',
                    opacity: sendingComment || !commentText.trim() ? 0.7 : 1, flexShrink: 0,
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >{sendingComment ? '...' : 'Отправить'}</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '11px', fontWeight: 700, color: '#6b7280',
  marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em',
};

function inputStyle(enabled: boolean): React.CSSProperties {
  return {
    width: '100%', padding: '10px 12px', border: '1.5px solid #e5e7eb',
    borderRadius: '8px', fontSize: '14px', outline: 'none', color: '#1a1a2e',
    backgroundColor: enabled ? 'white' : '#f9fafb', boxSizing: 'border-box',
    fontFamily: 'inherit',
  };
}

const avatarStyle: React.CSSProperties = {
  width: '32px', height: '32px', borderRadius: '50%',
  backgroundColor: '#4f46e5', color: 'white',
  fontSize: '13px', fontWeight: 700, flexShrink: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
