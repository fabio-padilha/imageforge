# ── Stage 1: Build Frontend ──────────────────────────────────────
FROM node:20-alpine AS fe
WORKDIR /fe
COPY frontend/package.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# ── Stage 2: Backend deps ────────────────────────────────────────
FROM node:20-alpine AS be
WORKDIR /be
RUN apk add --no-cache python3 make g++ vips-dev
COPY backend/package.json ./
RUN npm install --omit=dev
COPY backend/ ./

# ── Stage 3: Imagem final ────────────────────────────────────────
FROM node:20-alpine
RUN apk add --no-cache vips-dev && \
    addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --from=be /be ./backend
COPY --from=fe /fe/dist ./frontend/dist
RUN mkdir -p /tmp/imageforge && chown app:app /tmp/imageforge
USER app
EXPOSE 8080
ENV NODE_ENV=production PORT=8080 TMP_DIR=/tmp/imageforge \
    MAX_FILE_MB=25 MAX_BATCH_MB=200 CLEANUP_MINUTES=60 CONCURRENCY=3
CMD ["node","backend/src/server.js"]
