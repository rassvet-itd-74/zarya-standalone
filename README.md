# Заря — Standalone

> Десктопный кошелёк и клиент DAO для системы ДАВО «Заря» партии «Рассвет».  
> Desktop wallet and DAO client for the DAIO "Zarya" system of the "RASSVET" party.

`Версия: Челябинск`

---

## Что это / What this is

**Заря Standalone** — локальное Electron-приложение, которое:

1. Генерирует и хранит зашифрованный приватный ключ участника DAO (AES-256-GCM + scrypt).
2. Подключается к развёрнутому смарт-контракту `Zarya.sol` через заданный RPC.
3. Предоставляет интерфейс для участия в голосованиях, просмотра матрицы мнения партии и управления членством в партийных органах.

Приватный ключ **никогда не покидает главный процесс**. Рендерер не имеет доступа к ключу или RPC напрямую.

---

## Стек / Stack

| Слой | Технология |
|---|---|
| Оболочка | Electron 42 + Electron Forge |
| Сборка | Vite 8 |
| Язык | TypeScript 5 |
| Стили | Tailwind CSS v4 + SCSS |
| i18n | i18next (EN / RU) |
| Криптография | Node.js `crypto` (AES-256-GCM, scrypt) |
| Блокчейн-клиент | viem 2 |

---

## Требования / Requirements

- Node.js ≥ 18
- npm ≥ 9

---

## Быстрый старт / Getting started

```bash
git clone <repo>
cd zarya-standalone
npm install
```

### Настройка окружения / Environment setup

Скопируйте шаблон и задайте RPC-эндпоинт:

```bash
cp .env.example .env
```

Откройте `.env` и заполните:

```env
VITE_RPC_URL=https://your-rpc-endpoint
```

> `.env` добавлен в `.gitignore` и **не должен коммититься**.  
> RPC URL встраивается в бандл на этапе сборки и недоступен в интерфейсе.

### Запуск в режиме разработки / Development

```bash
npm start
```

### Сборка / Build

```bash
npm run make
```

Готовые установщики появятся в `out/make/`.

---

## Структура проекта / Project structure

```
zarya-standalone/
├── src/
│   ├── main.ts              # Главный процесс Electron
│   ├── preload.ts           # Мост renderer ↔ main (contextBridge)
│   ├── renderer.ts          # Логика UI
│   ├── keyManager.ts        # Генерация, шифрование, экспорт/импорт ключа
│   ├── i18n.ts              # Инициализация i18next
│   ├── assets/
│   │   ├── images/          # Логотип, иконки
│   │   └── json/
│   │       ├── zaryaAbi.json         # ABI смарт-контракта Zarya.sol
│   │       └── locales/
│   │           ├── en.json
│   │           └── ru.json
│   └── styles/
│       └── index.scss
├── index.html
├── .env                     # git-ignored — VITE_RPC_URL
├── .env.example             # Шаблон переменных окружения
├── PLAN.md                  # План реализации DAO-интерфейса
├── whitepaper.md            # Технический документ ДАВО «Заря»
├── forge.config.ts
├── vite.main.config.ts
├── vite.renderer.config.ts
├── vite.preload.config.ts
└── tsconfig.json
```

---

## Безопасность / Security

- Приватный ключ хранится **только** в `userData/keystore.json` в зашифрованном виде (AES-256-GCM).
- Ключ шифрования производится через scrypt (N=16384, r=8, p=1) — устойчиво к brute-force.
- После разблокировки расшифрованный ключ держится **только в памяти главного процесса** и уничтожается при закрытии приложения.
- RPC URL встроен в бандл на этапе сборки — не виден пользователю и не записывается на диск.
- Electron Fuses: `RunAsNode`, `NodeOptions`, `NodeCliInspect` — отключены; `AsarIntegrity`, `CookieEncryption`, `OnlyLoadAppFromAsar` — включены.

---

## Локализация / i18n

Поддерживаются языки **RU** (по умолчанию) и **EN**.  
Файлы переводов: `src/assets/json/locales/{ru,en}.json`.  
Переключение — кнопка в правом верхнем углу. Выбор сохраняется в `localStorage`.

---

## Смарт-контракт / Smart contract

ABI контракта `Zarya.sol` находится в `src/assets/json/zaryaAbi.json`. 
