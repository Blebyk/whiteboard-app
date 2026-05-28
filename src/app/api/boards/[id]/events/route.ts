import { NextRequest } from 'next/server';
import db from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { subscribe } from '@/lib/boardEvents';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/boards/[id]/events — Server-Sent Events stream.
// Emits `{ rev, by }` whenever the board changes, so clients can pull the diff
// immediately instead of waiting for the next poll.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return new Response('Не авторизован', { status: 401 });

  const { id } = await params;
  const boardId = Number(id);
  const ok = db
    .prepare(`
      SELECT 1 FROM boards b
      LEFT JOIN board_shares s ON s.boardId = b.id AND s.userId = ?
      WHERE b.id = ? AND (b.userId = ? OR s.userId = ?)
    `)
    .get(user.id, boardId, user.id, user.id);
  if (!ok) return new Response('Доска не найдена', { status: 404 });

  const encoder = new TextEncoder();
  let unsubscribe = () => {};
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const send = (obj: unknown) => {
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`)); } catch { /* closed */ }
      };

      // Initial event with the current rev so a freshly-(re)connected client
      // catches up on anything it missed while offline.
      const cur = db.prepare('SELECT rev FROM boards WHERE id = ?').get(boardId) as { rev: number } | undefined;
      send({ rev: cur?.rev ?? 0, by: null });

      unsubscribe = subscribe(boardId, send);

      // Comment heartbeat keeps proxies/browsers from closing an idle stream.
      heartbeat = setInterval(() => {
        try { controller.enqueue(encoder.encode(': ping\n\n')); } catch { /* closed */ }
      }, 25_000);

      const onAbort = () => {
        if (heartbeat) clearInterval(heartbeat);
        unsubscribe();
        try { controller.close(); } catch { /* already closed */ }
      };
      req.signal.addEventListener('abort', onAbort);
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
