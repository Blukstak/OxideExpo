-- Regions (ti_regiones)
CREATE TABLE IF NOT EXISTS regions (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    codigo VARCHAR(10) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Users (ti_usuarios)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    rut VARCHAR(20) NOT NULL UNIQUE,
    telefono VARCHAR(20),
    region_id INTEGER REFERENCES regions(id),
    user_type VARCHAR(20) NOT NULL DEFAULT 'usuario',
    status CHAR(1) NOT NULL DEFAULT 'T',
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Companies (ti_empresas)
CREATE TABLE IF NOT EXISTS companies (
    id SERIAL PRIMARY KEY,
    razon_social VARCHAR(255) NOT NULL,
    rut VARCHAR(20) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    telefono VARCHAR(20),
    region_id INTEGER REFERENCES regions(id),
    website VARCHAR(255),
    descripcion TEXT,
    logo_url VARCHAR(500),
    status CHAR(1) NOT NULL DEFAULT 'T',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Job Categories (ti_categoria_oferta)
CREATE TABLE IF NOT EXISTS job_categories (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Jobs (ti_ofertas_laborales)
CREATE TABLE IF NOT EXISTS jobs (
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
    employment_type VARCHAR(50),
    vacancies INTEGER NOT NULL DEFAULT 1,
    application_deadline DATE,
    status CHAR(1) NOT NULL DEFAULT 'P',
    views_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ
);

-- Job Applications (ti_postulante_oferta)
CREATE TABLE IF NOT EXISTS job_applications (
    id SERIAL PRIMARY KEY,
    job_id INTEGER NOT NULL REFERENCES jobs(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    cover_letter TEXT,
    cv_url VARCHAR(500),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    UNIQUE(job_id, user_id)
);

-- Sessions (for JWT refresh tokens)
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL REFERENCES users(id),
    refresh_token VARCHAR(500) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company_id);
CREATE INDEX IF NOT EXISTS idx_jobs_category ON jobs(category_id);
CREATE INDEX IF NOT EXISTS idx_jobs_region ON jobs(region_id);
CREATE INDEX IF NOT EXISTS idx_jobs_published ON jobs(published_at);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_applications_job ON job_applications(job_id);
CREATE INDEX IF NOT EXISTS idx_applications_user ON job_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- Seed data
INSERT INTO regions (nombre, codigo) VALUES
('Región Metropolitana', 'RM'),
('Valparaíso', 'V'),
('Biobío', 'VIII')
ON CONFLICT DO NOTHING;

INSERT INTO job_categories (nombre, descripcion) VALUES
('Tecnología', 'Trabajos en tecnología e informática'),
('Administración', 'Trabajos administrativos y gestión'),
('Ventas', 'Trabajos en ventas y atención al cliente')
ON CONFLICT DO NOTHING;

INSERT INTO companies (razon_social, rut, email, telefono, region_id, descripcion, status) VALUES
('Tech Innovadores SpA', '76.123.456-7', 'contacto@techinnovadores.cl', '+56912345678', 1, 'Empresa líder en desarrollo de software', 'T')
ON CONFLICT DO NOTHING;

INSERT INTO jobs (company_id, category_id, region_id, title, description, requirements, salary_min, salary_max, employment_type, vacancies, status, published_at)
SELECT 1, 1, 1, 'Desarrollador Full Stack', 'Buscamos desarrollador con experiencia en desarrollo web moderno.', 'Experiencia con React, Node.js, PostgreSQL. Al menos 2 años de experiencia.', 1500000, 2500000, 'full-time', 2, 'T', NOW()
WHERE NOT EXISTS (SELECT 1 FROM jobs WHERE title = 'Desarrollador Full Stack');

INSERT INTO jobs (company_id, category_id, region_id, title, description, requirements, salary_min, salary_max, employment_type, vacancies, status, published_at)
SELECT 1, 1, 1, 'Diseñador UX/UI', 'Diseñador creativo para productos digitales innovadores.', 'Portafolio comprobable. Manejo de Figma, Adobe XD.', 1200000, 2000000, 'full-time', 1, 'T', NOW()
WHERE NOT EXISTS (SELECT 1 FROM jobs WHERE title = 'Diseñador UX/UI');
