// In-process pub/sub for real-time board updates (SSE transport).
// A change pushed to a board is published here; open SSE connections for that
// board forward it to clients, which then pull the diff. Single Node process
// only — multi-process deployments fall back to the client's polling loop.
// Kept on globalThis so it survives Next.js dev HMR (like the db singleton).

export interface BoardEvent {
  rev: number;
  by: number | null; // userId that caused the change (clients skip their own)
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
  for (const fn of set) { try { fn(e); } catch { /* ignore bad listener */ } }
}
