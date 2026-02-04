# EmpleosInclusivos Platform - Implementation Plan
## Technology-Agnostic Rewrite Roadmap

**Version:** 1.0
**Date:** 2026-02-03
**Status:** Ready for Execution
**Timeline:** 16 weeks (4 months)
**Target:** High-performance, scalable, maintainable job marketplace platform

---

## Table of Contents

1. [Implementation Overview](#implementation-overview)
2. [Backend Technology Adaptations](#backend-technology-adaptations)
3. [Phase-by-Phase Implementation](#phase-by-phase-implementation)
4. [Architecture Design (Technology-Agnostic)](#architecture-design-technology-agnostic)
5. [Database Design & Migration](#database-design--migration)
6. [Testing Strategy](#testing-strategy)
7. [Deployment & Infrastructure](#deployment--infrastructure)
8. [Success Metrics & Monitoring](#success-metrics--monitoring)

---

## Implementation Overview

### Project Goals

**Performance Targets:**
- Support 1,500-2,000 concurrent users on single 8 CPU/16GB RAM server
- API response time: p95 < 300ms (cached < 50ms)
- Database query time: p95 < 50ms
- 10x improvement over current PHP system

**Developer Experience Goals:**
- Comprehensive test coverage (80%+)
- Fast feedback loops (< 2s build times preferred)
- Excellent debugging capabilities
- Clear error messages and logging
- Easy local development setup

**Core Features (Priority Order):**
1. **Core Marketplace** - Job posting, search, applications
2. **Matching Algorithm** - Automated job-candidate matching
3. **Admin Panel & Reporting** - Management tools, analytics, exports
4. **Virtual Fairs** - (Phase 2, deferred initially)

### Timeline Overview

```
┌─────────────────────────────────────────────────────────────────┐
│ Week 1-4:  Foundation & Infrastructure                          │
│ Week 5-8:  Core Marketplace Features                            │
│ Week 9-10: Matching Algorithm                                   │
│ Week 11-12: Admin Panel & Reporting                             │
│ Week 13-14: Testing & Optimization                              │
│ Week 15-16: Deployment & Migration                              │
└─────────────────────────────────────────────────────────────────┘
```

### Technology Stack (Backend Options)

The implementation plan adapts to your chosen backend technology:

| Component | Options | Selection Criteria |
|-----------|---------|-------------------|
| **Backend Language** | Go / Rust / Node.js / Python | Performance, team expertise, ecosystem |
| **Web Framework** | Fiber (Go), Axum (Rust), NestJS (Node), FastAPI (Python) | Maturity, performance, DX |
| **ORM/Database Layer** | GORM (Go), Diesel/sqlx (Rust), TypeORM (Node), SQLAlchemy (Python) | Type safety, query builder |
| **Frontend** | Next.js 14 (React + TypeScript) | ✅ Fixed - SEO critical |
| **Database** | PostgreSQL 15+ | ✅ Fixed - Superior features |
| **Cache** | Redis 7+ | ✅ Fixed - Industry standard |
| **Storage** | MinIO (S3-compatible) | ✅ Fixed - Self-hosted |
| **Queue** | Language-specific (Asynq/sidekiq.rs/BullMQ) | Depends on backend choice |

---

## Backend Technology Adaptations

This section shows how the implementation varies based on your backend choice.

### Option A: Go Implementation

**Framework:** Fiber (Express-like, fastest Go framework)

**Project Structure:**
```
backend/
├── cmd/
│   ├── api/main.go              # HTTP server entry
│   ├── worker/main.go           # Background jobs
│   └── migrate/main.go          # Migrations
├── internal/
│   ├── domain/                  # Business entities
│   ├── repository/              # Data access
│   ├── service/                 # Business logic
│   ├── handler/                 # HTTP handlers
│   └── middleware/              # Auth, logging
├── pkg/                         # Shared utilities
├── migrations/                  # SQL files
└── tests/
```

**Key Libraries:**
```
github.com/gofiber/fiber/v2
gorm.io/gorm
github.com/redis/go-redis/v9
github.com/hibiken/asynq         # Background jobs
github.com/golang-jwt/jwt/v5
github.com/go-playground/validator/v10
```

**Example Service Layer:**
```go
type JobService struct {
    repo  repository.JobRepository
    cache cache.Cache
    queue worker.Queue
}

func (s *JobService) CreateJob(ctx context.Context, req CreateJobRequest) (*domain.Job, error) {
    if err := req.Validate(); err != nil {
        return nil, err
    }

    job := &domain.Job{
        Title:       req.Title,
        CompanyID:   req.CompanyID,
        Description: req.Description,
        Status:      domain.JobStatusDraft,
    }

    if err := s.repo.Create(ctx, job); err != nil {
        return nil, fmt.Errorf("create job: %w", err)
    }

    s.cache.Delete(ctx, fmt.Sprintf("company:%d:jobs", req.CompanyID))
    return job, nil
}
```

**Performance Characteristics:**
- Request throughput: 8,000-12,000 req/sec (with DB)
- Memory per instance: 30-50MB
- Cold start: < 100ms
- Build time: ~2 seconds

**Development Experience:**
- ✅ Fast compilation
- ✅ Excellent debugging (Delve)
- ✅ Built-in testing framework
- ✅ Simple language (25 keywords)
- ⚠️ Verbose error handling

---

### Option B: Rust Implementation

**Framework:** Axum (modern, tokio-based) or Actix (battle-tested, fast)

**Project Structure:**
```
backend/
├── src/
│   ├── main.rs                  # Entry point
│   ├── domain/                  # Business entities
│   ├── repository/              # Data access
│   ├── service/                 # Business logic
│   ├── handler/                 # HTTP handlers
│   ├── middleware/              # Auth, logging
│   └── lib.rs
├── migrations/                  # SQL files
├── tests/
└── Cargo.toml
```

**Key Crates:**
```toml
[dependencies]
axum = "0.8"                     # Web framework
tokio = { version = "1", features = ["full"] }
sqlx = { version = "0.8", features = ["postgres", "runtime-tokio-rustls", "migrate"] }
serde = { version = "1.0", features = ["derive"] }
tower = { version = "0.5", features = ["util"] }  # Middleware
jsonwebtoken = { version = "10", features = ["rust_crypto"] }  # JWT
validator = { version = "0.18", features = ["derive"] }  # Validation
```

**Example Service Layer:**
```rust
pub struct JobService {
    repo: Arc<dyn JobRepository>,
    cache: Arc<dyn Cache>,
    queue: Arc<dyn Queue>,
}

impl JobService {
    pub async fn create_job(
        &self,
        req: CreateJobRequest,
    ) -> Result<Job, AppError> {
        req.validate()?;

        let job = Job {
            title: req.title,
            company_id: req.company_id,
            description: req.description,
            status: JobStatus::Draft,
            ..Default::default()
        };

        let job = self.repo.create(job).await?;

        self.cache.delete(&format!("company:{}:jobs", job.company_id)).await?;

        Ok(job)
    }
}
```

**Performance Characteristics:**
- Request throughput: 10,000-15,000 req/sec (10-20% faster than Go)
- Memory per instance: 20-40MB (lower than Go)
- Cold start: < 50ms
- Build time: 30-60 seconds (slower than Go)

**Development Experience:**
- ✅ Maximum performance
- ✅ Memory safety guarantees
- ✅ Zero-cost abstractions
- ⚠️ Steep learning curve (ownership, lifetimes)
- ⚠️ Slower compilation (5-10x slower than Go)
- ⚠️ More verbose code

---

### Option C: Node.js (TypeScript) Implementation

**Framework:** NestJS (enterprise-grade, Angular-inspired)

**Project Structure:**
```
backend/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── auth/                    # Auth module
│   ├── jobs/                    # Jobs module
│   ├── companies/               # Companies module
│   ├── users/                   # Users module
│   └── common/                  # Shared code
├── test/
└── dist/                        # Compiled output
```

**Key Packages:**
```json
{
  "@nestjs/core": "^10.0.0",
  "@nestjs/common": "^10.0.0",
  "@nestjs/typeorm": "^10.0.0",
  "typeorm": "^0.3.0",
  "pg": "^8.11.0",
  "ioredis": "^5.3.0",
  "bull": "^4.12.0",
  "@nestjs/jwt": "^10.2.0",
  "class-validator": "^0.14.0"
}
```

**Example Service Layer:**
```typescript
@Injectable()
export class JobService {
  constructor(
    @InjectRepository(Job)
    private jobRepository: Repository<Job>,
    private cacheService: CacheService,
    private queueService: QueueService,
  ) {}

  async createJob(req: CreateJobDto): Promise<Job> {
    // Validation happens via decorators
    const job = this.jobRepository.create({
      title: req.title,
      companyId: req.companyId,
      description: req.description,
      status: JobStatus.DRAFT,
    });

    await this.jobRepository.save(job);

    await this.cacheService.del(`company:${req.companyId}:jobs`);

    return job;
  }
}
```

**Performance Characteristics:**
- Request throughput: 3,000-5,000 req/sec (with DB)
- Memory per instance: 100-200MB (higher than Go/Rust)
- Cold start: 500-1000ms
- Build time: 5-10 seconds

**Development Experience:**
- ✅ Fastest development velocity (huge npm ecosystem)
- ✅ Excellent TypeScript integration
- ✅ Built-in dependency injection
- ✅ Comprehensive CLI tooling
- ⚠️ Slower than Go/Rust (but fast enough for most cases)
- ⚠️ Higher memory usage

---

### Option D: Python Implementation

**Framework:** FastAPI (modern, async, automatic API docs)

**Project Structure:**
```
backend/
├── app/
│   ├── main.py
│   ├── core/                    # Config, dependencies
│   ├── models/                  # SQLAlchemy models
│   ├── schemas/                 # Pydantic schemas
│   ├── routers/                 # API endpoints
│   └── services/                # Business logic
├── tests/
└── migrations/                  # Alembic migrations
```

**Key Packages:**
```
fastapi==0.110.0
uvicorn[standard]==0.27.0
sqlalchemy==2.0.25
asyncpg==0.29.0
redis==5.0.1
pydantic==2.5.0
python-jose[cryptography]==3.3.0
celery==5.3.6
```

**Example Service Layer:**
```python
class JobService:
    def __init__(self, db: AsyncSession, cache: Redis, queue: Celery):
        self.db = db
        self.cache = cache
        self.queue = queue

    async def create_job(self, req: CreateJobRequest) -> Job:
        # Validation via Pydantic
        job = Job(
            title=req.title,
            company_id=req.company_id,
            description=req.description,
            status=JobStatus.DRAFT
        )

        self.db.add(job)
        await self.db.commit()
        await self.db.refresh(job)

        await self.cache.delete(f"company:{req.company_id}:jobs")

        return job
```

**Performance Characteristics:**
- Request throughput: 2,000-4,000 req/sec (with DB)
- Memory per instance: 80-150MB
- Cold start: 1-2 seconds
- Build time: N/A (interpreted, but imports take time)

**Development Experience:**
- ✅ Excellent for ML/AI (if matching algorithm needs ML)
- ✅ Clean, readable syntax
- ✅ Automatic API documentation (Swagger)
- ✅ Rich data science ecosystem
- ⚠️ Slower than compiled languages
- ⚠️ GIL limits CPU-bound parallelism

---

### Recommendation Matrix

| Criteria | Go | Rust | Node.js | Python |
|----------|----|----|---------|--------|
| **Performance** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| **Memory Efficiency** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ |
| **Development Speed** | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Learning Curve** | ⭐⭐⭐⭐ | ⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Ecosystem Maturity** | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Debugging Tools** | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Concurrency** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| **Type Safety** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Hiring Difficulty** | ⭐⭐⭐ | ⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |

**For This Project:**
- **Best Performance + DX Balance:** Go ⭐ (recommended if team neutral)
- **Maximum Performance:** Rust ⭐ (if team has expertise or willing to learn)
- **Fastest Development:** Node.js ⭐ (if time to market critical)
- **ML/AI Features:** Python ⭐ (if matching algorithm needs ML)

---

## Phase-by-Phase Implementation

### Phase 1: Foundation & Infrastructure (Weeks 1-4)

**Goal:** Set up development environment, infrastructure, and core authentication system.

#### Week 1: Project Initialization & Prototyping

**Backend Setup:**
- [ ] Initialize backend project with chosen technology
  - Go: `go mod init empleos-inclusivos`
  - Rust: `cargo new backend`
  - Node.js: `nest new backend`
  - Python: `poetry new backend`
- [ ] Set up project structure (following patterns above)
- [ ] Configure linting and formatting
  - Go: `golangci-lint`, `gofmt`
  - Rust: `clippy`, `rustfmt`
  - Node.js: ESLint, Prettier
  - Python: `ruff`, `black`
- [ ] Write Hello World API endpoint
- [ ] Test database connection (PostgreSQL)

**Frontend Setup:**
- [ ] Initialize Next.js 14 project (App Router)
  ```bash
  npx create-next-app@latest frontend --typescript --app --tailwind
  ```
- [ ] Set up Shadcn UI component library
- [ ] Configure ESLint + Prettier
- [ ] Create basic layout structure

**Infrastructure Setup:**
- [ ] Create `docker-compose.yml` for local development
  ```yaml
  services:
    postgres:
      image: postgres:15
      environment:
        POSTGRES_DB: empleos_inclusivos
        POSTGRES_USER: postgres
        POSTGRES_PASSWORD: postgres
      ports:
        - "5432:5432"

    redis:
      image: redis:7
      ports:
        - "6379:6379"

    minio:
      image: minio/minio
      command: server /data --console-address ":9001"
      ports:
        - "9000:9000"
        - "9001:9001"
  ```
- [ ] Test Docker Compose stack

**CI/CD Setup:**
- [ ] Create GitHub Actions workflow
  ```yaml
  name: CI
  on: [push, pull_request]
  jobs:
    test:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v3
        - name: Run tests
          run: # language-specific test command
        - name: Lint
          run: # language-specific lint command
  ```

**Deliverable:** Working Hello World API + Next.js frontend + Docker Compose stack.

---

#### Week 2: Database Schema & Migration

**Database Design:**
- [ ] Design PostgreSQL schema (based on current 80+ MySQL tables)
- [ ] Create migration files
  - Go: Use `golang-migrate`
  - Rust: Use `sqlx` migrations
  - Node.js: Use TypeORM migrations
  - Python: Use Alembic
- [ ] Add proper indexes (critical for performance)
  ```sql
  -- Example: Job search indexes
  CREATE INDEX idx_jobs_status_published
    ON jobs(status, published_at DESC)
    WHERE status = 'active';

  CREATE INDEX idx_jobs_search
    ON jobs USING GIN(search_vector);
  ```

**Data Model Implementation:**
- [ ] Define core entities (User, Company, Job, Application)
- [ ] Implement repository interfaces
- [ ] Write database access layer
- [ ] Unit tests for repositories

**Data Migration Preparation:**
- [ ] Export MySQL schema
- [ ] Write MySQL → PostgreSQL migration script
- [ ] Create data transformation utilities
- [ ] Validate schema equivalence

**Deliverable:** Complete PostgreSQL schema with migrations, repository layer tested.

---

#### Week 3: Authentication & Authorization

**JWT Implementation:**
- [ ] Create JWT token generation/validation
  ```
  Access Token: 15 minutes (in-memory)
  Refresh Token: 7 days (HTTP-only cookie)
  ```
- [ ] Implement token refresh endpoint
- [ ] Redis-based token blacklist (for logout)

**Auth Endpoints:**
- [ ] POST `/api/v1/auth/register` - User registration
- [ ] POST `/api/v1/auth/login` - User login (email + password)
- [ ] POST `/api/v1/auth/refresh` - Refresh access token
- [ ] POST `/api/v1/auth/logout` - Logout (blacklist token)
- [ ] POST `/api/v1/auth/forgot-password` - Password reset request
- [ ] POST `/api/v1/auth/reset-password` - Password reset confirm

**Authorization (RBAC):**
- [ ] Define roles: `applicant`, `company`, `admin`, `omil`
- [ ] Implement middleware to check roles
- [ ] Protect routes based on roles

**Frontend Integration:**
- [ ] Create login/register pages
- [ ] Implement auth context (React Context)
- [ ] Token storage (access token in memory, refresh in cookie)
- [ ] Protected routes (redirect to login if not authenticated)

**Deliverable:** Complete authentication system (login, register, logout, password reset).

---

#### Week 4: Core API Scaffolding

**User Management APIs:**
- [ ] GET `/api/v1/users/me` - Get current user profile
- [ ] PUT `/api/v1/users/me` - Update profile
- [ ] POST `/api/v1/users/me/avatar` - Upload profile picture

**Company Management APIs:**
- [ ] GET `/api/v1/companies/:id` - Get company profile
- [ ] PUT `/api/v1/companies/:id` - Update company (auth: company role)
- [ ] POST `/api/v1/companies/:id/logo` - Upload logo

**Job CRUD APIs (Basic):**
- [ ] POST `/api/v1/jobs` - Create job (auth: company)
- [ ] GET `/api/v1/jobs/:id` - Get job details
- [ ] PUT `/api/v1/jobs/:id` - Update job (auth: company)
- [ ] DELETE `/api/v1/jobs/:id` - Delete job (auth: company)
- [ ] GET `/api/v1/companies/:id/jobs` - List company's jobs

**Testing:**
- [ ] Unit tests for business logic (services)
- [ ] Integration tests for API endpoints
- [ ] Test coverage report

**Deliverable:** Basic CRUD operations for users, companies, jobs working end-to-end.

---

### Phase 2: Core Marketplace Features (Weeks 5-8)

**Goal:** Build full job marketplace functionality (posting, searching, applying).

#### Week 5: Job Search & Filtering

**Search API:**
- [ ] GET `/api/v1/jobs` - Search jobs with filters
  - Query params: `q` (search term), `location`, `salary_min`, `salary_max`, `experience`, `page`, `limit`
  - Use PostgreSQL full-text search:
    ```sql
    SELECT * FROM jobs
    WHERE search_vector @@ plainto_tsquery('spanish', $1)
    ORDER BY published_at DESC
    LIMIT $2 OFFSET $3;
    ```

**Filtering Logic:**
- [ ] Location filter (region, commune)
- [ ] Salary range filter
- [ ] Experience level filter
- [ ] Skills filter (JSONB query)
- [ ] Job type filter (full-time, part-time, remote)

**Caching:**
- [ ] Implement L2 cache (Redis) for search results
  - Cache key: hash of query params
  - TTL: 5 minutes
- [ ] Implement cache invalidation on job create/update

**Frontend - Job Listing Page (SSR):**
- [ ] `/empleos` - Job listing page with filters
- [ ] Server-side rendering for SEO
- [ ] Pagination UI
- [ ] Filter sidebar (location, salary, experience)
- [ ] Job cards with basic info

**Deliverable:** Functional job search with filtering, pagination, and caching.

---

#### Week 6: Job Detail & Application System

**Job Detail API:**
- [ ] GET `/api/v1/jobs/:slug/:id` - Get job with slug (SEO-friendly URL)
- [ ] Include related data: company info, skills required, location
- [ ] Track job views (increment view counter)

**Application API:**
- [ ] POST `/api/v1/jobs/:id/apply` - Submit application
  - Validate user has required fields (resume, contact info)
  - Check if already applied (prevent duplicates)
  - Store application with timestamp
- [ ] GET `/api/v1/users/me/applications` - List user's applications
- [ ] GET `/api/v1/jobs/:id/applications` - List job's applicants (auth: company)

**File Upload (Resume):**
- [ ] Generate pre-signed MinIO upload URL
  ```
  POST /api/v1/upload/resume
  Response: { upload_url: "...", object_key: "..." }
  ```
- [ ] Client uploads directly to MinIO
- [ ] Store object key in user profile
- [ ] Virus scanning (ClamAV integration optional)

**Frontend - Job Detail Page (SSR):**
- [ ] `/empleos/[slug]/[id]` - Job detail page
- [ ] Display full job description
- [ ] Display company info and logo
- [ ] Apply button (opens modal)
- [ ] Application modal with resume upload

**Email Notifications:**
- [ ] Send confirmation email to applicant
- [ ] Send notification email to company (new application)
- [ ] Use background job queue (deferred)

**Deliverable:** Users can view job details and submit applications with resume upload.

---

#### Week 7: Company Dashboard

**Company Dashboard APIs:**
- [ ] GET `/api/v1/companies/me/dashboard` - Dashboard stats
  - Total jobs (active, draft, expired)
  - Total applications (new, viewed, shortlisted)
  - Application trend (last 30 days)
- [ ] GET `/api/v1/companies/me/jobs` - List company's jobs with stats
  - Include: application count, new applications count, view count
- [ ] GET `/api/v1/jobs/:id/applicants` - List applicants for a job
  - Include: user profile, resume URL, application date
  - Filters: status (new, viewed, shortlisted, rejected)

**Applicant Management:**
- [ ] PUT `/api/v1/applications/:id/status` - Update application status
  - Status: `new`, `viewed`, `shortlisted`, `interviewed`, `rejected`, `accepted`
- [ ] POST `/api/v1/applications/:id/note` - Add note to application
- [ ] GET `/api/v1/applications/:id/resume` - Download resume (pre-signed URL)

**Frontend - Company Dashboard:**
- [ ] `/empresa/dashboard` - Dashboard overview with charts
- [ ] `/empresa/empleos` - Manage jobs (list, create, edit, delete)
- [ ] `/empresa/empleos/[id]/candidatos` - View applicants for job
- [ ] Applicant cards with profile summary
- [ ] Filter/search applicants
- [ ] Download resume button

**Deliverable:** Companies can manage jobs and view/filter applicants.

---

#### Week 8: Applicant Dashboard & Profile

**Applicant Profile APIs:**
- [ ] GET `/api/v1/users/me/profile` - Full profile data
  - Personal info, education, experience, skills
- [ ] PUT `/api/v1/users/me/profile` - Update profile
- [ ] POST `/api/v1/users/me/experience` - Add work experience
- [ ] PUT `/api/v1/users/me/experience/:id` - Update experience
- [ ] DELETE `/api/v1/users/me/experience/:id` - Delete experience
- [ ] Similar endpoints for education, skills, languages

**Application Tracking:**
- [ ] GET `/api/v1/users/me/applications` - List applications with status
- [ ] GET `/api/v1/users/me/applications/:id` - Application detail
- [ ] DELETE `/api/v1/applications/:id` - Withdraw application

**Frontend - Applicant Dashboard:**
- [ ] `/dashboard` - Dashboard overview (applications, profile completion)
- [ ] `/dashboard/perfil` - Edit profile form
- [ ] `/dashboard/postulaciones` - View application history
- [ ] `/dashboard/experiencia` - Manage work experience
- [ ] `/dashboard/educacion` - Manage education
- [ ] Form validation with Zod + React Hook Form

**Profile Completion Indicator:**
- [ ] Calculate profile completion percentage
- [ ] Show progress bar and missing fields
- [ ] Encourage users to complete profile

**Deliverable:** Applicants can manage complete profile and track applications.

---

### Phase 3: Matching Algorithm (Weeks 9-10)

**Goal:** Port and implement automated job-candidate matching system.

#### Week 9: Matching Logic Implementation

**Algorithm Analysis:**
- [ ] Review current PHP matching algorithm in `CommandProcesarMatch.php` and `CommandService.php`
- [ ] Document business rules and scoring criteria
- [ ] Define match score calculation formula

**Matching Service:**
- [ ] Implement matching algorithm in chosen language
  ```
  Scoring weights:
  - Skills match: 40%
  - Experience match: 30%
  - Education match: 20%
  - Location match: 10%
  ```
- [ ] Calculate match scores for job-candidate pairs
- [ ] Store scores in `matches` table
  ```sql
  CREATE TABLE matches (
    id BIGSERIAL PRIMARY KEY,
    job_id BIGINT REFERENCES jobs(id),
    user_id BIGINT REFERENCES users(id),
    score DECIMAL(3,2),  -- 0.00 to 1.00
    reasoning TEXT,      -- Human-readable explanation
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(job_id, user_id)
  );
  CREATE INDEX idx_matches_job_score ON matches(job_id, score DESC);
  ```

**Unit Tests:**
- [ ] Test matching algorithm with various candidate profiles
- [ ] Verify scoring calculation accuracy
- [ ] Edge case testing (missing data, null values)

**Deliverable:** Working matching algorithm with test coverage.

---

#### Week 10: Background Jobs & Matching UI

**Background Job Setup:**
- [ ] Set up job queue (Asynq/sidekiq.rs/Bull/Celery)
- [ ] Create matching job definition
  ```
  Job: ProcessMatches
  Trigger: Daily at 2 AM
  Steps:
    1. Fetch active jobs
    2. For each job, fetch candidate pool
    3. Calculate match scores
    4. Upsert match records
    5. Send notification to company (top matches)
  ```
- [ ] Scheduler configuration (cron-like)
- [ ] Job monitoring dashboard (optional: Bull Board, Flower)

**Matching APIs:**
- [ ] GET `/api/v1/jobs/:id/matches` - Get matched candidates for job
  - Params: `min_score` (default 0.7), `limit`, `offset`
  - Response: List of users with match scores and reasoning
- [ ] POST `/api/v1/jobs/:id/invite/:user_id` - Invite candidate to apply
  - Creates invitation record
  - Sends email notification to candidate

**Frontend - Matched Candidates:**
- [ ] `/empresa/empleos/[id]/matches` - View matched candidates
- [ ] Display match score and reasoning
- [ ] Invite candidate button
- [ ] Filter by minimum score

**Frontend - Candidate View:**
- [ ] `/dashboard/invitaciones` - View invitations from companies
- [ ] Display job details and match reasoning
- [ ] Apply button (pre-fill application form)

**Deliverable:** Matching algorithm runs nightly, companies can view and invite matched candidates.

---

### Phase 4: Admin Panel & Reporting (Weeks 11-12)

**Goal:** Build comprehensive admin tools for platform management.

#### Week 11: Admin Management APIs

**User Management:**
- [ ] GET `/api/v1/admin/users` - List users with filters
  - Filters: role, status, registration date range
  - Search by name, email
- [ ] PUT `/api/v1/admin/users/:id/status` - Approve/suspend/ban user
- [ ] DELETE `/api/v1/admin/users/:id` - Delete user (soft delete)
- [ ] POST `/api/v1/admin/users/:id/impersonate` - Impersonate user (OMIL feature)

**Company Management:**
- [ ] GET `/api/v1/admin/companies` - List companies
- [ ] PUT `/api/v1/admin/companies/:id/approve` - Approve company registration
- [ ] PUT `/api/v1/admin/companies/:id/reject` - Reject company with reason

**Job Moderation:**
- [ ] GET `/api/v1/admin/jobs` - List jobs (pending, active, flagged)
- [ ] PUT `/api/v1/admin/jobs/:id/approve` - Approve job
- [ ] PUT `/api/v1/admin/jobs/:id/reject` - Reject job with reason
- [ ] PUT `/api/v1/admin/jobs/:id/flag` - Flag job for review

**Audit Logging:**
- [ ] Create `audit_logs` table
  ```sql
  CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    admin_id BIGINT REFERENCES users(id),
    action VARCHAR(100),  -- 'user.suspend', 'job.approve'
    resource_type VARCHAR(50),
    resource_id BIGINT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  ```
- [ ] Log all admin actions

**Deliverable:** Admin APIs for user, company, and job management with audit logging.

---

#### Week 12: Reporting & Analytics

**Statistics APIs:**
- [ ] GET `/api/v1/admin/stats/overview` - Dashboard overview
  ```json
  {
    "total_users": 1234,
    "new_users_last_30d": 56,
    "total_companies": 89,
    "total_jobs": 456,
    "total_applications": 2345
  }
  ```
- [ ] GET `/api/v1/admin/stats/users` - User stats
  - Registration trend (daily, weekly, monthly)
  - Users by region
  - Users by role
- [ ] GET `/api/v1/admin/stats/jobs` - Job stats
  - Jobs by industry
  - Jobs by region
  - Application conversion rate
- [ ] GET `/api/v1/admin/stats/matching` - Matching stats
  - Match success rate (invited → applied)
  - Average match score

**Excel Export:**
- [ ] POST `/api/v1/admin/reports/export` - Generate Excel report
  - Report types: users, companies, jobs, applications
  - Filters: date range, status, region
  - Background job (long-running reports)
  - Use library:
    - Go: `excelize`
    - Rust: `rust_xlsxwriter`
    - Node.js: `exceljs`
    - Python: `openpyxl`

**Frontend - Admin Dashboard:**
- [ ] `/admin/dashboard` - Overview with charts (Chart.js)
- [ ] `/admin/usuarios` - User management table
- [ ] `/admin/empresas` - Company approval queue
- [ ] `/admin/empleos` - Job moderation queue
- [ ] `/admin/reportes` - Reports & analytics
- [ ] `/admin/configuracion` - System configuration

**Charts & Visualizations:**
- [ ] User registration trend (line chart)
- [ ] Applications by status (pie chart)
- [ ] Jobs by region (bar chart)
- [ ] Match success rate (gauge chart)

**Deliverable:** Complete admin panel with statistics, charts, and Excel export.

---

### Phase 5: Testing & Optimization (Weeks 13-14)

**Goal:** Comprehensive testing, performance optimization, and security hardening.

#### Week 13: Load Testing & Performance

**Load Testing Setup:**
- [ ] Install k6 or Artillery
- [ ] Write load test scenarios
  ```javascript
  // Example: Job search load test
  export default function() {
    http.get('https://api.example.com/jobs?q=software&page=1');
  }

  export const options = {
    vus: 1000,              // 1000 virtual users
    duration: '5m',         // 5 minutes
    thresholds: {
      http_req_duration: ['p(95)<300'],  // 95% under 300ms
      http_req_failed: ['rate<0.01'],    // < 1% error rate
    },
  };
  ```

**Load Test Scenarios:**
1. **Job Search (Read-Heavy):**
   - [ ] 1,000 concurrent users searching jobs
   - Target: p95 < 200ms

2. **Job Application (Write-Heavy):**
   - [ ] 500 concurrent users applying to jobs
   - Target: p95 < 500ms

3. **Company Dashboard (Mixed):**
   - [ ] 200 concurrent companies viewing dashboards
   - Target: p95 < 1s

4. **Sustained Load:**
   - [ ] 10,000 req/sec sustained for 30 minutes
   - Monitor: memory leaks, connection pool exhaustion
   - Target: < 0.1% error rate

**Performance Optimization:**
- [ ] Identify slow queries with EXPLAIN ANALYZE
- [ ] Add missing database indexes
- [ ] Tune cache TTLs (balance freshness vs performance)
- [ ] Optimize N+1 queries (use eager loading)
- [ ] Implement database connection pooling
- [ ] Enable compression (gzip) for API responses

**Database Optimization:**
- [ ] Run VACUUM ANALYZE on PostgreSQL
- [ ] Configure PgBouncer for connection pooling
  ```
  [databases]
  empleos_inclusivos = host=localhost dbname=empleos_inclusivos

  [pgbouncer]
  pool_mode = transaction
  max_client_conn = 1000
  default_pool_size = 25
  ```
- [ ] Set up read replica (optional)

**Deliverable:** System tested at 1,500+ concurrent users with performance report.

---

#### Week 14: Security Audit & Documentation

**Security Audit:**
- [ ] SQL Injection testing (should be impossible with ORMs)
- [ ] XSS testing (sanitize user input)
- [ ] CSRF protection (SameSite cookies, CSRF tokens)
- [ ] Authentication testing (JWT validation, refresh token rotation)
- [ ] Authorization testing (RBAC enforcement)
- [ ] File upload security (file type validation, size limits, virus scan)
- [ ] Rate limiting (prevent DDoS, brute force)
- [ ] Dependency vulnerability scan
  - Go: `govulncheck`
  - Rust: `cargo audit`
  - Node.js: `npm audit`
  - Python: `safety`

**Security Hardening:**
- [ ] Implement security headers (Helmet.js equivalent)
  ```
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  X-XSS-Protection: 1; mode=block
  Strict-Transport-Security: max-age=31536000
  Content-Security-Policy: ...
  ```
- [ ] HTTPS enforcement (redirect HTTP to HTTPS)
- [ ] Secrets management (environment variables, not hardcoded)

**Documentation:**
- [ ] API documentation (Swagger/OpenAPI)
  - Auto-generate from code comments
  - Example requests/responses
- [ ] Architecture Decision Records (ADRs)
  - Document key architectural decisions and rationale
- [ ] Deployment guide
  - Step-by-step production deployment instructions
  - Environment variables reference
  - Troubleshooting guide
- [ ] Developer onboarding guide
  - Local setup instructions
  - Code structure overview
  - Contributing guidelines

**Deliverable:** Security audit report, comprehensive documentation, system production-ready.

---

### Phase 6: Deployment & Migration (Weeks 15-16)

**Goal:** Deploy new system, migrate data, and cutover from old system.

#### Week 15: Deployment & Data Migration

**Production Infrastructure Setup:**
- [ ] Provision servers (8 CPU / 16GB RAM)
- [ ] Install Docker + Docker Compose
- [ ] Set up load balancer (Nginx)
  ```nginx
  upstream api {
    server api1:8080;
    server api2:8080;
  }

  server {
    listen 80;
    server_name api.empleosinclusivos.com;

    location / {
      proxy_pass http://api;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
    }
  }
  ```
- [ ] Configure SSL certificates (Let's Encrypt)
- [ ] Set up monitoring (Grafana + Prometheus)

**Data Migration:**
- [ ] Export final data snapshot from MySQL
- [ ] Run data transformation scripts
- [ ] Import data to PostgreSQL
- [ ] Validate data integrity
  ```sql
  -- Verify row counts
  SELECT 'users', COUNT(*) FROM users
  UNION ALL
  SELECT 'companies', COUNT(*) FROM companies
  UNION ALL
  SELECT 'jobs', COUNT(*) FROM jobs;
  ```
- [ ] Set up dual-write (optional: write to both MySQL and PostgreSQL)

**Deployment:**
- [ ] Build Docker images (backend, frontend)
- [ ] Push images to container registry
- [ ] Deploy via Docker Compose
  ```yaml
  services:
    api:
      image: registry.example.com/api:latest
      replicas: 2
      environment:
        DATABASE_URL: postgresql://...
        REDIS_URL: redis://...
      ports:
        - "8080"
  ```
- [ ] Run smoke tests on production

**Monitoring Setup:**
- [ ] Configure Prometheus scraping
- [ ] Import Grafana dashboards
- [ ] Set up alerting rules
  ```yaml
  - alert: HighErrorRate
    expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
    for: 5m
    annotations:
      summary: "High error rate detected"
  ```
- [ ] Test alert delivery (email, Slack)

**Deliverable:** New system deployed to production, data migrated, monitoring active.

---

#### Week 16: Gradual Rollout & Cutover

**Traffic Routing Strategy:**
```
Day 1-2:  Route 10% of traffic to new system (monitoring closely)
Day 3-5:  Route 50% of traffic (if stable)
Day 6-7:  Route 100% of traffic
Day 8-14: Old system in read-only mode (safety buffer)
Day 15:   Decommission old system
```

**Gradual Rollout:**
- [ ] Configure load balancer for weighted routing
  ```nginx
  # Day 1-2: 10% new, 90% old
  upstream api {
    server new-api:8080 weight=1;
    server old-api:80 weight=9;
  }
  ```
- [ ] Monitor error rates, latency, user complaints
- [ ] Compare metrics (new vs old)

**Rollback Plan:**
- [ ] Document rollback procedure
- [ ] Test rollback in staging (practice)
- [ ] Keep old system ready for quick revert

**Cutover Checklist:**
- [ ] ✅ All features working (functional testing)
- [ ] ✅ Performance metrics met (load testing)
- [ ] ✅ Error rate < 0.1%
- [ ] ✅ No data loss (validation checks)
- [ ] ✅ User feedback positive
- [ ] ✅ Support team trained

**Post-Cutover:**
- [ ] Monitor system health for 7 days
- [ ] Collect user feedback
- [ ] Address any issues immediately
- [ ] Old system read-only mode (data backup)
- [ ] After 7 days: final data sync
- [ ] Decommission old system (archive data)

**Deliverable:** New system handling 100% traffic, old system decommissioned.

---

## Architecture Design (Technology-Agnostic)

### High-Level System Architecture

```
                                   Internet
                                      │
                                      ▼
                            ┌─────────────────┐
                            │  Load Balancer  │ (Nginx)
                            │  SSL Termination│
                            └────────┬────────┘
                                     │
                      ┌──────────────┼──────────────┐
                      │              │              │
                 ┌────▼────┐    ┌───▼────┐    ┌───▼────┐
                 │ API     │    │ API    │    │ API    │ (Stateless, horizontal scale)
                 │ Instance│    │Instance│    │Instance│
                 │  #1     │    │  #2    │    │  #3    │
                 └────┬────┘    └───┬────┘    └───┬────┘
                      │             │             │
        ┌─────────────┼─────────────┼─────────────┼──────────────┐
        │             │             │             │              │
    ┌───▼────┐   ┌───▼─────┐  ┌───▼────┐  ┌─────▼──────┐  ┌───▼─────┐
    │Postgres│   │  Redis  │  │ MinIO  │  │Background  │  │Next.js  │
    │(Primary│   │ (Cache+ │  │ (File  │  │  Worker    │  │Frontend │
    │+Replica│   │Sessions)│  │Storage)│  │  (Jobs)    │  │  (CDN)  │
    └────────┘   └─────────┘  └────────┘  └────────────┘  └─────────┘
```

### API Layer Architecture

**Clean Architecture Layers:**

```
┌───────────────────────────────────────────────────────────┐
│                     HTTP Layer                            │
│  (Controllers/Handlers - Thin layer, no business logic)   │
└───────────────────────┬───────────────────────────────────┘
                        │
┌───────────────────────▼───────────────────────────────────┐
│                   Service Layer                           │
│  (Business Logic - Core application rules)                │
│  - Input validation                                       │
│  - Business rule enforcement                              │
│  - Orchestration (call multiple repos, caches, queues)    │
└───────────────────────┬───────────────────────────────────┘
                        │
┌───────────────────────▼───────────────────────────────────┐
│                  Repository Layer                         │
│  (Data Access - Abstract database operations)             │
│  - CRUD operations                                        │
│  - Complex queries                                        │
│  - Transaction management                                 │
└───────────────────────┬───────────────────────────────────┘
                        │
┌───────────────────────▼───────────────────────────────────┐
│                    Database                               │
│  (PostgreSQL - Data persistence)                          │
└───────────────────────────────────────────────────────────┘
```

**Dependency Injection:**

All layers depend on interfaces/abstractions, not concrete implementations. This allows:
- Easy unit testing (mock dependencies)
- Swapping implementations (e.g., switch cache from Redis to Memcached)
- Clear separation of concerns

**Example (pseudocode):**

```
// Interface (abstraction)
interface JobRepository {
    create(job: Job): Promise<Job>
    findById(id: number): Promise<Job>
    search(filters: JobFilters): Promise<Job[]>
}

// Service depends on interface
class JobService {
    constructor(
        private repo: JobRepository,
        private cache: Cache,
        private queue: Queue
    ) {}

    async createJob(req: CreateJobRequest): Promise<Job> {
        // Business logic
        validate(req)
        const job = await this.repo.create(req)
        await this.cache.invalidate('jobs')
        await this.queue.enqueue('email', { jobId: job.id })
        return job
    }
}

// Concrete implementation
class PostgresJobRepository implements JobRepository {
    // ... actual database code
}

// Dependency injection (wire everything together)
const repo = new PostgresJobRepository(db)
const cache = new RedisCache(redis)
const queue = new AsynqQueue(redis)
const service = new JobService(repo, cache, queue)
```

### Caching Strategy

**Three-Tier Cache Architecture:**

```
Request
   │
   ▼
┌──────────────────────────────────────┐
│ L1: In-Memory Cache (1-5 seconds)   │  ← Hot data (reference tables)
└────────────┬─────────────────────────┘
             │ Miss
             ▼
┌──────────────────────────────────────┐
│ L2: Redis Cache (5-60 minutes)      │  ← Warm data (search results)
└────────────┬─────────────────────────┘
             │ Miss
             ▼
┌──────────────────────────────────────┐
│ L3: PostgreSQL (Persistent)          │  ← Cold data (full dataset)
└──────────────────────────────────────┘
```

**Cache Keys Pattern:**

```
users:{id}                           # User profile
users:{id}:profile                   # Full profile with relations
companies:{id}                       # Company data
companies:{id}:jobs                  # Company's jobs list
jobs:search:{hash_of_filters}        # Search results
jobs:{id}                            # Job detail
jobs:{id}:applicants                 # Job's applicants
```

**Cache Invalidation Strategy:**

1. **Write-Through:** Update database first, then invalidate cache
2. **Event-Driven:** When entity changes, invalidate all related caches
3. **TTL-Based:** Set reasonable expiration times (5 min to 1 hour)

**Example Invalidation (pseudocode):**

```
function updateJob(jobId, updates) {
    // 1. Update database
    job = db.update(jobId, updates)

    // 2. Invalidate related caches
    cache.delete(`jobs:${jobId}`)
    cache.delete(`companies:${job.companyId}:jobs`)
    cache.deletePattern('jobs:search:*')  // All search results

    return job
}
```

### Background Jobs Architecture

**Job Queue System:**

```
API Server                Worker Process
    │                           │
    │  Enqueue Job             │
    ├──────────────────────────►│
    │                           │
    │                       ┌───▼────┐
    │                       │ Redis  │ (Job queue)
    │                       │ Queue  │
    │                       └───┬────┘
    │                           │
    │                       ┌───▼────────────┐
    │                       │ Job Processor  │
    │                       │ - Retry logic  │
    │                       │ - Timeout      │
    │                       │ - Concurrency  │
    │                       └───┬────────────┘
    │                           │
    │                       Execute Job
    │                           │
    │                       ┌───▼────┐
    │                       │Database│
    └───────────────────────┴────────┘
```

**Job Types & Priorities:**

| Queue | Priority | Concurrency | Use Cases | SLA |
|-------|----------|-------------|-----------|-----|
| critical | 10 | 10 workers | Email verification, password reset | < 1 min |
| normal | 5 | 5 workers | Matching algorithm, reports | < 5 min |
| low | 1 | 2 workers | Analytics, cleanup | < 1 hour |

**Job Retry Policy:**

```
Attempt 1: Immediate
Attempt 2: After 1 minute
Attempt 3: After 5 minutes
Attempt 4: After 15 minutes
Attempt 5: Move to dead letter queue (manual review)
```

**Example Job Definition (pseudocode):**

```
class ProcessMatchesJob {
    async execute() {
        // 1. Fetch active jobs
        const jobs = await db.getActiveJobs()

        // 2. For each job, calculate matches
        for (const job of jobs) {
            const candidates = await matchingService.findMatches(job)

            // 3. Store match scores
            for (const candidate of candidates) {
                await db.upsertMatch({
                    jobId: job.id,
                    userId: candidate.id,
                    score: candidate.score
                })
            }
        }

        // 4. Notify companies
        await emailService.sendMatchNotifications()
    }
}

// Schedule job (daily at 2 AM)
scheduler.schedule('0 2 * * *', ProcessMatchesJob)
```

### Authentication & Authorization

**JWT Token Flow:**

```
┌──────┐                                    ┌──────┐
│Client│                                    │Server│
└───┬──┘                                    └───┬──┘
    │                                           │
    │ POST /auth/login                          │
    │ { email, password }                       │
    ├───────────────────────────────────────────►
    │                                           │
    │                           ┌───────────────▼──────────┐
    │                           │ 1. Verify password       │
    │                           │ 2. Generate access token │
    │                           │ 3. Generate refresh token│
    │                           │ 4. Store refresh in Redis│
    │                           └───────────────┬──────────┘
    │                                           │
    │ { accessToken, refreshToken }             │
    ◄───────────────────────────────────────────┤
    │                                           │
    │ Store access token in memory              │
    │ Store refresh token in HTTP-only cookie   │
    │                                           │
    │ GET /api/jobs (with Authorization header) │
    ├───────────────────────────────────────────►
    │                                           │
    │                           ┌───────────────▼──────────┐
    │                           │ 1. Validate JWT          │
    │                           │ 2. Check expiration      │
    │                           │ 3. Extract user ID/role  │
    │                           └───────────────┬──────────┘
    │                                           │
    │ { jobs: [...] }                           │
    ◄───────────────────────────────────────────┤
    │                                           │
    │ (Access token expires after 15 minutes)   │
    │                                           │
    │ POST /auth/refresh (with refresh cookie)  │
    ├───────────────────────────────────────────►
    │                                           │
    │                           ┌───────────────▼──────────┐
    │                           │ 1. Validate refresh token│
    │                           │ 2. Check if blacklisted  │
    │                           │ 3. Generate new access   │
    │                           │ 4. Rotate refresh token  │
    │                           └───────────────┬──────────┘
    │                                           │
    │ { accessToken, refreshToken }             │
    ◄───────────────────────────────────────────┤
```

**JWT Claims Structure:**

```json
{
  "sub": "user_id",
  "email": "user@example.com",
  "role": "applicant|company|admin|omil",
  "company_id": 123,  // if role=company
  "iat": 1234567890,  // issued at
  "exp": 1234568790   // expires at (15 min)
}
```

**Authorization Middleware (pseudocode):**

```
function requireAuth(req, res, next) {
    token = extractTokenFromHeader(req)

    if (!token) {
        return res.status(401).json({ error: 'Unauthorized' })
    }

    try {
        claims = verifyJWT(token)
        req.user = { id: claims.sub, role: claims.role }
        next()
    } catch (err) {
        return res.status(401).json({ error: 'Invalid token' })
    }
}

function requireRole(...roles) {
    return function(req, res, next) {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Forbidden' })
        }
        next()
    }
}

// Usage
app.get('/api/admin/users', requireAuth, requireRole('admin'), handler)
```

---

## Database Design & Migration

### PostgreSQL Schema Design

**Core Tables (Simplified):**

```sql
-- Users (applicants, admins, OMIL staff)
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role VARCHAR(20) NOT NULL,  -- 'applicant', 'admin', 'omil'
    status VARCHAR(20) DEFAULT 'active',
    email_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- Companies
CREATE TABLE companies (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(300) UNIQUE,
    description TEXT,
    industry_id INT,
    logo_url VARCHAR(500),
    website VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'approved', 'rejected'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_companies_status ON companies(status);
CREATE INDEX idx_companies_slug ON companies(slug);

-- Company Users (many-to-many: companies can have multiple users)
CREATE TABLE company_users (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT REFERENCES companies(id) ON DELETE CASCADE,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member',  -- 'owner', 'admin', 'member'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, user_id)
);

-- Jobs
CREATE TABLE jobs (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT REFERENCES companies(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(300) UNIQUE,
    description TEXT,
    requirements JSONB,  -- Flexible: skills, education, experience
    salary_min INT,
    salary_max INT,
    currency VARCHAR(3) DEFAULT 'CLP',
    employment_type VARCHAR(20),  -- 'full_time', 'part_time', 'contract'
    location_type VARCHAR(20),    -- 'on_site', 'remote', 'hybrid'
    region_id INT,
    commune_id INT,
    status VARCHAR(20) DEFAULT 'draft',  -- 'draft', 'active', 'closed', 'expired'
    published_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    view_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Full-text search vector (auto-updated)
    search_vector TSVECTOR GENERATED ALWAYS AS (
        setweight(to_tsvector('spanish', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('spanish', coalesce(description, '')), 'B')
    ) STORED
);

-- Indexes for performance
CREATE INDEX idx_jobs_company ON jobs(company_id);
CREATE INDEX idx_jobs_status_published ON jobs(status, published_at DESC)
    WHERE status = 'active';
CREATE INDEX idx_jobs_search ON jobs USING GIN(search_vector);
CREATE INDEX idx_jobs_location ON jobs(region_id, commune_id);
CREATE INDEX idx_jobs_slug ON jobs(slug);

-- Applications
CREATE TABLE applications (
    id BIGSERIAL PRIMARY KEY,
    job_id BIGINT REFERENCES jobs(id) ON DELETE CASCADE,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'new',  -- 'new', 'viewed', 'shortlisted', 'interviewed', 'rejected', 'accepted'
    resume_url VARCHAR(500),
    cover_letter TEXT,
    viewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(job_id, user_id)  -- Prevent duplicate applications
);
CREATE INDEX idx_applications_job ON applications(job_id, status);
CREATE INDEX idx_applications_user ON applications(user_id, created_at DESC);
CREATE INDEX idx_applications_status ON applications(status);

-- Matches (job-candidate matching scores)
CREATE TABLE matches (
    id BIGSERIAL PRIMARY KEY,
    job_id BIGINT REFERENCES jobs(id) ON DELETE CASCADE,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    score DECIMAL(3,2) NOT NULL,  -- 0.00 to 1.00
    reasoning TEXT,
    invited BOOLEAN DEFAULT false,
    invited_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(job_id, user_id)
);
CREATE INDEX idx_matches_job_score ON matches(job_id, score DESC);
CREATE INDEX idx_matches_user ON matches(user_id);

-- User Profiles (additional applicant data)
CREATE TABLE user_profiles (
    user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    phone VARCHAR(20),
    date_of_birth DATE,
    gender VARCHAR(20),
    nationality VARCHAR(50),
    region_id INT,
    commune_id INT,
    bio TEXT,
    skills JSONB,       -- ["Go", "React", "PostgreSQL"]
    languages JSONB,    -- [{"language": "Spanish", "level": "Native"}]
    disability_info JSONB,  -- Inclusion/disability information
    linkedin_url VARCHAR(255),
    portfolio_url VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Work Experience
CREATE TABLE work_experiences (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    company_name VARCHAR(255),
    position VARCHAR(255),
    description TEXT,
    start_date DATE,
    end_date DATE,  -- NULL if current
    is_current BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_work_exp_user ON work_experiences(user_id, start_date DESC);

-- Education
CREATE TABLE educations (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    institution VARCHAR(255),
    degree VARCHAR(255),
    field_of_study VARCHAR(255),
    start_date DATE,
    end_date DATE,
    is_current BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_education_user ON educations(user_id, start_date DESC);

-- Audit Logs
CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id),
    action VARCHAR(100) NOT NULL,  -- 'user.suspend', 'job.approve', etc.
    resource_type VARCHAR(50),
    resource_id BIGINT,
    metadata JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

-- Reference Tables (catalogs)
CREATE TABLE regions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(10)
);

CREATE TABLE communes (
    id SERIAL PRIMARY KEY,
    region_id INT REFERENCES regions(id),
    name VARCHAR(100) NOT NULL,
    code VARCHAR(10)
);

CREATE TABLE industries (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);
```

### Data Migration Script (Pseudocode)

```python
# Example data migration script
# This is language-agnostic pseudocode

def migrate_users():
    # Fetch users from MySQL
    mysql_users = mysql_db.execute("SELECT * FROM ti_usuarios")

    for mysql_user in mysql_users:
        # Transform data
        pg_user = {
            'id': mysql_user['idusuario'],
            'email': mysql_user['email'],
            'password_hash': mysql_user['password'],
            'first_name': mysql_user['nombre'],
            'last_name': mysql_user['apellidos'],
            'role': determine_role(mysql_user),  # Logic to map role
            'created_at': mysql_user['fecha_creacion'],
        }

        # Insert to PostgreSQL
        pg_db.execute("INSERT INTO users (...) VALUES (...)", pg_user)

        log(f"Migrated user {pg_user['id']}")

    # Verify count
    mysql_count = mysql_db.execute("SELECT COUNT(*) FROM ti_usuarios")[0]
    pg_count = pg_db.execute("SELECT COUNT(*) FROM users")[0]

    if mysql_count != pg_count:
        raise Exception(f"User count mismatch: MySQL={mysql_count}, PG={pg_count}")

def migrate_companies():
    # Similar pattern for companies
    pass

def migrate_jobs():
    # Similar pattern for jobs
    # Special handling for JSONB fields (requirements)
    pass

def main():
    migrate_users()
    migrate_companies()
    migrate_jobs()
    migrate_applications()
    # ... etc

    log("Migration complete!")
```

---

## Testing Strategy

### Testing Pyramid

```
                    ┌──────────┐
                    │   E2E    │ (5%) - Critical user flows
                    │  Tests   │
                    └──────────┘
                  ┌──────────────┐
                  │ Integration  │ (20%) - API endpoints, DB
                  │    Tests     │
                  └──────────────┘
              ┌──────────────────────┐
              │     Unit Tests       │ (75%) - Business logic, utils
              └──────────────────────┘
```

### Unit Tests (75% of tests)

**What to Test:**
- Business logic in service layer
- Utility functions
- Validation logic
- Matching algorithm calculations

**Example (pseudocode):**

```
describe('JobService.createJob', () => {
    it('should create job with valid data', async () => {
        // Arrange
        const mockRepo = createMockRepository()
        const mockCache = createMockCache()
        const service = new JobService(mockRepo, mockCache)

        const request = {
            title: 'Software Engineer',
            companyId: 1,
            description: 'We are hiring...'
        }

        // Act
        const job = await service.createJob(request)

        // Assert
        expect(job.title).toBe('Software Engineer')
        expect(mockRepo.create).toHaveBeenCalledWith(
            expect.objectContaining({ title: 'Software Engineer' })
        )
        expect(mockCache.delete).toHaveBeenCalledWith('company:1:jobs')
    })

    it('should reject job with invalid title', async () => {
        const service = new JobService(mockRepo, mockCache)

        const request = {
            title: 'a',  // Too short
            companyId: 1
        }

        await expect(service.createJob(request))
            .rejects
            .toThrow('Title must be at least 10 characters')
    })
})
```

**Coverage Target:** 80%+ for service layer and utils

### Integration Tests (20% of tests)

**What to Test:**
- API endpoints (HTTP request/response)
- Database operations (real queries against test DB)
- Cache operations
- Authentication/authorization

**Example (pseudocode):**

```
describe('POST /api/v1/jobs', () => {
    beforeAll(async () => {
        // Set up test database
        await db.migrate()
        await db.seed()
    })

    afterAll(async () => {
        await db.cleanup()
    })

    it('should create job when authenticated as company', async () => {
        // Arrange
        const token = await createTestToken({ role: 'company', companyId: 1 })

        // Act
        const response = await request(app)
            .post('/api/v1/jobs')
            .set('Authorization', `Bearer ${token}`)
            .send({
                title: 'Software Engineer',
                description: 'We are hiring...',
                salaryMin: 50000,
                salaryMax: 80000
            })

        // Assert
        expect(response.status).toBe(201)
        expect(response.body.title).toBe('Software Engineer')

        // Verify database
        const job = await db.query('SELECT * FROM jobs WHERE id = $1', [response.body.id])
        expect(job).toBeDefined()
    })

    it('should reject when not authenticated', async () => {
        const response = await request(app)
            .post('/api/v1/jobs')
            .send({ title: 'Job' })

        expect(response.status).toBe(401)
    })
})
```

### E2E Tests (5% of tests)

**What to Test:**
- Critical user flows (happy paths)
- Multi-step workflows

**Tools:** Playwright (or Cypress)

**Example (pseudocode):**

```
test('User can apply to job', async ({ page }) => {
    // Step 1: Login
    await page.goto('/login')
    await page.fill('[name="email"]', 'user@example.com')
    await page.fill('[name="password"]', 'password')
    await page.click('button[type="submit"]')

    // Step 2: Navigate to job
    await page.goto('/empleos')
    await page.click('text=Software Engineer')

    // Step 3: Apply
    await page.click('button:has-text("Postular")')

    // Step 4: Fill application form
    await page.fill('[name="coverLetter"]', 'I am interested...')
    await page.click('button:has-text("Enviar Postulación")')

    // Step 5: Verify success
    await expect(page.locator('text=Postulación enviada')).toBeVisible()

    // Step 6: Verify application appears in dashboard
    await page.goto('/dashboard/postulaciones')
    await expect(page.locator('text=Software Engineer')).toBeVisible()
})

test('Company can view applicants', async ({ page }) => {
    // Login as company
    await loginAsCompany(page)

    // Navigate to job's applicants
    await page.goto('/empresa/empleos/1/candidatos')

    // Verify applicants list
    await expect(page.locator('text=John Doe')).toBeVisible()

    // Download resume
    const downloadPromise = page.waitForEvent('download')
    await page.click('button:has-text("Descargar CV")')
    const download = await downloadPromise
    expect(download.suggestedFilename()).toContain('.pdf')
})
```

**Coverage Target:** 10-15 critical flows

### Test Organization

```
tests/
├── unit/
│   ├── services/
│   │   ├── job_service.test.{ext}
│   │   ├── auth_service.test.{ext}
│   │   └── matching_service.test.{ext}
│   └── utils/
│       └── validation.test.{ext}
├── integration/
│   ├── api/
│   │   ├── auth.test.{ext}
│   │   ├── jobs.test.{ext}
│   │   └── companies.test.{ext}
│   └── repositories/
│       └── job_repository.test.{ext}
└── e2e/
    ├── application_flow.test.{ext}
    ├── company_dashboard.test.{ext}
    └── admin_panel.test.{ext}
```

---

## Deployment & Infrastructure

### Docker Compose (Development & Small Production)

```yaml
version: '3.8'

services:
  # API Service (2 replicas for load balancing)
  api-1:
    build: ./backend
    image: empleos-api:latest
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/empleos_inclusivos
      REDIS_URL: redis://redis:6379
      MINIO_ENDPOINT: minio:9000
      JWT_SECRET: ${JWT_SECRET}
      NODE_ENV: production  # or GO_ENV, etc.
    ports:
      - "8081:8080"
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  api-2:
    build: ./backend
    image: empleos-api:latest
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/empleos_inclusivos
      REDIS_URL: redis://redis:6379
      MINIO_ENDPOINT: minio:9000
      JWT_SECRET: ${JWT_SECRET}
    ports:
      - "8082:8080"
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  # Worker Service (Background jobs)
  worker:
    build: ./backend
    image: empleos-api:latest
    command: worker  # Different entry point
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/empleos_inclusivos
      REDIS_URL: redis://redis:6379
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  # PostgreSQL Database
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: empleos_inclusivos
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    restart: unless-stopped
    command:
      - "postgres"
      - "-c"
      - "max_connections=200"
      - "-c"
      - "shared_buffers=2GB"
      - "-c"
      - "effective_cache_size=6GB"

  # Redis Cache
  redis:
    image: redis:7
    command: redis-server --maxmemory 2gb --maxmemory-policy allkeys-lru
    volumes:
      - redis-data:/data
    ports:
      - "6379:6379"
    restart: unless-stopped

  # MinIO Object Storage
  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
    volumes:
      - minio-data:/data
    ports:
      - "9000:9000"
      - "9001:9001"
    restart: unless-stopped

  # Nginx Load Balancer
  nginx:
    image: nginx:alpine
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - api-1
      - api-2
    restart: unless-stopped

volumes:
  postgres-data:
  redis-data:
  minio-data:
```

### Nginx Configuration

```nginx
upstream api {
    least_conn;  # Load balancing algorithm
    server api-1:8080 max_fails=3 fail_timeout=30s;
    server api-2:8080 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;
    server_name api.empleosinclusivos.com;

    # Redirect HTTP to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.empleosinclusivos.com;

    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;

    location / {
        proxy_pass http://api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # Health check
        proxy_next_upstream error timeout http_500 http_502 http_503;
    }

    location /health {
        proxy_pass http://api/health;
        access_log off;
    }
}
```

### Monitoring Setup (Prometheus + Grafana)

**Prometheus Configuration:**

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'api'
    static_configs:
      - targets: ['api-1:8080', 'api-2:8080']

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']
```

**Grafana Dashboard Metrics:**

1. **API Metrics:**
   - Request rate (req/sec)
   - Response time (p50, p95, p99)
   - Error rate (%)
   - Active connections

2. **Database Metrics:**
   - Connection pool utilization
   - Query latency
   - Slow queries
   - Cache hit rate

3. **System Metrics:**
   - CPU usage (%)
   - Memory usage (%)
   - Disk I/O
   - Network bandwidth

4. **Business Metrics:**
   - New user registrations
   - Job postings
   - Applications submitted
   - Match success rate

---

## Success Metrics & Monitoring

### Performance Metrics (SLIs - Service Level Indicators)

| Metric | Target | Measurement |
|--------|--------|-------------|
| API Response Time (p95) | < 300ms | Prometheus histogram |
| API Response Time (p99) | < 500ms | Prometheus histogram |
| Cached Response Time (p95) | < 50ms | Prometheus histogram |
| Database Query Time (p95) | < 50ms | pg_stat_statements |
| Error Rate | < 0.1% | Prometheus counter |
| Uptime | 99.9% | Prometheus blackbox exporter |
| Cache Hit Rate | > 80% | Redis INFO stats |

### Capacity Metrics

| Metric | Target | Current | Alert Threshold |
|--------|--------|---------|-----------------|
| Concurrent Users | 1,500-2,000 | Monitor | > 1,800 (warning) |
| Requests/Second | 8,000-12,000 | Monitor | > 10,000 (warning) |
| Database Connections | < 150 | Monitor | > 180 (critical) |
| Memory Usage (API) | < 2GB/instance | Monitor | > 1.8GB (warning) |
| CPU Usage | < 80% | Monitor | > 85% (warning) |

### Business Metrics (KPIs)

| Metric | Baseline (Current) | Target (Post-Migration) |
|--------|-------------------|-------------------------|
| Page Load Time | 5-10 seconds | < 2 seconds |
| Job Search Latency | 500ms-2s | < 200ms |
| User Satisfaction (NPS) | Baseline | +20 points |
| Conversion Rate (apply) | Baseline | +20% |
| Support Tickets (performance) | Baseline | -50% |

### Alerting Rules

**Critical Alerts (Immediate Response):**
```yaml
- alert: HighErrorRate
  expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
  for: 5m
  annotations:
    summary: "Error rate > 5% for 5 minutes"
    description: "API is returning {{ $value }}% errors"

- alert: DatabaseDown
  expr: up{job="postgres"} == 0
  for: 1m
  annotations:
    summary: "PostgreSQL is down"

- alert: APIDown
  expr: up{job="api"} == 0
  for: 1m
  annotations:
    summary: "API instance is down"
```

**Warning Alerts (Review Within Hours):**
```yaml
- alert: HighLatency
  expr: histogram_quantile(0.95, http_request_duration_seconds) > 0.3
  for: 10m
  annotations:
    summary: "API p95 latency > 300ms"

- alert: HighCPUUsage
  expr: node_cpu_usage > 0.85
  for: 15m
  annotations:
    summary: "CPU usage > 85%"

- alert: LowCacheHitRate
  expr: redis_keyspace_hits / (redis_keyspace_hits + redis_keyspace_misses) < 0.7
  for: 15m
  annotations:
    summary: "Cache hit rate < 70%"
```

---

## Appendix: Technology-Specific Resources

### Go Resources

**Official Documentation:**
- https://go.dev/
- https://go.dev/tour/
- https://go.dev/doc/effective_go

**Key Libraries:**
- Fiber: https://docs.gofiber.io/
- GORM: https://gorm.io/docs/
- Asynq: https://github.com/hibiken/asynq

**Learning:**
- Go by Example: https://gobyexample.com/
- Awesome Go: https://github.com/avelino/awesome-go

---

### Rust Resources

**Official Documentation:**
- https://www.rust-lang.org/
- https://doc.rust-lang.org/book/
- https://doc.rust-lang.org/rust-by-example/

**Key Crates:**
- Axum: https://docs.rs/axum/
- sqlx: https://docs.rs/sqlx/
- tokio: https://tokio.rs/

**Learning:**
- Rustlings: https://github.com/rust-lang/rustlings
- Awesome Rust: https://github.com/rust-unofficial/awesome-rust

---

### Node.js (TypeScript) Resources

**Official Documentation:**
- https://nodejs.org/docs/
- https://www.typescriptlang.org/docs/
- https://nestjs.com/

**Key Packages:**
- NestJS: https://docs.nestjs.com/
- TypeORM: https://typeorm.io/
- Bull: https://github.com/OptimalBits/bull

---

### Python Resources

**Official Documentation:**
- https://docs.python.org/3/
- https://fastapi.tiangolo.com/
- https://docs.sqlalchemy.org/

**Key Packages:**
- FastAPI: https://fastapi.tiangolo.com/
- SQLAlchemy: https://docs.sqlalchemy.org/
- Celery: https://docs.celeryq.dev/

---

## Conclusion

This implementation plan provides a comprehensive, technology-agnostic roadmap for rebuilding the EmpleosInclusivos platform. Key takeaways:

1. **Flexible Backend Choice:** Adapt to Go, Rust, Node.js, or Python based on team expertise and performance requirements
2. **16-Week Timeline:** Phased approach with clear deliverables
3. **Performance Focus:** 10x improvement (1,500-2,000 concurrent users on single server)
4. **Developer Experience:** Comprehensive testing, monitoring, and documentation
5. **Risk Mitigation:** Gradual rollout, dual-write strategy, rollback plan

**Next Steps:**
1. Choose backend technology (Go recommended, but flexible)
2. Review and approve this plan
3. Week 1: Prototype with chosen stack
4. Begin Phase 1 implementation

**Success Criteria:**
- ✅ 1,500+ concurrent users on 8 CPU/16GB server
- ✅ p95 API latency < 300ms
- ✅ 80%+ test coverage
- ✅ < 0.1% error rate
- ✅ 99.9% uptime

---

**Document Version:** 1.0
**Status:** Ready for Execution
**Last Updated:** 2026-02-03
