-- V7 Migration: Create Matching and Recommendations Tables
-- EmpleosInclusivos Matching System

-- ============================================================================
-- NEW ENUMS FOR MATCHING PREFERENCES
-- ============================================================================

CREATE TYPE profile_visibility AS ENUM (
    'visible',      -- Profile visible to all companies
    'hidden',       -- Profile hidden from companies
    'applied_only'  -- Only visible to companies where user has applied
);

CREATE TYPE alert_frequency AS ENUM (
    'instant',  -- Immediate email for new matches
    'daily',    -- Daily digest
    'weekly',   -- Weekly digest
    'never'     -- No email alerts
);

-- ============================================================================
-- JOB SEEKER PREFERENCES TABLE
-- Privacy and recommendation preferences for job seekers
-- ============================================================================

CREATE TABLE job_seeker_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

    -- Job Preferences
    preferred_work_modalities work_modality[] DEFAULT '{}',
    preferred_job_types job_type[] DEFAULT '{}',
    preferred_region_ids UUID[] DEFAULT '{}',
    preferred_industry_ids UUID[] DEFAULT '{}',
    willing_to_relocate BOOLEAN DEFAULT FALSE,

    -- Salary Expectations
    salary_expectation_min NUMERIC(12, 2),
    salary_expectation_max NUMERIC(12, 2),
    salary_currency VARCHAR(3) DEFAULT 'CLP',

    -- Privacy Controls
    profile_visibility profile_visibility NOT NULL DEFAULT 'visible',
    show_disability_info BOOLEAN NOT NULL DEFAULT TRUE,

    -- Alert Settings
    email_job_alerts BOOLEAN NOT NULL DEFAULT TRUE,
    alert_frequency alert_frequency NOT NULL DEFAULT 'daily',

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT salary_range_valid CHECK (
        salary_expectation_min IS NULL OR
        salary_expectation_max IS NULL OR
        salary_expectation_min <= salary_expectation_max
    )
);

COMMENT ON TABLE job_seeker_preferences IS 'Stores job seeker privacy settings and recommendation preferences';
COMMENT ON COLUMN job_seeker_preferences.profile_visibility IS 'Controls who can see the job seeker profile';
COMMENT ON COLUMN job_seeker_preferences.show_disability_info IS 'Whether to share disability information with companies';

-- ============================================================================
-- JOB MATCH SCORES TABLE (OPTIONAL CACHING)
-- Cached match scores for performance optimization
-- ============================================================================

CREATE TABLE job_match_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Overall Score
    total_score INTEGER NOT NULL CHECK (total_score >= 0 AND total_score <= 100),

    -- Component Scores (out of their respective weights)
    skills_score INTEGER NOT NULL DEFAULT 0 CHECK (skills_score >= 0 AND skills_score <= 35),
    languages_score INTEGER NOT NULL DEFAULT 0 CHECK (languages_score >= 0 AND languages_score <= 15),
    location_score INTEGER NOT NULL DEFAULT 0 CHECK (location_score >= 0 AND location_score <= 15),
    experience_score INTEGER NOT NULL DEFAULT 0 CHECK (experience_score >= 0 AND experience_score <= 15),
    education_score INTEGER NOT NULL DEFAULT 0 CHECK (education_score >= 0 AND education_score <= 10),
    preferred_skills_score INTEGER NOT NULL DEFAULT 0 CHECK (preferred_skills_score >= 0 AND preferred_skills_score <= 5),
    accommodations_score INTEGER NOT NULL DEFAULT 0 CHECK (accommodations_score >= 0 AND accommodations_score <= 5),

    -- Cache Management
    computed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    is_stale BOOLEAN NOT NULL DEFAULT FALSE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Unique constraint per job-user pair
    CONSTRAINT unique_job_user_score UNIQUE (job_id, user_id)
);

COMMENT ON TABLE job_match_scores IS 'Cached match scores between jobs and job seekers for performance';
COMMENT ON COLUMN job_match_scores.is_stale IS 'Set to TRUE when underlying data changes, score needs recalculation';

-- ============================================================================
-- PERFORMANCE INDEXES FOR MATCHING QUERIES
-- ============================================================================

-- Indexes for user skills matching
CREATE INDEX idx_user_skills_matching
ON user_skills(user_id, skill_id, proficiency_level);

-- Indexes for user languages matching
CREATE INDEX idx_user_languages_matching
ON user_languages(user_id, language_id, proficiency);

-- Index for active jobs (commonly queried for recommendations)
CREATE INDEX idx_jobs_active_matching
ON jobs(status, application_deadline)
WHERE status = 'active';

-- Indexes for job required skills lookup
CREATE INDEX idx_job_required_skills_matching
ON job_required_skills(job_id, skill_id, minimum_proficiency);

-- Indexes for job required languages lookup
CREATE INDEX idx_job_required_languages_matching
ON job_required_languages(job_id, language_id, minimum_proficiency);

-- Index for job seeker preferences lookup
CREATE INDEX idx_job_seeker_preferences_visibility
ON job_seeker_preferences(profile_visibility);

-- Indexes for match score cache queries
CREATE INDEX idx_job_match_scores_user
ON job_match_scores(user_id, total_score DESC);

CREATE INDEX idx_job_match_scores_job
ON job_match_scores(job_id, total_score DESC);

CREATE INDEX idx_job_match_scores_stale
ON job_match_scores(is_stale)
WHERE is_stale = TRUE;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Updated_at trigger for job_seeker_preferences
CREATE TRIGGER update_job_seeker_preferences_updated_at
    BEFORE UPDATE ON job_seeker_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Updated_at trigger for job_match_scores
CREATE TRIGGER update_job_match_scores_updated_at
    BEFORE UPDATE ON job_match_scores
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- STALENESS TRIGGERS
-- Mark match scores as stale when underlying data changes
-- ============================================================================

-- Mark scores stale when user skills change
CREATE OR REPLACE FUNCTION mark_user_match_scores_stale()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE job_match_scores
    SET is_stale = TRUE, updated_at = NOW()
    WHERE user_id = COALESCE(NEW.user_id, OLD.user_id);
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_skills_changed_stale
    AFTER INSERT OR UPDATE OR DELETE ON user_skills
    FOR EACH ROW
    EXECUTE FUNCTION mark_user_match_scores_stale();

CREATE TRIGGER user_languages_changed_stale
    AFTER INSERT OR UPDATE OR DELETE ON user_languages
    FOR EACH ROW
    EXECUTE FUNCTION mark_user_match_scores_stale();

-- Mark scores stale when job requirements change
CREATE OR REPLACE FUNCTION mark_job_match_scores_stale()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE job_match_scores
    SET is_stale = TRUE, updated_at = NOW()
    WHERE job_id = COALESCE(NEW.job_id, OLD.job_id);
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER job_required_skills_changed_stale
    AFTER INSERT OR UPDATE OR DELETE ON job_required_skills
    FOR EACH ROW
    EXECUTE FUNCTION mark_job_match_scores_stale();

CREATE TRIGGER job_required_languages_changed_stale
    AFTER INSERT OR UPDATE OR DELETE ON job_required_languages
    FOR EACH ROW
    EXECUTE FUNCTION mark_job_match_scores_stale();

-- ============================================================================
-- AUTO-CREATE PREFERENCES FOR NEW JOB SEEKERS
-- ============================================================================

CREATE OR REPLACE FUNCTION create_default_job_seeker_preferences()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.user_type = 'job_seeker' THEN
        INSERT INTO job_seeker_preferences (user_id)
        VALUES (NEW.id)
        ON CONFLICT (user_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_create_job_seeker_preferences
    AFTER INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION create_default_job_seeker_preferences();
