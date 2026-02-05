-- ============================================================================
-- V5: Job Postings & Applications
-- ============================================================================
-- Creates job posting system with:
-- - Jobs with detailed requirements (skills, languages, education, accommodations)
-- - Application tracking with status workflow
-- - Internal notes for company reviews
-- - Automatic completeness calculation
-- - Application counting

-- ============================================================================
-- 1. JOBS TABLE
-- ============================================================================

CREATE TABLE jobs (
    -- Identity
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES company_profiles(id) ON DELETE CASCADE,
    posted_by UUID NOT NULL REFERENCES users(id),

    -- Core Information
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    responsibilities TEXT,

    -- Classification
    job_type job_type NOT NULL,
    industry_id UUID REFERENCES industries(id),
    work_area_id UUID REFERENCES work_areas(id),
    position_level_id UUID REFERENCES position_levels(id),

    -- Work Arrangement
    work_modality work_modality NOT NULL,
    work_schedule VARCHAR(50),

    -- Location
    region_id UUID REFERENCES regions(id),
    municipality_id UUID REFERENCES municipalities(id),
    is_remote_allowed BOOLEAN DEFAULT false,

    -- Requirements
    education_level VARCHAR(50),
    years_experience_min INTEGER,
    years_experience_max INTEGER,
    age_min INTEGER,
    age_max INTEGER,

    -- Compensation
    salary_min NUMERIC(12, 2),
    salary_max NUMERIC(12, 2),
    salary_currency VARCHAR(3) DEFAULT 'MXN',
    salary_period VARCHAR(20),
    benefits TEXT,

    -- Application Details
    application_deadline DATE NOT NULL,
    contact_email VARCHAR(255),
    application_url VARCHAR(500),

    -- Counts
    vacancies INTEGER NOT NULL DEFAULT 1,
    applications_count INTEGER NOT NULL DEFAULT 0,

    -- Status & Approval
    status job_status NOT NULL DEFAULT 'draft',
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID REFERENCES users(id),
    rejection_reason TEXT,

    -- Metadata
    completeness_percentage INTEGER NOT NULL DEFAULT 0,
    is_featured BOOLEAN DEFAULT false,
    views_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT check_salary_range CHECK (salary_min IS NULL OR salary_max IS NULL OR salary_min <= salary_max),
    CONSTRAINT check_experience_range CHECK (years_experience_min IS NULL OR years_experience_max IS NULL OR years_experience_min <= years_experience_max),
    CONSTRAINT check_age_range CHECK (age_min IS NULL OR age_max IS NULL OR (age_min >= 18 AND age_min <= age_max)),
    CONSTRAINT check_vacancies_positive CHECK (vacancies >= 1),
    CONSTRAINT check_application_deadline CHECK (application_deadline >= CURRENT_DATE),
    CONSTRAINT check_rejected_has_reason CHECK (status != 'rejected' OR rejection_reason IS NOT NULL),
    CONSTRAINT check_active_has_approval CHECK (status != 'active' OR (approved_at IS NOT NULL AND approved_by IS NOT NULL))
);

-- ============================================================================
-- 2. JOB REQUIRED SKILLS (with proficiency levels)
-- ============================================================================

CREATE TABLE job_required_skills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES skills(id),
    minimum_proficiency INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT check_proficiency_range CHECK (minimum_proficiency BETWEEN 1 AND 5),
    CONSTRAINT unique_job_required_skill UNIQUE (job_id, skill_id)
);

-- ============================================================================
-- 3. JOB PREFERRED SKILLS (nice-to-have)
-- ============================================================================

CREATE TABLE job_preferred_skills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES skills(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_job_preferred_skill UNIQUE (job_id, skill_id)
);

-- ============================================================================
-- 4. JOB REQUIRED LANGUAGES (with proficiency levels)
-- ============================================================================

CREATE TABLE job_required_languages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    language_id UUID NOT NULL REFERENCES languages(id),
    minimum_proficiency INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT check_language_proficiency_range CHECK (minimum_proficiency BETWEEN 1 AND 5),
    CONSTRAINT unique_job_required_language UNIQUE (job_id, language_id)
);

-- ============================================================================
-- 5. JOB DISABILITY ACCOMMODATIONS
-- ============================================================================

CREATE TABLE job_disability_accommodations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    disability_category disability_category NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_job_accommodation UNIQUE (job_id, disability_category)
);

-- ============================================================================
-- 6. JOB APPLICATIONS
-- ============================================================================

CREATE TABLE job_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    applicant_id UUID NOT NULL REFERENCES users(id),

    -- Application Data
    status application_status NOT NULL DEFAULT 'submitted',
    cover_letter TEXT,
    resume_url VARCHAR(500),
    applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Review Process
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewed_by UUID REFERENCES users(id),

    -- Interview
    interview_date TIMESTAMP WITH TIME ZONE,
    interview_notes TEXT,

    -- Offer
    offer_date TIMESTAMP WITH TIME ZONE,
    offer_details TEXT,
    response_date TIMESTAMP WITH TIME ZONE,

    -- Withdrawal
    withdrawal_reason TEXT,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT unique_job_application UNIQUE (job_id, applicant_id)
);

-- ============================================================================
-- 7. APPLICATION NOTES (internal company notes)
-- ============================================================================

CREATE TABLE application_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES job_applications(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(id),
    note_text TEXT NOT NULL,
    is_important BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Jobs table indexes
CREATE INDEX idx_jobs_company_id ON jobs(company_id);
CREATE INDEX idx_jobs_status_deadline ON jobs(status, application_deadline);
CREATE INDEX idx_jobs_location ON jobs(region_id, municipality_id);
CREATE INDEX idx_jobs_classification ON jobs(industry_id, work_area_id, position_level_id);
CREATE INDEX idx_jobs_featured ON jobs(is_featured, created_at);
CREATE INDEX idx_jobs_full_text ON jobs USING gin(to_tsvector('spanish', title || ' ' || COALESCE(description, '')));

-- Job skills indexes
CREATE INDEX idx_job_required_skills_job_id ON job_required_skills(job_id);
CREATE INDEX idx_job_required_skills_skill_id ON job_required_skills(skill_id);
CREATE INDEX idx_job_preferred_skills_job_id ON job_preferred_skills(job_id);
CREATE INDEX idx_job_preferred_skills_skill_id ON job_preferred_skills(skill_id);

-- Job languages indexes
CREATE INDEX idx_job_required_languages_job_id ON job_required_languages(job_id);
CREATE INDEX idx_job_required_languages_language_id ON job_required_languages(language_id);

-- Job accommodations indexes
CREATE INDEX idx_job_disability_accommodations_job_id ON job_disability_accommodations(job_id);
CREATE INDEX idx_job_disability_accommodations_category ON job_disability_accommodations(disability_category);

-- Applications indexes
CREATE INDEX idx_job_applications_job_id ON job_applications(job_id);
CREATE INDEX idx_job_applications_applicant_id ON job_applications(applicant_id);
CREATE INDEX idx_job_applications_status ON job_applications(status);
CREATE INDEX idx_job_applications_applied_at ON job_applications(applied_at DESC);

-- Application notes indexes
CREATE INDEX idx_application_notes_application_id ON application_notes(application_id);
CREATE INDEX idx_application_notes_created_by ON application_notes(created_by);

-- ============================================================================
-- TRIGGERS: Updated At
-- ============================================================================

CREATE TRIGGER update_jobs_updated_at
    BEFORE UPDATE ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_job_applications_updated_at
    BEFORE UPDATE ON job_applications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_application_notes_updated_at
    BEFORE UPDATE ON application_notes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMPLETENESS CALCULATION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_job_completeness(p_job_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_score INTEGER := 0;
    v_title TEXT;
    v_description TEXT;
    v_description_length INTEGER;
    v_responsibilities TEXT;
    v_responsibilities_length INTEGER;
    v_industry_id UUID;
    v_work_area_id UUID;
    v_position_level_id UUID;
    v_region_id UUID;
    v_municipality_id UUID;
    v_salary_min NUMERIC;
    v_benefits TEXT;
    v_benefits_length INTEGER;
    v_required_skills_count INTEGER;
    v_required_languages_count INTEGER;
    v_accommodations_count INTEGER;
BEGIN
    -- Fetch job data
    SELECT
        title, description, responsibilities,
        industry_id, work_area_id, position_level_id,
        region_id, municipality_id, salary_min, benefits
    INTO
        v_title, v_description, v_responsibilities,
        v_industry_id, v_work_area_id, v_position_level_id,
        v_region_id, v_municipality_id, v_salary_min, v_benefits
    FROM jobs
    WHERE id = p_job_id;

    -- Core info (30 points)
    IF v_title IS NOT NULL AND v_title != '' THEN
        v_score := v_score + 10;
    END IF;

    IF v_description IS NOT NULL THEN
        v_description_length := LENGTH(v_description);
        IF v_description_length >= 100 THEN
            v_score := v_score + 10;
        END IF;
    END IF;

    IF v_responsibilities IS NOT NULL THEN
        v_responsibilities_length := LENGTH(v_responsibilities);
        IF v_responsibilities_length >= 50 THEN
            v_score := v_score + 10;
        END IF;
    END IF;

    -- Classification (15 points)
    IF v_industry_id IS NOT NULL THEN
        v_score := v_score + 5;
    END IF;

    IF v_work_area_id IS NOT NULL THEN
        v_score := v_score + 5;
    END IF;

    IF v_position_level_id IS NOT NULL THEN
        v_score := v_score + 5;
    END IF;

    -- Location (10 points)
    IF v_region_id IS NOT NULL THEN
        v_score := v_score + 5;
    END IF;

    IF v_municipality_id IS NOT NULL THEN
        v_score := v_score + 5;
    END IF;

    -- Compensation (10 points)
    IF v_salary_min IS NOT NULL THEN
        v_score := v_score + 10;
    END IF;

    -- Required skills (15 points)
    SELECT COUNT(*) INTO v_required_skills_count
    FROM job_required_skills
    WHERE job_id = p_job_id;

    IF v_required_skills_count >= 3 THEN
        v_score := v_score + 15;
    END IF;

    -- Languages (5 points)
    SELECT COUNT(*) INTO v_required_languages_count
    FROM job_required_languages
    WHERE job_id = p_job_id;

    IF v_required_languages_count >= 1 THEN
        v_score := v_score + 5;
    END IF;

    -- Benefits (5 points)
    IF v_benefits IS NOT NULL THEN
        v_benefits_length := LENGTH(v_benefits);
        IF v_benefits_length >= 50 THEN
            v_score := v_score + 5;
        END IF;
    END IF;

    -- Disability accommodations (10 points)
    SELECT COUNT(*) INTO v_accommodations_count
    FROM job_disability_accommodations
    WHERE job_id = p_job_id;

    IF v_accommodations_count >= 1 THEN
        v_score := v_score + 10;
    END IF;

    RETURN v_score;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGER: Completeness Calculation
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_calculate_job_completeness()
RETURNS TRIGGER AS $$
BEGIN
    -- Prevent recursion by checking if we're already in a completeness update
    IF TG_OP = 'UPDATE' AND OLD.completeness_percentage IS NOT DISTINCT FROM NEW.completeness_percentage THEN
        -- If only completeness changed, don't recalculate
        IF OLD IS NOT DISTINCT FROM NEW THEN
            RETURN NEW;
        END IF;
    END IF;

    -- Calculate and update completeness
    NEW.completeness_percentage := calculate_job_completeness(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_job_completeness_trigger
    BEFORE INSERT OR UPDATE ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION trigger_calculate_job_completeness();

-- ============================================================================
-- TRIGGER: Update completeness when junction tables change
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_update_job_completeness_on_junction_change()
RETURNS TRIGGER AS $$
DECLARE
    v_job_id UUID;
BEGIN
    -- Get job_id from either NEW or OLD record
    IF TG_OP = 'DELETE' THEN
        v_job_id := OLD.job_id;
    ELSE
        v_job_id := NEW.job_id;
    END IF;

    -- Update the job's completeness
    UPDATE jobs
    SET completeness_percentage = calculate_job_completeness(v_job_id)
    WHERE id = v_job_id;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_job_completeness_on_required_skills
    AFTER INSERT OR DELETE ON job_required_skills
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_job_completeness_on_junction_change();

CREATE TRIGGER update_job_completeness_on_required_languages
    AFTER INSERT OR DELETE ON job_required_languages
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_job_completeness_on_junction_change();

CREATE TRIGGER update_job_completeness_on_accommodations
    AFTER INSERT OR DELETE ON job_disability_accommodations
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_job_completeness_on_junction_change();

-- ============================================================================
-- TRIGGER: Update applications count
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_update_applications_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE jobs
        SET applications_count = applications_count + 1
        WHERE id = NEW.job_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE jobs
        SET applications_count = applications_count - 1
        WHERE id = OLD.job_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_applications_count_trigger
    AFTER INSERT OR DELETE ON job_applications
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_applications_count();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE jobs IS 'Job postings created by companies';
COMMENT ON TABLE job_required_skills IS 'Required skills for jobs with minimum proficiency levels';
COMMENT ON TABLE job_preferred_skills IS 'Nice-to-have skills for jobs';
COMMENT ON TABLE job_required_languages IS 'Required languages for jobs with minimum proficiency levels';
COMMENT ON TABLE job_disability_accommodations IS 'Disability accommodations supported by each job';
COMMENT ON TABLE job_applications IS 'Job applications submitted by job seekers';
COMMENT ON TABLE application_notes IS 'Internal company notes about applicants';

COMMENT ON COLUMN jobs.completeness_percentage IS 'Auto-calculated 0-100 score: core(30) + classification(15) + location(10) + compensation(10) + skills(15) + languages(5) + benefits(5) + accommodations(10)';
COMMENT ON COLUMN jobs.applications_count IS 'Auto-updated count of applications for this job';
