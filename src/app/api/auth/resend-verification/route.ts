import { NextRequest, NextResponse } from 'next/server';
import db from '@/../lib/db';
import { Resend } from 'resend';
import crypto from 'crypto';

// POST /api/auth/resend-verification  body: { email }
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    if (!email) return NextResponse.json({ error: 'Укажите email' }, { status: 400 });

    const user = db.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(email.trim().toLowerCase()) as any;

    // Не раскрываем, существует ли пользователь
    if (!user || user.emailVerified) {
      return NextResponse.json({ message: 'Если аккаунт существует и не подтверждён — письмо отправлено' });
    }

    // Генерируем новый токен
    const verificationToken = crypto.randomUUID();
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    db.prepare('UPDATE users SET verificationToken = ?, tokenExpiry = ? WHERE id = ?')
      .run(verificationToken, tokenExpiry, user.id);

    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: 'noreply@whiteboard-app.com',
      to: user.email,
      subject: 'Подтвердите ваш email — Whiteboard',
      html: `
        <h1>Подтверждение email</h1>
        <p>Вы запросили повторную отправку письма. Перейдите по ссылке ниже:</p>
        <a href="${process.env.APP_URL || 'http://localhost:3000'}/api/auth/verify-email?token=${verificationToken}">
          Подтвердить email
        </a>
        <p>Ссылка действительна 24 часа.</p>
      `,
    });

    return NextResponse.json({ message: 'Письмо отправлено' });
  } catch (error) {
    console.error('Ошибка повторной отправки:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}
