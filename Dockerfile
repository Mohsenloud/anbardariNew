# Stage 1: Build client and bundle backend server
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files first so Docker caches node_modules unless package.json changes
COPY package*.json ./
RUN npm install --no-audit --no-fund

# Copy source files and build frontend + backend bundle
COPY . .
RUN npm run build

# Stage 2: Fast Production Runner (reuses cached node_modules without a second network install)
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/app/data

# Copy package metadata, cached node_modules, and compiled dist from builder
COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Create persistent data directory for database
RUN mkdir -p /app/data

VOLUME ["/app/data"]

EXPOSE 3000

CMD ["node", "dist/server.cjs"]
