use sqlx::PgPool;
use uuid::Uuid;

use crate::error::{AppError, Result};
use crate::models::matching::*;

// ============================================================================
// MATCH SCORE WEIGHTS (out of 100 total)
// ============================================================================

const SKILLS_WEIGHT: i32 = 35;
const LANGUAGES_WEIGHT: i32 = 15;
const LOCATION_WEIGHT: i32 = 15;
const EXPERIENCE_WEIGHT: i32 = 15;
const EDUCATION_WEIGHT: i32 = 10;
const PREFERRED_SKILLS_WEIGHT: i32 = 5;
const ACCOMMODATIONS_WEIGHT: i32 = 5;

// ============================================================================
// EDUCATION LEVEL ORDERING
// ============================================================================

fn education_level_rank(level: &str) -> i32 {
    match level.to_lowercase().as_str() {
        "none" => 0,
        "primary" => 1,
        "secondary" => 2,
        "technical" => 3,
        "undergraduate" => 4,
        "graduate" => 5,
        "postgraduate" => 6,
        _ => 0,
    }
}

// ============================================================================
// LANGUAGE PROFICIENCY MAPPING (1-5 scale)
// ============================================================================

fn language_proficiency_to_int(proficiency: &str) -> i32 {
    match proficiency.to_lowercase().as_str() {
        "basic" => 1,
        "intermediate" => 2,
        "advanced" => 3,
        "fluent" => 4,
        "native" => 5,
        _ => 1,
    }
}

// ============================================================================
// INTERNAL DATA STRUCTURES
// ============================================================================

struct UserSkillData {
    skill_id: Uuid,
    proficiency_level: i32,
}

struct UserLanguageData {
    language_id: Uuid,
    proficiency: String,
}

struct JobRequiredSkillData {
    skill_id: Uuid,
    minimum_proficiency: i32,
}

struct JobRequiredLanguageData {
    language_id: Uuid,
    minimum_proficiency: i32,
}

struct JobLocationData {
    region_id: Option<Uuid>,
    municipality_id: Option<Uuid>,
    is_remote_allowed: bool,
    work_modality: String,
}

struct UserLocationData {
    region_id: Option<Uuid>,
    municipality_id: Option<Uuid>,
}

struct UserExperienceData {
    total_years: i32,
}

struct UserEducationData {
    highest_level: Option<String>,
}

struct UserDisabilityData {
    categories: Vec<String>,
    requires_accommodations: bool,
}

struct JobAccommodationData {
    categories: Vec<String>,
}

// ============================================================================
// MATCHING SERVICE
// ============================================================================

pub struct MatchingService;

impl MatchingService {
    // Calculate full match score between a job and a user
    pub async fn calculate_match_score(
        db: &PgPool,
        job_id: Uuid,
        user_id: Uuid,
    ) -> Result<MatchScoreBreakdown> {
        // Fetch all required data in parallel
        let (
            user_skills,
            user_languages,
            job_required_skills,
            job_preferred_skills,
            job_required_languages,
            job_location,
            user_location,
            user_experience,
            user_education,
            user_disability,
            job_accommodations,
            user_preferences,
        ) = tokio::try_join!(
            Self::get_user_skills(db, user_id),
            Self::get_user_languages(db, user_id),
            Self::get_job_required_skills(db, job_id),
            Self::get_job_preferred_skills(db, job_id),
            Self::get_job_required_languages(db, job_id),
            Self::get_job_location(db, job_id),
            Self::get_user_location(db, user_id),
            Self::get_user_experience(db, user_id),
            Self::get_user_education(db, user_id),
            Self::get_user_disability(db, user_id),
            Self::get_job_accommodations(db, job_id),
            Self::get_user_preferences(db, user_id),
        )?;

        // Get job experience requirements
        let job_experience = Self::get_job_experience_requirements(db, job_id).await?;
        let job_education = Self::get_job_education_requirement(db, job_id).await?;

        // Calculate each component
        let skills_detail = Self::calculate_skills_score(
            &user_skills,
            &job_required_skills,
            &job_preferred_skills,
        );

        let languages_detail =
            Self::calculate_languages_score(&user_languages, &job_required_languages);

        let location_detail = Self::calculate_location_score(
            &user_location,
            &job_location,
            user_preferences.as_ref().map(|p| p.willing_to_relocate).unwrap_or(false),
        );

        let experience_detail =
            Self::calculate_experience_score(&user_experience, job_experience.0, job_experience.1);

        let education_detail =
            Self::calculate_education_score(&user_education, &job_education);

        let accommodations_detail =
            Self::calculate_accommodations_score(&user_disability, &job_accommodations);

        // Calculate total score
        let total_score = skills_detail.score
            + languages_detail.score
            + location_detail.score
            + experience_detail.score
            + education_detail.score
            + skills_detail.score // preferred skills is part of skills_detail
            + accommodations_detail.score;

        Ok(MatchScoreBreakdown {
            total_score: total_score.min(100),
            skills: skills_detail,
            languages: languages_detail,
            location: location_detail,
            experience: experience_detail,
            education: education_detail,
            accommodations: accommodations_detail,
        })
    }

    // Calculate skills score (35 points max)
    fn calculate_skills_score(
        user_skills: &[UserSkillData],
        job_required_skills: &[JobRequiredSkillData],
        job_preferred_skills: &[Uuid],
    ) -> SkillsMatchDetail {
        let mut matched_required = Vec::new();
        let mut missing_required = Vec::new();
        let mut matched_preferred = Vec::new();

        // Check required skills
        for required in job_required_skills {
            if let Some(user_skill) = user_skills
                .iter()
                .find(|s| s.skill_id == required.skill_id)
            {
                if user_skill.proficiency_level >= required.minimum_proficiency {
                    matched_required.push(MatchedSkill {
                        skill_id: required.skill_id,
                        required_proficiency: required.minimum_proficiency,
                        user_proficiency: user_skill.proficiency_level,
                    });
                } else {
                    missing_required.push(MissingSkill {
                        skill_id: required.skill_id,
                        required_proficiency: required.minimum_proficiency,
                    });
                }
            } else {
                missing_required.push(MissingSkill {
                    skill_id: required.skill_id,
                    required_proficiency: required.minimum_proficiency,
                });
            }
        }

        // Check preferred skills
        for preferred_id in job_preferred_skills {
            if user_skills.iter().any(|s| &s.skill_id == preferred_id) {
                matched_preferred.push(*preferred_id);
            }
        }

        // Calculate score
        let required_score = if job_required_skills.is_empty() {
            SKILLS_WEIGHT - PREFERRED_SKILLS_WEIGHT // Full score if no requirements
        } else {
            let ratio = matched_required.len() as f64 / job_required_skills.len() as f64;
            ((SKILLS_WEIGHT - PREFERRED_SKILLS_WEIGHT) as f64 * ratio) as i32
        };

        let preferred_score = if job_preferred_skills.is_empty() {
            PREFERRED_SKILLS_WEIGHT
        } else {
            let ratio = matched_preferred.len() as f64 / job_preferred_skills.len() as f64;
            (PREFERRED_SKILLS_WEIGHT as f64 * ratio) as i32
        };

        SkillsMatchDetail {
            score: required_score + preferred_score,
            max_score: SKILLS_WEIGHT,
            matched_required,
            missing_required,
            matched_preferred,
        }
    }

    // Calculate languages score (15 points max)
    fn calculate_languages_score(
        user_languages: &[UserLanguageData],
        job_required_languages: &[JobRequiredLanguageData],
    ) -> LanguagesMatchDetail {
        let mut matched = Vec::new();
        let mut missing = Vec::new();

        for required in job_required_languages {
            if let Some(user_lang) = user_languages
                .iter()
                .find(|l| l.language_id == required.language_id)
            {
                let user_proficiency = language_proficiency_to_int(&user_lang.proficiency);
                if user_proficiency >= required.minimum_proficiency {
                    matched.push(MatchedLanguage {
                        language_id: required.language_id,
                        required_proficiency: required.minimum_proficiency,
                        user_proficiency,
                    });
                } else {
                    missing.push(MissingLanguage {
                        language_id: required.language_id,
                        required_proficiency: required.minimum_proficiency,
                    });
                }
            } else {
                missing.push(MissingLanguage {
                    language_id: required.language_id,
                    required_proficiency: required.minimum_proficiency,
                });
            }
        }

        let score = if job_required_languages.is_empty() {
            LANGUAGES_WEIGHT
        } else {
            let ratio = matched.len() as f64 / job_required_languages.len() as f64;
            (LANGUAGES_WEIGHT as f64 * ratio) as i32
        };

        LanguagesMatchDetail {
            score,
            max_score: LANGUAGES_WEIGHT,
            matched,
            missing,
        }
    }

    // Calculate location score (15 points max)
    fn calculate_location_score(
        user_location: &UserLocationData,
        job_location: &JobLocationData,
        willing_to_relocate: bool,
    ) -> LocationMatchDetail {
        let is_remote_compatible =
            job_location.is_remote_allowed || job_location.work_modality == "remote";

        let is_same_municipality = user_location.municipality_id.is_some()
            && job_location.municipality_id.is_some()
            && user_location.municipality_id == job_location.municipality_id;

        let is_same_region = user_location.region_id.is_some()
            && job_location.region_id.is_some()
            && user_location.region_id == job_location.region_id;

        let score = if is_same_municipality {
            LOCATION_WEIGHT // Full points for same municipality
        } else if is_same_region {
            (LOCATION_WEIGHT as f64 * 0.8) as i32 // 80% for same region
        } else if is_remote_compatible {
            LOCATION_WEIGHT // Full points if remote is allowed
        } else if willing_to_relocate {
            (LOCATION_WEIGHT as f64 * 0.6) as i32 // 60% if willing to relocate
        } else {
            0 // No location match
        };

        LocationMatchDetail {
            score,
            max_score: LOCATION_WEIGHT,
            is_same_region,
            is_same_municipality,
            is_remote_compatible,
            willing_to_relocate,
        }
    }

    // Calculate experience score (15 points max)
    fn calculate_experience_score(
        user_experience: &UserExperienceData,
        required_min: Option<i32>,
        required_max: Option<i32>,
    ) -> ExperienceMatchDetail {
        let user_years = user_experience.total_years;

        let is_within_range = match (required_min, required_max) {
            (Some(min), Some(max)) => user_years >= min && user_years <= max,
            (Some(min), None) => user_years >= min,
            (None, Some(max)) => user_years <= max,
            (None, None) => true, // No requirements = full match
        };

        let score = if is_within_range {
            EXPERIENCE_WEIGHT
        } else {
            // Partial credit for being close
            match (required_min, required_max) {
                (Some(min), _) if user_years < min => {
                    let diff = min - user_years;
                    if diff <= 2 {
                        (EXPERIENCE_WEIGHT as f64 * 0.5) as i32
                    } else {
                        0
                    }
                }
                (_, Some(max)) if user_years > max => {
                    let diff = user_years - max;
                    if diff <= 3 {
                        (EXPERIENCE_WEIGHT as f64 * 0.7) as i32 // Overqualified is okay
                    } else {
                        (EXPERIENCE_WEIGHT as f64 * 0.5) as i32
                    }
                }
                _ => 0,
            }
        };

        ExperienceMatchDetail {
            score,
            max_score: EXPERIENCE_WEIGHT,
            user_years,
            required_min,
            required_max,
            is_within_range,
        }
    }

    // Calculate education score (10 points max)
    fn calculate_education_score(
        user_education: &UserEducationData,
        required_level: &Option<String>,
    ) -> EducationMatchDetail {
        let user_level = user_education.highest_level.clone();

        let meets_requirement = match (&user_level, required_level) {
            (Some(user), Some(required)) => {
                education_level_rank(user) >= education_level_rank(required)
            }
            (_, None) => true, // No requirement = full match
            (None, Some(_)) => false, // User has no education data
        };

        let score = if meets_requirement {
            EDUCATION_WEIGHT
        } else if let (Some(user), Some(required)) = (&user_level, required_level) {
            // Partial credit
            let user_rank = education_level_rank(user);
            let required_rank = education_level_rank(required);
            if required_rank > 0 {
                let ratio = user_rank as f64 / required_rank as f64;
                (EDUCATION_WEIGHT as f64 * ratio.min(1.0)) as i32
            } else {
                EDUCATION_WEIGHT
            }
        } else {
            0
        };

        EducationMatchDetail {
            score,
            max_score: EDUCATION_WEIGHT,
            user_level,
            required_level: required_level.clone(),
            meets_requirement,
        }
    }

    // Calculate accommodations score (5 points max)
    fn calculate_accommodations_score(
        user_disability: &UserDisabilityData,
        job_accommodations: &JobAccommodationData,
    ) -> AccommodationsMatchDetail {
        if !user_disability.requires_accommodations {
            // User doesn't need accommodations - full points
            return AccommodationsMatchDetail {
                score: ACCOMMODATIONS_WEIGHT,
                max_score: ACCOMMODATIONS_WEIGHT,
                user_needs_accommodations: false,
                job_provides_accommodations: !job_accommodations.categories.is_empty(),
                matching_categories: Vec::new(),
            };
        }

        // Find matching categories
        let matching_categories: Vec<String> = user_disability
            .categories
            .iter()
            .filter(|cat| job_accommodations.categories.contains(cat))
            .cloned()
            .collect();

        let job_provides = !job_accommodations.categories.is_empty();

        let score = if user_disability.categories.is_empty() {
            ACCOMMODATIONS_WEIGHT
        } else if matching_categories.len() == user_disability.categories.len() {
            ACCOMMODATIONS_WEIGHT // All accommodations provided
        } else if !matching_categories.is_empty() {
            // Partial match
            let ratio = matching_categories.len() as f64 / user_disability.categories.len() as f64;
            (ACCOMMODATIONS_WEIGHT as f64 * ratio) as i32
        } else if job_provides {
            // Job provides some accommodations but not what user needs
            (ACCOMMODATIONS_WEIGHT as f64 * 0.3) as i32
        } else {
            0
        };

        AccommodationsMatchDetail {
            score,
            max_score: ACCOMMODATIONS_WEIGHT,
            user_needs_accommodations: true,
            job_provides_accommodations: job_provides,
            matching_categories,
        }
    }

    // ============================================================================
    // DATA FETCHING FUNCTIONS
    // ============================================================================

    async fn get_user_skills(db: &PgPool, user_id: Uuid) -> Result<Vec<UserSkillData>> {
        let skills = sqlx::query_as!(
            UserSkillData,
            r#"
            SELECT skill_id, proficiency_level
            FROM user_skills
            WHERE user_id = $1
            "#,
            user_id
        )
        .fetch_all(db)
        .await?;

        Ok(skills)
    }

    async fn get_user_languages(db: &PgPool, user_id: Uuid) -> Result<Vec<UserLanguageData>> {
        let languages = sqlx::query!(
            r#"
            SELECT language_id, proficiency as "proficiency: String"
            FROM user_languages
            WHERE user_id = $1
            "#,
            user_id
        )
        .fetch_all(db)
        .await?;

        Ok(languages
            .into_iter()
            .map(|r| UserLanguageData {
                language_id: r.language_id,
                proficiency: r.proficiency,
            })
            .collect())
    }

    async fn get_job_required_skills(db: &PgPool, job_id: Uuid) -> Result<Vec<JobRequiredSkillData>> {
        let skills = sqlx::query_as!(
            JobRequiredSkillData,
            r#"
            SELECT skill_id, minimum_proficiency
            FROM job_required_skills
            WHERE job_id = $1
            "#,
            job_id
        )
        .fetch_all(db)
        .await?;

        Ok(skills)
    }

    async fn get_job_preferred_skills(db: &PgPool, job_id: Uuid) -> Result<Vec<Uuid>> {
        let skills = sqlx::query_scalar!(
            r#"
            SELECT skill_id
            FROM job_preferred_skills
            WHERE job_id = $1
            "#,
            job_id
        )
        .fetch_all(db)
        .await?;

        Ok(skills)
    }

    async fn get_job_required_languages(
        db: &PgPool,
        job_id: Uuid,
    ) -> Result<Vec<JobRequiredLanguageData>> {
        let languages = sqlx::query_as!(
            JobRequiredLanguageData,
            r#"
            SELECT language_id, minimum_proficiency
            FROM job_required_languages
            WHERE job_id = $1
            "#,
            job_id
        )
        .fetch_all(db)
        .await?;

        Ok(languages)
    }

    async fn get_job_location(db: &PgPool, job_id: Uuid) -> Result<JobLocationData> {
        let location = sqlx::query!(
            r#"
            SELECT
                region_id,
                municipality_id,
                COALESCE(is_remote_allowed, false) as "is_remote_allowed!",
                work_modality as "work_modality: String"
            FROM jobs
            WHERE id = $1
            "#,
            job_id
        )
        .fetch_optional(db)
        .await?
        .ok_or_else(|| AppError::NotFound("Job not found".to_string()))?;

        Ok(JobLocationData {
            region_id: location.region_id,
            municipality_id: location.municipality_id,
            is_remote_allowed: location.is_remote_allowed,
            work_modality: location.work_modality,
        })
    }

    async fn get_user_location(db: &PgPool, user_id: Uuid) -> Result<UserLocationData> {
        let location = sqlx::query!(
            r#"
            SELECT region_id, municipality_id
            FROM job_seeker_profiles
            WHERE user_id = $1
            "#,
            user_id
        )
        .fetch_optional(db)
        .await?;

        Ok(match location {
            Some(l) => UserLocationData {
                region_id: l.region_id,
                municipality_id: l.municipality_id,
            },
            None => UserLocationData {
                region_id: None,
                municipality_id: None,
            },
        })
    }

    async fn get_user_experience(db: &PgPool, user_id: Uuid) -> Result<UserExperienceData> {
        // Calculate total years from work experiences
        let result = sqlx::query!(
            r#"
            SELECT COALESCE(
                SUM(
                    EXTRACT(YEAR FROM AGE(
                        COALESCE(end_date, CURRENT_DATE),
                        start_date
                    ))
                )::INTEGER,
                0
            ) as "total_years!"
            FROM work_experiences
            WHERE user_id = $1
            "#,
            user_id
        )
        .fetch_one(db)
        .await?;

        Ok(UserExperienceData {
            total_years: result.total_years,
        })
    }

    async fn get_user_education(db: &PgPool, user_id: Uuid) -> Result<UserEducationData> {
        // Get highest education level
        let result = sqlx::query!(
            r#"
            SELECT level as "level: String"
            FROM education_records
            WHERE user_id = $1
            ORDER BY
                CASE level
                    WHEN 'postgraduate' THEN 7
                    WHEN 'graduate' THEN 6
                    WHEN 'undergraduate' THEN 5
                    WHEN 'technical' THEN 4
                    WHEN 'secondary' THEN 3
                    WHEN 'primary' THEN 2
                    WHEN 'none' THEN 1
                    ELSE 0
                END DESC
            LIMIT 1
            "#,
            user_id
        )
        .fetch_optional(db)
        .await?;

        Ok(UserEducationData {
            highest_level: result.map(|r| r.level),
        })
    }

    async fn get_user_disability(db: &PgPool, user_id: Uuid) -> Result<UserDisabilityData> {
        let disabilities = sqlx::query!(
            r#"
            SELECT
                category as "category: String",
                requires_accommodations
            FROM job_seeker_disabilities
            WHERE user_id = $1
            "#,
            user_id
        )
        .fetch_all(db)
        .await?;

        if disabilities.is_empty() {
            return Ok(UserDisabilityData {
                categories: Vec::new(),
                requires_accommodations: false,
            });
        }

        let requires = disabilities.iter().any(|d| d.requires_accommodations);
        let categories: Vec<String> = disabilities.into_iter().map(|d| d.category).collect();

        Ok(UserDisabilityData {
            categories,
            requires_accommodations: requires,
        })
    }

    async fn get_job_accommodations(db: &PgPool, job_id: Uuid) -> Result<JobAccommodationData> {
        let accommodations = sqlx::query!(
            r#"
            SELECT disability_category as "category: String"
            FROM job_disability_accommodations
            WHERE job_id = $1
            "#,
            job_id
        )
        .fetch_all(db)
        .await?;

        Ok(JobAccommodationData {
            categories: accommodations.into_iter().map(|a| a.category).collect(),
        })
    }

    async fn get_job_experience_requirements(
        db: &PgPool,
        job_id: Uuid,
    ) -> Result<(Option<i32>, Option<i32>)> {
        let result = sqlx::query!(
            r#"
            SELECT years_experience_min, years_experience_max
            FROM jobs
            WHERE id = $1
            "#,
            job_id
        )
        .fetch_optional(db)
        .await?
        .ok_or_else(|| AppError::NotFound("Job not found".to_string()))?;

        Ok((result.years_experience_min, result.years_experience_max))
    }

    async fn get_job_education_requirement(db: &PgPool, job_id: Uuid) -> Result<Option<String>> {
        let result = sqlx::query!(
            r#"
            SELECT education_level
            FROM jobs
            WHERE id = $1
            "#,
            job_id
        )
        .fetch_optional(db)
        .await?
        .ok_or_else(|| AppError::NotFound("Job not found".to_string()))?;

        Ok(result.education_level)
    }

    async fn get_user_preferences(
        db: &PgPool,
        user_id: Uuid,
    ) -> Result<Option<JobSeekerPreferences>> {
        let result = sqlx::query!(
            r#"
            SELECT
                user_id,
                willing_to_relocate,
                salary_expectation_min,
                salary_expectation_max,
                COALESCE(salary_currency, 'CLP') as "salary_currency!",
                profile_visibility as "profile_visibility: ProfileVisibility",
                show_disability_info,
                email_job_alerts,
                alert_frequency as "alert_frequency: AlertFrequency",
                created_at,
                updated_at
            FROM job_seeker_preferences
            WHERE user_id = $1
            "#,
            user_id
        )
        .fetch_optional(db)
        .await?;

        Ok(result.map(|r| JobSeekerPreferences {
            user_id: r.user_id,
            preferred_work_modalities: Vec::new(), // Would need separate query
            preferred_job_types: Vec::new(),
            preferred_region_ids: Vec::new(),
            preferred_industry_ids: Vec::new(),
            willing_to_relocate: r.willing_to_relocate.unwrap_or(false),
            salary_expectation_min: r.salary_expectation_min,
            salary_expectation_max: r.salary_expectation_max,
            salary_currency: r.salary_currency,
            profile_visibility: r.profile_visibility,
            show_disability_info: r.show_disability_info,
            email_job_alerts: r.email_job_alerts,
            alert_frequency: r.alert_frequency,
            created_at: r.created_at,
            updated_at: r.updated_at,
        }))
    }

    // ============================================================================
    // CACHE MANAGEMENT
    // ============================================================================

    pub async fn save_match_score(
        db: &PgPool,
        job_id: Uuid,
        user_id: Uuid,
        breakdown: &MatchScoreBreakdown,
    ) -> Result<()> {
        sqlx::query!(
            r#"
            INSERT INTO job_match_scores (
                job_id, user_id, total_score,
                skills_score, languages_score, location_score,
                experience_score, education_score, preferred_skills_score,
                accommodations_score, computed_at, is_stale
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), false)
            ON CONFLICT (job_id, user_id)
            DO UPDATE SET
                total_score = $3,
                skills_score = $4,
                languages_score = $5,
                location_score = $6,
                experience_score = $7,
                education_score = $8,
                preferred_skills_score = $9,
                accommodations_score = $10,
                computed_at = NOW(),
                is_stale = false,
                updated_at = NOW()
            "#,
            job_id,
            user_id,
            breakdown.total_score,
            breakdown.skills.score,
            breakdown.languages.score,
            breakdown.location.score,
            breakdown.experience.score,
            breakdown.education.score,
            breakdown.skills.matched_preferred.len() as i32, // Preferred skills contribution
            breakdown.accommodations.score
        )
        .execute(db)
        .await?;

        Ok(())
    }

    pub async fn get_cached_score(
        db: &PgPool,
        job_id: Uuid,
        user_id: Uuid,
    ) -> Result<Option<JobMatchScore>> {
        let score = sqlx::query_as!(
            JobMatchScore,
            r#"
            SELECT
                id, job_id, user_id, total_score,
                skills_score, languages_score, location_score,
                experience_score, education_score, preferred_skills_score,
                accommodations_score, computed_at, is_stale, created_at, updated_at
            FROM job_match_scores
            WHERE job_id = $1 AND user_id = $2 AND is_stale = false
            "#,
            job_id,
            user_id
        )
        .fetch_optional(db)
        .await?;

        Ok(score)
    }

    pub async fn check_already_applied(db: &PgPool, job_id: Uuid, user_id: Uuid) -> Result<bool> {
        let result = sqlx::query_scalar!(
            r#"
            SELECT EXISTS(
                SELECT 1 FROM job_applications
                WHERE job_id = $1 AND applicant_id = $2
            ) as "exists!"
            "#,
            job_id,
            user_id
        )
        .fetch_one(db)
        .await?;

        Ok(result)
    }
}
