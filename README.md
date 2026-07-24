# kirzhq.fin

Personal income and expense tracker built with Spring Boot, React and PostgreSQL.

The interface is in Russian and includes yearly and monthly dashboards, charts,
transaction history, the original categories from the source workbook, and
creation of additional income or expense categories. July 2026 data is imported
from `Финансовый вопрос.xlsx` through a versioned database migration.

Operations can be edited and deleted. Categories are managed on a separate
settings page. Vehicle expenses are linked to the Lada Vesta and shown in a dedicated
section. The vehicle report can be exported to Excel for the selected year and
shows average monthly fuel spending. Fuel operations are detected by `бензин`,
`АЗС` or `топливо` in the operation comment; the average is calculated across
months that contain vehicle expenses. A transaction date determines its year,
so 2027 and later years use the same database and interface without annual
schema copies.

The selected year applies to every section from the sidebar. The dashboard has
light and dark themes with a saved browser preference, and its expense legend
shows every category with both amount and percentage.

## Production stack

- Java 21 / Spring Boot / Spring Data JPA
- PostgreSQL 16
- Flyway database migrations
- React / TypeScript / Vite
- Docker Compose
- Caddy reverse proxy with automatic HTTPS

## Deploy on a server

Requirements: Docker Engine with the Compose plugin, a Linux server with ports
`80` and `443` open, and a domain whose `A`/`AAAA` record points to the server.

```bash
git clone https://github.com/kirzhq/kirzhq.fin.git
cd kirzhq.fin
./deploy.sh finance.example.com
```

The script creates `.env` with a random PostgreSQL password, builds all images,
starts the stack and prints its status. Caddy obtains and renews the TLS
certificate automatically.

To deploy locally:

```bash
./deploy.sh
```

Then open <http://localhost>.

## Configuration

The first deploy creates `.env`. Important values:

```dotenv
POSTGRES_PASSWORD=a-long-random-password
POSTGRES_DB=finance_tracker
POSTGRES_USER=finance
SITE_ADDRESS=finance.example.com
CORS_ALLOWED_ORIGINS=https://finance.example.com
```

After changing `.env`, apply it with:

```bash
docker compose up -d --build
```

Useful commands:

```bash
docker compose ps
docker compose logs -f
docker compose pull
docker compose up -d --build
```

Database data and Caddy certificates are stored in named Docker volumes and
survive container replacement. The PostgreSQL port is not exposed publicly.

## Database migrations

Flyway applies versioned SQL migrations from:

```text
backend/src/main/resources/db/migration
```

Hibernate runs with `ddl-auto: validate`, so schema changes must be made through
new Flyway migrations.

## Local development without the full stack

Start PostgreSQL:

```bash
POSTGRES_PASSWORD=finance docker compose up -d db
```

Run the backend:

```bash
cd backend
DATABASE_PASSWORD=finance mvn spring-boot:run
```

Run the frontend in another terminal:

```bash
cd frontend
npm ci
npm run dev
```
