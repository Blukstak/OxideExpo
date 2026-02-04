use axum::{
    extract::State,
    Extension,
    Json,
};
use crate::{
    error::{AppError, Result},
    models::{CreateApplicationRequest, JobApplication},
    middleware::AuthUser,
    AppState,
};

pub async fn create_application(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Json(payload): Json<CreateApplicationRequest>,
) -> Result<Json<JobApplication>> {
    // Check if job exists
    let job_exists = sqlx::query_scalar::<_, bool>("SELECT EXISTS(SELECT 1 FROM jobs WHERE id = $1 AND status = 'T')")
        .bind(payload.job_id)
        .fetch_one(&state.db)
        .await?;

    if !job_exists {
        return Err(AppError::NotFound("Job not found or not active".to_string()));
    }

    // Check if user already applied
    let already_applied = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM job_applications WHERE job_id = $1 AND user_id = $2)"
    )
    .bind(payload.job_id)
    .bind(auth_user.id)
    .fetch_one(&state.db)
    .await?;

    if already_applied {
        return Err(AppError::ValidationError("You have already applied to this job".to_string()));
    }

    // Create application
    let application = sqlx::query_as!(
        JobApplication,
        r#"
        INSERT INTO job_applications (job_id, user_id, cover_letter, status)
        VALUES ($1, $2, $3, 'pending')
        RETURNING id, job_id, user_id, cover_letter, cv_url, status, applied_at, reviewed_at
        "#,
        payload.job_id,
        auth_user.id,
        payload.cover_letter
    )
    .fetch_one(&state.db)
    .await?;

    Ok(Json(application))
}

pub async fn my_applications(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<Vec<JobApplication>>> {
    let applications = sqlx::query_as!(
        JobApplication,
        r#"
        SELECT id, job_id, user_id, cover_letter, cv_url, status, applied_at, reviewed_at
        FROM job_applications
        WHERE user_id = $1
        ORDER BY applied_at DESC
        "#,
        auth_user.id
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(applications))
}
