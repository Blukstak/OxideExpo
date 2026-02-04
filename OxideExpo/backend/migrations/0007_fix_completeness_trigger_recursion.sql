-- Migration 0007: Fix infinite recursion in profile completeness trigger
-- Problem: The trigger on job_seeker_profiles fires even when only completeness_percentage
--          is updated, causing calculate_profile_completeness to call itself infinitely.
-- Solution: Modify the trigger function to check if relevant fields changed before recalculating.

-- Drop the problematic trigger
DROP TRIGGER IF EXISTS recalc_completeness_on_profile_change ON job_seeker_profiles;

-- Recreate the trigger function with recursion prevention
CREATE OR REPLACE FUNCTION trigger_recalculate_completeness_on_profile()
RETURNS TRIGGER AS $$
BEGIN
    -- Only recalculate on INSERT or when completeness-relevant fields change
    IF TG_OP = 'INSERT' OR
       OLD.phone IS DISTINCT FROM NEW.phone OR
       OLD.date_of_birth IS DISTINCT FROM NEW.date_of_birth OR
       OLD.region_id IS DISTINCT FROM NEW.region_id OR
       OLD.municipality_id IS DISTINCT FROM NEW.municipality_id OR
       OLD.professional_headline IS DISTINCT FROM NEW.professional_headline OR
       OLD.bio IS DISTINCT FROM NEW.bio OR
       OLD.profile_image_url IS DISTINCT FROM NEW.profile_image_url OR
       OLD.cv_url IS DISTINCT FROM NEW.cv_url
    THEN
        PERFORM calculate_profile_completeness(COALESCE(NEW.user_id, OLD.user_id));
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger using the new function
CREATE TRIGGER recalc_completeness_on_profile_change
    AFTER INSERT OR UPDATE ON job_seeker_profiles
    FOR EACH ROW
    EXECUTE FUNCTION trigger_recalculate_completeness_on_profile();
