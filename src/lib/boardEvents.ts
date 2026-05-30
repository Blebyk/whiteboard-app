// In-process pub/sub для real-time обновлений доски (транспорт SSE).
// Изменение, запушенное в доску, публикуется здесь; открытые SSE-соединения этой
// доски пересылают его клиентам, а те подтягивают дифф. Только один процесс Node —
// при multi-process деплое realtime деградирует до клиентского опроса.
// Хранится на globalThis, чтобы пережить HMR в dev (как и singleton БД).

export interface BoardEvent {
  rev: number;
  by: number | null; // userId, вызвавший изменение (клиенты пропускают свои)
}

type Listener = (e: BoardEvent) => void;

const g = globalThis as unknown as { __boardSubs?: Map<number, Set<Listener>> };
if (!g.__boardSubs) g.__boardSubs = new Map();
const subs = g.__boardSubs;

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
