# ── Build stage ──────────────────────────────────────────────
FROM node:20-slim AS build

WORKDIR /app

# Copy workspace root files
COPY package.json package-lock.json ./

# Copy workspace package.json files for install
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/

RUN npm ci

# Copy all source
COPY shared/ shared/
COPY server/ server/
COPY client/ client/
COPY tsconfig.base.json ./

# Build server (tsc -b auto-builds shared reference first)
RUN npm run build --workspace=server

# Build client (skip tsc type-checking, just run vite build)
RUN cd client && npx vite build

# ── Production stage ─────────────────────────────────────────
FROM node:20-slim AS production

# Puppeteer/Chromium dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdrm2 \
    libgbm1 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Tell Puppeteer to use system Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Copy workspace root files
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/

RUN npm ci --omit=dev

# Copy shared compiled output (resolves @vibe/shared to dist/index.js at runtime)
COPY --from=build /app/shared/dist/ shared/dist/

# Copy compiled server
COPY --from=build /app/server/dist/ server/dist/

# Copy client build
COPY --from=build /app/client/dist/ client/dist/

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "server/dist/index.js"]
