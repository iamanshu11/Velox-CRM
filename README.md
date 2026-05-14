# Velox-CRM

A full-stack CRM application built with **React + Vite** (frontend) and **Node.js + Express + PostgreSQL** (backend).

---

## Running with Docker (recommended)

> **Prerequisites:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.

### 1. Configure environment

```bash
cp .env.example .env
```

Open `.env` and set a strong `JWT_SECRET` (generate one with `openssl rand -hex 32`).

### 2. Start everything

```bash
docker compose up --build
```

This will:
- Start a **PostgreSQL 16** database and run the schema migrations automatically
- Build and start the **Express API** on `http://localhost:5000`
- Build and serve the **React SPA** via nginx on `http://localhost:3000`

### 3. Create the super-admin (first time only)

The `seed` service is on demand — it does not run as part of `docker compose up`,
so subsequent restarts are not slowed down by a re-seed pass.

```bash
docker compose run --rm seed
```

The script is idempotent: it creates the super-admin if missing, or resets
its password to the documented default if the row already exists.

### 4. Open the app

```
http://localhost:3000
```

| Field    | Value           |
|----------|-----------------|
| Email    | admin@crm.com   |
| Password | VeloxAdmin@2026! |

> ⚠️  **Change the password after your first login.**

---

## Useful commands

| Command | Description |
|---|---|
| `docker compose up --build` | First run / rebuild after code changes |
| `docker compose up -d` | Start in detached (background) mode |
| `docker compose down` | Stop and remove containers |
| `docker compose down -v` | Stop and **delete all data** (wipes the DB) |
| `docker compose logs -f backend` | Stream backend logs |
| `docker compose run --rm seed` | Re-run the super-admin seed (on demand) |
| `docker compose run --rm migrate` | Apply pending migrations to an existing DB |

---

## Project structure

```
Velox-CRM/
├── docker-compose.yml          # Orchestrates all services
├── .env.example                # Copy to .env and fill in secrets
│
├── frontend/                   # React + Vite + TypeScript
│   ├── Dockerfile              # Multi-stage: build → nginx
│   ├── nginx.conf              # SPA routing + gzip + caching
│   └── src/
│
└── backend/
    ├── Dockerfile              # Node 20 alpine
    ├── node-crm/               # Express application
    │   ├── server.js
    │   ├── config/db.js
    │   └── src/
    └── database/
        ├── migrations/         # SQL run automatically by postgres on first boot
        └── seeds/              # superAdminSeed.js
```

---

## Local development (without Docker)

### Backend

```bash
cd backend/node-crm
cp .env.example .env   # fill in your local Postgres credentials
npm install
npm run dev            # nodemon — auto-restarts on file changes
```

### Frontend

```bash
cd frontend
cp .env.example .env   # set VITE_API_URL=http://localhost:5000/api
npm install
npm run dev            # Vite dev server → http://localhost:5173
```
