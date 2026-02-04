# OxideExpo - Empleos Inclusivos POC

A proof-of-concept full-stack job listing application with Rust (Axum) backend and Next.js frontend.

## Project Structure

```
OxideExpo/
├── backend/                    # Rust/Axum API server
│   ├── .devcontainer/          # Dev container configuration
│   ├── src/
│   │   ├── models/             # Data models with ts-rs exports
│   │   ├── handlers/           # API route handlers
│   │   ├── middleware/         # Auth middleware
│   │   ├── utils/              # JWT & password utilities
│   │   └── main.rs
│   ├── migrations/             # Database migrations
│   ├── Cargo.toml
│   └── Dockerfile.dev
├── frontend/                   # Next.js 14 web app
│   ├── .devcontainer/          # Dev container configuration
│   ├── src/
│   │   ├── app/                # Next.js pages (App Router)
│   │   ├── components/         # React components
│   │   ├── contexts/           # React contexts (Auth)
│   │   ├── lib/                # API client, schemas, utils
│   │   └── types/              # TypeScript types (auto-generated)
│   ├── package.json
│   └── Dockerfile.dev
└── docker-compose.yml          # Full-stack orchestration
```

## Features Implemented

### Backend (Rust + Axum)
- ✅ PostgreSQL database with SQLx
- ✅ JWT authentication with bcrypt password hashing
- ✅ RESTful API endpoints
- ✅ TypeScript type generation with ts-rs
- ✅ Database migrations with seed data
- ✅ CORS middleware
- ✅ Error handling

### Frontend (Next.js 14)
- ✅ Server-side rendering (SSR)
- ✅ React Hook Form + Zod validation
- ✅ TanStack Query for data fetching
- ✅ Auth context with JWT tokens
- ✅ Tailwind CSS styling
- ✅ Protected routes

### User Flow
1. 🌐 Browse job listings (public)
2. 🔍 View job details (public)
3. 📝 Register as job seeker
4. 🔐 Login with credentials
5. ✅ Apply to jobs (authenticated)
6. 📋 View my applications

## Quick Start

### Prerequisites
- Docker & Docker Compose
- WSL2 (for Windows users)
- VS Code with Dev Containers extension (optional)

### Option 1: Docker Compose (Full Stack)

```bash
# Start all services
cd OxideExpo
docker compose --profile full up -d

# View logs
docker compose logs -f

# Access points
# - Frontend: http://localhost:3000
# - Backend API: http://localhost:8080/api
# - Health check: http://localhost:8080/health
# - Database: localhost:5432 (postgres/postgres)

# Stop all services
docker compose down
```

### Option 2: Dev Containers (Individual Services)

**Backend Development:**
```bash
code backend/
# Then: Ctrl+Shift+P -> "Dev Containers: Reopen in Container"
# Inside container:
cargo run
```

**Frontend Development:**
```bash
code frontend/
# Then: Ctrl+Shift+P -> "Dev Containers: Reopen in Container"
# Inside container:
npm install
npm run dev
```

### Option 3: Local Development (Native)

**Backend:**
```bash
cd backend

# Start PostgreSQL (or use docker)
docker run -d \
  --name postgres-empleos \
  -e POSTGRES_DB=empleos_inclusivos \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  postgres:15-alpine

# Set up environment
cp .env.example .env
# Edit .env with your database URL

# Run migrations
cargo install sqlx-cli
sqlx database create
sqlx migrate run

# Start server
cargo run
```

**Frontend:**
```bash
cd frontend

# Install dependencies
npm install

# Generate TypeScript types from Rust
npm run type-gen

# Start development server
npm run dev
```

## API Endpoints

### Public Routes
- `GET /api/jobs` - List all jobs (with pagination & filters)
- `GET /api/jobs/:id` - Get job details
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Protected Routes (require JWT token)
- `GET /api/auth/me` - Get current user
- `POST /api/applications` - Apply to a job
- `GET /api/applications/my` - Get my applications

## Database Schema

**Tables:**
- `regions` - Chilean regions
- `users` - Job seekers
- `companies` - Employers
- `job_categories` - Job categories
- `jobs` - Job listings
- `job_applications` - Applications
- `sessions` - JWT sessions (optional)

See [backend/migrations/001_initial_schema.sql](backend/migrations/001_initial_schema.sql) for full schema.

## Development Workflow

### Making Changes to Models

1. Edit Rust models in `backend/src/models/`
2. Run `cargo test` to regenerate TypeScript types
3. Types are exported to `frontend/src/types/`
4. Frontend automatically picks up new types

### Running Tests

```bash
# Backend tests
cd backend
cargo test

# Frontend tests (if configured)
cd frontend
npm test
```

## Docker Profiles

The docker-compose.yml supports different profiles:

```bash
# Full stack (backend + frontend + database)
docker compose --profile full up -d

# Backend only (backend + database)
docker compose --profile backend up -d

# Frontend only
docker compose --profile frontend up -d
```

## Tech Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Backend | Rust + Axum | 1.75 / 0.7 |
| Frontend | Next.js | 14.1 |
| Database | PostgreSQL | 15 |
| Auth | JWT + bcrypt | - |
| Validation | Zod + validator | - |
| Styling | Tailwind CSS | 3.4 |
| Type Safety | ts-rs | 7.1 |

## Environment Variables

**Backend (.env):**
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/empleos_inclusivos
JWT_SECRET=your-secret-key-here
RUST_LOG=info
```

**Frontend (.env.local):**
```env
NEXT_PUBLIC_API_URL=http://localhost:8080/api
```

## Troubleshooting

### Port Conflicts
If ports 3000, 5432, or 8080 are in use:
```bash
# Find process using port
lsof -i :8080

# Or change ports in docker-compose.yml
```

### Database Connection Issues
```bash
# Check if PostgreSQL is running
docker ps

# View database logs
docker logs oxideexpo-postgres

# Connect to database
docker exec -it oxideexpo-postgres psql -U postgres -d empleos_inclusivos
```

### TypeScript Type Sync
```bash
# Regenerate types from Rust
cd backend
cargo test

# Types should appear in frontend/src/types/
```

## Next Steps

After POC validation:
1. Add remaining features (CV upload, company profiles, admin panel)
2. Implement comprehensive testing (unit, integration, E2E)
3. Set up CI/CD pipeline
4. Add monitoring and logging
5. Implement caching (Redis)
6. Security hardening (rate limiting, input sanitization)
7. Deploy to production

## License

[Add license information]

## Related Documentation

- [POC Implementation Plan](../Laravel/POC_IMPLEMENTATION_PLAN.md)
- [Backend API Documentation](./backend/README.md) (to be created)
- [Frontend Documentation](./frontend/README.md) (to be created)
