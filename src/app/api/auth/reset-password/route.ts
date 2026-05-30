import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import db from '@/../lib/db';

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json({ error: 'Токен и пароль обязательны' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Пароль должен быть не менее 6 символов' }, { status: 400 });
    }

    const user = db.prepare(
      "SELECT * FROM users WHERE resetToken = ? AND resetTokenExpiry > datetime('now')"
    ).get(token) as any;

    if (!user) {
      return NextResponse.json({ error: 'Ссылка недействительна или истекла' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    db.prepare(
      'UPDATE users SET password = ?, resetToken = NULL, resetTokenExpiry = NULL WHERE id = ?'
    ).run(hashedPassword, user.id);

    // Аннулируем все существующие сессии в целях безопасности
    db.prepare('DELETE FROM sessions WHERE userId = ?').run(user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}
