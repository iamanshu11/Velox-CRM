# ─────────────────────────────────────────────────────────────
#  Velox-CRM — Backend
#  Build context: ./backend  (contains node-crm/ and database/)
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

WORKDIR /app

# Copy package files first for better layer caching
COPY node-crm/package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy the Express application source
COPY node-crm/ .

# Copy database folder (migrations + seeds) so the seed script
# can be run inside the container:
#   docker compose run --rm seed
COPY database/ ./database/

EXPOSE 5000

# Use dumb-init as PID 1 to handle signals correctly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
