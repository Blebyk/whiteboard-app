import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import db from '@/../lib/db';
import { Resend } from 'resend';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email обязателен' }, { status: 400 });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;

    // Всегда возвращаем успех, чтобы не дать перечислить email
    if (!user) {
      return NextResponse.json({ success: true });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 час

    db.prepare(
      'UPDATE users SET resetToken = ?, resetTokenExpiry = ? WHERE id = ?'
    ).run(resetToken, resetTokenExpiry, user.id);

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const resetUrl = `${appUrl}/reset-password?token=${resetToken}`;

    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: 'noreply@whiteboard-app.com',
      to: email,
      subject: 'Сброс пароля — Whiteboard',
      html: `
        <h1>Сброс пароля</h1>
        <p>Вы запросили сброс пароля для аккаунта <strong>${email}</strong>.</p>
        <p>Нажмите на кнопку ниже, чтобы задать новый пароль:</p>
        <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#4f46e5;color:white;border-radius:8px;text-decoration:none;font-weight:bold;">
          Сбросить пароль
        </a>
        <p style="margin-top:16px;color:#666;font-size:14px;">
          Ссылка действительна 1 час. Если вы не запрашивали сброс пароля — проигнорируйте это письмо.
        </p>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}
