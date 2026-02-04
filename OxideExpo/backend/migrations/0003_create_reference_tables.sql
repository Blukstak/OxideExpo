-- V1 Migration: Create Reference Data Tables
-- EmpleosInclusivos Infrastructure

-- ============================================================================
-- GEOGRAPHIC REFERENCE TABLES
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
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(country_id, name)
);

CREATE INDEX idx_regions_country ON regions(country_id);

CREATE TABLE municipalities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    region_id UUID NOT NULL REFERENCES regions(id),
    name VARCHAR(150) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(region_id, name)
);

CREATE INDEX idx_municipalities_region ON municipalities(region_id);

-- ============================================================================
-- INDUSTRY & WORK AREA REFERENCE TABLES
-- ============================================================================

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
    seniority_rank INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- EDUCATION REFERENCE TABLES
-- ============================================================================

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
    institution_type VARCHAR(50),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_institutions_country ON institutions(country_id);

-- ============================================================================
-- LANGUAGE REFERENCE TABLE
-- ============================================================================

CREATE TABLE languages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    iso_code CHAR(2),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- SKILLS REFERENCE TABLES
-- ============================================================================

CREATE TABLE skill_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
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

CREATE INDEX idx_skills_category ON skills(category_id);
CREATE INDEX idx_skills_name_search ON skills USING gin(to_tsvector('spanish', name));
