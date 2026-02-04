use axum::{
    extract::{Request, State},
    http::{header, StatusCode},
    middleware::Next,
    response::Response,
};
use redis::AsyncCommands;
use uuid::Uuid;

use crate::utils::jwt;
use crate::AppState;

/// Authenticated user information extracted from JWT
#[derive(Clone, Debug)]
pub struct AuthUser {
    pub id: Uuid,
    pub email: String,
    pub user_type: String,
    /// JWT ID for blacklist checking
    pub jti: String,
}

/// Middleware that requires a valid JWT token
/// Also checks if the token has been blacklisted in Redis
pub async fn require_auth(
    State(state): State<AppState>,
    mut request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    // Extract Bearer token from Authorization header
    let auth_header = request
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|header| header.to_str().ok());

    let token = match auth_header {
        Some(header) if header.starts_with("Bearer ") => header.trim_start_matches("Bearer "),
        _ => {
            tracing::debug!("Missing or invalid Authorization header");
            return Err(StatusCode::UNAUTHORIZED);
        }
    };

    // Verify JWT signature and expiration
    let claims = match jwt::verify_access_token(token, &state.config) {
        Ok(claims) => claims,
        Err(e) => {
            tracing::debug!("JWT verification failed: {:?}", e);
            return Err(StatusCode::UNAUTHORIZED);
        }
    };

    // Check if token is blacklisted in Redis
    let blacklist_key = format!("token:blacklist:{}", claims.jti);
    let mut redis_conn = state.redis.clone();

    let is_blacklisted: bool = redis_conn
        .exists(&blacklist_key)
        .await
        .unwrap_or(false);

    if is_blacklisted {
        tracing::debug!("Token {} is blacklisted", claims.jti);
        return Err(StatusCode::UNAUTHORIZED);
    }

    // Parse user ID as UUID
    let user_id = match claims.user_id() {
        Ok(id) => id,
        Err(e) => {
            tracing::error!("Invalid user ID in JWT: {:?}", e);
            return Err(StatusCode::UNAUTHORIZED);
        }
    };

    // Insert AuthUser into request extensions for handlers to access
    request.extensions_mut().insert(AuthUser {
        id: user_id,
        email: claims.email,
        user_type: claims.user_type,
        jti: claims.jti,
    });

    Ok(next.run(request).await)
}

/// Blacklists a JWT token by storing its JTI in Redis with TTL
pub async fn blacklist_token(
    redis: &mut redis::aio::ConnectionManager,
    jti: &str,
    ttl_seconds: i64,
) -> Result<(), redis::RedisError> {
    let key = format!("token:blacklist:{}", jti);
    redis.set_ex(&key, "1", ttl_seconds as u64).await
}
