# kirzhq.fin

Персональное приложение для учёта доходов и расходов, построенное на Spring Boot,
React и PostgreSQL.

Интерфейс полностью выполнен на русском языке. В приложении доступны годовая и
месячная сводки, графики, история операций, исходные категории из таблицы, а
также создание дополнительных категорий доходов и расходов. Данные за июль
2026 года импортируются из файла `Финансовый вопрос.xlsx` посредством
версионируемой миграции базы данных.

Операции можно добавлять, редактировать и удалять. Управление категориями
вынесено в отдельный раздел. Расходы на Lada Vesta отображаются во вкладке
автомобиля. Отчёт по автомобилю за выбранный год можно выгрузить в Excel.
В нём также рассчитывается среднемесячный расход на бензин. Операция считается
заправкой, если её комментарий содержит слова `бензин`, `АЗС` или `топливо`.
Среднее значение рассчитывается по месяцам, в которых были расходы на
автомобиль.

Год операции определяется её датой, поэтому для ведения учёта в 2027 году и
далее не требуется создавать новые таблицы или копии приложения. Выбранный в
боковом меню год применяется ко всем разделам.

Приложение поддерживает светлую и тёмную темы и сохраняет выбранную тему в
браузере. В легенде диаграммы расходов отображаются все категории, суммы и
проценты.

## Вход с Touch ID

Авторизация реализована через стандарт WebAuthn (passkey). На Mac ключ хранится
в связке ключей Apple и подтверждается через Touch ID; финансовые данные и
ключи доступа сохраняются на сервере в PostgreSQL.

Для первой настройки откройте `/login`, войдите временными данными
`AUTH_USERNAME` и `AUTH_SETUP_PASSWORD`, затем перейдите на
`/webauthn/register` и зарегистрируйте ключ. После успешной проверки входа с
Touch ID временный пароль следует заменить в `.env` на новое случайное значение
и перезапустить backend.

Passkey привязан к домену. Для рабочего сервера параметры должны точно
соответствовать публичному HTTPS-адресу:

```dotenv
AUTH_RP_ID=fin.example.com
AUTH_ORIGIN=https://fin.example.com
SESSION_COOKIE_SECURE=true
```

## Telegram-бот

Бот позволяет просматривать последние операции, добавлять новые и редактировать
существующие:

```text
/list
/add Расход | Еда домой | 1250 | 2026-07-24 | Продукты
/edit 127 | Расход | Подписки | 399 | 2026-07-22 | Альфа-смарт
```

Создайте бота через BotFather и сначала добавьте в `.env` новый токен. Напишите
боту `/id`, скопируйте полученный номер в `TELEGRAM_ALLOWED_CHAT_ID`:

```dotenv
TELEGRAM_BOT_TOKEN=новый-токен
TELEGRAM_ALLOWED_CHAT_ID=ваш-chat-id
```

После этого выполните `docker compose up -d --build backend`. Бот использует
long polling, поэтому отдельный webhook и публичный адрес для него не требуются.
Сообщения из других чатов отклоняются.

## Технологии

- Java 21, Spring Boot и Spring Data JPA
- PostgreSQL 16
- Flyway для миграций базы данных
- React, TypeScript и Vite
- Docker Compose
- Caddy в качестве обратного прокси с автоматическим HTTPS

## Развёртывание на сервере

Потребуются Linux-сервер, Docker Engine с плагином Compose и открытые порты
`80` и `443`. Записи `A`/`AAAA` домена должны указывать на сервер.

```bash
git clone https://github.com/kirzhq/kirzhq.fin.git
cd kirzhq.fin
./deploy.sh finance.example.com
```

Скрипт создаст файл `.env` со случайным паролем PostgreSQL, соберёт образы,
запустит все контейнеры и выведет их состояние. Caddy автоматически получит
и будет обновлять TLS-сертификат.

Для локального запуска:

```bash
./deploy.sh
```

После запуска приложение будет доступно по адресу <http://localhost>.

## Настройка

При первом развёртывании создаётся файл `.env`. Основные параметры:

```dotenv
POSTGRES_PASSWORD=a-long-random-password
POSTGRES_DB=finance_tracker
POSTGRES_USER=finance
SITE_ADDRESS=finance.example.com
CORS_ALLOWED_ORIGINS=https://finance.example.com
AUTH_USERNAME=finance
AUTH_SETUP_PASSWORD=a-separate-long-random-password
AUTH_RP_ID=finance.example.com
AUTH_ORIGIN=https://finance.example.com
SESSION_COOKIE_SECURE=true
```

После изменения `.env` пересоберите и перезапустите контейнеры:

```bash
docker compose up -d --build
```

Полезные команды:

```bash
docker compose ps
docker compose logs -f
docker compose pull
docker compose up -d --build
```

Данные PostgreSQL и сертификаты Caddy хранятся в именованных Docker-томах и
сохраняются при пересоздании контейнеров. Порт PostgreSQL не публикуется во
внешнюю сеть.

## Миграции базы данных

Flyway применяет версионируемые SQL-миграции из каталога:

```text
backend/src/main/resources/db/migration
```

Hibernate работает в режиме `ddl-auto: validate`, поэтому изменения схемы
следует оформлять в виде новых миграций Flyway.

## Локальная разработка без полного Docker-стека

Запуск PostgreSQL:

```bash
POSTGRES_PASSWORD=finance docker compose up -d db
```

Запуск серверной части:

```bash
cd backend
DATABASE_PASSWORD=finance mvn spring-boot:run
```

Запуск клиентской части в другом терминале:

```bash
cd frontend
npm ci
npm run dev
```
