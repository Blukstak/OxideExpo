# Pending Tasks

This document tracks outstanding issues and improvements identified during the first deployment of the dev container.

**Last Updated:** 2026-02-04

---

## Completed Tasks

### 1. Docker Networking for E2E Tests - COMPLETED

**Solution Implemented:** Next.js API proxy

- Added `async rewrites()` to [next.config.js](OxideExpo/frontend/next.config.js) to proxy `/api/*` to backend
- Added `BACKEND_URL` environment variable to frontend container
- Changed `NEXT_PUBLIC_API_URL` to `/api` (relative URL)
- All 6 E2E tests now pass

**Files Modified:**
- `OxideExpo/frontend/next.config.js`
- `OxideExpo/docker-compose.dev.yml`

---

### 2. Unused Import Warnings - COMPLETED

**Fixed:**
- Removed unused `Job` import from `handlers/jobs.rs`
- Removed unused `sqlx::PgPool` import from `main.rs`

**Files Modified:**
- `OxideExpo/backend/src/handlers/jobs.rs`
- `OxideExpo/backend/src/main.rs`

---

### 5. test-all.sh Script Update - COMPLETED

**Updated script to:**
- Check if Docker containers are running
- Run backend tests via `docker exec` with correct environment variables
- Install Playwright browsers if needed
- Run frontend E2E tests via `docker exec`
- Display colored output

**File Modified:**
- `OxideExpo/test-all.sh`

---

### 6. Production Docker Compose Review - COMPLETED

**Fixed:**
- Updated `Dockerfile.dev` to use `rust:slim` instead of `rust:1.75-slim`

**File Modified:**
- `OxideExpo/backend/Dockerfile.dev`

---

### 9. Playwright E2E Test Setup - COMPLETED

**Problem:**
Playwright tests didn't appear in VS Code Test Explorer and failed to run due to missing browser dependencies.

**Solution Implemented:**
- Created `.vscode/settings.json` with `playwright.configs` pointing to frontend config
- Updated `postCreateCommand` in devcontainer to install Playwright browser and system deps automatically
- Added `slowMo: 500` to playwright.config.ts for easier debugging

**Files Modified:**
- `.devcontainer/devcontainer.json` - added `npm install && npx playwright install --with-deps chromium` to postCreateCommand
- `.vscode/settings.json` - created with Playwright extension config
- `OxideExpo/frontend/playwright.config.ts` - added slowMo for debugging

---

## Remaining Tasks

### 10. Frontend Security Updates (CRITICAL)

**Priority:** CRITICAL
**Impact:** Security vulnerabilities in production dependencies

**Packages to Update:**

| Package | Current | Target | CVE/Issue |
|---------|---------|--------|-----------|
| next | 14.1.0 | 14.2.35+ | CVE-2025-55184 (DoS), CVE-2025-55183 (Source exposure) |
| @playwright/test | 1.40.1 | 1.58.0 | CVE-2025-59288 (SSL verification) |

**Files to Modify:**
- `OxideExpo/frontend/package.json`

---

### 11. Backend Dependency Updates

**Priority:** High
**Impact:** Deprecation warnings, missing features

**Packages to Update:**

| Package | Current | Target | Notes |
|---------|---------|--------|-------|
| sqlx | 0.7 | 0.8 | Fixes deprecation warning |
| axum | 0.7 | 0.8 | Breaking: path params `:name` → `{name}` |
| tower | 0.4 | 0.5 | |
| tower-http | 0.5 | 0.6 | |
| jsonwebtoken | 9 | 10 | API changes |
| uuid | 1.6 | 1.19 | |

**Files to Modify:**
- `OxideExpo/backend/Cargo.toml`
- `OxideExpo/backend/src/**/*.rs` (fix axum path parameter syntax)

---

### 12. Frontend Optional Updates

**Priority:** Low
**Impact:** Transitive dependency vulnerabilities, feature updates

**Packages to Update:**

| Package | Current | Target | Notes |
|---------|---------|--------|-------|
| tailwindcss | 3.4.1 | 4.x | Major version, migration needed |
| typescript | ^5 | 5.9 | Pin to specific version |

**Files to Modify:**
- `OxideExpo/frontend/package.json`
- Potentially Tailwind config if upgrading to v4

---

### 4. Test Database Isolation

**Priority:** Medium
**Impact:** Tests use same database as development

**Current State:**
Tests use `empleos_inclusivos` database (same as dev) when `TEST_DATABASE_URL` points to it.

**Improvement:**
Create separate test database to avoid data conflicts:

```yaml
# In docker-compose.dev.yml, add to db service environment:
POSTGRES_MULTIPLE_DATABASES: empleos_inclusivos,empleos_inclusivos_test
```

Or use a Docker init script to create both databases.

**Files to Modify:**
- `OxideExpo/docker-compose.dev.yml`
- `OxideExpo/backend/tests/common/mod.rs` (update default URL)

---

### 7. Add Health Check Endpoints

**Priority:** Low
**Status:** Partial (backend has `/health`)

**Tasks:**
- Add readiness probe endpoint to backend (`/ready` - checks DB connection)
- Add health check to frontend
- Configure Docker health checks in compose file

---

### 8. Environment Variable Validation

**Priority:** Low

**Task:**
Add startup validation for required environment variables:
- `DATABASE_URL`
- `JWT_SECRET`

Fail fast with clear error messages if missing.

**File to Modify:**
- `OxideExpo/backend/src/main.rs`

---

## Summary

| # | Task | Priority | Status |
|---|------|----------|--------|
| 1 | Docker networking for E2E | High | COMPLETED |
| 2 | Unused import warnings | Low | COMPLETED |
| 4 | Test database isolation | Medium | Pending |
| 5 | test-all.sh script update | Medium | COMPLETED |
| 6 | Production compose review | Medium | COMPLETED |
| 7 | Health check endpoints | Low | Pending |
| 8 | Env var validation | Low | Pending |
| 9 | Playwright E2E test setup | Medium | COMPLETED |
| 10 | Frontend security updates | **CRITICAL** | COMPLETED |
| 11 | Backend dependency updates | High | COMPLETED |
| 12 | Frontend optional updates | Low | Pending |

**Test Results:**
- Backend: 18/18 passing
- Frontend E2E: 6/6 passing
