# Whiteboard App

Веб-приложение для работы на виртуальной доске, вдохновлённое Miro, FigJam и Excalidraw.

---

## Стек технологий

- **[Next.js 15](https://nextjs.org/)** — App Router, серверные и клиентские компоненты
- **[Fabric.js 6](http://fabricjs.com/)** — canvas-редактор
- **[SQLite](https://www.sqlite.org/)** через **[better-sqlite3](https://github.com/WiseLibs/better-sqlite3)** — база данных
- **[Resend](https://resend.com/)** — отправка email верификации
- **TypeScript**

---

## Возможности

### 🎨 Инструменты редактора
| Клавиша | Инструмент |
|---------|-----------|
| `V` | Выбор — перемещение, ресайз, поворот |
| `H` | Рука — панорамирование холста |
| `P` | Карандаш — свободное рисование |
| `R` | Прямоугольник |
| `O` | Эллипс |
| `T` | Треугольник |
| `D` | Ромб |
| `L` | Линия |
| `A` | Стрелка с наконечником |
| `X` | Текст — inline-редактирование |
| `S` | Стикер — в стиле Miro |
| `E` | Ластик |
| `I` | Изображение — загрузка с компьютера |

### 🗒️ Стикеры
- Квадратные по умолчанию (200×200)
- Скруглённые углы + загнутый уголок (canvas-рендеринг)
- 8 цветов пастельной палитры
- Текст по центру, редактируемый
- Ресайз по ширине (боковые ручки) и высоте (нижняя ручка)
- Корректно сохраняются и восстанавливаются после reload/undo/redo

### ⚙️ Холст
- **Undo/Redo** — Ctrl+Z / Ctrl+Y, история 60 состояний
- **Зум** — колесо мыши, Ctrl+±, диапазон 5%–2000%
- **Fit to screen** — Ctrl+0
- **Фон** — без фона / точки / сетка (синхронизирован с зумом и паном, сохраняется в БД)
- **Автосохранение** каждые 30 секунд
- **Экспорт PNG** — 2× качество
- **strokeUniform** — толщина обводки не растягивается при масштабировании

### 🤝 Совместная работа
- **Поделиться доской** по email — кнопка в верхней панели
- Шареные пользователи могут **редактировать** доску
- Только владелец может **переименовывать, удалять** доску и **управлять доступом**
- Шареный пользователь может **убрать доску у себя**, не удаляя её у остальных
- На дашборде шареные доски помечены бейджем **«ПОДЕЛЕНО»** и подписью «от {владелец}»

### 🗂️ Дашборд
- Список собственных + шареных досок (сортировка по дате обновления)
- Превью-миниатюры
- Создание, переименование, удаление досок

### 🔐 Аутентификация
- Регистрация с верификацией email (Resend)
- Вход / выход
- Восстановление пароля (forgot/reset)
- HTTP-only cookie сессии, срок 30 дней
- Защита маршрутов через middleware

---

## Структура проекта

```
whiteboard/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   ├── login/route.ts           # Вход
│   │   │   │   ├── logout/route.ts          # Выход
│   │   │   │   ├── me/route.ts              # Текущий пользователь
│   │   │   │   ├── verify-email/route.ts    # Верификация email
│   │   │   │   ├── forgot-password/route.ts # Запрос сброса пароля
│   │   │   │   └── reset-password/route.ts  # Сброс пароля
│   │   │   ├── boards/
│   │   │   │   ├── route.ts                 # GET список (свои + шареные) / POST создать
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts             # GET / PUT / DELETE доска
│   │   │   │       └── share/route.ts       # GET / POST / DELETE доступ
│   │   │   └── user/
│   │   │       └── register/route.ts        # Регистрация
│   │   ├── board/[id]/page.tsx              # Редактор доски
│   │   ├── dashboard/page.tsx               # Дашборд
│   │   ├── login/page.tsx                   # Страница входа
│   │   ├── register/page.tsx                # Страница регистрации
│   │   ├── forgot-password/page.tsx         # Восстановление пароля
│   │   ├── reset-password/page.tsx          # Новый пароль
│   │   ├── verify-email/page.tsx            # Подтверждение email
│   │   ├── page.tsx                         # Главная (Marketing)
│   │   ├── layout.tsx                       # Root layout + Geist шрифт
│   │   └── globals.css                      # Глобальные стили
│   ├── components/
│   │   ├── whiteboard/
│   │   │   ├── Canvas.tsx                   # Fabric.js холст, все 13 инструментов
│   │   │   ├── WhiteboardApp.tsx            # Главный компонент редактора
│   │   │   ├── Toolbar.tsx                  # Левая панель инструментов
│   │   │   ├── TopBar.tsx                   # Верхняя панель
│   │   │   ├── ShareButton.tsx              # Кнопка «Поделиться» + попап
│   │   │   ├── PropertiesPanel.tsx          # Правая панель свойств
│   │   │   └── FloatingToolbar.tsx          # Плавающая панель над объектом
│   │   └── dashboard/
│   │       └── DashboardClient.tsx          # Клиентский дашборд
│   ├── lib/
│   │   └── auth.ts                          # getSessionUser()
│   └── middleware.ts                        # Защита маршрутов
├── lib/
│   └── db.ts                                # SQLite, singleton, создание таблиц
├── .env.example                             # Шаблон переменных окружения
└── README.md
```

---

## База данных

SQLite БД создаётся автоматически при первом запуске (`whiteboard.db`).

### Таблица `users`
| Поле | Тип | Описание |
|------|-----|----------|
| `id` | INTEGER PK | — |
| `name` | TEXT | Имя пользователя |
| `email` | TEXT UNIQUE | Email |
| `password` | TEXT | Хешированный пароль (bcrypt) |
| `emailVerified` | INTEGER | 0 / 1 |
| `verificationToken` | TEXT | Токен подтверждения email |
| `tokenExpiry` | DATETIME | Срок действия токена |
| `resetToken` | TEXT | Токен сброса пароля |
| `resetTokenExpiry` | DATETIME | Срок действия |
| `created_at` | DATETIME | Дата регистрации |

### Таблица `sessions`
| Поле | Тип | Описание |
|------|-----|----------|
| `id` | INTEGER PK | — |
| `userId` | INTEGER FK | Ссылка на пользователя |
| `token` | TEXT UNIQUE | Токен сессии |
| `expiresAt` | DATETIME | Срок действия (30 дней) |
| `created_at` | DATETIME | — |

### Таблица `boards`
| Поле | Тип | Описание |
|------|-----|----------|
| `id` | INTEGER PK | — |
| `userId` | INTEGER FK | Владелец |
| `name` | TEXT | Название доски |
| `canvasState` | TEXT | JSON состояние холста |
| `thumbnail` | TEXT | Base64 превью |
| `bgStyle` | TEXT | `none` / `grid` / `dots` |
| `created_at` | DATETIME | — |
| `updated_at` | DATETIME | — |

### Таблица `board_shares`
| Поле | Тип | Описание |
|------|-----|----------|
| `id` | INTEGER PK | — |
| `boardId` | INTEGER FK | Ссылка на доску |
| `userId` | INTEGER FK | Кому выдан доступ |
| `created_at` | DATETIME | — |

`UNIQUE(boardId, userId)` — нельзя добавить одного пользователя дважды.
При удалении доски или пользователя записи о шаринге удаляются (`ON DELETE CASCADE`).

---

## Запуск

### 1. Клонируй репозиторий
```bash
git clone https://github.com/YOUR_USERNAME/whiteboard-app.git
cd whiteboard-app
```

### 2. Установи зависимости
```bash
npm install
```

### 3. Настрой переменные окружения
```bash
cp .env.example .env.local
```

Заполни `.env.local`:
```env
RESEND_API_KEY=re_xxxxxxx        # resend.com — бесплатный аккаунт
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> **Без `RESEND_API_KEY`** приложение работает, но письма верификации не отправляются.

### 4. Запусти
```bash
npm run dev
```

Открой [http://localhost:3000](http://localhost:3000)

---

## Горячие клавиши редактора

| Клавиша | Действие |
|---------|----------|
| `Ctrl+Z` | Отмена |
| `Ctrl+Y` | Повтор |
| `Ctrl+S` | Сохранить |
| `Ctrl+0` | По экрану |
| `Ctrl++` | Увеличить |
| `Ctrl+-` | Уменьшить |
| `Del` | Удалить выбранное |
| `Esc` | Инструмент «Выбор» |

---

## API

### Доски
- `GET /api/boards` — список своих + шареных досок
- `POST /api/boards` — создать доску
- `GET /api/boards/[id]` — получить доску (владелец или шареный)
- `PUT /api/boards/[id]` — обновить (владелец или шареный)
- `DELETE /api/boards/[id]` — владелец удаляет полностью; шареный снимает доступ только у себя

### Шаринг
- `POST /api/boards/[id]/share` — выдать доступ по email (только владелец)
- `GET /api/boards/[id]/share` — список пользователей с доступом (только владелец)
- `DELETE /api/boards/[id]/share?userId=N` — забрать доступ (только владелец)

### Аутентификация
- `POST /api/user/register` — регистрация + отправка письма верификации
- `GET /api/auth/verify-email?token=...` — подтверждение email
- `POST /api/auth/login` — вход
- `POST /api/auth/logout` — выход
- `GET /api/auth/me` — текущий пользователь
- `POST /api/auth/forgot-password` — запрос сброса пароля
- `POST /api/auth/reset-password` — установка нового пароля
