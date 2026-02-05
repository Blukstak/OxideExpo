use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, Type};
use ts_rs::TS;
use uuid::Uuid;
use validator::Validate;

use super::company::OrganizationStatus;
use super::job::PublicJobListing;
use super::profile::JobSeekerProfile;

// ============================================================================
// ENUMS (matching PostgreSQL enums from 0012_create_omil_tables.sql)
// ============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type, TS)]
#[sqlx(type_name = "omil_role", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
#[ts(export, export_to = "../frontend/src/types/")]
pub enum OmilRole {
    Director,
    Coordinator,
    Advisor,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type, TS)]
#[sqlx(type_name = "followup_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
#[ts(export, export_to = "../frontend/src/types/")]
pub enum FollowupType {
    InitialRegistration,
    ProfileUpdate,
    JobApplication,
    InterviewScheduled,
    InterviewCompleted,
    Placement,
    FollowUpCall,
    GeneralNote,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type, TS)]
#[sqlx(type_name = "placement_outcome", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
#[ts(export, export_to = "../frontend/src/types/")]
pub enum PlacementOutcome {
    Pending,
    Placed,
    NotPlaced,
    DeclinedOffer,
    Withdrawn,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type, TS)]
#[sqlx(type_name = "invitation_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
#[ts(export, export_to = "../frontend/src/types/")]
pub enum InvitationStatus {
    Pending,
    Viewed,
    Applied,
    Declined,
    Expired,
}

// ============================================================================
// CORE DATABASE MODELS
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct OmilOrganization {
    pub id: Uuid,
    pub organization_name: String,
    pub municipality_id: Option<Uuid>,
    pub region_id: Option<Uuid>,
    pub address: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub website_url: Option<String>,
    pub status: OrganizationStatus,
    pub approved_at: Option<DateTime<Utc>>,
    pub approved_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct OmilMember {
    pub id: Uuid,
    pub omil_id: Uuid,
    pub user_id: Uuid,
    pub role: OmilRole,
    pub is_active: bool,
    pub joined_at: DateTime<Utc>,
    pub left_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct OmilManagedJobSeeker {
    pub id: Uuid,
    pub omil_id: Uuid,
    pub job_seeker_id: Uuid,
    pub assigned_advisor_id: Option<Uuid>,
    pub registered_by: Uuid,
    pub placement_outcome: PlacementOutcome,
    pub placed_at: Option<DateTime<Utc>>,
    pub placed_job_id: Option<Uuid>,
    pub is_active: bool,
    pub notes: Option<String>,
    pub registered_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct JobSeekerFollowup {
    pub id: Uuid,
    pub job_seeker_id: Uuid,
    pub created_by: Uuid,
    pub omil_id: Option<Uuid>,
    pub application_id: Option<Uuid>,
    pub followup_type: FollowupType,
    pub title: Option<String>,
    pub content: String,
    pub is_private: bool,
    pub followup_date: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct JobInvitation {
    pub id: Uuid,
    pub job_id: Uuid,
    pub job_seeker_id: Uuid,
    pub invited_by: Uuid,
    pub company_id: Uuid,
    pub message: Option<String>,
    pub status: InvitationStatus,
    pub viewed_at: Option<DateTime<Utc>>,
    pub responded_at: Option<DateTime<Utc>>,
    pub expires_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct OmilApplication {
    pub id: Uuid,
    pub application_id: Uuid,
    pub omil_id: Uuid,
    pub submitted_by: Uuid,
    pub internal_notes: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct NotificationPreferences {
    pub user_id: Uuid,
    pub email_job_alerts: bool,
    pub email_application_updates: bool,
    pub email_invitations: bool,
    pub email_messages: bool,
    pub email_marketing: bool,
    pub digest_frequency: crate::models::matching::AlertFrequency,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ============================================================================
// REQUEST DTOs
// ============================================================================

#[derive(Debug, Deserialize, Validate, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct UpdateOmilOrganizationRequest {
    #[validate(length(min = 1, max = 255, message = "Organization name must be 1-255 characters"))]
    pub organization_name: Option<String>,

    pub municipality_id: Option<Uuid>,
    pub region_id: Option<Uuid>,

    #[validate(length(max = 1000, message = "Address too long"))]
    pub address: Option<String>,

    #[validate(length(max = 50, message = "Phone too long"))]
    pub phone: Option<String>,

    #[validate(email(message = "Invalid email"))]
    #[validate(length(max = 255, message = "Email too long"))]
    pub email: Option<String>,

    #[validate(url(message = "Invalid website URL"))]
    #[validate(length(max = 500, message = "Website URL too long"))]
    pub website_url: Option<String>,
}

#[derive(Debug, Deserialize, Validate, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct AddOmilMemberRequest {
    #[validate(email(message = "Invalid email"))]
    pub email: String,

    pub role: OmilRole,
}

#[derive(Debug, Deserialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct UpdateOmilMemberRequest {
    pub role: Option<OmilRole>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize, Validate, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct RegisterJobSeekerOnBehalfRequest {
    #[validate(email(message = "Invalid email"))]
    pub email: String,

    #[validate(length(min = 1, max = 100, message = "First name required"))]
    pub first_name: String,

    #[validate(length(min = 1, max = 100, message = "Last name required"))]
    pub last_name: String,

    #[validate(length(max = 50, message = "Phone too long"))]
    pub phone: Option<String>,

    #[validate(length(max = 500, message = "Notes too long"))]
    pub notes: Option<String>,

    pub assign_to_self: Option<bool>,
}

#[derive(Debug, Deserialize, Validate, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct ApplyOnBehalfRequest {
    pub job_id: Uuid,

    #[validate(length(max = 5000, message = "Cover letter too long"))]
    pub cover_letter: Option<String>,

    #[validate(length(max = 2000, message = "Internal notes too long"))]
    pub internal_notes: Option<String>,
}

#[derive(Debug, Deserialize, Validate, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct UpdatePlacementRequest {
    pub outcome: PlacementOutcome,
    pub job_id: Option<Uuid>,

    #[validate(length(max = 1000, message = "Notes too long"))]
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize, Validate, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct CreateFollowupRequest {
    pub followup_type: FollowupType,

    #[validate(length(max = 255, message = "Title too long"))]
    pub title: Option<String>,

    #[validate(length(min = 1, max = 5000, message = "Content required (1-5000 chars)"))]
    pub content: String,

    pub is_private: Option<bool>,
    pub application_id: Option<Uuid>,
}

#[derive(Debug, Deserialize, Validate, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct UpdateFollowupRequest {
    #[validate(length(max = 255, message = "Title too long"))]
    pub title: Option<String>,

    #[validate(length(min = 1, max = 5000, message = "Content required (1-5000 chars)"))]
    pub content: Option<String>,

    pub is_private: Option<bool>,
}

#[derive(Debug, Deserialize, Validate, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct SendJobInvitationRequest {
    pub job_seeker_id: Uuid,

    #[validate(length(max = 2000, message = "Message too long"))]
    pub message: Option<String>,

    #[validate(range(min = 1, max = 90, message = "Expires in days must be 1-90"))]
    pub expires_in_days: Option<i32>,
}

#[derive(Debug, Deserialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct RespondToInvitationRequest {
    pub accept: bool,

    pub cover_letter: Option<String>,
}

#[derive(Debug, Deserialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct UpdateNotificationPreferencesRequest {
    pub email_job_alerts: Option<bool>,
    pub email_application_updates: Option<bool>,
    pub email_invitations: Option<bool>,
    pub email_messages: Option<bool>,
    pub email_marketing: Option<bool>,
    pub digest_frequency: Option<crate::models::matching::AlertFrequency>,
}

// ============================================================================
// RESPONSE DTOs
// ============================================================================

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct OmilDashboardStats {
    pub total_managed_seekers: i64,
    pub active_seekers: i64,
    pub placed_this_month: i64,
    pub placed_this_year: i64,
    pub pending_placements: i64,
    pub new_registrations_this_month: i64,
    pub total_applications_submitted: i64,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct OmilMemberWithUser {
    pub member: OmilMember,
    pub user_name: String,
    pub user_email: String,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct OmilOrganizationWithMembers {
    pub organization: OmilOrganization,
    pub members: Vec<OmilMemberWithUser>,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct ManagedJobSeekerSummary {
    pub id: Uuid,
    pub job_seeker_id: Uuid,
    pub user_name: String,
    pub user_email: String,
    pub placement_outcome: PlacementOutcome,
    pub assigned_advisor_name: Option<String>,
    pub followups_count: i64,
    pub applications_count: i64,
    pub registered_at: DateTime<Utc>,
    pub profile_completeness: i32,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct ManagedJobSeekerDetail {
    pub managed: OmilManagedJobSeeker,
    pub profile: Option<JobSeekerProfile>,
    pub user_name: String,
    pub user_email: String,
    pub recent_followups: Vec<JobSeekerFollowup>,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct JobInvitationWithDetails {
    pub invitation: JobInvitation,
    pub job: PublicJobListing,
    pub company_name: String,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct FollowupWithCreator {
    pub followup: JobSeekerFollowup,
    pub creator_name: String,
}

// ============================================================================
// QUERY PARAMETERS
// ============================================================================

#[derive(Debug, Deserialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct ManagedJobSeekersQuery {
    pub placement_outcome: Option<PlacementOutcome>,
    pub assigned_to_me: Option<bool>,
    pub search: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Deserialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct FollowupsQuery {
    pub followup_type: Option<FollowupType>,
    pub include_private: Option<bool>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Deserialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct InvitationsQuery {
    pub status: Option<InvitationStatus>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}
