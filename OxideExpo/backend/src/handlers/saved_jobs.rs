use axum::{
    extract::{Path, Query, State},
    Extension, Json,
};
use uuid::Uuid;

use crate::{
    error::{AppError, Result},
    middleware::AuthUser,
    models::{
        job::{JobType, WorkModality, PublicJobListing},
        saved_job::*,
    },
    AppState,
};

// ============================================================================
// ENDPOINTS
// ============================================================================

/// GET /api/me/saved-jobs
/// List all saved jobs for the current user
pub async fn list_saved_jobs(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Query(query): Query<SavedJobsQuery>,
) -> Result<Json<SavedJobsResponse>> {
    // Only job seekers can save jobs
    if auth_user.user_type != "job_seeker" {
        return Err(AppError::ForbiddenError(
            "Only job seekers can access saved jobs".to_string(),
        ));
    }

    let limit = query.limit.unwrap_or(20).min(100);
    let offset = query.offset.unwrap_or(0);

    // Get total count
    let total: i64 = sqlx::query_scalar!(
        r#"SELECT COUNT(*) as "count!" FROM saved_jobs WHERE user_id = $1"#,
        auth_user.id,
    )
    .fetch_one(&state.db)
    .await?;

    // Get saved jobs with job details
    let rows = sqlx::query!(
        r#"
        SELECT
            sj.id as saved_job_id,
            sj.user_id,
            sj.job_id,
            sj.created_at as saved_at,
            j.id, j.title, j.description, j.responsibilities,
            j.job_type as "job_type: JobType",
            j.industry_id, j.work_area_id, j.position_level_id,
            j.work_modality as "work_modality: WorkModality",
            j.work_schedule,
            j.region_id, j.municipality_id,
            COALESCE(j.is_remote_allowed, false) as "is_remote_allowed!",
            j.education_level, j.years_experience_min, j.years_experience_max,
            j.benefits, j.application_deadline, j.contact_email, j.application_url,
            j.vacancies,
            COALESCE(j.is_featured, false) as "is_featured!",
            j.created_at as job_created_at,
            cp.legal_name as company_name,
            cp.logo_url as company_logo_url
        FROM saved_jobs sj
        JOIN jobs j ON j.id = sj.job_id
        JOIN company_profiles cp ON cp.id = j.company_id
        WHERE sj.user_id = $1 AND j.status = 'active'
        ORDER BY sj.created_at DESC
        LIMIT $2 OFFSET $3
        "#,
        auth_user.id,
        limit,
        offset,
    )
    .fetch_all(&state.db)
    .await?;

    let saved_jobs: Vec<SavedJobWithDetails> = rows
        .into_iter()
        .map(|row| SavedJobWithDetails {
            saved_job: SavedJob {
                id: row.saved_job_id,
                user_id: row.user_id,
                job_id: row.job_id,
                created_at: row.saved_at,
            },
            job: PublicJobListing {
                id: row.id,
                title: row.title,
                description: row.description,
                responsibilities: row.responsibilities,
                job_type: row.job_type,
                industry_id: row.industry_id,
                work_area_id: row.work_area_id,
                position_level_id: row.position_level_id,
                work_modality: row.work_modality,
                work_schedule: row.work_schedule,
                region_id: row.region_id,
                municipality_id: row.municipality_id,
                is_remote_allowed: row.is_remote_allowed,
                education_level: row.education_level,
                years_experience_min: row.years_experience_min,
                years_experience_max: row.years_experience_max,
                benefits: row.benefits,
                application_deadline: row.application_deadline,
                contact_email: row.contact_email,
                application_url: row.application_url,
                vacancies: row.vacancies,
                is_featured: row.is_featured,
                created_at: row.job_created_at,
                company_name: row.company_name.unwrap_or_default(),
                company_logo_url: row.company_logo_url,
            },
        })
        .collect();

    Ok(Json(SavedJobsResponse { saved_jobs, total }))
}

/// POST /api/me/saved-jobs/{job_id}
/// Save/bookmark a job
pub async fn save_job(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(job_id): Path<Uuid>,
) -> Result<Json<SaveJobResponse>> {
    // Only job seekers can save jobs
    if auth_user.user_type != "job_seeker" {
        return Err(AppError::ForbiddenError(
            "Only job seekers can save jobs".to_string(),
        ));
    }

    // Verify job exists and is active
    let job_exists = sqlx::query_scalar!(
        r#"SELECT EXISTS(SELECT 1 FROM jobs WHERE id = $1 AND status = 'active')"#,
        job_id,
    )
    .fetch_one(&state.db)
    .await?;

    if !job_exists.unwrap_or(false) {
        return Err(AppError::NotFound("Job not found or not active".to_string()));
    }

    // Check if already saved
    let already_saved = sqlx::query_scalar!(
        r#"SELECT EXISTS(SELECT 1 FROM saved_jobs WHERE user_id = $1 AND job_id = $2)"#,
        auth_user.id,
        job_id,
    )
    .fetch_one(&state.db)
    .await?;

    if already_saved.unwrap_or(false) {
        return Err(AppError::ValidationError("Job already saved".to_string()));
    }

    // Save the job
    let saved_job = sqlx::query!(
        r#"
        INSERT INTO saved_jobs (user_id, job_id)
        VALUES ($1, $2)
        RETURNING id
        "#,
        auth_user.id,
        job_id,
    )
    .fetch_one(&state.db)
    .await?;

    Ok(Json(SaveJobResponse {
        saved_job_id: saved_job.id,
        job_id,
        message: "Job saved successfully".to_string(),
    }))
}

/// DELETE /api/me/saved-jobs/{job_id}
/// Unsave/remove a job from saved list
pub async fn unsave_job(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(job_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    // Only job seekers can manage saved jobs
    if auth_user.user_type != "job_seeker" {
        return Err(AppError::ForbiddenError(
            "Only job seekers can manage saved jobs".to_string(),
        ));
    }

    let result = sqlx::query!(
        r#"DELETE FROM saved_jobs WHERE user_id = $1 AND job_id = $2"#,
        auth_user.id,
        job_id,
    )
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Saved job not found".to_string()));
    }

    Ok(Json(serde_json::json!({
        "message": "Job removed from saved list"
    })))
}

/// GET /api/me/saved-jobs/{job_id}/check
/// Check if a job is saved
pub async fn check_job_saved(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(job_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    // Only job seekers can check saved jobs
    if auth_user.user_type != "job_seeker" {
        return Err(AppError::ForbiddenError(
            "Only job seekers can check saved jobs".to_string(),
        ));
    }

    let is_saved = sqlx::query_scalar!(
        r#"SELECT EXISTS(SELECT 1 FROM saved_jobs WHERE user_id = $1 AND job_id = $2)"#,
        auth_user.id,
        job_id,
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(false);

    Ok(Json(serde_json::json!({
        "job_id": job_id,
        "is_saved": is_saved
    })))
}
