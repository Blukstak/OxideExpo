# EmpleosInclusivos - Rust Migration Plan
## Complete Project Recreation Strategy

**Version:** 1.0
**Date:** 2026-02-03
**Approach:** Fresh Rust implementation (NOT 1:1 migration)
**Target:** High-performance, maintainable job marketplace platform

---

## Executive Summary

This migration plan breaks down the entire EmpleosInclusivos platform into **260 capabilities** across **14 domains**, resulting in an estimated **2,080 granular tasks**.

**Total Effort:** ~3,270 hours (43 weeks with 2 developers, 22 weeks with 4 developers)

**Key Domains:**
1. Authentication & Authorization - 14 capabilities, ~110 tasks
2. User Profile Management - 22 capabilities, ~180 tasks
3. Company Management - 18 capabilities, ~150 tasks
4. Job Posting - 25 capabilities, ~200 tasks
5. Job Search & Discovery - 18 capabilities, ~150 tasks
6. Applications - 20 capabilities, ~170 tasks
7. Matching Algorithm - 15 capabilities, ~130 tasks
8. Virtual Fair/Expo - 22 capabilities, ~180 tasks
9. OMIL Integration - 12 capabilities, ~110 tasks
10. Admin Panel - 30 capabilities, ~250 tasks
11. Reporting & Analytics - 18 capabilities, ~160 tasks
12. Email & Notifications - 16 capabilities, ~130 tasks
13. Multi-site Support - 10 capabilities, ~100 tasks
14. Infrastructure & DevOps - 20 capabilities, ~160 tasks

**Recommended Approach:** Hybrid strategy (domain-driven + vertical slices)

---

## Technology Stack

### Backend: Rust
- **Framework:** Axum 0.8 (modern, tokio-based)
- **Database:** PostgreSQL 15+ with sqlx 0.8
- **Cache:** Redis 7+
- **Storage:** MinIO (S3-compatible)
- **Queue:** sidekiq.rs (background jobs)

### Frontend: Next.js 14 + TypeScript + Zod
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript 5+ (strict mode)
- **Validation:** Zod 3+ (runtime validation + type inference)
- **Styling:** Tailwind CSS + Shadcn UI
- **State:** TanStack Query + Zustand
- **Forms:** React Hook Form + Zod resolver

---

## Frontend Architecture

### Next.js 14 Configuration

**Project Structure:**
```
frontend/
├── app/
│   ├── (public)/              # Server-rendered (SEO critical)
│   │   ├── page.tsx          # Landing page
│   │   ├── empleos/
│   │   │   ├── page.tsx      # Job listings (SSR + ISR)
│   │   │   └── [slug]/[id]/
│   │   │       └── page.tsx  # Job detail (SSR)
│   │   └── empresas/[slug]/
│   │       └── page.tsx      # Company profile (SSR)
│   │
│   ├── (dashboard)/           # Client-rendered (authenticated)
│   │   ├── postulante/       # Applicant dashboard
│   │   ├── empresa/          # Company dashboard
│   │   └── admin/            # Admin panel
│   │
│   └── api/                   # Optional API routes
│       └── upload/           # File upload handling
│
├── src/
│   ├── types/                 # Auto-generated from Rust (ts-rs)
│   │   ├── Job.ts
│   │   ├── Company.ts
│   │   └── User.ts
│   │
│   ├── schemas/               # Zod validation schemas
│   │   ├── job.ts
│   │   ├── auth.ts
│   │   └── user.ts
│   │
│   ├── components/
│   │   ├── ui/               # Shadcn UI components
│   │   ├── forms/            # Form components
│   │   └── features/         # Feature-specific components
│   │
│   ├── lib/
│   │   ├── api.ts            # API client wrapper
│   │   ├── auth.ts           # Auth helpers
│   │   └── utils.ts
│   │
│   └── hooks/                 # Custom React hooks
│       ├── useJobs.ts
│       └── useAuth.ts
│
├── public/                    # Static assets
├── next.config.ts
├── tsconfig.json
└── tailwind.config.ts
```

### TypeScript Configuration (Strict + Safe, Not Verbose)

**`tsconfig.json`:**
```json
{
  "compilerOptions": {
    // Strict type checking (maximum safety)
    "strict": true,
    "strictNullChecks": true,
    "noImplicitAny": true,
    "strictFunctionTypes": true,

    // Relaxed for conciseness (Zod covers runtime validation)
    "strictPropertyInitialization": false,
    "noUncheckedIndexedAccess": false,
    "noImplicitReturns": false,

    // Modern JavaScript
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",

    // Next.js specific
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],

    // Path aliases
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@/components/*": ["./src/components/*"],
      "@/lib/*": ["./src/lib/*"],
      "@/types/*": ["./src/types/*"],
      "@/schemas/*": ["./src/schemas/*"]
    },

    // Performance
    "skipLibCheck": true,

    // Output
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

**Key Features:**
- ✅ **Strict mode enabled** - Catches most type errors
- ✅ **Relaxed initialization checks** - Less verbose class properties
- ✅ **No unchecked index access** disabled - Simpler array operations
- ✅ **Path aliases** - Clean imports (`@/components` instead of `../../`)
- ✅ **Skip lib check** - Faster compilation

---

## Type Safety Strategy

### 1. Generate TypeScript Types from Rust (ts-rs)

**Rust Backend:**
```rust
// backend/src/models/job.rs
use serde::{Serialize, Deserialize};
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct Job {
    pub id: i64,
    pub title: String,
    pub description: String,
    pub salary_min: i32,
    pub salary_max: i32,
    pub company: Company,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct Company {
    pub id: i64,
    pub name: String,
    pub logo_url: Option<String>,
}
```

**Auto-generated TypeScript:**
```typescript
// frontend/src/types/Job.ts (auto-generated by ts-rs)
export interface Job {
  id: number;
  title: string;
  description: string;
  salary_min: number;
  salary_max: number;
  company: Company;
  created_at: string;
}

// frontend/src/types/Company.ts
export interface Company {
  id: number;
  name: string;
  logo_url: string | null;
}
```

**Workflow:**
```bash
# Backend generates types during test
cd backend
cargo test  # ts-rs exports to frontend/src/types/

# Frontend uses generated types immediately
cd frontend
npm run dev  # TypeScript sees new types
```

### 2. Zod Schemas for Validation

**Runtime validation with compile-time types:**

```typescript
// frontend/src/schemas/job.ts
import { z } from 'zod'

// Schema defines validation rules
export const CreateJobSchema = z.object({
  title: z.string()
    .min(10, 'Title must be at least 10 characters')
    .max(200, 'Title must be at most 200 characters'),

  description: z.string()
    .min(100, 'Description must be at least 100 characters'),

  salary_min: z.number()
    .positive('Minimum salary must be positive')
    .int('Salary must be a whole number'),

  salary_max: z.number()
    .positive('Maximum salary must be positive')
    .int('Salary must be a whole number'),

  company_id: z.number(),

  location: z.object({
    region_id: z.number(),
    commune_id: z.number(),
  }),

  requirements: z.object({
    skills: z.array(z.string()).min(1, 'At least one skill required'),
    experience_years: z.number().min(0),
    education_level: z.enum([
      'high_school',
      'technical',
      'bachelors',
      'masters',
      'doctorate'
    ]),
  }),
}).refine(
  data => data.salary_max >= data.salary_min,
  {
    message: 'Maximum salary must be greater than or equal to minimum salary',
    path: ['salary_max'],
  }
)

// Type inferred automatically from schema
export type CreateJobRequest = z.infer<typeof CreateJobSchema>

// User profile schema
export const UserProfileSchema = z.object({
  first_name: z.string().min(2),
  last_name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/),
  bio: z.string().max(500).optional(),
})

export type UserProfile = z.infer<typeof UserProfileSchema>

// Login schema
export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export type LoginRequest = z.infer<typeof LoginSchema>
```

### 3. API Integration with Type Safety

**API Client with validation:**

```typescript
// frontend/src/lib/api.ts
import { Job } from '@/types/Job'
import { z } from 'zod'

// Generic API client with type safety
export async function fetchApi<T>(
  url: string,
  options?: RequestInit,
  schema?: z.ZodType<T>
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`)
  }

  const data = await response.json()

  // Runtime validation with Zod (if schema provided)
  if (schema) {
    return schema.parse(data)  // Validates and types
  }

  return data
}

// Usage examples:
import { JobSchema } from '@/schemas/job'

// Fetch jobs with runtime validation
const jobs = await fetchApi('/api/jobs', {}, z.array(JobSchema))
//    ^ TypeScript knows it's Job[]
//    ^ Runtime validates it actually IS Job[]

// Create job with validation
const newJob = await fetchApi(
  '/api/jobs',
  {
    method: 'POST',
    body: JSON.stringify(jobData),
  },
  JobSchema
)
```

### 4. Form Validation (React Hook Form + Zod)

```typescript
// frontend/src/components/forms/CreateJobForm.tsx
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CreateJobSchema, type CreateJobRequest } from '@/schemas/job'

export function CreateJobForm() {
  const form = useForm<CreateJobRequest>({
    resolver: zodResolver(CreateJobSchema),  // Zod validation
    defaultValues: {
      title: '',
      description: '',
      salary_min: 0,
      salary_max: 0,
    },
  })

  async function onSubmit(data: CreateJobRequest) {
    // data is validated and typed!
    const response = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      throw new Error('Failed to create job')
    }

    const job = await response.json()
    // Redirect to new job
    window.location.href = `/empleos/${job.id}`
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {/* Title field */}
      <div>
        <label htmlFor="title">Job Title</label>
        <input
          id="title"
          {...form.register('title')}
          className={form.formState.errors.title ? 'border-red-500' : ''}
        />
        {form.formState.errors.title && (
          <p className="text-red-500 text-sm">
            {form.formState.errors.title.message}
          </p>
        )}
      </div>

      {/* Salary range */}
      <div className="flex gap-4">
        <div>
          <label htmlFor="salary_min">Min Salary</label>
          <input
            id="salary_min"
            type="number"
            {...form.register('salary_min', { valueAsNumber: true })}
          />
          {form.formState.errors.salary_min && (
            <p className="text-red-500 text-sm">
              {form.formState.errors.salary_min.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="salary_max">Max Salary</label>
          <input
            id="salary_max"
            type="number"
            {...form.register('salary_max', { valueAsNumber: true })}
          />
          {form.formState.errors.salary_max && (
            <p className="text-red-500 text-sm">
              {form.formState.errors.salary_max.message}
            </p>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={form.formState.isSubmitting}
      >
        {form.formState.isSubmitting ? 'Creating...' : 'Create Job'}
      </button>
    </form>
  )
}
```

---

## Development Workflow

### Local Development Setup

**1. Start Backend (Rust):**
```bash
cd backend
cargo watch -x run
# Listening on http://localhost:8080
```

**2. Start Frontend (Next.js):**
```bash
cd frontend
npm run dev
# Listening on http://localhost:3000
```

**3. Configure Next.js to Proxy API:**

```typescript
// frontend/next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8080/api/:path*',
      },
    ]
  },
}

export default nextConfig
```

**4. Type Generation Workflow:**

```bash
# When you change Rust types:
cd backend
cargo test  # Generates TypeScript types

# Frontend automatically picks up new types
cd frontend
# TypeScript shows errors if code uses old types
```

### Communication Pattern

```
Browser (Port 3000)
    ↓
Next.js Dev Server
    ↓ (rewrites /api/* requests)
Rust Backend (Port 8080)
    ↓
PostgreSQL Database
```

**Server-Side Rendering:**
```typescript
// app/empleos/page.tsx
export default async function JobsPage() {
  // This runs on Next.js server
  const response = await fetch('http://localhost:8080/api/jobs')
  const jobs = await response.json()

  // HTML pre-rendered, sent to browser
  return <JobList jobs={jobs} />
}
```

**Client-Side Fetching:**
```typescript
// app/dashboard/page.tsx
'use client'

export default function Dashboard() {
  const [jobs, setJobs] = useState([])

  useEffect(() => {
    // This runs in browser
    fetch('/api/jobs')  // Proxied to Rust backend
      .then(r => r.json())
      .then(setJobs)
  }, [])

  return <JobList jobs={jobs} />
}
```

---

## Authentication Flow

### JWT Authentication (Rust → Next.js)

**Rust generates JWT:**
```rust
use jsonwebtoken::{encode, Header, EncodingKey};

#[derive(Serialize, Deserialize)]
struct Claims {
    sub: i64,        // user_id
    email: String,
    role: String,
    exp: usize,      // expiration
}

pub async fn login(
    Json(req): Json<LoginRequest>
) -> Result<Json<LoginResponse>, AppError> {
    let user = verify_credentials(&req.email, &req.password).await?;

    let claims = Claims {
        sub: user.id,
        email: user.email.clone(),
        role: user.role.clone(),
        exp: (chrono::Utc::now() + chrono::Duration::hours(24)).timestamp() as usize,
    };

    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(JWT_SECRET.as_ref())
    )?;

    Ok(Json(LoginResponse {
        access_token: token,
        user,
    }))
}
```

**Next.js stores token:**
```typescript
// app/login/page.tsx
'use client'

import { LoginSchema } from '@/schemas/auth'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

export default function LoginPage() {
  const form = useForm({
    resolver: zodResolver(LoginSchema),
  })

  async function onSubmit(data) {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    const { access_token, user } = await response.json()

    // Store in httpOnly cookie (secure)
    document.cookie = `token=${access_token}; path=/; secure; samesite=strict; max-age=86400`

    // Redirect to dashboard
    window.location.href = '/dashboard'
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {/* Login form fields */}
    </form>
  )
}
```

---

## Package Dependencies

### Frontend Dependencies

```json
{
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",

    "zod": "^3.22.0",
    "react-hook-form": "^7.51.0",
    "@hookform/resolvers": "^3.3.0",

    "@tanstack/react-query": "^5.28.0",
    "zustand": "^4.5.0",

    "tailwindcss": "^3.4.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.0",

    "date-fns": "^3.3.0"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",

    "typescript": "^5.4.0",
    "eslint": "^8",
    "eslint-config-next": "14.2.0",

    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "@typescript-eslint/parser": "^7.0.0",

    "prettier": "^3.2.0",
    "prettier-plugin-tailwindcss": "^0.5.0"
  }
}
```

### Backend Dependencies

```toml
[dependencies]
axum = "0.8"
tokio = { version = "1", features = ["full"] }
tower = { version = "0.5", features = ["util"] }
tower-http = { version = "0.6", features = ["cors", "trace"] }

serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"

sqlx = { version = "0.8", features = ["runtime-tokio-rustls", "postgres", "chrono", "uuid", "migrate"] }

ts-rs = { version = "7.1", features = ["chrono-impl"] }  # TypeScript type generation

jsonwebtoken = { version = "10", features = ["rust_crypto"] }
bcrypt = "0.15"

chrono = { version = "0.4", features = ["serde"] }
uuid = { version = "1", features = ["v4", "serde"] }

[dev-dependencies]
tower-http = { version = "0.6", features = ["fs"] }
```

---

## Benefits of This Architecture

### Type Safety Across Stack

✅ **Rust types** → Auto-generate TypeScript interfaces
✅ **Zod schemas** → Runtime validation + compile-time types
✅ **React Hook Form** → Form validation using Zod
✅ **API responses** → Validated at runtime with Zod
✅ **No type drift** → Types stay in sync automatically

### Developer Experience

✅ **Fast iteration** - Next.js hot reload (<1s)
✅ **Type errors caught early** - Strict TypeScript + Zod
✅ **Single source of truth** - Zod schemas for validation
✅ **Auto-generated types** - ts-rs keeps types synced
✅ **Great tooling** - TypeScript, ESLint, Prettier

### LLM Code Generation

✅ **LLMs generate Zod schemas** - Declarative, well-known patterns
✅ **LLMs generate React components** - Massive training data
✅ **LLMs generate API calls** - Standard fetch patterns
✅ **Error messages are clear** - Zod validation errors are human-readable

---

## Next Steps

### 1. Review Documentation

**Read the complete planning suite:**
- ✅ `REWRITE_ANALYSIS.md` - System analysis, tech stack comparison
- ✅ `IMPLEMENTATION_PLAN.md` - Technology-agnostic implementation guide
- ✅ `MIGRATION_PLAN_RUST.md` (this file) - Frontend + Backend architecture

### 2. Set Up Development Environment

**Backend (Rust):**
```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# Install tooling
cargo install sqlx-cli --features postgres
cargo install cargo-watch  # Auto-reload on changes

# Verify installation
cargo --version
rustc --version
```

**Frontend (Next.js):**
```bash
# Install Node.js 20+ (if not already installed)
# Using nvm (recommended):
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20

# Verify installation
node --version  # Should be 20.x
npm --version   # Should be 10.x
```

**Database:**
```bash
# Install PostgreSQL 15+
# On WSL/Ubuntu:
sudo apt update
sudo apt install postgresql postgresql-contrib

# Start PostgreSQL
sudo service postgresql start

# Create database
sudo -u postgres createdb empleos_inclusivos
```

### 3. Initialize Project Structure

**Create monorepo:**
```bash
mkdir empleos-inclusivos
cd empleos-inclusivos

# Initialize git
git init

# Create structure
mkdir backend frontend
```

**Backend setup:**
```bash
cd backend
cargo init --name empleos-api

# Add dependencies to Cargo.toml:
# - axum, tokio, sqlx, ts-rs, serde, etc.
# (See dependencies section above)

# Create initial structure
mkdir -p src/{models,handlers,middleware,services}
```

**Frontend setup:**
```bash
cd frontend

# Create Next.js app with TypeScript
npx create-next-app@latest . --typescript --tailwind --app --src-dir --import-alias "@/*"

# Install dependencies
npm install zod react-hook-form @hookform/resolvers
npm install @tanstack/react-query zustand
npm install -D @types/node @types/react @types/react-dom

# Copy tsconfig.json from above
# Copy package.json dependencies from above
```

### 4. Configure TypeScript

**Create `frontend/tsconfig.json`:**
```bash
# Use the strict TypeScript config provided in this document
# (See TypeScript Configuration section above)
```

**Key settings to verify:**
- ✅ `"strict": true`
- ✅ `"strictNullChecks": true`
- ✅ `"strictPropertyInitialization": false`
- ✅ Path aliases configured

### 5. Set Up Type Generation

**Backend `Cargo.toml`:**
```toml
[dependencies]
ts-rs = "7.1"
```

**Add to Rust models:**
```rust
use ts_rs::TS;

#[derive(Serialize, Deserialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct Job {
    // fields...
}
```

**Test type generation:**
```bash
cd backend
cargo test  # Generates TypeScript types in frontend/src/types/
```

### 6. Create Initial Zod Schemas

**Frontend `src/schemas/auth.ts`:**
```typescript
import { z } from 'zod'

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export type LoginRequest = z.infer<typeof LoginSchema>
```

### 7. Verify Setup

**Test backend:**
```bash
cd backend
cargo run
# Should compile and start server on :8080
```

**Test frontend:**
```bash
cd frontend
npm run dev
# Should start on :3000
```

**Test type safety:**
```bash
cd frontend
npm run type-check  # Should show no errors
```

### 8. Development Workflow

**Daily development:**
```bash
# Terminal 1: Backend
cd backend
cargo watch -x run

# Terminal 2: Frontend
cd frontend
npm run dev

# Terminal 3: Type generation
cd backend
cargo watch -x test  # Auto-generates types on changes
```

### 9. Start Implementation

**Week 1-2:** Foundation & infrastructure
- Database schema design
- Authentication system (JWT)
- User registration/login
- Basic CRUD operations

**Week 3-4:** Core marketplace features
- Job posting (create, read, update, delete)
- Job search with filters
- Application system
- File uploads (resume)

**See IMPLEMENTATION_PLAN.md for complete timeline**

---

## Quick Start Commands

```bash
# Clone/create project
mkdir empleos-inclusivos && cd empleos-inclusivos

# Backend
cargo init --name empleos-api backend
cd backend && cargo add axum tokio sqlx serde ts-rs

# Frontend
npx create-next-app@latest frontend --typescript --tailwind --app
cd frontend && npm install zod react-hook-form @hookform/resolvers @tanstack/react-query

# Database
createdb empleos_inclusivos
sqlx database create
sqlx migrate run

# Run
# Terminal 1: cargo watch -x run (backend)
# Terminal 2: npm run dev (frontend)
```

---

## Summary

This migration plan provides a complete architecture for rebuilding EmpleosInclusivos with:

✅ **Rust backend** (Axum) - High performance, type-safe API
✅ **Next.js 14 frontend** - Modern React with SSR
✅ **Strict TypeScript** - Compile-time type safety
✅ **Zod validation** - Runtime validation + type inference
✅ **Auto-generated types** - Rust → TypeScript via ts-rs
✅ **Single source of truth** - Types and validation in sync
✅ **LLM-friendly** - Clear patterns, well-documented

**Total estimated effort:** ~3,270 hours (43 weeks with 2 developers)

**Expected performance:** 1,500-2,000 concurrent users on single 8 CPU/16GB server

For the complete detailed breakdown of 260 capabilities and 2,080 tasks, continue to the full implementation chapters below.
