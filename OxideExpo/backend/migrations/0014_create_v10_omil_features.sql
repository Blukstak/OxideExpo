-- V10: OMIL Integration - Remaining Features
-- Migration 0014

-- ============================================================================
-- IMPERSONATION TRACKING
-- ============================================================================

-- Track impersonation sessions for audit purposes
CREATE TABLE IF NOT EXISTS omil_impersonation_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    omil_member_id UUID NOT NULL REFERENCES omil_members(id) ON DELETE CASCADE,
    job_seeker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_jti UUID NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE
);

-- Index for token validation
CREATE INDEX IF NOT EXISTS idx_impersonation_jti ON omil_impersonation_sessions(token_jti);

-- Index for audit queries
CREATE INDEX IF NOT EXISTS idx_impersonation_member ON omil_impersonation_sessions(omil_member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_impersonation_seeker ON omil_impersonation_sessions(job_seeker_id, created_at DESC);
