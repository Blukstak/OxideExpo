-- V4 Migration: Create Company Profile Tables
-- EmpleosInclusivos Company Management System
-- Creates company_profiles and company_members tables with multi-user support

-- ============================================================================
-- COMPANY PROFILES TABLE
-- ============================================================================

CREATE TABLE company_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Identity
    company_name VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255),
    tax_id VARCHAR(50) UNIQUE, -- RUT in Chile, must be unique

    -- Classification
    industry_id UUID REFERENCES industries(id),
    company_size VARCHAR(50), -- '1-10', '11-50', '51-200', '201-500', '500+'
    founded_year INTEGER CHECK (founded_year >= 1800 AND founded_year <= EXTRACT(YEAR FROM NOW())),

    -- Location
    region_id UUID REFERENCES regions(id),
    municipality_id UUID REFERENCES municipalities(id),
    address TEXT,
    phone VARCHAR(20),

    -- Online Presence
    website_url VARCHAR(500),
    linkedin_url VARCHAR(500),
    video_url VARCHAR(500),

    -- Media
    logo_url VARCHAR(500),
    cover_image_url VARCHAR(500),

    -- Profile Content
    description TEXT,
    mission TEXT,
    vision TEXT,
    culture TEXT,
    benefits TEXT,

    -- Status & Approval
    status organization_status NOT NULL DEFAULT 'pending_approval',
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES users(id),
    rejection_reason TEXT,

    -- Features
    is_featured BOOLEAN NOT NULL DEFAULT false,
    can_search_candidates BOOLEAN NOT NULL DEFAULT false,

    -- Profile Completeness
    completeness_percentage INTEGER NOT NULL DEFAULT 0 CHECK (completeness_percentage BETWEEN 0 AND 100),

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CHECK (
        status != 'rejected' OR rejection_reason IS NOT NULL
    ),
    CHECK (
        status != 'active' OR (approved_at IS NOT NULL AND approved_by IS NOT NULL)
    )
);

-- Indexes for performance
CREATE INDEX idx_company_profiles_name ON company_profiles(company_name);
CREATE INDEX idx_company_profiles_status ON company_profiles(status);
CREATE INDEX idx_company_profiles_industry ON company_profiles(industry_id);
CREATE INDEX idx_company_profiles_location ON company_profiles(region_id, municipality_id);
CREATE INDEX idx_company_profiles_completeness ON company_profiles(completeness_percentage);
CREATE INDEX idx_company_profiles_featured ON company_profiles(is_featured) WHERE is_featured = true;

-- Full-text search for company names and descriptions (Spanish language)
CREATE INDEX idx_company_profiles_search ON company_profiles
    USING gin(to_tsvector('spanish', coalesce(company_name, '') || ' ' || coalesce(description, '')));

-- Updated at trigger
CREATE TRIGGER update_company_profiles_updated_at
    BEFORE UPDATE ON company_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMPANY MEMBERS TABLE (Team Management)
-- ============================================================================

CREATE TABLE company_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES company_profiles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Role & Position
    role member_role NOT NULL DEFAULT 'member',
    job_title VARCHAR(100),

    -- Invitation & Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    invited_by UUID REFERENCES users(id),
    invited_at TIMESTAMPTZ,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Each user can only belong to one company
    UNIQUE(user_id),
    -- Each company+user combination must be unique (redundant but explicit)
    UNIQUE(company_id, user_id)
);

-- Indexes
CREATE INDEX idx_company_members_company ON company_members(company_id);
CREATE INDEX idx_company_members_user ON company_members(user_id);
CREATE INDEX idx_company_members_active ON company_members(company_id, is_active) WHERE is_active = true;
CREATE INDEX idx_company_members_role ON company_members(company_id, role);

-- Updated at trigger
CREATE TRIGGER update_company_members_updated_at
    BEFORE UPDATE ON company_members
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMPANY PROFILE COMPLETENESS CALCULATION
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_company_completeness(p_company_id UUID)
RETURNS INTEGER AS $$
DECLARE
    completeness INTEGER := 0;
    profile_exists BOOLEAN;
BEGIN
    -- Check if profile exists
    SELECT EXISTS(SELECT 1 FROM company_profiles WHERE id = p_company_id)
    INTO profile_exists;

    IF NOT profile_exists THEN
        RETURN 0;
    END IF;

    -- Basic Information (30 points)
    IF EXISTS(
        SELECT 1 FROM company_profiles
        WHERE id = p_company_id
        AND company_name IS NOT NULL
        AND legal_name IS NOT NULL
        AND tax_id IS NOT NULL
        AND phone IS NOT NULL
    ) THEN
        completeness := completeness + 30;
    END IF;

    -- Location (15 points)
    IF EXISTS(
        SELECT 1 FROM company_profiles
        WHERE id = p_company_id
        AND region_id IS NOT NULL
        AND municipality_id IS NOT NULL
        AND address IS NOT NULL
    ) THEN
        completeness := completeness + 15;
    END IF;

    -- Classification (10 points)
    IF EXISTS(
        SELECT 1 FROM company_profiles
        WHERE id = p_company_id
        AND industry_id IS NOT NULL
        AND company_size IS NOT NULL
    ) THEN
        completeness := completeness + 10;
    END IF;

    -- Description & Culture (20 points)
    IF EXISTS(
        SELECT 1 FROM company_profiles
        WHERE id = p_company_id
        AND description IS NOT NULL
        AND LENGTH(description) >= 100
    ) THEN
        completeness := completeness + 20;
    END IF;

    -- Logo (10 points)
    IF EXISTS(
        SELECT 1 FROM company_profiles
        WHERE id = p_company_id
        AND logo_url IS NOT NULL
    ) THEN
        completeness := completeness + 10;
    END IF;

    -- Online Presence (10 points)
    IF EXISTS(
        SELECT 1 FROM company_profiles
        WHERE id = p_company_id
        AND (website_url IS NOT NULL OR linkedin_url IS NOT NULL)
    ) THEN
        completeness := completeness + 10;
    END IF;

    -- Mission/Vision/Benefits (5 points)
    IF EXISTS(
        SELECT 1 FROM company_profiles
        WHERE id = p_company_id
        AND (mission IS NOT NULL OR vision IS NOT NULL OR benefits IS NOT NULL)
    ) THEN
        completeness := completeness + 5;
    END IF;

    -- Ensure doesn't exceed 100
    IF completeness > 100 THEN
        completeness := 100;
    END IF;

    -- Update the profile
    UPDATE company_profiles
    SET completeness_percentage = completeness
    WHERE id = p_company_id;

    RETURN completeness;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- AUTOMATIC COMPLETENESS UPDATE TRIGGERS
-- ============================================================================

-- Trigger function with recursion prevention (like job_seeker_profiles)
CREATE OR REPLACE FUNCTION trigger_recalculate_company_completeness()
RETURNS TRIGGER AS $$
BEGIN
    -- Only recalculate on INSERT or when completeness-relevant fields change
    IF TG_OP = 'INSERT' OR
       OLD.company_name IS DISTINCT FROM NEW.company_name OR
       OLD.legal_name IS DISTINCT FROM NEW.legal_name OR
       OLD.tax_id IS DISTINCT FROM NEW.tax_id OR
       OLD.phone IS DISTINCT FROM NEW.phone OR
       OLD.industry_id IS DISTINCT FROM NEW.industry_id OR
       OLD.company_size IS DISTINCT FROM NEW.company_size OR
       OLD.region_id IS DISTINCT FROM NEW.region_id OR
       OLD.municipality_id IS DISTINCT FROM NEW.municipality_id OR
       OLD.address IS DISTINCT FROM NEW.address OR
       OLD.description IS DISTINCT FROM NEW.description OR
       OLD.logo_url IS DISTINCT FROM NEW.logo_url OR
       OLD.website_url IS DISTINCT FROM NEW.website_url OR
       OLD.linkedin_url IS DISTINCT FROM NEW.linkedin_url OR
       OLD.mission IS DISTINCT FROM NEW.mission OR
       OLD.vision IS DISTINCT FROM NEW.vision OR
       OLD.benefits IS DISTINCT FROM NEW.benefits
    THEN
        PERFORM calculate_company_completeness(COALESCE(NEW.id, OLD.id));
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to company_profiles
CREATE TRIGGER recalc_completeness_on_company_change
    AFTER INSERT OR UPDATE ON company_profiles
    FOR EACH ROW
    EXECUTE FUNCTION trigger_recalculate_company_completeness();
