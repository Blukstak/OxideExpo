use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, Type};
use ts_rs::TS;
use uuid::Uuid;
use validator::Validate;

// ============================================================================
// ENUMS (matching PostgreSQL enums from 0002_create_enums.sql)
// ============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type, TS)]
#[sqlx(type_name = "user_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
#[ts(export, export_to = "../frontend/src/types/")]
pub enum UserType {
    JobSeeker,
    CompanyMember,
    OmilMember,
    Admin,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type, TS)]
#[sqlx(type_name = "account_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
#[ts(export, export_to = "../frontend/src/types/")]
pub enum AccountStatus {
    PendingVerification,
    Active,
    Suspended,
    Deactivated,
}

// ============================================================================
// USER MODEL
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct User {
    pub id: Uuid,
    pub email: String,
    #[serde(skip_serializing)]
    #[ts(skip)]
    pub password_hash: String,
    pub first_name: String,
    pub last_name: String,
    pub user_type: UserType,
    pub account_status: AccountStatus,
    pub email_verified_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl User {
    pub fn is_email_verified(&self) -> bool {
        self.email_verified_at.is_some()
    }

    pub fn is_active(&self) -> bool {
        self.account_status == AccountStatus::Active
    }
}

// ============================================================================
// PUBLIC USER RESPONSE (safe for API responses)
// ============================================================================

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct UserResponse {
    pub id: Uuid,
    pub email: String,
    pub first_name: String,
    pub last_name: String,
    pub user_type: UserType,
    pub account_status: AccountStatus,
    pub email_verified: bool,
    pub created_at: DateTime<Utc>,
}

impl From<User> for UserResponse {
    fn from(user: User) -> Self {
        Self {
            id: user.id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            user_type: user.user_type,
            account_status: user.account_status,
            email_verified: user.email_verified_at.is_some(),
            created_at: user.created_at,
        }
    }
}

// ============================================================================
// REQUEST DTOs
// ============================================================================

#[derive(Debug, Deserialize, Validate, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct RegisterJobSeekerRequest {
    #[validate(email(message = "Invalid email format"))]
    pub email: String,
    #[validate(length(min = 8, message = "Password must be at least 8 characters"))]
    pub password: String,
    #[validate(length(min = 1, max = 100, message = "First name is required"))]
    pub first_name: String,
    #[validate(length(min = 1, max = 100, message = "Last name is required"))]
    pub last_name: String,
}

#[derive(Debug, Deserialize, Validate, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct RegisterCompanyRequest {
    #[validate(email(message = "Invalid email format"))]
    pub email: String,
    #[validate(length(min = 8, message = "Password must be at least 8 characters"))]
    pub password: String,
    #[validate(length(min = 1, max = 100, message = "First name is required"))]
    pub first_name: String,
    #[validate(length(min = 1, max = 100, message = "Last name is required"))]
    pub last_name: String,
    #[validate(length(min = 1, message = "Company name is required"))]
    pub company_name: String,
}

#[derive(Debug, Deserialize, Validate, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct RegisterOmilRequest {
    #[validate(email(message = "Invalid email format"))]
    pub email: String,
    #[validate(length(min = 8, message = "Password must be at least 8 characters"))]
    pub password: String,
    #[validate(length(min = 1, max = 100, message = "First name is required"))]
    pub first_name: String,
    #[validate(length(min = 1, max = 100, message = "Last name is required"))]
    pub last_name: String,
    #[validate(length(min = 1, message = "Municipality name is required"))]
    pub municipality_name: String,
}

#[derive(Debug, Deserialize, Validate, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct LoginRequest {
    #[validate(email(message = "Invalid email format"))]
    pub email: String,
    #[validate(length(min = 1, message = "Password is required"))]
    pub password: String,
}

#[derive(Debug, Deserialize, Validate, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct RefreshRequest {
    #[validate(length(min = 1, message = "Refresh token is required"))]
    pub refresh_token: String,
}

#[derive(Debug, Deserialize, Validate, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct ForgotPasswordRequest {
    #[validate(email(message = "Invalid email format"))]
    pub email: String,
}

#[derive(Debug, Deserialize, Validate, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct ResetPasswordRequest {
    #[validate(length(min = 1, message = "Token is required"))]
    pub token: String,
    #[validate(length(min = 8, message = "Password must be at least 8 characters"))]
    pub new_password: String,
}

#[derive(Debug, Deserialize, Validate, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct VerifyEmailRequest {
    #[validate(length(min = 1, message = "Token is required"))]
    pub token: String,
}

#[derive(Debug, Deserialize, Validate, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct ResendVerificationRequest {
    #[validate(email(message = "Invalid email format"))]
    pub email: String,
}

// ============================================================================
// RESPONSE DTOs
// ============================================================================

#[derive(Debug, Serialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct AuthResponse {
    pub user: UserResponse,
    pub access_token: String,
    pub refresh_token: String,
    pub token_type: String,
    pub expires_in: i64,
}

#[derive(Debug, Serialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct TokenResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub token_type: String,
    pub expires_in: i64,
}

#[derive(Debug, Serialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct MessageResponse {
    pub message: String,
}

impl MessageResponse {
    pub fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
        }
    }
}
