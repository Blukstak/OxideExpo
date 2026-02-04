use axum::{
    extract::State,
    Extension,
    Json,
};
use chrono::{DateTime, Utc};
use crate::{
    error::{AppError, Result},
    models::{AuthResponse, LoginRequest, RegisterRequest, User},
    middleware::AuthUser,
    utils::{hash_password, verify_password, create_jwt},
    AppState,
};

pub async fn register(
    State(state): State<AppState>,
    Json(payload): Json<RegisterRequest>,
) -> Result<Json<AuthResponse>> {
    // Validate email format
    if !payload.email.contains('@') {
        return Err(AppError::ValidationError("Invalid email format".to_string()));
    }

    // Validate password length
    if payload.password.len() < 8 {
        return Err(AppError::ValidationError("Password must be at least 8 characters".to_string()));
    }

    // Hash password
    let password_hash = hash_password(&payload.password)
        .map_err(|e| AppError::InternalError(format!("Failed to hash password: {}", e)))?;

    // Insert user
    let user = sqlx::query_as!(
        User,
        r#"
        INSERT INTO users (email, password_hash, nombre, apellidos, rut, telefono, region_id, user_type, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'usuario', 'T')
        RETURNING id, email, password_hash, nombre, apellidos, rut, telefono, region_id,
                  user_type, status, email_verified, created_at, updated_at
        "#,
        payload.email,
        password_hash,
        payload.nombre,
        payload.apellidos,
        payload.rut,
        payload.telefono,
        payload.region_id
    )
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        if e.to_string().contains("unique") {
            AppError::ValidationError("Email or RUT already exists".to_string())
        } else {
            AppError::DatabaseError(e)
        }
    })?;

    // Generate JWT
    let (token, expires_at) = create_jwt(user.id, &user.email, &user.user_type)
        .map_err(|e| AppError::InternalError(format!("Failed to create JWT: {}", e)))?;

    Ok(Json(AuthResponse {
        user,
        token,
        expires_at: DateTime::from_timestamp(expires_at, 0).unwrap_or(Utc::now()),
    }))
}

pub async fn login(
    State(state): State<AppState>,
    Json(payload): Json<LoginRequest>,
) -> Result<Json<AuthResponse>> {
    // Find user by email
    let user = sqlx::query_as!(
        User,
        r#"
        SELECT id, email, password_hash, nombre, apellidos, rut, telefono, region_id,
               user_type, status, email_verified, created_at, updated_at
        FROM users
        WHERE email = $1
        "#,
        payload.email
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::AuthenticationError("Invalid email or password".to_string()))?;

    // Verify password
    let is_valid = verify_password(&payload.password, &user.password_hash)
        .map_err(|e| AppError::InternalError(format!("Failed to verify password: {}", e)))?;

    if !is_valid {
        return Err(AppError::AuthenticationError("Invalid email or password".to_string()));
    }

    // Check if user is active
    if user.status != "T" {
        return Err(AppError::AuthenticationError("Account is not active".to_string()));
    }

    // Generate JWT
    let (token, expires_at) = create_jwt(user.id, &user.email, &user.user_type)
        .map_err(|e| AppError::InternalError(format!("Failed to create JWT: {}", e)))?;

    Ok(Json(AuthResponse {
        user,
        token,
        expires_at: DateTime::from_timestamp(expires_at, 0).unwrap_or(Utc::now()),
    }))
}

pub async fn me(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<User>> {
    let user = sqlx::query_as!(
        User,
        r#"
        SELECT id, email, password_hash, nombre, apellidos, rut, telefono, region_id,
               user_type, status, email_verified, created_at, updated_at
        FROM users
        WHERE id = $1
        "#,
        auth_user.id
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("User not found".to_string()))?;

    Ok(Json(user))
}
