# Stage 1: Build client and bundle backend server
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install all dependencies
COPY package*.json ./
RUN npm install

# Copy all source files and run production build
COPY . .
RUN npm run build

# Stage 2: Production runner container
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/app/data

# Install only production dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy compiled frontend and bundled server from builder stage
COPY --from=builder /app/dist ./dist

# Create persistent data directory for database
RUN mkdir -p /app/data

VOLUME ["/app/data"]

EXPOSE 3000

CMD ["node", "dist/server.cjs"]
