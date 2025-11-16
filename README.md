# Whiteboard

Веб-приложение для создания заметок с системой регистрации и email-верификацией.

## Дизайн

[Figma макет проекта](https://www.figma.com/design/5KZ30KFAP4z7pGsQs9FkeN/Untitled?node-id=0-1&t=OMim40eyzJilbrZ3-1)

## Технологии

- **Next.js 15** - React фреймворк
- **TypeScript** - типизация
- **SQLite** (better-sqlite3) - база данных
- **bcryptjs** - хеширование паролей
- **Resend** - отправка email

## Установка

```bash
npm install
```

## Переменные окружения

Создайте `.env.local` в корне проекта:

```env
RESEND_API_KEY=your_resend_api_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Запуск

```bash
# Разработка
npm run dev

# Production
npm run build
npm start
```

## Структура проекта

```
whiteboard/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/verify-email/route.ts    # Верификация email
│   │   │   └── user/register/route.ts        # Регистрация
│   │   ├── register/page.tsx                 # Страница регистрации
│   │   ├── verify-email/page.tsx             # Страница верификации
│   │   └── page.tsx                          # Главная
│   └── components/
│       ├── main_page/                        # Компоненты главной
│       └── registration_page/                # Компоненты регистрации
├── lib/
│   └── db.ts                                 # Конфигурация БД
└── whiteboard.db                             # SQLite база данных
```

## База данных

SQLite БД создается автоматически при первом запуске. Структура таблицы `users`:

- `id` - PRIMARY KEY
- `name` - имя пользователя
- `email` - email (UNIQUE)
- `password` - хешированный пароль
- `emailVerified` - статус верификации (0/1)
- `verificationToken` - одноразовый токен
- `tokenExpiry` - срок действия токена
- `created_at` - дата создания

## API

### POST `/api/user/register`
Регистрация пользователя с отправкой email

**Body:**
```json
{
  "name": "string",
  "email": "string",
  "password": "string"
}
```

### GET `/api/auth/verify-email?token=xxx`
Подтверждение email по токену из письма
