-- V6 Migration: Create Admin Dashboard Tables
-- EmpleosInclusivos Admin Management System
-- Creates admin tables for company approval workflow and platform management

-- ============================================================================
-- ADMIN ROLE ENUM
-- ============================================================================

CREATE TYPE admin_role AS ENUM (
    'super_admin',
    'moderator',
    'analyst'
);

-- ============================================================================
-- ADMINS TABLE
-- ============================================================================

CREATE TABLE admins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    admin_role admin_role NOT NULL DEFAULT 'analyst',
    permissions JSONB NOT NULL DEFAULT '{}',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE admins IS 'Admin users with elevated permissions for platform management';
COMMENT ON COLUMN admins.admin_role IS 'super_admin = full access, moderator = content only, analyst = read-only';
COMMENT ON COLUMN admins.permissions IS 'Additional granular permissions as JSON object';

-- ============================================================================
-- ADMIN AUDIT LOGS TABLE
-- ============================================================================

CREATE TABLE admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID NOT NULL REFERENCES admins(id),
    action_type VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    details JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE admin_audit_logs IS 'Immutable audit trail of all admin actions';
COMMENT ON COLUMN admin_audit_logs.action_type IS 'e.g., approve_company, reject_job, ban_user';
COMMENT ON COLUMN admin_audit_logs.entity_type IS 'e.g., company, job, user, application';
COMMENT ON COLUMN admin_audit_logs.details IS 'Action-specific metadata (reason, notes, changes)';

-- ============================================================================
-- FLAGGED CONTENT TABLE
-- ============================================================================

CREATE TABLE flagged_content (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_type VARCHAR(50) NOT NULL,
    content_id UUID NOT NULL,
    flagged_by UUID REFERENCES users(id),
    reason VARCHAR(100) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    reviewed_by UUID REFERENCES admins(id),
    reviewed_at TIMESTAMPTZ,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT check_status_values CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
    CONSTRAINT check_content_type CHECK (content_type IN ('job', 'profile', 'application', 'company'))
);

COMMENT ON TABLE flagged_content IS 'User-reported content for moderation review';

-- ============================================================================
-- PLATFORM ANNOUNCEMENTS TABLE
-- ============================================================================

CREATE TABLE platform_announcements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    announcement_type VARCHAR(20) NOT NULL DEFAULT 'info',
    target_audience VARCHAR(20) NOT NULL DEFAULT 'all',
    is_active BOOLEAN NOT NULL DEFAULT true,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ,
    created_by UUID NOT NULL REFERENCES admins(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT check_announcement_type CHECK (announcement_type IN ('info', 'warning', 'maintenance')),
    CONSTRAINT check_target_audience CHECK (target_audience IN ('all', 'job_seekers', 'companies')),
    CONSTRAINT check_date_range CHECK (ends_at IS NULL OR ends_at > starts_at)
);

COMMENT ON TABLE platform_announcements IS 'System-wide announcements displayed to users';

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Admin indexes
CREATE INDEX idx_admins_user_id ON admins(user_id);
CREATE INDEX idx_admins_role ON admins(admin_role);

-- Audit log indexes (optimized for common queries)
CREATE INDEX idx_audit_logs_admin_id ON admin_audit_logs(admin_id);
CREATE INDEX idx_audit_logs_entity ON admin_audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON admin_audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_action_type ON admin_audit_logs(action_type);

-- Flagged content indexes
CREATE INDEX idx_flagged_content_status ON flagged_content(status, created_at);
CREATE INDEX idx_flagged_content_entity ON flagged_content(content_type, content_id);
CREATE INDEX idx_flagged_content_flagged_by ON flagged_content(flagged_by);

-- Platform announcements indexes
CREATE INDEX idx_announcements_active ON platform_announcements(is_active, starts_at, ends_at) WHERE is_active = true;
CREATE INDEX idx_announcements_target ON platform_announcements(target_audience, is_active);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Updated_at trigger for admins
CREATE TRIGGER update_admins_updated_at
    BEFORE UPDATE ON admins
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Updated_at trigger for platform_announcements
CREATE TRIGGER update_announcements_updated_at
    BEFORE UPDATE ON platform_announcements
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SEED INITIAL SUPER ADMIN (Optional - can be done via environment setup)
-- ============================================================================

-- Note: In production, create initial super admin via secure script
-- Example (commented out - execute separately with real credentials):
-- INSERT INTO admins (user_id, admin_role, created_at)
-- SELECT id, 'super_admin', NOW()
-- FROM users
-- WHERE email = 'admin@example.com'
-- ON CONFLICT (user_id) DO NOTHING;
