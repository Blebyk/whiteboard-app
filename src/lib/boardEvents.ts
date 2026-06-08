// In-process pub/sub для real-time обновлений доски (транспорт SSE).
// Изменение, запушенное в доску, публикуется здесь; открытые SSE-соединения этой
// доски пересылают его клиентам, а те подтягивают дифф. Только один процесс Node —
// при multi-process деплое realtime деградирует до клиентского опроса.
// Хранится на globalThis, чтобы пережить HMR в dev (как и singleton БД).

export interface BoardEvent {
  rev: number;
  by: number | null; // userId, вызвавший изменение (клиенты пропускают свои)
}

export interface TaskEvent {
  by: number; // userId, вызвавший изменение задачи
}

type Listener = (e: BoardEvent) => void;
type TaskListener = (e: TaskEvent) => void;

const g = globalThis as unknown as {
  __boardSubs?: Map<number, Set<Listener>>;
  __taskSubs?: Map<number, Set<TaskListener>>;
};
if (!g.__boardSubs) g.__boardSubs = new Map();
if (!g.__taskSubs)  g.__taskSubs  = new Map();
const subs     = g.__boardSubs;
const taskSubs = g.__taskSubs;

export function subscribe(boardId: number, fn: Listener): () => void {
  let set = subs.get(boardId);
  if (!set) { set = new Set(); subs.set(boardId, set); }
  set.add(fn);
  return () => {
    const s = subs.get(boardId);
    if (!s) return;
    s.delete(fn);
    if (s.size === 0) subs.delete(boardId);
  };
}

export function publish(boardId: number, e: BoardEvent): void {
  const set = subs.get(boardId);
  if (!set) return;
  for (const fn of set) { try { fn(e); } catch { /* игнорируем сбойный слушатель */ } }
}

export function subscribeTaskUpdates(boardId: number, fn: TaskListener): () => void {
  let set = taskSubs.get(boardId);
  if (!set) { set = new Set(); taskSubs.set(boardId, set); }
  set.add(fn);
  return () => {
    const s = taskSubs.get(boardId);
    if (!s) return;
    s.delete(fn);
    if (s.size === 0) taskSubs.delete(boardId);
  };
}

export function publishTaskUpdate(boardId: number, by: number): void {
  const set = taskSubs.get(boardId);
  if (!set) return;
  for (const fn of set) { try { fn({ by }); } catch { /* игнорируем сбойный слушатель */ } }
}
