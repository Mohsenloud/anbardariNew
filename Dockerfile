# Stage 1: Build client and bundle backend server
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files first so Docker caches node_modules unless package.json changes
COPY package*.json ./
RUN npm install --no-audit --no-fund

# Copy source files, build frontend + backend bundle, then prune devDependencies
COPY . .
RUN npm run build && npm prune --omit=dev

# Stage 2: Fast Production Runner (reuses pruned production node_modules)
FROM node:22-alpine AS runner

WORKDIR /app

# Install tzdata so TZ=Asia/Tehran applies accurately to logs and Jalali timestamps
RUN apk add --no-cache tzdata && mkdir -p /app/data/backups

ENV NODE_ENV=production
ENV TZ=Asia/Tehran
ENV PORT=3000
ENV DATA_DIR=/app/data

# Copy package metadata, pruned production node_modules, compiled dist, and recovery script
COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/scripts/reset-admin-password.mjs ./scripts/reset-admin-password.mjs

VOLUME ["/app/data"]

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server.cjs"]
