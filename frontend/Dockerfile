# ─────────────────────────────────────────────────────────────
#  Velox-CRM — Frontend (React + Vite)
#  Multi-stage build:
#    stage 1 (builder) — compiles TypeScript + bundles with Vite
#    stage 2 (runner)  — serves the /dist with nginx
# ─────────────────────────────────────────────────────────────

# ── Stage 1: Build ────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy manifests first so this layer is cached unless deps change
COPY package*.json ./
# Use npm install (not npm ci) so Docker can resolve any deps added to
# package.json that aren't yet reflected in the lock file (e.g. @types/node).
# After running `npm install` locally and committing the updated lock file,
# you can switch this back to `npm ci` for reproducible builds.
RUN npm install

# Copy the rest of the source
COPY . .

# VITE_API_URL is baked into the bundle at build time.
# Pass it as a build arg:  --build-arg VITE_API_URL=https://api.example.com
ARG VITE_API_URL=http://localhost:5000/api
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# ── Stage 2: Serve ────────────────────────────────────────────
FROM nginx:alpine AS runner

# Copy compiled assets from the builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Custom nginx config for SPA routing + caching
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
