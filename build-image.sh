#!/bin/bash
set -e

IMAGE_NAME="vibe-invoicing"
IMAGE_TAG="latest"
OUTPUT_FILE="vibe-invoicing.tar.gz"

echo "==> Building Docker image..."
docker build -t "${IMAGE_NAME}:${IMAGE_TAG}" .

echo "==> Exporting image to ${OUTPUT_FILE}..."
docker save "${IMAGE_NAME}:${IMAGE_TAG}" | gzip > "${OUTPUT_FILE}"

echo "==> Done! Upload ${OUTPUT_FILE} to Plesk Docker extension."
echo "    File size: $(du -h "${OUTPUT_FILE}" | cut -f1)"
