# EmpleosInclusivos Platform - Complete Rewrite Analysis

**Date:** 2026-02-03
**Document Version:** 1.1
**Status:** Analysis Complete - **Rust Selected**

> **Decision (2026-02-04):** After evaluating Go vs Rust, **Rust + Axum** was chosen for the backend.
> The POC (OxideExpo) is complete and validates this stack. See `MIGRATION_PLAN_RUST.md` for details.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current System Analysis](#current-system-analysis)
3. [Critical Issues Identified](#critical-issues-identified)
4. [Technology Stack Options](#technology-stack-options)
5. [Recommended Architecture](#recommended-architecture)
6. [Performance Expectations](#performance-expectations)
7. [Migration Strategy](#migration-strategy)
8. [Cost Analysis](#cost-analysis)
9. [Risk Assessment](#risk-assessment)
10. [Conclusion & Next Steps](#conclusion--next-steps)

---

## Executive Summary

This document presents a comprehensive analysis of the EmpleosInclusivos job marketplace platform and provides detailed recommendations for a complete rewrite. The analysis was conducted to address critical performance limitations, security vulnerabilities, and maintainability challenges in the current system.

### Current State

- **Technology:** PHP Laminas MVC (Zend Framework 3.x) monolith with React frontend
- **Database:** MySQL with 80+ tables
- **Critical Issues:**
  - Zero caching infrastructure (severe performance bottleneck)
  - SQL injection vulnerabilities in 11 files
  - Memory-based sessions (SessionArrayStorage) - prevents horizontal scaling
  - Massive controller files (up to 4,299 lines)
  - No test coverage
  - Poor error handling and logging

### Original Recommendation (Go)

- **Backend:** Go + Fiber framework + GORM
- **Frontend:** Next.js 14 (React + TypeScript)
- **Database:** PostgreSQL 15+
- **Infrastructure:** Self-hosted Docker Compose deployment
- **Expected Performance:** 1,500-2,000 concurrent users on single 8 CPU/16GB RAM server (10x improvement)
- **Cost:** $270-420/month for production scale

### Actual Implementation (Rust) ✓

- **Backend:** Rust + Axum 0.8 + sqlx 0.8
- **Frontend:** Next.js 14.2 (React + TypeScript + Zod)
- **Database:** PostgreSQL 15+
- **Infrastructure:** Docker Compose (dev container ready)
- **Status:** POC complete (OxideExpo), 6/6 E2E tests passing

### Key Benefits

1. **10x Performance Improvement:** Go's concurrency model + Redis caching + optimized database queries
2. **Horizontal Scalability:** Distributed sessions, stateless API design
3. **Better Security:** Eliminates SQL injection, implements proper JWT auth, modern security practices
4. **Superior Developer Experience:** Typed language, fast compilation, excellent tooling, comprehensive testing
5. **Cost Effective:** Self-hosted infrastructure, 10x cheaper than AWS managed services

---

## Current System Analysis

### Technology Stack

#### Backend
- **Framework:** Laminas MVC (Zend Framework) version 3.x
- **Language:** PHP 5.6/7.0/8.2 (wide version support)
- **Architecture:** Layered MVC with Service Layer and Table Gateway Pattern
- **Project Size:**
  - 111 PHP files
  - 14 controllers
  - 74 table models (Table Gateway pattern)
  - 80+ database tables

#### Frontend
- **Framework:** React 18.2.0 + TypeScript 4.7.4
- **Build Tool:** Vite 3.0.9
- **Architecture:** Two separate single-page applications (Home & Stand)
- **Integration:** Server-side data injection via `window.viewModelData` (no REST APIs)

#### Database
- **Database:** MySQL
- **Tables:** 80+ tables with `ti_` prefix (Talento Inclusivo)
- **Schema Issues:**
  - Limited secondary indexes
  - Missing composite indexes on frequently joined columns
  - No database-level constraints visible

### Key Features

1. **User Management:**
   - Multiple user types: Applicants, Companies, Admins, OMIL (Municipal Employment Offices)
   - Session-based authentication with 30-day cookie lifetime
   - Profile management with disabilities/inclusion tracking

2. **Job Marketplace:**
   - Job posting and management
   - Application system with tracking
   - Geographic filtering (regions, communes)
   - Skills, languages, education requirements
   - Salary ranges and work conditions

3. **Matching System:**
   - Automated job-candidate matching algorithm
   - Background job processing (CLI commands)
   - Match scores and invitation system

4. **Virtual Fair/Expo:**
   - Virtual exhibition stands
   - Company presentations with 3D-like interface
   - Video integration (YouTube embeds)
   - Fair scheduling with coming soon/active/ended states

5. **OMIL Integration:**
   - Employment office user management
   - Applicant assistance features
   - User impersonation capabilities

6. **Reporting & Analytics:**
   - User and company statistics
   - Job offer analytics
   - Excel export functionality (PHPSpreadsheet)

7. **Multi-site Support:**
   - Multiple portals/sites configuration
   - Site-specific templates

### File Statistics

**Largest Controllers (Lines of Code):**
- `AdminController.php` - 4,299 lines (76 dependencies injected!)
- `ReportesController.php` - 2,765 lines
- `OfertaController.php` - 2,489 lines
- `IndexController.php` - 1,751 lines
- `EmpresaController.php` - 826 lines

**Key Model Files:**
- `OfertasLaboralesTable.php` - 1,234 lines (complex queries with 6+ JOINs)
- 74 table models using Table Gateway pattern

---

## Critical Issues Identified

### 1. Performance Bottlenecks (CRITICAL)

#### No Caching Infrastructure
- **Finding:** Zero caching implementation anywhere in codebase
- **Impact:** Every page load executes full database queries
- **Evidence:**
  ```php
  // config/autoload/local.php.dist
  'config_cache_enabled' => false,
  'module_map_cache_enabled' => false,
  ```
- **Result:** Dashboard queries with aggregations run on every request (500ms-2s latency)

#### Inefficient Database Queries
- **N+1 Query Problems:** Multiple methods execute queries with 5-6 JOINs without optimization
- **Missing Indexes:** Limited secondary indexes, no composite indexes on frequently joined columns
- **Non-SARGABLE Queries:** `DATE_FORMAT()` operations in WHERE clauses prevent index usage
- **Example:**
  ```php
  // EmpresasTable.php line 88 - Non-indexed date filtering
  $sqlSelect->where('DATE_FORMAT(ti_empresas.fecha_creacion,"%Y-%m") >= "' . $anio . '-' . $desde . '"');
  ```

#### Memory-Based Sessions
- **Finding:** `SessionArrayStorage` stores sessions in memory
- **Impact:**
  - Cannot scale horizontally (sessions don't persist across instances)
  - 30-day session lifetime consumes excessive memory
  - Server restart = all users logged out
- **Evidence:**
  ```php
  'session_storage' => [
      'type' => SessionArrayStorage::class
  ],
  'cookie_lifetime' => 60*60*24*30,  // 30 days
  ```

### 2. Security Vulnerabilities (CRITICAL)

#### SQL Injection Risk
- **Finding:** String concatenation in WHERE clauses in 11 files
- **Severity:** HIGH - Exploitable by malicious users
- **Examples:**
  ```php
  // EmpresasTable.php
  $sqlSelect->where('ti_empresas.fecha_creacion >= "' . $anio . '-' . $desde . '"');

  // OfertasLaboralesTable.php
  $sqlSelect->where('ti_ofertas_laborales.titulo_proceso LIKE "%' . $term . '%"');
  ```

#### Hardcoded Credentials
- **Finding:** API credentials hardcoded in controller files
- **Examples:**
  - LinkedIn API credentials in `IndexController.php` (lines 58-59)
  - Google OAuth credentials (lines 69-70)
  - Security salt in plaintext (line 44)

#### File Upload Security Issues
- **Directory Permissions:** Hardcoded to `0777` (world-writable)
- **No Virus Scanning:** Files accepted without malware scanning
- **Spoofable MIME Types:** Only checks `$_FILES['type']` which can be forged
- **Example:**
  ```php
  // EmpresaController.php line 394
  mkdir($path, 0777, true);  // SECURITY RISK
  ```

#### Session Security
- **Session Validators Commented Out:** Remote address and user agent validation disabled
- **Weak Cryptography:** SHA1 + MD5 used for email links (easily cracked)

### 3. Code Quality Issues

#### Massive God Objects
- **AdminController:** 4,299 lines with 76 injected dependencies
  - Violates Single Responsibility Principle
  - Handles 50+ different actions
  - Mixes business logic, validation, and data access

#### Poor Separation of Concerns
- Business logic in controllers instead of service layer
- SQL queries embedded in model methods (not abstracted)
- Email sending directly in controllers
- Configuration as code constants (not database-driven)

#### Code Duplication
- Repeated helper methods across controllers:
  ```php
  private function jsonZF($data) { return new JsonModel($data); }
  private function consoleZF($data) { /* ... */ }
  ```
- 74 table models with similar CRUD patterns (no base class)

### 4. Testing & Quality Assurance

#### No Test Coverage
- **Finding:** Only 1 skeleton test file for entire 111-file codebase
- **Impact:**
  - High risk for regressions
  - Difficult to refactor safely
  - No automated validation
- **Evidence:**
  ```php
  // IndexControllerTest.php - Only tests HTTP status codes
  public function testIndexActionCanBeAccessed() {
      $this->dispatch('/', 'GET');
      $this->assertResponseStatusCode(200);
  }
  ```

#### Minimal Error Handling
- Only 15 files contain `try/catch` blocks
- Most database operations have no error handling
- Basic PHP `error_log()` without structured logging

### 5. Deployment & Infrastructure

#### No CI/CD Tests
- `.gitlab-ci.yml` deploys without running tests
- No database migration validation
- Production deployment commented out

#### Configuration Management
- No `.env` file support
- Database credentials likely in config files
- No secrets management
- Feature flags as constants instead of runtime configuration

---

## Technology Stack Options

### Backend Framework Comparison

#### Option 1: Go + Fiber Framework ⭐ RECOMMENDED

**Performance Characteristics:**
- **Request Throughput:** 40,000-50,000 req/sec (hello world)
- **With Database:** 8,000-12,000 req/sec (realistic workload)
- **Memory Usage:** 25-50MB per instance
- **Concurrency:** Goroutines handle 10,000+ concurrent connections
- **Startup Time:** < 100ms

**Developer Experience:**
- **Compilation:** Fast (~2 seconds for entire project)
- **Debugging:** Excellent (Delve debugger, VS Code integration)
- **Testing:** Built-in testing framework, table-driven tests
- **Learning Curve:** Simple (25 keywords, clear patterns)
- **IDE Support:** Excellent (VS Code, GoLand, Vim)

**Ecosystem:**
- **ORMs:** GORM (feature-rich), sqlx (raw SQL), ent (graph-based)
- **Web Frameworks:** Fiber (fastest), Echo, Gin, Chi
- **Background Jobs:** Asynq (Redis-backed), Machinery
- **Validation:** go-playground/validator
- **Auth:** golang-jwt, OAuth2 libraries

**Production Maturity:**
- Used by: Google, Uber, Dropbox, Docker, Kubernetes, Twitch
- Battle-tested at scale (millions of requests/second)
- Excellent deployment story (single static binary)

**Code Example:**
```go
// Clean, readable service layer
type JobService struct {
    repo  JobRepository
    cache cache.Cache
    queue worker.Queue
}

func (s *JobService) CreateJob(ctx context.Context, req CreateJobRequest) (*Job, error) {
    // Input validation
    if err := req.Validate(); err != nil {
        return nil, ErrInvalidInput
    }

    // Database transaction
    job := &Job{
        Title:       req.Title,
        CompanyID:   req.CompanyID,
        Description: req.Description,
        Status:      JobStatusDraft,
    }

    if err := s.repo.Create(ctx, job); err != nil {
        return nil, fmt.Errorf("create job: %w", err)
    }

    // Cache invalidation
    s.cache.Delete(ctx, fmt.Sprintf("company:%d:jobs", req.CompanyID))

    return job, nil
}
```

**Pros:**
- ✅ Excellent performance (10x faster than PHP)
- ✅ Fast development velocity (simple language, quick compilation)
- ✅ Great debugging tools (Delve, pprof profiling)
- ✅ Single binary deployment (trivial Docker images)
- ✅ Strong concurrency primitives (goroutines, channels)
- ✅ Rich standard library (HTTP, JSON, crypto, testing)
- ✅ Large talent pool (easier to hire than Rust)

**Cons:**
- ❌ Less expressive than Rust (no advanced type system)
- ❌ No memory safety guarantees (but GC prevents most issues)
- ❌ Error handling can be verbose (`if err != nil` pattern)

**Verdict:** **BEST CHOICE** for job marketplace platform - optimal balance of performance, developer experience, and ecosystem maturity.

---

#### Option 2: Rust + Axum/Actix

**Performance Characteristics:**
- **Request Throughput:** 50,000-60,000 req/sec (10-20% faster than Go)
- **Memory Usage:** 15-30MB per instance (lower than Go)
- **Concurrency:** Tokio async runtime, fearless concurrency
- **Zero GC Pauses:** Predictable latency (important for real-time systems)

**Developer Experience:**
- **Compilation:** Slow (30-60 seconds for full rebuild, 5x slower than Go)
- **Debugging:** Good (lldb, rust-gdb) but error messages can be cryptic
- **Learning Curve:** Steep (ownership, lifetimes, borrow checker)
- **IDE Support:** Good (RustAnalyzer, VS Code) but slower than Go

**Ecosystem:**
- **ORMs:** Diesel (mature), SeaORM (active), sqlx (async)
- **Web Frameworks:** Axum (modern), Actix (fast), Rocket (ergonomic)
- **Background Jobs:** tokio-cron, sidekiq.rs
- Less mature than Go ecosystem

**Code Example:**
```rust
// More verbose but extremely safe
pub async fn create_job(
    State(state): State<AppState>,
    Json(req): Json<CreateJobRequest>,
) -> Result<Json<Job>, AppError> {
    // Validation
    req.validate()?;

    // Database transaction
    let job = Job {
        title: req.title,
        company_id: req.company_id,
        description: req.description,
        status: JobStatus::Draft,
        ..Default::default()
    };

    let job = sqlx::query_as::<_, Job>(
        "INSERT INTO jobs (title, company_id, description, status)
         VALUES ($1, $2, $3, $4) RETURNING *"
    )
    .bind(&job.title)
    .bind(&job.company_id)
    .bind(&job.description)
    .bind(&job.status)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(job))
}
```

**Pros:**
- ✅ Maximum performance (10-20% faster than Go)
- ✅ Memory safety guarantees (no data races, no null pointers)
- ✅ Zero-cost abstractions (performance without overhead)
- ✅ Excellent for systems programming

**Cons:**
- ❌ **Steep learning curve** (ownership, lifetimes, borrow checker frustration)
- ❌ **Slower compilation** (5-10x slower than Go, hurts iteration speed)
- ❌ **Smaller ecosystem** (fewer libraries, less mature ORMs)
- ❌ **Harder to hire** (fewer Rust developers available)
- ❌ **Verbose error handling** (Result<T, E> everywhere)

**Verdict:** Excellent for maximum performance, but **Go is more practical** for business application development. Consider Rust only if:
- Absolute maximum performance required (> 20k req/sec sustained)
- Real-time latency requirements (< 5ms p99)
- Team has Rust expertise
- Systems programming needs (embedded, low-level)

---

#### Option 3: Node.js + NestJS

**Performance Characteristics:**
- **Request Throughput:** 15,000-20,000 req/sec (hello world)
- **With Database:** 3,000-5,000 req/sec (realistic workload)
- **Memory Usage:** 100-200MB per instance
- **Concurrency:** Event loop + async/await

**Developer Experience:**
- **Excellent:** TypeScript-first, great CLI, hot reload
- **Testing:** Jest built-in, excellent mocking
- **Debugging:** Chrome DevTools, VS Code debugging

**Ecosystem:**
- **Richest Web Ecosystem:** Millions of npm packages
- **ORMs:** TypeORM, Prisma, Sequelize
- **Mature:** Widely used, huge community

**Pros:**
- ✅ Fastest development velocity (huge ecosystem)
- ✅ Excellent developer experience
- ✅ Easiest to hire for (most developers know JavaScript/TypeScript)
- ✅ Full-stack TypeScript (share types between backend/frontend)

**Cons:**
- ❌ **Slower than Go** (3-5x slower in realistic benchmarks)
- ❌ **Higher memory usage** (3-4x more RAM than Go)
- ❌ **Single-threaded** (need multiple processes for multi-core)
- ❌ **npm dependency hell** (huge node_modules, security risks)

**Verdict:** Good choice for rapid development, but **Go outperforms** for high-concurrency requirements.

---

#### Option 4: Python + FastAPI

**Performance Characteristics:**
- **Request Throughput:** 8,000-12,000 req/sec (with uvicorn)
- **With Database:** 2,000-4,000 req/sec
- **Memory Usage:** 80-150MB per instance

**Developer Experience:**
- **Excellent:** Clean syntax, excellent async support
- **Testing:** pytest, rich ecosystem
- **Great for ML/AI:** If matching algorithm needs ML

**Pros:**
- ✅ Excellent for ML/AI features (matching algorithm)
- ✅ Rich data science ecosystem (pandas, numpy, scikit-learn)
- ✅ Clean, readable code

**Cons:**
- ❌ **Slower than Go** (4-6x slower in benchmarks)
- ❌ **GIL limits true parallelism** (CPU-bound tasks)
- ❌ **Dynamic typing** (unless using mypy strictly)

**Verdict:** Consider only if matching algorithm needs ML features. Otherwise, **Go is faster and more suitable**.

---

#### Option 5: Keep PHP (Laravel/Symfony)

**Performance Characteristics:**
- **Request Throughput:** 2,000-5,000 req/sec (PHP 8.2 + OPcache)
- **Memory Usage:** 50-100MB per instance
- **Modern PHP 8.2+** is significantly faster than older versions

**Pros:**
- ✅ Familiar to current team (lowest learning curve)
- ✅ Mature ecosystem
- ✅ Laravel/Symfony have excellent tooling
- ✅ Lower migration risk (can refactor incrementally)

**Cons:**
- ❌ **Still slower than Go** (2-3x slower)
- ❌ **Blocking I/O model** (harder to handle high concurrency)
- ❌ **Same structural issues** (monolithic controllers, no type safety without static analysis)
- ❌ **PHP-FPM overhead** (process pool management)

**Verdict:** While modern PHP has improved, **Go offers significantly better performance and concurrency** for the requirements (thousands of concurrent users).

---

### Backend Recommendation: Go + Fiber

**Winner:** **Go with Fiber Framework**

**Rationale:**
1. **Performance:** 8,000-12,000 req/sec with database queries (sufficient for 1,500+ concurrent users)
2. **Concurrency:** Goroutines effortlessly handle thousands of concurrent connections
3. **Developer Experience:** Simple language, fast compilation, excellent debugging
4. **Deployment:** Single binary, trivial Docker images (15-30MB)
5. **Ecosystem:** Mature web development libraries (GORM, Fiber, Asynq)
6. **Cost:** Lower memory footprint = fewer servers needed

**Trade-off Accepted:**
- Slightly less expressive than Rust (but simpler and faster to develop)
- Manual memory management vs Rust's compile-time guarantees (but GC prevents most issues)

---

### Frontend Framework Comparison

#### Option 1: Next.js 14 (App Router) ⭐ RECOMMENDED

**Architecture:**
- React 18+ with Server Components
- App Router (file-based routing)
- Server-side rendering (SSR) + Static site generation (SSG)
- API routes (optional, prefer Go backend)

**Performance:**
- Automatic code splitting
- Image optimization (next/image)
- Font optimization
- Prefetching on hover
- Incremental Static Regeneration (ISR)

**SEO:**
- Server-side rendering (critical for job marketplace)
- Dynamic sitemaps
- Metadata API for OpenGraph tags

**Developer Experience:**
- Excellent TypeScript support
- Fast Refresh (hot reload preserves state)
- Built-in CSS Modules, Tailwind support
- Comprehensive documentation

**Pros:**
- ✅ **Excellent SEO** (SSR for job listings, company profiles)
- ✅ Best-in-class developer experience
- ✅ Large ecosystem (React libraries)
- ✅ Easy to hire for (huge React developer pool)
- ✅ Flexible rendering strategies (SSR, SSG, CSR)

**Cons:**
- ❌ Heavier bundle size than Svelte (~100KB vs ~30KB)
- ❌ More complex than simpler frameworks

**Verdict:** **BEST CHOICE** for job marketplace - SEO is critical, React ecosystem is mature, easy to hire developers.

---

#### Option 2: SvelteKit

**Architecture:**
- Svelte compiler (converts components to vanilla JS)
- File-based routing
- Server-side rendering

**Performance:**
- Smaller bundle sizes (~30% smaller than Next.js)
- Faster initial load
- No virtual DOM (compile-time optimization)

**Developer Experience:**
- Simpler syntax (less boilerplate than React)
- Built-in animations
- Reactive by default

**Pros:**
- ✅ Smaller bundle sizes
- ✅ Simpler syntax (less boilerplate)
- ✅ Faster performance (no virtual DOM)

**Cons:**
- ❌ **Smaller ecosystem** (fewer libraries than React)
- ❌ **Harder to hire** (fewer Svelte developers)
- ❌ **Less mature** for large production apps

**Verdict:** Good choice for performance, but **Next.js has better ecosystem and talent pool**.

---

#### Option 3: HTMX + Go Templates (Server-Side Rendering)

**Architecture:**
- Server renders HTML with Go templates
- HTMX adds interactivity without JavaScript framework
- Minimal client-side JavaScript

**Performance:**
- Smallest bundle (~50KB HTMX)
- Fastest time-to-interactive
- No build step needed

**Developer Experience:**
- Simplest architecture (no frontend build)
- Full-stack Go (single language)
- Go's `html/template` package

**Pros:**
- ✅ **Simplest architecture** (no build step, no npm)
- ✅ **Smallest bundle** (< 50KB)
- ✅ **Fastest time-to-interactive**
- ✅ **Full-stack Go** (single language)

**Cons:**
- ❌ **Limited for complex UIs** (dashboards, forms with validation)
- ❌ **Less interactive** (not suitable for SPA-like experiences)
- ❌ **Harder to build modern UX** (no component libraries)

**Verdict:** Good for simple server-rendered apps, but **Next.js is better for complex dashboards and forms**.

---

### Frontend Recommendation: Next.js 14

**Winner:** **Next.js 14 with App Router**

**Rationale:**
1. **SEO Critical:** Job listings and company profiles need server-side rendering for search engines
2. **Mature Ecosystem:** Huge React component library ecosystem (Shadcn UI, Radix UI, etc.)
3. **Hybrid Rendering:** Public pages SSR, dashboards client-side
4. **Developer Experience:** Excellent tooling, hot reload, TypeScript support
5. **Hiring:** Easiest to find React developers

**Architecture:**
- **Public Pages (SSR):** Job listings, company profiles, landing page
- **Dashboards (CSR):** Company dashboard, applicant dashboard, admin panel
- **API:** Prefer Go backend, use Next.js API routes sparingly

---

### Database: PostgreSQL 15+

**Why PostgreSQL over MySQL:**

1. **Performance:**
   - Superior query optimizer (better execution plans)
   - Better full-text search (built-in, no need for separate search engine initially)
   - More efficient for complex queries (CTEs, window functions)

2. **Features:**
   - **JSONB:** Store flexible metadata (job requirements, user preferences) with indexing
   - **Full-Text Search:** Built-in Spanish language support
   - **Row-Level Security:** Security policies at database level
   - **Materialized Views:** Pre-computed reports and analytics
   - **Partitioning:** Scale large tables (job applications, visit tracking)

3. **Data Integrity:**
   - Stronger ACID guarantees
   - Better constraint enforcement
   - Trigger support for complex business logic

4. **Ecosystem:**
   - Better GORM support (Go ORM)
   - Excellent monitoring tools (pg_stat_statements)
   - Built-in connection pooling (PgBouncer)

**Migration Path:**
- Export MySQL data to PostgreSQL
- Use Debezium for change data capture (CDC) during migration
- Dual-write to both databases during transition

---

### Caching: Redis 7+

**Use Cases:**
1. **Session Storage:** Distributed sessions for horizontal scaling
2. **API Response Cache:** Job listings, company profiles (5-60 min TTL)
3. **Rate Limiting:** Token bucket algorithm per user/IP
4. **Background Jobs:** Asynq queue backend
5. **Pub/Sub:** Real-time notifications (optional)

**Cache Strategy:**
```
L1: In-memory cache (hot data, 1-5 seconds TTL)
L2: Redis cache (5-60 minutes TTL)
L3: PostgreSQL with proper indexes
```

---

### Object Storage: MinIO (S3-Compatible)

**Why MinIO:**
- Self-hosted (no AWS vendor lock-in)
- S3-compatible API (easy migration to AWS S3 later)
- High-performance (optimized for throughput)
- Distributed mode (HA setup possible)

**Use Cases:**
- Resumes (PDFs, max 5MB)
- Company logos (images, max 2MB, auto-resize)
- User profile pictures
- Company presentation videos (optional)

---

### Background Jobs: Asynq (Go-native, Redis-backed)

**Why Asynq:**
- Go-native (no separate Node.js/Python workers)
- Redis-backed (leverage existing Redis)
- Built-in retries, scheduling, prioritization
- Web UI for monitoring (Bull Board equivalent)

**Job Types:**
- **High Priority:** Email verification, password reset (< 1 min latency)
- **Normal Priority:** Matching algorithm, notifications (< 5 min latency)
- **Low Priority:** Analytics aggregation, cleanup (< 1 hour latency)

---

### Search Engine: Typesense (Optional)

**Why Typesense over Elasticsearch:**
- Simpler to operate (single binary, < 100MB memory)
- Faster for simple queries (job search)
- Typo-tolerant search out of the box
- Easier to set up (vs Elasticsearch cluster)

**Note:** Can start with PostgreSQL full-text search, migrate to Typesense later if needed.

---

## Recommended Architecture

### High-Level Architecture Diagram

```
┌─────────────────┐
│   Load Balancer │ (Nginx)
│   (Reverse Proxy)│
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼───┐ ┌──▼────┐
│ Go API│ │ Go API│ (Multiple instances)
│Instance│ │Instance│
└───┬───┘ └──┬────┘
    │         │
    ├─────────┴───────┬───────────┬───────────┬──────────┐
    │                 │           │           │          │
┌───▼──────┐  ┌──────▼─────┐ ┌──▼─────┐ ┌───▼────┐ ┌──▼─────┐
│PostgreSQL│  │   Redis    │ │ MinIO  │ │ Asynq  │ │Next.js │
│(Primary +│  │  (Cache +  │ │ (File  │ │ Worker │ │Frontend│
│ Replicas)│  │  Sessions) │ │Storage)│ │ (Jobs) │ │ (CDN)  │
└──────────┘  └────────────┘ └────────┘ └────────┘ └────────┘
```

### Backend Architecture (Go)

**Project Structure:**
```
backend/
├── cmd/
│   ├── api/                  # HTTP server entry point
│   │   └── main.go
│   ├── worker/               # Background job processor
│   │   └── main.go
│   └── migrate/              # Database migration tool
│       └── main.go
├── internal/
│   ├── domain/               # Business entities
│   │   ├── user.go
│   │   ├── job.go
│   │   ├── company.go
│   │   └── application.go
│   ├── repository/           # Data access layer
│   │   ├── user_repo.go
│   │   ├── job_repo.go
│   │   └── company_repo.go
│   ├── service/              # Business logic
│   │   ├── auth_service.go
│   │   ├── job_service.go
│   │   ├── matching_service.go
│   │   └── email_service.go
│   ├── handler/              # HTTP handlers (controllers)
│   │   ├── auth_handler.go
│   │   ├── job_handler.go
│   │   └── company_handler.go
│   ├── middleware/           # HTTP middleware
│   │   ├── auth.go
│   │   ├── logging.go
│   │   └── rate_limit.go
│   ├── cache/                # Redis cache wrapper
│   │   └── cache.go
│   └── worker/               # Background job definitions
│       ├── matching_job.go
│       └── email_job.go
├── pkg/                      # Shared utilities (exportable)
│   ├── validator/
│   ├── errors/
│   └── utils/
├── config/                   # Configuration structs
│   └── config.go
├── migrations/               # SQL migration files
│   ├── 000001_init_schema.up.sql
│   └── 000001_init_schema.down.sql
├── tests/                    # Integration tests
│   └── api_test.go
├── docker-compose.yml        # Local development stack
├── Dockerfile                # Production container
└── go.mod                    # Go dependencies
```

**Clean Architecture Layers:**
```
HTTP Request → Handler → Service → Repository → Database
                   ↓         ↓
                  DTO    Domain Model
```

**Key Design Patterns:**

1. **Repository Pattern:**
```go
type JobRepository interface {
    Create(ctx context.Context, job *Job) error
    FindByID(ctx context.Context, id int64) (*Job, error)
    Search(ctx context.Context, filters JobFilters) ([]*Job, int64, error)
    Update(ctx context.Context, id int64, updates JobUpdates) error
    Delete(ctx context.Context, id int64) error
}
```

2. **Dependency Injection:**
```go
type JobService struct {
    repo  JobRepository
    cache cache.Cache
    queue worker.Queue
}

func NewJobService(repo JobRepository, cache cache.Cache, queue worker.Queue) *JobService {
    return &JobService{
        repo:  repo,
        cache: cache,
        queue: queue,
    }
}
```

3. **Context Propagation:**
```go
func (s *JobService) CreateJob(ctx context.Context, req CreateJobRequest) (*Job, error) {
    // Context carries request ID, user info, timeout
    // ...
}
```

### Frontend Architecture (Next.js)

**Project Structure:**
```
frontend/
├── app/
│   ├── (public)/                 # Public routes (SSR)
│   │   ├── page.tsx             # Landing page
│   │   ├── empleos/             # Job listings
│   │   │   ├── page.tsx         # List view (SSR)
│   │   │   └── [slug]/          # Job detail (SSR)
│   │   │       └── page.tsx
│   │   └── empresa/             # Company profiles (SSR)
│   │       └── [slug]/
│   │           └── page.tsx
│   ├── (auth)/                   # Protected routes (CSR)
│   │   ├── dashboard/            # Applicant dashboard
│   │   │   ├── page.tsx
│   │   │   ├── perfil/
│   │   │   └── postulaciones/
│   │   ├── empresa/              # Company dashboard
│   │   │   ├── page.tsx
│   │   │   ├── empleos/
│   │   │   └── candidatos/
│   │   └── admin/                # Admin panel
│   │       ├── page.tsx
│   │       ├── usuarios/
│   │       └── reportes/
│   ├── api/                      # API routes (minimal, prefer Go backend)
│   │   └── upload/
│   │       └── route.ts
│   └── layout.tsx                # Root layout
├── components/
│   ├── ui/                       # Shadcn UI components
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   └── card.tsx
│   ├── forms/                    # React Hook Form + Zod
│   │   ├── JobForm.tsx
│   │   └── ProfileForm.tsx
│   └── features/                 # Feature-specific components
│       ├── JobCard.tsx
│       ├── CompanyCard.tsx
│       └── ApplicationList.tsx
├── lib/
│   ├── api.ts                    # API client (fetch wrapper)
│   ├── auth.ts                   # Auth helpers
│   └── hooks/                    # Custom React hooks
│       ├── useJobs.ts
│       └── useAuth.ts
├── types/                        # TypeScript types
│   ├── job.ts
│   └── user.ts
├── public/                       # Static assets
└── next.config.js                # Next.js configuration
```

**State Management:**
- **Server State:** TanStack Query (React Query) for API data caching
- **Client State:** Zustand for global UI state (modals, sidebars)
- **Auth State:** React Context for user authentication

**Rendering Strategy:**
- **SSR:** Job listings, company profiles, landing page (SEO critical)
- **CSR:** Dashboards, forms, admin panels (authenticated, no SEO needed)
- **ISR:** Static pages with revalidation (e.g., job listings cache for 5 minutes)

### Database Schema Design

**Improvements Over Current Schema:**

1. **Proper Indexes:**
```sql
-- Job search optimization
CREATE INDEX idx_jobs_status_published ON jobs(status, published_at DESC)
WHERE status = 'active';

CREATE INDEX idx_jobs_company ON jobs(company_id);

-- Full-text search
CREATE INDEX idx_jobs_search ON jobs USING GIN(search_vector);

-- Location filtering
CREATE INDEX idx_jobs_location ON jobs(region_id, commune_id);
```

2. **JSONB for Flexible Data:**
```sql
CREATE TABLE jobs (
    id BIGSERIAL PRIMARY KEY,
    -- ... standard columns ...
    requirements JSONB,  -- Flexible: skills, education, experience
    metadata JSONB       -- Extra data without schema changes
);

-- Query JSONB efficiently
SELECT * FROM jobs
WHERE requirements @> '{"skills": ["Go", "React"]}';
```

3. **Materialized Views for Reports:**
```sql
CREATE MATERIALIZED VIEW job_statistics AS
SELECT
    j.company_id,
    COUNT(*) as total_jobs,
    COUNT(*) FILTER (WHERE status = 'active') as active_jobs,
    COUNT(DISTINCT a.user_id) as total_applicants,
    AVG(a.created_at - j.published_at) as avg_time_to_apply
FROM jobs j
LEFT JOIN applications a ON a.job_id = j.id
GROUP BY j.company_id;

-- Refresh nightly
CREATE INDEX ON job_statistics(company_id);
```

4. **Partitioning for Large Tables:**
```sql
-- Partition applications by month (efficient queries, easier archival)
CREATE TABLE applications (
    id BIGSERIAL,
    job_id BIGINT,
    user_id BIGINT,
    created_at TIMESTAMPTZ,
    -- ... other columns ...
) PARTITION BY RANGE (created_at);

CREATE TABLE applications_2025_01 PARTITION OF applications
FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
```

### Caching Strategy

**Three-Tier Cache:**

```go
// L1: In-memory cache (1-5 seconds, hot data)
func (s *JobService) GetJob(ctx context.Context, id int64) (*Job, error) {
    // Check in-memory cache
    if job, ok := s.memCache.Get(id); ok {
        return job.(*Job), nil
    }

    // L2: Redis cache (5-60 minutes)
    cacheKey := fmt.Sprintf("job:%d", id)
    if cached, err := s.redis.Get(ctx, cacheKey).Result(); err == nil {
        var job Job
        json.Unmarshal([]byte(cached), &job)
        s.memCache.Set(id, &job, 5*time.Second)
        return &job, nil
    }

    // L3: Database
    job, err := s.repo.FindByID(ctx, id)
    if err != nil {
        return nil, err
    }

    // Cache for future requests
    s.memCache.Set(id, job, 5*time.Second)
    jobJSON, _ := json.Marshal(job)
    s.redis.Set(ctx, cacheKey, jobJSON, 30*time.Minute)

    return job, nil
}
```

**Cache Invalidation:**

```go
// Event-driven invalidation
func (s *JobService) UpdateJob(ctx context.Context, id int64, updates JobUpdates) error {
    job, err := s.repo.Update(ctx, id, updates)
    if err != nil {
        return err
    }

    // Invalidate all related caches
    s.invalidateJobCaches(ctx, job)

    return nil
}

func (s *JobService) invalidateJobCaches(ctx context.Context, job *Job) {
    // Specific job cache
    s.memCache.Delete(job.ID)
    s.redis.Del(ctx, fmt.Sprintf("job:%d", job.ID))

    // Company's job list cache
    s.redis.Del(ctx, fmt.Sprintf("company:%d:jobs", job.CompanyID))

    // Search result caches (wildcard deletion)
    s.redis.Del(ctx, "jobs:search:*")
}
```

---

## Performance Expectations

### Current System Baseline (Estimated)

**Hardware:** 8 CPU / 16GB RAM server

| Metric | Current (PHP Laminas) | Notes |
|--------|----------------------|-------|
| Concurrent Users | 100-200 | Limited by memory sessions |
| Request Latency (p95) | 500ms - 2s | No caching, slow queries |
| Database Query Time | 100-500ms | Complex JOINs, missing indexes |
| Memory per Instance | 100-200MB | PHP-FPM process pool |
| Throughput | ~500 req/sec | Single server capacity |

### Target System Performance

**Hardware:** Same 8 CPU / 16GB RAM server

| Metric | Target (Go + PostgreSQL + Redis) | Improvement |
|--------|----------------------------------|-------------|
| Concurrent Users | 1,500-2,000 | **10x improvement** |
| Request Latency (cached, p95) | 10-50ms | **20x improvement** |
| Request Latency (uncached, p95) | 100-300ms | **5x improvement** |
| Database Query Time | 10-50ms | **5x improvement** |
| Memory per Instance | 30-50MB | **3x improvement** |
| Throughput | 8,000-12,000 req/sec | **15x improvement** |

### Single Server Capacity

**8 CPU / 16GB RAM Configuration:**
```
Load Balancer (Nginx)         - 512MB
4x Go API Instances (2GB each) - 8GB
PostgreSQL (4GB)               - 4GB
Redis (2GB)                    - 2GB
Monitoring (1GB)               - 1GB
-----------------------------------------
Total Used                     - 15.5GB
Buffer                         - 0.5GB
```

**Expected Capacity:**
- **1,500-2,000 concurrent users**
- **10,000-15,000 requests/second aggregate**
- **Cache hit rate:** 80%+ for hot data
- **Database connections:** 100-200 active connections (via PgBouncer)

### Horizontal Scaling

**Multi-Server Deployment:**

| Servers | Concurrent Users | Monthly Cost (Self-Hosted) |
|---------|------------------|----------------------------|
| 1x (8 CPU/16GB) | 1,500-2,000 | $85-135 |
| 2x (8 CPU/16GB) | 3,000-4,000 | $170-270 |
| 3x (8 CPU/16GB) + Dedicated DB | 5,000-7,000 | $320-470 |

**Scaling Strategy:**
1. Start with single server (sufficient for MVP and early growth)
2. Add application servers behind load balancer as traffic grows
3. Move database to dedicated server when needed (> 2,000 concurrent users)
4. Add read replicas for reporting queries

### Performance Testing Plan

**Load Testing Tools:** k6 or Artillery

**Test Scenarios:**
1. **Job Search Load Test:**
   - Simulate 1,000 concurrent users searching jobs
   - Target: p95 latency < 200ms
   - Expected cache hit rate: 85%+

2. **Job Application Flow:**
   - Simulate 500 concurrent users applying to jobs
   - Includes form submission, file upload, database writes
   - Target: p95 latency < 500ms

3. **Dashboard Load Test:**
   - Simulate 200 concurrent companies viewing dashboards
   - Complex queries with aggregations
   - Target: p95 latency < 1s

4. **Sustained Load Test:**
   - 10,000 req/sec sustained for 30 minutes
   - Monitor memory leaks, connection pool exhaustion
   - Target: < 1% error rate

---

## Migration Strategy

### Migration Phases Overview

| Phase | Duration | Focus | Deliverables |
|-------|----------|-------|--------------|
| 1. Foundation | 4 weeks | Infrastructure, auth, basic CRUD | Running stack, auth system |
| 2. Core Marketplace | 4 weeks | Job posting, search, applications | Functional marketplace |
| 3. Matching Algorithm | 2 weeks | Port matching logic, background jobs | Matching system working |
| 4. Admin & Reporting | 2 weeks | Admin panel, analytics, Excel exports | Management tools |
| 5. Testing & Optimization | 2 weeks | Load testing, security audit | Production-ready system |
| 6. Deployment & Cutover | 2 weeks | Data migration, gradual rollout | System live |
| **Total** | **16 weeks** | | |

### Phase 1: Foundation (Weeks 1-4)

**Week 1: Infrastructure Setup**
- [ ] Initialize Go project (Fiber + GORM)
- [ ] Initialize Next.js project (App Router)
- [ ] Set up Docker Compose (PostgreSQL, Redis, MinIO)
- [ ] Configure CI/CD pipeline (GitHub Actions)
- [ ] Set up development environments

**Week 2: Database Migration**
- [ ] Export MySQL schema and data
- [ ] Create PostgreSQL schema with improvements (indexes, constraints)
- [ ] Write data migration scripts
- [ ] Validate data integrity
- [ ] Set up database migrations (golang-migrate)

**Week 3: Authentication System**
- [ ] JWT implementation (access + refresh tokens)
- [ ] Login/register endpoints
- [ ] Password reset flow
- [ ] Session management (Redis-backed)
- [ ] Role-based access control (RBAC)

**Week 4: Basic CRUD APIs**
- [ ] User management APIs
- [ ] Company CRUD operations
- [ ] Job CRUD operations (create, read, update, delete)
- [ ] Basic frontend (login, register pages)

**Deliverable:** Running Go API with authentication, PostgreSQL database, Next.js frontend with login.

### Phase 2: Core Marketplace (Weeks 5-8)

**Week 5: Job Search & Filtering**
- [ ] Job search API with filters (location, salary, skills)
- [ ] PostgreSQL full-text search implementation
- [ ] Pagination and sorting
- [ ] Public job listing page (Next.js SSR)
- [ ] Job detail pages (SSR with slug URLs)

**Week 6: Job Application System**
- [ ] Application submission API
- [ ] File upload (resume PDFs to MinIO)
- [ ] Application status tracking
- [ ] Frontend: Application form with resume upload
- [ ] Email notifications (application confirmation)

**Week 7: Company Dashboard**
- [ ] Company dashboard API (job listings, applicants)
- [ ] View applicants per job
- [ ] Download applicant resumes
- [ ] Frontend: Company dashboard UI
- [ ] Applicant filtering and search

**Week 8: Applicant Dashboard**
- [ ] Applicant profile management API
- [ ] View application history
- [ ] Update profile information
- [ ] Frontend: Applicant dashboard UI
- [ ] Profile forms with validation

**Deliverable:** Functional job marketplace (post jobs, search jobs, apply, dashboards).

### Phase 3: Matching Algorithm (Weeks 9-10)

**Week 9: Algorithm Development**
- [ ] Port matching logic from PHP to Go
- [ ] Implement scoring algorithm
  - Skills match (40% weight)
  - Experience match (30% weight)
  - Education match (20% weight)
  - Location match (10% weight)
- [ ] Store match scores in database
- [ ] Unit tests for matching logic

**Week 10: Background Jobs & UI**
- [ ] Asynq job for nightly matching
- [ ] Scheduler configuration (daily at 2 AM)
- [ ] API to fetch matched candidates
- [ ] Company invitation system
- [ ] Frontend: Matched candidates view
- [ ] Send invitations to candidates

**Deliverable:** Matching algorithm running nightly, companies can view and invite matched candidates.

### Phase 4: Admin Panel & Reporting (Weeks 11-12)

**Week 11: Admin APIs**
- [ ] User management (approve, suspend, delete)
- [ ] Company approval workflow
- [ ] Job moderation (approve, reject)
- [ ] System configuration APIs
- [ ] Audit logging (track admin actions)

**Week 12: Reporting & Analytics**
- [ ] Statistics APIs (users, jobs, applications)
- [ ] Aggregated reports (by date range, region, etc.)
- [ ] Excel export (using `excelize` Go library)
- [ ] Frontend: Admin dashboard
- [ ] Frontend: Analytics charts (Chart.js)
- [ ] Frontend: Report generation and download

**Deliverable:** Admin panel with full management capabilities, reporting, and Excel exports.

### Phase 5: Testing & Optimization (Weeks 13-14)

**Week 13: Load Testing**
- [ ] Set up k6 load testing
- [ ] Test 1,000 concurrent users (job search)
- [ ] Test 500 concurrent users (job applications)
- [ ] Identify bottlenecks (slow queries, cache misses)
- [ ] Optimize database queries (EXPLAIN ANALYZE)
- [ ] Tune caching TTLs

**Week 14: Security & Performance**
- [ ] Security audit (SQL injection, XSS, CSRF)
- [ ] Penetration testing
- [ ] Dependency vulnerability scan
- [ ] Performance optimization (image optimization, lazy loading)
- [ ] Documentation (API docs, deployment guide, ADRs)

**Deliverable:** System tested at target load, security audit passed, documentation complete.

### Phase 6: Deployment & Migration (Weeks 15-16)

**Week 15: Data Migration & Deployment**
- [ ] Final data export from MySQL
- [ ] Set up dual-write (new system + old system)
- [ ] Deploy new system to production (parallel to old system)
- [ ] Smoke tests on production
- [ ] Set up monitoring and alerts

**Week 16: Gradual Rollout & Cutover**
- [ ] Route 10% of traffic to new system (monitoring closely)
- [ ] Increase to 50% after 2 days (if stable)
- [ ] Increase to 100% after 1 week
- [ ] Old system in read-only mode (1 week buffer)
- [ ] Final data sync
- [ ] Decommission old system

**Deliverable:** New system in production, all users migrated, old system decommissioned.

### Critical Files to Port

**Matching Algorithm:**
- `module/Application/src/Command/CommandProcesarMatch.php` - Entry point
- `module/Application/src/Service/CommandService.php` - Core matching logic (needs deep review)

**Job Management:**
- `module/Application/src/Controller/OfertaController.php` (2,489 lines) - Business logic
- `module/Application/src/Model/OfertasLaboralesTable.php` (1,234 lines) - Query patterns

**Configuration:**
- `config/autoload/global.php` - Feature flags, multi-site config

**Authentication:**
- `module/Application/src/Service/AuthManager.php` - Auth patterns
- `module/Application/src/Service/AuthAdapter.php` - Password verification

---

## Cost Analysis

### Current System Costs (Estimated)

Assuming similar hardware:
- **Server (8 CPU / 16GB RAM):** $80-120/month
- **Domain + SSL:** $15/month
- **Email Service:** $15/month (if using SendGrid)
- **No CDN:** $0
- **No Caching:** $0
- **Total:** ~$110-150/month

**Hidden Costs:**
- Developer time spent debugging performance issues
- Downtime from crashes (memory issues, sessions)
- Lost conversions from slow load times

### New System Costs

#### MVP Deployment (Single Server)

| Item | Cost/Month | Notes |
|------|------------|-------|
| Server (8 CPU / 16GB RAM) | $50-100 | Hetzner, DigitalOcean, Vultr |
| Domain + SSL | $15 | Cloudflare (includes CDN free tier) |
| Email Service | $15 | SendGrid (10,000 emails/month) |
| Object Storage | $0 | Self-hosted MinIO |
| Monitoring | $0 | Grafana Cloud free tier |
| Database Backups | $5 | S3-compatible storage |
| **Total** | **$85-135** | |

#### Production Scale (1,000+ Users)

| Item | Cost/Month | Notes |
|------|------------|-------|
| App Servers (2x 8 CPU/16GB) | $100-200 | Load balanced |
| Database Server (16GB RAM) | $50-100 | Dedicated PostgreSQL |
| Redis Server (8GB RAM) | $30-50 | Dedicated cache |
| Load Balancer | $20 | Nginx on small VPS |
| CDN | $20 | Cloudflare Pro |
| Email Service | $50 | SendGrid (50k emails/month) |
| Monitoring & Logging | $30 | Grafana Cloud paid tier |
| Error Tracking | $26 | Sentry Developer plan |
| Database Backups | $20 | Daily backups to S3 |
| **Total** | **$346-516** | |

#### Cost Comparison: Self-Hosted vs AWS Managed

**Self-Hosted (Recommended):**
- Production scale: $346-516/month
- Full control, predictable costs
- No vendor lock-in

**AWS Managed Services:**
- **2x RDS db.m5.large:** ~$300/month
- **ElastiCache (2 nodes):** ~$120/month
- **2x EC2 t3.large:** ~$120/month
- **S3 + CloudFront:** ~$50/month
- **ALB:** ~$25/month
- **Total:** ~$615/month

**Savings:** Self-hosted is **40-50% cheaper** than AWS managed for same performance.

### ROI Analysis

**Development Cost:** 16 weeks × 1 developer ≈ $30,000-60,000 (depending on rates)

**Benefits:**
1. **Performance:** 10x more concurrent users on same hardware
2. **Reliability:** Fewer crashes, better monitoring
3. **Security:** Eliminates critical vulnerabilities
4. **Scalability:** Easy horizontal scaling
5. **Developer Velocity:** 2x faster feature development (typed language, better tooling)

**Payback Period:**
- Assuming 20% increase in conversions (faster site, better UX)
- Breakeven in 6-12 months (depending on user growth)

---

## Risk Assessment

### Technical Risks

#### Risk 1: Data Loss During Migration ⚠️ HIGH

**Description:** Data loss or corruption during MySQL → PostgreSQL migration

**Impact:** Critical - could lose user data, job postings, applications

**Likelihood:** Medium (if not properly tested)

**Mitigation:**
- ✅ Dual-write to both databases during transition period
- ✅ Extensive data validation scripts (compare row counts, checksums)
- ✅ Rollback plan (keep MySQL live for 30 days post-cutover)
- ✅ Incremental migration (not big-bang)
- ✅ Test migration on staging environment first

**Residual Risk:** Low (with proper testing)

---

#### Risk 2: Performance Not Meeting Targets ⚠️ MEDIUM

**Description:** New system doesn't achieve 1,500+ concurrent users

**Impact:** High - would require additional hardware or rearchitecture

**Likelihood:** Low (Go's performance is proven at scale)

**Mitigation:**
- ✅ Load testing early (Week 13)
- ✅ Performance budgets per endpoint
- ✅ Horizontal scaling ready (add more app servers)
- ✅ Database read replicas if needed
- ✅ CDN for static assets

**Residual Risk:** Low (can scale horizontally if needed)

---

#### Risk 3: Team Learning Curve (Go) ⚠️ MEDIUM

**Description:** Team struggles with Go syntax, patterns, or tooling

**Impact:** Medium - could delay timeline by 2-4 weeks

**Likelihood:** Medium (depends on team background)

**Mitigation:**
- ✅ Go is simple (25 keywords, clear patterns)
- ✅ Excellent documentation and tutorials available
- ✅ Pair programming / code reviews during ramp-up
- ✅ Start with simple features, progress to complex
- ✅ Prototype in Week 1 to validate team can work with Go

**Residual Risk:** Low (Go is designed for simplicity)

---

#### Risk 4: Feature Parity Delays ⚠️ MEDIUM

**Description:** Time required to replicate all features from old system

**Impact:** Medium - could delay launch by 4-8 weeks

**Likelihood:** Medium (depends on hidden features)

**Mitigation:**
- ✅ Prioritize high-usage features first (80/20 rule)
- ✅ Keep old system running in parallel (gradual migration)
- ✅ Phased rollout (core features → advanced features)
- ✅ Document feature list upfront (avoid surprises)

**Residual Risk:** Low (phased approach allows time)

---

#### Risk 5: Third-Party Integrations Break ⚠️ LOW

**Description:** Integrations with external services (email, OAuth) fail

**Impact:** Medium - affects specific features (login, notifications)

**Likelihood:** Low (standard OAuth2, SMTP protocols)

**Mitigation:**
- ✅ Test integrations in staging environment
- ✅ Use well-maintained libraries (golang-jwt, OAuth2 packages)
- ✅ Monitor integration health with alerts

**Residual Risk:** Very Low

---

### Business Risks

#### Risk 6: User Adoption (UI Changes) ⚠️ MEDIUM

**Description:** Users resist changes in UI/UX

**Impact:** Medium - could affect user satisfaction temporarily

**Likelihood:** Medium (change resistance is common)

**Mitigation:**
- ✅ Gradual rollout (10% → 50% → 100% over 2 weeks)
- ✅ User training materials (help guides, videos)
- ✅ Feedback collection (survey after migration)
- ✅ Support team ready for questions
- ✅ A/B testing for major UX changes

**Residual Risk:** Low (users typically adapt to better UX)

---

#### Risk 7: Budget Overruns ⚠️ LOW

**Description:** Development costs exceed estimates

**Impact:** Medium - requires additional funding

**Likelihood:** Low (16-week estimate has buffer)

**Mitigation:**
- ✅ Fixed-scope phases (can defer non-critical features)
- ✅ Weekly progress tracking (identify delays early)
- ✅ Prioritize MVP features (defer nice-to-haves)

**Residual Risk:** Low

---

### Risk Matrix

| Risk | Impact | Likelihood | Residual Risk | Priority |
|------|--------|------------|---------------|----------|
| Data Loss | Critical | Medium | Low | P0 |
| Performance | High | Low | Low | P1 |
| Learning Curve | Medium | Medium | Low | P2 |
| Feature Parity | Medium | Medium | Low | P2 |
| Integrations | Medium | Low | Very Low | P3 |
| User Adoption | Medium | Medium | Low | P2 |
| Budget | Medium | Low | Low | P3 |

---

## Conclusion & Next Steps

### Summary

This analysis demonstrates that a complete rewrite of the EmpleosInclusivos platform is **strongly recommended** and **highly feasible**. The current PHP system has critical performance, security, and maintainability issues that cannot be easily resolved through incremental improvements.

**Key Findings:**
1. **Performance:** Current system limited to 100-200 concurrent users; new system targets 1,500-2,000 (10x improvement)
2. **Security:** Critical SQL injection vulnerabilities, hardcoded credentials, insecure file uploads
3. **Scalability:** Memory-based sessions prevent horizontal scaling
4. **Maintainability:** Massive controller files (4,299 lines), no tests, poor error handling

**Recommended Solution:**
- **Backend:** Go + Fiber (high performance, simple, excellent concurrency)
- **Frontend:** Next.js 14 (SEO-critical, mature ecosystem)
- **Database:** PostgreSQL (superior features, better performance)
- **Infrastructure:** Self-hosted Docker Compose (cost-effective, full control)
- **Timeline:** 16 weeks from kickoff to production
- **Cost:** $346-516/month for production scale (40-50% cheaper than AWS)

### Decision Matrix

| Factor | Current (PHP) | New (Go) | Verdict |
|--------|---------------|----------|---------|
| **Performance** | 100-200 users | 1,500-2,000 users | ✅ 10x better |
| **Scalability** | Cannot scale horizontally | Easy horizontal scaling | ✅ Much better |
| **Security** | Critical vulnerabilities | Modern security practices | ✅ Much better |
| **Maintainability** | 4,299-line controllers | Modular architecture | ✅ Much better |
| **Testing** | 0% coverage | 80% coverage target | ✅ Much better |
| **Cost** | ~$110-150/mo | ~$346-516/mo | ⚠️ Higher but justified |
| **Development Time** | N/A | 16 weeks | ⚠️ Upfront investment |
| **Risk** | Growing technical debt | Migration risk | ⚠️ Manageable |

**Overall Verdict:** **Strongly Recommend Rewrite**

### Immediate Next Steps

#### 1. Review & Approve Plan (This Week)
- [ ] Review this document with stakeholders
- [ ] Discuss any concerns or questions
- [ ] Confirm technology choices (Go vs alternatives)
- [ ] Approve budget and timeline

#### 2. Prototype (Week 1)
- [ ] Set up minimal Go + Fiber API (Hello World + database connection)
- [ ] Set up minimal Next.js frontend (login page mockup)
- [ ] Test PostgreSQL connection
- [ ] Validate Docker Compose stack works
- [ ] **Goal:** Confirm tech stack is viable (de-risk early)

#### 3. Detailed Planning (Week 2)
- [ ] Break down Phases 1-6 into detailed tasks (Jira/Linear tickets)
- [ ] Assign responsibilities if team > 1 person
- [ ] Set up project management tracking
- [ ] Identify and schedule stakeholder demos (every 2 weeks)

#### 4. Environment Setup (Week 3)
- [ ] Set up GitHub/GitLab repository
- [ ] Configure CI/CD pipeline (GitHub Actions)
- [ ] Create development, staging, production environments
- [ ] Set up monitoring (Grafana + Prometheus)

#### 5. Begin Phase 1 Implementation (Week 4+)
- [ ] Start infrastructure setup
- [ ] Begin authentication system development
- [ ] Start database schema migration

### Success Criteria

The rewrite will be considered successful if:

1. **Performance:** System handles 1,500+ concurrent users on 8 CPU/16GB server
2. **Reliability:** < 0.1% error rate, 99.9% uptime
3. **Security:** Zero critical/high vulnerabilities in security audit
4. **User Experience:** 50% reduction in performance-related complaints
5. **Developer Velocity:** 2x faster feature development post-migration
6. **Cost:** Total cost of ownership within budget ($346-516/month)

### Long-Term Vision (Post-Launch)

Once the rewrite is stable (3-6 months post-launch):

**Phase 7: Advanced Features**
- Machine learning for matching algorithm (TensorFlow/scikit-learn microservice)
- Real-time features (WebSocket notifications, live chat during fairs)
- Mobile apps (React Native, share code with web)
- Advanced analytics (Metabase or Superset for business intelligence)

**Phase 8: Optimization**
- Implement Typesense for advanced search (typo tolerance, faceting)
- Database query optimization (identify slow queries with pg_stat_statements)
- CDN optimization (edge caching, image optimization)
- GraphQL API (reduce over-fetching for complex dashboards)

**Phase 9: Scaling**
- Kubernetes deployment (if scale requires > 10 servers)
- Multi-region deployment (low latency for international users)
- Read replicas for reporting queries
- Message broker (RabbitMQ/Kafka) for event-driven architecture

---

## Appendix

### Technology Documentation Links

**Go:**
- Official Site: https://go.dev/
- Tour of Go: https://go.dev/tour/
- Effective Go: https://go.dev/doc/effective_go
- Go by Example: https://gobyexample.com/

**Fiber Framework:**
- Documentation: https://docs.gofiber.io/
- GitHub: https://github.com/gofiber/fiber
- Benchmarks: https://web-frameworks-benchmark.netlify.app/result

**GORM:**
- Documentation: https://gorm.io/docs/
- Guide: https://gorm.io/docs/index.html

**Next.js:**
- Documentation: https://nextjs.org/docs
- Learn: https://nextjs.org/learn
- App Router Guide: https://nextjs.org/docs/app

**PostgreSQL:**
- Documentation: https://www.postgresql.org/docs/
- Performance Tips: https://wiki.postgresql.org/wiki/Performance_Optimization

**Redis:**
- Documentation: https://redis.io/docs/
- Best Practices: https://redis.io/docs/management/optimization/

**Asynq:**
- Documentation: https://github.com/hibiken/asynq
- Wiki: https://github.com/hibiken/asynq/wiki

### Contact for Questions

For questions about this analysis or implementation plan:
- Technical Architecture: [Architect contact]
- Project Timeline: [PM contact]
- Budget/Resources: [Stakeholder contact]

---

**Document Version:** 1.0
**Last Updated:** 2026-02-03
**Status:** Awaiting Approval
