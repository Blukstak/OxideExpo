use axum::{
    extract::{Path, Query, State},
    Extension, Json,
};
use chrono::Utc;
use sqlx::Row;
use uuid::Uuid;
use validator::Validate;

use crate::{
    error::{AppError, Result},
    middleware::AuthUser,
    models::{application::*, job::*},
    AppState,
};

// ============================================================================
// JOB SEEKER APPLICATION ENDPOINTS
// ============================================================================

/// POST /api/me/applications
/// Submit application to a job (job seeker only)
pub async fn submit_application(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Json(payload): Json<CreateApplicationRequest>,
) -> Result<Json<JobApplication>> {
    // Only job seekers can apply
    if auth_user.user_type != "job_seeker" {
        return Err(AppError::ForbiddenError(
            "Only job seekers can apply to jobs".to_string(),
        ));
    }

    payload.validate()?;

    // Check if job exists and is active
    let job = sqlx::query_as!(
        Job,
        r#"
        SELECT
            id, company_id, posted_by,
            title, description, responsibilities,
            job_type as "job_type: JobType",
            industry_id, work_area_id, position_level_id,
            work_modality as "work_modality: WorkModality",
            work_schedule,
            region_id, municipality_id, is_remote_allowed,
            education_level, years_experience_min, years_experience_max,
            age_min, age_max,
            salary_min as "salary_min: _",
            salary_max as "salary_max: _",
            salary_currency, salary_period, benefits,
            application_deadline, contact_email, application_url,
            vacancies, applications_count,
            status as "status: JobStatus",
            approved_at, approved_by, rejection_reason,
            completeness_percentage, is_featured, views_count,
            created_at, updated_at
        FROM jobs
        WHERE id = $1 AND status = 'active'
        "#,
        payload.job_id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| {
        AppError::ValidationError("Job not found or not active".to_string())
    })?;

    // Check application deadline
    if job.application_deadline < Utc::now().date_naive() {
        return Err(AppError::ValidationError(
            "Application deadline has passed".to_string(),
        ));
    }

    // Check if user already applied
    let already_applied = sqlx::query_scalar!(
        r#"
        SELECT EXISTS(SELECT 1 FROM job_applications WHERE job_id = $1 AND applicant_id = $2)
        "#,
        payload.job_id,
        auth_user.id,
    )
    .fetch_one(&state.db)
    .await?;

    if already_applied.unwrap_or(false) {
        return Err(AppError::ValidationError(
            "You have already applied to this job".to_string(),
        ));
    }

    // Check profile completeness (must be >= 50%)
    let profile_completeness = sqlx::query_scalar!(
        r#"
        SELECT completeness_percentage
        FROM job_seeker_profiles
        WHERE user_id = $1
        "#,
        auth_user.id,
    )
    .fetch_optional(&state.db)
    .await?;

    if let Some(completeness) = profile_completeness {
        if completeness < 50 {
            return Err(AppError::ValidationError(
                "Your profile must be at least 50% complete to apply for jobs".to_string(),
            ));
        }
    } else {
        return Err(AppError::ValidationError(
            "You must complete your profile before applying for jobs".to_string(),
        ));
    }

    // Create application
    let application = sqlx::query_as!(
        JobApplication,
        r#"
        INSERT INTO job_applications (job_id, applicant_id, cover_letter, resume_url, status)
        VALUES ($1, $2, $3, $4, 'submitted')
        RETURNING
            id, job_id, applicant_id,
            status as "status: ApplicationStatus",
            cover_letter, resume_url, applied_at,
            reviewed_at, reviewed_by,
            interview_date, interview_notes,
            offer_date, offer_details, response_date,
            withdrawal_reason,
            created_at, updated_at
        "#,
        payload.job_id,
        auth_user.id,
        payload.cover_letter,
        payload.resume_url,
    )
    .fetch_one(&state.db)
    .await?;

    Ok(Json(application))
}

/// GET /api/me/applications
/// List all applications by current job seeker
pub async fn list_my_applications(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<Vec<ApplicationWithJobDetails>>> {
    // Only job seekers can access this
    if auth_user.user_type != "job_seeker" {
        return Err(AppError::ForbiddenError(
            "Only job seekers can access this endpoint".to_string(),
        ));
    }

    // Get applications
    let applications = sqlx::query_as!(
        JobApplication,
        r#"
        SELECT
            id, job_id, applicant_id,
            status as "status: ApplicationStatus",
            cover_letter, resume_url, applied_at,
            reviewed_at, reviewed_by,
            interview_date, interview_notes,
            offer_date, offer_details, response_date,
            withdrawal_reason,
            created_at, updated_at
        FROM job_applications
        WHERE applicant_id = $1
        ORDER BY applied_at DESC
        "#,
        auth_user.id,
    )
    .fetch_all(&state.db)
    .await?;

    let mut result = Vec::new();
    for application in applications {
        // Get job details (public view)
        let job = sqlx::query!(
            r#"
            SELECT
                j.id, j.title, j.description, j.responsibilities,
                j.job_type as "job_type: JobType",
                j.industry_id, j.work_area_id, j.position_level_id,
                j.work_modality as "work_modality: WorkModality",
                j.work_schedule,
                j.region_id, j.municipality_id, j.is_remote_allowed,
                j.education_level, j.years_experience_min, j.years_experience_max,
                j.benefits, j.application_deadline, j.contact_email, j.application_url,
                j.vacancies, j.is_featured, j.created_at,
                c.company_name, c.logo_url as company_logo_url
            FROM jobs j
            INNER JOIN company_profiles c ON j.company_id = c.id
            WHERE j.id = $1
            "#,
            application.job_id,
        )
        .fetch_one(&state.db)
        .await?;

        let public_job = PublicJobListing {
            id: job.id,
            title: job.title,
            description: job.description,
            responsibilities: job.responsibilities,
            job_type: job.job_type,
            industry_id: job.industry_id,
            work_area_id: job.work_area_id,
            position_level_id: job.position_level_id,
            work_modality: job.work_modality,
            work_schedule: job.work_schedule,
            region_id: job.region_id,
            municipality_id: job.municipality_id,
            is_remote_allowed: job.is_remote_allowed.unwrap_or(false),
            education_level: job.education_level,
            years_experience_min: job.years_experience_min,
            years_experience_max: job.years_experience_max,
            benefits: job.benefits,
            application_deadline: job.application_deadline,
            contact_email: job.contact_email,
            application_url: job.application_url,
            vacancies: job.vacancies,
            is_featured: job.is_featured.unwrap_or(false),
            created_at: job.created_at,
            company_name: job.company_name,
            company_logo_url: job.company_logo_url,
        };

        result.push(ApplicationWithJobDetails {
            application,
            job: public_job,
        });
    }

    Ok(Json(result))
}

/// GET /api/me/applications/{id}
/// Get application details
pub async fn get_application(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(app_id): Path<Uuid>,
) -> Result<Json<ApplicationWithJobDetails>> {
    // Only job seekers can access this
    if auth_user.user_type != "job_seeker" {
        return Err(AppError::ForbiddenError(
            "Only job seekers can access this endpoint".to_string(),
        ));
    }

    // Get application and verify ownership
    let application = sqlx::query_as!(
        JobApplication,
        r#"
        SELECT
            id, job_id, applicant_id,
            status as "status: ApplicationStatus",
            cover_letter, resume_url, applied_at,
            reviewed_at, reviewed_by,
            interview_date, interview_notes,
            offer_date, offer_details, response_date,
            withdrawal_reason,
            created_at, updated_at
        FROM job_applications
        WHERE id = $1 AND applicant_id = $2
        "#,
        app_id,
        auth_user.id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Application not found".to_string()))?;

    // Get job details (public view)
    let job = sqlx::query!(
        r#"
        SELECT
            j.id, j.title, j.description, j.responsibilities,
            j.job_type as "job_type: JobType",
            j.industry_id, j.work_area_id, j.position_level_id,
            j.work_modality as "work_modality: WorkModality",
            j.work_schedule,
            j.region_id, j.municipality_id, j.is_remote_allowed,
            j.education_level, j.years_experience_min, j.years_experience_max,
            j.benefits, j.application_deadline, j.contact_email, j.application_url,
            j.vacancies, j.is_featured, j.created_at,
            c.company_name, c.logo_url as company_logo_url
        FROM jobs j
        INNER JOIN company_profiles c ON j.company_id = c.id
        WHERE j.id = $1
        "#,
        application.job_id,
    )
    .fetch_one(&state.db)
    .await?;

    let public_job = PublicJobListing {
        id: job.id,
        title: job.title,
        description: job.description,
        responsibilities: job.responsibilities,
        job_type: job.job_type,
        industry_id: job.industry_id,
        work_area_id: job.work_area_id,
        position_level_id: job.position_level_id,
        work_modality: job.work_modality,
        work_schedule: job.work_schedule,
        region_id: job.region_id,
        municipality_id: job.municipality_id,
        is_remote_allowed: job.is_remote_allowed.unwrap_or(false),
        education_level: job.education_level,
        years_experience_min: job.years_experience_min,
        years_experience_max: job.years_experience_max,
        benefits: job.benefits,
        application_deadline: job.application_deadline,
        contact_email: job.contact_email,
        application_url: job.application_url,
        vacancies: job.vacancies,
        is_featured: job.is_featured.unwrap_or(false),
        created_at: job.created_at,
        company_name: job.company_name,
        company_logo_url: job.company_logo_url,
    };

    Ok(Json(ApplicationWithJobDetails {
        application,
        job: public_job,
    }))
}

/// PATCH /api/me/applications/{id}/withdraw
/// Withdraw application (only if status is submitted/under_review/shortlisted)
pub async fn withdraw_application(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(app_id): Path<Uuid>,
    Json(payload): Json<WithdrawApplicationRequest>,
) -> Result<Json<JobApplication>> {
    // Only job seekers can withdraw
    if auth_user.user_type != "job_seeker" {
        return Err(AppError::ForbiddenError(
            "Only job seekers can withdraw applications".to_string(),
        ));
    }

    payload.validate()?;

    // Get application and verify ownership
    let application = sqlx::query_as!(
        JobApplication,
        r#"
        SELECT
            id, job_id, applicant_id,
            status as "status: ApplicationStatus",
            cover_letter, resume_url, applied_at,
            reviewed_at, reviewed_by,
            interview_date, interview_notes,
            offer_date, offer_details, response_date,
            withdrawal_reason,
            created_at, updated_at
        FROM job_applications
        WHERE id = $1 AND applicant_id = $2
        "#,
        app_id,
        auth_user.id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Application not found".to_string()))?;

    // Check if withdrawal is allowed (only for submitted/under_review/shortlisted)
    match application.status {
        ApplicationStatus::Submitted
        | ApplicationStatus::UnderReview
        | ApplicationStatus::Shortlisted => {}
        _ => {
            return Err(AppError::ValidationError(
                "Cannot withdraw application in current status".to_string(),
            ))
        }
    }

    // Update to withdrawn
    let updated_application = sqlx::query_as!(
        JobApplication,
        r#"
        UPDATE job_applications
        SET status = 'withdrawn', withdrawal_reason = $1
        WHERE id = $2 AND applicant_id = $3
        RETURNING
            id, job_id, applicant_id,
            status as "status: ApplicationStatus",
            cover_letter, resume_url, applied_at,
            reviewed_at, reviewed_by,
            interview_date, interview_notes,
            offer_date, offer_details, response_date,
            withdrawal_reason,
            created_at, updated_at
        "#,
        payload.withdrawal_reason,
        app_id,
        auth_user.id,
    )
    .fetch_one(&state.db)
    .await?;

    Ok(Json(updated_application))
}

// ============================================================================
// PUBLIC JOB LISTING ENDPOINTS
// ============================================================================

/// GET /api/jobs
/// List active jobs (no authentication required)
pub async fn list_public_jobs(
    State(state): State<AppState>,
    Query(params): Query<PublicJobListQuery>,
) -> Result<Json<PublicJobListResponse>> {
    // Support both page/per_page and limit/offset pagination
    let per_page = params.per_page.or(params.limit).unwrap_or(20).min(100);
    let page = params.page.unwrap_or(1).max(1);
    let offset = params.offset.unwrap_or_else(|| (page - 1) * per_page);

    // Helper to build WHERE clause conditions
    let build_where_clause = |query_builder: &mut sqlx::QueryBuilder<'_, sqlx::Postgres>| {
        if let Some(region_id) = params.region_id {
            query_builder.push(" AND j.region_id = ");
            query_builder.push_bind(region_id);
        }
        if let Some(industry_id) = params.industry_id {
            query_builder.push(" AND j.industry_id = ");
            query_builder.push_bind(industry_id);
        }
        if let Some(work_area_id) = params.work_area_id {
            query_builder.push(" AND j.work_area_id = ");
            query_builder.push_bind(work_area_id);
        }
        if let Some(job_type) = params.job_type {
            query_builder.push(" AND j.job_type = ");
            query_builder.push_bind(job_type);
        }
        if let Some(work_modality) = params.work_modality {
            query_builder.push(" AND j.work_modality = ");
            query_builder.push_bind(work_modality);
        }
        if let Some(is_remote) = params.is_remote_allowed {
            query_builder.push(" AND j.is_remote_allowed = ");
            query_builder.push_bind(is_remote);
        }
        if let Some(ref search) = params.search {
            query_builder.push(" AND (j.title ILIKE ");
            query_builder.push_bind(format!("%{}%", search));
            query_builder.push(" OR j.description ILIKE ");
            query_builder.push_bind(format!("%{}%", search));
            query_builder.push(")");
        }
    };

    // Count query for pagination
    let mut count_builder = sqlx::QueryBuilder::new(
        r#"
        SELECT COUNT(*)
        FROM jobs j
        INNER JOIN company_profiles c ON j.company_id = c.id
        WHERE j.status = 'active' AND j.application_deadline >= CURRENT_DATE
        "#,
    );
    build_where_clause(&mut count_builder);

    let total: i64 = count_builder
        .build_query_scalar::<i64>()
        .fetch_one(&state.db)
        .await?;

    // Main query
    let mut query_builder = sqlx::QueryBuilder::new(
        r#"
        SELECT
            j.id, j.title, j.description, j.responsibilities,
            j.job_type, j.industry_id, j.work_area_id, j.position_level_id,
            j.work_modality, j.work_schedule,
            j.region_id, j.municipality_id, j.is_remote_allowed,
            j.education_level, j.years_experience_min, j.years_experience_max,
            j.benefits, j.application_deadline, j.contact_email, j.application_url,
            j.vacancies, j.is_featured, j.created_at,
            c.company_name, c.logo_url as company_logo_url
        FROM jobs j
        INNER JOIN company_profiles c ON j.company_id = c.id
        WHERE j.status = 'active' AND j.application_deadline >= CURRENT_DATE
        "#,
    );
    build_where_clause(&mut query_builder);

    query_builder.push(" ORDER BY j.is_featured DESC, j.created_at DESC");
    query_builder.push(" LIMIT ");
    query_builder.push_bind(per_page);
    query_builder.push(" OFFSET ");
    query_builder.push_bind(offset);

    let jobs = query_builder
        .build()
        .fetch_all(&state.db)
        .await?;

    let mut result = Vec::new();
    for row in jobs {
        result.push(PublicJobListing {
            id: row.try_get("id")?,
            title: row.try_get("title")?,
            description: row.try_get("description")?,
            responsibilities: row.try_get("responsibilities")?,
            job_type: row.try_get("job_type")?,
            industry_id: row.try_get("industry_id")?,
            work_area_id: row.try_get("work_area_id")?,
            position_level_id: row.try_get("position_level_id")?,
            work_modality: row.try_get("work_modality")?,
            work_schedule: row.try_get("work_schedule")?,
            region_id: row.try_get("region_id")?,
            municipality_id: row.try_get("municipality_id")?,
            is_remote_allowed: row.try_get("is_remote_allowed")?,
            education_level: row.try_get("education_level")?,
            years_experience_min: row.try_get("years_experience_min")?,
            years_experience_max: row.try_get("years_experience_max")?,
            benefits: row.try_get("benefits")?,
            application_deadline: row.try_get("application_deadline")?,
            contact_email: row.try_get("contact_email")?,
            application_url: row.try_get("application_url")?,
            vacancies: row.try_get("vacancies")?,
            is_featured: row.try_get("is_featured")?,
            created_at: row.try_get("created_at")?,
            company_name: row.try_get("company_name")?,
            company_logo_url: row.try_get("company_logo_url")?,
        });
    }

    let total_pages = (total as f64 / per_page as f64).ceil() as i64;

    Ok(Json(PublicJobListResponse {
        jobs: result,
        total,
        page,
        per_page,
        total_pages,
    }))
}

/// GET /api/jobs/{id}
/// Get single job public details (no authentication required)
pub async fn get_public_job(
    State(state): State<AppState>,
    Path(job_id): Path<Uuid>,
) -> Result<Json<PublicJobListing>> {
    // Get job and verify it's active
    let job = sqlx::query!(
        r#"
        SELECT
            j.id, j.title, j.description, j.responsibilities,
            j.job_type as "job_type: JobType",
            j.industry_id, j.work_area_id, j.position_level_id,
            j.work_modality as "work_modality: WorkModality",
            j.work_schedule,
            j.region_id, j.municipality_id, j.is_remote_allowed,
            j.education_level, j.years_experience_min, j.years_experience_max,
            j.benefits, j.application_deadline, j.contact_email, j.application_url,
            j.vacancies, j.is_featured, j.created_at,
            c.company_name, c.logo_url as company_logo_url
        FROM jobs j
        INNER JOIN company_profiles c ON j.company_id = c.id
        WHERE j.id = $1 AND j.status = 'active'
        "#,
        job_id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Job not found".to_string()))?;

    // Increment view count
    sqlx::query!(
        "UPDATE jobs SET views_count = views_count + 1 WHERE id = $1",
        job_id
    )
    .execute(&state.db)
    .await?;

    let public_job = PublicJobListing {
        id: job.id,
        title: job.title,
        description: job.description,
        responsibilities: job.responsibilities,
        job_type: job.job_type,
        industry_id: job.industry_id,
        work_area_id: job.work_area_id,
        position_level_id: job.position_level_id,
        work_modality: job.work_modality,
        work_schedule: job.work_schedule,
        region_id: job.region_id,
        municipality_id: job.municipality_id,
        is_remote_allowed: job.is_remote_allowed.unwrap_or(false),
        education_level: job.education_level,
        years_experience_min: job.years_experience_min,
        years_experience_max: job.years_experience_max,
        benefits: job.benefits,
        application_deadline: job.application_deadline,
        contact_email: job.contact_email,
        application_url: job.application_url,
        vacancies: job.vacancies,
        is_featured: job.is_featured.unwrap_or(false),
        created_at: job.created_at,
        company_name: job.company_name,
        company_logo_url: job.company_logo_url,
    };

    Ok(Json(public_job))
}
