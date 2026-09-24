# panel-club ingest job — Node 22 with native TS strip-types (no separate compile step).
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY content ./content
COPY src/lib ./src/lib
COPY src/platform ./src/platform
CMD ["node", "--experimental-strip-types", "src/platform/ingest/cli.ts"]
