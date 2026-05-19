import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import db from '@/lib/db';
import WhiteboardApp from '@/components/whiteboard/WhiteboardApp';

export default async function BoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const { id } = await params;
  const board = db
    .prepare('SELECT * FROM boards WHERE id = ? AND userId = ?')
    .get(Number(id), user.id) as any;

  if (!board) redirect('/dashboard');

  return (
    <WhiteboardApp
      boardId={board.id}
      boardName={board.name}
      initialState={board.canvasState || null}
    />
  );
}
