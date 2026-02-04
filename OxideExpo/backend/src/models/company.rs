use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, Type};
use ts_rs::TS;
use uuid::Uuid;
use validator::Validate;

use super::user::UserResponse;

// ============================================================================
// ENUMS (matching PostgreSQL enums from 0002_create_enums.sql)
// ============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type, TS)]
#[sqlx(type_name = "organization_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
#[ts(export, export_to = "../frontend/src/types/")]
pub enum OrganizationStatus {
    PendingApproval,
    Active,
    Suspended,
    Rejected,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type, TS)]
#[sqlx(type_name = "member_role", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
#[ts(export, export_to = "../frontend/src/types/")]
pub enum MemberRole {
    Owner,
    Admin,
    Member,
}

// ============================================================================
// COMPANY PROFILE
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct CompanyProfile {
    pub id: Uuid,
    // Identity
    pub company_name: String,
    pub legal_name: Option<String>,
    pub tax_id: Option<String>,
    // Classification
    pub industry_id: Option<Uuid>,
    pub company_size: Option<String>,
    pub founded_year: Option<i32>,
    // Location
    pub region_id: Option<Uuid>,
    pub municipality_id: Option<Uuid>,
    pub address: Option<String>,
    pub phone: Option<String>,
    // Online Presence
    pub website_url: Option<String>,
    pub linkedin_url: Option<String>,
    pub video_url: Option<String>,
    // Media
    pub logo_url: Option<String>,
    pub cover_image_url: Option<String>,
    // Profile Content
    pub description: Option<String>,
    pub mission: Option<String>,
    pub vision: Option<String>,
    pub culture: Option<String>,
    pub benefits: Option<String>,
    // Status & Approval
    pub status: OrganizationStatus,
    pub approved_at: Option<DateTime<Utc>>,
    pub approved_by: Option<Uuid>,
    pub rejection_reason: Option<String>,
    // Features
    pub is_featured: bool,
    pub can_search_candidates: bool,
    // Profile Completeness
    pub completeness_percentage: i32,
    // Metadata
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, Validate, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct UpdateCompanyProfileRequest {
    #[validate(length(min = 1, max = 255, message = "Company name must be 1-255 characters"))]
    pub company_name: Option<String>,
    #[validate(length(max = 255, message = "Legal name too long"))]
    pub legal_name: Option<String>,
    #[validate(length(max = 50, message = "Tax ID too long"))]
    pub tax_id: Option<String>,
    pub industry_id: Option<Uuid>,
    pub company_size: Option<String>,
    #[validate(range(min = 1800, max = 2100, message = "Founded year must be between 1800 and 2100"))]
    pub founded_year: Option<i32>,
    pub region_id: Option<Uuid>,
    pub municipality_id: Option<Uuid>,
    #[validate(length(max = 500, message = "Address too long"))]
    pub address: Option<String>,
    #[validate(length(max = 20, message = "Phone number too long"))]
    pub phone: Option<String>,
    #[validate(url(message = "Invalid website URL"))]
    #[validate(length(max = 500, message = "Website URL too long"))]
    pub website_url: Option<String>,
    #[validate(url(message = "Invalid LinkedIn URL"))]
    #[validate(length(max = 500, message = "LinkedIn URL too long"))]
    pub linkedin_url: Option<String>,
    #[validate(url(message = "Invalid video URL"))]
    #[validate(length(max = 500, message = "Video URL too long"))]
    pub video_url: Option<String>,
    #[validate(url(message = "Invalid logo URL"))]
    #[validate(length(max = 500, message = "Logo URL too long"))]
    pub logo_url: Option<String>,
    #[validate(url(message = "Invalid cover image URL"))]
    #[validate(length(max = 500, message = "Cover image URL too long"))]
    pub cover_image_url: Option<String>,
    #[validate(length(max = 5000, message = "Description too long"))]
    pub description: Option<String>,
    #[validate(length(max = 2000, message = "Mission too long"))]
    pub mission: Option<String>,
    #[validate(length(max = 2000, message = "Vision too long"))]
    pub vision: Option<String>,
    #[validate(length(max = 2000, message = "Culture too long"))]
    pub culture: Option<String>,
    #[validate(length(max = 2000, message = "Benefits too long"))]
    pub benefits: Option<String>,
}

// ============================================================================
// COMPANY MEMBERS
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct CompanyMember {
    pub id: Uuid,
    pub company_id: Uuid,
    pub user_id: Uuid,
    pub role: MemberRole,
    pub job_title: Option<String>,
    pub is_active: bool,
    pub invited_by: Option<Uuid>,
    pub invited_at: Option<DateTime<Utc>>,
    pub joined_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, Validate, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct UpdateMemberRequest {
    pub role: Option<MemberRole>,
    #[validate(length(max = 100, message = "Job title too long"))]
    pub job_title: Option<String>,
    pub is_active: Option<bool>,
}

// ============================================================================
// RESPONSE DTOs
// ============================================================================

/// Public company profile (filtered for public viewing)
#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct PublicCompanyProfile {
    pub id: Uuid,
    pub company_name: String,
    pub industry_id: Option<Uuid>,
    pub company_size: Option<String>,
    pub founded_year: Option<i32>,
    pub region_id: Option<Uuid>,
    pub municipality_id: Option<Uuid>,
    pub website_url: Option<String>,
    pub linkedin_url: Option<String>,
    pub video_url: Option<String>,
    pub logo_url: Option<String>,
    pub cover_image_url: Option<String>,
    pub description: Option<String>,
    pub mission: Option<String>,
    pub vision: Option<String>,
    pub culture: Option<String>,
    pub benefits: Option<String>,
    pub is_featured: bool,
    pub completeness_percentage: i32,
}

impl From<CompanyProfile> for PublicCompanyProfile {
    fn from(profile: CompanyProfile) -> Self {
        Self {
            id: profile.id,
            company_name: profile.company_name,
            industry_id: profile.industry_id,
            company_size: profile.company_size,
            founded_year: profile.founded_year,
            region_id: profile.region_id,
            municipality_id: profile.municipality_id,
            website_url: profile.website_url,
            linkedin_url: profile.linkedin_url,
            video_url: profile.video_url,
            logo_url: profile.logo_url,
            cover_image_url: profile.cover_image_url,
            description: profile.description,
            mission: profile.mission,
            vision: profile.vision,
            culture: profile.culture,
            benefits: profile.benefits,
            is_featured: profile.is_featured,
            completeness_percentage: profile.completeness_percentage,
        }
    }
}

/// Company member with full user details
#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct CompanyMemberWithUser {
    pub id: Uuid,
    pub company_id: Uuid,
    pub role: MemberRole,
    pub job_title: Option<String>,
    pub is_active: bool,
    pub joined_at: DateTime<Utc>,
    pub user: UserResponse,
}

/// Full company profile with members and current user role
#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct FullCompanyProfileResponse {
    pub profile: CompanyProfile,
    pub members: Vec<CompanyMemberWithUser>,
    pub current_user_role: MemberRole,
}
