-- V11/V12 Migration: Admin Dashboard Completion & Reporting
-- EmpleosInclusivos V11 Completion + V12 Reporting

-- ============================================================================
-- SYSTEM SETTINGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES users(id),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE system_settings IS 'Platform-wide configuration settings managed by admins';
COMMENT ON COLUMN system_settings.key IS 'Unique setting identifier';
COMMENT ON COLUMN system_settings.value IS 'Setting value stored as JSONB for flexibility';

-- Seed default settings
INSERT INTO system_settings (key, value, description) VALUES
    ('require_email_verification', 'true', 'Require email verification for new accounts'),
    ('auto_approve_companies', 'false', 'Auto-approve company registrations'),
    ('auto_approve_jobs', 'false', 'Auto-approve job postings'),
    ('max_applications_per_seeker', '50', 'Maximum pending applications per job seeker'),
    ('maintenance_mode', 'false', 'Enable maintenance mode (block non-admin access)')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- USER STATUS ENUM (for suspend/activate)
-- ============================================================================

-- Note: account_status enum already exists in 0005 (pending_verification, active, suspended, closed)
-- We can use it for user management

-- ============================================================================
-- ADDITIONAL INDEXES FOR REPORTING
-- ============================================================================

-- Index for user registration trends
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);

-- Index for company status reporting
CREATE INDEX IF NOT EXISTS idx_company_status_created ON company_profiles(status, created_at DESC);

-- Index for job status reporting
CREATE INDEX IF NOT EXISTS idx_jobs_status_created ON jobs(status, created_at DESC);

-- Index for application trends
CREATE INDEX IF NOT EXISTS idx_applications_applied_at ON job_applications(applied_at DESC);
