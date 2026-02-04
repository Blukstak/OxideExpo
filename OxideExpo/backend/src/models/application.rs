use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use ts_rs::TS;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct JobApplication {
    pub id: i32,
    pub job_id: i32,
    pub user_id: i32,
    pub cover_letter: Option<String>,
    pub cv_url: Option<String>,
    pub status: String,
    pub applied_at: DateTime<Utc>,
    pub reviewed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize, Serialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct CreateApplicationRequest {
    pub job_id: i32,
    pub cover_letter: Option<String>,
}
