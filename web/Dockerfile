# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build Next.js app
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

ENV NODE_ENV=production

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy necessary files from builder
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma

# Install runtime dependencies that Next standalone doesn't include
# These are needed for migrations and bootstrap
RUN npm install --omit=dev \
    prisma@6.19.3 \
    @prisma/client@6.19.3 \
    @prisma/engines@6.19.3 \
    bcryptjs@3.0.2

# Copy Prisma generated client from builder
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy and set permissions for entrypoint before switching to nextjs user
COPY --chmod=755 docker-entrypoint.sh /app/docker-entrypoint.sh

# Change ownership
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "server.js"]
