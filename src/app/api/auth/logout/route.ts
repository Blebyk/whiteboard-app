import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export async function POST(request: NextRequest) {
  const token = request.cookies.get('session')?.value;

  if (token) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }

  const response = NextResponse.json({ success: true });
  response.cookies.delete('session');
  return response;
}
