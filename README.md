# kirzhq.fin

Персональный сервис для учёта финансов: доходов, расходов, долгов и затрат на
автомобиль. Рабочая версия доступна по адресу
[fin.kirzhq.ru](https://fin.kirzhq.ru).

## Возможности

- годовая и месячная аналитика с графиками, суммами и процентами;
- добавление, редактирование, удаление и фильтрация операций;
- собственные категории доходов и расходов;
- среднесуточный расход и отдельный показатель расходов на еду;
- учёт долгов с частичными погашениями;
- статистика по Lada Vesta и экспорт автомобильных расходов в Excel;
- импорт и экспорт полной резервной копии финансовых данных;
- светлая и тёмная темы;
- управление операциями через Telegram-бота;
- единая авторизация с домашним порталом `home.kirzhq.ru`.

Год определяется датой операции, поэтому для продолжения учёта в новом году не
нужно создавать отдельную базу или копию приложения.

## Как устроен проект

| Компонент | Технологии |
| --- | --- |
| Клиент | React, TypeScript, Vite |
| Сервер | Java 21, Spring Boot |
| База данных | PostgreSQL 16 |
| Миграции | Flyway |
| Развёртывание | Docker Compose |
| HTTPS и проксирование | Caddy |

PostgreSQL доступен только внутри Docker-сети. Данные базы и сертификаты Caddy
хранятся в именованных томах и не пропадают при пересоздании контейнеров.

## Запуск через Docker

Понадобятся Docker Engine и плагин Docker Compose.

```bash
git clone https://github.com/kirzhq/kirzhq.fin.git
cd kirzhq.fin
cp .env.example .env
```

Заполните `.env`, затем запустите проект:

```bash
docker compose up -d --build
```

Для локального запуска оставьте:

```dotenv
SITE_ADDRESS=http://localhost
CORS_ALLOWED_ORIGINS=http://localhost
AUTH_RP_ID=localhost
AUTH_ORIGIN=http://localhost
SESSION_COOKIE_SECURE=false
SESSION_COOKIE_DOMAIN=localhost
```

Приложение откроется на [http://localhost](http://localhost).

## Развёртывание с доменом

Направьте `A`-запись домена на сервер и откройте порты `80` и `443`. Основные
параметры производственного окружения:

```dotenv
POSTGRES_PASSWORD=случайный-длинный-пароль
POSTGRES_DB=finance_tracker
POSTGRES_USER=finance

SITE_ADDRESS=fin.example.com
CORS_ALLOWED_ORIGINS=https://fin.example.com

AUTH_USERNAME=finance
AUTH_SETUP_PASSWORD=отдельный-длинный-пароль
AUTH_RP_ID=example.com
AUTH_ORIGIN=https://home.example.com
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_DOMAIN=example.com
```

После запуска Caddy автоматически получит и будет обновлять TLS-сертификат.
Текущая конфигурация использует общую сессию домена `kirzhq.ru`: вход выполняется
на Home, а неавторизованный пользователь финансового сервиса перенаправляется
туда автоматически.

## Резервные копии

Кнопки импорта и экспорта находятся на главной странице. JSON-копия содержит
категории, операции, автомобиль, долги и погашения. Passkey, пароли и секреты
окружения в неё не входят.

Импорт полностью заменяет финансовые данные. Перед восстановлением рекомендуется
сначала скачать актуальную копию. Операция выполняется транзакционно: если
возникает ошибка, прежние данные сохраняются.

Дополнительно можно сделать резервную копию Docker-тома PostgreSQL средствами
сервера.

## Telegram-бот

Создайте бота через BotFather и укажите в `.env`:

```dotenv
TELEGRAM_BOT_TOKEN=токен-бота
TELEGRAM_ALLOWED_CHAT_ID=id-разрешённого-чата
```

После изменения настроек пересоберите backend:

```bash
docker compose up -d --build backend
```

Бот использует long polling, показывает последние операции и позволяет
добавлять или редактировать их кнопками. Доступ разрешён только указанному чату.
На серверах, где Telegram API заблокирован провайдером, для работы потребуется
отдельно настроенный сетевой доступ.

## Разработка

Запустить только PostgreSQL:

```bash
POSTGRES_PASSWORD=finance docker compose up -d db
```

Backend:

```bash
cd backend
DATABASE_PASSWORD=finance mvn spring-boot:run
```

Frontend в другом терминале:

```bash
cd frontend
npm ci
npm run dev
```

Изменения структуры базы оформляются новыми SQL-миграциями в
`backend/src/main/resources/db/migration`. Hibernate работает в режиме
`ddl-auto: validate`.

## Полезные команды

```bash
docker compose ps
docker compose logs -f
docker compose logs -f backend
docker compose up -d --build
docker compose down
```

Команда `docker compose down` сохраняет именованные тома. Не добавляйте флаг
`-v`, если не хотите удалить базу данных и сертификаты.
