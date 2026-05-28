import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import db from '@/lib/db';
import { ensureBoardObjects } from '@/lib/boardSync';
import WhiteboardApp from '@/components/whiteboard/WhiteboardApp';

export const dynamic = 'force-dynamic';

export default async function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const { id } = await params;
  const board = db.prepare(`
    SELECT b.* FROM boards b
    LEFT JOIN board_shares s ON s.boardId = b.id AND s.userId = ?
    WHERE b.id = ? AND (b.userId = ? OR s.userId = ?)
  `).get(user.id, Number(id), user.id, user.id) as any;

  if (!board) redirect('/dashboard');

  const isOwner = board.userId === user.id;
  let canEdit = isOwner;

  if (!isOwner) {
    const share = db.prepare('SELECT role FROM board_shares WHERE boardId = ? AND userId = ?')
      .get(board.id, user.id) as any;
    canEdit = share?.role === 'editor';
  }

  // Give existing objects stable ids before first render so every client that
  // opens this board shares the same ids; then read back the seeded snapshot.
  ensureBoardObjects(board.id);
  const synced = db.prepare('SELECT canvasState, rev FROM boards WHERE id = ?')
    .get(board.id) as { canvasState: string | null; rev: number };

  return (
    <WhiteboardApp
      boardId={board.id}
      boardName={board.name}
      initialState={synced.canvasState || null}
      initialBgStyle={board.bgStyle || 'dots'}
      isOwner={isOwner}
      canEdit={canEdit}
      currentUserId={user.id}
      initialRev={synced.rev ?? 0}
    />
  );
}
