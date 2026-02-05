use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, Type};
use ts_rs::TS;
use uuid::Uuid;

// ============================================================================
// FILE TYPE ENUM (matching PostgreSQL enum)
// ============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type, TS)]
#[sqlx(type_name = "file_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
#[ts(export, export_to = "../frontend/src/types/")]
pub enum FileType {
    Cv,
    ProfileImage,
    CompanyLogo,
    CompanyCover,
}

// ============================================================================
// UPLOADED FILE MODEL
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct UploadedFile {
    pub id: Uuid,
    pub user_id: Uuid,
    pub file_type: FileType,
    pub original_filename: String,
    pub storage_path: String,
    pub content_type: Option<String>,
    pub file_size_bytes: Option<i64>,
    pub created_at: DateTime<Utc>,
}

// ============================================================================
// RESPONSE DTOs
// ============================================================================

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct FileUploadResponse {
    pub file_id: Uuid,
    pub file_type: FileType,
    pub original_filename: String,
    pub file_size_bytes: i64,
    pub download_url: String,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct FileDownloadResponse {
    pub download_url: String,
    pub filename: String,
    pub content_type: String,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct FileDeleteResponse {
    pub message: String,
}

// ============================================================================
// FILE CONSTRAINTS
// ============================================================================

impl FileType {
    /// Maximum file size in bytes for each file type
    pub fn max_size_bytes(&self) -> i64 {
        match self {
            FileType::Cv => 10 * 1024 * 1024,           // 10 MB
            FileType::ProfileImage => 5 * 1024 * 1024, // 5 MB
            FileType::CompanyLogo => 5 * 1024 * 1024,  // 5 MB
            FileType::CompanyCover => 10 * 1024 * 1024, // 10 MB
        }
    }

    /// Allowed MIME types for each file type
    pub fn allowed_content_types(&self) -> Vec<&'static str> {
        match self {
            FileType::Cv => vec![
                "application/pdf",
                "application/msword",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ],
            FileType::ProfileImage | FileType::CompanyLogo | FileType::CompanyCover => vec![
                "image/jpeg",
                "image/png",
                "image/webp",
            ],
        }
    }

    /// Storage folder for each file type
    pub fn storage_folder(&self) -> &'static str {
        match self {
            FileType::Cv => "cvs",
            FileType::ProfileImage => "profile-images",
            FileType::CompanyLogo => "company-logos",
            FileType::CompanyCover => "company-covers",
        }
    }

    /// Human-readable name
    pub fn display_name(&self) -> &'static str {
        match self {
            FileType::Cv => "CV/Resume",
            FileType::ProfileImage => "Profile Image",
            FileType::CompanyLogo => "Company Logo",
            FileType::CompanyCover => "Company Cover",
        }
    }
}
