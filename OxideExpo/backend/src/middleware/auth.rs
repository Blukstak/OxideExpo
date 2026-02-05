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
    /// If this is an impersonation session, contains the OMIL actor ID
    pub impersonator_id: Option<Uuid>,
}

/// Middleware that requires a valid JWT token
/// Also checks if the token has been blacklisted in Redis
/// Supports both regular access tokens and impersonation tokens (V10)
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

    // First, try to verify as a regular access token
    if let Ok(claims) = jwt::verify_access_token(token, &state.config) {
        // Check if token is blacklisted in Redis
        let blacklist_key = format!("token:blacklist:{}", claims.jti);
        let mut redis_conn = state.redis.clone();

        let is_blacklisted: bool = redis_conn.exists(&blacklist_key).await.unwrap_or(false);

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
            impersonator_id: None,
        });

        return Ok(next.run(request).await);
    }

    // If regular token verification failed, try impersonation token (V10)
    if let Ok(impersonation_claims) = jwt::verify_impersonation_token(token, &state.config) {
        // Verify impersonation session is valid in database (not revoked)
        let jti = match impersonation_claims.jti_uuid() {
            Ok(jti) => jti,
            Err(_) => {
                tracing::debug!("Invalid JTI in impersonation token");
                return Err(StatusCode::UNAUTHORIZED);
            }
        };

        let session_valid: bool = sqlx::query_scalar!(
            r#"SELECT EXISTS(
                SELECT 1 FROM omil_impersonation_sessions
                WHERE token_jti = $1 AND revoked_at IS NULL AND expires_at > NOW()
            )"#,
            jti
        )
        .fetch_one(&state.db)
        .await
        .map(|v| v.unwrap_or(false))
        .unwrap_or(false);

        if !session_valid {
            tracing::debug!("Impersonation session {} is invalid or revoked", jti);
            return Err(StatusCode::UNAUTHORIZED);
        }

        // Get the job seeker's email
        let job_seeker_id = match impersonation_claims.job_seeker_id() {
            Ok(id) => id,
            Err(_) => {
                tracing::debug!("Invalid job seeker ID in impersonation token");
                return Err(StatusCode::UNAUTHORIZED);
            }
        };

        let user = sqlx::query!(
            "SELECT email FROM users WHERE id = $1",
            job_seeker_id
        )
        .fetch_optional(&state.db)
        .await
        .ok()
        .flatten();

        let email = user.map(|u| u.email).unwrap_or_default();

        let impersonator_id = impersonation_claims.omil_actor_id().ok();

        // Insert AuthUser as the job seeker, with impersonator tracked
        request.extensions_mut().insert(AuthUser {
            id: job_seeker_id,
            email,
            user_type: "job_seeker".to_string(),
            jti: impersonation_claims.jti,
            impersonator_id,
        });

        tracing::info!(
            "OMIL impersonation: actor {:?} acting as job seeker {}",
            impersonator_id,
            job_seeker_id
        );

        return Ok(next.run(request).await);
    }

    tracing::debug!("JWT verification failed for both regular and impersonation tokens");
    Err(StatusCode::UNAUTHORIZED)
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
