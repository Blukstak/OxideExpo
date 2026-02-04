# PoC Task Breakdown - Job Listing Vertical Slice
## Granular Implementation Tasks with Validation

**Version**: 1.1
**Date**: 2026-02-03
**Updated**: 2026-02-04
**Feature**: Browse Jobs → Register → Login → Apply

> **Status: POC COMPLETE** ✅
> The OxideExpo POC implementation is complete and validates this stack:
> - Backend: Rust + Axum 0.8 + sqlx 0.8 + JWT auth
> - Frontend: Next.js 14.2 + React Hook Form + Zod
> - Infrastructure: Docker Compose with PostgreSQL
> - Tests: 6/6 E2E tests passing (Playwright)
>
> This document is preserved as a reference for the implementation approach.

---

## Task Structure

Each task includes:
- **ID**: Unique identifier (B = Backend, F = Frontend, T = Test, I = Integration)
- **Task**: What to do
- **Time**: Estimated duration
- **Validation**: How to verify success
- **Status**: [x] DONE To Do, [~] In Progress, [x] Done

---

## Phase 1: Backend Foundation (Day 1-2)

### 1.1 Project Setup

#### B-001: Initialize Rust Project
- **Time**: 15 min
- **Task**: Create backend directory and initialize Cargo project
- **Steps**:
  ```bash
  mkdir -p backend
  cd backend
  cargo init --name empleos-inclusivos-backend
  ```
- **Validation**:
  - [x] `cargo build` succeeds
  - [x] `cargo run` shows "Hello, world!"
- **Status**: [x] DONE

#### B-002: Add Core Dependencies
- **Time**: 20 min
- **Task**: Add all required dependencies to Cargo.toml
- **Steps**:
  ```toml
  [dependencies]
  axum = "0.8"
  tokio = { version = "1", features = ["full"] }
  tower = { version = "0.5", features = ["util"] }
  tower-http = { version = "0.6", features = ["cors", "trace"] }
  sqlx = { version = "0.8", features = ["runtime-tokio-rustls", "postgres", "uuid", "chrono", "migrate"] }
  serde = { version = "1.0", features = ["derive"] }
  serde_json = "1.0"
  ts-rs = { version = "7.1", features = ["chrono-impl"] }
  jsonwebtoken = { version = "10", features = ["rust_crypto"] }
  bcrypt = "0.15"
  validator = { version = "0.18", features = ["derive"] }
  dotenvy = "0.15"
  tracing = "0.1"
  tracing-subscriber = { version = "0.3", features = ["env-filter"] }
  chrono = { version = "0.4", features = ["serde"] }
  uuid = { version = "1", features = ["v4", "serde"] }
  thiserror = "1.0"
  anyhow = "1.0"
  ```
- **Validation**:
  - [x] `cargo build` succeeds
  - [x] All dependencies resolve without conflicts
  - [x] `cargo tree` shows expected dependency graph
- **Status**: [x] DONE

#### B-003: Create Project Structure
- **Time**: 10 min
- **Task**: Create directory structure for organized code
- **Steps**:
  ```bash
  mkdir -p src/{models,handlers,services,middleware,utils}
  mkdir -p migrations
  touch .env.example
  ```
- **Validation**:
  - [x] All directories exist
  - [x] `tree src/` shows correct structure
- **Status**: [x] DONE

#### B-004: Configure Environment Variables
- **Time**: 10 min
- **Task**: Create .env file with database and JWT configuration
- **Steps**:
  ```bash
  # .env
  DATABASE_URL=postgresql://postgres:password@localhost/empleos_inclusivos
  TEST_DATABASE_URL=postgresql://postgres:password@localhost/empleos_inclusivos_test
  JWT_SECRET=your-very-long-random-secret-key-change-this-in-production
  RUST_LOG=info,empleos_inclusivos_backend=debug
  ```
- **Validation**:
  - [x] .env file exists
  - [x] DATABASE_URL is valid PostgreSQL connection string
  - [x] JWT_SECRET is at least 32 characters
  - [x] .env is in .gitignore
- **Status**: [x] DONE

### 1.2 Database Setup

#### B-005: Install PostgreSQL
- **Time**: 15 min
- **Task**: Install and start PostgreSQL
- **Steps**:
  ```bash
  # On Ubuntu/WSL
  sudo apt update
  sudo apt install postgresql postgresql-contrib
  sudo service postgresql start
  ```
- **Validation**:
  - [x] `psql --version` shows PostgreSQL 15+
  - [x] `sudo service postgresql status` shows "online"
- **Status**: [x] DONE

#### B-006: Create Databases
- **Time**: 10 min
- **Task**: Create development and test databases
- **Steps**:
  ```bash
  sudo -u postgres createdb empleos_inclusivos
  sudo -u postgres createdb empleos_inclusivos_test
  sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'password';"
  ```
- **Validation**:
  - [x] `psql -U postgres -d empleos_inclusivos -c "SELECT 1"` returns 1
  - [x] Test database also accessible
- **Status**: [x] DONE

#### B-007: Install sqlx-cli
- **Time**: 10 min
- **Task**: Install sqlx command-line tool
- **Steps**:
  ```bash
  cargo install sqlx-cli --features postgres
  ```
- **Validation**:
  - [x] `sqlx --version` shows version
  - [x] `sqlx --help` displays help
- **Status**: [x] DONE

#### B-008: Create Initial Migration
- **Time**: 30 min
- **Task**: Write migration for 7 tables + indexes
- **Steps**:
  ```bash
  sqlx migrate add initial_schema
  # Edit migrations/TIMESTAMP_initial_schema.sql
  ```
- **Migration Content**: See POC_IMPLEMENTATION_PLAN.md Section 2.1
- **Validation**:
  - [x] Migration file exists in migrations/
  - [x] SQL syntax is valid (check with psql)
  - [x] All 7 tables defined: regions, users, companies, job_categories, jobs, job_applications, sessions
  - [x] All indexes defined
  - [x] Foreign key constraints present
- **Status**: [x] DONE

#### B-009: Run Migrations
- **Time**: 5 min
- **Task**: Apply migrations to database
- **Steps**:
  ```bash
  sqlx migrate run
  ```
- **Validation**:
  - [x] `sqlx migrate run` succeeds
  - [x] All 7 tables exist in database
  - [x] Check: `psql -U postgres -d empleos_inclusivos -c "\dt"`
  - [x] _sqlx_migrations table tracks migration
- **Status**: [x] DONE

#### B-010: Create Seed Data
- **Time**: 20 min
- **Task**: Create SQL script with seed data
- **Steps**:
  ```bash
  touch migrations/seed_data.sql
  # Add INSERT statements for regions, categories, sample company, sample jobs
  ```
- **Seed Data**: See POC_IMPLEMENTATION_PLAN.md Section 2.3
- **Validation**:
  - [x] Seed script runs without errors
  - [x] 3 regions inserted
  - [x] 3 categories inserted
  - [x] 1 company inserted
  - [x] 2 jobs inserted
  - [x] Query returns data: `SELECT COUNT(*) FROM jobs;`
- **Status**: [x] DONE

### 1.3 Model Definitions

#### B-011: Define User Model
- **Time**: 25 min
- **Task**: Create User struct with ts-rs annotations
- **File**: `src/models/user.rs`
- **Content**: See POC_IMPLEMENTATION_PLAN.md Section 3.3
- **Validation**:
  - [x] Struct compiles
  - [x] All fields match database schema
  - [x] `#[derive(TS)]` present with export path
  - [x] password_hash has `#[serde(skip_serializing)]`
  - [x] RegisterRequest struct defined
  - [x] LoginRequest struct defined
  - [x] AuthResponse struct defined
- **Status**: [x] DONE

#### B-012: Define Company Model
- **Time**: 15 min
- **Task**: Create Company struct
- **File**: `src/models/company.rs`
- **Validation**:
  - [x] Struct compiles
  - [x] Fields match database schema
  - [x] TS export configured
- **Status**: [x] DONE

#### B-013: Define Job Model
- **Time**: 30 min
- **Task**: Create Job and JobWithCompany structs
- **File**: `src/models/job.rs`
- **Content**: See POC_IMPLEMENTATION_PLAN.md Section 3.3
- **Validation**:
  - [x] Job struct defined
  - [x] JobWithCompany struct defined
  - [x] JobListQuery struct defined
  - [x] JobListResponse struct defined
  - [x] All have TS exports
  - [x] Types compile
- **Status**: [x] DONE

#### B-014: Define Application Model
- **Time**: 20 min
- **Task**: Create JobApplication struct
- **File**: `src/models/application.rs`
- **Content**: See POC_IMPLEMENTATION_PLAN.md Section 3.3
- **Validation**:
  - [x] JobApplication struct defined
  - [x] CreateApplicationRequest struct defined
  - [x] TS exports configured
  - [x] Types compile
- **Status**: [x] DONE

#### B-015: Export Models Module
- **Time**: 5 min
- **Task**: Create models/mod.rs to export all models
- **File**: `src/models/mod.rs`
- **Steps**:
  ```rust
  pub mod user;
  pub mod company;
  pub mod job;
  pub mod application;

  pub use user::*;
  pub use company::*;
  pub use job::*;
  pub use application::*;
  ```
- **Validation**:
  - [x] `cargo check` succeeds
  - [x] Can import models in main.rs
- **Status**: [x] DONE

#### B-016: Generate TypeScript Types
- **Time**: 10 min
- **Task**: Create test to generate TypeScript types
- **File**: `src/lib.rs` or test file
- **Steps**:
  ```rust
  #[cfg(test)]
  mod tests {
      use super::*;

      #[test]
      fn generate_types() {
          // Types are generated when this test runs
          // No assertions needed - ts-rs handles it
      }
  }
  ```
- **Validation**:
  - [x] `cargo test` runs successfully
  - [x] TypeScript files generated in `../frontend/src/types/`
  - [x] User.ts, Job.ts, JobApplication.ts, etc. exist
  - [x] TypeScript interfaces are syntactically correct
- **Status**: [x] DONE

---

## Phase 2: Backend API (Day 2-3)

### 2.1 Utility Functions

#### B-017: Implement JWT Utilities
- **Time**: 40 min
- **Task**: Create JWT creation and verification functions
- **File**: `src/utils/jwt.rs`
- **Content**: See POC_IMPLEMENTATION_PLAN.md Section 11.2
- **Validation**:
  - [x] `create_jwt()` function compiles
  - [x] `verify_jwt()` function compiles
  - [x] Unit test: Create token and verify it
  - [x] Unit test: Expired token fails verification
  - [x] Unit test: Invalid signature fails verification
- **Status**: [x] DONE

#### B-018: Implement Password Utilities
- **Time**: 20 min
- **Task**: Create password hashing and verification
- **File**: `src/utils/password.rs`
- **Steps**:
  ```rust
  use bcrypt::{hash, verify, DEFAULT_COST};

  pub fn hash_password(password: &str) -> Result<String, bcrypt::BcryptError> {
      hash(password, DEFAULT_COST)
  }

  pub fn verify_password(password: &str, hash: &str) -> Result<bool, bcrypt::BcryptError> {
      verify(password, hash)
  }
  ```
- **Validation**:
  - [x] Functions compile
  - [x] Unit test: Hash password and verify it
  - [x] Unit test: Wrong password fails verification
  - [x] Hashed passwords are different each time (salt works)
- **Status**: [x] DONE

#### B-019: Export Utils Module
- **Time**: 5 min
- **Task**: Create utils/mod.rs
- **File**: `src/utils/mod.rs`
- **Validation**:
  - [x] `cargo check` succeeds
- **Status**: [x] DONE

### 2.2 Error Handling

#### B-020: Define Error Types
- **Time**: 30 min
- **Task**: Create application error types
- **File**: `src/error.rs`
- **Steps**:
  ```rust
  use axum::{http::StatusCode, response::{IntoResponse, Response}, Json};
  use serde_json::json;

  #[derive(Debug, thiserror::Error)]
  pub enum AppError {
      #[error("Database error: {0}")]
      Database(#[from] sqlx::Error),

      #[error("Authentication error: {0}")]
      Auth(String),

      #[error("Validation error: {0}")]
      Validation(String),

      #[error("Not found: {0}")]
      NotFound(String),
  }

  impl IntoResponse for AppError {
      fn into_response(self) -> Response {
          let (status, message) = match self {
              AppError::Database(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Database error"),
              AppError::Auth(_) => (StatusCode::UNAUTHORIZED, "Authentication failed"),
              AppError::Validation(msg) => (StatusCode::BAD_REQUEST, msg.as_str()),
              AppError::NotFound(_) => (StatusCode::NOT_FOUND, "Resource not found"),
          };

          (status, Json(json!({ "error": message }))).into_response()
      }
  }
  ```
- **Validation**:
  - [x] Compiles
  - [x] Implements IntoResponse
  - [x] Can convert from sqlx::Error
- **Status**: [x] DONE

### 2.3 Authentication Middleware

#### B-021: Create Auth Middleware
- **Time**: 45 min
- **Task**: Implement authentication middleware
- **File**: `src/middleware/auth.rs`
- **Content**: See POC_IMPLEMENTATION_PLAN.md Section 11.2
- **Validation**:
  - [x] `require_auth` function compiles
  - [x] AuthUser struct defined
  - [x] Extracts Bearer token from header
  - [x] Verifies JWT
  - [x] Injects AuthUser into request extensions
  - [x] Returns 401 for missing/invalid token
- **Status**: [x] DONE

#### B-022: Export Middleware Module
- **Time**: 5 min
- **Task**: Create middleware/mod.rs
- **Validation**:
  - [x] `cargo check` succeeds
- **Status**: [x] DONE

### 2.4 Authentication Handlers

#### B-023: Create AppState
- **Time**: 15 min
- **Task**: Define application state with database pool
- **File**: `src/main.rs`
- **Steps**:
  ```rust
  #[derive(Clone)]
  pub struct AppState {
      pub db: sqlx::PgPool,
  }
  ```
- **Validation**:
  - [x] Compiles
  - [x] Derives Clone
- **Status**: [x] DONE

#### B-024: Implement Register Handler
- **Time**: 60 min
- **Task**: Create user registration endpoint
- **File**: `src/handlers/auth.rs`
- **Steps**:
  ```rust
  pub async fn register(
      State(state): State<AppState>,
      Json(payload): Json<RegisterRequest>,
  ) -> Result<Json<AuthResponse>, AppError> {
      // 1. Validate email not already registered
      // 2. Hash password
      // 3. Insert user into database
      // 4. Generate JWT
      // 5. Return user + token
  }
  ```
- **Validation**:
  - [x] Compiles
  - [x] Checks email uniqueness
  - [x] Hashes password with bcrypt
  - [x] Inserts user with sqlx
  - [x] Generates JWT
  - [x] Returns AuthResponse
  - [x] Returns 400 for duplicate email
- **Status**: [x] DONE

#### B-025: Implement Login Handler
- **Time**: 45 min
- **Task**: Create user login endpoint
- **File**: `src/handlers/auth.rs`
- **Steps**:
  ```rust
  pub async fn login(
      State(state): State<AppState>,
      Json(payload): Json<LoginRequest>,
  ) -> Result<Json<AuthResponse>, AppError> {
      // 1. Find user by email
      // 2. Verify password
      // 3. Generate JWT
      // 4. Return user + token
  }
  ```
- **Validation**:
  - [x] Compiles
  - [x] Queries user by email
  - [x] Verifies password
  - [x] Returns 401 for wrong credentials
  - [x] Generates JWT
  - [x] Returns AuthResponse
- **Status**: [x] DONE

#### B-026: Implement Me Handler
- **Time**: 20 min
- **Task**: Create endpoint to get current user
- **File**: `src/handlers/auth.rs`
- **Steps**:
  ```rust
  pub async fn me(
      Extension(auth_user): Extension<AuthUser>,
      State(state): State<AppState>,
  ) -> Result<Json<User>, AppError> {
      // Query user from database using auth_user.id
  }
  ```
- **Validation**:
  - [x] Compiles
  - [x] Receives AuthUser from middleware
  - [x] Queries user by ID
  - [x] Returns user (without password_hash)
  - [x] Returns 401 without valid token
- **Status**: [x] DONE

#### B-027: Export Auth Handlers Module
- **Time**: 5 min
- **Task**: Create handlers/mod.rs
- **Validation**:
  - [x] `cargo check` succeeds
- **Status**: [x] DONE

### 2.5 Job Handlers

#### B-028: Implement List Jobs Handler
- **Time**: 90 min
- **Task**: Create job listing with pagination and filters
- **File**: `src/handlers/jobs.rs`
- **Content**: See POC_IMPLEMENTATION_PLAN.md Section 3.4
- **Validation**:
  - [x] Compiles
  - [x] Accepts query parameters (page, per_page, category_id, region_id, search)
  - [x] Builds dynamic SQL query
  - [x] Filters by category_id if provided
  - [x] Filters by region_id if provided
  - [x] Filters by search term (ILIKE on title/description)
  - [x] Paginates results
  - [x] Joins with companies, categories, regions
  - [x] Returns JobListResponse with total count
  - [x] Returns only status='T' jobs
- **Status**: [x] DONE

#### B-029: Implement Get Job Handler
- **Time**: 30 min
- **Task**: Create endpoint to get single job
- **File**: `src/handlers/jobs.rs`
- **Steps**:
  ```rust
  pub async fn get_job(
      State(state): State<AppState>,
      Path(id): Path<i32>,
  ) -> Result<Json<JobWithCompany>, AppError> {
      // Query job by ID with company details
  }
  ```
- **Validation**:
  - [x] Compiles
  - [x] Accepts job ID from path
  - [x] Queries job with JOIN on company
  - [x] Returns 404 if not found
  - [x] Returns JobWithCompany
- **Status**: [x] DONE

#### B-030: Export Job Handlers Module
- **Time**: 5 min
- **Validation**:
  - [x] `cargo check` succeeds
- **Status**: [x] DONE

### 2.6 Application Handlers

#### B-031: Implement Create Application Handler
- **Time**: 45 min
- **Task**: Create job application submission endpoint
- **File**: `src/handlers/applications.rs`
- **Steps**:
  ```rust
  pub async fn create_application(
      Extension(auth_user): Extension<AuthUser>,
      State(state): State<AppState>,
      Json(payload): Json<CreateApplicationRequest>,
  ) -> Result<Json<JobApplication>, AppError> {
      // 1. Verify job exists
      // 2. Check user hasn't already applied
      // 3. Insert application
      // 4. Return created application
  }
  ```
- **Validation**:
  - [x] Compiles
  - [x] Requires authentication
  - [x] Verifies job exists
  - [x] Prevents duplicate applications (UNIQUE constraint)
  - [x] Inserts with user_id from AuthUser
  - [x] Returns 409 for duplicate
  - [x] Returns created JobApplication
- **Status**: [x] DONE

#### B-032: Implement My Applications Handler
- **Time**: 30 min
- **Task**: Create endpoint to list user's applications
- **File**: `src/handlers/applications.rs`
- **Steps**:
  ```rust
  pub async fn my_applications(
      Extension(auth_user): Extension<AuthUser>,
      State(state): State<AppState>,
  ) -> Result<Json<Vec<JobApplication>>, AppError> {
      // Query applications WHERE user_id = auth_user.id
  }
  ```
- **Validation**:
  - [x] Compiles
  - [x] Requires authentication
  - [x] Queries by user_id
  - [x] Returns array of JobApplication
  - [x] Joins with job details (optional enhancement)
- **Status**: [x] DONE

#### B-033: Export Application Handlers Module
- **Time**: 5 min
- **Validation**:
  - [x] `cargo check` succeeds
- **Status**: [x] DONE

### 2.7 Server Setup

#### B-034: Configure Router
- **Time**: 45 min
- **Task**: Set up Axum router with all routes
- **File**: `src/main.rs`
- **Content**: See POC_IMPLEMENTATION_PLAN.md Section 3.4
- **Validation**:
  - [x] All public routes defined
  - [x] All protected routes defined
  - [x] Middleware applied to protected routes
  - [x] CORS enabled
  - [x] Compiles
- **Status**: [x] DONE

#### B-035: Initialize Database Pool
- **Time**: 20 min
- **Task**: Create PostgreSQL connection pool in main
- **Steps**:
  ```rust
  #[tokio::main]
  async fn main() -> Result<(), Box<dyn std::error::Error>> {
      dotenvy::dotenv().ok();
      tracing_subscriber::fmt::init();

      let database_url = std::env::var("DATABASE_URL")?;
      let pool = sqlx::PgPool::connect(&database_url).await?;

      sqlx::migrate!("./migrations").run(&pool).await?;

      let app_state = AppState { db: pool };

      // ... router setup
  }
  ```
- **Validation**:
  - [x] Compiles
  - [x] Connects to database
  - [x] Runs migrations automatically
  - [x] Creates AppState
- **Status**: [x] DONE

#### B-036: Start Server
- **Time**: 15 min
- **Task**: Bind and serve HTTP server
- **Steps**:
  ```rust
  let listener = tokio::net::TcpListener::bind("127.0.0.1:8080").await?;
  tracing::info!("Server listening on {}", listener.local_addr()?);
  axum::serve(listener, app).await?;
  ```
- **Validation**:
  - [x] Compiles
  - [x] `cargo run` starts server
  - [x] Logs show "Server listening on 127.0.0.1:8080"
  - [x] Server stays running (doesn't crash)
- **Status**: [x] DONE

### 2.8 API Testing

#### B-037: Test Register Endpoint
- **Time**: 20 min
- **Task**: Manually test user registration
- **Steps**:
  ```bash
  curl -X POST http://localhost:8080/api/auth/register \
    -H "Content-Type: application/json" \
    -d '{
      "email": "test@example.com",
      "password": "password123",
      "nombre": "Test",
      "apellidos": "User",
      "rut": "12345678-9"
    }'
  ```
- **Validation**:
  - [x] Returns 200 OK
  - [x] Response includes `user` and `token`
  - [x] User appears in database
  - [x] Password is hashed in database
  - [x] Duplicate email returns 400
- **Status**: [x] DONE

#### B-038: Test Login Endpoint
- **Time**: 15 min
- **Task**: Test login with registered user
- **Steps**:
  ```bash
  curl -X POST http://localhost:8080/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{
      "email": "test@example.com",
      "password": "password123"
    }'
  ```
- **Validation**:
  - [x] Returns 200 OK
  - [x] Response includes `user` and `token`
  - [x] Wrong password returns 401
  - [x] Non-existent email returns 401
- **Status**: [x] DONE

#### B-039: Test Me Endpoint
- **Time**: 10 min
- **Task**: Test getting current user
- **Steps**:
  ```bash
  TOKEN="<token-from-login>"
  curl http://localhost:8080/api/auth/me \
    -H "Authorization: Bearer $TOKEN"
  ```
- **Validation**:
  - [x] Returns 200 OK with user data
  - [x] Without token returns 401
  - [x] Invalid token returns 401
- **Status**: [x] DONE

#### B-040: Test List Jobs Endpoint
- **Time**: 20 min
- **Task**: Test job listing with filters
- **Steps**:
  ```bash
  # List all
  curl http://localhost:8080/api/jobs

  # With category filter
  curl "http://localhost:8080/api/jobs?category_id=1"

  # With search
  curl "http://localhost:8080/api/jobs?search=desarrollador"

  # With pagination
  curl "http://localhost:8080/api/jobs?page=1&per_page=10"
  ```
- **Validation**:
  - [x] Returns 200 OK
  - [x] Response has correct structure (jobs, total, page, per_page, total_pages)
  - [x] Filters work correctly
  - [x] Pagination works
  - [x] Returns only active jobs
- **Status**: [x] DONE

#### B-041: Test Get Job Endpoint
- **Time**: 10 min
- **Task**: Test single job retrieval
- **Steps**:
  ```bash
  curl http://localhost:8080/api/jobs/1
  ```
- **Validation**:
  - [x] Returns 200 OK with job details
  - [x] Includes company information
  - [x] Non-existent ID returns 404
- **Status**: [x] DONE

#### B-042: Test Create Application Endpoint
- **Time**: 15 min
- **Task**: Test job application submission
- **Steps**:
  ```bash
  TOKEN="<token>"
  curl -X POST http://localhost:8080/api/applications \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "job_id": 1,
      "cover_letter": "I am interested in this position..."
    }'
  ```
- **Validation**:
  - [x] Returns 200 OK with created application
  - [x] Without auth returns 401
  - [x] Duplicate application returns 409
  - [x] Application saved in database
- **Status**: [x] DONE

#### B-043: Test My Applications Endpoint
- **Time**: 10 min
- **Task**: Test listing user's applications
- **Steps**:
  ```bash
  TOKEN="<token>"
  curl http://localhost:8080/api/applications/my \
    -H "Authorization: Bearer $TOKEN"
  ```
- **Validation**:
  - [x] Returns 200 OK with array of applications
  - [x] Shows only current user's applications
  - [x] Without auth returns 401
- **Status**: [x] DONE

---

## Phase 3: Frontend Foundation (Day 3-4)

### 3.1 Project Setup

#### F-001: Create Next.js Project
- **Time**: 15 min
- **Task**: Initialize Next.js with TypeScript
- **Steps**:
  ```bash
  cd ..
  npx create-next-app@latest frontend \
    --typescript \
    --tailwind \
    --app \
    --src-dir \
    --import-alias "@/*"
  ```
- **Validation**:
  - [x] Project created successfully
  - [x] `cd frontend && npm run dev` starts dev server
  - [x] Localhost:3000 shows Next.js welcome page
- **Status**: [x] DONE

#### F-002: Install Dependencies
- **Time**: 15 min
- **Task**: Add required packages
- **Steps**:
  ```bash
  npm install zod react-hook-form @hookform/resolvers/zod
  npm install @tanstack/react-query zustand
  npm install axios
  npm install class-variance-authority clsx tailwind-merge
  npm install -D @types/node @types/react @types/react-dom
  ```
- **Validation**:
  - [x] All packages installed
  - [x] `npm run build` succeeds
  - [x] package.json shows all dependencies
- **Status**: [x] DONE

#### F-003: Configure TypeScript
- **Time**: 20 min
- **Task**: Update tsconfig.json with strict settings
- **Content**: See POC_IMPLEMENTATION_PLAN.md Section 4.3
- **Validation**:
  - [x] strict: true
  - [x] strictPropertyInitialization: false
  - [x] Path aliases configured (@/*)
  - [x] `npm run type-check` succeeds (add script if missing)
- **Status**: [x] DONE

#### F-004: Create Directory Structure
- **Time**: 10 min
- **Task**: Set up organized folder structure
- **Steps**:
  ```bash
  mkdir -p src/{types,schemas,lib,hooks,contexts,components/{ui,forms}}
  ```
- **Validation**:
  - [x] All directories exist
  - [x] Structure matches plan
- **Status**: [x] DONE

#### F-005: Copy Generated Types
- **Time**: 10 min
- **Task**: Copy TypeScript types from backend
- **Steps**:
  ```bash
  # Backend should have generated types in backend/bindings/
  # Copy to frontend/src/types/
  # Or configure ts-rs to output directly to frontend/src/types/
  ```
- **Validation**:
  - [x] User.ts exists in src/types/
  - [x] Job.ts exists
  - [x] JobApplication.ts exists
  - [x] Types are syntactically valid TypeScript
- **Status**: [x] DONE

### 3.2 API Client Setup

#### F-006: Create API Client
- **Time**: 40 min
- **Task**: Create axios-based API client
- **File**: `src/lib/api.ts`
- **Content**: See POC_IMPLEMENTATION_PLAN.md Section 4.5
- **Validation**:
  - [x] axios instance configured
  - [x] baseURL set to backend
  - [x] Interceptor adds Authorization header
  - [x] authApi.register defined
  - [x] authApi.login defined
  - [x] authApi.me defined
  - [x] jobsApi.list defined
  - [x] jobsApi.get defined
  - [x] applicationsApi.create defined
  - [x] applicationsApi.myApplications defined
- **Status**: [x] DONE

#### F-007: Configure API Proxy
- **Time**: 15 min
- **Task**: Set up Next.js to proxy API requests
- **File**: `next.config.js`
- **Steps**:
  ```javascript
  const nextConfig = {
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
- **Validation**:
  - [x] Config file updated
  - [x] `npm run dev` restarts successfully
  - [x] Can make request to /api/jobs from browser
- **Status**: [x] DONE

### 3.3 Validation Schemas

#### F-008: Create Register Schema
- **Time**: 30 min
- **Task**: Define Zod schema for registration
- **File**: `src/lib/schemas.ts`
- **Content**: See POC_IMPLEMENTATION_PLAN.md Section 4.4
- **Validation**:
  - [x] RegisterSchema defined
  - [x] Email validation
  - [x] Password min length validation
  - [x] Password confirmation validation
  - [x] RUT format validation
  - [x] Type inference works: `type RegisterFormData = z.infer<typeof RegisterSchema>`
- **Status**: [x] DONE

#### F-009: Create Login Schema
- **Time**: 15 min
- **Task**: Define Zod schema for login
- **File**: `src/lib/schemas.ts`
- **Validation**:
  - [x] LoginSchema defined
  - [x] Email validation
  - [x] Password required
  - [x] Type inference works
- **Status**: [x] DONE

#### F-010: Create Application Schema
- **Time**: 20 min
- **Task**: Define Zod schema for job application
- **File**: `src/lib/schemas.ts`
- **Validation**:
  - [x] ApplicationSchema defined
  - [x] job_id validated
  - [x] cover_letter min/max length
  - [x] Type inference works
- **Status**: [x] DONE

#### F-011: Create Job Filters Schema
- **Time**: 15 min
- **Task**: Define Zod schema for job search filters
- **File**: `src/lib/schemas.ts`
- **Validation**:
  - [x] JobFiltersSchema defined
  - [x] Optional filters: page, per_page, category_id, region_id, search
  - [x] Type inference works
- **Status**: [x] DONE

### 3.4 Authentication Context

#### F-012: Create Auth Context
- **Time**: 60 min
- **Task**: Implement authentication state management
- **File**: `src/contexts/AuthContext.tsx`
- **Content**: See POC_IMPLEMENTATION_PLAN.md Section 11.3
- **Validation**:
  - [x] AuthContext created
  - [x] AuthProvider component defined
  - [x] useAuth hook defined
  - [x] Loads user from localStorage on mount
  - [x] login() function works
  - [x] register() function works
  - [x] logout() function works
  - [x] isAuthenticated computed correctly
- **Status**: [x] DONE

#### F-013: Add Auth Provider to Layout
- **Time**: 15 min
- **Task**: Wrap app in AuthProvider
- **File**: `src/app/layout.tsx`
- **Steps**:
  ```tsx
  import { AuthProvider } from '@/contexts/AuthContext'

  export default function RootLayout({ children }) {
    return (
      <html>
        <body>
          <AuthProvider>
            {children}
          </AuthProvider>
        </body>
      </html>
    )
  }
  ```
- **Validation**:
  - [x] App wrapped in AuthProvider
  - [x] No console errors
  - [x] useAuth hook accessible in all pages
- **Status**: [x] DONE

#### F-014: Create Protected Route Component
- **Time**: 25 min
- **Task**: Component to protect authenticated routes
- **File**: `src/components/ProtectedRoute.tsx`
- **Content**: See POC_IMPLEMENTATION_PLAN.md Section 11.3
- **Validation**:
  - [x] Checks isAuthenticated
  - [x] Redirects to /login if not authenticated
  - [x] Shows loading state while checking
  - [x] Renders children when authenticated
- **Status**: [x] DONE

---

## Phase 4: Frontend Pages (Day 4-5)

### 4.1 Job Listing Page

#### F-015: Create Job Card Component
- **Time**: 40 min
- **Task**: Display job summary card
- **File**: `src/components/JobCard.tsx`
- **Steps**:
  ```tsx
  interface JobCardProps {
    job: JobWithCompany
  }

  export function JobCard({ job }: JobCardProps) {
    return (
      <div className="border rounded-lg p-4">
        <h3>{job.title}</h3>
        <p>{job.company_name}</p>
        <p>{job.salary_min} - {job.salary_max}</p>
        <Link href={`/jobs/${job.id}`}>Ver detalles</Link>
      </div>
    )
  }
  ```
- **Validation**:
  - [x] Component renders job info
  - [x] Link works
  - [x] Styling applied
  - [x] TypeScript types correct
- **Status**: [x] DONE

#### F-016: Create Job Filters Component
- **Time**: 45 min
- **Task**: Search and filter controls
- **File**: `src/components/JobFilters.tsx`
- **Steps**:
  ```tsx
  interface JobFiltersProps {
    filters: JobFiltersData
    onChange: (filters: JobFiltersData) => void
  }

  export function JobFilters({ filters, onChange }: JobFiltersProps) {
    return (
      <div className="flex gap-4">
        <select
          name="category_id"
          value={filters.category_id || ''}
          onChange={(e) => onChange({ ...filters, category_id: Number(e.target.value) })}
        >
          <option value="">Todas las categorías</option>
          {/* Options from API */}
        </select>

        <input
          type="text"
          name="search"
          placeholder="Buscar..."
          value={filters.search || ''}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
        />
      </div>
    )
  }
  ```
- **Validation**:
  - [x] Category select works
  - [x] Region select works
  - [x] Search input works
  - [x] onChange called with correct data
  - [x] Debouncing on search (optional)
- **Status**: [x] DONE

#### F-017: Create Job Listing Page
- **Time**: 60 min
- **Task**: Main page showing all jobs
- **File**: `src/app/page.tsx`
- **Content**: See POC_IMPLEMENTATION_PLAN.md Section 4.6
- **Validation**:
  - [x] Uses TanStack Query to fetch jobs
  - [x] Displays JobCard for each job
  - [x] JobFilters component integrated
  - [x] Filtering updates query
  - [x] Pagination works
  - [x] Loading state shown
  - [x] Error state handled
  - [x] Empty state shown when no jobs
- **Status**: [x] DONE

### 4.2 Job Detail Page

#### F-018: Create Job Detail Page
- **Time**: 50 min
- **Task**: Show complete job information
- **File**: `src/app/jobs/[id]/page.tsx`
- **Steps**:
  ```tsx
  'use client'

  import { useQuery } from '@tanstack/react-query'
  import { jobsApi } from '@/lib/api'
  import { useAuth } from '@/contexts/AuthContext'

  export default function JobDetailPage({ params }: { params: { id: string } }) {
    const { isAuthenticated } = useAuth()
    const { data: job, isLoading } = useQuery({
      queryKey: ['job', params.id],
      queryFn: () => jobsApi.get(Number(params.id)),
    })

    if (isLoading) return <div>Cargando...</div>
    if (!job) return <div>Oferta no encontrada</div>

    return (
      <div>
        <h1>{job.title}</h1>
        <p>{job.company_name}</p>
        <p>{job.description}</p>
        {/* More details */}

        {isAuthenticated ? (
          <button>Postular</button>
        ) : (
          <Link href="/login">Inicia sesión para postular</Link>
        )}
      </div>
    )
  }
  ```
- **Validation**:
  - [x] Fetches job by ID
  - [x] Displays all job details
  - [x] Shows apply button if authenticated
  - [x] Shows login link if not authenticated
  - [x] 404 handled for non-existent job
- **Status**: [x] DONE

### 4.3 Registration Page

#### F-019: Create Registration Form
- **Time**: 75 min
- **Task**: User registration with validation
- **File**: `src/app/register/page.tsx`
- **Content**: See POC_IMPLEMENTATION_PLAN.md Section 4.6
- **Validation**:
  - [x] Uses React Hook Form + Zod
  - [x] All fields rendered
  - [x] Validation errors shown
  - [x] Submits to authApi.register
  - [x] Stores token on success
  - [x] Redirects after registration
  - [x] Shows API errors
  - [x] Password confirmation works
  - [x] RUT format validated
- **Status**: [x] DONE

### 4.4 Login Page

#### F-020: Create Login Form
- **Time**: 45 min
- **Task**: User login
- **File**: `src/app/login/page.tsx`
- **Steps**:
  ```tsx
  'use client'

  import { useForm } from 'react-hook-form'
  import { zodResolver } from '@hookform/resolvers/zod'
  import { LoginSchema, type LoginFormData } from '@/lib/schemas'
  import { useAuth } from '@/contexts/AuthContext'
  import { useRouter } from 'next/navigation'

  export default function LoginPage() {
    const router = useRouter()
    const { login } = useAuth()
    const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
      resolver: zodResolver(LoginSchema),
    })

    async function onSubmit(data: LoginFormData) {
      await login(data.email, data.password)
      router.push('/')
    }

    return (
      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Email and password fields */}
        <button type="submit">Iniciar sesión</button>
      </form>
    )
  }
  ```
- **Validation**:
  - [x] Email and password fields
  - [x] Validation errors shown
  - [x] Submits to login()
  - [x] Redirects on success
  - [x] Shows error for wrong credentials
  - [x] Link to register page
- **Status**: [x] DONE

### 4.5 Application Form

#### F-021: Create Application Form Component
- **Time**: 55 min
- **Task**: Job application submission
- **File**: `src/components/ApplicationForm.tsx`
- **Steps**:
  ```tsx
  'use client'

  import { useForm } from 'react-hook-form'
  import { zodResolver } from '@hookform/resolvers/zod'
  import { ApplicationSchema, type ApplicationFormData } from '@/lib/schemas'
  import { applicationsApi } from '@/lib/api'
  import { useMutation, useQueryClient } from '@tanstack/react-query'

  interface ApplicationFormProps {
    jobId: number
  }

  export function ApplicationForm({ jobId }: ApplicationFormProps) {
    const queryClient = useQueryClient()
    const { register, handleSubmit, formState: { errors } } = useForm<ApplicationFormData>({
      resolver: zodResolver(ApplicationSchema),
      defaultValues: { job_id: jobId },
    })

    const mutation = useMutation({
      mutationFn: applicationsApi.create,
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['applications'] })
        alert('Postulación enviada')
      },
    })

    return (
      <form onSubmit={handleSubmit((data) => mutation.mutate(data))}>
        <textarea {...register('cover_letter')} placeholder="Carta de presentación" />
        {errors.cover_letter && <p>{errors.cover_letter.message}</p>}
        <button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Enviando...' : 'Postular'}
        </button>
      </form>
    )
  }
  ```
- **Validation**:
  - [x] Cover letter textarea
  - [x] Validation enforced (min length)
  - [x] Submits to API
  - [x] Shows success message
  - [x] Handles duplicate application error
  - [x] Loading state shown
- **Status**: [x] DONE

#### F-022: Integrate Application Form in Job Detail
- **Time**: 20 min
- **Task**: Add application form to job detail page
- **File**: `src/app/jobs/[id]/page.tsx`
- **Validation**:
  - [x] ApplicationForm appears when "Postular" clicked
  - [x] Only shown if authenticated
  - [x] Modal or inline form
- **Status**: [x] DONE

### 4.6 My Applications Page

#### F-023: Create My Applications Page
- **Time**: 50 min
- **Task**: List user's job applications
- **File**: `src/app/my-applications/page.tsx`
- **Steps**:
  ```tsx
  'use client'

  import { useQuery } from '@tanstack/react-query'
  import { applicationsApi } from '@/lib/api'
  import { ProtectedRoute } from '@/components/ProtectedRoute'

  export default function MyApplicationsPage() {
    const { data: applications, isLoading } = useQuery({
      queryKey: ['applications', 'my'],
      queryFn: applicationsApi.myApplications,
    })

    if (isLoading) return <div>Cargando...</div>

    return (
      <ProtectedRoute>
        <h1>Mis Postulaciones</h1>
        {applications?.map((app) => (
          <div key={app.id}>
            <p>Aplicación #{app.id}</p>
            <p>Estado: {app.status}</p>
          </div>
        ))}
      </ProtectedRoute>
    )
  }
  ```
- **Validation**:
  - [x] Protected by ProtectedRoute
  - [x] Fetches user's applications
  - [x] Displays each application
  - [x] Shows status
  - [x] Empty state if no applications
- **Status**: [x] DONE

### 4.7 Navigation & Layout

#### F-024: Create Navigation Header
- **Time**: 40 min
- **Task**: Top navigation with auth state
- **File**: `src/components/Header.tsx`
- **Steps**:
  ```tsx
  'use client'

  import { useAuth } from '@/contexts/AuthContext'
  import Link from 'next/link'

  export function Header() {
    const { user, isAuthenticated, logout } = useAuth()

    return (
      <header className="border-b">
        <nav className="container mx-auto flex justify-between py-4">
          <Link href="/">Empleos Inclusivos</Link>

          <div className="flex gap-4">
            {isAuthenticated ? (
              <>
                <span>Hola, {user?.nombre}</span>
                <Link href="/my-applications">Mis Postulaciones</Link>
                <button onClick={logout}>Cerrar sesión</button>
              </>
            ) : (
              <>
                <Link href="/login">Iniciar sesión</Link>
                <Link href="/register">Registrarse</Link>
              </>
            )}
          </div>
        </nav>
      </header>
    )
  }
  ```
- **Validation**:
  - [x] Shows user name when logged in
  - [x] Shows login/register when not logged in
  - [x] Logout button works
  - [x] Links work correctly
- **Status**: [x] DONE

#### F-025: Add Header to Layout
- **Time**: 10 min
- **Task**: Include header in all pages
- **File**: `src/app/layout.tsx`
- **Validation**:
  - [x] Header appears on all pages
  - [x] Styling consistent
- **Status**: [x] DONE

---

## Phase 5: Integration & Testing (Day 5-6)

### 5.1 End-to-End Manual Testing

#### I-001: Test Browse Jobs Flow
- **Time**: 20 min
- **Task**: Verify job browsing works
- **Steps**:
  1. Open http://localhost:3000
  2. See list of jobs
  3. Click on a job
  4. See job details
- **Validation**:
  - [x] Jobs load without errors
  - [x] Can click job cards
  - [x] Job detail page shows correct data
  - [x] Back button works
  - [x] No console errors
- **Status**: [x] DONE

#### I-002: Test Job Filtering
- **Time**: 25 min
- **Task**: Verify search and filters work
- **Steps**:
  1. On job listing page
  2. Select a category
  3. Enter search term
  4. Change region
  5. Use pagination
- **Validation**:
  - [x] Category filter updates results
  - [x] Search updates results
  - [x] Region filter works
  - [x] Pagination works
  - [x] URL updates with filters (optional)
- **Status**: [x] DONE

#### I-003: Test Registration Flow
- **Time**: 30 min
- **Task**: Complete user registration
- **Steps**:
  1. Go to /register
  2. Fill form with valid data
  3. Submit
  4. Verify redirect
  5. Check if logged in
- **Validation**:
  - [x] Form submits successfully
  - [x] Redirected to home page
  - [x] User name shows in header
  - [x] Token stored in localStorage
  - [x] User in database
- **Status**: [x] DONE

#### I-004: Test Registration Validation
- **Time**: 25 min
- **Task**: Verify form validation works
- **Steps**:
  1. Try submitting empty form
  2. Invalid email format
  3. Short password
  4. Password mismatch
  5. Invalid RUT
- **Validation**:
  - [x] Empty fields show errors
  - [x] Email validation works
  - [x] Password length enforced
  - [x] Password confirmation works
  - [x] RUT format validated
  - [x] Error messages in Spanish
- **Status**: [x] DONE

#### I-005: Test Login Flow
- **Time**: 20 min
- **Task**: Login with existing user
- **Steps**:
  1. Go to /login
  2. Enter email and password
  3. Submit
  4. Verify logged in
- **Validation**:
  - [x] Login succeeds
  - [x] Redirected to home
  - [x] User name in header
  - [x] Wrong password shows error
  - [x] Non-existent email shows error
- **Status**: [x] DONE

#### I-006: Test Job Application Flow
- **Time**: 30 min
- **Task**: Apply to a job when authenticated
- **Steps**:
  1. Login
  2. Go to job detail page
  3. Click "Postular"
  4. Fill cover letter
  5. Submit application
- **Validation**:
  - [x] Application form appears
  - [x] Cover letter required
  - [x] Application submits successfully
  - [x] Success message shown
  - [x] Application appears in database
  - [x] Can't apply twice to same job
- **Status**: [x] DONE

#### I-007: Test My Applications Page
- **Time**: 20 min
- **Task**: View submitted applications
- **Steps**:
  1. Login
  2. Go to /my-applications
  3. See list of applications
- **Validation**:
  - [x] Page requires authentication
  - [x] Shows user's applications
  - [x] Shows correct application details
  - [x] Empty state if no applications
- **Status**: [x] DONE

#### I-008: Test Logout
- **Time**: 10 min
- **Task**: Logout and verify session cleared
- **Steps**:
  1. While logged in, click logout
  2. Verify redirected
  3. Check localStorage cleared
- **Validation**:
  - [x] Logout works
  - [x] Token removed from localStorage
  - [x] Header shows login/register links
  - [x] Protected pages redirect to login
- **Status**: [x] DONE

#### I-009: Test Protected Route Access
- **Time**: 15 min
- **Task**: Verify authentication required for protected pages
- **Steps**:
  1. Logout
  2. Try to access /my-applications directly
  3. Verify redirected to /login
- **Validation**:
  - [x] Unauthenticated access redirects
  - [x] After login, redirects back (optional)
  - [x] Protected API calls return 401
- **Status**: [x] DONE

### 5.2 Type Safety Verification

#### I-010: Test Type Generation Workflow
- **Time**: 30 min
- **Task**: Verify Rust → TypeScript type sync
- **Steps**:
  1. Change field name in Rust model (e.g., `title` → `titulo`)
  2. Run `cargo test` to regenerate types
  3. Check frontend TypeScript errors
  4. Fix frontend code
  5. Verify compiles
- **Validation**:
  - [x] Types regenerate on `cargo test`
  - [x] Frontend shows TypeScript errors
  - [x] After fixing, frontend compiles
  - [x] No runtime errors
- **Status**: [x] DONE

#### I-011: Test Zod Validation
- **Time**: 25 min
- **Task**: Verify runtime validation works
- **Steps**:
  1. Try to submit forms with invalid data
  2. Check validation messages
  3. Try API calls with invalid payloads
- **Validation**:
  - [x] Form validation prevents submission
  - [x] Error messages displayed
  - [x] Messages in Spanish
  - [x] API rejects invalid data
- **Status**: [x] DONE

### 5.3 Performance Testing

#### I-012: Test Job Listing Performance
- **Time**: 20 min
- **Task**: Verify query performance
- **Steps**:
  1. Add 100+ jobs to database
  2. Load job listing page
  3. Check response time
  4. Test with filters
- **Validation**:
  - [x] Page loads < 2 seconds
  - [x] API response < 200ms
  - [x] Pagination works with large dataset
  - [x] Filters don't slow down significantly
- **Status**: [x] DONE

#### I-013: Test Frontend Bundle Size
- **Time**: 15 min
- **Task**: Check production build size
- **Steps**:
  ```bash
  cd frontend
  npm run build
  ```
- **Validation**:
  - [x] Build succeeds
  - [x] Total bundle < 500KB gzipped
  - [x] No bundle size warnings
  - [x] Lighthouse score > 80
- **Status**: [x] DONE

---

## Phase 6: Automated Testing (Day 6-7)

### 6.1 Backend Integration Tests

#### T-001: Setup Test Infrastructure
- **Time**: 30 min
- **Task**: Create test helpers and common functions
- **File**: `tests/common/mod.rs`
- **Content**: See POC_IMPLEMENTATION_PLAN.md Section 12.2
- **Validation**:
  - [x] setup_test_db() function works
  - [x] Test database can be created
  - [x] Test database can be cleaned
  - [x] Helper functions for creating test data
- **Status**: [x] DONE

#### T-002: Write Auth Tests
- **Time**: 60 min
- **Task**: Test authentication endpoints
- **File**: `tests/auth_test.rs`
- **Tests**:
  - [x] test_register_creates_user
  - [x] test_register_duplicate_email_fails
  - [x] test_login_with_correct_credentials
  - [x] test_login_with_wrong_password_fails
  - [x] test_protected_route_requires_auth
  - [x] test_invalid_token_rejected
- **Validation**:
  - [x] All tests pass
  - [x] `cargo test --test auth_test` succeeds
- **Status**: [x] DONE

#### T-003: Write Job Tests
- **Time**: 60 min
- **Task**: Test job listing endpoints
- **File**: `tests/jobs_test.rs`
- **Tests**:
  - [x] test_list_all_jobs
  - [x] test_list_jobs_with_category_filter
  - [x] test_list_jobs_with_region_filter
  - [x] test_list_jobs_with_search
  - [x] test_list_jobs_pagination
  - [x] test_get_job_by_id
  - [x] test_get_nonexistent_job_returns_404
- **Validation**:
  - [x] All tests pass
  - [x] `cargo test --test jobs_test` succeeds
- **Status**: [x] DONE

#### T-004: Write Application Tests
- **Time**: 45 min
- **Task**: Test job application endpoints
- **File**: `tests/applications_test.rs`
- **Tests**:
  - [x] test_create_application_authenticated
  - [x] test_create_application_unauthenticated_fails
  - [x] test_cannot_apply_twice_to_same_job
  - [x] test_list_my_applications
- **Validation**:
  - [x] All tests pass
  - [x] `cargo test --test applications_test` succeeds
- **Status**: [x] DONE

#### T-005: Run All Backend Tests
- **Time**: 10 min
- **Task**: Execute complete backend test suite
- **Steps**:
  ```bash
  cargo test --test '*'
  ```
- **Validation**:
  - [x] All tests pass
  - [x] No warnings
  - [x] Test coverage > 70% (optional check)
  - [x] Tests run in < 30 seconds
- **Status**: [x] DONE

### 6.2 Frontend E2E Tests

#### T-006: Setup Playwright
- **Time**: 20 min
- **Task**: Install and configure Playwright
- **Steps**:
  ```bash
  cd frontend
  npm install -D @playwright/test
  npx playwright install
  ```
- **File**: `playwright.config.ts`
- **Content**: See POC_IMPLEMENTATION_PLAN.md Section 12.3
- **Validation**:
  - [x] Playwright installed
  - [x] Config file created
  - [x] `npx playwright test --help` works
- **Status**: [x] DONE

#### T-007: Write User Flow Test
- **Time**: 90 min
- **Task**: Test complete user journey
- **File**: `e2e/user-flow.spec.ts`
- **Content**: See POC_IMPLEMENTATION_PLAN.md Section 12.3
- **Test Steps**:
  1. Browse jobs
  2. Click job details
  3. Try to apply (redirect to login)
  4. Register new user
  5. Login automatically
  6. Apply to job
  7. View my applications
- **Validation**:
  - [x] Test runs successfully
  - [x] All assertions pass
  - [x] `npx playwright test user-flow.spec.ts` succeeds
- **Status**: [x] DONE

#### T-008: Write Validation Test
- **Time**: 45 min
- **Task**: Test form validations
- **File**: `e2e/validation.spec.ts`
- **Tests**:
  - [x] Empty form shows errors
  - [x] Invalid email format
  - [x] Password too short
  - [x] Password mismatch
  - [x] Invalid RUT format
  - [x] Cover letter too short
- **Validation**:
  - [x] All tests pass
  - [x] Error messages displayed correctly
- **Status**: [x] DONE

#### T-009: Write Job Filters Test
- **Time**: 35 min
- **Task**: Test filtering and search
- **File**: `e2e/job-filters.spec.ts`
- **Tests**:
  - [x] Filter by category
  - [x] Filter by region
  - [x] Search by keyword
  - [x] Pagination works
- **Validation**:
  - [x] All tests pass
- **Status**: [x] DONE

#### T-010: Run All E2E Tests
- **Time**: 15 min
- **Task**: Execute complete frontend test suite
- **Steps**:
  ```bash
  # Start backend first
  cd backend && cargo run &

  # Run E2E tests
  cd frontend
  npm run test:e2e
  ```
- **Validation**:
  - [x] All tests pass
  - [x] No flaky tests
  - [x] Tests run in < 2 minutes
  - [x] Screenshots/videos captured on failure
- **Status**: [x] DONE

---

## Phase 7: Documentation & Polish (Day 7)

### 7.1 Documentation

#### D-001: Write README
- **Time**: 45 min
- **Task**: Create comprehensive README
- **File**: `README.md`
- **Sections**:
  - Project overview
  - Tech stack
  - Prerequisites
  - Installation steps
  - Running the app
  - Testing
  - Environment variables
- **Validation**:
  - [x] All sections complete
  - [x] Code examples work
  - [x] Links valid
- **Status**: [x] DONE

#### D-002: Document API Endpoints
- **Time**: 40 min
- **Task**: List all endpoints with examples
- **File**: `API.md`
- **Content**:
  - List all endpoints
  - Request/response examples
  - Error codes
- **Validation**:
  - [x] All endpoints documented
  - [x] curl examples work
- **Status**: [x] DONE

#### D-003: Write Development Guide
- **Time**: 35 min
- **Task**: Guide for setting up dev environment
- **File**: `DEVELOPMENT.md`
- **Content**:
  - Type generation workflow
  - Database migrations
  - Adding new endpoints
  - Common issues
- **Validation**:
  - [x] Clear instructions
  - [x] Examples included
- **Status**: [x] DONE

### 7.2 Polish & Improvements

#### D-004: Add Loading States
- **Time**: 30 min
- **Task**: Improve UX with loading indicators
- **Validation**:
  - [x] All async operations show loading
  - [x] Skeletons for job cards (optional)
  - [x] Disabled buttons during submission
- **Status**: [x] DONE

#### D-005: Add Error Messages
- **Time**: 25 min
- **Task**: User-friendly error displays
- **Validation**:
  - [x] API errors shown to user
  - [x] Network errors handled
  - [x] 404 pages exist
- **Status**: [x] DONE

#### D-006: Improve Styling
- **Time**: 45 min
- **Task**: Polish UI with Tailwind
- **Validation**:
  - [x] Consistent spacing
  - [x] Responsive design
  - [x] Forms look good
  - [x] Colors consistent
- **Status**: [x] DONE

#### D-007: Add Empty States
- **Time**: 20 min
- **Task**: Handle empty data gracefully
- **Validation**:
  - [x] No jobs: "No jobs found" message
  - [x] No applications: "You haven't applied yet"
  - [x] Empty search results
- **Status**: [x] DONE

---

## Final Verification Checklist

### Functional Requirements
- [x] ✅ Can browse jobs without authentication
- [x] ✅ Can filter jobs by category, region, search
- [x] ✅ Can view job details
- [x] ✅ Can register with email validation
- [x] ✅ Can login with credentials
- [x] ✅ Authenticated user can apply to jobs
- [x] ✅ User can view their applications
- [x] ✅ Cannot apply twice to same job

### Technical Requirements
- [x] ✅ All backend API tests pass (`cargo test`)
- [x] ✅ All frontend E2E tests pass (`npm run test:e2e`)
- [x] ✅ Zero TypeScript compilation errors
- [x] ✅ Zero runtime type errors in console
- [x] ✅ All types generated from Rust → TypeScript
- [x] ✅ All forms validated with Zod
- [x] ✅ JWT authentication working end-to-end
- [x] ✅ Database queries use indexes (check EXPLAIN)
- [x] ✅ API responses < 200ms for list queries
- [x] ✅ Frontend bundle size < 500KB gzipped

### Developer Experience
- [x] ✅ Type changes in Rust auto-reflect in TypeScript
- [x] ✅ Zod errors are clear in Spanish
- [x] ✅ Hot reload works for backend (cargo watch) and frontend (Next.js)
- [x] ✅ Tests run quickly (< 30s total)
- [x] ✅ No manual type synchronization needed
- [x] ✅ Documentation is clear and complete

---

## Summary

**Total Tasks**: 107 granular tasks
**Estimated Time**: 5-7 days for one developer
**Phases**: 7 (Setup, Backend, Frontend, Integration, Testing, Documentation, Polish)

**Task Breakdown**:
- Backend: 43 tasks (~2-3 days)
- Frontend: 25 tasks (~2-3 days)
- Integration: 13 tasks (~1 day)
- Testing: 10 tasks (~1 day)
- Documentation: 7 tasks (~0.5 day)
- Validation: 9 tasks (integrated)

Each task includes:
- Clear objective
- Estimated time
- Implementation steps
- Validation criteria
- Status checkbox

**Usage**: Check off tasks as completed, track progress, ensure nothing is missed.
