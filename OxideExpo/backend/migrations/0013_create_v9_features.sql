-- V9: Enhanced Applicant Management, Saved Jobs, File Uploads
-- Migration 0013

-- ============================================================================
-- PART 1: APPLICATION STATUS HISTORY
-- ============================================================================

-- Table to track application status changes
CREATE TABLE IF NOT EXISTS application_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES job_applications(id) ON DELETE CASCADE,
    previous_status application_status,
    new_status application_status NOT NULL,
    changed_by UUID NOT NULL REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_app_status_history_app ON application_status_history(application_id);
CREATE INDEX IF NOT EXISTS idx_app_status_history_created ON application_status_history(created_at DESC);

-- Function to log status changes automatically
CREATE OR REPLACE FUNCTION log_application_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO application_status_history (application_id, previous_status, new_status, changed_by)
        VALUES (NEW.id, OLD.status, NEW.status, COALESCE(NEW.reviewed_by, OLD.applicant_id));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-log status changes
DROP TRIGGER IF EXISTS application_status_change_trigger ON job_applications;
CREATE TRIGGER application_status_change_trigger
    AFTER UPDATE ON job_applications
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION log_application_status_change();

-- ============================================================================
-- PART 2: SAVED JOBS (FAVORITES)
-- ============================================================================

-- Table for job seekers to save/bookmark jobs
CREATE TABLE IF NOT EXISTS saved_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, job_id)
);

-- Index for efficient user queries
CREATE INDEX IF NOT EXISTS idx_saved_jobs_user ON saved_jobs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_jobs_job ON saved_jobs(job_id);

-- ============================================================================
-- PART 3: FILE UPLOADS
-- ============================================================================

-- Create file_type enum
DO $$ BEGIN
    CREATE TYPE file_type AS ENUM (
        'cv',
        'profile_image',
        'company_logo',
        'company_cover'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Table to track uploaded files
CREATE TABLE IF NOT EXISTS uploaded_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_type file_type NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    storage_path VARCHAR(500) NOT NULL,
    content_type VARCHAR(100),
    file_size_bytes BIGINT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_uploaded_files_user ON uploaded_files(user_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_type ON uploaded_files(user_id, file_type);

-- Add file references to job_seeker_profiles (if columns don't exist)
DO $$ BEGIN
    ALTER TABLE job_seeker_profiles ADD COLUMN cv_file_id UUID REFERENCES uploaded_files(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE job_seeker_profiles ADD COLUMN profile_image_file_id UUID REFERENCES uploaded_files(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- Add file references to company_profiles (if columns don't exist)
DO $$ BEGIN
    ALTER TABLE company_profiles ADD COLUMN logo_file_id UUID REFERENCES uploaded_files(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE company_profiles ADD COLUMN cover_file_id UUID REFERENCES uploaded_files(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- ============================================================================
-- TRIGGERS FOR updated_at
-- ============================================================================

DROP TRIGGER IF EXISTS update_application_status_history_updated_at ON application_status_history;
CREATE TRIGGER update_application_status_history_updated_at
    BEFORE UPDATE ON application_status_history
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
