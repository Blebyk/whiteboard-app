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
- Корректно сохраняются и восстанавливаются

### ⚙️ Холст
- **Undo/Redo** — Ctrl+Z / Ctrl+Y, история 60 состояний
- **Зум** — колесо мыши, Ctrl+±, диапазон 5%–2000%
- **Fit to screen** — Ctrl+0
- **Фон** — без фона / точки / сетка (синхронизирован с зумом и паном)
- **Автосохранение** каждые 30 секунд
- **Экспорт PNG** — 2× качество
- **strokeUniform** — толщина обводки не растягивается при масштабировании

### 🗂️ Дашборд
- Список всех досок пользователя
- Превью-миниатюры
- Создание, переименование, удаление досок

### 🔐 Аутентификация
- Регистрация с верификацией email (Resend)
- Вход / выход
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
│   │   │   │   ├── login/route.ts          # Вход
│   │   │   │   ├── logout/route.ts         # Выход
│   │   │   │   ├── me/route.ts             # Текущий пользователь
│   │   │   │   └── verify-email/route.ts   # Верификация email
│   │   │   ├── boards/
│   │   │   │   ├── route.ts                # GET список / POST создать доску
│   │   │   │   └── [id]/route.ts           # GET / PUT / DELETE доска
│   │   │   └── user/
│   │   │       └── register/route.ts       # Регистрация
│   │   ├── board/[id]/page.tsx             # Редактор доски
│   │   ├── dashboard/page.tsx              # Дашборд
│   │   ├── login/page.tsx                  # Страница входа
│   │   ├── register/page.tsx               # Страница регистрации
│   │   ├── verify-email/page.tsx           # Подтверждение email
│   │   └── page.tsx                        # Главная
│   ├── components/
│   │   ├── whiteboard/
│   │   │   ├── Canvas.tsx                  # Fabric.js холст, все 13 инструментов
│   │   │   ├── WhiteboardApp.tsx           # Главный компонент редактора
│   │   │   ├── Toolbar.tsx                 # Левая панель инструментов
│   │   │   ├── TopBar.tsx                  # Верхняя панель (имя, сохранение, зум)
│   │   │   └── PropertiesPanel.tsx         # Правая панель свойств
│   │   ├── dashboard/
│   │   │   └── DashboardClient.tsx         # Клиентский дашборд
│   │   ├── main_page/                      # Компоненты главной страницы
│   │   └── registration_page/              # Компоненты регистрации
│   ├── lib/
│   │   └── auth.ts                         # getSessionUser()
│   └── middleware.ts                       # Защита маршрутов
├── lib/
│   └── db.ts                               # SQLite, singleton, создание таблиц
├── .env.example                            # Шаблон переменных окружения
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
| `verificationToken` | TEXT | Одноразовый токен |
| `tokenExpiry` | DATETIME | Срок действия токена |
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
| `created_at` | DATETIME | — |
| `updated_at` | DATETIME | — |

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
