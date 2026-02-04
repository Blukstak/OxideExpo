-- V3 Migration: Create Job Seeker Profile Tables
-- EmpleosInclusivos Job Seeker Core System

-- ============================================================================
-- JOB SEEKER PROFILES
-- ============================================================================

CREATE TABLE job_seeker_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

    -- Personal Information
    phone VARCHAR(20),
    date_of_birth DATE,
    gender gender,
    marital_status marital_status,
    nationality VARCHAR(100),
    national_id VARCHAR(50), -- RUT in Chile

    -- Location
    region_id UUID REFERENCES regions(id),
    municipality_id UUID REFERENCES municipalities(id),
    address TEXT,

    -- Professional Summary
    bio TEXT,
    professional_headline VARCHAR(200),

    -- File Uploads
    profile_image_url VARCHAR(500),
    cv_url VARCHAR(500),

    -- Profile Completeness
    completeness_percentage INTEGER NOT NULL DEFAULT 0 CHECK (completeness_percentage BETWEEN 0 AND 100),

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_job_seeker_profiles_region ON job_seeker_profiles(region_id);
CREATE INDEX idx_job_seeker_profiles_municipality ON job_seeker_profiles(municipality_id);
CREATE INDEX idx_job_seeker_profiles_completeness ON job_seeker_profiles(completeness_percentage);

-- Updated at trigger
CREATE TRIGGER update_job_seeker_profiles_updated_at
    BEFORE UPDATE ON job_seeker_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- DISABILITY INFORMATION
-- ============================================================================

CREATE TABLE job_seeker_disabilities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

    -- Disability Details
    category disability_category NOT NULL,
    description TEXT,

    -- Registration & Certification
    has_disability_certificate BOOLEAN NOT NULL DEFAULT false,
    disability_percentage INTEGER CHECK (disability_percentage BETWEEN 0 AND 100),

    -- Workplace Accommodations
    requires_accommodations BOOLEAN NOT NULL DEFAULT false,
    accommodation_details TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_job_seeker_disabilities_category ON job_seeker_disabilities(category);

CREATE TRIGGER update_job_seeker_disabilities_updated_at
    BEFORE UPDATE ON job_seeker_disabilities
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- EDUCATION RECORDS
-- ============================================================================

CREATE TABLE education_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Institution
    institution_id UUID REFERENCES institutions(id),
    institution_name VARCHAR(255), -- For custom institutions not in reference table

    -- Education Details
    level education_level NOT NULL,
    field_of_study_id UUID REFERENCES career_fields(id),
    field_of_study_name VARCHAR(255), -- For custom fields
    degree_title VARCHAR(255),

    -- Status and Dates
    status education_status NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE, -- NULL if in_progress

    -- Additional Info
    description TEXT,
    achievements TEXT,

    -- Display Order
    display_order INTEGER NOT NULL DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_education_records_user_id ON education_records(user_id, start_date DESC);
CREATE INDEX idx_education_records_institution ON education_records(institution_id);
CREATE INDEX idx_education_records_level ON education_records(level);

CREATE TRIGGER update_education_records_updated_at
    BEFORE UPDATE ON education_records
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- WORK EXPERIENCES
-- ============================================================================

CREATE TABLE work_experiences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Company Information
    company_name VARCHAR(255) NOT NULL,
    industry_id UUID REFERENCES industries(id),

    -- Position Details
    position_title VARCHAR(255) NOT NULL,
    work_area_id UUID REFERENCES work_areas(id),
    position_level_id UUID REFERENCES position_levels(id),

    -- Employment Details
    employment_type job_type,
    is_current BOOLEAN NOT NULL DEFAULT false,
    start_date DATE NOT NULL,
    end_date DATE, -- NULL if is_current = true

    -- Location
    region_id UUID REFERENCES regions(id),
    municipality_id UUID REFERENCES municipalities(id),

    -- Description
    description TEXT,
    achievements TEXT,

    -- Display Order
    display_order INTEGER NOT NULL DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraint: end_date must be after start_date
    CONSTRAINT valid_date_range CHECK (
        end_date IS NULL OR end_date >= start_date
    ),

    -- Constraint: if is_current = true, end_date must be NULL
    CONSTRAINT current_job_no_end_date CHECK (
        NOT is_current OR end_date IS NULL
    )
);

CREATE INDEX idx_work_experiences_user_id ON work_experiences(user_id, start_date DESC);
CREATE INDEX idx_work_experiences_company ON work_experiences(company_name);
CREATE INDEX idx_work_experiences_current ON work_experiences(user_id, is_current) WHERE is_current = true;

CREATE TRIGGER update_work_experiences_updated_at
    BEFORE UPDATE ON work_experiences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- USER SKILLS
-- ============================================================================

CREATE TABLE user_skills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES skills(id),

    -- Proficiency (1-5 scale)
    proficiency_level INTEGER NOT NULL CHECK (proficiency_level BETWEEN 1 AND 5),

    -- Years of Experience (optional)
    years_of_experience INTEGER CHECK (years_of_experience >= 0),

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Each user can only have one entry per skill
    UNIQUE(user_id, skill_id)
);

CREATE INDEX idx_user_skills_user_id ON user_skills(user_id);
CREATE INDEX idx_user_skills_skill_id ON user_skills(skill_id);
CREATE INDEX idx_user_skills_proficiency ON user_skills(user_id, proficiency_level DESC);

CREATE TRIGGER update_user_skills_updated_at
    BEFORE UPDATE ON user_skills
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- USER LANGUAGES
-- ============================================================================

CREATE TABLE user_languages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    language_id UUID NOT NULL REFERENCES languages(id),

    -- Proficiency Level
    proficiency language_proficiency NOT NULL,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Each user can only have one entry per language
    UNIQUE(user_id, language_id)
);

CREATE INDEX idx_user_languages_user_id ON user_languages(user_id);
CREATE INDEX idx_user_languages_language_id ON user_languages(language_id);

CREATE TRIGGER update_user_languages_updated_at
    BEFORE UPDATE ON user_languages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PORTFOLIO ITEMS
-- ============================================================================

CREATE TABLE portfolio_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Portfolio Details
    title VARCHAR(255) NOT NULL,
    description TEXT,
    url VARCHAR(500), -- External link (GitHub, website, etc.)
    file_url VARCHAR(500), -- Uploaded file (PDF, images, etc.)

    -- Type/Category (optional, for filtering)
    category VARCHAR(100), -- e.g., "project", "certificate", "publication"

    -- Dates
    completion_date DATE,

    -- Display Order
    display_order INTEGER NOT NULL DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- At least one of url or file_url must be provided
    CONSTRAINT has_url_or_file CHECK (
        url IS NOT NULL OR file_url IS NOT NULL
    )
);

CREATE INDEX idx_portfolio_items_user_id ON portfolio_items(user_id, display_order);
CREATE INDEX idx_portfolio_items_category ON portfolio_items(category);

CREATE TRIGGER update_portfolio_items_updated_at
    BEFORE UPDATE ON portfolio_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PROFILE COMPLETENESS CALCULATION FUNCTION
-- ============================================================================

-- This function calculates the profile completeness percentage
-- Call this whenever profile data is updated
CREATE OR REPLACE FUNCTION calculate_profile_completeness(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    completeness INTEGER := 0;
    total_sections INTEGER := 10; -- Total weighted sections
    profile_exists BOOLEAN;
BEGIN
    -- Check if profile exists
    SELECT EXISTS(SELECT 1 FROM job_seeker_profiles WHERE user_id = p_user_id)
    INTO profile_exists;

    IF NOT profile_exists THEN
        RETURN 0;
    END IF;

    -- Basic Information (20 points)
    IF EXISTS(
        SELECT 1 FROM job_seeker_profiles
        WHERE user_id = p_user_id
        AND phone IS NOT NULL
        AND date_of_birth IS NOT NULL
        AND region_id IS NOT NULL
        AND municipality_id IS NOT NULL
    ) THEN
        completeness := completeness + 20;
    END IF;

    -- Professional Headline/Bio (10 points)
    IF EXISTS(
        SELECT 1 FROM job_seeker_profiles
        WHERE user_id = p_user_id
        AND (professional_headline IS NOT NULL OR bio IS NOT NULL)
    ) THEN
        completeness := completeness + 10;
    END IF;

    -- Profile Image (10 points)
    IF EXISTS(
        SELECT 1 FROM job_seeker_profiles
        WHERE user_id = p_user_id
        AND profile_image_url IS NOT NULL
    ) THEN
        completeness := completeness + 10;
    END IF;

    -- CV Upload (15 points)
    IF EXISTS(
        SELECT 1 FROM job_seeker_profiles
        WHERE user_id = p_user_id
        AND cv_url IS NOT NULL
    ) THEN
        completeness := completeness + 15;
    END IF;

    -- Education (10 points)
    IF EXISTS(SELECT 1 FROM education_records WHERE user_id = p_user_id LIMIT 1) THEN
        completeness := completeness + 10;
    END IF;

    -- Work Experience (15 points)
    IF EXISTS(SELECT 1 FROM work_experiences WHERE user_id = p_user_id LIMIT 1) THEN
        completeness := completeness + 15;
    END IF;

    -- Skills (10 points)
    IF EXISTS(SELECT 1 FROM user_skills WHERE user_id = p_user_id LIMIT 3) THEN
        completeness := completeness + 10;
    END IF;

    -- Languages (5 points)
    IF EXISTS(SELECT 1 FROM user_languages WHERE user_id = p_user_id LIMIT 1) THEN
        completeness := completeness + 5;
    END IF;

    -- Portfolio (optional, 5 points bonus)
    IF EXISTS(SELECT 1 FROM portfolio_items WHERE user_id = p_user_id LIMIT 1) THEN
        completeness := completeness + 5;
    END IF;

    -- Ensure it doesn't exceed 100
    IF completeness > 100 THEN
        completeness := 100;
    END IF;

    -- Update the profile
    UPDATE job_seeker_profiles
    SET completeness_percentage = completeness
    WHERE user_id = p_user_id;

    RETURN completeness;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- AUTOMATIC COMPLETENESS UPDATE TRIGGERS
-- ============================================================================

-- Trigger function to recalculate completeness
CREATE OR REPLACE FUNCTION trigger_recalculate_completeness()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM calculate_profile_completeness(COALESCE(NEW.user_id, OLD.user_id));
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Attach triggers to all relevant tables
CREATE TRIGGER recalc_completeness_on_profile_change
    AFTER INSERT OR UPDATE OR DELETE ON job_seeker_profiles
    FOR EACH ROW
    EXECUTE FUNCTION trigger_recalculate_completeness();

CREATE TRIGGER recalc_completeness_on_education_change
    AFTER INSERT OR UPDATE OR DELETE ON education_records
    FOR EACH ROW
    EXECUTE FUNCTION trigger_recalculate_completeness();

CREATE TRIGGER recalc_completeness_on_experience_change
    AFTER INSERT OR UPDATE OR DELETE ON work_experiences
    FOR EACH ROW
    EXECUTE FUNCTION trigger_recalculate_completeness();

CREATE TRIGGER recalc_completeness_on_skills_change
    AFTER INSERT OR UPDATE OR DELETE ON user_skills
    FOR EACH ROW
    EXECUTE FUNCTION trigger_recalculate_completeness();

CREATE TRIGGER recalc_completeness_on_languages_change
    AFTER INSERT OR UPDATE OR DELETE ON user_languages
    FOR EACH ROW
    EXECUTE FUNCTION trigger_recalculate_completeness();

CREATE TRIGGER recalc_completeness_on_portfolio_change
    AFTER INSERT OR UPDATE OR DELETE ON portfolio_items
    FOR EACH ROW
    EXECUTE FUNCTION trigger_recalculate_completeness();
