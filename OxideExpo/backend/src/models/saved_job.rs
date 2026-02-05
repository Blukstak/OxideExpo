use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use ts_rs::TS;
use uuid::Uuid;

use super::job::PublicJobListing;

// ============================================================================
// SAVED JOB MODEL
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct SavedJob {
    pub id: Uuid,
    pub user_id: Uuid,
    pub job_id: Uuid,
    pub created_at: DateTime<Utc>,
}

// ============================================================================
// RESPONSE DTOs
// ============================================================================

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct SavedJobWithDetails {
    pub saved_job: SavedJob,
    pub job: PublicJobListing,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct SavedJobsResponse {
    pub saved_jobs: Vec<SavedJobWithDetails>,
    pub total: i64,
}

// ============================================================================
// QUERY PARAMETERS
// ============================================================================

#[derive(Debug, Deserialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct SavedJobsQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

// ============================================================================
// SIMPLE RESPONSE
// ============================================================================

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct SaveJobResponse {
    pub saved_job_id: Uuid,
    pub job_id: Uuid,
    pub message: String,
}
