import { NextRequest } from 'next/server';
import db from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { subscribe } from '@/lib/boardEvents';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/boards/[id]/events — поток Server-Sent Events.
// Шлёт `{ rev, by }` при каждом изменении доски, чтобы клиент сразу подтянул
// дифф, а не ждал следующего опроса.
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
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`)); } catch { /* закрыт */ }
      };

      // Стартовое событие с текущим rev, чтобы только что (пере)подключившийся
      // клиент догнал то, что пропустил, пока был офлайн.
      const cur = db.prepare('SELECT rev FROM boards WHERE id = ?').get(boardId) as { rev: number } | undefined;
      send({ rev: cur?.rev ?? 0, by: null });

      unsubscribe = subscribe(boardId, send);

      // Heartbeat-комментарий не даёт прокси/браузеру закрыть простаивающий поток.
      heartbeat = setInterval(() => {
        try { controller.enqueue(encoder.encode(': ping\n\n')); } catch { /* закрыт */ }
      }, 25_000);

      const onAbort = () => {
        if (heartbeat) clearInterval(heartbeat);
        unsubscribe();
        try { controller.close(); } catch { /* уже закрыт */ }
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
