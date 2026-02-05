use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, Type};
use ts_rs::TS;
use uuid::Uuid;
use validator::Validate;

use super::job::{JobType, PublicJobListing, WorkModality};
use super::profile::JobSeekerProfile;

// ============================================================================
// ENUMS (matching PostgreSQL enums from 0011_create_matching_tables.sql)
// ============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type, TS)]
#[sqlx(type_name = "profile_visibility", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
#[ts(export, export_to = "../frontend/src/types/")]
pub enum ProfileVisibility {
    Visible,
    Hidden,
    AppliedOnly,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type, TS)]
#[sqlx(type_name = "alert_frequency", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
#[ts(export, export_to = "../frontend/src/types/")]
pub enum AlertFrequency {
    Instant,
    Daily,
    Weekly,
    Never,
}

// ============================================================================
// CORE STRUCTS
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct JobSeekerPreferences {
    pub user_id: Uuid,

    // Job Preferences (stored as arrays in PostgreSQL)
    #[sqlx(skip)]
    pub preferred_work_modalities: Vec<WorkModality>,
    #[sqlx(skip)]
    pub preferred_job_types: Vec<JobType>,
    #[sqlx(skip)]
    pub preferred_region_ids: Vec<Uuid>,
    #[sqlx(skip)]
    pub preferred_industry_ids: Vec<Uuid>,
    pub willing_to_relocate: bool,

    // Salary Expectations
    #[ts(skip)]
    #[serde(with = "rust_decimal::serde::str_option")]
    pub salary_expectation_min: Option<Decimal>,
    #[ts(skip)]
    #[serde(with = "rust_decimal::serde::str_option")]
    pub salary_expectation_max: Option<Decimal>,
    pub salary_currency: String,

    // Privacy Controls
    pub profile_visibility: ProfileVisibility,
    pub show_disability_info: bool,

    // Alert Settings
    pub email_job_alerts: bool,
    pub alert_frequency: AlertFrequency,

    // Timestamps
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct JobMatchScore {
    pub id: Uuid,
    pub job_id: Uuid,
    pub user_id: Uuid,

    // Overall Score
    pub total_score: i32,

    // Component Scores
    pub skills_score: i32,
    pub languages_score: i32,
    pub location_score: i32,
    pub experience_score: i32,
    pub education_score: i32,
    pub preferred_skills_score: i32,
    pub accommodations_score: i32,

    // Cache Management
    pub computed_at: DateTime<Utc>,
    pub is_stale: bool,

    // Timestamps
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ============================================================================
// MATCH SCORE BREAKDOWN DTOs
// ============================================================================

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct MatchScoreBreakdown {
    pub total_score: i32,
    pub skills: SkillsMatchDetail,
    pub languages: LanguagesMatchDetail,
    pub location: LocationMatchDetail,
    pub experience: ExperienceMatchDetail,
    pub education: EducationMatchDetail,
    pub accommodations: AccommodationsMatchDetail,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct SkillsMatchDetail {
    pub score: i32,
    pub max_score: i32,
    pub matched_required: Vec<MatchedSkill>,
    pub missing_required: Vec<MissingSkill>,
    pub matched_preferred: Vec<Uuid>,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct MatchedSkill {
    pub skill_id: Uuid,
    pub required_proficiency: i32,
    pub user_proficiency: i32,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct MissingSkill {
    pub skill_id: Uuid,
    pub required_proficiency: i32,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct LanguagesMatchDetail {
    pub score: i32,
    pub max_score: i32,
    pub matched: Vec<MatchedLanguage>,
    pub missing: Vec<MissingLanguage>,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct MatchedLanguage {
    pub language_id: Uuid,
    pub required_proficiency: i32,
    pub user_proficiency: i32,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct MissingLanguage {
    pub language_id: Uuid,
    pub required_proficiency: i32,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct LocationMatchDetail {
    pub score: i32,
    pub max_score: i32,
    pub is_same_region: bool,
    pub is_same_municipality: bool,
    pub is_remote_compatible: bool,
    pub willing_to_relocate: bool,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct ExperienceMatchDetail {
    pub score: i32,
    pub max_score: i32,
    pub user_years: i32,
    pub required_min: Option<i32>,
    pub required_max: Option<i32>,
    pub is_within_range: bool,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct EducationMatchDetail {
    pub score: i32,
    pub max_score: i32,
    pub user_level: Option<String>,
    pub required_level: Option<String>,
    pub meets_requirement: bool,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct AccommodationsMatchDetail {
    pub score: i32,
    pub max_score: i32,
    pub user_needs_accommodations: bool,
    pub job_provides_accommodations: bool,
    pub matching_categories: Vec<String>,
}

// ============================================================================
// RESPONSE DTOs
// ============================================================================

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct RecommendedJob {
    pub job: PublicJobListing,
    pub match_score: i32,
    pub score_breakdown: MatchScoreBreakdown,
    pub already_applied: bool,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct RecommendedCandidate {
    pub profile: JobSeekerProfile,
    pub user_name: String,
    pub user_email: Option<String>,
    pub match_score: i32,
    pub score_breakdown: MatchScoreBreakdown,
    pub has_applied: bool,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct JobMatchScoreResponse {
    pub job_id: Uuid,
    pub match_score: i32,
    pub score_breakdown: MatchScoreBreakdown,
    pub already_applied: bool,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct RecommendedJobsResponse {
    pub jobs: Vec<RecommendedJob>,
    pub total_count: i64,
    pub has_more: bool,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct RecommendedCandidatesResponse {
    pub candidates: Vec<RecommendedCandidate>,
    pub total_count: i64,
    pub has_more: bool,
}

// ============================================================================
// REQUEST DTOs
// ============================================================================

#[derive(Debug, Deserialize, Validate, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct UpdatePreferencesRequest {
    // Job Preferences
    pub preferred_work_modalities: Option<Vec<WorkModality>>,
    pub preferred_job_types: Option<Vec<JobType>>,
    pub preferred_region_ids: Option<Vec<Uuid>>,
    pub preferred_industry_ids: Option<Vec<Uuid>>,
    pub willing_to_relocate: Option<bool>,

    // Salary Expectations
    #[ts(skip)]
    pub salary_expectation_min: Option<Decimal>,
    #[ts(skip)]
    pub salary_expectation_max: Option<Decimal>,

    #[validate(length(min = 3, max = 3, message = "Currency must be 3 characters"))]
    pub salary_currency: Option<String>,

    // Privacy Controls
    pub profile_visibility: Option<ProfileVisibility>,
    pub show_disability_info: Option<bool>,

    // Alert Settings
    pub email_job_alerts: Option<bool>,
    pub alert_frequency: Option<AlertFrequency>,
}

// ============================================================================
// QUERY PARAMETERS
// ============================================================================

#[derive(Debug, Deserialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct RecommendedJobsQuery {
    pub min_score: Option<i32>,
    pub exclude_applied: Option<bool>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Deserialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct RecommendedCandidatesQuery {
    pub min_score: Option<i32>,
    pub include_applied_only: Option<bool>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}
