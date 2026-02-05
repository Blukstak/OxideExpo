use axum::{
    extract::{Request, State},
    http::StatusCode,
    middleware::Next,
    response::Response,
};

use crate::middleware::auth::AuthUser;
use crate::models::admin::{Admin, AdminRole};
use crate::AppState;

/// Middleware that requires the authenticated user to be an admin (any role)
/// Must be used after require_auth middleware
pub async fn require_admin(
    State(state): State<AppState>,
    mut request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    // Extract AuthUser from request extensions (set by require_auth)
    let auth_user = request
        .extensions()
        .get::<AuthUser>()
        .cloned()
        .ok_or_else(|| {
            tracing::error!("require_admin called without require_auth");
            StatusCode::UNAUTHORIZED
        })?;

    // Query admins table to verify user is an admin
    let admin = sqlx::query_as!(
        Admin,
        r#"
        SELECT
            id,
            user_id,
            admin_role as "admin_role: AdminRole",
            permissions,
            created_by,
            created_at,
            updated_at
        FROM admins
        WHERE user_id = $1
        "#,
        auth_user.id
    )
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error checking admin status: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .ok_or_else(|| {
        tracing::debug!("User {} is not an admin", auth_user.id);
        StatusCode::FORBIDDEN
    })?;

    // Insert Admin into request extensions for handlers to access
    request.extensions_mut().insert(admin);

    Ok(next.run(request).await)
}

/// Middleware that requires the authenticated user to be a moderator or super admin
/// Must be used after require_auth middleware
pub async fn require_moderator_or_above(
    State(state): State<AppState>,
    mut request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    // Extract AuthUser from request extensions
    let auth_user = request
        .extensions()
        .get::<AuthUser>()
        .cloned()
        .ok_or_else(|| {
            tracing::error!("require_moderator_or_above called without require_auth");
            StatusCode::UNAUTHORIZED
        })?;

    // Query admins table and check role
    let admin = sqlx::query_as!(
        Admin,
        r#"
        SELECT
            id,
            user_id,
            admin_role as "admin_role: AdminRole",
            permissions,
            created_by,
            created_at,
            updated_at
        FROM admins
        WHERE user_id = $1
        "#,
        auth_user.id
    )
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error checking admin status: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .ok_or_else(|| {
        tracing::debug!("User {} is not an admin", auth_user.id);
        StatusCode::FORBIDDEN
    })?;

    // Check admin role (moderator or super_admin)
    if admin.admin_role != AdminRole::Moderator && admin.admin_role != AdminRole::SuperAdmin {
        tracing::debug!(
            "User {} has insufficient admin permissions (role: {:?})",
            auth_user.id,
            admin.admin_role
        );
        return Err(StatusCode::FORBIDDEN);
    }

    // Insert Admin into request extensions
    request.extensions_mut().insert(admin);

    Ok(next.run(request).await)
}

/// Middleware that requires the authenticated user to be a super admin
/// Must be used after require_auth middleware
pub async fn require_super_admin(
    State(state): State<AppState>,
    mut request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    // Extract AuthUser from request extensions
    let auth_user = request
        .extensions()
        .get::<AuthUser>()
        .cloned()
        .ok_or_else(|| {
            tracing::error!("require_super_admin called without require_auth");
            StatusCode::UNAUTHORIZED
        })?;

    // Query admins table and check role
    let admin = sqlx::query_as!(
        Admin,
        r#"
        SELECT
            id,
            user_id,
            admin_role as "admin_role: AdminRole",
            permissions,
            created_by,
            created_at,
            updated_at
        FROM admins
        WHERE user_id = $1
        "#,
        auth_user.id
    )
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error checking admin status: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .ok_or_else(|| {
        tracing::debug!("User {} is not an admin", auth_user.id);
        StatusCode::FORBIDDEN
    })?;

    // Check admin role (must be super_admin)
    if admin.admin_role != AdminRole::SuperAdmin {
        tracing::debug!(
            "User {} is not a super admin (role: {:?})",
            auth_user.id,
            admin.admin_role
        );
        return Err(StatusCode::FORBIDDEN);
    }

    // Insert Admin into request extensions
    request.extensions_mut().insert(admin);

    Ok(next.run(request).await)
}
