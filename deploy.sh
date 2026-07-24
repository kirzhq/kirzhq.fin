#!/bin/sh
set -eu

domain="${1:-http://localhost}"

case "$domain" in
  http://localhost)
    site_address="$domain"
    allowed_origin="$domain"
    ;;
  *[!A-Za-z0-9.-]* | .* | *.)
    echo "Invalid domain: $domain" >&2
    echo "Usage: ./deploy.sh [finance.example.com]" >&2
    exit 1
    ;;
  *)
    site_address="$domain"
    allowed_origin="https://$domain"
    ;;
esac

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required: https://docs.docker.com/engine/install/" >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose plugin is required." >&2
  exit 1
fi

if [ ! -f .env ]; then
  if ! command -v openssl >/dev/null 2>&1; then
    echo "OpenSSL is required to generate the database password." >&2
    exit 1
  fi

  db_password="$(openssl rand -hex 32)"
  {
    echo "POSTGRES_PASSWORD=$db_password"
    echo "POSTGRES_DB=finance_tracker"
    echo "POSTGRES_USER=finance"
    echo "SITE_ADDRESS=$site_address"
    echo "CORS_ALLOWED_ORIGINS=$allowed_origin"
  } > .env
  chmod 600 .env
  echo "Created .env with a random database password."
else
  echo "Using existing .env. Domain settings were not overwritten."
fi

docker compose up -d --build
docker compose ps

echo "Deployment complete: $allowed_origin"
