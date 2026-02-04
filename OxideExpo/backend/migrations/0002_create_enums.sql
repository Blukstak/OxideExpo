-- V1 Migration: Create Enum Types
-- EmpleosInclusivos Infrastructure

-- ============================================================================
-- USER ENUMS
-- ============================================================================

CREATE TYPE user_type AS ENUM (
    'job_seeker',
    'company_member',
    'omil_member',
    'admin'
);

CREATE TYPE account_status AS ENUM (
    'pending_verification',
    'active',
    'suspended',
    'deactivated'
);

CREATE TYPE gender AS ENUM (
    'male',
    'female',
    'non_binary',
    'prefer_not_to_say'
);

CREATE TYPE marital_status AS ENUM (
    'single',
    'married',
    'divorced',
    'widowed',
    'domestic_partnership'
);

-- ============================================================================
-- ORGANIZATION ENUMS
-- ============================================================================

CREATE TYPE organization_status AS ENUM (
    'pending_approval',
    'active',
    'suspended',
    'rejected'
);

CREATE TYPE member_role AS ENUM (
    'owner',
    'admin',
    'member'
);

-- ============================================================================
-- JOB ENUMS
-- ============================================================================

CREATE TYPE job_type AS ENUM (
    'full_time',
    'part_time',
    'contract',
    'internship',
    'apprenticeship',
    'temporary'
);

CREATE TYPE job_status AS ENUM (
    'draft',
    'pending_approval',
    'active',
    'paused',
    'closed',
    'rejected'
);

CREATE TYPE work_modality AS ENUM (
    'on_site',
    'remote',
    'hybrid'
);

-- ============================================================================
-- APPLICATION ENUMS
-- ============================================================================

CREATE TYPE application_status AS ENUM (
    'submitted',
    'under_review',
    'shortlisted',
    'interview_scheduled',
    'offer_extended',
    'hired',
    'rejected',
    'withdrawn'
);

-- ============================================================================
-- PROFILE ENUMS
-- ============================================================================

CREATE TYPE disability_category AS ENUM (
    'physical_mobility',
    'visual',
    'hearing',
    'cognitive',
    'psychosocial',
    'speech',
    'multiple',
    'other'
);

CREATE TYPE education_level AS ENUM (
    'none',
    'primary',
    'secondary',
    'technical',
    'undergraduate',
    'graduate',
    'postgraduate'
);

CREATE TYPE education_status AS ENUM (
    'in_progress',
    'completed',
    'incomplete'
);

CREATE TYPE language_proficiency AS ENUM (
    'basic',
    'intermediate',
    'advanced',
    'fluent',
    'native'
);

-- ============================================================================
-- SCREENING ENUMS
-- ============================================================================

CREATE TYPE question_type AS ENUM (
    'text',
    'single_choice',
    'multiple_choice',
    'yes_no',
    'numeric'
);
