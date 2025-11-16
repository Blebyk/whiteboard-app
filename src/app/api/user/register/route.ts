// API эндпоинт для регистрации новых пользователей
import { NextRequest, NextResponse } from 'next/server';
import db from '@/../lib/db';
import bcrypt from 'bcryptjs';
import { Resend } from 'resend';
import crypto from 'crypto';

// POST запрос для регистрации пользователя с отправкой email верификации
export async function POST(request: NextRequest) {
  try {
    const { name, email, password } = await request.json();

    // Проверка существования пользователя
    const existingUser = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    
    if (existingUser) {
      return NextResponse.json(
        { error: 'Пользователь с таким email уже существует' },
        { status: 400 }
      );
    }

    // Хеширование пароля
    const hashedPassword = await bcrypt.hash(password, 10);

    // Генерация токена верификации
    const verificationToken = crypto.randomUUID();
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 часа

    // Добавление пользователя с токеном верификации
    const stmt = db.prepare(
      'INSERT INTO users (name, email, password, verificationToken, tokenExpiry) VALUES (?, ?, ?, ?, ?)'
    );
    const result = stmt.run(name, email, hashedPassword, verificationToken, tokenExpiry);

    // Отправка email верификации
    const resend = new Resend(process.env.RESEND_API_KEY);

    try {
      await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: email,
        subject: 'Подтвердите ваш email',
        html: `
          <h1>Добро пожаловать, ${name}!</h1>
          <p>Для завершения регистрации подтвердите ваш email:</p>
          <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}">
            Подтвердить email
          </a>
          <p>Ссылка действительна 24 часа.</p>
        `
      });
    } catch (emailError) {
      console.error('Ошибка отправки email:', emailError);
      // Продолжаем даже если email не отправился
    }

    return NextResponse.json(
      {
        message: 'Регистрация успешна. Проверьте email для подтверждения.',
        userId: result.lastInsertRowid
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Ошибка регистрации:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}