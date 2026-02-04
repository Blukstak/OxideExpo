use crate::AppState;
use axum::{extract::State, http::StatusCode, Json};
use serde::Serialize;

#[derive(Serialize)]
pub struct HealthResponse {
    pub status: String,
}

#[derive(Serialize)]
pub struct ReadinessResponse {
    pub status: String,
    pub db: String,
    pub redis: String,
    pub s3: String,
}

/// Basic health check endpoint for load balancers
/// GET /api/health
pub async fn health() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "healthy".to_string(),
    })
}

/// Detailed readiness check that verifies all service connections
/// GET /api/health/ready
pub async fn readiness(State(state): State<AppState>) -> (StatusCode, Json<ReadinessResponse>) {
    let mut response = ReadinessResponse {
        status: "healthy".to_string(),
        db: "ok".to_string(),
        redis: "ok".to_string(),
        s3: "ok".to_string(),
    };

    let mut has_error = false;

    // Check database
    match sqlx::query("SELECT 1").fetch_one(&state.db).await {
        Ok(_) => {}
        Err(e) => {
            tracing::error!("Database health check failed: {}", e);
            response.db = format!("error: {}", e);
            has_error = true;
        }
    }

    // Check Redis using PING command
    let mut redis_conn = state.redis.clone();
    match redis::cmd("PING")
        .query_async::<String>(&mut redis_conn)
        .await
    {
        Ok(_) => {}
        Err(e) => {
            tracing::error!("Redis health check failed: {}", e);
            response.redis = format!("error: {}", e);
            has_error = true;
        }
    }

    // Check S3 (head bucket to verify connection)
    match state
        .s3
        .head_bucket()
        .bucket(&state.config.s3_bucket)
        .send()
        .await
    {
        Ok(_) => {}
        Err(e) => {
            tracing::error!("S3 health check failed: {}", e);
            response.s3 = format!("error: {}", e);
            has_error = true;
        }
    }

    if has_error {
        response.status = "unhealthy".to_string();
        (StatusCode::SERVICE_UNAVAILABLE, Json(response))
    } else {
        (StatusCode::OK, Json(response))
    }
}
