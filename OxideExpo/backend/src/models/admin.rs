use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use sqlx::Type;
use ts_rs::TS;
use uuid::Uuid;
use validator::Validate;

// ============================================================================
// ENUMS
// ============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type, TS)]
#[sqlx(type_name = "admin_role", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum AdminRole {
    SuperAdmin,
    Moderator,
    Analyst,
}

// ============================================================================
// CORE MODELS
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export)]
pub struct Admin {
    pub id: Uuid,
    pub user_id: Uuid,
    #[sqlx(rename = "admin_role")]
    pub admin_role: AdminRole,
    #[ts(skip)]
    pub permissions: serde_json::Value,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export)]
pub struct AdminAuditLog {
    pub id: Uuid,
    pub admin_id: Uuid,
    pub action_type: String,
    pub entity_type: String,
    pub entity_id: Uuid,
    #[ts(skip)]
    pub details: Option<serde_json::Value>,
    pub ip_address: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export)]
pub struct FlaggedContent {
    pub id: Uuid,
    pub content_type: String,
    pub content_id: Uuid,
    pub flagged_by: Option<Uuid>,
    pub reason: String,
    pub description: Option<String>,
    pub status: String,
    pub reviewed_by: Option<Uuid>,
    pub reviewed_at: Option<DateTime<Utc>>,
    pub resolution_notes: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export)]
pub struct PlatformAnnouncement {
    pub id: Uuid,
    pub title: String,
    pub message: String,
    pub announcement_type: String,
    pub target_audience: String,
    pub is_active: bool,
    pub starts_at: DateTime<Utc>,
    pub ends_at: Option<DateTime<Utc>>,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ============================================================================
// REQUEST DTOs
// ============================================================================

#[derive(Debug, Deserialize, Validate)]
pub struct CreateAdminRequest {
    pub user_id: Uuid,
    pub admin_role: AdminRole,
    pub permissions: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct ApproveCompanyRequest {
    #[validate(length(max = 1000))]
    pub approval_notes: Option<String>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct RejectCompanyRequest {
    #[validate(length(min = 10, max = 1000))]
    pub rejection_reason: String,
}

#[derive(Debug, Deserialize, Validate)]
pub struct ApproveJobRequest {
    #[validate(length(max = 1000))]
    pub approval_notes: Option<String>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct RejectJobRequest {
    #[validate(length(min = 10, max = 1000))]
    pub rejection_reason: String,
}

#[derive(Debug, Deserialize, Validate)]
pub struct SuspendUserRequest {
    #[validate(length(min = 10, max = 1000))]
    pub suspension_reason: String,
    pub suspension_duration_days: Option<i32>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct ResolveFlaggedContentRequest {
    #[validate(length(min = 10, max = 2000))]
    pub resolution_notes: String,
    pub action_taken: String, // removed, warned, banned, dismissed
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreatePlatformAnnouncementRequest {
    #[validate(length(min = 5, max = 200))]
    pub title: String,
    #[validate(length(min = 10, max = 5000))]
    pub message: String,
    pub announcement_type: String, // info, warning, maintenance
    pub target_audience: String,   // all, job_seekers, companies
    pub starts_at: DateTime<Utc>,
    pub ends_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdatePlatformAnnouncementRequest {
    #[validate(length(min = 5, max = 200))]
    pub title: Option<String>,
    #[validate(length(min = 10, max = 5000))]
    pub message: Option<String>,
    pub announcement_type: Option<String>,
    pub target_audience: Option<String>,
    pub is_active: Option<bool>,
    pub starts_at: Option<DateTime<Utc>>,
    pub ends_at: Option<DateTime<Utc>>,
}

// ============================================================================
// RESPONSE DTOs
// ============================================================================

#[derive(Debug, Serialize, TS)]
#[ts(export)]
pub struct AdminDashboardStats {
    pub total_users: i64,
    pub new_users_today: i64,
    pub new_users_this_week: i64,
    pub new_users_this_month: i64,
    pub total_companies: i64,
    pub pending_companies: i64,
    pub active_companies: i64,
    pub total_jobs: i64,
    pub active_jobs: i64,
    pub pending_jobs: i64,
    pub total_applications: i64,
    pub flagged_content_pending: i64,
}

#[derive(Debug, Serialize, TS)]
#[ts(export)]
pub struct AdminWithUserInfo {
    #[serde(flatten)]
    pub admin: Admin,
    pub email: String,
    pub full_name: Option<String>,
}

#[derive(Debug, Serialize, TS)]
#[ts(export)]
pub struct AuditLogWithAdminInfo {
    #[serde(flatten)]
    pub audit_log: AdminAuditLog,
    pub admin_email: String,
    pub admin_name: Option<String>,
}

#[derive(Debug, Serialize, TS)]
#[ts(export)]
pub struct FlaggedContentWithDetails {
    #[serde(flatten)]
    pub flagged_content: FlaggedContent,
    pub flagger_email: Option<String>,
    pub reviewer_email: Option<String>,
    pub content_preview: Option<String>,
}

// ============================================================================
// PAGINATION
// ============================================================================

#[derive(Debug, Deserialize, Validate)]
pub struct PaginationParams {
    #[validate(range(min = 1, max = 100))]
    pub limit: Option<i64>,
    #[validate(range(min = 0))]
    pub offset: Option<i64>,
}

impl Default for PaginationParams {
    fn default() -> Self {
        Self {
            limit: Some(50),
            offset: Some(0),
        }
    }
}

#[derive(Debug, Serialize, TS)]
#[ts(export)]
pub struct PaginatedResponse<T> {
    pub data: Vec<T>,
    pub total: i64,
    pub limit: i64,
    pub offset: i64,
}

// ============================================================================
// FILTER PARAMS
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct UserFilterParams {
    pub user_type: Option<String>,
    pub status: Option<String>,
    pub search: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct CompanyFilterParams {
    pub status: Option<String>,
    pub industry_id: Option<Uuid>,
    pub search: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct JobFilterParams {
    pub status: Option<String>,
    pub job_type: Option<String>,
    pub company_id: Option<Uuid>,
    pub search: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct AuditLogFilterParams {
    pub admin_id: Option<Uuid>,
    pub action_type: Option<String>,
    pub entity_type: Option<String>,
    pub entity_id: Option<Uuid>,
    pub from_date: Option<DateTime<Utc>>,
    pub to_date: Option<DateTime<Utc>>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

// ============================================================================
// V11: USER MANAGEMENT DTOs
// ============================================================================

use crate::models::user::{AccountStatus, UserType};

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export)]
pub struct UserListItem {
    pub id: Uuid,
    pub email: String,
    pub first_name: String,
    pub last_name: String,
    pub user_type: UserType,
    pub account_status: AccountStatus,
    pub email_verified_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export)]
pub struct UserDetail {
    pub id: Uuid,
    pub email: String,
    pub first_name: String,
    pub last_name: String,
    pub user_type: UserType,
    pub account_status: AccountStatus,
    pub email_verified_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    // Related info
    pub company_id: Option<Uuid>,
    pub company_name: Option<String>,
    pub omil_id: Option<Uuid>,
    pub omil_name: Option<String>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateUserStatusRequest {
    pub status: AccountStatus,
    #[validate(length(max = 1000))]
    pub reason: Option<String>,
}

#[derive(Debug, Serialize, TS)]
#[ts(export)]
pub struct AdminImpersonationResponse {
    pub impersonation_token: String,
    pub expires_at: DateTime<Utc>,
    pub user_id: Uuid,
    pub user_email: String,
}

// ============================================================================
// V11: OMIL APPROVAL DTOs
// ============================================================================

#[derive(Debug, Deserialize, Validate)]
pub struct ApproveOmilRequest {
    #[validate(length(max = 1000))]
    pub approval_notes: Option<String>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct RejectOmilRequest {
    #[validate(length(min = 10, max = 1000))]
    pub rejection_reason: String,
}

// ============================================================================
// V11: SYSTEM SETTINGS DTOs
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct SystemSetting {
    pub key: String,
    #[ts(type = "any")]
    pub value: serde_json::Value,
    pub description: Option<String>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateSettingsRequest {
    pub settings: Vec<SettingUpdate>,
}

#[derive(Debug, Deserialize)]
pub struct SettingUpdate {
    pub key: String,
    pub value: serde_json::Value,
}

// ============================================================================
// V12: REPORTING DTOs
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct ReportDateRangeParams {
    pub from_date: Option<DateTime<Utc>>,
    pub to_date: Option<DateTime<Utc>>,
    pub group_by: Option<String>, // day, week, month
}

#[derive(Debug, Serialize, TS)]
#[ts(export)]
pub struct TrendDataPoint {
    pub date: String,
    pub count: i64,
}

#[derive(Debug, Serialize, TS)]
#[ts(export)]
pub struct UserTrendsReport {
    pub total_users: i64,
    pub new_users_period: i64,
    pub by_type: Vec<UserTypeCount>,
    pub trend: Vec<TrendDataPoint>,
}

#[derive(Debug, Serialize, TS)]
#[ts(export)]
pub struct UserTypeCount {
    pub user_type: String,
    pub count: i64,
}

#[derive(Debug, Serialize, TS)]
#[ts(export)]
pub struct CompanyTrendsReport {
    pub total_companies: i64,
    pub active_companies: i64,
    pub pending_companies: i64,
    pub new_companies_period: i64,
    pub trend: Vec<TrendDataPoint>,
}

#[derive(Debug, Serialize, TS)]
#[ts(export)]
pub struct JobTrendsReport {
    pub total_jobs: i64,
    pub active_jobs: i64,
    pub pending_jobs: i64,
    pub new_jobs_period: i64,
    pub trend: Vec<TrendDataPoint>,
}

#[derive(Debug, Serialize, TS)]
#[ts(export)]
pub struct ApplicationTrendsReport {
    pub total_applications: i64,
    pub new_applications_period: i64,
    pub by_status: Vec<ApplicationStatusCount>,
    pub trend: Vec<TrendDataPoint>,
}

#[derive(Debug, Serialize, TS)]
#[ts(export)]
pub struct ApplicationStatusCount {
    pub status: String,
    pub count: i64,
}

#[derive(Debug, Serialize, TS)]
#[ts(export)]
pub struct CompanyDashboard {
    pub active_jobs: i64,
    pub total_applications: i64,
    pub applications_by_status: Vec<ApplicationStatusCount>,
    pub trend: Vec<TrendDataPoint>,
    pub top_jobs: Vec<TopJobPerformance>,
}

#[derive(Debug, Serialize, TS)]
#[ts(export)]
pub struct TopJobPerformance {
    pub job_id: Uuid,
    pub title: String,
    pub applications_count: i64,
    pub status: String,
}
