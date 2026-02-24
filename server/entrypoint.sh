#!/bin/sh
set -e

echo "==> Pushing database schema..."
cd /app/server
npx drizzle-kit push 2>&1 || {
  echo "WARNING: drizzle-kit push failed, retrying in 3s..."
  sleep 3
  npx drizzle-kit push 2>&1 || echo "WARNING: drizzle-kit push failed again, starting app anyway"
}

echo "==> Starting application..."
exec node /app/server/dist/index.js
