# EmpleosInclusivos - Architecture Plan

**Version:** 2.0
**Date:** 2026-02-04
**Purpose:** Technical architecture for Rust/Axum implementation (clean-slate, no backwards compatibility)

---

## 1. System Overview

### 1.1 Architecture Philosophy

This is a **clean-slate implementation** with no backwards compatibility constraints. Key principles:

- **Modern stack**: Rust/Axum + Next.js 14 + PostgreSQL 16
- **UUIDs everywhere**: All primary keys use UUIDs for better API design, security, and scalability
- **English naming**: All database columns, API fields, and code use English
- **Type-first design**: Strong typing from database to frontend via `ts-rs`
- **One-time migration**: ETL from legacy MySQL to new PostgreSQL, then cutover

### 1.2 Target Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Client Layer                                    │
├─────────────────────────────────┬───────────────────────────────────────────┤
│      Next.js 14 Frontend        │         Mobile Apps (Future)              │
│   (React 18 + TypeScript 5)     │         (React Native)                    │
│   • Server Components (RSC)     │                                           │
│   • App Router                  │                                           │
│   • Zod validation              │                                           │
└───────────────┬─────────────────┴───────────────────────────────────────────┘
                │
                │ HTTPS / JSON API
                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API Layer (Rust/Axum)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │   Middleware    │  │    Handlers     │  │    Services     │             │
│  ├─────────────────┤  ├─────────────────┤  ├─────────────────┤             │
│  │ • JWT Auth      │  │ • Auth          │  │ • Email         │             │
│  │ • RBAC          │  │ • Job Seekers   │  │ • Upload        │             │
│  │ • Rate Limiting │  │ • Companies     │  │ • Matching      │             │
│  │ • CORS          │  │ • Jobs          │  │ • Reports       │             │
│  │ • Compression   │  │ • Applications  │  │ • Background    │             │
│  │ • Tracing       │  │ • Admin         │  │ • Notifications │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
└───────────────┬─────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Data Layer                                      │
├─────────────────────┬─────────────────────┬─────────────────────────────────┤
│   PostgreSQL 16     │     Redis 7+        │      MinIO/S3                   │
│   ───────────────   │     ─────────       │      ────────                   │
│   • Primary store   │   • JWT blacklist   │   • Profile images              │
│   • Full-text       │   • Rate limiting   │   • CVs / resumes               │
│   • JSONB support   │   • Cache layer     │   • Company logos               │
│   • UUID native     │   • Pub/Sub         │   • Portfolio files             │
└─────────────────────┴─────────────────────┴─────────────────────────────────┘
```

### 1.3 Technology Stack

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| **Backend** | Rust | 1.75+ | Systems language, memory safety |
| | Axum | 0.8 | Async web framework |
| | SQLx | 0.8 | Compile-time checked SQL |
| | tokio | 1.x | Async runtime |
| **Database** | PostgreSQL | 16+ | Primary data store |
| | Redis | 7+ | Cache, sessions, rate limiting |
| **Storage** | MinIO | Latest | S3-compatible object storage |
| **Frontend** | Next.js | 14+ | React framework with RSC |
| | TypeScript | 5+ | Type-safe JavaScript |
| | Zod | 3+ | Runtime schema validation |
| | TanStack Query | 5+ | Server state management |
| **Type Generation** | ts-rs | 7+ | Rust → TypeScript types |
| **Auth** | jsonwebtoken | 10 | JWT tokens |
| | argon2 | 0.5 | Password hashing (better than bcrypt) |
| **Email** | lettre | 0.11 | SMTP client |
| **Background Jobs** | tokio-cron-scheduler | 0.11 | Scheduled tasks |

### 1.4 Project Structure

```
empleos-inclusivos/
├── backend/
│   ├── src/
│   │   ├── main.rs                      # Entry point, server setup
│   │   ├── lib.rs                       # AppState, module exports
│   │   ├── config.rs                    # Environment configuration
│   │   ├── error.rs                     # Error types, API error responses
│   │   │
│   │   ├── models/                      # Database models (SQLx)
│   │   │   ├── mod.rs
│   │   │   ├── user.rs                  # User entity + authentication
│   │   │   ├── job_seeker.rs            # Job seeker profile
│   │   │   ├── company.rs               # Company entity
│   │   │   ├── company_member.rs        # Company membership
│   │   │   ├── omil.rs                  # OMIL organization
│   │   │   ├── omil_member.rs           # OMIL membership
│   │   │   ├── job.rs                   # Job posting
│   │   │   ├── application.rs           # Job application
│   │   │   ├── education.rs             # Education records
│   │   │   ├── experience.rs            # Work experience
│   │   │   ├── skill.rs                 # User skills
│   │   │   ├── language.rs              # User languages
│   │   │   ├── disability.rs            # Disability/inclusion data
│   │   │   ├── portfolio.rs             # Portfolio items
│   │   │   ├── screening.rs             # Screening questions
│   │   │   └── reference.rs             # Reference data tables
│   │   │
│   │   ├── handlers/                    # HTTP request handlers
│   │   │   ├── mod.rs
│   │   │   ├── auth.rs                  # Login, register, OAuth, password
│   │   │   ├── job_seeker.rs            # Job seeker profile & data
│   │   │   ├── company.rs               # Company management
│   │   │   ├── job.rs                   # Job CRUD & publishing
│   │   │   ├── application.rs           # Apply, status changes
│   │   │   ├── omil.rs                  # OMIL features
│   │   │   ├── admin.rs                 # Admin operations
│   │   │   ├── public.rs                # Public job listing
│   │   │   └── reference.rs             # Reference data endpoints
│   │   │
│   │   ├── middleware/
│   │   │   ├── mod.rs
│   │   │   ├── auth.rs                  # JWT extraction & validation
│   │   │   ├── rbac.rs                  # Role-based access control
│   │   │   └── rate_limit.rs            # Rate limiting
│   │   │
│   │   ├── services/
│   │   │   ├── mod.rs
│   │   │   ├── auth.rs                  # Token generation, OAuth
│   │   │   ├── email.rs                 # Email sending, templates
│   │   │   ├── storage.rs               # File upload/download
│   │   │   ├── matching.rs              # Job-candidate matching
│   │   │   └── reporting.rs             # Report generation
│   │   │
│   │   ├── jobs/                        # Background jobs
│   │   │   ├── mod.rs
│   │   │   ├── scheduler.rs             # Job scheduler setup
│   │   │   ├── expire_jobs.rs           # Auto-expire old jobs
│   │   │   ├── calculate_matches.rs     # Matching score calculation
│   │   │   └── cleanup.rs               # Temp file cleanup
│   │   │
│   │   └── utils/
│   │       ├── mod.rs
│   │       ├── jwt.rs                   # JWT encode/decode
│   │       ├── password.rs              # Argon2 hashing
│   │       ├── slug.rs                  # URL slug generation
│   │       └── pagination.rs            # Pagination helpers
│   │
│   ├── migrations/                      # SQLx migrations (sequential)
│   │   ├── 0001_create_extensions.sql
│   │   ├── 0002_create_reference_tables.sql
│   │   ├── 0003_create_users.sql
│   │   ├── 0004_create_job_seekers.sql
│   │   ├── 0005_create_companies.sql
│   │   ├── 0006_create_omils.sql
│   │   ├── 0007_create_jobs.sql
│   │   ├── 0008_create_applications.sql
│   │   └── ...
│   │
│   ├── tests/
│   │   ├── common/mod.rs                # Test utilities
│   │   ├── auth_test.rs
│   │   ├── job_seeker_test.rs
│   │   └── ...
│   │
│   └── Cargo.toml
│
├── frontend/
│   ├── src/
│   │   ├── app/                         # Next.js App Router
│   │   │   ├── (public)/                # Public routes
│   │   │   │   ├── page.tsx             # Home
│   │   │   │   ├── jobs/                # Job listings
│   │   │   │   ├── companies/           # Company profiles
│   │   │   │   └── auth/                # Login, register
│   │   │   │
│   │   │   ├── (dashboard)/             # Protected routes
│   │   │   │   ├── seeker/              # Job seeker dashboard
│   │   │   │   ├── company/             # Company dashboard
│   │   │   │   ├── omil/                # OMIL dashboard
│   │   │   │   └── admin/               # Admin dashboard
│   │   │   │
│   │   │   ├── api/                     # API routes (BFF pattern)
│   │   │   └── layout.tsx
│   │   │
│   │   ├── components/
│   │   │   ├── ui/                      # Base UI components
│   │   │   ├── forms/                   # Form components
│   │   │   ├── layouts/                 # Layout components
│   │   │   └── features/                # Feature-specific components
│   │   │
│   │   ├── lib/
│   │   │   ├── api.ts                   # API client
│   │   │   ├── auth.ts                  # Auth utilities
│   │   │   └── utils.ts                 # General utilities
│   │   │
│   │   ├── hooks/                       # Custom React hooks
│   │   ├── stores/                      # Zustand stores
│   │   ├── schemas/                     # Zod validation schemas
│   │   └── types/                       # Auto-generated from ts-rs
│   │
│   ├── public/
│   └── package.json
│
├── e2e/                                 # Playwright tests
│   ├── tests/
│   ├── fixtures/
│   └── playwright.config.ts
│
├── scripts/
│   ├── migrate-data.ts                  # One-time ETL migration
│   └── seed-reference.ts                # Seed reference data
│
├── docker-compose.yml
├── docker-compose.prod.yml
└── docs/
    ├── CAPABILITIES_CHECKLIST.md
    ├── ARCHITECTURE_PLAN.md
    └── IMPLEMENTATION_VERTICALS.md
```

---

## 2. Database Schema Design

### 2.1 Design Principles

1. **UUIDs for all primary keys**: Better for APIs (no sequential ID enumeration), distributed systems, and security
2. **English column names**: Consistent, readable, and matches API field names
3. **Soft deletes where appropriate**: `deleted_at` column for recoverable data
4. **Timestamps with timezone**: All datetime columns use `TIMESTAMPTZ`
5. **JSONB for flexible data**: Semi-structured data stored as JSONB
6. **Proper constraints**: Foreign keys, check constraints, unique constraints
7. **Strategic indexing**: Indexes on frequently queried and filtered columns

### 2.2 Extensions

```sql
-- Required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";      -- UUID generation
CREATE EXTENSION IF NOT EXISTS "pg_trgm";        -- Trigram similarity for search
CREATE EXTENSION IF NOT EXISTS "unaccent";       -- Accent-insensitive search
```

### 2.3 Core Schema

```sql
-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE user_type AS ENUM (
    'job_seeker',
    'company_member',
    'omil_member',
    'admin'
);

CREATE TYPE account_status AS ENUM (
    'pending_verification',
    'active',
    'suspended',
    'deactivated'
);

CREATE TYPE gender AS ENUM (
    'male',
    'female',
    'non_binary',
    'prefer_not_to_say'
);

CREATE TYPE marital_status AS ENUM (
    'single',
    'married',
    'divorced',
    'widowed',
    'domestic_partnership'
);

CREATE TYPE organization_status AS ENUM (
    'pending_approval',
    'active',
    'suspended',
    'rejected'
);

CREATE TYPE member_role AS ENUM (
    'owner',
    'admin',
    'member'
);

CREATE TYPE job_type AS ENUM (
    'full_time',
    'part_time',
    'contract',
    'internship',
    'apprenticeship',
    'temporary'
);

CREATE TYPE job_status AS ENUM (
    'draft',
    'pending_approval',
    'active',
    'paused',
    'closed',
    'rejected'
);

CREATE TYPE work_modality AS ENUM (
    'on_site',
    'remote',
    'hybrid'
);

CREATE TYPE application_status AS ENUM (
    'submitted',
    'under_review',
    'shortlisted',
    'interview_scheduled',
    'offer_extended',
    'hired',
    'rejected',
    'withdrawn'
);

CREATE TYPE disability_category AS ENUM (
    'physical_mobility',
    'visual',
    'hearing',
    'cognitive',
    'psychosocial',
    'speech',
    'multiple',
    'other'
);

CREATE TYPE education_level AS ENUM (
    'none',
    'primary',
    'secondary',
    'technical',
    'undergraduate',
    'graduate',
    'postgraduate'
);

CREATE TYPE education_status AS ENUM (
    'in_progress',
    'completed',
    'incomplete'
);

CREATE TYPE language_proficiency AS ENUM (
    'basic',
    'intermediate',
    'advanced',
    'fluent',
    'native'
);

CREATE TYPE question_type AS ENUM (
    'text',
    'single_choice',
    'multiple_choice',
    'yes_no',
    'numeric'
);

-- ============================================================================
-- REFERENCE DATA TABLES
-- ============================================================================

CREATE TABLE countries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    iso_code CHAR(2) NOT NULL UNIQUE,
    phone_code VARCHAR(10),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE regions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    country_id UUID NOT NULL REFERENCES countries(id),
    name VARCHAR(150) NOT NULL,
    code VARCHAR(20),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(country_id, name)
);

CREATE TABLE municipalities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    region_id UUID NOT NULL REFERENCES regions(id),
    name VARCHAR(150) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(region_id, name)
);

CREATE TABLE industries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE work_areas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE position_levels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    seniority_rank INTEGER NOT NULL,  -- 1=Entry, 2=Junior, 3=Mid, 4=Senior, 5=Lead, 6=Director, 7=Executive
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE career_fields (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL UNIQUE,
    education_level education_level,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE institutions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    country_id UUID REFERENCES countries(id),
    institution_type VARCHAR(50),  -- university, technical_institute, school, etc.
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE languages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    iso_code CHAR(2),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE skill_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE skills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID REFERENCES skill_categories(id),
    name VARCHAR(100) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(category_id, name)
);

-- Full-text search index for skills
CREATE INDEX idx_skills_name_search ON skills USING gin(to_tsvector('spanish', name));

-- ============================================================================
-- USERS & AUTHENTICATION
-- ============================================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Authentication
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255),  -- NULL for OAuth-only users

    -- Basic info
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(50),

    -- Type & Status
    user_type user_type NOT NULL,
    status account_status NOT NULL DEFAULT 'pending_verification',

    -- Verification
    email_verified_at TIMESTAMPTZ,

    -- OAuth
    google_id VARCHAR(100) UNIQUE,
    linkedin_id VARCHAR(100) UNIQUE,

    -- Preferences
    notification_preferences JSONB NOT NULL DEFAULT '{
        "email_job_matches": true,
        "email_application_updates": true,
        "email_marketing": false
    }',

    -- Metadata
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ  -- Soft delete
);

CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_type ON users(user_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_status ON users(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;
CREATE INDEX idx_users_linkedin_id ON users(linkedin_id) WHERE linkedin_id IS NOT NULL;

-- Password reset tokens
CREATE TABLE password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,  -- Store hashed, not plain
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_password_reset_user ON password_reset_tokens(user_id);

-- Email verification tokens
CREATE TABLE email_verification_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- JOB SEEKER PROFILES
-- ============================================================================

CREATE TABLE job_seeker_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

    -- Personal Information
    national_id VARCHAR(20),  -- Chilean RUT or equivalent
    national_id_type VARCHAR(20) DEFAULT 'rut',  -- rut, passport, etc.
    date_of_birth DATE,
    gender gender,
    marital_status marital_status,
    nationality_id UUID REFERENCES countries(id),

    -- Location
    country_id UUID REFERENCES countries(id),
    region_id UUID REFERENCES regions(id),
    municipality_id UUID REFERENCES municipalities(id),
    address TEXT,

    -- Professional Summary
    headline VARCHAR(200),  -- "Senior Software Engineer"
    summary TEXT,  -- Professional summary / cover letter
    years_of_experience INTEGER DEFAULT 0,

    -- Files
    profile_image_url VARCHAR(500),
    cv_url VARCHAR(500),
    cv_filename VARCHAR(255),
    cv_uploaded_at TIMESTAMPTZ,

    -- Social Links
    linkedin_url VARCHAR(255),
    portfolio_url VARCHAR(255),
    github_url VARCHAR(255),

    -- Job Preferences
    desired_salary_min INTEGER,
    desired_salary_max INTEGER,
    willing_to_relocate BOOLEAN DEFAULT false,
    preferred_work_modality work_modality,
    available_from DATE,

    -- Profile Completeness (calculated)
    completeness_score INTEGER NOT NULL DEFAULT 0,
    completeness_details JSONB,

    -- OMIL Association (if registered through OMIL)
    registered_omil_id UUID,  -- References omil_organizations

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_job_seeker_user ON job_seeker_profiles(user_id);
CREATE INDEX idx_job_seeker_location ON job_seeker_profiles(country_id, region_id, municipality_id);
CREATE INDEX idx_job_seeker_omil ON job_seeker_profiles(registered_omil_id) WHERE registered_omil_id IS NOT NULL;

-- ============================================================================
-- DISABILITY / INCLUSION INFORMATION
-- ============================================================================

CREATE TABLE job_seeker_disabilities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

    -- Disability Declaration
    has_disability BOOLEAN NOT NULL DEFAULT false,
    disability_categories disability_category[] DEFAULT '{}',
    disability_description TEXT,

    -- Official Registration (Chile-specific: Registro Nacional de Discapacidad)
    has_disability_registration BOOLEAN DEFAULT false,
    registration_number VARCHAR(50),
    registration_expiry DATE,

    -- Pension Status
    receives_disability_pension BOOLEAN DEFAULT false,
    pension_type VARCHAR(50),

    -- Workplace Accommodations
    requires_accommodations BOOLEAN DEFAULT false,
    accommodation_needs TEXT,  -- Free-text description of needed accommodations

    -- Assistive Technology
    uses_assistive_technology BOOLEAN DEFAULT false,
    assistive_technology_details TEXT,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_disability_user ON job_seeker_disabilities(user_id);
CREATE INDEX idx_disability_has ON job_seeker_disabilities(has_disability) WHERE has_disability = true;

-- ============================================================================
-- EDUCATION RECORDS
-- ============================================================================

CREATE TABLE education_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Education Details
    level education_level NOT NULL,
    institution_name VARCHAR(255) NOT NULL,
    institution_id UUID REFERENCES institutions(id),  -- Optional link to known institution

    -- Program
    degree_name VARCHAR(255),  -- "Computer Science", "Business Administration"
    career_field_id UUID REFERENCES career_fields(id),

    -- Duration
    start_year INTEGER,
    end_year INTEGER,
    status education_status NOT NULL,

    -- Additional Info
    description TEXT,
    achievements TEXT,

    -- Metadata
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_education_user ON education_records(user_id);
CREATE INDEX idx_education_level ON education_records(level);

-- ============================================================================
-- WORK EXPERIENCE
-- ============================================================================

CREATE TABLE work_experiences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Position
    job_title VARCHAR(200) NOT NULL,
    company_name VARCHAR(200) NOT NULL,

    -- Classification
    work_area_id UUID REFERENCES work_areas(id),
    position_level_id UUID REFERENCES position_levels(id),
    industry_id UUID REFERENCES industries(id),

    -- Duration
    start_date DATE NOT NULL,
    end_date DATE,  -- NULL = current position
    is_current BOOLEAN NOT NULL DEFAULT false,

    -- Details
    description TEXT,
    achievements TEXT,

    -- Location
    location VARCHAR(200),
    work_modality work_modality,

    -- Type
    is_internship BOOLEAN NOT NULL DEFAULT false,

    -- Metadata
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_experience_user ON work_experiences(user_id);
CREATE INDEX idx_experience_current ON work_experiences(is_current) WHERE is_current = true;

-- ============================================================================
-- SKILLS
-- ============================================================================

CREATE TABLE user_skills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES skills(id),

    -- Proficiency (1-5 scale: 1=Beginner, 5=Expert)
    proficiency_level INTEGER NOT NULL CHECK (proficiency_level BETWEEN 1 AND 5),
    years_of_experience INTEGER,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(user_id, skill_id)
);

CREATE INDEX idx_user_skills_user ON user_skills(user_id);

-- ============================================================================
-- LANGUAGES
-- ============================================================================

CREATE TABLE user_languages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    language_id UUID NOT NULL REFERENCES languages(id),

    proficiency language_proficiency NOT NULL,
    is_native BOOLEAN NOT NULL DEFAULT false,

    -- Certifications (optional)
    certification_name VARCHAR(100),  -- "TOEFL", "IELTS", "DELE"
    certification_score VARCHAR(50),
    certification_date DATE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(user_id, language_id)
);

CREATE INDEX idx_user_languages_user ON user_languages(user_id);

-- ============================================================================
-- PORTFOLIO
-- ============================================================================

CREATE TABLE portfolio_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    title VARCHAR(200) NOT NULL,
    description TEXT,
    url VARCHAR(500),
    image_url VARCHAR(500),

    -- Categorization
    item_type VARCHAR(50),  -- project, article, certification, award, etc.

    -- Metadata
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_portfolio_user ON portfolio_items(user_id);

-- ============================================================================
-- COMPANIES
-- ============================================================================

CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Basic Information
    name VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255),
    tax_id VARCHAR(50),  -- RUT in Chile

    -- Classification
    industry_id UUID REFERENCES industries(id),
    company_size VARCHAR(50),  -- '1-10', '11-50', '51-200', '201-500', '500+'
    founded_year INTEGER,

    -- Location
    country_id UUID REFERENCES countries(id),
    region_id UUID REFERENCES regions(id),
    municipality_id UUID REFERENCES municipalities(id),
    address TEXT,
    phone VARCHAR(50),

    -- Online Presence
    website_url VARCHAR(255),
    linkedin_url VARCHAR(255),

    -- Profile Content
    description TEXT,
    mission TEXT,
    vision TEXT,
    culture TEXT,
    benefits TEXT,

    -- Media
    logo_url VARCHAR(500),
    cover_image_url VARCHAR(500),
    video_url VARCHAR(500),

    -- Status
    status organization_status NOT NULL DEFAULT 'pending_approval',
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES users(id),
    rejection_reason TEXT,

    -- Features
    is_featured BOOLEAN NOT NULL DEFAULT false,
    can_search_candidates BOOLEAN NOT NULL DEFAULT false,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_companies_name ON companies(name) WHERE deleted_at IS NULL;
CREATE INDEX idx_companies_status ON companies(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_companies_industry ON companies(industry_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_companies_location ON companies(country_id, region_id);

-- Full-text search for companies
CREATE INDEX idx_companies_search ON companies
    USING gin(to_tsvector('spanish', coalesce(name, '') || ' ' || coalesce(description, '')));

-- ============================================================================
-- COMPANY MEMBERS
-- ============================================================================

CREATE TABLE company_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    role member_role NOT NULL DEFAULT 'member',
    job_title VARCHAR(100),

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    invited_by UUID REFERENCES users(id),
    invited_at TIMESTAMPTZ,
    joined_at TIMESTAMPTZ,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(company_id, user_id)
);

CREATE INDEX idx_company_members_company ON company_members(company_id);
CREATE INDEX idx_company_members_user ON company_members(user_id);

-- ============================================================================
-- OMIL ORGANIZATIONS (Government Employment Offices)
-- ============================================================================

CREATE TABLE omil_organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Basic Information
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE,  -- Official OMIL code

    -- Location (typically municipality-based)
    country_id UUID REFERENCES countries(id),
    region_id UUID REFERENCES regions(id),
    municipality_id UUID REFERENCES municipalities(id),
    address TEXT,
    phone VARCHAR(50),
    email VARCHAR(255),

    -- Media
    logo_url VARCHAR(500),

    -- Status
    status organization_status NOT NULL DEFAULT 'pending_approval',
    approved_at TIMESTAMPTZ,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_omil_municipality ON omil_organizations(municipality_id);
CREATE INDEX idx_omil_status ON omil_organizations(status);

-- Add foreign key to job_seeker_profiles now that omil_organizations exists
ALTER TABLE job_seeker_profiles
    ADD CONSTRAINT fk_job_seeker_omil
    FOREIGN KEY (registered_omil_id) REFERENCES omil_organizations(id);

-- ============================================================================
-- OMIL MEMBERS
-- ============================================================================

CREATE TABLE omil_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    omil_id UUID NOT NULL REFERENCES omil_organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    role member_role NOT NULL DEFAULT 'member',
    job_title VARCHAR(100),

    is_active BOOLEAN NOT NULL DEFAULT true,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(omil_id, user_id)
);

CREATE INDEX idx_omil_members_omil ON omil_members(omil_id);
CREATE INDEX idx_omil_members_user ON omil_members(user_id);

-- ============================================================================
-- JOB POSTINGS
-- ============================================================================

CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    created_by_id UUID NOT NULL REFERENCES users(id),

    -- Basic Information
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(300),
    description TEXT NOT NULL,

    -- Classification
    job_type job_type NOT NULL,
    work_area_id UUID REFERENCES work_areas(id),
    position_level_id UUID REFERENCES position_levels(id),

    -- Requirements
    required_experience_years INTEGER,
    required_education_level education_level,
    requirements_description TEXT,

    -- Compensation
    salary_min INTEGER,
    salary_max INTEGER,
    salary_currency CHAR(3) DEFAULT 'CLP',
    show_salary BOOLEAN NOT NULL DEFAULT true,
    benefits_description TEXT,

    -- Work Details
    work_modality work_modality NOT NULL DEFAULT 'on_site',
    schedule_description VARCHAR(200),  -- "Monday-Friday 9am-6pm"

    -- Location
    country_id UUID REFERENCES countries(id),
    region_id UUID REFERENCES regions(id),
    municipality_id UUID REFERENCES municipalities(id),
    location_description TEXT,

    -- Vacancies
    vacancies INTEGER NOT NULL DEFAULT 1,

    -- Inclusion
    is_inclusive BOOLEAN NOT NULL DEFAULT false,
    inclusion_description TEXT,
    accessibility_features JSONB DEFAULT '{}',

    -- Privacy
    is_confidential BOOLEAN NOT NULL DEFAULT false,  -- Hide company name

    -- Screening
    has_screening_questions BOOLEAN NOT NULL DEFAULT false,
    minimum_screening_score INTEGER,

    -- Status
    status job_status NOT NULL DEFAULT 'draft',

    -- Approval
    approved_at TIMESTAMPTZ,
    approved_by_id UUID REFERENCES users(id),
    rejection_reason TEXT,

    -- Publishing
    published_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    closed_reason VARCHAR(100),  -- 'filled', 'cancelled', 'expired'

    -- Stats
    view_count INTEGER NOT NULL DEFAULT 0,
    application_count INTEGER NOT NULL DEFAULT 0,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_jobs_company ON jobs(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_jobs_status ON jobs(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_jobs_published ON jobs(published_at DESC) WHERE status = 'active' AND deleted_at IS NULL;
CREATE INDEX idx_jobs_expires ON jobs(expires_at) WHERE status = 'active';
CREATE INDEX idx_jobs_location ON jobs(country_id, region_id, municipality_id);
CREATE INDEX idx_jobs_type ON jobs(job_type);
CREATE INDEX idx_jobs_modality ON jobs(work_modality);
CREATE INDEX idx_jobs_inclusive ON jobs(is_inclusive) WHERE is_inclusive = true;

-- Full-text search for jobs
CREATE INDEX idx_jobs_search ON jobs
    USING gin(to_tsvector('spanish', coalesce(title, '') || ' ' || coalesce(description, '')));

-- ============================================================================
-- JOB REQUIREMENTS (Many-to-Many)
-- ============================================================================

CREATE TABLE job_required_skills (
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES skills(id),
    is_required BOOLEAN NOT NULL DEFAULT true,  -- required vs nice-to-have
    PRIMARY KEY (job_id, skill_id)
);

CREATE TABLE job_required_languages (
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    language_id UUID NOT NULL REFERENCES languages(id),
    minimum_proficiency language_proficiency NOT NULL,
    PRIMARY KEY (job_id, language_id)
);

CREATE TABLE job_required_careers (
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    career_field_id UUID NOT NULL REFERENCES career_fields(id),
    PRIMARY KEY (job_id, career_field_id)
);

CREATE TABLE job_additional_locations (
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    region_id UUID NOT NULL REFERENCES regions(id),
    PRIMARY KEY (job_id, region_id)
);

-- ============================================================================
-- SCREENING QUESTIONS
-- ============================================================================

CREATE TABLE screening_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,

    question_text TEXT NOT NULL,
    question_type question_type NOT NULL,
    is_required BOOLEAN NOT NULL DEFAULT false,
    is_eliminatory BOOLEAN NOT NULL DEFAULT false,  -- Wrong answer = auto-reject

    -- Scoring
    points INTEGER NOT NULL DEFAULT 0,

    -- Ordering
    sort_order INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_screening_questions_job ON screening_questions(job_id);

CREATE TABLE screening_question_options (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id UUID NOT NULL REFERENCES screening_questions(id) ON DELETE CASCADE,

    option_text TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL DEFAULT false,

    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_question_options_question ON screening_question_options(question_id);

-- ============================================================================
-- APPLICATIONS
-- ============================================================================

CREATE TABLE applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Source tracking
    source VARCHAR(50) DEFAULT 'direct',  -- direct, omil, referral, etc.
    omil_id UUID REFERENCES omil_organizations(id),  -- If applied through OMIL

    -- Status
    status application_status NOT NULL DEFAULT 'submitted',

    -- Screening
    screening_answers JSONB,  -- Stored answers to screening questions
    screening_score INTEGER,
    passed_screening BOOLEAN,

    -- Match Score (calculated by matching service)
    match_score INTEGER,
    match_breakdown JSONB,  -- Detailed scoring breakdown

    -- Applicant Data Snapshot (for historical purposes)
    cv_url_snapshot VARCHAR(500),  -- CV at time of application
    profile_snapshot JSONB,  -- Key profile data at time of application

    -- Salary
    expected_salary INTEGER,

    -- Cover Letter / Notes
    cover_letter TEXT,

    -- Response Tracking
    viewed_at TIMESTAMPTZ,  -- When company first viewed
    viewed_by_id UUID REFERENCES users(id),

    -- Timestamps
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(job_id, user_id)
);

CREATE INDEX idx_applications_job ON applications(job_id);
CREATE INDEX idx_applications_user ON applications(user_id);
CREATE INDEX idx_applications_status ON applications(status);
CREATE INDEX idx_applications_applied ON applications(applied_at DESC);
CREATE INDEX idx_applications_omil ON applications(omil_id) WHERE omil_id IS NOT NULL;

-- ============================================================================
-- APPLICATION HISTORY / COMMENTS
-- ============================================================================

CREATE TABLE application_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,

    -- Who made the change
    user_id UUID NOT NULL REFERENCES users(id),

    -- Status change
    previous_status application_status,
    new_status application_status,

    -- Comment
    comment TEXT,
    is_internal BOOLEAN NOT NULL DEFAULT true,  -- Internal vs shared with applicant

    -- Attachments
    attachment_url VARCHAR(500),
    attachment_name VARCHAR(255),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_application_history_application ON application_history(application_id);
CREATE INDEX idx_application_history_created ON application_history(created_at DESC);

-- ============================================================================
-- JOB VIEWS / ANALYTICS
-- ============================================================================

CREATE TABLE job_views (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),  -- NULL for anonymous views

    ip_hash VARCHAR(64),  -- Hashed IP for deduplication
    user_agent VARCHAR(500),
    referrer VARCHAR(500),

    viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_job_views_job ON job_views(job_id);
CREATE INDEX idx_job_views_date ON job_views(viewed_at);

-- ============================================================================
-- SAVED JOBS (Job Seeker Favorites)
-- ============================================================================

CREATE TABLE saved_jobs (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, job_id)
);

CREATE INDEX idx_saved_jobs_user ON saved_jobs(user_id);

-- ============================================================================
-- EMAIL TEMPLATES & NOTIFICATIONS
-- ============================================================================

CREATE TABLE email_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    name VARCHAR(100) NOT NULL UNIQUE,  -- 'welcome', 'password_reset', etc.
    subject VARCHAR(255) NOT NULL,
    body_html TEXT NOT NULL,
    body_text TEXT,  -- Plain text fallback

    variables JSONB,  -- List of available template variables

    is_active BOOLEAN NOT NULL DEFAULT true,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE notification_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),

    notification_type VARCHAR(50) NOT NULL,  -- 'email', 'push', 'sms'
    template_name VARCHAR(100),

    recipient VARCHAR(255) NOT NULL,  -- Email address, phone, etc.
    subject VARCHAR(255),

    status VARCHAR(20) NOT NULL,  -- 'sent', 'failed', 'bounced'
    error_message TEXT,

    metadata JSONB,  -- Additional context

    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notification_log_user ON notification_log(user_id);
CREATE INDEX idx_notification_log_sent ON notification_log(sent_at DESC);

-- ============================================================================
-- SYSTEM CONFIGURATION
-- ============================================================================

CREATE TABLE system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by_id UUID REFERENCES users(id)
);

-- ============================================================================
-- AUDIT LOG
-- ============================================================================

CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Who
    user_id UUID REFERENCES users(id),
    user_email VARCHAR(255),
    impersonated_by_id UUID REFERENCES users(id),

    -- What
    action VARCHAR(100) NOT NULL,  -- 'user.login', 'job.create', 'admin.impersonate'
    entity_type VARCHAR(50),
    entity_id UUID,

    -- Context
    ip_address INET,
    user_agent VARCHAR(500),

    -- Changes
    changes JSONB,  -- {before: {...}, after: {...}}

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);

-- ============================================================================
-- CLOSED ACCOUNTS (GDPR Compliance)
-- ============================================================================

CREATE TABLE closed_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    original_user_id UUID NOT NULL,
    email_hash VARCHAR(64) NOT NULL,  -- Hashed for verification purposes

    user_type user_type NOT NULL,
    closure_reason TEXT,
    requested_data_deletion BOOLEAN NOT NULL DEFAULT false,

    -- Anonymized aggregate data (for statistics)
    aggregate_data JSONB,

    closed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- TRIGGERS FOR updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to all tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_job_seeker_profiles_updated_at BEFORE UPDATE ON job_seeker_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_job_seeker_disabilities_updated_at BEFORE UPDATE ON job_seeker_disabilities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_education_records_updated_at BEFORE UPDATE ON education_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_work_experiences_updated_at BEFORE UPDATE ON work_experiences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_portfolio_items_updated_at BEFORE UPDATE ON portfolio_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_company_members_updated_at BEFORE UPDATE ON company_members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_omil_organizations_updated_at BEFORE UPDATE ON omil_organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_omil_members_updated_at BEFORE UPDATE ON omil_members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_templates_updated_at BEFORE UPDATE ON email_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## 3. API Design

### 3.1 Design Principles

1. **RESTful conventions**: Proper HTTP verbs, resource-based URLs, standard status codes
2. **Consistent naming**: kebab-case URLs, camelCase JSON fields
3. **Pagination**: Cursor-based for large collections, offset-based for admin lists
4. **Filtering**: Query parameters for filtering and sorting
5. **Error responses**: Consistent error format with error codes
6. **Versioning**: Not needed (clean-slate, no backwards compatibility)

### 3.2 Request/Response Format

```typescript
// Success Response
{
  "data": { ... },              // Single item or array
  "meta": {                      // Pagination metadata (if applicable)
    "total": 100,
    "page": 1,
    "perPage": 20,
    "totalPages": 5
  }
}

// Error Response
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      { "field": "email", "message": "Invalid email format" }
    ]
  }
}
```

### 3.3 Authentication Endpoints

```
POST   /api/auth/register                     Register new job seeker
POST   /api/auth/register/company             Register company + admin user
POST   /api/auth/register/omil                Register OMIL + admin user

POST   /api/auth/login                        Login (email + password)
POST   /api/auth/logout                       Logout (invalidate token)
GET    /api/auth/me                           Get current user + context
POST   /api/auth/refresh                      Refresh JWT token

POST   /api/auth/password/forgot              Request password reset email
POST   /api/auth/password/reset               Reset password with token
PUT    /api/auth/password/change              Change password (authenticated)

GET    /api/auth/oauth/google                 Initiate Google OAuth
GET    /api/auth/oauth/linkedin               Initiate LinkedIn OAuth
GET    /api/auth/oauth/callback               OAuth callback handler

POST   /api/auth/email/verify                 Verify email with token
POST   /api/auth/email/resend                 Resend verification email
```

### 3.4 Job Seeker Endpoints

```
# Profile
GET    /api/me/profile                        Get my profile
PUT    /api/me/profile                        Update profile
PUT    /api/me/profile/image                  Upload profile image
DELETE /api/me/profile/image                  Remove profile image

# CV
PUT    /api/me/cv                             Upload CV
DELETE /api/me/cv                             Remove CV
GET    /api/me/cv/download                    Download my CV

# Disability Information
GET    /api/me/disability                     Get disability info
PUT    /api/me/disability                     Update disability info

# Education
GET    /api/me/education                      List education records
POST   /api/me/education                      Add education record
GET    /api/me/education/{id}                 Get education record
PUT    /api/me/education/{id}                 Update education record
DELETE /api/me/education/{id}                 Delete education record

# Work Experience
GET    /api/me/experience                     List work experiences
POST   /api/me/experience                     Add work experience
GET    /api/me/experience/{id}                Get work experience
PUT    /api/me/experience/{id}                Update work experience
DELETE /api/me/experience/{id}                Delete work experience

# Skills
GET    /api/me/skills                         List my skills
POST   /api/me/skills                         Add skill
PUT    /api/me/skills/{id}                    Update skill proficiency
DELETE /api/me/skills/{id}                    Remove skill

# Languages
GET    /api/me/languages                      List my languages
POST   /api/me/languages                      Add language
PUT    /api/me/languages/{id}                 Update language proficiency
DELETE /api/me/languages/{id}                 Remove language

# Portfolio
GET    /api/me/portfolio                      List portfolio items
POST   /api/me/portfolio                      Add portfolio item
PUT    /api/me/portfolio/{id}                 Update portfolio item
DELETE /api/me/portfolio/{id}                 Delete portfolio item

# Applications
GET    /api/me/applications                   List my applications
GET    /api/me/applications/{id}              Get application details

# Saved Jobs
GET    /api/me/saved-jobs                     List saved jobs
POST   /api/me/saved-jobs/{jobId}             Save a job
DELETE /api/me/saved-jobs/{jobId}             Unsave a job

# Settings
GET    /api/me/settings                       Get account settings
PUT    /api/me/settings                       Update settings
PUT    /api/me/settings/email                 Change email address
PUT    /api/me/settings/notifications         Update notification preferences
DELETE /api/me/account                        Close account
```

### 3.5 Public Job Endpoints

```
# Job Listings
GET    /api/jobs                              List active jobs (paginated, filtered)
GET    /api/jobs/{id}                         Get job details
GET    /api/jobs/{slug}                       Get job by slug (SEO-friendly)

# Apply
POST   /api/jobs/{id}/apply                   Apply to job
GET    /api/jobs/{id}/questions               Get screening questions (before applying)

# Companies (Public Profiles)
GET    /api/companies                         List companies with active jobs
GET    /api/companies/{id}                    Get company public profile
GET    /api/companies/{id}/jobs               List company's active jobs
```

### 3.6 Company Endpoints

```
# Company Profile
GET    /api/company/profile                   Get company profile
PUT    /api/company/profile                   Update company profile
PUT    /api/company/profile/logo              Upload logo
PUT    /api/company/profile/cover             Upload cover image
DELETE /api/company/profile/logo              Remove logo

# Team Members
GET    /api/company/members                   List team members
POST   /api/company/members/invite            Invite new member
PUT    /api/company/members/{id}/role         Change member role
DELETE /api/company/members/{id}              Remove member
POST   /api/company/members/resend-invite     Resend invitation

# Jobs
GET    /api/company/jobs                      List company jobs (all statuses)
POST   /api/company/jobs                      Create job draft
GET    /api/company/jobs/{id}                 Get job details
PUT    /api/company/jobs/{id}                 Update job
DELETE /api/company/jobs/{id}                 Delete job (draft only)

# Job Workflow
POST   /api/company/jobs/{id}/submit          Submit for approval
POST   /api/company/jobs/{id}/publish         Publish job (if pre-approved)
POST   /api/company/jobs/{id}/pause           Pause job
POST   /api/company/jobs/{id}/resume          Resume job
POST   /api/company/jobs/{id}/close           Close job

# Screening Questions
GET    /api/company/jobs/{id}/questions       List screening questions
POST   /api/company/jobs/{id}/questions       Add question
PUT    /api/company/jobs/{id}/questions/{qId} Update question
DELETE /api/company/jobs/{id}/questions/{qId} Delete question
PUT    /api/company/jobs/{id}/questions/order Reorder questions

# Applicants
GET    /api/company/jobs/{id}/applicants      List applicants (filtered)
GET    /api/company/jobs/{id}/applicants/{aId}Get applicant details
PUT    /api/company/jobs/{id}/applicants/{aId}/status  Change status
POST   /api/company/jobs/{id}/applicants/{aId}/comment Add comment
GET    /api/company/jobs/{id}/applicants/{aId}/cv      Download CV

# Bulk Actions
POST   /api/company/jobs/{id}/applicants/bulk-status   Bulk status change
GET    /api/company/jobs/{id}/applicants/export        Export to Excel

# Dashboard
GET    /api/company/dashboard                 Dashboard metrics
GET    /api/company/dashboard/activity        Recent activity

# Settings
PUT    /api/company/settings                  Update company settings
```

### 3.7 OMIL Endpoints

```
# Organization Profile
GET    /api/omil/profile                      Get OMIL profile
PUT    /api/omil/profile                      Update profile

# Team Members
GET    /api/omil/members                      List members
POST   /api/omil/members/invite               Invite member
PUT    /api/omil/members/{id}/role            Change role
DELETE /api/omil/members/{id}                 Remove member

# Job Seekers (Managed by OMIL)
GET    /api/omil/job-seekers                  List managed job seekers
POST   /api/omil/job-seekers                  Register new job seeker
GET    /api/omil/job-seekers/{id}             Get job seeker details
GET    /api/omil/job-seekers/{id}/impersonate Get impersonation token
GET    /api/omil/job-seekers/export           Export to Excel

# Applications (For managed job seekers)
GET    /api/omil/applications                 List all applications
GET    /api/omil/applications/{id}            Get application details
POST   /api/omil/applications/{id}/comment    Add OMIL comment

# Apply on Behalf
POST   /api/omil/job-seekers/{id}/apply/{jobId}  Apply to job for seeker

# Dashboard
GET    /api/omil/dashboard                    Dashboard metrics
GET    /api/omil/reports                      Generate reports
```

### 3.8 Admin Endpoints

```
# Users
GET    /api/admin/users                       List all users (paginated)
GET    /api/admin/users/{id}                  Get user details
PUT    /api/admin/users/{id}/status           Change user status
GET    /api/admin/users/{id}/impersonate      Get impersonation token
GET    /api/admin/users/export                Export users

# Companies
GET    /api/admin/companies                   List all companies
GET    /api/admin/companies/{id}              Get company details
POST   /api/admin/companies/{id}/approve      Approve company
POST   /api/admin/companies/{id}/reject       Reject company
PUT    /api/admin/companies/{id}              Edit company
PUT    /api/admin/companies/{id}/status       Change status
GET    /api/admin/companies/{id}/impersonate  Impersonate as company admin

# OMILs
GET    /api/admin/omils                       List all OMILs
GET    /api/admin/omils/{id}                  Get OMIL details
POST   /api/admin/omils/{id}/approve          Approve OMIL
POST   /api/admin/omils/{id}/reject           Reject OMIL
PUT    /api/admin/omils/{id}                  Edit OMIL

# Jobs
GET    /api/admin/jobs                        List all jobs
GET    /api/admin/jobs/{id}                   Get job details
POST   /api/admin/jobs/{id}/approve           Approve job
POST   /api/admin/jobs/{id}/reject            Reject job
PUT    /api/admin/jobs/{id}                   Edit job

# Reports
GET    /api/admin/reports/overview            Platform overview
GET    /api/admin/reports/users               User statistics
GET    /api/admin/reports/companies           Company statistics
GET    /api/admin/reports/jobs                Job statistics
GET    /api/admin/reports/applications        Application statistics
GET    /api/admin/reports/export/{type}       Export report to Excel

# Dashboard
GET    /api/admin/dashboard                   Admin dashboard
GET    /api/admin/activity                    Recent admin activity

# System
GET    /api/admin/settings                    Get system settings
PUT    /api/admin/settings                    Update system settings
GET    /api/admin/audit-log                   View audit log
```

### 3.9 Reference Data Endpoints

```
GET    /api/reference/countries               List countries
GET    /api/reference/regions                 List regions (filter by country)
GET    /api/reference/municipalities          List municipalities (filter by region)
GET    /api/reference/industries              List industries
GET    /api/reference/work-areas              List work areas
GET    /api/reference/position-levels         List position levels
GET    /api/reference/career-fields           List career fields
GET    /api/reference/institutions            List institutions (autocomplete)
GET    /api/reference/languages               List languages
GET    /api/reference/skills                  List skills (filter by category)
GET    /api/reference/skill-categories        List skill categories

# Health Check
GET    /api/health                            Health check endpoint
GET    /api/health/ready                      Readiness check (DB, Redis)
```

---

## 4. Authentication & Authorization

### 4.1 JWT Token Structure

```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    // Standard claims
    pub sub: Uuid,           // User ID
    pub exp: i64,            // Expiration timestamp
    pub iat: i64,            // Issued at timestamp
    pub jti: Uuid,           // Unique token ID (for blacklisting)

    // Custom claims
    pub email: String,
    pub user_type: UserType,

    // Context (for company/OMIL users)
    pub organization_id: Option<Uuid>,      // Company or OMIL ID
    pub organization_type: Option<String>,  // "company" or "omil"
    pub role: Option<MemberRole>,           // owner, admin, member
}
```

### 4.2 Token Lifecycle

```
┌─────────────────┐
│     Login       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     Access Token (15 min)
│  Issue Tokens   │────────────────────────────►  API Requests
└────────┬────────┘
         │
         │ Refresh Token (7 days, httpOnly cookie)
         ▼
┌─────────────────┐
│  Token Refresh  │◄───────────────────────────  Token Expired
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  New Tokens     │
└─────────────────┘
```

### 4.3 Role-Based Access Control

```rust
pub enum Permission {
    // Job Seeker
    ManageOwnProfile,
    ApplyToJobs,
    ViewApplications,

    // Company
    ManageCompanyProfile,
    ManageCompanyMembers,
    CreateJobs,
    ManageJobs,
    ViewApplicants,
    ManageApplicants,

    // OMIL
    ManageOmilProfile,
    ManageOmilMembers,
    ManageJobSeekers,
    ApplyOnBehalf,

    // Admin
    ManageUsers,
    ManageCompanies,
    ManageOmils,
    ApproveJobs,
    ViewReports,
    ManageSystem,
    Impersonate,
}

impl UserType {
    pub fn permissions(&self) -> Vec<Permission> {
        match self {
            UserType::JobSeeker => vec![
                Permission::ManageOwnProfile,
                Permission::ApplyToJobs,
                Permission::ViewApplications,
            ],
            UserType::CompanyMember => vec![
                Permission::ManageCompanyProfile,
                Permission::CreateJobs,
                Permission::ManageJobs,
                Permission::ViewApplicants,
                Permission::ManageApplicants,
            ],
            // ... etc
        }
    }
}
```

### 4.4 Middleware Example

```rust
use axum::{
    extract::State,
    http::Request,
    middleware::Next,
    response::Response,
};

pub async fn require_auth<B>(
    State(state): State<AppState>,
    mut request: Request<B>,
    next: Next<B>,
) -> Result<Response, ApiError> {
    let token = extract_token(&request)?;
    let claims = validate_jwt(&token, &state.jwt_secret)?;

    // Check if token is blacklisted (logout)
    if state.redis.is_token_blacklisted(&claims.jti).await? {
        return Err(ApiError::Unauthorized("Token has been revoked"));
    }

    // Inject claims into request extensions
    request.extensions_mut().insert(claims);

    Ok(next.run(request).await)
}

pub fn require_role(allowed_roles: &'static [UserType]) -> impl Fn(Claims) -> Result<(), ApiError> + Clone {
    move |claims: Claims| {
        if allowed_roles.contains(&claims.user_type) {
            Ok(())
        } else {
            Err(ApiError::Forbidden("Insufficient permissions"))
        }
    }
}
```

---

## 5. File Storage

### 5.1 Storage Structure

```
bucket: empleos-inclusivos/
├── profiles/
│   └── {user_id}/
│       ├── avatar.{ext}
│       └── cv.pdf
├── companies/
│   └── {company_id}/
│       ├── logo.{ext}
│       └── cover.{ext}
├── omils/
│   └── {omil_id}/
│       └── logo.{ext}
├── portfolios/
│   └── {user_id}/
│       └── {item_id}.{ext}
└── temp/
    └── {upload_id}.{ext}
```

### 5.2 Upload Flow

```rust
pub struct UploadService {
    s3_client: S3Client,
    bucket: String,
}

impl UploadService {
    pub async fn upload_profile_image(
        &self,
        user_id: Uuid,
        file: MultipartFile,
    ) -> Result<String, UploadError> {
        // Validate file type
        let content_type = validate_image_type(&file)?;

        // Validate file size (max 2MB for avatars)
        if file.size > 2 * 1024 * 1024 {
            return Err(UploadError::FileTooLarge);
        }

        // Generate path
        let ext = get_extension(&content_type);
        let path = format!("profiles/{}/avatar.{}", user_id, ext);

        // Upload with appropriate ACL
        self.s3_client.put_object()
            .bucket(&self.bucket)
            .key(&path)
            .body(file.bytes.into())
            .content_type(content_type)
            .acl(ObjectCannedAcl::PublicRead)
            .send()
            .await?;

        // Return public URL
        Ok(format!("{}/{}", self.base_url, path))
    }
}
```

### 5.3 File Constraints

| File Type | Max Size | Allowed Formats | Storage Path |
|-----------|----------|-----------------|--------------|
| Profile Image | 2 MB | jpg, png, webp | profiles/{user_id}/avatar.{ext} |
| CV | 5 MB | pdf | profiles/{user_id}/cv.pdf |
| Company Logo | 2 MB | jpg, png, svg | companies/{id}/logo.{ext} |
| Company Cover | 5 MB | jpg, png | companies/{id}/cover.{ext} |
| Portfolio Item | 10 MB | jpg, png, pdf | portfolios/{user_id}/{item_id}.{ext} |

---

## 6. Email Service

### 6.1 Email Templates

| Template Name | Trigger | Variables |
|---------------|---------|-----------|
| `welcome` | User registration | `{firstName}`, `{verifyUrl}` |
| `email_verification` | Email change / resend | `{firstName}`, `{verifyUrl}` |
| `password_reset` | Forgot password | `{firstName}`, `{resetUrl}` |
| `password_changed` | Password change | `{firstName}` |
| `company_approved` | Company approval | `{companyName}`, `{loginUrl}` |
| `company_rejected` | Company rejection | `{companyName}`, `{reason}` |
| `job_approved` | Job approval | `{jobTitle}`, `{companyName}` |
| `job_rejected` | Job rejection | `{jobTitle}`, `{reason}` |
| `application_received` | New application | `{jobTitle}`, `{applicantName}` |
| `application_status` | Status change | `{jobTitle}`, `{status}` |
| `offer_extended` | Job offer | `{jobTitle}`, `{companyName}`, `{responseUrl}` |

### 6.2 Email Service Implementation

```rust
pub struct EmailService {
    smtp: SmtpTransport,
    from: Address,
    templates: HashMap<String, Template>,
    base_url: String,
}

impl EmailService {
    pub async fn send_welcome(&self, user: &User) -> Result<()> {
        let verify_url = format!("{}/verify-email?token={}",
            self.base_url,
            generate_verification_token(user.id)
        );

        let html = self.templates["welcome"].render(&json!({
            "firstName": user.first_name,
            "verifyUrl": verify_url,
        }))?;

        self.send(user.email.clone(), "Welcome to EmpleosInclusivos", html).await
    }

    async fn send(&self, to: String, subject: &str, html: String) -> Result<()> {
        let email = Message::builder()
            .from(self.from.clone())
            .to(to.parse()?)
            .subject(subject)
            .header(ContentType::TEXT_HTML)
            .body(html)?;

        self.smtp.send(&email)?;
        Ok(())
    }
}
```

---

## 7. Background Jobs

### 7.1 Scheduled Jobs

| Job | Schedule | Description |
|-----|----------|-------------|
| `expire_jobs` | Daily 00:00 | Close expired job postings |
| `calculate_matches` | Every 6 hours | Recalculate job-candidate match scores |
| `cleanup_temp_files` | Daily 03:00 | Remove orphaned temp uploads |
| `send_digest` | Daily 08:00 | Send job recommendation digest |
| `aggregate_stats` | Hourly | Aggregate view/application stats |

### 7.2 Job Implementation

```rust
use tokio_cron_scheduler::{Job, JobScheduler};

pub async fn setup_scheduler(state: AppState) -> Result<JobScheduler> {
    let scheduler = JobScheduler::new().await?;

    // Expire jobs daily at midnight
    scheduler.add(
        Job::new_async("0 0 0 * * *", move |_, _| {
            let state = state.clone();
            Box::pin(async move {
                if let Err(e) = expire_jobs(&state).await {
                    tracing::error!("Failed to expire jobs: {}", e);
                }
            })
        })?
    ).await?;

    // Calculate matches every 6 hours
    scheduler.add(
        Job::new_async("0 0 */6 * * *", move |_, _| {
            let state = state.clone();
            Box::pin(async move {
                if let Err(e) = calculate_all_matches(&state).await {
                    tracing::error!("Failed to calculate matches: {}", e);
                }
            })
        })?
    ).await?;

    scheduler.start().await?;
    Ok(scheduler)
}

async fn expire_jobs(state: &AppState) -> Result<()> {
    let expired = sqlx::query!(
        r#"
        UPDATE jobs
        SET status = 'closed', closed_at = NOW(), closed_reason = 'expired'
        WHERE status = 'active' AND expires_at < NOW()
        RETURNING id
        "#
    )
    .fetch_all(&state.db)
    .await?;

    tracing::info!("Expired {} jobs", expired.len());
    Ok(())
}
```

---

## 8. Data Migration Strategy

### 8.1 Migration Approach

Since there's no backwards compatibility requirement, we use a **one-time ETL cutover**:

1. **Freeze legacy system** (read-only mode)
2. **Run ETL migration script** (MySQL → PostgreSQL)
3. **Verify data integrity**
4. **Switch DNS to new system**
5. **Decommission legacy**

### 8.2 ETL Script Structure

```typescript
// scripts/migrate-data.ts

interface MigrationConfig {
  mysqlSource: string;
  postgresTarget: string;
  batchSize: number;
}

async function migrate(config: MigrationConfig) {
  // 1. Reference data (countries, regions, etc.)
  await migrateReferenceData();

  // 2. Users (with password hash migration)
  await migrateUsers();

  // 3. Job seekers (profiles, education, experience, etc.)
  await migrateJobSeekers();

  // 4. Companies and members
  await migrateCompanies();

  // 5. OMILs and members
  await migrateOmils();

  // 6. Jobs (with questions)
  await migrateJobs();

  // 7. Applications (with history)
  await migrateApplications();

  // 8. Files (copy from legacy storage to S3)
  await migrateFiles();

  // 9. Verify counts and integrity
  await verifyMigration();
}
```

### 8.3 Data Transformations

| Legacy (MySQL) | New (PostgreSQL) | Transformation |
|----------------|------------------|----------------|
| `estado_cuenta = 'AC'` | `status = 'active'` | Map string to enum |
| `sexo = 'H'/'M'/'O'` | `gender enum` | 'H'→'male', 'M'→'female', 'O'→'non_binary' |
| `tiene_discapacidad = 'S'/'N'` | `has_disability boolean` | 'S'→true, 'N'→false |
| `discapacidades = 'F,S,V'` | `disability_categories[]` | Split CSV, map to enum array |
| Integer IDs | UUIDs | Generate new UUIDs, maintain mapping table |
| `fecha_creacion datetime` | `created_at timestamptz` | Add UTC timezone |
| `bcrypt hash` | `argon2 hash` | Rehash on first login |

### 8.4 Password Migration

```rust
// On first login after migration, rehash with Argon2
pub async fn login(email: &str, password: &str, db: &PgPool) -> Result<User> {
    let user = get_user_by_email(email, db).await?;

    // Check if password is still bcrypt (legacy)
    if user.password_hash.starts_with("$2") {
        // Verify with bcrypt
        if !bcrypt::verify(password, &user.password_hash)? {
            return Err(AuthError::InvalidCredentials);
        }

        // Rehash with Argon2
        let new_hash = argon2::hash_password(password)?;
        update_password_hash(user.id, &new_hash, db).await?;
    } else {
        // Verify with Argon2
        if !argon2::verify_password(password, &user.password_hash)? {
            return Err(AuthError::InvalidCredentials);
        }
    }

    Ok(user)
}
```

---

## 9. Security

### 9.1 Authentication Security

- **Password hashing**: Argon2id (memory-hard, GPU-resistant)
- **JWT signing**: HS256 with 256-bit secret (consider RS256 for scale)
- **Token expiration**: Access 15min, Refresh 7 days
- **Token blacklist**: Redis-backed for immediate revocation
- **Rate limiting**: 5 login attempts per minute per IP

### 9.2 Input Validation

```rust
use validator::Validate;

#[derive(Debug, Deserialize, Validate)]
pub struct RegisterRequest {
    #[validate(email)]
    pub email: String,

    #[validate(length(min = 8, max = 128))]
    pub password: String,

    #[validate(length(min = 1, max = 100))]
    pub first_name: String,

    #[validate(length(min = 1, max = 100))]
    pub last_name: String,
}
```

### 9.3 SQL Injection Prevention

All queries use SQLx with compile-time verification:

```rust
// Safe - parameterized query
let user = sqlx::query_as!(
    User,
    "SELECT * FROM users WHERE email = $1",
    email
)
.fetch_optional(&pool)
.await?;
```

### 9.4 Authorization Checks

```rust
// Example: Ensure user can only access their own applications
pub async fn get_application(
    claims: Claims,
    Path(id): Path<Uuid>,
    State(state): State<AppState>,
) -> Result<Json<Application>, ApiError> {
    let application = sqlx::query_as!(
        Application,
        "SELECT * FROM applications WHERE id = $1",
        id
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(ApiError::NotFound)?;

    // Authorization check
    if application.user_id != claims.sub {
        return Err(ApiError::Forbidden("Not your application"));
    }

    Ok(Json(application))
}
```

---

## 10. Performance

### 10.1 Database Optimization

- **Connection pooling**: SQLx with 10-50 connections
- **Query optimization**: EXPLAIN ANALYZE for slow queries
- **Indexing strategy**: B-tree for equality, GIN for full-text/JSONB
- **Pagination**: Cursor-based for infinite scroll, offset for admin

### 10.2 Caching Strategy

| Data | Cache Location | TTL | Invalidation |
|------|---------------|-----|--------------|
| Reference data | Redis | 24h | Manual on update |
| User session | Redis | 15min | On logout |
| Job listings | Redis | 5min | On job update |
| Company profile | Redis | 1h | On profile update |
| Dashboard stats | Redis | 1h | Scheduled refresh |

### 10.3 API Performance

- **Response compression**: gzip/brotli for responses > 1KB
- **HTTP/2**: Enabled by default
- **Keep-alive**: Connection reuse
- **Pagination**: Max 100 items per page

---

## Appendix A: Rust Dependencies

```toml
[package]
name = "empleos-inclusivos-backend"
version = "0.1.0"
edition = "2021"

[dependencies]
# Web Framework
axum = { version = "0.8", features = ["macros", "multipart"] }
axum-extra = { version = "0.10", features = ["typed-header", "cookie"] }
tokio = { version = "1", features = ["full"] }
tower = { version = "0.5", features = ["util", "timeout"] }
tower-http = { version = "0.6", features = ["cors", "trace", "compression-gzip", "limit"] }

# Serialization
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"

# Database
sqlx = { version = "0.8", features = [
    "runtime-tokio-rustls",
    "postgres",
    "chrono",
    "uuid",
    "migrate",
    "json"
] }

# Redis
redis = { version = "0.27", features = ["tokio-comp", "connection-manager"] }

# Type Generation
ts-rs = { version = "10", features = ["chrono-impl", "uuid-impl"] }

# Authentication
jsonwebtoken = "10"
argon2 = "0.5"

# Validation
validator = { version = "0.18", features = ["derive"] }

# Date/Time
chrono = { version = "0.4", features = ["serde"] }

# UUID
uuid = { version = "1", features = ["v4", "v7", "serde"] }

# Email
lettre = { version = "0.11", features = ["tokio1-rustls-tls", "builder"] }

# Background Jobs
tokio-cron-scheduler = "0.13"

# Object Storage
aws-sdk-s3 = "1.0"
aws-config = "1.0"

# Logging
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter", "json"] }

# Environment
dotenvy = "0.15"

# Error Handling
thiserror = "1.0"
anyhow = "1.0"

[dev-dependencies]
tokio-test = "0.4"
fake = { version = "2.9", features = ["derive"] }
wiremock = "0.6"
```

---

## Appendix B: Environment Variables

```env
# Application
APP_ENV=development
APP_PORT=3000
APP_BASE_URL=http://localhost:3000
FRONTEND_URL=http://localhost:3001

# Database
DATABASE_URL=postgres://user:pass@localhost:5432/empleos_inclusivos
DATABASE_MAX_CONNECTIONS=50

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-256-bit-secret-key-here
JWT_ACCESS_EXPIRY=900       # 15 minutes in seconds
JWT_REFRESH_EXPIRY=604800   # 7 days in seconds

# OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=

# Storage (S3/MinIO)
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=empleos-inclusivos
S3_REGION=us-east-1
S3_PUBLIC_URL=http://localhost:9000/empleos-inclusivos

# Email
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=noreply@empleosinclusivos.cl

# Logging
RUST_LOG=info,sqlx=warn,tower_http=debug
```

---

## Appendix C: Docker Compose (Development)

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: empleos
      POSTGRES_PASSWORD: empleos
      POSTGRES_DB: empleos_inclusivos
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data

  mailhog:
    image: mailhog/mailhog
    ports:
      - "1025:1025"
      - "8025:8025"

volumes:
  postgres_data:
  minio_data:
```
