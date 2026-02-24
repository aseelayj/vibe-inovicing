#!/bin/bash
set -e

# Vibe Invoicing - Deployment Script
# Called by GitHub Actions or manually

APP_DIR="/root/vibe-inovicing"
IMAGE_NAME="vibe-invoicing"
CONTAINER_NAME="vibe-invoicing"
NETWORK="vibe-net"

cd "$APP_DIR"

echo "==> Pulling latest code..."
git fetch origin main
git reset --hard origin/main

echo "==> Building Docker image..."
docker build -t "${IMAGE_NAME}:latest" .

echo "==> Stopping old container..."
docker stop "$CONTAINER_NAME" 2>/dev/null || true
docker rm "$CONTAINER_NAME" 2>/dev/null || true

echo "==> Starting new container..."
# The entrypoint.sh runs drizzle-kit push automatically before starting the app
docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  --network "$NETWORK" \
  -p 3001:3001 \
  --env-file /root/.vibe-invoicing.env \
  "${IMAGE_NAME}:latest"

echo "==> Waiting for schema push and app to start..."
sleep 10

# Health check
if curl -sf -o /dev/null http://127.0.0.1:3001/; then
  echo "==> Deploy successful! App is running."
else
  echo "==> WARNING: App may not be healthy. Checking logs..."
  docker logs --tail 20 "$CONTAINER_NAME"
  exit 1
fi

# Clean up old images
docker image prune -f
echo "==> Done."
