use axum::{extract::State, Extension, Json};
use chrono::{Duration, Utc};
use validator::Validate;

use crate::{
    error::{AppError, Result},
    middleware::{blacklist_token, AuthUser},
    models::user::{
        AccountStatus, AuthResponse, ForgotPasswordRequest, LoginRequest, MessageResponse,
        RefreshRequest, RegisterCompanyRequest, RegisterJobSeekerRequest, RegisterOmilRequest,
        ResetPasswordRequest, ResendVerificationRequest, TokenResponse, User, UserResponse,
        UserType, VerifyEmailRequest,
    },
    utils::{
        jwt::{create_access_token, create_refresh_token, hash_token},
        password::{hash_password, verify_password},
    },
    AppState,
};

// ============================================================================
// REGISTRATION ENDPOINTS
// ============================================================================

/// POST /api/auth/register
/// Register a new job seeker account
pub async fn register_job_seeker(
    State(state): State<AppState>,
    Json(payload): Json<RegisterJobSeekerRequest>,
) -> Result<Json<AuthResponse>> {
    payload.validate()?;

    let password_hash = hash_password(&payload.password)
        .map_err(|e| AppError::InternalError(format!("Failed to hash password: {}", e)))?;

    let user = sqlx::query_as!(
        User,
        r#"
        INSERT INTO users (email, password_hash, first_name, last_name, user_type, account_status)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, email, password_hash, first_name, last_name,
                  user_type as "user_type: UserType",
                  account_status as "account_status: AccountStatus",
                  email_verified_at, created_at, updated_at
        "#,
        payload.email.to_lowercase(),
        password_hash,
        payload.first_name,
        payload.last_name,
        UserType::JobSeeker as UserType,
        AccountStatus::PendingVerification as AccountStatus,
    )
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        if e.to_string().contains("unique") || e.to_string().contains("duplicate") {
            AppError::ConflictError("Email already registered".to_string())
        } else {
            AppError::DatabaseError(e)
        }
    })?;

    // Create tokens
    let (access_token, expires_in) =
        create_access_token(user.id, &user.email, user.user_type, &state.config)
            .map_err(|e| AppError::InternalError(format!("Failed to create token: {}", e)))?;

    let refresh_token = create_refresh_token();
    store_refresh_token(&state, user.id, &refresh_token).await?;

    // Send verification email (async, don't wait)
    let email_service = state.email.clone();
    let user_email = user.email.clone();
    let user_name = user.first_name.clone();
    let verification_token = create_verification_token(&state, user.id).await?;
    tokio::spawn(async move {
        if let Err(e) = email_service
            .send_verification_email(&user_email, &user_name, &verification_token)
            .await
        {
            tracing::error!("Failed to send verification email: {:?}", e);
        }
    });

    Ok(Json(AuthResponse {
        user: user.into(),
        access_token,
        refresh_token,
        token_type: "Bearer".to_string(),
        expires_in,
    }))
}

/// POST /api/auth/register/company
/// Register a new company member account (pending approval)
pub async fn register_company(
    State(state): State<AppState>,
    Json(payload): Json<RegisterCompanyRequest>,
) -> Result<Json<AuthResponse>> {
    payload.validate()?;

    let password_hash = hash_password(&payload.password)
        .map_err(|e| AppError::InternalError(format!("Failed to hash password: {}", e)))?;

    // Start transaction to create user + company profile + membership atomically
    let mut tx = state.db.begin().await?;

    // Create user
    let user = sqlx::query_as!(
        User,
        r#"
        INSERT INTO users (email, password_hash, first_name, last_name, user_type, account_status)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, email, password_hash, first_name, last_name,
                  user_type as "user_type: UserType",
                  account_status as "account_status: AccountStatus",
                  email_verified_at, created_at, updated_at
        "#,
        payload.email.to_lowercase(),
        password_hash,
        payload.first_name,
        payload.last_name,
        UserType::CompanyMember as UserType,
        AccountStatus::PendingVerification as AccountStatus,
    )
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| {
        if e.to_string().contains("unique") || e.to_string().contains("duplicate") {
            AppError::ConflictError("Email already registered".to_string())
        } else {
            AppError::DatabaseError(e)
        }
    })?;

    // Create company profile (pending approval)
    let company = sqlx::query!(
        r#"
        INSERT INTO company_profiles (company_name, status)
        VALUES ($1, 'pending_approval')
        RETURNING id
        "#,
        payload.company_name,
    )
    .fetch_one(&mut *tx)
    .await?;

    // Create company membership (user becomes owner)
    sqlx::query!(
        r#"
        INSERT INTO company_members (company_id, user_id, role, joined_at)
        VALUES ($1, $2, 'owner', NOW())
        "#,
        company.id,
        user.id,
    )
    .execute(&mut *tx)
    .await?;

    // Commit transaction
    tx.commit().await?;

    // Create tokens
    let (access_token, expires_in) =
        create_access_token(user.id, &user.email, user.user_type, &state.config)
            .map_err(|e| AppError::InternalError(format!("Failed to create token: {}", e)))?;

    let refresh_token = create_refresh_token();
    store_refresh_token(&state, user.id, &refresh_token).await?;

    // Send verification email
    let email_service = state.email.clone();
    let user_email = user.email.clone();
    let user_name = user.first_name.clone();
    let verification_token = create_verification_token(&state, user.id).await?;
    tokio::spawn(async move {
        if let Err(e) = email_service
            .send_verification_email(&user_email, &user_name, &verification_token)
            .await
        {
            tracing::error!("Failed to send verification email: {:?}", e);
        }
    });

    Ok(Json(AuthResponse {
        user: user.into(),
        access_token,
        refresh_token,
        token_type: "Bearer".to_string(),
        expires_in,
    }))
}

/// POST /api/auth/register/omil
/// Register a new OMIL member account (pending approval)
pub async fn register_omil(
    State(state): State<AppState>,
    Json(payload): Json<RegisterOmilRequest>,
) -> Result<Json<AuthResponse>> {
    payload.validate()?;

    let password_hash = hash_password(&payload.password)
        .map_err(|e| AppError::InternalError(format!("Failed to hash password: {}", e)))?;

    // Note: municipality_name would be used to link to OMIL record in future
    let _ = &payload.municipality_name;

    let user = sqlx::query_as!(
        User,
        r#"
        INSERT INTO users (email, password_hash, first_name, last_name, user_type, account_status)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, email, password_hash, first_name, last_name,
                  user_type as "user_type: UserType",
                  account_status as "account_status: AccountStatus",
                  email_verified_at, created_at, updated_at
        "#,
        payload.email.to_lowercase(),
        password_hash,
        payload.first_name,
        payload.last_name,
        UserType::OmilMember as UserType,
        AccountStatus::PendingVerification as AccountStatus,
    )
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        if e.to_string().contains("unique") || e.to_string().contains("duplicate") {
            AppError::ConflictError("Email already registered".to_string())
        } else {
            AppError::DatabaseError(e)
        }
    })?;

    // Create tokens
    let (access_token, expires_in) =
        create_access_token(user.id, &user.email, user.user_type, &state.config)
            .map_err(|e| AppError::InternalError(format!("Failed to create token: {}", e)))?;

    let refresh_token = create_refresh_token();
    store_refresh_token(&state, user.id, &refresh_token).await?;

    // Send verification email
    let email_service = state.email.clone();
    let user_email = user.email.clone();
    let user_name = user.first_name.clone();
    let verification_token = create_verification_token(&state, user.id).await?;
    tokio::spawn(async move {
        if let Err(e) = email_service
            .send_verification_email(&user_email, &user_name, &verification_token)
            .await
        {
            tracing::error!("Failed to send verification email: {:?}", e);
        }
    });

    Ok(Json(AuthResponse {
        user: user.into(),
        access_token,
        refresh_token,
        token_type: "Bearer".to_string(),
        expires_in,
    }))
}

// ============================================================================
// LOGIN / LOGOUT ENDPOINTS
// ============================================================================

/// POST /api/auth/login
/// Authenticate user with email and password
pub async fn login(
    State(state): State<AppState>,
    Json(payload): Json<LoginRequest>,
) -> Result<Json<AuthResponse>> {
    payload.validate()?;

    let user = sqlx::query_as!(
        User,
        r#"
        SELECT id, email, password_hash, first_name, last_name,
               user_type as "user_type: UserType",
               account_status as "account_status: AccountStatus",
               email_verified_at, created_at, updated_at
        FROM users
        WHERE email = $1
        "#,
        payload.email.to_lowercase()
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::AuthenticationError("Invalid email or password".to_string()))?;

    // Verify password
    let is_valid = verify_password(&payload.password, &user.password_hash)
        .map_err(|e| AppError::InternalError(format!("Failed to verify password: {}", e)))?;

    if !is_valid {
        return Err(AppError::AuthenticationError(
            "Invalid email or password".to_string(),
        ));
    }

    // Check account status
    match user.account_status {
        AccountStatus::Suspended => {
            return Err(AppError::ForbiddenError("Account is suspended".to_string()));
        }
        AccountStatus::Deactivated => {
            return Err(AppError::ForbiddenError(
                "Account is deactivated".to_string(),
            ));
        }
        _ => {}
    }

    // Create tokens
    let (access_token, expires_in) =
        create_access_token(user.id, &user.email, user.user_type, &state.config)
            .map_err(|e| AppError::InternalError(format!("Failed to create token: {}", e)))?;

    let refresh_token = create_refresh_token();
    store_refresh_token(&state, user.id, &refresh_token).await?;

    Ok(Json(AuthResponse {
        user: user.into(),
        access_token,
        refresh_token,
        token_type: "Bearer".to_string(),
        expires_in,
    }))
}

/// POST /api/auth/logout
/// Invalidate the current access token by adding it to Redis blacklist
pub async fn logout(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<MessageResponse>> {
    // Blacklist the JWT
    let mut redis_conn = state.redis.clone();
    blacklist_token(&mut redis_conn, &auth_user.jti, state.config.jwt_access_expiry)
        .await
        .map_err(|e| AppError::InternalError(format!("Failed to blacklist token: {}", e)))?;

    // Revoke all refresh tokens for this user
    sqlx::query!(
        r#"
        UPDATE refresh_tokens
        SET revoked_at = NOW()
        WHERE user_id = $1 AND revoked_at IS NULL
        "#,
        auth_user.id
    )
    .execute(&state.db)
    .await?;

    Ok(Json(MessageResponse::new("Logged out successfully")))
}

// ============================================================================
// TOKEN REFRESH ENDPOINT
// ============================================================================

/// POST /api/auth/refresh
/// Exchange a refresh token for new access and refresh tokens
pub async fn refresh(
    State(state): State<AppState>,
    Json(payload): Json<RefreshRequest>,
) -> Result<Json<TokenResponse>> {
    payload.validate()?;

    let token_hash = hash_token(&payload.refresh_token);

    // Find and validate refresh token
    let stored_token = sqlx::query!(
        r#"
        SELECT rt.id, rt.user_id, rt.expires_at, rt.revoked_at,
               u.email, u.user_type as "user_type: UserType"
        FROM refresh_tokens rt
        JOIN users u ON u.id = rt.user_id
        WHERE rt.token_hash = $1
        "#,
        token_hash
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::AuthenticationError("Invalid refresh token".to_string()))?;

    // Check if revoked
    if stored_token.revoked_at.is_some() {
        return Err(AppError::AuthenticationError(
            "Refresh token has been revoked".to_string(),
        ));
    }

    // Check if expired
    if stored_token.expires_at < Utc::now() {
        return Err(AppError::AuthenticationError(
            "Refresh token has expired".to_string(),
        ));
    }

    // Revoke old refresh token (rotation)
    sqlx::query!(
        "UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1",
        stored_token.id
    )
    .execute(&state.db)
    .await?;

    // Create new tokens
    let (access_token, expires_in) = create_access_token(
        stored_token.user_id,
        &stored_token.email,
        stored_token.user_type,
        &state.config,
    )
    .map_err(|e| AppError::InternalError(format!("Failed to create token: {}", e)))?;

    let new_refresh_token = create_refresh_token();
    store_refresh_token(&state, stored_token.user_id, &new_refresh_token).await?;

    Ok(Json(TokenResponse {
        access_token,
        refresh_token: new_refresh_token,
        token_type: "Bearer".to_string(),
        expires_in,
    }))
}

// ============================================================================
// CURRENT USER ENDPOINT
// ============================================================================

/// GET /api/auth/me
/// Get the current authenticated user's information
pub async fn me(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<UserResponse>> {
    let user = sqlx::query_as!(
        User,
        r#"
        SELECT id, email, password_hash, first_name, last_name,
               user_type as "user_type: UserType",
               account_status as "account_status: AccountStatus",
               email_verified_at, created_at, updated_at
        FROM users
        WHERE id = $1
        "#,
        auth_user.id
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("User not found".to_string()))?;

    Ok(Json(user.into()))
}

// ============================================================================
// PASSWORD RESET ENDPOINTS
// ============================================================================

/// POST /api/auth/password/forgot
/// Request a password reset email
/// Always returns success to prevent email enumeration
pub async fn forgot_password(
    State(state): State<AppState>,
    Json(payload): Json<ForgotPasswordRequest>,
) -> Result<Json<MessageResponse>> {
    payload.validate()?;

    // Find user (but don't reveal if they exist)
    let user = sqlx::query!(
        "SELECT id, email, first_name FROM users WHERE email = $1",
        payload.email.to_lowercase()
    )
    .fetch_optional(&state.db)
    .await?;

    if let Some(user) = user {
        // Create password reset token
        let token = create_refresh_token(); // Reuse secure token generation
        let token_hash = hash_token(&token);
        let expires_at = Utc::now() + Duration::hours(1);

        // Delete any existing tokens for this user
        sqlx::query!(
            "DELETE FROM password_reset_tokens WHERE user_id = $1",
            user.id
        )
        .execute(&state.db)
        .await?;

        // Store new token
        sqlx::query!(
            r#"
            INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
            VALUES ($1, $2, $3)
            "#,
            user.id,
            token_hash,
            expires_at
        )
        .execute(&state.db)
        .await?;

        // Send email (async)
        let email_service = state.email.clone();
        let user_email = user.email;
        let user_name = user.first_name;
        tokio::spawn(async move {
            if let Err(e) = email_service
                .send_password_reset_email(&user_email, &user_name, &token)
                .await
            {
                tracing::error!("Failed to send password reset email: {:?}", e);
            }
        });
    }

    // Always return success to prevent enumeration
    Ok(Json(MessageResponse::new(
        "If an account exists with this email, a password reset link has been sent",
    )))
}

/// POST /api/auth/password/reset
/// Reset password using a valid token
pub async fn reset_password(
    State(state): State<AppState>,
    Json(payload): Json<ResetPasswordRequest>,
) -> Result<Json<MessageResponse>> {
    payload.validate()?;

    let token_hash = hash_token(&payload.token);

    // Find valid token
    let token_record = sqlx::query!(
        r#"
        SELECT id, user_id, expires_at, used_at
        FROM password_reset_tokens
        WHERE token_hash = $1
        "#,
        token_hash
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::ValidationError("Invalid or expired token".to_string()))?;

    // Check if already used
    if token_record.used_at.is_some() {
        return Err(AppError::ValidationError(
            "This token has already been used".to_string(),
        ));
    }

    // Check if expired
    if token_record.expires_at < Utc::now() {
        return Err(AppError::ValidationError("Token has expired".to_string()));
    }

    // Hash new password
    let password_hash = hash_password(&payload.new_password)
        .map_err(|e| AppError::InternalError(format!("Failed to hash password: {}", e)))?;

    // Update password
    sqlx::query!(
        "UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2",
        password_hash,
        token_record.user_id
    )
    .execute(&state.db)
    .await?;

    // Mark token as used
    sqlx::query!(
        "UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1",
        token_record.id
    )
    .execute(&state.db)
    .await?;

    // Revoke all refresh tokens (force re-login)
    sqlx::query!(
        "UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL",
        token_record.user_id
    )
    .execute(&state.db)
    .await?;

    Ok(Json(MessageResponse::new(
        "Password has been reset successfully",
    )))
}

// ============================================================================
// EMAIL VERIFICATION ENDPOINTS
// ============================================================================

/// POST /api/auth/email/verify
/// Verify email address using a token
pub async fn verify_email(
    State(state): State<AppState>,
    Json(payload): Json<VerifyEmailRequest>,
) -> Result<Json<MessageResponse>> {
    payload.validate()?;

    let token_hash = hash_token(&payload.token);

    // Find valid token
    let token_record = sqlx::query!(
        r#"
        SELECT id, user_id, expires_at, used_at
        FROM email_verification_tokens
        WHERE token_hash = $1
        "#,
        token_hash
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::ValidationError("Invalid or expired token".to_string()))?;

    // Check if already used
    if token_record.used_at.is_some() {
        return Err(AppError::ValidationError(
            "This token has already been used".to_string(),
        ));
    }

    // Check if expired
    if token_record.expires_at < Utc::now() {
        return Err(AppError::ValidationError("Token has expired".to_string()));
    }

    // Update user's email verification status and activate account
    sqlx::query!(
        r#"
        UPDATE users
        SET email_verified_at = NOW(),
            account_status = $1,
            updated_at = NOW()
        WHERE id = $2
        "#,
        AccountStatus::Active as AccountStatus,
        token_record.user_id
    )
    .execute(&state.db)
    .await?;

    // Mark token as used
    sqlx::query!(
        "UPDATE email_verification_tokens SET used_at = NOW() WHERE id = $1",
        token_record.id
    )
    .execute(&state.db)
    .await?;

    Ok(Json(MessageResponse::new("Email verified successfully")))
}

/// POST /api/auth/email/resend
/// Resend verification email
/// Always returns success to prevent email enumeration
pub async fn resend_verification(
    State(state): State<AppState>,
    Json(payload): Json<ResendVerificationRequest>,
) -> Result<Json<MessageResponse>> {
    payload.validate()?;

    // Find user
    let user = sqlx::query!(
        r#"
        SELECT id, email, first_name, email_verified_at
        FROM users
        WHERE email = $1
        "#,
        payload.email.to_lowercase()
    )
    .fetch_optional(&state.db)
    .await?;

    if let Some(user) = user {
        // Only send if not already verified
        if user.email_verified_at.is_none() {
            let verification_token = create_verification_token(&state, user.id).await?;

            let email_service = state.email.clone();
            let user_email = user.email;
            let user_name = user.first_name;
            tokio::spawn(async move {
                if let Err(e) = email_service
                    .send_verification_email(&user_email, &user_name, &verification_token)
                    .await
                {
                    tracing::error!("Failed to send verification email: {:?}", e);
                }
            });
        }
    }

    // Always return success to prevent enumeration
    Ok(Json(MessageResponse::new(
        "If an unverified account exists with this email, a verification link has been sent",
    )))
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async fn store_refresh_token(
    state: &AppState,
    user_id: uuid::Uuid,
    token: &str,
) -> Result<()> {
    let token_hash = hash_token(token);
    let expires_at = Utc::now() + Duration::seconds(state.config.jwt_refresh_expiry);

    sqlx::query!(
        r#"
        INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
        VALUES ($1, $2, $3)
        "#,
        user_id,
        token_hash,
        expires_at
    )
    .execute(&state.db)
    .await?;

    Ok(())
}

async fn create_verification_token(state: &AppState, user_id: uuid::Uuid) -> Result<String> {
    let token = create_refresh_token(); // Reuse secure token generation
    let token_hash = hash_token(&token);
    let expires_at = Utc::now() + Duration::hours(24);

    // Delete any existing tokens for this user
    sqlx::query!(
        "DELETE FROM email_verification_tokens WHERE user_id = $1",
        user_id
    )
    .execute(&state.db)
    .await?;

    // Store new token
    sqlx::query!(
        r#"
        INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
        VALUES ($1, $2, $3)
        "#,
        user_id,
        token_hash,
        expires_at
    )
    .execute(&state.db)
    .await?;

    Ok(token)
}
