#!/bin/sh
set -e

echo "Waiting for database..."
until nc -z db 5432; do
  sleep 1
done

echo "Running migrations..."
npm run db:migrate

echo "Starting backend..."
node dist/index.js
