# CLAUDE.md — INTERA Project Instructions

> Этот файл — полная инструкция для Claude Code по проекту INTERA.
> Читай его целиком перед тем как писать любой код.
> При любом сомнении — возвращайся сюда.

---

## 1. ЧТО МЫ СТРОИМ

**INTERA** — веб-приложение для AI-визуализации интерьеров для российского рынка.

Пользователь загружает фото комнаты или план БТИ, выбирает стиль и бюджет —
и получает фотореалистичные рендеры с объяснениями дизайнера и списком покупок.

### Главный принцип продукта
Это не "генератор красивых картинок". Это **geometry-preserving interior copilot**:
геометрически стабильные рендеры + объяснение решений "как дизайнер" +
бюджетные диапазоны + список покупок с российскими маркетплейсами.

### Ключевой дифференциатор
В основе — база знаний профессионального дизайнера интерьеров:
эргономика, принципы расстановки, цветовые решения, световые сценарии,
ценовые диапазоны по сегментам (эконом / средний / премиум).

---

## 2. СТЕК ТЕХНОЛОГИЙ

```
Frontend:     Next.js 14 (App Router) + TypeScript + Tailwind CSS
Backend:      Next.js API Routes (модульный монолит, не микросервисы)
Database:     Supabase (PostgreSQL + Auth + Storage + Realtime)
Deploy:       Vercel

AI-текст:     Groq API (LLaMA 3.3 70B) — ОСНОВНОЙ AI модуль, бесплатно
              Промпты, объяснения дизайнера, смета, анализ брифа

AI-план:      Anthropic Claude Vision API — парсинг плана БТИ → JSON
              Вызывается 1 раз при загрузке плана, ~0.8 ₽

AI-рендеры:   Replicate API (основной) — ControlNet + FLUX, ~17–23 ₽/4 рендера
              fal.ai (следующий тест, Phase 2) — быстрее + дешевле, проверить качество

3D-якорь:     Three.js на Vercel serverless — JSON → 3D → depth map
              Бесплатно, < 2 сек, synthetic depth map лучше реального

Depth-фото:   Depth Anything v2 (fal.ai) — только для режима "фото"

Платежи:      ЮКасса (рубли, МИР, СБП, Visa/MC)
SMS:          sms.ru
OAuth:        ВКонтакте + Google
Маркетплейс: Яндекс.Маркет API (заглушка в MVP, Phase 2)
```

---

## 3. ПЕРЕМЕННЫЕ ОКРУЖЕНИЯ

Все ключи хранятся в `.env.local`. Никогда не коммить этот файл в Git.
`.env.local` уже добавлен в `.gitignore`.

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=

# AI — рендеры (fal.ai основной, Replicate fallback)
FAL_KEY=                          # fal.ai — резерв (тестировать в Phase 2)
REPLICATE_API_TOKEN=              # Replicate — ОСНОВНОЙ провайдер рендеров

# AI — текст и парсинг
GROQ_API_KEY=                     # ОСНОВНОЙ AI: промпты, объяснения, смета
ANTHROPIC_API_KEY=                # парсинг планов БТИ (Claude Vision)
OPENAI_API_KEY=                   # резерв: GPT-5.5 Vision (альтернатива парсинга)

# Генерация — параметры точности
CONTROLNET_WEIGHT=1.2             # 1.0 мягко / 1.2 оптимум / 1.5 жёстко
DEFAULT_CEILING_HEIGHT_MM=2700    # переопределяется выбором пользователя
GENERATION_PROVIDER=replicate     # replicate (основной) | fal (тест Phase 2)

# OAuth
VK_CLIENT_ID=
VK_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Платежи и SMS
YUKASSA_SHOP_ID=
YUKASSA_SECRET_KEY=
SMSRU_API_KEY=

# Яндекс (Phase 2)
YANDEX_MARKET_TOKEN=
YANDEX_CAMPAIGN_ID=

# App
NEXTAUTH_SECRET=
NEXTAUTH_URL=

# Фичи (включать/выключать без деплоя)
BETA_QA_MODE=true
TOURS_ENABLED=false
MARKETPLACE_ENABLED=false
BETA_QA_PROJECT_LIMIT=50

# Admin
ADMIN_EMAIL=                      # из личного хранилища
ADMIN_PASSWORD=                   # из личного хранилища

# Cost Guards
MAX_COST_PER_GENERATION_RUB=35
MAX_DAILY_PROVIDER_SPEND_RUB=500
MAX_RETRIES_PER_GENERATION=2
GENERATION_TIMEOUT_SEC=120
```

---

## 4. СТРУКТУРА ПРОЕКТА

```
intera/
├── CLAUDE.md                    ← этот файл
├── .env.local                   ← ключи (не в Git)
├── .env.example                 ← шаблон без значений (в Git)
├── .gitignore
├── next.config.ts
├── tailwind.config.ts
├── package.json
│
├── app/                         ← Next.js App Router
│   ├── layout.tsx               ← корневой layout
│   ├── page.tsx                 ← лендинг /
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (app)/                   ← защищённые маршруты
│   │   ├── dashboard/page.tsx   ← главная после логина
│   │   ├── projects/
│   │   │   ├── page.tsx         ← список проектов
│   │   │   ├── new/page.tsx     ← создание проекта
│   │   │   └── [id]/page.tsx    ← детали проекта
│   │   ├── profile/page.tsx
│   │   └── tokens/page.tsx      ← магазин токенов
│   ├── admin/                   ← только для ROLE=admin
│   │   ├── page.tsx             ← дашборд
│   │   ├── users/page.tsx
│   │   ├── generations/page.tsx
│   │   ├── tokens/page.tsx
│   │   ├── finances/page.tsx
│   │   └── settings/page.tsx
│   └── api/
│       ├── auth/[...nextauth]/route.ts
│       ├── upload/route.ts
│       ├── generate/route.ts
│       ├── status/[id]/route.ts
│       ├── results/[id]/route.ts
│       ├── tokens/
│       │   ├── balance/route.ts
│       │   ├── spend/route.ts
│       │   └── grant/route.ts   ← только для admin
│       ├── products/route.ts    ← Яндекс.Маркет
│       └── webhooks/
│           ├── replicate/route.ts
│           └── yukassa/route.ts
│
├── components/
│   ├── ui/                      ← базовые компоненты
│   ├── auth/
│   ├── projects/
│   ├── generation/
│   ├── results/
│   ├── admin/
│   └── shared/
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── types.ts             ← сгенерированные типы
│   ├── ai/
│   │   ├── adapter.ts           ← ADAPTER PATTERN (обязательно)
│   │   ├── replicate.ts
│   │   ├── groq.ts
│   │   └── depth.ts             ← Depth Anything v2
│   ├── payments/
│   │   └── yukassa.ts
│   ├── sms/
│   │   └── smsru.ts
│   └── utils/
│       ├── anonymize.ts         ← ВАЖНО: анонимизация до Replicate
│       └── validation.ts
│
└── supabase/
    └── migrations/              ← SQL миграции
```

---

## 5. СХЕМА БАЗЫ ДАННЫХ

### Таблица: users (расширение auth.users Supabase)
```sql
CREATE TABLE public.profiles (
  id            UUID REFERENCES auth.users PRIMARY KEY,
  name          TEXT,
  phone         TEXT,
  role          TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  plan          TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  token_balance INTEGER DEFAULT 1,  -- 1 бесплатный токен при регистрации
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
```
Add this rule to CLAUDE.md in the Supabase section, 
after the tables list:

## SUPABASE CRITICAL RULES
- profiles table has NO email column
- email is ALWAYS stored in auth.users (Supabase Auth)
- To get email: use profiles_with_email VIEW or auth.admin.listUsers()
- To find user by email: ALWAYS use auth.admin.listUsers() first
- NEVER query profiles.email directly — it will throw a runtime error
- profiles_with_email view already exists and has GRANT for authenticated + service_role

Find the right place in CLAUDE.md and insert this block there.
### Таблица: projects
```sql
CREATE TABLE public.projects (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  room_type     TEXT,   -- гостиная / спальня / кухня / ванная / студия
  style         TEXT,   -- скандинавский / минимализм / лофт / классика / современный
  budget_level  TEXT,   -- эконом / средний / премиум
  status        TEXT DEFAULT 'draft',
                        -- draft / uploading / processing / done / error
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
```

### Таблица: generations
```sql
CREATE TABLE public.generations (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id       UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  replicate_id     TEXT,           -- ID предсказания в Replicate
  anon_uuid        TEXT UNIQUE,    -- анонимный ID отправленный в Replicate
  status           TEXT DEFAULT 'pending',
                                   -- pending / processing / done / failed
  render_urls      TEXT[],         -- массив URL готовых рендеров
  depth_map_url    TEXT,           -- URL depth map (в Supabase Storage)
  prompt_used      TEXT,
  designer_text    JSONB,          -- объяснения от Groq
  shopping_items   JSONB,          -- список товаров от Яндекс.Маркет
  budget_range     JSONB,          -- {min: N, max: N, currency: 'RUB'}
  error_message    TEXT,
  processing_time  INTEGER,        -- секунды
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
```

### Таблица: token_transactions
```sql
CREATE TABLE public.token_transactions (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES public.profiles(id),
  amount      INTEGER NOT NULL,   -- положительное = начисление, отрицательное = списание
  type        TEXT NOT NULL,
              -- purchase / generation / refund / manual_grant / promo
  reason      TEXT,
  granted_by  UUID REFERENCES public.profiles(id),  -- для manual_grant
  project_id  UUID REFERENCES public.projects(id),  -- для generation
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### Таблица: payments
```sql
CREATE TABLE public.payments (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID REFERENCES public.profiles(id),
  yukassa_id      TEXT UNIQUE,
  amount          INTEGER NOT NULL,    -- сумма в рублях
  tokens_granted  INTEGER NOT NULL,
  package_id      TEXT,                -- eskiz / project / studio
  status          TEXT DEFAULT 'pending',
                  -- pending / succeeded / canceled / refunded
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 6. ТОКЕННАЯ МОДЕЛЬ (МОНЕТИЗАЦИЯ)

### Логика токенов

```
1 токен = 1 помещение = 1 генерация

Количество рендеров зависит от типа проекта:
  project_type = 'room'       → num_samples = 4 рендера
  project_type = 'apartment'  → num_samples = 2 рендера на помещение

При регистрации: 5 бесплатных токенов автоматически
Себестоимость 5 токенов: ~115 ₽ (CAC через freemium)

Токен списывается ТОЛЬКО после успешной генерации.
Если Replicate вернул ошибку — токен возвращается автоматически.
Токены списываются за ВСЕ выбранные комнаты ДО начала генерации.
Генерация не запускается если баланс недостаточен.
```

### Пакеты токенов

```
┌──────────┬─────────────────────────┬──────────┬───────────┬────────┐
│ Пакет    │ Состав                  │ Цена     │ ₽/токен   │ Маржа  │
├──────────┼─────────────────────────┼──────────┼───────────┼────────┤
│ Старт    │ 20 токенов              │ 1 990 ₽  │ 99.5 ₽    │  80%   │
│ Профи    │ 50 токенов              │ 4 490 ₽  │ 89.8 ₽    │  77.7% │
│ Студия   │ 100 токенов + 10 туров  │ 9 490 ₽  │ 94.9 ₽    │  76.3% │
└──────────┴─────────────────────────┴──────────┴───────────┴────────┘

Себестоимость:
  Комната (4 рендера):     ~23 ₽/токен
  Квартира (2 рендера):    ~17 ₽/токен
  Blended среднее:         ~20 ₽/токен
  3D тур (img2video):      ~25 ₽/тур

Минимальная маржа: 75% — не опускаться ниже при любых изменениях цен.
Cost guard лимит: 35 ₽ на генерацию (поднят с 25 ₽ из-за Pro Geometry).
```

### 3D туры (Студия пакет)

```
TOURS_ENABLED=false  ← флаг в .env до завершения тестирования

В UI пакета Студия показывать: "10 3D туров включено"
Кнопка генерации тура: активна только если TOURS_ENABLED=true
Иначе: "Скоро — ваши туры будут доступны после запуска функции"

Технология: Stable Video Diffusion через Replicate (img2video)
Длительность: 3–5 секунд на комнату
```

### Free vs Paid — права на файлы

```
┌─────────────────────────────┬──────────────┬────────────────┐
│ Действие                    │ Free (5 ток.)│ Paid           │
├─────────────────────────────┼──────────────┼────────────────┤
│ Генерировать                │ ✅           │ ✅             │
│ Просматривать рендеры       │ ✅           │ ✅             │
│ Поделиться ссылкой          │ ✅ 7 дней    │ ✅ бессрочно   │
│ Скачать JPG/PNG             │ ❌           │ ✅             │
│ Скачать PDF-смету           │ ❌           │ ✅             │
│ Хранение проектов           │ ❌ удал. 7д  │ ✅ бессрочно   │
└─────────────────────────────┴──────────────┴────────────────┘

Ссылки генерировать через Supabase Storage signed URLs:
  Free:  expires_in = 604800  (7 дней)
  Paid:  expires_in = null    (бессрочно)
```

---

## 7. AI-ПАЙПЛАЙН ГЕНЕРАЦИИ (КРИТИЧЕСКИ ВАЖНО)

> Два режима входных данных — разные пайплайны.
> Оба стоят 1 токен. Результат разный по точности.
> CubiCasa пайплайн — критически важен, реализовать в MVP.

---

### Режим A: Только план БТИ → Основной пайплайн (68–78/100)

> Основной режим продукта. Большинство пользователей новостроек
> имеют только план застройщика. Точность зависит от качества скана.

#### Точность по 100-балльной шкале

```
Идеальный скан плана:
  Claude Vision парсинг:   −8 баллов  (края чёткие, но масштаб/высота неизвестны)
  Three.js высоты:         −8 баллов  (стандарт 2.7 м — может отличаться от реального)
  ControlNet свобода:      −6 баллов  (control_weight 1.2 = 20% творческой свободы)
  Итого:                   78/100

Средний скан:
  Claude Vision парсинг:   −15 баллов (артефакты сжатия, размытые линии)
  Three.js высоты:         −8 баллов
  ControlNet свобода:      −6 баллов
  Итого:                   71/100

Плохой скан / нестандартный план:
  Claude Vision парсинг:   −22 баллов
  Three.js высоты:         −8 баллов
  ControlNet свобода:      −6 баллов
  Итого:                   64/100

Рабочая точность: 68–78/100
```

#### Почему не 100 — технические причины

```
1. Высота потолка неизвестна из плана БТИ
   План показывает только вид сверху, высота нигде не указана.
   Хрущёвка = 2.5 м, сталинка = 3.2 м, новостройка = 2.7–3.0 м.
   Ошибка 15–20% по высоте визуально заметна на рендере.
   РЕШЕНИЕ: поле выбора высоты потолка в UI → убирает −8 баллов → 76–86/100

2. Качество скана определяет точность парсинга
   Сжатый JPEG размывает разницу между несущей (380 мм) и перегородкой (120 мм).
   Claude Vision может неверно прочитать размерные отметки.
   РЕШЕНИЕ: в UI просить загружать план минимум 1200×1600 px

3. ControlNet не даёт 100% жёсткости геометрии
   control_weight: 1.2 = 80% геометрии из depth map + 20% творческая интерпретация.
   При 1.5 — геометрия жёсткая, но рендеры "деревянные", теряется фотореализм.
   ОПТИМУМ: 1.2 для баланса точности и качества

4. Synthetic depth map vs реальный мир
   Three.js строит идеальную коробку. Реальная квартира имеет скосы,
   выступы труб, короба, арки. Они не отражены в плане.
```

#### Пайплайн шаг за шагом

```
Шаг 1 — DeepSeek-VL2 на Replicate (~2.6 ₽) | Groq 90B Vision (~0 ₽ тест)
   Вход: изображение плана БТИ (JPEG/PNG/PDF)
   Модель: deepseek-ai/deepseek-vl2 (основной) или llama-3.2-90b-vision-preview (тест)
   Выход: JSON {rooms, walls, doors, windows, scale, total_area}
   Переключение: FLOOR_PLAN_PARSER=deepseek_replicate | groq_90b
   Определяет несущие стены по толщине линий
   Читает размерные отметки и масштаб плана

Шаг 2 — Three.js на Vercel serverless (~0 ₽, < 2 сек)
   JSON → 3D коробка комнаты
   Высота: из выбора пользователя или DEFAULT_CEILING_HEIGHT_MM
   Проёмы дверей: высота 2100 мм (стандарт)
   Проёмы окон: из JSON + высота от пола из JSON
   Камера: центр комнаты, высота глаз 1600 мм, FOV 75°
   Рендер depth pass → grayscale PNG → Supabase Storage

Шаг 3 — Анонимизация (ОБЯЗАТЕЛЬНО, ~0 ₽)
   anon_uuid = crypto.randomUUID()
   В fal.ai уходит ТОЛЬКО: anon_uuid + depth_map_url
   Никакого адреса, user_id, ФИО в промпте

Шаг 4 — Groq строит промпт (~0 ₽, ОСНОВНОЙ AI)
   Вход: стиль + бюджет + тип комнаты + пожелания
   Выход: style_prompt + negative_prompt
   "Scandinavian living room, light wood, soft natural light, 8k photorealistic"
   Negative: "bad geometry, distorted walls, cartoon, watermark, text"

Шаг 5 — fal.ai ControlNet × 2 прохода (~8 ₽)
   Модель: fal-ai/flux-controlnet (FLUX + ControlNet Depth)
   Вход: depth_map + style_prompt
   control_weight: 1.2 — ГЕОМЕТРИЯ НЕ ПЛАВАЕТ
   Проход 1: крупная геометрия (стены, потолок, пол)
   Проход 2: control_weight 1.3 — мелкие детали (двери, ниши, окна)
   num_outputs: 4 (комната) / 2 (квартира)
   Время: ~15–25 сек
   Fallback: если fal.ai недоступен → автоматически Replicate

Шаг 6 — Groq: объяснения дизайнера (~0 ₽, параллельно с шагом 5)
   Structured JSON output:
   {furniture_placement, color_solution, lighting, budget_range}

Итого COGS: ~9–10 ₽
Маржа при 99.5 ₽/токен: ~90%
Точность геометрии: 68–78/100 (76–86/100 с высотой потолка от пользователя)
```

---

### Режим B: Фото комнаты → дополнительный (82–88/100)

```
Шаг 1 — Strip EXIF + анонимизация (~0 ₽)
Шаг 2 — Depth Anything v2 через fal.ai (~1 ₽)
   Реальная depth map: мебель, ниши, реальная высота
Шаг 3 — Groq: промпт (~0 ₽)
Шаг 4 — fal.ai ControlNet (~8 ₽), control_weight: 1.2
Шаг 5 — Groq: объяснения (~0 ₽)

Итого COGS: ~9–11 ₽
Точность: 82–88/100
```

---

### Режим C: План + Фото → Комбинированный (91–93%) [Phase 2]

```
Шаг 1 — CubiCasa парсинг плана → точные размеры стен
Шаг 2 — Depth Anything v2 из фото → реальная глубина
Шаг 3 — Совмещение: калибруем depth map по известным размерам из плана
         Опция: лист А4 в кадре как AR-метка для точного масштаба
Шаг 4–7 — Стандартный пайплайн

Точность: ~91–93%
```

---

### Режим D: LiDAR iPhone Pro (95–98%) [Phase 3]

```
Шаг 1 — WebXR API: пользователь сканирует комнату 30 сек
Шаг 2 — Готовый 3D mesh с точностью 2–5 мм
Шаг 3–7 — Стандартный пайплайн

Точность: ~95–98%
Требование: iPhone 12 Pro и новее
```

---

### Adapter Pattern — ОБЯЗАТЕЛЬНО

```typescript
// lib/ai/adapter.ts
// ВСЕ вызовы генерации только через этот адаптер

export type GenerationProvider = 'fal' | 'replicate' | 'self_hosted'
export type DepthSource = 'claude_vision_3d' | 'depth_anything' | 'lidar'

export interface GenerationParams {
  depthMapUrl: string
  depthSource: DepthSource
  prompt: string           // собирает Groq
  negativePrompt: string   // собирает Groq
  numOutputs: 2 | 4
  controlWeight: number    // default: 1.2
  roomType: string
  anonUuid: string
}

async function generate(params: GenerationParams): Promise<string[]> {
  const provider = process.env.GENERATION_PROVIDER as GenerationProvider
  try {
    if (provider === 'replicate') return await generateReplicate(params)
    if (provider === 'fal') return await generateFal(params)
    return await generateReplicate(params)
  } catch (e) {
    // Автофallback: если fal упал → Replicate
    return await generateReplicate(params)
  }
}
```

---

### Структура файлов пайплайна

```
lib/ai/
├── adapter.ts           ← единственная точка входа
├── floorPlanParser.ts   ← DeepSeek-VL2 (Replicate): план БТИ → JSON
│                          резерв: Groq LLaMA 3.2 90B Vision
├── floorPlan3D.ts       ← Three.js: JSON → 3D → depth map
├── depthAnything.ts     ← Depth Anything v2 из фото
├── fal.ts               ← fal.ai ControlNet (основной)
├── replicate.ts         ← Replicate (fallback)
└── groq.ts              ← ОСНОВНОЙ AI: промпты + объяснения
```

---

### UI — выбор высоты потолка (обязательное поле, +8 баллов точности)

```
Экран параметров:

Высота потолков:
○ Стандарт 2.7 м    ← новостройки
○ Низкие 2.5 м      ← хрущёвки, старый фонд
○ Высокие 3.0 м     ← сталинки, премиум
○ Указать вручную: [____] м

Это поле убирает -8 баллов потерь на высоте.
Без него: 68–78/100. С ним: 76–86/100.
```

---

### Итоговая таблица точности и стоимости

```
┌──────────────────────┬──────────────┬──────────┬──────────┐
│ Режим                │ Точность     │ COGS     │ Статус   │
├──────────────────────┼──────────────┼──────────┼──────────┤
│ План БТИ             │ 68–78/100    │ ~9–10 ₽  │ MVP ✅   │
│ + высота от юзера    │ 76–86/100    │ ~9–10 ₽  │ MVP ✅   │
│ Фото комнаты         │ 82–88/100    │ ~9–11 ₽  │ MVP ✅   │
│ План + фото          │ 88–93/100    │ ~11–13 ₽ │ Phase 2  │
│ LiDAR iPhone Pro     │ 95–97/100    │ ~9–11 ₽  │ Phase 3  │
├──────────────────────┼──────────────┼──────────┼──────────┤
│ Маржа (99.5₽/ток)   │              │          │ ~89–91%  │
└──────────────────────┴──────────────┴──────────┴──────────┘

Replicate основной: ~45–60 сек, pay-as-you-go, проверенный
fal.ai (Phase 2 тест): ~15–25 сек, pay-as-you-go, дешевле × 2
Groq:              бесплатно, основной AI модуль
control_weight:    1.2 оптимум — геометрия не плавает
Cost guard:        35 ₽ лимит на генерацию
```


---

### Превью через YandexART (UX)

```
При нажатии "Сгенерировать":
→ СРАЗУ (3 сек):    YandexART text-to-image → показать атмосферный превью
→ ПАРАЛЛЕЛЬНО:      CubiCasa / Depth → ControlNet (45–90 сек)
→ Когда готово:     заменяем превью точным рендером
```

---

## 8. ДЕТЕКЦИЯ ПОМЕЩЕНИЙ ИЗ ПЛАНА БТИ

> Критически важный блок. Генерация не запускается
> пока не подтверждён баланс токенов на ВСЕ выбранные помещения.

### Полный классификатор типов помещений

```typescript
// lib/ai/roomDetector.ts

export const ROOM_TYPES = {

  // Визуализируются — токен списывается
  VISUALIZABLE: {
    living_room:        'Гостиная',
    bedroom_main:       'Спальня',
    bedroom_child:      'Детская',
    bedroom_guest:      'Гостевая спальня',
    office:             'Кабинет',
    kitchen:            'Кухня',
    kitchen_living:     'Кухня-гостиная',  // считается как 1 токен
    hallway:            'Прихожая / коридор',
    bathroom:           'Ванная комната',   // отдельная
    toilet:             'Туалет',           // отдельный
    bathroom_combined:  'Санузел совмещённый', // ванная + туалет = 1 токен
    bathroom_2:         'Санузел № 2',      // в больших квартирах
    balcony:            'Балкон / лоджия',  // опционально
    dressing_room:      'Гардеробная',      // опционально
  },

  // НЕ визуализируются — токен не списывается
  NON_VISUALIZABLE: {
    storage:            'Кладовая',
    technical_balcony:  'Технический балкон',
    elevator_shaft:     'Шахта лифта',
    stairwell:          'Лестничная клетка',
  }
}

// Логика санузла
// AI определяет тип по площади и наличию сантехники на плане:
//   < 4 м² с одним сантехприбором → toilet (отдельный туалет)
//   4–8 м² с двумя приборами → bathroom (отдельная ванная)
//   > 4 м² с тремя+ приборами → bathroom_combined (совмещённый)
//   Два отдельных помещения с санузлом → bathroom + toilet (2 токена)
```

### Сценарии санузла — примеры

```
Сценарий 1: Раздельный санузел (стандартная планировка)
  Ванная комната ──── 1 токен
  Туалет ──────────── 1 токен
  Итого: 2 токена

Сценарий 2: Совмещённый санузел (студии, небольшие квартиры)
  Санузел совмещённый ─ 1 токен
  Итого: 1 токен

Сценарий 3: Два санузла (большие квартиры, пентхаусы)
  Санузел № 1 ─────── 1 токен
  Санузел № 2 ─────── 1 токен
  Итого: 2 токена
```

### UI — экран подтверждения перед генерацией

```
После загрузки плана показать ОБЯЗАТЕЛЬНО:

┌─────────────────────────────────────────────┐
│ Обнаружено в плане: 3-комнатная квартира     │
│ 74 м²                                        │
├─────────────────────────────────────────────┤
│ ☑ Гостиная                      1 токен     │
│ ☑ Спальня                       1 токен     │
│ ☑ Детская                       1 токен     │
│ ☑ Кухня-гостиная                1 токен     │
│ ☑ Прихожая                      1 токен     │
│ ☑ Санузел совмещённый           1 токен     │
│ — Кладовая          не визуализируется       │
├─────────────────────────────────────────────┤
│ Выбрано: 6 помещений = 6 токенов            │
│ Ваш баланс: 20 токенов  ✅                   │
│ Останется после: 14 токенов                 │
├─────────────────────────────────────────────┤
│ [Снять отметку] [Выбрать всё]               │
│ [Сгенерировать — 6 токенов  →]              │
└─────────────────────────────────────────────┘

Если баланс недостаточен:
│ Ваш баланс: 3 токена  ⚠️ Нужно ещё 3       │
│ [Пополнить токены]  [Выбрать 3 комнаты]    │
```

### Правила детекции — жёсткие

```typescript
// ОБЯЗАТЕЛЬНЫЕ проверки перед запуском генерации:

async function validateBeforeGenerate(
  rooms: Room[],
  userId: string
): Promise<ValidationResult> {

  const requiredTokens = rooms
    .filter(r => r.selected && r.visualizable)
    .length

  const balance = await getTokenBalance(userId)

  if (balance < requiredTokens) {
    return {
      ok: false,
      error: 'INSUFFICIENT_TOKENS',
      required: requiredTokens,
      current: balance,
      missing: requiredTokens - balance
    }
  }

  // Списать ВСЕ токены АТОМАРНО до старта генерации
  await spendTokensAtomic(userId, requiredTokens)

  return { ok: true, requiredTokens }
}

// Атомарное списание — либо все, либо никакие
// Использовать Supabase транзакцию (rpc)
// Если транзакция упала — ни один токен не списан
```

### 8.1 Дисклеймер в UI (везде где показываются рендеры)

Показывать на КАЖДОМ экране с результатами генерации:

```
⚠️ Концептуальная AI-визуализация. Не является рабочей
документацией, строительным проектом или гарантией
соответствия реальным размерам. Для точных расчётов
обратитесь к профессиональному дизайнеру.
```

Компонент: `components/shared/AIDisclaimer.tsx`
Обязателен на: `/projects/[id]`, в PDF-экспорте, в шапке результатов.

### 8.2 Маркировка AI-контента

На каждом рендере — водяной знак или бейдж:
```
🤖 Создано с помощью ИИ
```
Размер: мелкий, в углу. Не мешает просмотру.

### 8.3 Права на AI-output (пользовательское соглашение)

Добавить в Terms of Service:
```
Права на сгенерированные изображения принадлежат пользователю.
INTERA сохраняет право использовать обезличенные данные для
улучшения сервиса. Пользователь не вправе использовать
визуализации как рабочую проектную документацию.
```

### 8.4 152-ФЗ — Архитектурные требования

```typescript
// lib/utils/anonymize.ts
// Вызывать ПЕРЕД любой отправкой данных во внешние сервисы

export function createAnonSession(userId: string): AnonSession {
  return {
    anonUuid: crypto.randomUUID(),  // UUID без связи с userId
    timestamp: Date.now(),
    // userId НИКОГДА не уходит за пределы Supabase
  }
}

// Supabase Storage — регион EU West (Франкфурт)
// Данные пользователей: только в Supabase
// В Replicate уходит: только anonUuid + depth_map
// В Groq уходит: только текстовый бриф без PII
```

### 8.5 Бюджетные диапазоны — показывать, не точные суммы

```typescript
// ПРАВИЛЬНО: диапазоны
"Диван угловой: от 38 000 до 75 000 ₽"
"Общий бюджет зоны: 45 000 — 120 000 ₽"

// НЕПРАВИЛЬНО: точные суммы
"Диван: 42 500 ₽"  // цена меняется, вызывает претензии
```

---

## 9. СТРАНИЦЫ И МАРШРУТЫ

### Публичные (без авторизации)
```
/              ← лендинг с примерами рендеров и ценами
/login         ← вход через VK / Google / email
/register      ← регистрация
/privacy       ← политика конфиденциальности (152-ФЗ)
/terms         ← пользовательское соглашение
```

### Защищённые (нужна авторизация)
```
/dashboard           ← главная: создать проект + последние проекты
/projects            ← список всех проектов
/projects/new        ← мастер создания: загрузка → параметры → предпочтения
/projects/[id]       ← результаты: рендеры + объяснения + покупки
/profile             ← настройки аккаунта
/tokens              ← магазин токенов + история
```

### Только для администратора (role = 'admin')
```
/admin               ← дашборд: метрики дня
/admin/users         ← таблица пользователей
/admin/generations   ← галерея всех генераций
/admin/tokens        ← управление токенами (ручное начисление)
/admin/finances      ← платежи и выручка
/admin/settings      ← тарифы, AI-движок, команда
```

---

## 10. КОМПОНЕНТЫ — КЛЮЧЕВЫЕ

### TokenBalance
```tsx
// Показывать в хедере на всех защищённых страницах
// Обновлять в реальном времени через Supabase Realtime
<TokenBalance userId={user.id} />
// Отображение: 🪙 3 токена
```

### GenerationProgress
```tsx
// Экран загрузки с прогрессом
// Polling /api/status/[id] каждые 3 сек
// Показывать шаги: анализ → стиль → генерация
<GenerationProgress generationId={id} onComplete={handleDone} />
```

### RenderGallery
```tsx
// 4 рендера в сетке 2x2
// Тап = полноэкранный просмотр
// Свайп между вариантами
// В углу каждого рендера: бейдж "Создано с помощью ИИ"
<RenderGallery urls={generation.render_urls} />
```

### AIDisclaimer (ОБЯЗАТЕЛЬНЫЙ компонент)
```tsx
// Показывать под каждой галереей рендеров
// Нельзя убрать или скрыть
<AIDisclaimer />
// Текст: "⚠️ Концептуальная AI-визуализация..."
```

### ShoppingList
```tsx
// Список товаров с партнёрскими ссылками
// Фильтры: Всё / Мебель / Свет / Декор / Текстиль
// Каждый товар: фото + название + диапазон цены + маркетплейс + кнопка Купить
// Итого внизу: диапазон общего бюджета
<ShoppingList items={generation.shopping_items} />
```

### AdminTokenGrant (только admin)
```tsx
// Модальное окно ручного начисления токенов
// Поля: пользователь (поиск), количество, причина, комментарий
// Причины: тестирование / компенсация / промо / партнёр
<AdminTokenGrant onGrant={handleGrant} />
```

---

## 11. API РОУТЫ — ДЕТАЛИ

### POST /api/upload
```typescript
// Принять файл, сохранить в Supabase Storage
// Запустить Depth Anything v2
// Вернуть: { uploadId, depthMapUrl, projectId }
// Лимит: 20 МБ, форматы: JPG / PNG / PDF
```

### POST /api/generate
```typescript
// 1. Проверить баланс токенов (НЕ списывать ещё)
// 2. Создать запись generations со статусом 'pending'
// 3. Запустить Replicate ASYNC (не ждать результата)
// 4. Запустить Groq ПАРАЛЛЕЛЬНО
// 5. Вернуть: { generationId } немедленно
// Токен списывается только в webhook когда статус = 'done'
```

### GET /api/status/[id]
```typescript
// Проверить статус в Supabase
// Если Replicate вернул результат через webhook — статус уже обновлён
// Вернуть: { status, progress, renderUrls? }
// Frontend делает polling каждые 3 сек
```

### POST /api/webhooks/replicate
```typescript
// Replicate вызывает этот URL когда генерация готова
// Проверить подпись вебхука (ОБЯЗАТЕЛЬНО)
// Обновить статус generations
// Если succeeded: списать токен, сохранить render_urls
// Если failed: вернуть токен пользователю
```

### POST /api/tokens/grant (только admin)
```typescript
// Проверить role === 'admin'
// Начислить токены указанному пользователю
// Записать в token_transactions с type='manual_grant'
// Опционально отправить SMS уведомление
```

---

## 12. ДИЗАЙН-СИСТЕМА

```
Палитра:
  Primary:    #0D1B2A (тёмно-синий)
  Surface:    #F5F0E8 (тёплый белый)
  Accent:     #E85D3A (коралловый) — CTA кнопки
  Gold:       #C9A84C (золотой) — токены, премиум
  Text:       #1A1209 (почти чёрный)
  Muted:      #8C7B6B (приглушённый)

Типографика:
  Heading:    Playfair Display (serif, italic для акцентов)
  Body:       Inter или DM Sans
  Mono:       JetBrains Mono (для кодов, UUID)

Радиусы:
  Small:   6px
  Medium:  10px
  Large:   16px
  XL:      24px (карточки)

Тени:
  Subtle:  0 1px 3px rgba(0,0,0,0.08)
  Card:    0 4px 16px rgba(0,0,0,0.12)
```

---

## 13. БЕЗОПАСНОСТЬ — ОБЯЗАТЕЛЬНЫЕ ПРАВИЛА

```typescript
// 1. Row Level Security в Supabase — ВКЛЮЧИТЬ для всех таблиц
// Пользователь видит ТОЛЬКО свои данные

// 2. Admin routes — проверка роли на сервере
// app/admin/layout.tsx:
const session = await getServerSession()
if (session?.user?.role !== 'admin') redirect('/dashboard')

// 3. Webhook подписи — проверять ВСЕГДА
// Replicate: заголовок webhook-secret
// ЮКасса: HMAC SHA-256

// 4. Rate limiting на /api/generate
// Не более 10 запросов в час с одного IP

// 5. Валидация файлов при загрузке
// Проверять MIME-type, не только расширение
// Максимум 20 МБ

// 6. Переменные окружения
// NEXT_PUBLIC_ — только для безопасных публичных данных
// Приватные ключи — без NEXT_PUBLIC_ (только server-side)
```

---

## 14. ОБРАБОТКА ОШИБОК

```typescript
// Стандартный формат ответа API
type ApiResponse<T> = {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string  // по-русски для пользователя
  }
}

// Коды ошибок генерации:
// INSUFFICIENT_TOKENS    — недостаточно токенов
// UPLOAD_FAILED          — ошибка загрузки файла
// GENERATION_FAILED      — Replicate вернул ошибку (токен возвращаем)
// UNSUPPORTED_FORMAT     — неподдерживаемый формат файла
// FILE_TOO_LARGE         — файл больше 20 МБ
```

---

## 15. КОНТРОЛЬ РАСХОДОВ НА AI (COST GUARDS)

> Без этого блока один тяжёлый пользователь может сгенерировать
> убыток вместо прибыли. Implement до первого продакшн-деплоя.

### Таблица логирования стоимости

```sql
CREATE TABLE public.generation_costs (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  generation_id      UUID REFERENCES public.generations(id),
  provider           TEXT,          -- replicate / yandex_art / self_hosted
  model              TEXT,          -- модель (controlnet-hed / sdxl / etc)
  render_time_sec    INTEGER,
  cost_usd           NUMERIC(10,4),
  cost_rub           NUMERIC(10,2),
  token_price_rub    NUMERIC(10,2) DEFAULT 50,
  margin_rub         NUMERIC(10,2), -- token_price - cost_rub
  retries            INTEGER DEFAULT 0,
  status             TEXT,          -- success / failed / timeout
  created_at         TIMESTAMPTZ DEFAULT NOW()
);
```

### Лимиты — задаются в .env

```env
# Cost Guards
MAX_COST_PER_GENERATION_RUB=25      # если выше — abort и вернуть токен
MAX_DAILY_PROVIDER_SPEND_RUB=500    # алерт админу при превышении
MAX_RETRIES_PER_GENERATION=2        # максимум повторных попыток
GENERATION_TIMEOUT_SEC=120          # таймаут на одну генерацию
ADMIN_COST_ALERT_EMAIL=             # куда слать алерт
```

### Логика в коде

```typescript
// lib/ai/costGuard.ts

export async function checkCostBeforeGenerate(estimatedCost: number) {
  if (estimatedCost > MAX_COST_PER_GENERATION_RUB) {
    // Не запускать. Вернуть токен. Уведомить админа.
    throw new Error('COST_LIMIT_EXCEEDED')
  }
}

export async function checkDailySpend() {
  const todaySpend = await getDailyProviderSpend()
  if (todaySpend > MAX_DAILY_PROVIDER_SPEND_RUB) {
    await notifyAdmin('daily_spend_alert', todaySpend)
    // Можно продолжать, но логируем
  }
}

// Политика возврата токена:
// failed / timeout / cost_exceeded → автоматический возврат
// Записывать в token_transactions с type='refund'
```

---

## 16. ОБРАБОТКА PII И EXIF — ОБЯЗАТЕЛЬНО ПЕРЕД REPLICATE

> Фото квартиры + EXIF-геолокация + план БТИ = чувствительные данные.
> Чистить ДО любой передачи во внешний AI-сервис.

### Что чистить

```typescript
// lib/utils/sanitizeUpload.ts

import sharp from 'sharp'

export async function sanitizeImageForAI(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .withMetadata({ exif: {} })   // удалить весь EXIF включая геолокацию
    .toBuffer()
}

// Что НИКОГДА не включать в промпт:
// ❌ адрес квартиры
// ❌ ФИО пользователя
// ❌ номер телефона
// ❌ email
// ❌ кадастровый номер
// ✅ только: стиль, бюджет, тип комнаты, пожелания по цвету
```

### Отдельное согласие пользователя (UI)

При первой генерации показывать чекбокс (обязательный):

```
☑ Я согласен(-а) с тем, что обезличенное изображение комнаты
  (без персональных данных) будет передано внешнему AI-сервису
  для создания визуализации. Подробнее в Политике конфиденциальности.
```

Хранить: `profiles.ai_transfer_consent = true/false + timestamp`

### Будущий "режим без внешней передачи"

Для Pro/Enterprise тарифа — генерация только на российском GPU
(Яндекс Cloud). Добавить флаг в настройки аккаунта:
`use_local_inference = true` → маршрутизировать через self-hosted.

---

## 17. ТРИ РЕЖИМА ТОЧНОСТИ ВИЗУАЛИЗАЦИИ

> Разные входные данные → разные обещания → разный UX.
> Не врать пользователю о точности.

```
┌─────────────────┬──────────────────────┬─────────────────────────────┐
│ Режим           │ Вход                 │ Что обещаем                 │
├─────────────────┼──────────────────────┼─────────────────────────────┤
│ Photo Concept   │ Фото комнаты         │ Атмосфера и стиль.          │
│ (быстрый)       │ (телефон)            │ Геометрия ориентировочная.  │
│                 │                      │ Depth Anything v2           │
├─────────────────┼──────────────────────┼─────────────────────────────┤
│ BTI Control     │ План БТИ +           │ Логика зон и планировки.    │
│ (точный)        │ размеры комнат       │ Геометрия стабильнее.       │
│                 │                      │ ControlNet + depth map      │
├─────────────────┼──────────────────────┼─────────────────────────────┤
│ Pro Geometry    │ План + depth map +   │ Наиболее стабильные кадры.  │
│ (профи)         │ 3D-блоки / lineart   │ Несколько согласованных     │
│                 │                      │ ракурсов. Для дизайнеров.   │
└─────────────────┴──────────────────────┴─────────────────────────────┘
```

### В UI показывать режим явно

```tsx
// Бейдж на результатах
<ModeBadge mode="photo_concept">
  ⚡ Быстрая концепция — геометрия ориентировочная
</ModeBadge>

<ModeBadge mode="bti_control">
  📐 По плану БТИ — зоны и планировка стабильны
</ModeBadge>

<ModeBadge mode="pro_geometry">
  🏆 Pro — максимальная геометрическая точность
</ModeBadge>
```

### Стоимость в токенах по режимам

```
Photo Concept   = 1 токен
BTI Control     = 1 токен  (MVP)
Pro Geometry    = 2 токена (Phase 2)
```

---

## 18. BETA QA РЕЖИМ (ПЕРВЫЕ 50 ПРОЕКТОВ)

> Не выдавать результат автоматически пока не проверена стабильность.
> Пользователь думает что это автоматика. Ты видишь результат первым.

### Флаг в .env

```env
BETA_QA_MODE=true          # включить ручную проверку перед выдачей
BETA_QA_PROJECT_LIMIT=50   # после N проектов — отключить автоматически
```

### Логика

```typescript
// После получения результата от Replicate:

if (BETA_QA_MODE && totalProjectsCount < BETA_QA_PROJECT_LIMIT) {
  // Статус: 'pending_review' (не 'done')
  // Пользователь видит: "Ваш результат готовится, уведомим вас"
  // Админ видит в /admin/generations: кнопки [Approve] [Retry] [Refund]
  await notifyAdmin('new_generation_ready_for_review', generationId)
} else {
  // Обычный автоматический флоу
  await markGenerationDone(generationId)
  await notifyUser('generation_complete', userId)
}
```

### Что проверять при approve

Чеклист в админке (чекбоксы):

```
☑ Геометрия комнаты не "плывёт"
☑ Нет артефактов (лица, тексты, странные объекты)
☑ Стиль соответствует выбранному пользователем
☑ Все 4 рендера загрузились
☑ Дисклеймер присутствует
☑ Объяснения дизайнера не содержат галлюцинаций
```

---

## 19. РАСШИРЕННЫЙ ДИСКЛЕЙМЕР (финальная версия)

Это точная формулировка. Использовать везде дословно.

```
⚠️ Концептуальная AI-визуализация

Не является рабочей документацией, дизайн-проектом,
строительным проектом, инженерным расчётом или
юридическим согласованием перепланировки.

Изображения созданы искусственным интеллектом и служат
исключительно для концептуального представления возможного
оформления пространства.

Бюджетные оценки — ориентировочные диапазоны.
Цены зависят от магазина, региона, наличия товара
и даты покупки.

Для точных расчётов, строительной документации и
согласования перепланировки обратитесь к
лицензированному специалисту.
```

Компонент: `components/shared/AIDisclaimer.tsx`
Показывать: на экране результатов, в PDF-экспорте, в email с результатом.

---

## 20. РЕАЛИСТИЧНЫЙ БЮДЖЕТ ЗАПУСКА

```
┌─────────────────────┬──────────────────────────────┬───────────────┐
│ Уровень             │ Что включает                 │ Оценка        │
├─────────────────────┼──────────────────────────────┼───────────────┤
│ Технический         │ Локально/веб, без платежей,  │ 30–80 тыс. ₽  │
│ прототип            │ проверить пайплайн           │               │
├─────────────────────┼──────────────────────────────┼───────────────┤
│ Платный Beta MVP    │ Токены, ЮКасса, личный       │ 80–250 тыс. ₽ │
│                     │ кабинет, QA, дисклеймеры     │               │
├─────────────────────┼──────────────────────────────┼───────────────┤
│ Коммерческий MVP    │ Продакшн, юридика,           │ 250 тыс. ₽+   │
│                     │ мониторинг, аналитика        │               │
└─────────────────────┴──────────────────────────────┴───────────────┘

8 000 ₽ — только API-расходы на первые 1000 генераций.
Полный запуск = разработка + тесты + юридика + платежи + мониторинг.
```

---

## 21. ROADMAP

### MVP (запустить первым)
- [ ] Авторизация VK + Google + email/SMS
- [ ] Загрузка фото + автоматический depth map
- [ ] Генерация 4 рендеров через ControlNet
- [ ] Объяснения дизайнера от Groq
- [ ] Диапазоны бюджета
- [ ] Список покупок (Яндекс.Маркет)
- [ ] PDF-экспорт
- [ ] Токенная система + ЮКасса
- [ ] Дашборд + история проектов
- [ ] Админ-панель (метрики + ручные токены)
- [ ] Страницы /privacy и /terms
- [ ] AI-дисклеймер везде

### Phase 2 (после первых пользователей)
- [ ] B2B подписка для дизайнеров (Проект Pro)
- [ ] Мобильное приложение (Expo)
- [ ] AR-примерка мебели через камеру
- [ ] AI-видеотур (3-5 сек видео через комнату)
- [ ] Маркетплейс дизайнеров
- [ ] Self-hosted GPU на Яндекс Cloud (при 300+ ген/день)

---

## 16. КОМАНДА

```
Александр  — основатель, продукт, разработка (Claude Code)
Дизайнер   — экспертиза интерьерного дизайна, база знаний
```

---

## 17. ADMIN АККАУНТ

> Учётные данные хранятся ТОЛЬКО в `.env.local` — никогда не в коде и не в Git.
> В этом файле — только логика поведения.

### Переменные окружения (добавить в .env.local)

```env
# Admin — хранить только здесь, не коммитить
ADMIN_EMAIL=        ← из личного хранилища
ADMIN_PASSWORD=     ← из личного хранилища
```

### Скрипт инициализации

```typescript
// scripts/seed-admin.ts
// Запускать один раз: npx ts-node scripts/seed-admin.ts

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!  // service key — только для seed
)

async function seedAdmin() {
  const { data, error } = await supabase.auth.admin.createUser({
    email: process.env.ADMIN_EMAIL!,
    password: process.env.ADMIN_PASSWORD!,
    email_confirm: true,
  })

  if (error) {
    console.error('Admin creation failed:', error.message)
    return
  }

  // Установить роль и безлимитный баланс
  await supabase
    .from('profiles')
    .update({
      role: 'admin',
      token_balance: -1,   // -1 = безлимит
      plan: 'admin'
    })
    .eq('id', data.user.id)

  console.log('Admin created:', data.user.email)
}

seedAdmin()
```

### Логика безлимита в коде

```typescript
// lib/tokens/checkBalance.ts
// Вызывается перед КАЖДОЙ генерацией

export async function checkTokenBalance(
  userId: string,
  required: number
): Promise<boolean> {

  const profile = await getProfile(userId)

  // Admin — пропустить проверку, не списывать токены
  if (profile.role === 'admin') return true

  // token_balance = -1 зарезервировано только для admin
  if (profile.token_balance === -1) {
    await logSuspiciousActivity(userId, 'non_admin_with_unlimited_tokens')
    return false
  }

  return profile.token_balance >= required
}

// Логирование генераций для admin
// Стоимость генерации = 0 ₽, но запись в generation_costs создаётся
// с пометкой admin_test = true — для мониторинга расходов на тесты
```

### Права администратора

```
Admin может:
  ✅ Генерировать без списания токенов
  ✅ Начислять токены любому пользователю вручную
  ✅ Видеть все генерации всех пользователей
  ✅ Approve / Retry / Refund в Beta QA режиме
  ✅ Менять тарифы пакетов
  ✅ Управлять командой (приглашать других admin)
  ✅ Видеть финансовую аналитику
  ✅ Включать/выключать TOURS_ENABLED, BETA_QA_MODE

Admin НЕ может:
  ❌ Удалять данные пользователей без подтверждения
  ❌ Видеть пароли пользователей (хэшированы в Supabase Auth)
```

---

## 18. ВАЖНЫЕ РЕШЕНИЯ — НЕ МЕНЯТЬ БЕЗ ОБСУЖДЕНИЯ

1. **Adapter pattern для AI** — все вызовы только через `lib/ai/adapter.ts`
2. **Анонимизация до Replicate** — через `lib/utils/anonymize.ts`
3. **Токены, не подписка** — безлимит убивает маржу
4. **Диапазоны цен, не точные суммы** — защита от претензий
5. **Web-first, mobile потом** — скорость запуска важнее
6. **DeepSeek-VL2 на Replicate** — основной парсер планов БТИ
7. **Groq LLaMA 3.2 90B Vision** — резерв парсинга, тестировать параллельно
8. **Anthropic API** — убран из обязательных, не нужен для MVP
   - CubiCasa: план БТИ → JSON → Three.js 3D → depth map (75–82%)
   - Depth Anything v2: фото → depth map (88–95%)
7. **Модульный монолит** — не микросервисы, пока нет PMF
8. **Supabase EU West** — ближайший к РФ регион
9. **Один режим генерации в MVP** — только Pro Geometry (двойной ControlNet)
10. **Маркетплейс = заглушка в MVP** — вкладка видна, функция отключена
11. **Атомарное списание токенов** — либо все сразу до генерации, либо никакие
12. **5 бесплатных токенов** — при регистрации, не 1 и не 3

---

*Последнее обновление: май 2026*
*Версия: 2.8 — DeepSeek-VL2 основной парсер планов, Groq Vision резерв, Anthropic убран из MVP*
