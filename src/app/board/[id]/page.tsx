import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import db from '@/lib/db';
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

  return (
    <WhiteboardApp
      boardId={board.id}
      boardName={board.name}
      initialState={board.canvasState || null}
      initialBgStyle={board.bgStyle || 'dots'}
      isOwner={isOwner}
      canEdit={canEdit}
      currentUserId={user.id}
      initialUpdatedAt={board.updated_at ?? ''}
    />
  );
}
