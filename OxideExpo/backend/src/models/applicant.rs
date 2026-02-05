use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use ts_rs::TS;
use uuid::Uuid;
use validator::Validate;

use super::application::ApplicationStatus;
use super::profile::JobSeekerProfile;

// ============================================================================
// APPLICATION STATUS HISTORY
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct ApplicationStatusHistory {
    pub id: Uuid,
    pub application_id: Uuid,
    pub previous_status: Option<ApplicationStatus>,
    pub new_status: ApplicationStatus,
    pub changed_by: Uuid,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct StatusHistoryWithUser {
    pub history: ApplicationStatusHistory,
    pub changed_by_name: String,
    pub changed_by_email: String,
}

// ============================================================================
// APPLICANT FILTERING
// ============================================================================

#[derive(Debug, Deserialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct ApplicantFilterQuery {
    /// Filter by status
    pub status: Option<ApplicationStatus>,
    /// Filter by minimum match score
    pub min_score: Option<i32>,
    /// Filter by maximum match score
    pub max_score: Option<i32>,
    /// Filter by application date (from)
    pub applied_from: Option<DateTime<Utc>>,
    /// Filter by application date (to)
    pub applied_to: Option<DateTime<Utc>>,
    /// Filter applicants who have a CV uploaded
    pub has_cv: Option<bool>,
    /// Sort field
    pub sort_by: Option<ApplicantSortField>,
    /// Sort direction
    pub sort_dir: Option<SortDirection>,
    /// Pagination limit
    pub limit: Option<i64>,
    /// Pagination offset
    pub offset: Option<i64>,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export, export_to = "../frontend/src/types/")]
pub enum ApplicantSortField {
    AppliedAt,
    Status,
    MatchScore,
    Name,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export, export_to = "../frontend/src/types/")]
pub enum SortDirection {
    Asc,
    Desc,
}

// ============================================================================
// APPLICANT DETAIL RESPONSE
// ============================================================================

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct ApplicantDetailResponse {
    pub application_id: Uuid,
    pub job_id: Uuid,
    pub applicant_id: Uuid,
    pub status: ApplicationStatus,
    pub cover_letter: Option<String>,
    pub resume_url: Option<String>,
    pub applied_at: DateTime<Utc>,
    pub reviewed_at: Option<DateTime<Utc>>,
    pub interview_date: Option<DateTime<Utc>>,
    pub interview_notes: Option<String>,
    pub offer_date: Option<DateTime<Utc>>,
    pub offer_details: Option<String>,
    pub profile: Option<JobSeekerProfile>,
    pub match_score: Option<i32>,
    pub cv_url: Option<String>,
    pub status_history: Vec<StatusHistoryWithUser>,
}

// ============================================================================
// PAGINATED APPLICANT LIST
// ============================================================================

#[derive(Debug, Clone, Serialize, FromRow, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct ApplicantListItem {
    pub application_id: Uuid,
    pub applicant_id: Uuid,
    pub status: ApplicationStatus,
    pub applied_at: DateTime<Utc>,
    pub applicant_name: String,
    pub applicant_email: String,
    pub match_score: Option<i32>,
    pub has_cv: bool,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct PaginatedApplicants {
    pub applicants: Vec<ApplicantListItem>,
    pub total: i64,
    pub limit: i64,
    pub offset: i64,
}

// ============================================================================
// BULK STATUS UPDATE
// ============================================================================

#[derive(Debug, Deserialize, Validate, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct BulkStatusUpdateRequest {
    /// Application IDs to update
    #[validate(length(min = 1, max = 100, message = "Must provide 1-100 application IDs"))]
    pub application_ids: Vec<Uuid>,
    /// New status
    pub status: ApplicationStatus,
    /// Optional notes for status change
    #[validate(length(max = 1000, message = "Notes too long"))]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct BulkStatusUpdateResponse {
    pub updated_count: i32,
    pub failed_ids: Vec<Uuid>,
}

// ============================================================================
// CV DOWNLOAD
// ============================================================================

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct CvDownloadResponse {
    pub download_url: String,
    pub filename: String,
    pub content_type: String,
}

// ============================================================================
// EXCEL EXPORT
// ============================================================================

#[derive(Debug, Deserialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct ExportApplicantsQuery {
    /// Filter by status for export
    pub status: Option<ApplicationStatus>,
    /// Include contact info in export
    pub include_contact: Option<bool>,
}
