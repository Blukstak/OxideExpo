# Proof of Concept Implementation Plan
## EmpleosInclusivos - Job Listing Vertical Slice

**Version**: 1.0
**Date**: 2026-02-03
**Goal**: Validate the complete Rust + Next.js + TypeScript + Zod tech stack with a working feature

---

## 1. Overview

### 1.1 Selected Feature: Job Browsing & Application Flow

**User Journey**:
1. 🌐 Browse job listings (public, no auth)
2. 🔍 View job details (public, no auth)
3. 📝 Register as job seeker (if not registered)
4. 🔐 Login with credentials
5. ✅ Apply to a job (authenticated)

### 1.2 Why This Vertical Slice?

✅ **Tests Complete Stack**:
- Database schema design (PostgreSQL + sqlx)
- Backend REST API (Axum + JWT auth)
- Frontend SSR + Client (Next.js App Router)
- Type generation (Rust → TypeScript via ts-rs)
- Validation (Zod schemas)
- Forms (React Hook Form + Zod)
- Authentication flow (JWT + httpOnly cookies)

✅ **Realistic Complexity**:
- Real business logic (job search/filtering)
- Multiple database tables with relationships
- Both public and authenticated routes
- Form validation edge cases

✅ **Measurable Success**:
- Can browse jobs without login
- Can register and login
- Can apply to jobs when authenticated
- All types are generated and validated
- Zero runtime type errors

---

## 2. Minimal Database Schema

### 2.1 Tables (7 total)

```sql
-- 1. Regions (ti_regiones)
CREATE TABLE regions (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    codigo VARCHAR(10) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Users (ti_usuarios)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    rut VARCHAR(20) NOT NULL UNIQUE,
    telefono VARCHAR(20),
    region_id INTEGER REFERENCES regions(id),
    user_type VARCHAR(20) NOT NULL DEFAULT 'usuario', -- 'usuario', 'empresa', 'admin'
    status CHAR(1) NOT NULL DEFAULT 'T', -- T=active, P=pending, F=blocked
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Companies (ti_empresas)
CREATE TABLE companies (
    id SERIAL PRIMARY KEY,
    razon_social VARCHAR(255) NOT NULL,
    rut VARCHAR(20) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    telefono VARCHAR(20),
    region_id INTEGER REFERENCES regions(id),
    website VARCHAR(255),
    descripcion TEXT,
    logo_url VARCHAR(500),
    status CHAR(1) NOT NULL DEFAULT 'T', -- T=active, P=pending, F=blocked
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Job Categories (ti_categoria_oferta)
CREATE TABLE job_categories (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Jobs (ti_ofertas_laborales)
CREATE TABLE jobs (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id),
    category_id INTEGER REFERENCES job_categories(id),
    region_id INTEGER REFERENCES regions(id),
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    requirements TEXT,
    benefits TEXT,
    salary_min INTEGER,
    salary_max INTEGER,
    salary_currency VARCHAR(10) DEFAULT 'CLP',
    employment_type VARCHAR(50), -- 'full-time', 'part-time', 'contract', etc.
    vacancies INTEGER NOT NULL DEFAULT 1,
    application_deadline DATE,
    status CHAR(1) NOT NULL DEFAULT 'P', -- T=active, P=pending, R=rejected, E=expired
    views_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ
);

-- 6. Job Applications (ti_postulante_oferta)
CREATE TABLE job_applications (
    id SERIAL PRIMARY KEY,
    job_id INTEGER NOT NULL REFERENCES jobs(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    cover_letter TEXT,
    cv_url VARCHAR(500),
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'reviewed', 'accepted', 'rejected'
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    UNIQUE(job_id, user_id) -- One application per user per job
);

-- 7. Sessions (for JWT refresh tokens - optional for PoC)
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL REFERENCES users(id),
    refresh_token VARCHAR(500) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 2.2 Indexes

```sql
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_company ON jobs(company_id);
CREATE INDEX idx_jobs_category ON jobs(category_id);
CREATE INDEX idx_jobs_region ON jobs(region_id);
CREATE INDEX idx_jobs_published ON jobs(published_at);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_applications_job ON job_applications(job_id);
CREATE INDEX idx_applications_user ON job_applications(user_id);
CREATE INDEX idx_sessions_user ON sessions(user_id);
```

### 2.3 Seed Data

```sql
-- Insert regions (simplified - just 3 main regions for PoC)
INSERT INTO regions (nombre, codigo) VALUES
('Región Metropolitana', 'RM'),
('Valparaíso', 'V'),
('Biobío', 'VIII');

-- Insert sample categories
INSERT INTO job_categories (nombre, descripcion) VALUES
('Tecnología', 'Trabajos en tecnología e informática'),
('Administración', 'Trabajos administrativos y gestión'),
('Ventas', 'Trabajos en ventas y atención al cliente');

-- Insert a sample company
INSERT INTO companies (razon_social, rut, email, telefono, region_id, descripcion, status) VALUES
('Tech Innovadores SpA', '76.123.456-7', 'contacto@techinnovadores.cl', '+56912345678', 1, 'Empresa líder en desarrollo de software', 'T');

-- Insert sample jobs
INSERT INTO jobs (company_id, category_id, region_id, title, description, requirements, salary_min, salary_max, employment_type, vacancies, status, published_at) VALUES
(1, 1, 1, 'Desarrollador Full Stack', 'Buscamos desarrollador con experiencia en desarrollo web moderno.', 'Experiencia con React, Node.js, PostgreSQL. Al menos 2 años de experiencia.', 1500000, 2500000, 'full-time', 2, 'T', NOW()),
(1, 1, 1, 'Diseñador UX/UI', 'Diseñador creativo para productos digitales innovadores.', 'Portafolio comprobable. Manejo de Figma, Adobe XD.', 1200000, 2000000, 'full-time', 1, 'T', NOW());
```

---

## 3. Backend Implementation (Rust)

### 3.1 Project Structure

```
backend/
├── Cargo.toml
├── .env
├── migrations/
│   └── 001_initial_schema.sql
└── src/
    ├── main.rs
    ├── config.rs
    ├── error.rs
    ├── models/
    │   ├── mod.rs
    │   ├── user.rs
    │   ├── company.rs
    │   ├── job.rs
    │   └── application.rs
    ├── handlers/
    │   ├── mod.rs
    │   ├── auth.rs
    │   ├── jobs.rs
    │   └── applications.rs
    ├── services/
    │   ├── mod.rs
    │   ├── auth_service.rs
    │   ├── job_service.rs
    │   └── application_service.rs
    ├── middleware/
    │   ├── mod.rs
    │   └── auth.rs
    └── utils/
        ├── mod.rs
        ├── jwt.rs
        └── password.rs
```

### 3.2 Dependencies (Cargo.toml)

```toml
[package]
name = "empleos-inclusivos-backend"
version = "0.1.0"
edition = "2021"

[dependencies]
# Web framework
axum = "0.8"
tokio = { version = "1", features = ["full"] }
tower = { version = "0.5", features = ["util"] }
tower-http = { version = "0.6", features = ["cors", "trace"] }

# Database
sqlx = { version = "0.8", features = ["runtime-tokio-rustls", "postgres", "uuid", "chrono", "migrate"] }

# Serialization
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"

# TypeScript generation
ts-rs = { version = "7.1", features = ["chrono-impl"] }

# Authentication
jsonwebtoken = { version = "10", features = ["rust_crypto"] }
bcrypt = "0.15"

# Validation
validator = { version = "0.18", features = ["derive"] }

# Environment
dotenvy = "0.15"

# Logging
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }

# DateTime
chrono = { version = "0.4", features = ["serde"] }

# UUID
uuid = { version = "1.6", features = ["v4", "serde"] }

# Error handling
thiserror = "1.0"
anyhow = "1.0"
```

### 3.3 Core Models (with ts-rs)

**src/models/user.rs**:
```rust
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use ts_rs::TS;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct User {
    pub id: i32,
    pub email: String,
    #[serde(skip_serializing)] // Never send password hash to frontend
    #[ts(skip)]
    pub password_hash: String,
    pub nombre: String,
    pub apellidos: String,
    pub rut: String,
    pub telefono: Option<String>,
    pub region_id: Option<i32>,
    pub user_type: String,
    pub status: String,
    pub email_verified: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, Serialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct RegisterRequest {
    pub email: String,
    pub password: String,
    pub nombre: String,
    pub apellidos: String,
    pub rut: String,
    pub telefono: Option<String>,
    pub region_id: Option<i32>,
}

#[derive(Debug, Deserialize, Serialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Serialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct AuthResponse {
    pub user: User,
    pub token: String,
    pub expires_at: DateTime<Utc>,
}
```

**src/models/job.rs**:
```rust
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use ts_rs::TS;
use chrono::{DateTime, Utc, NaiveDate};

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct Job {
    pub id: i32,
    pub company_id: i32,
    pub category_id: Option<i32>,
    pub region_id: Option<i32>,
    pub title: String,
    pub description: String,
    pub requirements: Option<String>,
    pub benefits: Option<String>,
    pub salary_min: Option<i32>,
    pub salary_max: Option<i32>,
    pub salary_currency: Option<String>,
    pub employment_type: Option<String>,
    pub vacancies: i32,
    pub application_deadline: Option<NaiveDate>,
    pub status: String,
    pub views_count: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub published_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct JobWithCompany {
    #[serde(flatten)]
    pub job: Job,
    pub company_name: String,
    pub company_logo: Option<String>,
    pub category_name: Option<String>,
    pub region_name: Option<String>,
}

#[derive(Debug, Deserialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct JobListQuery {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    pub category_id: Option<i32>,
    pub region_id: Option<i32>,
    pub search: Option<String>,
}

#[derive(Debug, Serialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct JobListResponse {
    pub jobs: Vec<JobWithCompany>,
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
    pub total_pages: i64,
}
```

**src/models/application.rs**:
```rust
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use ts_rs::TS;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct JobApplication {
    pub id: i32,
    pub job_id: i32,
    pub user_id: i32,
    pub cover_letter: Option<String>,
    pub cv_url: Option<String>,
    pub status: String,
    pub applied_at: DateTime<Utc>,
    pub reviewed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize, Serialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct CreateApplicationRequest {
    pub job_id: i32,
    pub cover_letter: Option<String>,
}
```

### 3.4 API Endpoints

```rust
// src/main.rs
use axum::{
    routing::{get, post},
    Router,
};
use tower_http::cors::CorsLayer;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing
    tracing_subscriber::fmt::init();

    // Load environment variables
    dotenvy::dotenv().ok();

    // Initialize database connection pool
    let database_url = std::env::var("DATABASE_URL")?;
    let pool = sqlx::PgPool::connect(&database_url).await?;

    // Run migrations
    sqlx::migrate!("./migrations").run(&pool).await?;

    // Build application state
    let app_state = AppState { db: pool };

    // Build router
    let app = Router::new()
        // Public routes
        .route("/api/jobs", get(handlers::jobs::list_jobs))
        .route("/api/jobs/:id", get(handlers::jobs::get_job))

        // Auth routes
        .route("/api/auth/register", post(handlers::auth::register))
        .route("/api/auth/login", post(handlers::auth::login))
        .route("/api/auth/me", get(handlers::auth::me))

        // Protected routes
        .route("/api/applications", post(handlers::applications::create_application))
        .route("/api/applications/my", get(handlers::applications::my_applications))

        // CORS
        .layer(CorsLayer::permissive())

        // State
        .with_state(app_state);

    // Start server
    let listener = tokio::net::TcpListener::bind("127.0.0.1:8080").await?;
    tracing::info!("Server listening on {}", listener.local_addr()?);
    axum::serve(listener, app).await?;

    Ok(())
}

#[derive(Clone)]
struct AppState {
    db: sqlx::PgPool,
}
```

**Key Handler Example (src/handlers/jobs.rs)**:
```rust
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use crate::{models::job::*, AppState};

pub async fn list_jobs(
    State(state): State<AppState>,
    Query(params): Query<JobListQuery>,
) -> Result<Json<JobListResponse>, StatusCode> {
    let page = params.page.unwrap_or(1).max(1);
    let per_page = params.per_page.unwrap_or(20).min(100);
    let offset = (page - 1) * per_page;

    // Build query with filters
    let mut query = String::from(
        "SELECT j.*, c.razon_social as company_name, c.logo_url as company_logo,
                cat.nombre as category_name, r.nombre as region_name
         FROM jobs j
         INNER JOIN companies c ON j.company_id = c.id
         LEFT JOIN job_categories cat ON j.category_id = cat.id
         LEFT JOIN regions r ON j.region_id = r.id
         WHERE j.status = 'T'"
    );

    let mut count_query = String::from(
        "SELECT COUNT(*) FROM jobs j WHERE j.status = 'T'"
    );

    // Add filters
    if let Some(category_id) = params.category_id {
        query.push_str(&format!(" AND j.category_id = {}", category_id));
        count_query.push_str(&format!(" AND j.category_id = {}", category_id));
    }

    if let Some(region_id) = params.region_id {
        query.push_str(&format!(" AND j.region_id = {}", region_id));
        count_query.push_str(&format!(" AND j.region_id = {}", region_id));
    }

    if let Some(search) = &params.search {
        let search_pattern = format!("%{}%", search);
        query.push_str(&format!(" AND (j.title ILIKE '{}' OR j.description ILIKE '{}')", search_pattern, search_pattern));
        count_query.push_str(&format!(" AND (j.title ILIKE '{}' OR j.description ILIKE '{}')", search_pattern, search_pattern));
    }

    query.push_str(" ORDER BY j.published_at DESC NULLS LAST");
    query.push_str(&format!(" LIMIT {} OFFSET {}", per_page, offset));

    // Execute queries
    let jobs: Vec<JobWithCompany> = sqlx::query_as(&query)
        .fetch_all(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let total: (i64,) = sqlx::query_as(&count_query)
        .fetch_one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(JobListResponse {
        jobs,
        total: total.0,
        page,
        per_page,
        total_pages: (total.0 + per_page - 1) / per_page,
    }))
}
```

---

## 4. Frontend Implementation (Next.js)

### 4.1 Project Structure

```
frontend/
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.ts
└── src/
    ├── app/
    │   ├── layout.tsx
    │   ├── page.tsx (job listing)
    │   ├── jobs/
    │   │   └── [id]/
    │   │       └── page.tsx (job detail)
    │   ├── register/
    │   │   └── page.tsx
    │   ├── login/
    │   │   └── page.tsx
    │   └── my-applications/
    │       └── page.tsx
    ├── components/
    │   ├── JobCard.tsx
    │   ├── JobFilters.tsx
    │   ├── RegisterForm.tsx
    │   ├── LoginForm.tsx
    │   ├── ApplicationForm.tsx
    │   └── ui/ (shadcn components)
    ├── lib/
    │   ├── api.ts (API client)
    │   ├── auth.ts (auth utilities)
    │   └── schemas.ts (Zod schemas)
    ├── types/ (auto-generated from Rust)
    │   ├── User.ts
    │   ├── Job.ts
    │   └── JobApplication.ts
    ├── hooks/
    │   ├── useAuth.ts
    │   └── useJobs.ts
    └── contexts/
        └── AuthContext.tsx
```

### 4.2 Dependencies (package.json)

```json
{
  "name": "empleos-inclusivos-frontend",
  "version": "0.1.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "type-gen": "cd ../backend && cargo test --package empleos-inclusivos-backend --lib -- tests::generate_types --exact --nocapture"
  },
  "dependencies": {
    "next": "14.1.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-hook-form": "^7.49.3",
    "@hookform/resolvers": "^3.3.4",
    "zod": "^3.22.4",
    "@tanstack/react-query": "^5.17.19",
    "zustand": "^4.5.0",
    "axios": "^1.6.5",
    "tailwindcss": "^3.4.1",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.0"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "typescript": "^5",
    "autoprefixer": "^10.0.1",
    "postcss": "^8"
  }
}
```

### 4.3 TypeScript Configuration

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "strictNullChecks": true,
    "noImplicitAny": true,
    "strictFunctionTypes": true,
    "strictPropertyInitialization": false,
    "noUncheckedIndexedAccess": false,
    "noImplicitReturns": false,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### 4.4 Zod Schemas (src/lib/schemas.ts)

```typescript
import { z } from 'zod';

// Register schema
export const RegisterSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  confirmPassword: z.string(),
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  apellidos: z.string().min(2, 'Los apellidos deben tener al menos 2 caracteres'),
  rut: z.string().regex(/^\d{7,8}-[\dkK]$/, 'Formato de RUT inválido (ej: 12345678-9)'),
  telefono: z.string().optional(),
  region_id: z.number().int().positive().optional(),
}).refine(
  (data) => data.password === data.confirmPassword,
  {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  }
);

export type RegisterFormData = z.infer<typeof RegisterSchema>;

// Login schema
export const LoginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});

export type LoginFormData = z.infer<typeof LoginSchema>;

// Application schema
export const ApplicationSchema = z.object({
  job_id: z.number().int().positive(),
  cover_letter: z.string()
    .min(50, 'La carta de presentación debe tener al menos 50 caracteres')
    .max(2000, 'La carta de presentación no puede exceder 2000 caracteres')
    .optional(),
});

export type ApplicationFormData = z.infer<typeof ApplicationSchema>;

// Job filters schema
export const JobFiltersSchema = z.object({
  page: z.number().int().positive().optional(),
  per_page: z.number().int().positive().max(100).optional(),
  category_id: z.number().int().positive().optional(),
  region_id: z.number().int().positive().optional(),
  search: z.string().optional(),
});

export type JobFiltersData = z.infer<typeof JobFiltersSchema>;
```

### 4.5 API Client (src/lib/api.ts)

```typescript
import axios from 'axios';
import type { AuthResponse, JobListResponse, JobWithCompany, JobApplication } from '@/types';
import type { RegisterFormData, LoginFormData, ApplicationFormData, JobFiltersData } from './schemas';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api',
  withCredentials: true,
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authApi = {
  register: async (data: RegisterFormData): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/register', data);
    return response.data;
  },

  login: async (data: LoginFormData): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/login', data);
    return response.data;
  },

  me: async (): Promise<AuthResponse['user']> => {
    const response = await api.get<AuthResponse['user']>('/auth/me');
    return response.data;
  },
};

export const jobsApi = {
  list: async (filters: JobFiltersData = {}): Promise<JobListResponse> => {
    const response = await api.get<JobListResponse>('/jobs', { params: filters });
    return response.data;
  },

  get: async (id: number): Promise<JobWithCompany> => {
    const response = await api.get<JobWithCompany>(`/jobs/${id}`);
    return response.data;
  },
};

export const applicationsApi = {
  create: async (data: ApplicationFormData): Promise<JobApplication> => {
    const response = await api.post<JobApplication>('/applications', data);
    return response.data;
  },

  myApplications: async (): Promise<JobApplication[]> => {
    const response = await api.get<JobApplication[]>('/applications/my');
    return response.data;
  },
};
```

### 4.6 Key Pages

**src/app/page.tsx (Job Listing)**:
```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { jobsApi } from '@/lib/api';
import { JobCard } from '@/components/JobCard';
import { JobFilters } from '@/components/JobFilters';
import type { JobFiltersData } from '@/lib/schemas';

export default function HomePage() {
  const [filters, setFilters] = useState<JobFiltersData>({ page: 1, per_page: 20 });

  const { data, isLoading, error } = useQuery({
    queryKey: ['jobs', filters],
    queryFn: () => jobsApi.list(filters),
  });

  if (isLoading) return <div>Cargando ofertas...</div>;
  if (error) return <div>Error al cargar ofertas</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8">Ofertas Laborales Inclusivas</h1>

      <JobFilters filters={filters} onChange={setFilters} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
        {data?.jobs.map((job) => (
          <JobCard key={job.id} job={job} />
        ))}
      </div>

      {data && data.total_pages > 1 && (
        <div className="mt-8 flex justify-center gap-2">
          {Array.from({ length: data.total_pages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => setFilters({ ...filters, page })}
              className={`px-4 py-2 rounded ${
                page === filters.page ? 'bg-blue-600 text-white' : 'bg-gray-200'
              }`}
            >
              {page}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

**src/app/register/page.tsx**:
```typescript
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { RegisterSchema, type RegisterFormData } from '@/lib/schemas';
import { authApi } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();

  const { register, handleSubmit, formState: { errors } } = useForm<RegisterFormData>({
    resolver: zodResolver(RegisterSchema),
  });

  const registerMutation = useMutation({
    mutationFn: authApi.register,
    onSuccess: (data) => {
      localStorage.setItem('auth_token', data.token);
      router.push('/');
    },
  });

  const onSubmit = (data: RegisterFormData) => {
    registerMutation.mutate(data);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-md">
      <h1 className="text-3xl font-bold mb-6">Registrarse</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block mb-2">Email</label>
          <input
            type="email"
            {...register('email')}
            className="w-full px-4 py-2 border rounded"
          />
          {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
        </div>

        <div>
          <label className="block mb-2">Contraseña</label>
          <input
            type="password"
            {...register('password')}
            className="w-full px-4 py-2 border rounded"
          />
          {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>}
        </div>

        <div>
          <label className="block mb-2">Confirmar Contraseña</label>
          <input
            type="password"
            {...register('confirmPassword')}
            className="w-full px-4 py-2 border rounded"
          />
          {errors.confirmPassword && <p className="text-red-500 text-sm mt-1">{errors.confirmPassword.message}</p>}
        </div>

        <div>
          <label className="block mb-2">Nombre</label>
          <input
            {...register('nombre')}
            className="w-full px-4 py-2 border rounded"
          />
          {errors.nombre && <p className="text-red-500 text-sm mt-1">{errors.nombre.message}</p>}
        </div>

        <div>
          <label className="block mb-2">Apellidos</label>
          <input
            {...register('apellidos')}
            className="w-full px-4 py-2 border rounded"
          />
          {errors.apellidos && <p className="text-red-500 text-sm mt-1">{errors.apellidos.message}</p>}
        </div>

        <div>
          <label className="block mb-2">RUT</label>
          <input
            {...register('rut')}
            placeholder="12345678-9"
            className="w-full px-4 py-2 border rounded"
          />
          {errors.rut && <p className="text-red-500 text-sm mt-1">{errors.rut.message}</p>}
        </div>

        <button
          type="submit"
          disabled={registerMutation.isPending}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {registerMutation.isPending ? 'Registrando...' : 'Registrarse'}
        </button>

        {registerMutation.isError && (
          <p className="text-red-500 text-sm">Error al registrarse. Intenta nuevamente.</p>
        )}
      </form>
    </div>
  );
}
```

---

## 5. Implementation Roadmap

### Phase 1: Backend Foundation (Day 1-2)
- [ ] Create Rust project with Axum
- [ ] Set up database connection (sqlx)
- [ ] Create migration files (7 tables + indexes)
- [ ] Run migrations and seed data
- [ ] Define models with ts-rs exports
- [ ] Generate TypeScript types (`cargo test`)

### Phase 2: Backend API (Day 2-3)
- [ ] Implement JWT utilities (sign, verify)
- [ ] Implement password hashing (bcrypt)
- [ ] Create auth handlers (register, login, me)
- [ ] Create job handlers (list, get)
- [ ] Create application handlers (create, my_applications)
- [ ] Add CORS middleware
- [ ] Test all endpoints with curl/Postman

### Phase 3: Frontend Foundation (Day 3-4)
- [ ] Create Next.js project
- [ ] Configure TypeScript (strict + Zod-friendly)
- [ ] Set up Tailwind CSS
- [ ] Install dependencies (React Query, Zod, React Hook Form)
- [ ] Copy generated TypeScript types from backend
- [ ] Create Zod schemas
- [ ] Create API client with axios

### Phase 4: Frontend Pages (Day 4-5)
- [ ] Create job listing page (SSR + filtering)
- [ ] Create job detail page (SSR)
- [ ] Create register page (form + validation)
- [ ] Create login page (form + validation)
- [ ] Create application form component
- [ ] Add auth context/state management

### Phase 5: Integration & Testing (Day 5-6)
- [ ] Test complete user flow (browse → register → login → apply)
- [ ] Verify type safety end-to-end
- [ ] Test form validations (Zod)
- [ ] Test error handling
- [ ] Add loading states
- [ ] Verify JWT authentication

### Phase 6: Polish & Documentation (Day 6-7)
- [ ] Add proper error messages
- [ ] Improve UI/UX (loading, empty states)
- [ ] Write README with setup instructions
- [ ] Document API endpoints
- [ ] Create development workflow guide
- [ ] Performance check (bundle size, query performance)

---

## 6. Success Criteria

### 6.1 Functional Requirements
✅ User can browse job listings without authentication
✅ User can filter jobs by category, region, search term
✅ User can view detailed job information
✅ User can register with email validation
✅ User can login with credentials
✅ Authenticated user can apply to jobs
✅ User can view their applications

### 6.2 Technical Requirements
✅ All types generated from Rust → TypeScript (ts-rs)
✅ All forms validated with Zod
✅ Zero TypeScript compilation errors
✅ Zero runtime type errors
✅ JWT authentication working
✅ Database queries optimized (indexes used)
✅ API responses < 200ms for list queries
✅ Frontend bundle size < 500KB (gzipped)

### 6.3 Developer Experience
✅ Type changes in Rust auto-reflect in TypeScript
✅ Zod validation errors are clear and helpful
✅ Hot reload works for both backend and frontend
✅ LLM can generate new features using established patterns
✅ No manual type synchronization needed

---

## 7. Development Workflow

### 7.1 Initial Setup

```bash
# Backend
cd backend
cargo build
cargo sqlx database create
cargo sqlx migrate run
cargo test # Generate TypeScript types

# Frontend
cd ../frontend
npm install
npm run type-gen # Copy types from backend
npm run dev
```

### 7.2 Daily Development

Terminal 1 (Backend):
```bash
cd backend
cargo watch -x run
```

Terminal 2 (Frontend):
```bash
cd frontend
npm run dev
```

Terminal 3 (Type Generation - when models change):
```bash
cd backend
cargo test --lib -- tests::generate_types --exact --nocapture
```

### 7.3 Type Sync Workflow

1. Modify Rust model in `src/models/*.rs`
2. Run `cargo test` to regenerate TypeScript types
3. Frontend automatically picks up new types
4. Update Zod schemas if validation logic changed
5. TypeScript compiler catches any breaking changes

---

## 8. Next Steps After PoC

If PoC validates the tech stack:

1. **Expand Schema**: Add remaining tables from full database
2. **Add Features**: Company profiles, admin panel, CV upload, etc.
3. **Deployment**: Set up Docker, CI/CD pipeline
4. **Monitoring**: Add logging, metrics, error tracking
5. **Performance**: Optimize queries, add caching (Redis)
6. **Security**: Add rate limiting, input sanitization, CSP headers
7. **Full Migration**: Migrate remaining Laravel functionality

---

## 9. Estimated Effort

**Total Time**: 5-7 days for one developer

- Backend: 2-3 days
- Frontend: 2-3 days
- Integration & Testing: 1 day
- Polish: 1 day

**Lines of Code Estimate**:
- Backend Rust: ~1,500 lines
- Frontend TypeScript: ~2,000 lines
- Total: ~3,500 lines (excluding dependencies)

---

## 10. Risk Assessment

### Low Risk
✅ Database schema is well-defined
✅ Technologies are mature and stable
✅ Type generation is proven (ts-rs)

### Medium Risk
⚠️ Learning curve for team (Rust + Next.js)
⚠️ Migration complexity for full application

### Mitigation
- PoC validates feasibility before full commitment
- Documentation and examples reduce learning curve
- Incremental migration reduces risk

---

## 11. Authentication Implementation Details

### 11.1 Token Strategy

**Approach**: JWT (JSON Web Tokens) with access tokens only (no refresh tokens for PoC)

**Storage**:
- **For PoC**: localStorage (simpler, faster iteration)
- **For Production**: httpOnly cookies (more secure, prevents XSS)

**Token Payload**:
```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,        // User ID
    pub email: String,      // User email
    pub user_type: String,  // 'usuario', 'empresa', 'admin'
    pub exp: usize,         // Expiration timestamp
    pub iat: usize,         // Issued at timestamp
}
```

### 11.2 Backend Authentication Implementation

**JWT Utilities (src/utils/jwt.rs)**:
```rust
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use chrono::{Duration, Utc};

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub email: String,
    pub user_type: String,
    pub exp: usize,
    pub iat: usize,
}

pub fn create_jwt(user_id: i32, email: &str, user_type: &str) -> Result<String, jsonwebtoken::errors::Error> {
    let secret = std::env::var("JWT_SECRET").expect("JWT_SECRET must be set");
    let expiration = Utc::now()
        .checked_add_signed(Duration::hours(24))
        .expect("valid timestamp")
        .timestamp();

    let claims = Claims {
        sub: user_id.to_string(),
        email: email.to_string(),
        user_type: user_type.to_string(),
        exp: expiration as usize,
        iat: Utc::now().timestamp() as usize,
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_ref()),
    )
}

pub fn verify_jwt(token: &str) -> Result<Claims, jsonwebtoken::errors::Error> {
    let secret = std::env::var("JWT_SECRET").expect("JWT_SECRET must be set");

    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_ref()),
        &Validation::default(),
    )?;

    Ok(token_data.claims)
}
```

**Auth Middleware (src/middleware/auth.rs)**:
```rust
use axum::{
    extract::{Request, State},
    http::{StatusCode, header},
    middleware::Next,
    response::Response,
};
use crate::utils::jwt;

// Extension type to pass authenticated user to handlers
#[derive(Clone)]
pub struct AuthUser {
    pub id: i32,
    pub email: String,
    pub user_type: String,
}

pub async fn require_auth(
    mut request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let auth_header = request
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|header| header.to_str().ok());

    let token = match auth_header {
        Some(header) if header.starts_with("Bearer ") => {
            header.trim_start_matches("Bearer ")
        }
        _ => return Err(StatusCode::UNAUTHORIZED),
    };

    match jwt::verify_jwt(token) {
        Ok(claims) => {
            let user_id: i32 = claims.sub.parse().map_err(|_| StatusCode::UNAUTHORIZED)?;

            // Insert authenticated user into request extensions
            request.extensions_mut().insert(AuthUser {
                id: user_id,
                email: claims.email,
                user_type: claims.user_type,
            });

            Ok(next.run(request).await)
        }
        Err(_) => Err(StatusCode::UNAUTHORIZED),
    }
}
```

**Protected Route Example**:
```rust
use axum::{Extension, Json};

// This handler requires authentication
pub async fn create_application(
    Extension(user): Extension<AuthUser>,  // Injected by middleware
    State(state): State<AppState>,
    Json(payload): Json<CreateApplicationRequest>,
) -> Result<Json<JobApplication>, StatusCode> {
    // user.id is guaranteed to be valid here
    let application = sqlx::query_as!(
        JobApplication,
        "INSERT INTO job_applications (job_id, user_id, cover_letter, status)
         VALUES ($1, $2, $3, 'pending')
         RETURNING *",
        payload.job_id,
        user.id,  // Use authenticated user's ID
        payload.cover_letter
    )
    .fetch_one(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(application))
}
```

**Router Setup with Middleware**:
```rust
use axum::{
    middleware,
    routing::{get, post},
    Router,
};

let app = Router::new()
    // Public routes
    .route("/api/jobs", get(handlers::jobs::list_jobs))
    .route("/api/jobs/:id", get(handlers::jobs::get_job))
    .route("/api/auth/register", post(handlers::auth::register))
    .route("/api/auth/login", post(handlers::auth::login))

    // Protected routes (require auth middleware)
    .route("/api/applications", post(handlers::applications::create_application))
    .route("/api/applications/my", get(handlers::applications::my_applications))
    .route("/api/auth/me", get(handlers::auth::me))
    .layer(middleware::from_fn(middleware::auth::require_auth))

    .with_state(app_state);
```

### 11.3 Frontend Authentication Implementation

**Auth Context (src/contexts/AuthContext.tsx)**:
```typescript
'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi } from '@/lib/api';
import type { User, AuthResponse } from '@/types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load user from token on mount
    const token = localStorage.getItem('auth_token');
    if (token) {
      authApi.me()
        .then(setUser)
        .catch(() => {
          localStorage.removeItem('auth_token');
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const response: AuthResponse = await authApi.login({ email, password });
    localStorage.setItem('auth_token', response.token);
    setUser(response.user);
  };

  const register = async (data: any) => {
    const response: AuthResponse = await authApi.register(data);
    localStorage.setItem('auth_token', response.token);
    setUser(response.user);
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      isAuthenticated: !!user,
      login,
      register,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
```

**Protected Route Component (src/components/ProtectedRoute.tsx)**:
```typescript
'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return <div>Cargando...</div>;
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
```

**Usage in Protected Page**:
```typescript
// src/app/my-applications/page.tsx
'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';

export default function MyApplicationsPage() {
  const { user } = useAuth();

  return (
    <ProtectedRoute>
      <div>
        <h1>Mis Postulaciones</h1>
        <p>Bienvenido, {user?.nombre}</p>
        {/* Application list */}
      </div>
    </ProtectedRoute>
  );
}
```

### 11.4 Auth Flow Diagram

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │
       │ 1. POST /api/auth/register
       │    { email, password, nombre, ... }
       ↓
┌─────────────────────┐
│  Axum Backend       │
│                     │
│  1. Validate data   │
│  2. Hash password   │──────┐
│  3. Insert user     │      │ bcrypt::hash()
│  4. Generate JWT    │←─────┘
│                     │
│  5. Return:         │
│     { user, token } │
└──────┬──────────────┘
       │
       │ 2. Store token in localStorage
       │    Set user in AuthContext
       ↓
┌─────────────┐
│   Browser   │
│             │
│ - Logged in │
│ - Can apply │
└──────┬──────┘
       │
       │ 3. POST /api/applications
       │    Header: Authorization: Bearer <token>
       ↓
┌─────────────────────┐
│  Axum Backend       │
│                     │
│  1. Verify JWT      │──────┐
│  2. Extract user_id │      │ middleware::auth
│  3. Create app      │←─────┘
└─────────────────────┘
```

---

## 12. Testing Strategy

### 12.1 Testing Philosophy

**Test Pyramid for PoC**:
- **E2E Tests (User Perspective)**: 5-10 critical user flows
- **API Integration Tests**: 10-15 endpoint tests
- **Unit Tests**: Minimal (validators, utilities)

Focus on **high-level user flows** that validate the stack works end-to-end.

### 12.2 Backend API Tests (Rust)

**Setup (tests/common/mod.rs)**:
```rust
use sqlx::PgPool;

pub async fn setup_test_db() -> PgPool {
    let database_url = std::env::var("TEST_DATABASE_URL")
        .expect("TEST_DATABASE_URL must be set");

    let pool = PgPool::connect(&database_url).await.unwrap();

    // Run migrations
    sqlx::migrate!("./migrations").run(&pool).await.unwrap();

    // Clear all data
    sqlx::query!("TRUNCATE users, companies, jobs, job_applications, sessions CASCADE")
        .execute(&pool)
        .await
        .unwrap();

    pool
}

pub async fn create_test_user(pool: &PgPool) -> i32 {
    sqlx::query_scalar!(
        "INSERT INTO users (email, password_hash, nombre, apellidos, rut, user_type, status)
         VALUES ('test@example.com', '$2b$12$hash', 'Test', 'User', '12345678-9', 'usuario', 'T')
         RETURNING id"
    )
    .fetch_one(pool)
    .await
    .unwrap()
}
```

**Integration Test Example (tests/auth_test.rs)**:
```rust
use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use tower::ServiceExt; // for `oneshot`
use serde_json::json;

mod common;

#[tokio::test]
async fn test_register_login_flow() {
    let pool = common::setup_test_db().await;
    let app = create_app(pool);

    // 1. Register new user
    let register_payload = json!({
        "email": "newuser@example.com",
        "password": "SecurePass123",
        "nombre": "New",
        "apellidos": "User",
        "rut": "11111111-1"
    });

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/register")
                .header("content-type", "application/json")
                .body(Body::from(serde_json::to_string(&register_payload).unwrap()))
                .unwrap()
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = hyper::body::to_bytes(response.into_body()).await.unwrap();
    let auth_response: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert!(auth_response["token"].is_string());
    assert_eq!(auth_response["user"]["email"], "newuser@example.com");

    // 2. Login with same credentials
    let login_payload = json!({
        "email": "newuser@example.com",
        "password": "SecurePass123"
    });

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/login")
                .header("content-type", "application/json")
                .body(Body::from(serde_json::to_string(&login_payload).unwrap()))
                .unwrap()
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn test_protected_route_requires_auth() {
    let pool = common::setup_test_db().await;
    let app = create_app(pool);

    // Try to access protected route without token
    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/applications/my")
                .body(Body::empty())
                .unwrap()
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}
```

**Job Listing Test (tests/jobs_test.rs)**:
```rust
#[tokio::test]
async fn test_list_jobs_with_filters() {
    let pool = common::setup_test_db().await;

    // Seed data
    let company_id = common::create_test_company(&pool).await;
    common::create_test_job(&pool, company_id, "Backend Developer", 1).await;
    common::create_test_job(&pool, company_id, "Frontend Developer", 2).await;

    let app = create_app(pool);

    // Test: List all jobs
    let response = app
        .clone()
        .oneshot(Request::builder().uri("/api/jobs").body(Body::empty()).unwrap())
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = hyper::body::to_bytes(response.into_body()).await.unwrap();
    let job_list: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(job_list["total"], 2);
    assert_eq!(job_list["jobs"].as_array().unwrap().len(), 2);

    // Test: Filter by category
    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/jobs?category_id=1")
                .body(Body::empty())
                .unwrap()
        )
        .await
        .unwrap();

    let body = hyper::body::to_bytes(response.into_body()).await.unwrap();
    let job_list: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(job_list["total"], 1);
}
```

**Run tests**: `cargo test --test '*'`

### 12.3 Frontend E2E Tests (Playwright)

**Setup**:
```bash
cd frontend
npm install -D @playwright/test
npx playwright install
```

**Config (playwright.config.ts)**:
```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
});
```

**E2E Test: Complete User Flow (e2e/user-flow.spec.ts)**:
```typescript
import { test, expect } from '@playwright/test';

test.describe('Job Application Flow', () => {
  test('user can browse, register, login, and apply to job', async ({ page }) => {
    // 1. Browse jobs (public)
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Ofertas Laborales');

    const jobCards = page.locator('[data-testid="job-card"]');
    await expect(jobCards).toHaveCount(2); // Assuming 2 seed jobs

    // 2. Click on first job
    await jobCards.first().click();
    await expect(page).toHaveURL(/\/jobs\/\d+/);
    await expect(page.locator('h1')).toContainText('Desarrollador'); // Job title

    // 3. Try to apply (should redirect to login)
    await page.click('text=Postular');
    await expect(page).toHaveURL('/login');

    // 4. Go to register page
    await page.click('text=Registrarse');
    await expect(page).toHaveURL('/register');

    // 5. Fill registration form
    const timestamp = Date.now();
    await page.fill('input[name="email"]', `testuser${timestamp}@example.com`);
    await page.fill('input[name="password"]', 'SecurePassword123');
    await page.fill('input[name="confirmPassword"]', 'SecurePassword123');
    await page.fill('input[name="nombre"]', 'Test');
    await page.fill('input[name="apellidos"]', 'User');
    await page.fill('input[name="rut"]', '12345678-9');

    // 6. Submit registration
    await page.click('button[type="submit"]');

    // Should redirect to home after registration
    await expect(page).toHaveURL('/');

    // Should see user name in header
    await expect(page.locator('text=Test User')).toBeVisible();

    // 7. Go back to job and apply
    await page.goto('/jobs/1');
    await page.click('text=Postular');

    // 8. Fill application form
    await page.fill('textarea[name="cover_letter"]',
      'Me gustaría postular a esta posición porque tengo las habilidades necesarias y estoy muy motivado para trabajar en su empresa.');

    await page.click('button:has-text("Enviar Postulación")');

    // 9. Should see success message
    await expect(page.locator('text=Postulación enviada')).toBeVisible();

    // 10. View my applications
    await page.goto('/my-applications');
    await expect(page.locator('[data-testid="application-card"]')).toHaveCount(1);
  });

  test('registration form validates inputs', async ({ page }) => {
    await page.goto('/register');

    // Submit empty form
    await page.click('button[type="submit"]');

    // Should show validation errors
    await expect(page.locator('text=Email inválido')).toBeVisible();
    await expect(page.locator('text=La contraseña debe tener al menos 8 caracteres')).toBeVisible();

    // Test password mismatch
    await page.fill('input[name="password"]', 'Password123');
    await page.fill('input[name="confirmPassword"]', 'DifferentPassword');
    await page.click('button[type="submit"]');

    await expect(page.locator('text=Las contraseñas no coinciden')).toBeVisible();

    // Test invalid RUT format
    await page.fill('input[name="rut"]', 'invalid-rut');
    await page.blur('input[name="rut"]');
    await expect(page.locator('text=Formato de RUT inválido')).toBeVisible();
  });

  test('job filtering works', async ({ page }) => {
    await page.goto('/');

    // Filter by category
    await page.selectOption('select[name="category_id"]', '1');
    await page.waitForResponse(/\/api\/jobs/);

    // Should show filtered results
    const jobCards = page.locator('[data-testid="job-card"]');
    const count = await jobCards.count();
    expect(count).toBeGreaterThan(0);

    // Search by keyword
    await page.fill('input[name="search"]', 'desarrollador');
    await page.waitForResponse(/\/api\/jobs/);

    await expect(jobCards.first()).toContainText('Desarrollador', { ignoreCase: true });
  });

  test('cannot apply to same job twice', async ({ page, context }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[name="email"]', 'existing@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Apply to job
    await page.goto('/jobs/1');
    await page.click('text=Postular');
    await page.fill('textarea[name="cover_letter"]', 'First application');
    await page.click('button:has-text("Enviar")');

    // Try to apply again
    await page.goto('/jobs/1');
    await expect(page.locator('text=Ya has postulado')).toBeVisible();
    await expect(page.locator('button:has-text("Postular")')).toBeDisabled();
  });
});
```

**Run E2E tests**: `npm run test:e2e`

### 12.4 Test Data Management

**Backend Test Helpers (tests/common/mod.rs)**:
```rust
pub async fn seed_test_data(pool: &PgPool) {
    // Insert regions
    sqlx::query!("INSERT INTO regions (nombre, codigo) VALUES ('RM', 'RM'), ('V', 'V')")
        .execute(pool).await.unwrap();

    // Insert categories
    sqlx::query!("INSERT INTO job_categories (nombre) VALUES ('Tecnología'), ('Ventas')")
        .execute(pool).await.unwrap();

    // Insert company
    let company_id = sqlx::query_scalar!(
        "INSERT INTO companies (razon_social, rut, email, status)
         VALUES ('Test Company', '76123456-7', 'company@test.com', 'T')
         RETURNING id"
    ).fetch_one(pool).await.unwrap();

    // Insert jobs
    sqlx::query!(
        "INSERT INTO jobs (company_id, category_id, region_id, title, description, status, published_at)
         VALUES ($1, 1, 1, 'Backend Developer', 'Great job', 'T', NOW()),
                ($1, 1, 1, 'Frontend Developer', 'Another great job', 'T', NOW())",
        company_id
    ).execute(pool).await.unwrap();
}
```

### 12.5 Testing Checklist

**Backend Tests** (`cargo test`):
- [ ] User registration with validation
- [ ] User login with correct/incorrect credentials
- [ ] JWT generation and verification
- [ ] Protected routes reject unauthenticated requests
- [ ] Job listing with pagination
- [ ] Job filtering by category, region, search
- [ ] Job application creation
- [ ] Cannot apply twice to same job
- [ ] User can list their applications

**Frontend E2E Tests** (`npm run test:e2e`):
- [ ] Browse jobs without login
- [ ] Filter jobs by category/region
- [ ] Search jobs by keyword
- [ ] Register new user with validation
- [ ] Login with credentials
- [ ] View job details
- [ ] Apply to job when authenticated
- [ ] View my applications
- [ ] Cannot apply twice to same job
- [ ] Logout and session cleared

### 12.6 Running All Tests

**Complete test script (test-all.sh)**:
```bash
#!/bin/bash
set -e

echo "🧪 Running Backend Tests..."
cd backend
cargo test --test '*'

echo ""
echo "🌐 Running Frontend E2E Tests..."
cd ../frontend
npm run test:e2e

echo ""
echo "✅ All tests passed!"
```

Make executable: `chmod +x test-all.sh`
Run: `./test-all.sh`

---

## Conclusion

This PoC provides a complete, production-ready vertical slice that tests every aspect of the proposed tech stack. Success here confirms the architecture is sound for the full migration.

**Ready to implement?** Start with Phase 1 and work sequentially through the roadmap.
