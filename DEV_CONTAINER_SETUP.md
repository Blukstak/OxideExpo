# Dev Container Setup Status

## Completed

### 1. Dev Container Configuration
- **File**: `.devcontainer/devcontainer.json`
- **Approach**: Docker-in-Docker (DinD) for better security isolation
- **Features**:
  - Docker-in-Docker with Docker Compose v2
  - Named volume `empleos-docker-volumes` to persist Docker volumes across rebuilds
  - Port forwarding: 3000 (frontend), 8080 (backend), 5432 (PostgreSQL)
  - Auto-start services via `postCreateCommand`

### 2. Git Repository Initialized
- **Commit**: `2a616c24239c7fb4aad9e76d5a2d1ef0773d473f`
- **Branch**: `main`
- **Contents**: 57 files (OxideExpo project + dev container config)
- **Note**: Laravel directory is untracked (has its own separate git repo)

### 3. .gitignore Created
- Covers OxideExpo (Rust target/, node_modules/, .next/)
- Covers Laravel dependencies
- Excludes environment files (.env)
- Excludes nested Laravel/.git/ directory

## Architecture Decisions

### Why Docker-in-Docker (vs Docker-outside-of-Docker)?
- **Security**: DooD mounts `/var/run/docker.sock` which gives container root access to host
- **Isolation**: DinD runs Docker daemon inside the container, fully isolated
- **Trade-off**: Slightly more resource usage, but user has powerful PC

### Volume Caching Strategy
- Caching is handled in `docker-compose.dev.yml` (not devcontainer.json)
- Services define their own volumes: `cargo_cache`, `cargo_target`, `node_modules`
- Dev container only persists Docker's internal volume storage (`/var/lib/docker/volumes`)
- This ensures fast rebuilds without duplicating cache configuration

## Setup Instructions

### 1. Rebuild Dev Container
```
Press F1 -> "Dev Containers: Rebuild Container"
```

What happens on rebuild:
- Dev container starts with Docker-in-Docker enabled
- `postCreateCommand` runs: `cd OxideExpo && docker compose -f docker-compose.dev.yml up -d`
- Services start automatically:
  - PostgreSQL (port 5432)
  - Rust backend with hot reload via cargo-watch (port 8080)
  - Next.js frontend with hot reload (port 3000)

### 2. First-Time Startup Notes

**Backend Container (first run takes longer):**
- Installs system dependencies (pkg-config, libssl-dev)
- Installs cargo-watch for hot reload
- Compiles all Rust dependencies
- Runs database migrations automatically
- Subsequent restarts are much faster due to cached volumes

**Frontend Container:**
- Runs `npm install` on startup
- Playwright browsers need separate installation for E2E tests

**Database:**
- Migrations run automatically when backend starts
- Schema includes seed data (regions, categories, sample jobs)

### 3. Verify Services Running
```bash
docker ps
```

Expected containers:
- `empleos_db_dev` (PostgreSQL)
- `empleos_backend_dev` (Rust/Axum)
- `empleos_frontend_dev` (Next.js)

### 4. Test the API
```bash
# Health check
curl http://localhost:8080/health

# List jobs
curl http://localhost:8080/api/jobs
```

### 5. Run Tests

**Backend Integration Tests:**
```bash
docker exec -e TEST_DATABASE_URL=postgresql://postgres:postgres@db:5432/empleos_inclusivos \
  empleos_backend_dev cargo test --test '*' -- --test-threads=1
```

**Frontend E2E Tests:**
```bash
# First time: install Playwright browsers
docker exec empleos_frontend_dev npx playwright install --with-deps chromium

# Run tests
docker exec empleos_frontend_dev npm run test:e2e
```

**Test Results (as of first deployment):**
- Backend: 18/18 passing (6 applications + 5 auth + 7 jobs)
- Frontend: 4/6 passing (2 fail due to Docker networking - see Known Limitations)

## Project Structure

```
/workspaces/EmpleosInclusivos/
├── .devcontainer/
│   └── devcontainer.json       # Docker-in-Docker setup
├── .gitignore
├── .git/                       # New git repo (main branch)
├── OxideExpo/                  # Tracked in git
│   ├── backend/                # Rust/Axum API
│   ├── frontend/               # Next.js app
│   ├── docker-compose.yml      # Production compose
│   ├── docker-compose.dev.yml  # Development compose with hot reload
│   └── test-all.sh             # Test runner script
└── Laravel/                    # Untracked (has own git repo)
    └── .git/                   # Separate repo (branch: sitios/empleossenior)
```

## Services (docker-compose.dev.yml)

| Service | Image | Port | Hot Reload |
|---------|-------|------|------------|
| db | postgres:15-alpine | 5432 | N/A |
| backend | rust:slim (latest) | 8080 | cargo-watch |
| frontend | node:20-slim | 3000 | npm run dev |

## Environment Variables

Backend expects:
- `DATABASE_URL`: postgresql://postgres:postgres@db:5432/empleos_inclusivos
- `JWT_SECRET`: dev-secret-key-change-in-production
- `RUST_LOG`: info

Frontend expects:
- `NEXT_PUBLIC_API_URL`: http://localhost:8080/api

## Fixes Applied (First Deployment)

The following issues were discovered and fixed during the first container rebuild:

### 1. Rust Version Update
- **Issue**: `cargo-watch` dependencies require Rust edition 2024 features
- **Fix**: Changed `rust:1.75-slim` to `rust:slim` (latest stable)
- **File**: `OxideExpo/docker-compose.dev.yml`

### 2. ts-rs Chrono Support
- **Issue**: `DateTime<Utc>` and `NaiveDate` types didn't implement `TS` trait
- **Fix**: Added `chrono-impl` feature to ts-rs dependency
- **File**: `OxideExpo/backend/Cargo.toml`

### 3. Tower ServiceExt for Tests
- **Issue**: Tests couldn't use `oneshot()` method without `util` feature
- **Fix**: Added `util` feature to tower dependency
- **File**: `OxideExpo/backend/Cargo.toml`

### 4. JobWithCompany Struct
- **Issue**: sqlx `query_as!` macro doesn't work with nested `#[sqlx(flatten)]` structs
- **Fix**: Flattened all fields directly in `JobWithCompany` struct
- **File**: `OxideExpo/backend/src/models/job.rs`

### 5. Router Middleware Structure
- **Issue**: Auth middleware was applied to public routes (jobs, login, register)
- **Fix**: Separated protected routes into their own router, then merged
- **File**: `OxideExpo/backend/src/main.rs`

## Known Limitations

### Docker Networking for E2E Tests
- **Issue**: Frontend E2E tests that involve login/registration fail
- **Cause**: Browser inside frontend container tries to reach `localhost:8080` but that refers to the frontend container, not the backend
- **Impact**: 2 of 6 E2E tests fail (login flow, registration flow)
- **Workaround**: Test auth flows manually or run Playwright from host machine
- **Proper Fix**: See PENDING_TASKS.md for solutions

### Compiler Warnings
- Unused imports in `jobs.rs` and `main.rs` (cosmetic only)
- sqlx-postgres future Rust incompatibility warning (non-blocking)
