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

## Next Steps

### 1. Rebuild Dev Container
```
Press F1 → "Dev Containers: Rebuild Container"
```

What happens on rebuild:
- Dev container starts with Docker-in-Docker enabled
- `postCreateCommand` runs: `cd OxideExpo && docker compose -f docker-compose.dev.yml up -d`
- Services start automatically:
  - PostgreSQL (port 5432)
  - Rust backend with hot reload via cargo-watch (port 8080)
  - Next.js frontend with hot reload (port 3000)

### 2. Verify Services Running
```bash
docker ps
```

Expected containers:
- `empleos_db_dev` (PostgreSQL)
- `empleos_backend_dev` (Rust/Actix-web)
- `empleos_frontend_dev` (Next.js)

### 3. Run Tests
```bash
cd OxideExpo
./test-all.sh
```

This runs:
1. Backend integration tests: `cargo test --test '*' -- --test-threads=1`
2. Frontend E2E tests: `npm run test:e2e` (Playwright)

### 4. Fix Any Issues
- Address test failures
- Fix container/pipeline issues
- Ensure hot reload works for development

## Project Structure

```
/workspaces/EmpleosInclusivos/
├── .devcontainer/
│   └── devcontainer.json       # Docker-in-Docker setup
├── .gitignore
├── .git/                       # New git repo (main branch)
├── OxideExpo/                  # Tracked in git
│   ├── backend/                # Rust/Actix-web API
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
| backend | rust:1.75-slim | 8080 | cargo-watch |
| frontend | node:20-slim | 3000 | npm run dev |

## Environment Variables

Backend expects:
- `DATABASE_URL`: postgresql://postgres:postgres@db:5432/empleos_inclusivos
- `JWT_SECRET`: dev-secret-key-change-in-production
- `RUST_LOG`: info

Frontend expects:
- `NEXT_PUBLIC_API_URL`: http://localhost:8080/api
