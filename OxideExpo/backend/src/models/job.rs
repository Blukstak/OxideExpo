use chrono::{DateTime, NaiveDate, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, Type};
use ts_rs::TS;
use uuid::Uuid;
use validator::Validate;

use super::profile::DisabilityCategory;

// ============================================================================
// ENUMS (matching PostgreSQL enums from 0002_create_enums.sql)
// ============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type, TS)]
#[sqlx(type_name = "job_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
#[ts(export, export_to = "../frontend/src/types/")]
pub enum JobType {
    FullTime,
    PartTime,
    Contract,
    Temporary,
    Internship,
    Freelance,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type, TS)]
#[sqlx(type_name = "job_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
#[ts(export, export_to = "../frontend/src/types/")]
pub enum JobStatus {
    Draft,
    PendingApproval,
    Active,
    Paused,
    Closed,
    Rejected,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type, TS)]
#[sqlx(type_name = "work_modality", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
#[ts(export, export_to = "../frontend/src/types/")]
pub enum WorkModality {
    OnSite,
    Remote,
    Hybrid,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export, export_to = "../frontend/src/types/")]
pub enum SalaryPeriod {
    Hourly,
    Daily,
    Weekly,
    Biweekly,
    Monthly,
    Yearly,
}

// ============================================================================
// CORE JOB STRUCT
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct Job {
    // Identity
    pub id: Uuid,
    pub company_id: Uuid,
    pub posted_by: Uuid,

    // Core Information
    pub title: String,
    pub description: String,
    pub responsibilities: Option<String>,

    // Classification
    pub job_type: JobType,
    pub industry_id: Option<Uuid>,
    pub work_area_id: Option<Uuid>,
    pub position_level_id: Option<Uuid>,

    // Work Arrangement
    pub work_modality: WorkModality,
    pub work_schedule: Option<String>,

    // Location
    pub region_id: Option<Uuid>,
    pub municipality_id: Option<Uuid>,
    pub is_remote_allowed: Option<bool>,

    // Requirements
    pub education_level: Option<String>,
    pub years_experience_min: Option<i32>,
    pub years_experience_max: Option<i32>,
    pub age_min: Option<i32>,
    pub age_max: Option<i32>,

    // Compensation
    #[ts(skip)]
    #[serde(with = "rust_decimal::serde::str_option")]
    pub salary_min: Option<Decimal>,
    #[ts(skip)]
    #[serde(with = "rust_decimal::serde::str_option")]
    pub salary_max: Option<Decimal>,
    pub salary_currency: Option<String>,
    pub salary_period: Option<String>,
    pub benefits: Option<String>,

    // Application Details
    pub application_deadline: NaiveDate,
    pub contact_email: Option<String>,
    pub application_url: Option<String>,

    // Counts
    pub vacancies: i32,
    pub applications_count: i32,

    // Status & Approval
    pub status: JobStatus,
    pub approved_at: Option<DateTime<Utc>>,
    pub approved_by: Option<Uuid>,
    pub rejection_reason: Option<String>,

    // Metadata
    pub completeness_percentage: i32,
    pub is_featured: Option<bool>,
    pub views_count: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ============================================================================
// JUNCTION TABLE STRUCTS
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct JobRequiredSkill {
    pub id: Uuid,
    pub job_id: Uuid,
    pub skill_id: Uuid,
    pub minimum_proficiency: i32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct JobPreferredSkill {
    pub id: Uuid,
    pub job_id: Uuid,
    pub skill_id: Uuid,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct JobRequiredLanguage {
    pub id: Uuid,
    pub job_id: Uuid,
    pub language_id: Uuid,
    pub minimum_proficiency: i32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct JobDisabilityAccommodation {
    pub id: Uuid,
    pub job_id: Uuid,
    pub disability_category: DisabilityCategory,
    pub created_at: DateTime<Utc>,
}

// ============================================================================
// REQUEST DTOs
// ============================================================================

#[derive(Debug, Deserialize, Validate, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct CreateJobRequest {
    // Core Information
    #[validate(length(min = 1, max = 200, message = "Title must be 1-200 characters"))]
    pub title: String,

    #[validate(length(min = 10, max = 10000, message = "Description must be 10-10000 characters"))]
    pub description: String,

    #[validate(length(max = 5000, message = "Responsibilities too long"))]
    pub responsibilities: Option<String>,

    // Classification
    pub job_type: JobType,
    pub industry_id: Option<Uuid>,
    pub work_area_id: Option<Uuid>,
    pub position_level_id: Option<Uuid>,

    // Work Arrangement
    pub work_modality: WorkModality,

    #[validate(length(max = 50, message = "Work schedule too long"))]
    pub work_schedule: Option<String>,

    // Location
    pub region_id: Option<Uuid>,
    pub municipality_id: Option<Uuid>,
    pub is_remote_allowed: Option<bool>,

    // Requirements
    #[validate(length(max = 50, message = "Education level too long"))]
    pub education_level: Option<String>,

    #[validate(range(min = 0, max = 50, message = "Experience must be 0-50 years"))]
    pub years_experience_min: Option<i32>,

    #[validate(range(min = 0, max = 50, message = "Experience must be 0-50 years"))]
    pub years_experience_max: Option<i32>,

    #[validate(range(min = 18, max = 100, message = "Age must be 18-100"))]
    pub age_min: Option<i32>,

    #[validate(range(min = 18, max = 100, message = "Age must be 18-100"))]
    pub age_max: Option<i32>,

    // Compensation
    #[ts(skip)]
    pub salary_min: Option<Decimal>,
    #[ts(skip)]
    pub salary_max: Option<Decimal>,

    #[validate(length(min = 3, max = 3, message = "Currency must be 3 characters"))]
    pub salary_currency: Option<String>,

    pub salary_period: Option<SalaryPeriod>,

    #[validate(length(max = 5000, message = "Benefits too long"))]
    pub benefits: Option<String>,

    // Application Details
    pub application_deadline: NaiveDate,

    #[validate(email(message = "Invalid contact email"))]
    #[validate(length(max = 255, message = "Contact email too long"))]
    pub contact_email: Option<String>,

    #[validate(url(message = "Invalid application URL"))]
    #[validate(length(max = 500, message = "Application URL too long"))]
    pub application_url: Option<String>,

    // Counts
    #[validate(range(min = 1, max = 1000, message = "Vacancies must be 1-1000"))]
    pub vacancies: i32,

    // Skills and Languages
    pub required_skills: Option<Vec<RequiredSkillInput>>,
    pub preferred_skills: Option<Vec<Uuid>>,
    pub required_languages: Option<Vec<RequiredLanguageInput>>,
    pub disability_accommodations: Option<Vec<DisabilityCategory>>,
}

#[derive(Debug, Deserialize, Validate, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct RequiredSkillInput {
    pub skill_id: Uuid,
    #[validate(range(min = 1, max = 5, message = "Proficiency must be 1-5"))]
    pub minimum_proficiency: i32,
}

#[derive(Debug, Deserialize, Validate, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct RequiredLanguageInput {
    pub language_id: Uuid,
    #[validate(range(min = 1, max = 5, message = "Proficiency must be 1-5"))]
    pub minimum_proficiency: i32,
}

#[derive(Debug, Deserialize, Validate, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct UpdateJobRequest {
    // All fields optional (same validation as CreateJobRequest)
    #[validate(length(min = 1, max = 200, message = "Title must be 1-200 characters"))]
    pub title: Option<String>,

    #[validate(length(min = 10, max = 10000, message = "Description must be 10-10000 characters"))]
    pub description: Option<String>,

    #[validate(length(max = 5000, message = "Responsibilities too long"))]
    pub responsibilities: Option<String>,

    pub job_type: Option<JobType>,
    pub industry_id: Option<Uuid>,
    pub work_area_id: Option<Uuid>,
    pub position_level_id: Option<Uuid>,

    pub work_modality: Option<WorkModality>,

    #[validate(length(max = 50, message = "Work schedule too long"))]
    pub work_schedule: Option<String>,

    pub region_id: Option<Uuid>,
    pub municipality_id: Option<Uuid>,
    pub is_remote_allowed: Option<bool>,

    #[validate(length(max = 50, message = "Education level too long"))]
    pub education_level: Option<String>,

    #[validate(range(min = 0, max = 50, message = "Experience must be 0-50 years"))]
    pub years_experience_min: Option<i32>,

    #[validate(range(min = 0, max = 50, message = "Experience must be 0-50 years"))]
    pub years_experience_max: Option<i32>,

    #[validate(range(min = 18, max = 100, message = "Age must be 18-100"))]
    pub age_min: Option<i32>,

    #[validate(range(min = 18, max = 100, message = "Age must be 18-100"))]
    pub age_max: Option<i32>,

    #[ts(skip)]
    pub salary_min: Option<Decimal>,
    #[ts(skip)]
    pub salary_max: Option<Decimal>,

    #[validate(length(min = 3, max = 3, message = "Currency must be 3 characters"))]
    pub salary_currency: Option<String>,

    pub salary_period: Option<SalaryPeriod>,

    #[validate(length(max = 5000, message = "Benefits too long"))]
    pub benefits: Option<String>,

    pub application_deadline: Option<NaiveDate>,

    #[validate(email(message = "Invalid contact email"))]
    #[validate(length(max = 255, message = "Contact email too long"))]
    pub contact_email: Option<String>,

    #[validate(url(message = "Invalid application URL"))]
    #[validate(length(max = 500, message = "Application URL too long"))]
    pub application_url: Option<String>,

    #[validate(range(min = 1, max = 1000, message = "Vacancies must be 1-1000"))]
    pub vacancies: Option<i32>,

    // Skills and Languages (if provided, replace existing)
    pub required_skills: Option<Vec<RequiredSkillInput>>,
    pub preferred_skills: Option<Vec<Uuid>>,
    pub required_languages: Option<Vec<RequiredLanguageInput>>,
    pub disability_accommodations: Option<Vec<DisabilityCategory>>,
}

#[derive(Debug, Deserialize, Validate, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct UpdateJobStatusRequest {
    pub status: JobStatus,

    #[validate(length(max = 2000, message = "Rejection reason too long"))]
    pub rejection_reason: Option<String>,
}

// ============================================================================
// RESPONSE DTOs
// ============================================================================

/// Public job listing (filtered for public viewing)
#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct PublicJobListing {
    // Identity
    pub id: Uuid,

    // Core Information
    pub title: String,
    pub description: String,
    pub responsibilities: Option<String>,

    // Classification
    pub job_type: JobType,
    pub industry_id: Option<Uuid>,
    pub work_area_id: Option<Uuid>,
    pub position_level_id: Option<Uuid>,

    // Work Arrangement
    pub work_modality: WorkModality,
    pub work_schedule: Option<String>,

    // Location
    pub region_id: Option<Uuid>,
    pub municipality_id: Option<Uuid>,
    pub is_remote_allowed: bool,

    // Requirements
    pub education_level: Option<String>,
    pub years_experience_min: Option<i32>,
    pub years_experience_max: Option<i32>,

    // Compensation (no salary details in public view)
    pub benefits: Option<String>,

    // Application Details
    pub application_deadline: NaiveDate,
    pub contact_email: Option<String>,
    pub application_url: Option<String>,

    // Counts
    pub vacancies: i32,

    // Metadata
    pub is_featured: bool,
    pub created_at: DateTime<Utc>,

    // Company info (minimal for privacy)
    pub company_name: String,
    pub company_logo_url: Option<String>,
}

/// Job with application count (company view)
#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct JobWithApplicationCount {
    pub job: Job,
    pub applications_count: i32,
}

/// Full job response with all relations (company members only)
#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct FullJobResponse {
    pub job: Job,
    pub required_skills: Vec<JobRequiredSkill>,
    pub preferred_skills: Vec<JobPreferredSkill>,
    pub required_languages: Vec<JobRequiredLanguage>,
    pub disability_accommodations: Vec<JobDisabilityAccommodation>,
}

// ============================================================================
// QUERY PARAMETERS
// ============================================================================

/// Paginated response for public job listings
#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct PublicJobListResponse {
    pub jobs: Vec<PublicJobListing>,
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
    pub total_pages: i64,
}

#[derive(Debug, Deserialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct PublicJobListQuery {
    pub region_id: Option<Uuid>,
    pub industry_id: Option<Uuid>,
    pub work_area_id: Option<Uuid>,
    pub job_type: Option<JobType>,
    pub work_modality: Option<WorkModality>,
    pub is_remote_allowed: Option<bool>,
    pub search: Option<String>,
    // Pagination - supports both page/per_page and limit/offset
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}
