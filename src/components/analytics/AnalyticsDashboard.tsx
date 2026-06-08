'use client';

import { useState, useEffect } from 'react';
import BoardHeader from '../shared/BoardHeader';
import type { PresenceUser } from '@/lib/boardPresence';

interface AnalyticsData {
  total: number;
  byStatus:   { status: string; count: number }[];
  byPriority: { priority: string; count: number }[];
  byAssignee: { name: string; count: number }[];
  overdue: number;
  perDay: { day: string; count: number }[];
  recentActivity: ActivityItem[];
  boardName: string;
}

interface ActivityItem {
  id: number;
  userName: string;
  action: string;
  details: string;
  created_at: string;
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  todo:       { label: 'К выполнению', color: '#6366f1' },
  inprogress: { label: 'В работе',     color: '#f59e0b' },
  done:       { label: 'Готово',       color: '#10b981' },
};

const PRIORITY_META: Record<string, { label: string; color: string }> = {
  high:   { label: 'Высокий', color: '#ef4444' },
  medium: { label: 'Средний', color: '#f59e0b' },
  low:    { label: 'Низкий',  color: '#10b981' },
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

function getLast7Days(): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });
}

interface Props {
  boardId: number;
  boardName: string;
  isOwner: boolean;
  canEdit: boolean;
  currentUserId: number;
}

export default function AnalyticsDashboard({ boardId, boardName, isOwner, canEdit, currentUserId }: Props) {
  const [data, setData]     = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [presence, setPresence] = useState<PresenceUser[]>([]); // кто сейчас на доске

  useEffect(() => {
    fetch(`/api/boards/${boardId}/analytics`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [boardId]);

  // Presence через SSE — как на доске и канбане.
  useEffect(() => {
    const es = new EventSource(`/api/boards/${boardId}/events`);
    es.onmessage = (ev) => {
      try { const msg = JSON.parse(ev.data); if (msg.type === 'presence') setPresence(msg.users ?? []); } catch { /* игнор */ }
    };
    return () => es.close();
  }, [boardId]);

  const header = (
    <BoardHeader
      boardId={boardId}
      boardName={boardName}
      active="analytics"
      currentUserId={currentUserId}
      isOwner={isOwner}
      canEdit={canEdit}
      presence={presence}
    />
  );

  if (loading || !data) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f5f6fa', fontFamily: 'Arial, sans-serif' }}>
        {header}
        <div style={{ padding: '80px', textAlign: 'center', color: '#9ca3af' }}>
          {loading ? 'Загрузка аналитики...' : 'Нет данных'}
        </div>
      </div>
    );
  }

  const done = data.byStatus.find((s) => s.status === 'done')?.count ?? 0;
  const completionRate = data.total > 0 ? Math.round((done / data.total) * 100) : 0;
  const last7 = getLast7Days();
  const perDayMap = Object.fromEntries(data.perDay.map((d) => [d.day, d.count]));
  const maxDay = Math.max(...last7.map((d) => perDayMap[d] ?? 0), 1);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f6fa', fontFamily: 'Arial, sans-serif' }}>
      {header}

      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: 'clamp(20px, 4vw, 32px) clamp(14px, 4vw, 24px)' }}>
        {/* ── Summary cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px', marginBottom: '28px' }}>
          {[
            { label: 'Всего задач',  value: data.total,         color: '#6366f1', bg: '#ede9fe' },
            { label: 'Выполнено',    value: done,               color: '#10b981', bg: '#d1fae5' },
            { label: 'Просрочено',   value: data.overdue,       color: '#ef4444', bg: '#fee2e2' },
            { label: 'Выполнение',   value: `${completionRate}%`, color: '#f59e0b', bg: '#fef3c7' },
          ].map((c) => (
            <div key={c.label} style={{ ...card, padding: '20px' }}>
              <p style={cardLabel}>{c.label}</p>
              <p style={{ margin: 0, fontSize: '34px', fontWeight: 800, color: c.color }}>{c.value}</p>
            </div>
          ))}
        </div>

        {/* ── Row 1: status + priority ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', marginBottom: '20px' }}>
          <BarSection title="Задачи по статусу" meta={STATUS_META} data={data.byStatus.map((x) => ({ key: x.status, count: x.count }))} total={data.total} />
          <BarSection title="Задачи по приоритету" meta={PRIORITY_META} data={data.byPriority.map((x) => ({ key: x.priority, count: x.count }))} total={data.total} order={['high', 'medium', 'low']} />
        </div>

        {/* ── Row 2: activity + assignee ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', marginBottom: '20px' }}>
          {/* Bar chart: created per day */}
          <div style={card}>
            <p style={cardTitle}>Создано задач (7 дней)</p>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '110px' }}>
              {last7.map((day) => {
                const count = perDayMap[day] ?? 0;
                const pct = count > 0 ? Math.max((count / maxDay) * 100, 8) : 0;
                return (
                  <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '11px', color: '#374151', fontWeight: 700, minHeight: '16px' }}>
                      {count > 0 ? count : ''}
                    </span>
                    <div style={{ width: '100%', height: '80px', display: 'flex', alignItems: 'flex-end' }}>
                      <div style={{
                        width: '100%', height: `${pct}%`, backgroundColor: '#6366f1',
                        borderRadius: '4px 4px 0 0', transition: 'height 0.4s ease',
                      }} />
                    </div>
                    <span style={{ fontSize: '10px', color: '#9ca3af' }}>
                      {new Date(day + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'numeric' })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* By assignee */}
          <div style={card}>
            <p style={cardTitle}>По исполнителям</p>
            {data.byAssignee.length === 0 ? (
              <p style={{ color: '#9ca3af', fontSize: '13px', margin: 0 }}>Задачи ещё не назначены</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {data.byAssignee.map((a) => {
                  const pct = data.total > 0 ? (a.count / data.total) * 100 : 0;
                  return (
                    <div key={a.name}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            width: '20px', height: '20px', borderRadius: '50%',
                            backgroundColor: '#4f46e5', color: 'white',
                            fontSize: '10px', fontWeight: 700, flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>{a.name.charAt(0).toUpperCase()}</span>
                          <span style={{ fontSize: '13px', color: '#374151', fontWeight: 600 }}>{a.name}</span>
                        </div>
                        <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: 700 }}>{a.count}</span>
                      </div>
                      <div style={{ height: '6px', backgroundColor: '#f3f4f6', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, backgroundColor: '#8b5cf6', borderRadius: '3px' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Recent activity ── */}
        {data.recentActivity.length > 0 && (
          <div style={card}>
            <p style={cardTitle}>Последняя активность</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {data.recentActivity.map((log) => (
                <div key={log.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', paddingBottom: '10px', borderBottom: '1px solid #f3f4f6' }}>
                  <span style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    backgroundColor: '#ede9fe', color: '#4f46e5',
                    fontSize: '13px', fontWeight: 700, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{log.userName?.charAt(0).toUpperCase()}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: '0 0 2px', fontSize: '13px', color: '#374151', lineHeight: 1.4 }}>
                      <strong>{log.userName}</strong> {actionLabel(log.action, log.details)}
                    </p>
                    <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af' }}>
                      {new Date(log.created_at).toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function BarSection({
  title, meta, data, total, order,
}: {
  title: string;
  meta: Record<string, { label: string; color: string }>;
  data: { key: string; count: number }[];
  total: number;
  order?: string[];
}) {
  const keys = order ?? Object.keys(meta);
  return (
    <div style={card}>
      <p style={cardTitle}>{title}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {keys.map((k) => {
          const count = data.find((x) => x.key === k)?.count ?? 0;
          const pct = total > 0 ? (count / total) * 100 : 0;
          const m = meta[k];
          return (
            <div key={k}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '13px', color: '#374151', fontWeight: 600 }}>{m?.label ?? k}</span>
                <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: 700 }}>{count}</span>
              </div>
              <div style={{ height: '8px', backgroundColor: '#f3f4f6', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${pct}%`,
                  backgroundColor: m?.color ?? '#6366f1',
                  borderRadius: '4px', transition: 'width 0.5s ease',
                }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const card: React.CSSProperties = {
  backgroundColor: 'white', borderRadius: '14px', padding: '20px',
  border: '1.5px solid #e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
};

const cardTitle: React.CSSProperties = {
  margin: '0 0 16px', fontSize: '15px', fontWeight: 700, color: '#1a1a2e',
};

const cardLabel: React.CSSProperties = {
  margin: '0 0 8px', fontSize: '11px', color: '#6b7280', fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.06em',
};
