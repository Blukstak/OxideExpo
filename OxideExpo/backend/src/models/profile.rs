use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, Type};
use ts_rs::TS;
use uuid::Uuid;
use validator::Validate;

// ============================================================================
// ENUMS (matching PostgreSQL enums from 0002_create_enums.sql)
// ============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type, TS)]
#[sqlx(type_name = "gender", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
#[ts(export, export_to = "../frontend/src/types/")]
pub enum Gender {
    Male,
    Female,
    NonBinary,
    PreferNotToSay,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type, TS)]
#[sqlx(type_name = "marital_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
#[ts(export, export_to = "../frontend/src/types/")]
pub enum MaritalStatus {
    Single,
    Married,
    Divorced,
    Widowed,
    DomesticPartnership,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type, TS)]
#[sqlx(type_name = "disability_category", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
#[ts(export, export_to = "../frontend/src/types/")]
pub enum DisabilityCategory {
    PhysicalMobility,
    Visual,
    Hearing,
    Cognitive,
    Psychosocial,
    Speech,
    Multiple,
    Other,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type, TS)]
#[sqlx(type_name = "education_level", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
#[ts(export, export_to = "../frontend/src/types/")]
pub enum EducationLevel {
    None,
    Primary,
    Secondary,
    Technical,
    Undergraduate,
    Graduate,
    Postgraduate,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type, TS)]
#[sqlx(type_name = "education_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
#[ts(export, export_to = "../frontend/src/types/")]
pub enum EducationStatus {
    InProgress,
    Completed,
    Incomplete,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type, TS)]
#[sqlx(type_name = "language_proficiency", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
#[ts(export, export_to = "../frontend/src/types/")]
pub enum LanguageProficiency {
    Basic,
    Intermediate,
    Advanced,
    Fluent,
    Native,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type, TS)]
#[sqlx(type_name = "job_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
#[ts(export, export_to = "../frontend/src/types/")]
pub enum JobType {
    FullTime,
    PartTime,
    Contract,
    Internship,
    Apprenticeship,
    Temporary,
}

// ============================================================================
// JOB SEEKER PROFILE
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct JobSeekerProfile {
    pub user_id: Uuid,
    pub phone: Option<String>,
    pub date_of_birth: Option<NaiveDate>,
    pub gender: Option<Gender>,
    pub marital_status: Option<MaritalStatus>,
    pub nationality: Option<String>,
    pub national_id: Option<String>,
    pub region_id: Option<Uuid>,
    pub municipality_id: Option<Uuid>,
    pub address: Option<String>,
    pub bio: Option<String>,
    pub professional_headline: Option<String>,
    pub profile_image_url: Option<String>,
    pub cv_url: Option<String>,
    pub completeness_percentage: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, Validate, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct UpdateProfileRequest {
    #[validate(length(max = 20, message = "Phone number too long"))]
    pub phone: Option<String>,
    pub date_of_birth: Option<NaiveDate>,
    pub gender: Option<Gender>,
    pub marital_status: Option<MaritalStatus>,
    #[validate(length(max = 100, message = "Nationality too long"))]
    pub nationality: Option<String>,
    #[validate(length(max = 50, message = "National ID too long"))]
    pub national_id: Option<String>,
    pub region_id: Option<Uuid>,
    pub municipality_id: Option<Uuid>,
    #[validate(length(max = 500, message = "Address too long"))]
    pub address: Option<String>,
    #[validate(length(max = 2000, message = "Bio too long"))]
    pub bio: Option<String>,
    #[validate(length(max = 200, message = "Professional headline too long"))]
    pub professional_headline: Option<String>,
}

// ============================================================================
// DISABILITY INFORMATION
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct JobSeekerDisability {
    pub id: Uuid,
    pub user_id: Uuid,
    pub category: DisabilityCategory,
    pub description: Option<String>,
    pub has_disability_certificate: bool,
    pub disability_percentage: Option<i32>,
    pub requires_accommodations: bool,
    pub accommodation_details: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, Validate, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct UpdateDisabilityRequest {
    pub category: DisabilityCategory,
    #[validate(length(max = 1000, message = "Description too long"))]
    pub description: Option<String>,
    pub has_disability_certificate: bool,
    #[validate(range(min = 0, max = 100, message = "Percentage must be 0-100"))]
    pub disability_percentage: Option<i32>,
    pub requires_accommodations: bool,
    #[validate(length(max = 1000, message = "Accommodation details too long"))]
    pub accommodation_details: Option<String>,
}

// ============================================================================
// EDUCATION RECORDS
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct EducationRecord {
    pub id: Uuid,
    pub user_id: Uuid,
    pub institution_id: Option<Uuid>,
    pub institution_name: Option<String>,
    pub level: EducationLevel,
    pub field_of_study_id: Option<Uuid>,
    pub field_of_study_name: Option<String>,
    pub degree_title: Option<String>,
    pub status: EducationStatus,
    pub start_date: NaiveDate,
    pub end_date: Option<NaiveDate>,
    pub description: Option<String>,
    pub achievements: Option<String>,
    pub display_order: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, Validate, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct CreateEducationRequest {
    pub institution_id: Option<Uuid>,
    #[validate(length(max = 255, message = "Institution name too long"))]
    pub institution_name: Option<String>,
    pub level: EducationLevel,
    pub field_of_study_id: Option<Uuid>,
    #[validate(length(max = 255, message = "Field of study name too long"))]
    pub field_of_study_name: Option<String>,
    #[validate(length(max = 255, message = "Degree title too long"))]
    pub degree_title: Option<String>,
    pub status: EducationStatus,
    pub start_date: NaiveDate,
    pub end_date: Option<NaiveDate>,
    #[validate(length(max = 2000, message = "Description too long"))]
    pub description: Option<String>,
    #[validate(length(max = 2000, message = "Achievements too long"))]
    pub achievements: Option<String>,
}

#[derive(Debug, Deserialize, Validate, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct UpdateEducationRequest {
    pub institution_id: Option<Uuid>,
    #[validate(length(max = 255, message = "Institution name too long"))]
    pub institution_name: Option<String>,
    pub level: Option<EducationLevel>,
    pub field_of_study_id: Option<Uuid>,
    #[validate(length(max = 255, message = "Field of study name too long"))]
    pub field_of_study_name: Option<String>,
    #[validate(length(max = 255, message = "Degree title too long"))]
    pub degree_title: Option<String>,
    pub status: Option<EducationStatus>,
    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
    #[validate(length(max = 2000, message = "Description too long"))]
    pub description: Option<String>,
    #[validate(length(max = 2000, message = "Achievements too long"))]
    pub achievements: Option<String>,
}

// ============================================================================
// WORK EXPERIENCES
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct WorkExperience {
    pub id: Uuid,
    pub user_id: Uuid,
    pub company_name: String,
    pub industry_id: Option<Uuid>,
    pub position_title: String,
    pub work_area_id: Option<Uuid>,
    pub position_level_id: Option<Uuid>,
    pub employment_type: Option<JobType>,
    pub is_current: bool,
    pub start_date: NaiveDate,
    pub end_date: Option<NaiveDate>,
    pub region_id: Option<Uuid>,
    pub municipality_id: Option<Uuid>,
    pub description: Option<String>,
    pub achievements: Option<String>,
    pub display_order: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, Validate, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct CreateWorkExperienceRequest {
    #[validate(length(min = 1, max = 255, message = "Company name is required"))]
    pub company_name: String,
    pub industry_id: Option<Uuid>,
    #[validate(length(min = 1, max = 255, message = "Position title is required"))]
    pub position_title: String,
    pub work_area_id: Option<Uuid>,
    pub position_level_id: Option<Uuid>,
    pub employment_type: Option<JobType>,
    pub is_current: bool,
    pub start_date: NaiveDate,
    pub end_date: Option<NaiveDate>,
    pub region_id: Option<Uuid>,
    pub municipality_id: Option<Uuid>,
    #[validate(length(max = 2000, message = "Description too long"))]
    pub description: Option<String>,
    #[validate(length(max = 2000, message = "Achievements too long"))]
    pub achievements: Option<String>,
}

#[derive(Debug, Deserialize, Validate, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct UpdateWorkExperienceRequest {
    #[validate(length(max = 255, message = "Company name too long"))]
    pub company_name: Option<String>,
    pub industry_id: Option<Uuid>,
    #[validate(length(max = 255, message = "Position title too long"))]
    pub position_title: Option<String>,
    pub work_area_id: Option<Uuid>,
    pub position_level_id: Option<Uuid>,
    pub employment_type: Option<JobType>,
    pub is_current: Option<bool>,
    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
    pub region_id: Option<Uuid>,
    pub municipality_id: Option<Uuid>,
    #[validate(length(max = 2000, message = "Description too long"))]
    pub description: Option<String>,
    #[validate(length(max = 2000, message = "Achievements too long"))]
    pub achievements: Option<String>,
}

// ============================================================================
// USER SKILLS
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct UserSkill {
    pub id: Uuid,
    pub user_id: Uuid,
    pub skill_id: Uuid,
    pub proficiency_level: i32,
    pub years_of_experience: Option<i32>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, Validate, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct CreateSkillRequest {
    pub skill_id: Uuid,
    #[validate(range(min = 1, max = 5, message = "Proficiency must be 1-5"))]
    pub proficiency_level: i32,
    #[validate(range(min = 0, message = "Years of experience cannot be negative"))]
    pub years_of_experience: Option<i32>,
}

#[derive(Debug, Deserialize, Validate, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct UpdateSkillRequest {
    #[validate(range(min = 1, max = 5, message = "Proficiency must be 1-5"))]
    pub proficiency_level: Option<i32>,
    #[validate(range(min = 0, message = "Years of experience cannot be negative"))]
    pub years_of_experience: Option<i32>,
}

// ============================================================================
// USER LANGUAGES
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct UserLanguage {
    pub id: Uuid,
    pub user_id: Uuid,
    pub language_id: Uuid,
    pub proficiency: LanguageProficiency,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, Validate, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct CreateLanguageRequest {
    pub language_id: Uuid,
    pub proficiency: LanguageProficiency,
}

#[derive(Debug, Deserialize, Validate, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct UpdateLanguageRequest {
    pub proficiency: LanguageProficiency,
}

// ============================================================================
// PORTFOLIO ITEMS
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct PortfolioItem {
    pub id: Uuid,
    pub user_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub url: Option<String>,
    pub file_url: Option<String>,
    pub category: Option<String>,
    pub completion_date: Option<NaiveDate>,
    pub display_order: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, Validate, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct CreatePortfolioRequest {
    #[validate(length(min = 1, max = 255, message = "Title is required"))]
    pub title: String,
    #[validate(length(max = 2000, message = "Description too long"))]
    pub description: Option<String>,
    #[validate(url(message = "Invalid URL format"))]
    #[validate(length(max = 500, message = "URL too long"))]
    pub url: Option<String>,
    #[validate(length(max = 500, message = "File URL too long"))]
    pub file_url: Option<String>,
    #[validate(length(max = 100, message = "Category too long"))]
    pub category: Option<String>,
    pub completion_date: Option<NaiveDate>,
}

#[derive(Debug, Deserialize, Validate, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct UpdatePortfolioRequest {
    #[validate(length(max = 255, message = "Title too long"))]
    pub title: Option<String>,
    #[validate(length(max = 2000, message = "Description too long"))]
    pub description: Option<String>,
    #[validate(url(message = "Invalid URL format"))]
    #[validate(length(max = 500, message = "URL too long"))]
    pub url: Option<String>,
    #[validate(length(max = 500, message = "File URL too long"))]
    pub file_url: Option<String>,
    #[validate(length(max = 100, message = "Category too long"))]
    pub category: Option<String>,
    pub completion_date: Option<NaiveDate>,
}

// ============================================================================
// COMPOSITE RESPONSE TYPES
// ============================================================================

#[derive(Debug, Serialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct FullProfileResponse {
    pub profile: JobSeekerProfile,
    pub disability: Option<JobSeekerDisability>,
    pub education: Vec<EducationRecord>,
    pub experience: Vec<WorkExperience>,
    pub skills: Vec<UserSkill>,
    pub languages: Vec<UserLanguage>,
    pub portfolio: Vec<PortfolioItem>,
}
