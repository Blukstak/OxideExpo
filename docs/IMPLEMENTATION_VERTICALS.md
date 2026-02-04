# EmpleosInclusivos - Implementation Verticals

**Version:** 2.0
**Date:** 2026-02-04
**Prerequisites:** [ARCHITECTURE_PLAN.md](ARCHITECTURE_PLAN.md), [CAPABILITIES_CHECKLIST.md](CAPABILITIES_CHECKLIST.md)

---

## Context

**No backwards compatibility required.** This enables:
- Clean-slate PostgreSQL with UUIDs and English naming
- One-time ETL migration from legacy MySQL (before go-live)
- Fresh API design without legacy endpoint matching
- No dual-system operation, no feature flags for gradual rollout

Each vertical builds on the previous layers with no compatibility shims.

---

## Vertical Overview

| Layer | Vertical | Description | Dependencies | Parallel? |
|-------|----------|-------------|--------------|-----------|
| 0 | V1 Infrastructure | DB, Redis, S3, Email, Health | — | — |
| 1 | V2 Authentication | All user types, JWT, OAuth, recovery | V1 | — |
| 2 | V3 Job Seeker Core | Profile, education, experience, CV | V1, V2 | ✓ |
| 2 | V4 Company Core | Company profile, team management | V1, V2 | ✓ |
| 2 | V5 OMIL Core | Organization profile, members | V1, V2 | ✓ |
| 3 | V6 Job Posting | Create, publish, manage jobs | V4 | — |
| 3 | V7 Job Discovery | Public listing, search, filters | V6 | — |
| 4 | V8 Apply to Jobs | Application submission, tracking | V3, V7 | — |
| 4 | V9 Manage Applicants | Review, status changes, export | V8 | — |
| 5 | V10 OMIL Integration | Manage seekers, apply on behalf | V5, V8 | — |
| 5 | V11 Admin Dashboard | Approvals, impersonation, oversight | V3-V10 | — |
| 6 | V12 Reporting | Dashboards, metrics, exports | V11 | — |
| 6 | V13 Virtual Fair | Expo configuration (optional) | V12 | — |

**Parallel opportunity:** V3, V4, V5 can be built simultaneously by different developers after V2 completes.

---

## Dependency Graph

```
                      V1 Infrastructure
                             │
                             ▼
                      V2 Authentication
                             │
             ┌───────────────┼───────────────┐
             ▼               ▼               ▼
      V3 Job Seeker    V4 Company       V5 OMIL
             │               │               │
             │               ▼               │
             │        V6 Job Posting         │
             │               │               │
             │               ▼               │
             │        V7 Job Discovery       │
             │               │               │
             └───────┬───────┘               │
                     ▼                       │
              V8 Apply to Jobs               │
                     │                       │
                     ▼                       │
            V9 Manage Applicants             │
                     │                       │
                     └───────┬───────────────┘
                             ▼
                    V10 OMIL Integration
                             │
                             ▼
                    V11 Admin Dashboard
                             │
                             ▼
                      V12 Reporting
                             │
                             ▼
                    V13 Virtual Fair
```

---

## V1: Infrastructure

### Purpose
Establish core services that all other verticals depend on: database, caching, file storage, email, and observability.

### What Gets Built
- PostgreSQL 16 with extensions (uuid-ossp, pg_trgm, unaccent)
- Redis 7 connection pool
- S3/MinIO client configuration
- Email service (SMTP client, can use Mailhog in dev)
- Health check endpoints
- Error handling framework
- Configuration management (environment variables)
- Logging/tracing setup

### Database Tables
Reference data tables from [ARCHITECTURE_PLAN.md § 2.3](ARCHITECTURE_PLAN.md#23-core-schema):
- countries, regions, municipalities
- industries, work_areas, position_levels
- career_fields, institutions, languages
- skill_categories, skills

### API Endpoints
```
GET  /api/health                    Health check (returns DB, Redis, S3 status)
GET  /api/health/ready              Readiness probe for k8s
GET  /api/reference/countries       List countries
GET  /api/reference/regions         List regions (filter by country)
GET  /api/reference/municipalities  List municipalities (filter by region)
GET  /api/reference/industries      List industries
GET  /api/reference/work-areas      List work areas
GET  /api/reference/position-levels List position levels
GET  /api/reference/career-fields   List career fields
GET  /api/reference/institutions    Institutions (autocomplete)
GET  /api/reference/languages       List languages
GET  /api/reference/skills          List skills (filter by category)
GET  /api/reference/skill-categories List skill categories
```

### Acceptance Criteria
- [ ] `docker-compose up` starts PostgreSQL, Redis, MinIO, Mailhog
- [ ] Database migrations run successfully
- [ ] Reference data is seeded (countries, regions, etc.)
- [ ] `/api/health` returns `{"status": "healthy"}` with service checks
- [ ] All reference endpoints return seeded data
- [ ] TypeScript types generated via ts-rs

### Critical Pattern: AppState
This pattern is used throughout all handlers:

```rust
// src/lib.rs
pub struct AppState {
    pub db: PgPool,
    pub redis: RedisPool,
    pub s3: S3Client,
    pub email: EmailService,
    pub config: Config,
}

// src/main.rs
let state = AppState::new(&config).await?;
let app = Router::new()
    .nest("/api", api_routes())
    .with_state(state);
```

---

## V2: Authentication

### Purpose
Enable all four user types to register, login, and manage their accounts with JWT-based authentication.

### Dependencies
- V1: Database, Redis (token blacklist), Email (verification, recovery)

### What Gets Built
- User registration (job seeker self-service, company+admin, omil+admin)
- Login/logout with JWT access + refresh tokens
- Password recovery flow
- Email verification
- OAuth integration (Google, LinkedIn)
- Auth middleware for protected routes
- Role-based access control foundation

### Database Tables
From [ARCHITECTURE_PLAN.md § 2.3](ARCHITECTURE_PLAN.md#23-core-schema):
- users
- password_reset_tokens
- email_verification_tokens

### API Endpoints
Full specs: [ARCHITECTURE_PLAN.md § 3.3](ARCHITECTURE_PLAN.md#33-authentication-endpoints)
```
POST /api/auth/register              Register job seeker
POST /api/auth/register/company      Register company + first admin
POST /api/auth/register/omil         Register OMIL + first admin
POST /api/auth/login                 Login (returns access + refresh tokens)
POST /api/auth/logout                Logout (blacklist token)
POST /api/auth/refresh               Refresh access token
GET  /api/auth/me                    Get current user + context
POST /api/auth/password/forgot       Request reset email
POST /api/auth/password/reset        Reset with token
PUT  /api/auth/password/change       Change password (authenticated)
GET  /api/auth/oauth/google          Initiate Google OAuth
GET  /api/auth/oauth/linkedin        Initiate LinkedIn OAuth
GET  /api/auth/oauth/callback        OAuth callback
POST /api/auth/email/verify          Verify email with token
POST /api/auth/email/resend          Resend verification
```

### Capabilities Covered
- [CAPABILITIES_CHECKLIST.md § 1.1](CAPABILITIES_CHECKLIST.md) Job Seeker Auth
- [CAPABILITIES_CHECKLIST.md § 2.1](CAPABILITIES_CHECKLIST.md) Company Auth
- [CAPABILITIES_CHECKLIST.md § 3.1](CAPABILITIES_CHECKLIST.md) OMIL Auth
- [CAPABILITIES_CHECKLIST.md § 4.1](CAPABILITIES_CHECKLIST.md) Admin Auth

### Acceptance Criteria
- [ ] Job seeker can register with email/password
- [ ] Job seeker can register via Google OAuth
- [ ] Job seeker can register via LinkedIn OAuth
- [ ] Company admin can register company (pending approval)
- [ ] OMIL admin can register organization (pending approval)
- [ ] All user types can login and receive JWT
- [ ] Protected endpoints reject requests without valid JWT
- [ ] Password recovery email is sent
- [ ] Password reset with valid token works
- [ ] Logout invalidates token (blacklist check)
- [ ] Refresh token rotation works

### Critical Pattern: Auth Middleware
```rust
// src/middleware/auth.rs
pub async fn require_auth<B>(
    State(state): State<AppState>,
    mut request: Request<B>,
    next: Next<B>,
) -> Result<Response, ApiError> {
    let token = extract_bearer_token(&request)?;
    let claims = validate_jwt(&token, &state.config.jwt_secret)?;

    // Check blacklist
    if state.redis.is_blacklisted(&claims.jti).await? {
        return Err(ApiError::Unauthorized);
    }

    request.extensions_mut().insert(claims);
    Ok(next.run(request).await)
}
```

---

## V3: Job Seeker Core

### Purpose
Enable job seekers to build their professional profile with all profile sections.

### Dependencies
- V1: Database, S3 (file uploads)
- V2: Authentication (JWT required)

### What Gets Built
- Personal information management
- Disability/inclusion information
- Education records (all levels)
- Work experience
- Skills with proficiency
- Languages with proficiency
- Portfolio items
- Profile image upload
- CV upload
- Profile completeness calculation

### Database Tables
From [ARCHITECTURE_PLAN.md § 2.3](ARCHITECTURE_PLAN.md#23-core-schema):
- job_seeker_profiles
- job_seeker_disabilities
- education_records
- work_experiences
- user_skills
- user_languages
- portfolio_items

### API Endpoints
Full specs: [ARCHITECTURE_PLAN.md § 3.4](ARCHITECTURE_PLAN.md#34-job-seeker-endpoints)
```
GET/PUT    /api/me/profile           Profile CRUD
PUT/DELETE /api/me/profile/image     Profile image
PUT/DELETE /api/me/cv                CV document
GET/PUT    /api/me/disability        Disability info
CRUD       /api/me/education         Education records
CRUD       /api/me/experience        Work experience
CRUD       /api/me/skills            Skills
CRUD       /api/me/languages         Languages
CRUD       /api/me/portfolio         Portfolio items
GET/PUT    /api/me/settings          Account settings
DELETE     /api/me/account           Close account
```

### Capabilities Covered
[CAPABILITIES_CHECKLIST.md § 1.2](CAPABILITIES_CHECKLIST.md) Profile Management (~40 items)

### Acceptance Criteria
- [ ] User can view/update personal info (name, DOB, location, contact)
- [ ] User can upload profile image (max 2MB, jpg/png/webp)
- [ ] User can upload CV (max 5MB, PDF only)
- [ ] User can declare disability status and accommodations
- [ ] User can add/edit/delete education records (all levels)
- [ ] User can add/edit/delete work experiences
- [ ] User can add/remove skills with 1-5 proficiency
- [ ] User can add/remove languages with proficiency level
- [ ] User can add/edit/delete portfolio items
- [ ] Profile completeness percentage calculates automatically
- [ ] Invalid uploads show appropriate errors

---

## V4: Company Core

### Purpose
Enable companies to set up their organization profile and manage team members.

### Dependencies
- V1: Database, S3 (logo/cover uploads)
- V2: Authentication

### What Gets Built
- Company profile management
- Logo and cover image uploads
- Team member invitation flow
- Role management (owner, admin, member)
- Company approval status handling

### Database Tables
From [ARCHITECTURE_PLAN.md § 2.3](ARCHITECTURE_PLAN.md#23-core-schema):
- companies
- company_members

### API Endpoints
Full specs: [ARCHITECTURE_PLAN.md § 3.6](ARCHITECTURE_PLAN.md#36-company-endpoints)
```
GET/PUT    /api/company/profile      Company profile
PUT/DELETE /api/company/profile/logo Logo upload
PUT/DELETE /api/company/profile/cover Cover image
GET        /api/company/members      List members
POST       /api/company/members/invite Invite member
PUT        /api/company/members/{id}/role Change role
DELETE     /api/company/members/{id} Remove member
```

### Capabilities Covered
[CAPABILITIES_CHECKLIST.md § 2.2](CAPABILITIES_CHECKLIST.md) Company Profile (~15 items)

### Acceptance Criteria
- [ ] Company admin can update company profile
- [ ] Company admin can upload logo (max 2MB)
- [ ] Company admin can upload cover image (max 5MB)
- [ ] Company admin can invite team members by email
- [ ] Invited users receive email and can accept
- [ ] Owner can change member roles
- [ ] Owner can remove members (except self)
- [ ] Pending approval status shown to company users

---

## V5: OMIL Core

### Purpose
Enable OMIL organizations to set up their profile and manage staff members.

### Dependencies
- V1: Database, S3 (logo upload)
- V2: Authentication

### What Gets Built
- OMIL organization profile
- Logo upload
- Staff member management
- Role management

### Database Tables
From [ARCHITECTURE_PLAN.md § 2.3](ARCHITECTURE_PLAN.md#23-core-schema):
- omil_organizations
- omil_members

### API Endpoints
Full specs: [ARCHITECTURE_PLAN.md § 3.7](ARCHITECTURE_PLAN.md#37-omil-endpoints)
```
GET/PUT    /api/omil/profile         Organization profile
GET        /api/omil/members         List members
POST       /api/omil/members/invite  Invite member
PUT        /api/omil/members/{id}/role Change role
DELETE     /api/omil/members/{id}    Remove member
```

### Capabilities Covered
[CAPABILITIES_CHECKLIST.md § 3.2](CAPABILITIES_CHECKLIST.md) OMIL Profile (~5 items)

### Acceptance Criteria
- [ ] OMIL admin can update organization profile
- [ ] OMIL admin can upload logo
- [ ] OMIL admin can invite staff members
- [ ] Staff members can be assigned roles
- [ ] Pending approval status shown

---

## V6: Job Posting

### Purpose
Enable companies to create, edit, and manage job postings with screening questions.

### Dependencies
- V4: Company must exist

### What Gets Built
- Job creation (draft → submit → approve → publish flow)
- Job editing and updating
- Screening questions management
- Job status management (pause, resume, close)
- Job requirements (skills, languages, careers)

### Database Tables
From [ARCHITECTURE_PLAN.md § 2.3](ARCHITECTURE_PLAN.md#23-core-schema):
- jobs
- job_required_skills
- job_required_languages
- job_required_careers
- job_additional_locations
- screening_questions
- screening_question_options

### API Endpoints
Full specs: [ARCHITECTURE_PLAN.md § 3.6](ARCHITECTURE_PLAN.md#36-company-endpoints)
```
CRUD       /api/company/jobs         Job management
POST       /api/company/jobs/{id}/submit    Submit for approval
POST       /api/company/jobs/{id}/publish   Publish (if approved)
POST       /api/company/jobs/{id}/pause     Pause
POST       /api/company/jobs/{id}/resume    Resume
POST       /api/company/jobs/{id}/close     Close
CRUD       /api/company/jobs/{id}/questions Screening questions
PUT        /api/company/jobs/{id}/questions/order Reorder questions
```

### Capabilities Covered
[CAPABILITIES_CHECKLIST.md § 2.3](CAPABILITIES_CHECKLIST.md) Job Offer Management (~25 items)

### Acceptance Criteria
- [ ] Company user can create job draft
- [ ] Job has all fields: title, description, requirements, salary, location
- [ ] Company user can add required skills/languages/careers
- [ ] Company user can add screening questions (text, choice, yes/no)
- [ ] Question options can be marked as correct for scoring
- [ ] Jobs can be submitted for admin approval
- [ ] Approved jobs can be published
- [ ] Active jobs can be paused/resumed
- [ ] Jobs can be closed with reason
- [ ] Job expiration date enforced

---

## V7: Job Discovery

### Purpose
Enable public browsing of active job listings with search and filtering.

### Dependencies
- V6: Jobs must exist

### What Gets Built
- Public job listing (no auth required)
- Search (full-text on title/description)
- Filters (location, job type, work modality, inclusive jobs)
- Sorting (newest, relevance)
- Pagination
- Job detail view
- Company public profile view

### Database Tables
Uses existing: jobs, companies (read-only)

Plus analytics:
- job_views

### API Endpoints
Full specs: [ARCHITECTURE_PLAN.md § 3.5](ARCHITECTURE_PLAN.md#35-public-job-endpoints)
```
GET  /api/jobs                    List active jobs (paginated, filtered)
GET  /api/jobs/{id}               Job detail
GET  /api/jobs/{slug}             Job by slug (SEO)
GET  /api/jobs/{id}/questions     Screening questions (for apply flow)
GET  /api/companies               List companies with active jobs
GET  /api/companies/{id}          Company public profile
GET  /api/companies/{id}/jobs     Company's active jobs
```

### Acceptance Criteria
- [ ] Anyone can browse job listings (no login required)
- [ ] Jobs can be searched by keyword
- [ ] Jobs can be filtered by region
- [ ] Jobs can be filtered by job type
- [ ] Jobs can be filtered by work modality
- [ ] Jobs can be filtered for inclusive opportunities
- [ ] Jobs are paginated (20 per page default)
- [ ] Job detail shows full description and requirements
- [ ] Confidential jobs hide company name
- [ ] Job views are tracked for analytics

---

## V8: Apply to Jobs

### Purpose
Enable job seekers to apply for jobs and track their applications.

### Dependencies
- V3: Job seeker profile must exist
- V7: Jobs must be viewable

### What Gets Built
- Application submission
- Screening question answers
- Expected salary input
- Cover letter (optional)
- Application tracking/history
- Saved jobs (favorites)

### Database Tables
From [ARCHITECTURE_PLAN.md § 2.3](ARCHITECTURE_PLAN.md#23-core-schema):
- applications
- saved_jobs

### API Endpoints
```
POST   /api/jobs/{id}/apply           Apply to job
GET    /api/me/applications           List my applications
GET    /api/me/applications/{id}      Application detail
GET    /api/me/saved-jobs             List saved jobs
POST   /api/me/saved-jobs/{jobId}     Save job
DELETE /api/me/saved-jobs/{jobId}     Unsave job
```

### Capabilities Covered
[CAPABILITIES_CHECKLIST.md § 1.3](CAPABILITIES_CHECKLIST.md) Job Search & Applications (~20 items)

### Acceptance Criteria
- [ ] Job seeker can apply to active job
- [ ] Application captures screening question answers
- [ ] Screening score calculated from answers
- [ ] Application captures expected salary
- [ ] Application captures optional cover letter
- [ ] Profile snapshot saved with application
- [ ] CV URL snapshot saved with application
- [ ] Cannot apply twice to same job
- [ ] Job seeker can view application history
- [ ] Job seeker can save/unsave jobs
- [ ] Application status updates visible to seeker

---

## V9: Manage Applicants

### Purpose
Enable companies to review, evaluate, and manage applicants for their jobs.

### Dependencies
- V8: Applications must exist

### What Gets Built
- Applicant listing per job
- Filtering (status, score, date)
- Application detail view (profile snapshot, answers, CV)
- Status management workflow
- Internal comments
- CV download
- Excel export

### Database Tables
From [ARCHITECTURE_PLAN.md § 2.3](ARCHITECTURE_PLAN.md#23-core-schema):
- applications (update)
- application_history

### API Endpoints
Full specs: [ARCHITECTURE_PLAN.md § 3.6](ARCHITECTURE_PLAN.md#36-company-endpoints)
```
GET    /api/company/jobs/{id}/applicants          List applicants
GET    /api/company/jobs/{id}/applicants/{aId}    Applicant detail
PUT    /api/company/jobs/{id}/applicants/{aId}/status   Change status
POST   /api/company/jobs/{id}/applicants/{aId}/comment  Add comment
GET    /api/company/jobs/{id}/applicants/{aId}/cv       Download CV
POST   /api/company/jobs/{id}/applicants/bulk-status    Bulk status change
GET    /api/company/jobs/{id}/applicants/export         Export Excel
```

### Capabilities Covered
[CAPABILITIES_CHECKLIST.md § 2.4](CAPABILITIES_CHECKLIST.md) Applicant Management (~10 items)

### Acceptance Criteria
- [ ] Company user can view all applicants for a job
- [ ] Applicants can be filtered by status
- [ ] Applicants can be sorted by score/date
- [ ] Company user can view full applicant profile
- [ ] Company user can view screening answers
- [ ] Company user can download applicant CV
- [ ] Company user can change application status
- [ ] Status history tracked with who/when
- [ ] Company user can add internal comments
- [ ] Multiple applicants can be updated in bulk
- [ ] Applicants can be exported to Excel

---

## V10: OMIL Integration

### Purpose
Enable OMIL staff to manage job seekers and apply to jobs on their behalf.

### Dependencies
- V5: OMIL organization must exist
- V8: Application flow must work

### What Gets Built
- Job seeker registration by OMIL
- Job seeker profile management (impersonation)
- Application tracking for managed seekers
- Apply on behalf of seeker
- OMIL comments on applications
- Export managed seekers

### Database Tables
Uses existing, plus:
- job_seeker_profiles.registered_omil_id (link)
- applications.omil_id (tracking)

### API Endpoints
Full specs: [ARCHITECTURE_PLAN.md § 3.7](ARCHITECTURE_PLAN.md#37-omil-endpoints)
```
GET    /api/omil/job-seekers                 List managed seekers
POST   /api/omil/job-seekers                 Register new seeker
GET    /api/omil/job-seekers/{id}            Seeker detail
GET    /api/omil/job-seekers/{id}/impersonate Get impersonation token
POST   /api/omil/job-seekers/{id}/apply/{jobId} Apply on behalf
GET    /api/omil/job-seekers/export          Export Excel
GET    /api/omil/applications                List all applications
POST   /api/omil/applications/{id}/comment   Add OMIL comment
GET    /api/omil/dashboard                   Dashboard metrics
```

### Capabilities Covered
[CAPABILITIES_CHECKLIST.md § 3.3](CAPABILITIES_CHECKLIST.md) Job Seeker Management (~15 items)
[CAPABILITIES_CHECKLIST.md § 3.4](CAPABILITIES_CHECKLIST.md) Application Tracking (~10 items)

### Acceptance Criteria
- [ ] OMIL staff can register new job seeker
- [ ] OMIL staff can view managed seekers
- [ ] OMIL staff can impersonate seeker (edit profile)
- [ ] OMIL staff can apply to jobs on behalf of seeker
- [ ] Applications track OMIL source
- [ ] OMIL staff can add comments to applications
- [ ] OMIL staff can export seeker list
- [ ] Dashboard shows OMIL activity metrics

---

## V11: Admin Dashboard

### Purpose
Enable platform administrators to manage users, companies, OMILs, and jobs.

### Dependencies
- V3-V10: All user types and features must exist

### What Gets Built
- User management (list, status, impersonate)
- Company approvals and management
- OMIL approvals and management
- Job approvals
- Audit logging
- System settings

### Database Tables
From [ARCHITECTURE_PLAN.md § 2.3](ARCHITECTURE_PLAN.md#23-core-schema):
- audit_log
- system_settings

### API Endpoints
Full specs: [ARCHITECTURE_PLAN.md § 3.8](ARCHITECTURE_PLAN.md#38-admin-endpoints)
```
CRUD   /api/admin/users              User management
GET    /api/admin/users/{id}/impersonate Impersonate
CRUD   /api/admin/companies          Company management
POST   /api/admin/companies/{id}/approve Approve
POST   /api/admin/companies/{id}/reject  Reject
CRUD   /api/admin/omils              OMIL management
CRUD   /api/admin/jobs               Job management
POST   /api/admin/jobs/{id}/approve  Approve job
POST   /api/admin/jobs/{id}/reject   Reject job
GET    /api/admin/dashboard          Dashboard metrics
GET    /api/admin/audit-log          Audit log
GET/PUT /api/admin/settings          System settings
```

### Capabilities Covered
[CAPABILITIES_CHECKLIST.md § 4](CAPABILITIES_CHECKLIST.md) Admin User (~50 items)

### Acceptance Criteria
- [ ] Admin can list all users with filters
- [ ] Admin can change user status (suspend, activate)
- [ ] Admin can impersonate any user
- [ ] Admin can list pending company registrations
- [ ] Admin can approve/reject companies
- [ ] Admin can list pending OMIL registrations
- [ ] Admin can approve/reject OMILs
- [ ] Admin can list pending job postings
- [ ] Admin can approve/reject jobs
- [ ] All admin actions logged in audit log
- [ ] Admin can view audit log
- [ ] Admin can update system settings

---

## V12: Reporting

### Purpose
Provide analytics dashboards and exportable reports for all user types.

### Dependencies
- V11: Admin features must exist

### What Gets Built
- Admin dashboard with platform metrics
- Company dashboard with job metrics
- OMIL dashboard with seeker metrics
- Excel export for all report types
- Scheduled report generation (optional)

### Database Tables
May use materialized views for performance, otherwise queries existing tables

### API Endpoints
```
GET  /api/admin/reports/overview      Platform overview
GET  /api/admin/reports/users         User statistics
GET  /api/admin/reports/companies     Company statistics
GET  /api/admin/reports/jobs          Job statistics
GET  /api/admin/reports/applications  Application statistics
GET  /api/admin/reports/export/{type} Export to Excel
GET  /api/company/dashboard           Company metrics
GET  /api/omil/dashboard              OMIL metrics
GET  /api/omil/reports                OMIL reports
```

### Capabilities Covered
[CAPABILITIES_CHECKLIST.md § 4.5](CAPABILITIES_CHECKLIST.md) Reporting & Analytics (~10 items)

### Acceptance Criteria
- [ ] Admin dashboard shows total users, companies, jobs
- [ ] Admin can see registration trends over time
- [ ] Admin can see application trends over time
- [ ] Company dashboard shows job performance
- [ ] OMIL dashboard shows seeker placements
- [ ] All reports exportable to Excel

---

## V13: Virtual Fair (Optional)

### Purpose
Enable virtual job fair/expo events where companies showcase opportunities.

### Dependencies
- V12: Reporting infrastructure

### What Gets Built
- Fair configuration (dates, theme)
- Company booth registration
- Fair mode toggle
- Virtual salon layout
- Fair-specific job listings

### Notes
This is a lower-priority feature that extends the platform for special events. Implementation details TBD based on actual requirements.

### Acceptance Criteria
- [ ] Admin can create/configure fair event
- [ ] Admin can set fair active dates
- [ ] Companies can register booth for fair
- [ ] Fair mode shows different UI/branding
- [ ] Job listings filter to fair participants

---

## Implementation Timeline

### Phase 1: Foundation (2-3 weeks)
- V1 Infrastructure
- V2 Authentication

### Phase 2: Core Profiles (3-4 weeks, parallelizable)
- V3 Job Seeker Core
- V4 Company Core
- V5 OMIL Core

### Phase 3: Job Flow (3-4 weeks)
- V6 Job Posting
- V7 Job Discovery

### Phase 4: Applications (3-4 weeks)
- V8 Apply to Jobs
- V9 Manage Applicants

### Phase 5: Integration (3-4 weeks)
- V10 OMIL Integration
- V11 Admin Dashboard

### Phase 6: Analytics (2-3 weeks)
- V12 Reporting
- V13 Virtual Fair (if needed)

**Total: 16-22 weeks (single developer)**
**With parallelization in Phase 2: 13-18 weeks**

---

## Verification Strategy

### Per Vertical
1. Run database migrations
2. Run Rust unit/integration tests
3. Run Playwright E2E tests against acceptance criteria
4. Cross-reference completed items in [CAPABILITIES_CHECKLIST.md](CAPABILITIES_CHECKLIST.md)

### Full Regression
After each vertical:
1. Run full test suite
2. Check no regressions in previous verticals
3. Verify cross-vertical flows (e.g., apply after profile update)

### Pre-Launch
1. Load testing with realistic data volumes
2. Security audit (OWASP top 10)
3. Accessibility audit (WCAG 2.1 AA)
4. One-time ETL migration dry run
5. User acceptance testing
