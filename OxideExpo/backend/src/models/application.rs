use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, Type};
use ts_rs::TS;
use uuid::Uuid;
use validator::Validate;

use super::job::{Job, PublicJobListing};
use super::profile::JobSeekerProfile;

// ============================================================================
// ENUMS (matching PostgreSQL enums from 0002_create_enums.sql)
// ============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type, TS)]
#[sqlx(type_name = "application_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
#[ts(export, export_to = "../frontend/src/types/")]
pub enum ApplicationStatus {
    Submitted,
    UnderReview,
    Shortlisted,
    Interviewed,
    Offered,
    Accepted,
    Rejected,
    Withdrawn,
}

// ============================================================================
// CORE APPLICATION STRUCT
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct JobApplication {
    pub id: Uuid,
    pub job_id: Uuid,
    pub applicant_id: Uuid,

    // Application Data
    pub status: ApplicationStatus,
    pub cover_letter: Option<String>,
    pub resume_url: Option<String>,
    pub applied_at: DateTime<Utc>,

    // Review Process
    pub reviewed_at: Option<DateTime<Utc>>,
    pub reviewed_by: Option<Uuid>,

    // Interview
    pub interview_date: Option<DateTime<Utc>>,
    pub interview_notes: Option<String>,

    // Offer
    pub offer_date: Option<DateTime<Utc>>,
    pub offer_details: Option<String>,
    pub response_date: Option<DateTime<Utc>>,

    // Withdrawal
    pub withdrawal_reason: Option<String>,

    // Metadata
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ============================================================================
// APPLICATION NOTES
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct ApplicationNote {
    pub id: Uuid,
    pub application_id: Uuid,
    pub created_by: Uuid,
    pub note_text: String,
    pub is_important: Option<bool>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ============================================================================
// REQUEST DTOs
// ============================================================================

#[derive(Debug, Deserialize, Validate, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct CreateApplicationRequest {
    pub job_id: Uuid,

    #[validate(length(max = 5000, message = "Cover letter too long"))]
    pub cover_letter: Option<String>,

    #[validate(url(message = "Invalid resume URL"))]
    #[validate(length(max = 500, message = "Resume URL too long"))]
    pub resume_url: Option<String>,
}

#[derive(Debug, Deserialize, Validate, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct UpdateApplicationStatusRequest {
    pub status: ApplicationStatus,

    pub interview_date: Option<DateTime<Utc>>,

    #[validate(length(max = 2000, message = "Interview notes too long"))]
    pub interview_notes: Option<String>,

    #[validate(length(max = 2000, message = "Offer details too long"))]
    pub offer_details: Option<String>,
}

#[derive(Debug, Deserialize, Validate, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct WithdrawApplicationRequest {
    #[validate(length(max = 1000, message = "Withdrawal reason too long"))]
    pub withdrawal_reason: Option<String>,
}

#[derive(Debug, Deserialize, Validate, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct CreateApplicationNoteRequest {
    #[validate(length(min = 1, max = 5000, message = "Note text must be 1-5000 characters"))]
    pub note_text: String,

    pub is_important: Option<bool>,
}

// ============================================================================
// RESPONSE DTOs
// ============================================================================

/// Application with job details (job seeker view)
#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct ApplicationWithJobDetails {
    pub application: JobApplication,
    pub job: PublicJobListing,
}

/// Application with applicant profile (company view)
#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct ApplicationWithApplicantDetails {
    pub application: JobApplication,
    pub applicant_profile: Option<JobSeekerProfile>,
}

/// Full application response with notes (company only)
#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct FullApplicationResponse {
    pub application: JobApplication,
    pub job: Job,
    pub applicant_profile: JobSeekerProfile,
    pub notes: Vec<ApplicationNote>,
}

/// Application note with creator info
#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct ApplicationNoteWithCreator {
    pub note: ApplicationNote,
    pub creator_name: String,
    pub creator_email: String,
}
