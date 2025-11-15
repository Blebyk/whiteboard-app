import { NextRequest, NextResponse } from 'next/server';
import db from '@/../lib/db';

interface User {
  id: number;
  name: string;
  email: string;
  password: string;
  emailVerified: number;
  verificationToken: string | null;
  tokenExpiry: string | null;
  created_at: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Токен не предоставлен' },
        { status: 400 }
      );
    }

    // Поиск пользователя с токеном
    const user = db.prepare(
      'SELECT * FROM users WHERE verificationToken = ?'
    ).get(token) as User | undefined;

    if (!user) {
      return NextResponse.json(
        { error: 'Неверный токен' },
        { status: 400 }
      );
    }

    // Проверка наличия tokenExpiry
    if (!user.tokenExpiry) {
      return NextResponse.json(
        { error: 'Токен не имеет срока действия' },
        { status: 400 }
      );
    }

    // Проверка срока действия токена
    const now = new Date();
    const expiry = new Date(user.tokenExpiry);

    if (isNaN(expiry.getTime()) || now > expiry) {
      return NextResponse.json(
        { error: 'Срок действия токена истек' },
        { status: 400 }
      );
    }

    // Проверка, не подтвержден ли уже email
    if (user.emailVerified === 1) {
      return NextResponse.json(
        { message: 'Email уже подтвержден' },
        { status: 200 }
      );
    }

    // Обновление пользователя - подтверждение email
    db.prepare(
      'UPDATE users SET emailVerified = 1, verificationToken = NULL, tokenExpiry = NULL WHERE id = ?'
    ).run(user.id);

    return NextResponse.json(
      { message: 'Email успешно подтвержден!' },
      { status: 200 }
    );

  } catch (error) {
    console.error('Ошибка верификации:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}
