-- V8 Migration: OMIL Organizations, Job Seeker Management, and Messaging
-- EmpleosInclusivos OMIL System

-- ============================================================================
-- NEW ENUMS
-- ============================================================================

CREATE TYPE omil_role AS ENUM (
    'director',      -- Full control over OMIL org
    'coordinator',   -- Can manage staff and job seekers
    'advisor'        -- Can work with job seekers, limited admin
);

CREATE TYPE followup_type AS ENUM (
    'initial_registration',
    'profile_update',
    'job_application',
    'interview_scheduled',
    'interview_completed',
    'placement',
    'follow_up_call',
    'general_note'
);

CREATE TYPE placement_outcome AS ENUM (
    'pending',
    'placed',
    'not_placed',
    'declined_offer',
    'withdrawn'
);

CREATE TYPE invitation_status AS ENUM (
    'pending',
    'viewed',
    'applied',
    'declined',
    'expired'
);

-- ============================================================================
-- OMIL ORGANIZATIONS TABLE
-- Represents municipal employment offices
-- ============================================================================

CREATE TABLE omil_organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Organization Details
    organization_name VARCHAR(255) NOT NULL,
    municipality_id UUID REFERENCES municipalities(id),
    region_id UUID REFERENCES regions(id),

    -- Contact Information
    address TEXT,
    phone VARCHAR(50),
    email VARCHAR(255),
    website_url VARCHAR(500),

    -- Status
    status organization_status NOT NULL DEFAULT 'pending_approval',
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID REFERENCES users(id),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE omil_organizations IS 'Municipal employment offices (OMIL)';

-- ============================================================================
-- OMIL MEMBERS TABLE
-- Links users to OMIL organizations with roles
-- ============================================================================

CREATE TABLE omil_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    omil_id UUID NOT NULL REFERENCES omil_organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role omil_role NOT NULL DEFAULT 'advisor',

    -- Employment Status
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    left_at TIMESTAMP WITH TIME ZONE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_omil_user UNIQUE (omil_id, user_id)
);

COMMENT ON TABLE omil_members IS 'OMIL staff members with their roles';

-- ============================================================================
-- OMIL MANAGED JOB SEEKERS TABLE
-- Tracks which job seekers are being managed by which OMIL
-- ============================================================================

CREATE TABLE omil_managed_job_seekers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    omil_id UUID NOT NULL REFERENCES omil_organizations(id) ON DELETE CASCADE,
    job_seeker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Management Info
    assigned_advisor_id UUID REFERENCES users(id),
    registered_by UUID NOT NULL REFERENCES users(id),
    placement_outcome placement_outcome NOT NULL DEFAULT 'pending',
    placed_at TIMESTAMP WITH TIME ZONE,
    placed_job_id UUID REFERENCES jobs(id),

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT,

    -- Timestamps
    registered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_omil_job_seeker UNIQUE (omil_id, job_seeker_id)
);

COMMENT ON TABLE omil_managed_job_seekers IS 'Job seekers being assisted by an OMIL office';

-- ============================================================================
-- JOB SEEKER FOLLOWUPS TABLE
-- Tracks OMIL interactions with job seekers (comments/notes)
-- ============================================================================

CREATE TABLE job_seeker_followups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- References
    job_seeker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(id),
    omil_id UUID REFERENCES omil_organizations(id) ON DELETE SET NULL,
    application_id UUID REFERENCES job_applications(id) ON DELETE SET NULL,

    -- Followup Details
    followup_type followup_type NOT NULL,
    title VARCHAR(255),
    content TEXT NOT NULL,
    is_private BOOLEAN NOT NULL DEFAULT FALSE,

    -- Timestamps
    followup_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE job_seeker_followups IS 'Follow-up notes and comments on job seekers';

-- ============================================================================
-- JOB INVITATIONS TABLE
-- Companies can invite job seekers to apply for specific jobs
-- ============================================================================

CREATE TABLE job_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- References
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    job_seeker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invited_by UUID NOT NULL REFERENCES users(id),
    company_id UUID NOT NULL REFERENCES company_profiles(id) ON DELETE CASCADE,

    -- Invitation Details
    message TEXT,
    status invitation_status NOT NULL DEFAULT 'pending',

    -- Tracking
    viewed_at TIMESTAMP WITH TIME ZONE,
    responded_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_job_invitation UNIQUE (job_id, job_seeker_id)
);

COMMENT ON TABLE job_invitations IS 'Companies invite job seekers to apply for positions';

-- ============================================================================
-- OMIL APPLICATIONS TABLE
-- Tracks applications submitted by OMIL on behalf of job seekers
-- ============================================================================

CREATE TABLE omil_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES job_applications(id) ON DELETE CASCADE UNIQUE,
    omil_id UUID NOT NULL REFERENCES omil_organizations(id) ON DELETE CASCADE,
    submitted_by UUID NOT NULL REFERENCES users(id),

    -- Notes
    internal_notes TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE omil_applications IS 'Tracks which applications were submitted by OMIL staff';

-- ============================================================================
-- NOTIFICATION PREFERENCES TABLE
-- User email notification settings
-- ============================================================================

CREATE TABLE notification_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

    -- Email Notifications
    email_job_alerts BOOLEAN NOT NULL DEFAULT TRUE,
    email_application_updates BOOLEAN NOT NULL DEFAULT TRUE,
    email_invitations BOOLEAN NOT NULL DEFAULT TRUE,
    email_messages BOOLEAN NOT NULL DEFAULT TRUE,
    email_marketing BOOLEAN NOT NULL DEFAULT FALSE,

    -- Frequency
    digest_frequency alert_frequency NOT NULL DEFAULT 'daily',

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE notification_preferences IS 'User email notification preferences';

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_omil_organizations_municipality ON omil_organizations(municipality_id);
CREATE INDEX idx_omil_organizations_status ON omil_organizations(status);
CREATE INDEX idx_omil_members_user ON omil_members(user_id);
CREATE INDEX idx_omil_members_omil ON omil_members(omil_id);
CREATE INDEX idx_omil_managed_seekers_omil ON omil_managed_job_seekers(omil_id);
CREATE INDEX idx_omil_managed_seekers_seeker ON omil_managed_job_seekers(job_seeker_id);
CREATE INDEX idx_omil_managed_seekers_advisor ON omil_managed_job_seekers(assigned_advisor_id);
CREATE INDEX idx_job_seeker_followups_seeker ON job_seeker_followups(job_seeker_id);
CREATE INDEX idx_job_seeker_followups_omil ON job_seeker_followups(omil_id);
CREATE INDEX idx_job_invitations_seeker ON job_invitations(job_seeker_id);
CREATE INDEX idx_job_invitations_job ON job_invitations(job_id);
CREATE INDEX idx_job_invitations_status ON job_invitations(status) WHERE status = 'pending';

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE TRIGGER update_omil_organizations_updated_at
    BEFORE UPDATE ON omil_organizations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_omil_members_updated_at
    BEFORE UPDATE ON omil_members
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_omil_managed_job_seekers_updated_at
    BEFORE UPDATE ON omil_managed_job_seekers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_job_seeker_followups_updated_at
    BEFORE UPDATE ON job_seeker_followups
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_job_invitations_updated_at
    BEFORE UPDATE ON job_invitations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_preferences_updated_at
    BEFORE UPDATE ON notification_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- AUTO-CREATE NOTIFICATION PREFERENCES FOR NEW USERS
-- ============================================================================

CREATE OR REPLACE FUNCTION create_default_notification_preferences()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO notification_preferences (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_create_notification_preferences
    AFTER INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION create_default_notification_preferences();
