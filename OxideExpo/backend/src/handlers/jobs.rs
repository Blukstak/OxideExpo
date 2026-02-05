use axum::{
    extract::{Path, State},
    Extension, Json,
};
use chrono::Utc;
use uuid::Uuid;
use validator::Validate;

use crate::{
    error::{AppError, Result},
    middleware::AuthUser,
    models::{
        application::*,
        company::{MemberRole, OrganizationStatus},
        job::*,
        profile::JobSeekerProfile,
    },
    AppState,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/// Get the user's company membership (company_id and role)
async fn get_user_company_membership(
    db: &sqlx::PgPool,
    user_id: Uuid,
) -> Result<(Uuid, MemberRole)> {
    let member = sqlx::query!(
        r#"
        SELECT company_id, role as "role: crate::models::company::MemberRole"
        FROM company_members
        WHERE user_id = $1 AND is_active = true
        "#,
        user_id,
    )
    .fetch_optional(db)
    .await?
    .ok_or_else(|| {
        AppError::ForbiddenError("User is not a member of any company".to_string())
    })?;

    Ok((member.company_id, member.role))
}

/// Check if user is owner or admin
fn is_owner_or_admin(role: MemberRole) -> bool {
    matches!(role, MemberRole::Owner | MemberRole::Admin)
}

/// Check if company is active
async fn check_company_active(db: &sqlx::PgPool, company_id: Uuid) -> Result<()> {
    let company = sqlx::query!(
        r#"
        SELECT status as "status: crate::models::company::OrganizationStatus"
        FROM company_profiles
        WHERE id = $1
        "#,
        company_id,
    )
    .fetch_one(db)
    .await?;

    if company.status != OrganizationStatus::Active {
        return Err(AppError::ForbiddenError(
            "Only active companies can post jobs".to_string(),
        ));
    }

    Ok(())
}

// ============================================================================
// COMPANY JOB MANAGEMENT ENDPOINTS
// ============================================================================

/// POST /api/me/jobs
/// Create new job posting (owner/admin only)
pub async fn create_job(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Json(payload): Json<CreateJobRequest>,
) -> Result<Json<Job>> {
    // Only company members can create jobs
    if auth_user.user_type != "company_member" {
        return Err(AppError::ForbiddenError(
            "Only company members can create jobs".to_string(),
        ));
    }

    payload.validate()?;

    let (company_id, role) = get_user_company_membership(&state.db, auth_user.id).await?;

    // Only owner/admin can create jobs
    if !is_owner_or_admin(role) {
        return Err(AppError::ForbiddenError(
            "Only owners and admins can create jobs".to_string(),
        ));
    }

    // Only active companies can post jobs
    check_company_active(&state.db, company_id).await?;

    // Begin transaction
    let mut tx = state.db.begin().await?;

    // Insert job
    let job = sqlx::query_as!(
        Job,
        r#"
        INSERT INTO jobs (
            company_id, posted_by, title, description, responsibilities,
            job_type, industry_id, work_area_id, position_level_id,
            work_modality, work_schedule,
            region_id, municipality_id, is_remote_allowed,
            education_level, years_experience_min, years_experience_max,
            age_min, age_max,
            salary_min,
            salary_max,
            salary_currency, salary_period, benefits,
            application_deadline, contact_email, application_url, vacancies,
            status
        ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9,
            $10, $11,
            $12, $13, $14,
            $15, $16, $17, $18, $19,
            $20, $21, $22, $23, $24,
            $25, $26, $27, $28,
            'draft'
        )
        RETURNING
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
        "#,
        company_id,
        auth_user.id,
        payload.title,
        payload.description,
        payload.responsibilities,
        payload.job_type as JobType,
        payload.industry_id,
        payload.work_area_id,
        payload.position_level_id,
        payload.work_modality as WorkModality,
        payload.work_schedule,
        payload.region_id,
        payload.municipality_id,
        payload.is_remote_allowed.unwrap_or(false),
        payload.education_level,
        payload.years_experience_min,
        payload.years_experience_max,
        payload.age_min,
        payload.age_max,
        payload.salary_min,
        payload.salary_max,
        payload.salary_currency.unwrap_or_else(|| "MXN".to_string()),
        payload.salary_period.map(|p| format!("{:?}", p).to_lowercase()),
        payload.benefits,
        payload.application_deadline,
        payload.contact_email,
        payload.application_url,
        payload.vacancies,
    )
    .fetch_one(&mut *tx)
    .await?;

    // Insert required skills
    if let Some(required_skills) = payload.required_skills {
        for skill in required_skills {
            sqlx::query!(
                r#"
                INSERT INTO job_required_skills (job_id, skill_id, minimum_proficiency)
                VALUES ($1, $2, $3)
                "#,
                job.id,
                skill.skill_id,
                skill.minimum_proficiency,
            )
            .execute(&mut *tx)
            .await?;
        }
    }

    // Insert preferred skills
    if let Some(preferred_skills) = payload.preferred_skills {
        for skill_id in preferred_skills {
            sqlx::query!(
                r#"
                INSERT INTO job_preferred_skills (job_id, skill_id)
                VALUES ($1, $2)
                "#,
                job.id,
                skill_id,
            )
            .execute(&mut *tx)
            .await?;
        }
    }

    // Insert required languages
    if let Some(required_languages) = payload.required_languages {
        for language in required_languages {
            sqlx::query!(
                r#"
                INSERT INTO job_required_languages (job_id, language_id, minimum_proficiency)
                VALUES ($1, $2, $3)
                "#,
                job.id,
                language.language_id,
                language.minimum_proficiency,
            )
            .execute(&mut *tx)
            .await?;
        }
    }

    // Insert disability accommodations
    if let Some(accommodations) = payload.disability_accommodations {
        for category in accommodations {
            sqlx::query!(
                r#"
                INSERT INTO job_disability_accommodations (job_id, disability_category)
                VALUES ($1, $2)
                "#,
                job.id,
                category as _,
            )
            .execute(&mut *tx)
            .await?;
        }
    }

    tx.commit().await?;

    Ok(Json(job))
}

/// GET /api/me/jobs
/// List all jobs for user's company
pub async fn list_company_jobs(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<Vec<Job>>> {
    // Only company members can access this
    if auth_user.user_type != "company_member" {
        return Err(AppError::ForbiddenError(
            "Only company members can access this endpoint".to_string(),
        ));
    }

    let (company_id, _) = get_user_company_membership(&state.db, auth_user.id).await?;

    let jobs = sqlx::query_as!(
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
        WHERE company_id = $1
        ORDER BY created_at DESC
        "#,
        company_id,
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(jobs))
}

/// GET /api/me/jobs/{id}
/// Get full job details with applications list (company members only)
pub async fn get_job_with_applications(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(job_id): Path<Uuid>,
) -> Result<Json<FullJobResponse>> {
    // Only company members can access this
    if auth_user.user_type != "company_member" {
        return Err(AppError::ForbiddenError(
            "Only company members can access this endpoint".to_string(),
        ));
    }

    let (company_id, _) = get_user_company_membership(&state.db, auth_user.id).await?;

    // Get job and verify it belongs to company
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
        WHERE id = $1 AND company_id = $2
        "#,
        job_id,
        company_id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Job not found".to_string()))?;

    // Get required skills
    let required_skills = sqlx::query_as!(
        JobRequiredSkill,
        r#"
        SELECT id, job_id, skill_id, minimum_proficiency, created_at
        FROM job_required_skills
        WHERE job_id = $1
        "#,
        job_id,
    )
    .fetch_all(&state.db)
    .await?;

    // Get preferred skills
    let preferred_skills = sqlx::query_as!(
        JobPreferredSkill,
        r#"
        SELECT id, job_id, skill_id, created_at
        FROM job_preferred_skills
        WHERE job_id = $1
        "#,
        job_id,
    )
    .fetch_all(&state.db)
    .await?;

    // Get required languages
    let required_languages = sqlx::query_as!(
        JobRequiredLanguage,
        r#"
        SELECT id, job_id, language_id, minimum_proficiency, created_at
        FROM job_required_languages
        WHERE job_id = $1
        "#,
        job_id,
    )
    .fetch_all(&state.db)
    .await?;

    // Get disability accommodations
    let disability_accommodations = sqlx::query_as!(
        JobDisabilityAccommodation,
        r#"
        SELECT id, job_id, disability_category as "disability_category: _", created_at
        FROM job_disability_accommodations
        WHERE job_id = $1
        "#,
        job_id,
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(FullJobResponse {
        job,
        required_skills,
        preferred_skills,
        required_languages,
        disability_accommodations,
    }))
}

/// PUT /api/me/jobs/{id}
/// Update job posting (owner/admin only)
/// TODO: Fix SQLx type inference issues with complex COALESCE query
pub async fn update_job(
    _state: State<AppState>,
    _auth_user: Extension<AuthUser>,
    _job_id: Path<Uuid>,
    _payload: Json<UpdateJobRequest>,
) -> Result<Json<Job>> {
    return Err(AppError::InternalError(
        "Update job endpoint temporarily disabled due to SQLx compilation issues".to_string()
    ));

    /* TODO: Fix the complex COALESCE query below
    let job = sqlx::query_as!(
        Job,
        r#"
        UPDATE jobs
        SET
            title = COALESCE($1, title),
            description = COALESCE($2, description),
            responsibilities = COALESCE($3, responsibilities),
            job_type = COALESCE($4, job_type),
            industry_id = COALESCE($5, industry_id),
            work_area_id = COALESCE($6, work_area_id),
            position_level_id = COALESCE($7, position_level_id),
            work_modality = COALESCE($8, work_modality),
            work_schedule = COALESCE($9, work_schedule),
            region_id = COALESCE($10, region_id),
            municipality_id = COALESCE($11, municipality_id),
            is_remote_allowed = COALESCE($12, is_remote_allowed),
            education_level = COALESCE($13, education_level),
            years_experience_min = COALESCE($14, years_experience_min),
            years_experience_max = COALESCE($15, years_experience_max),
            age_min = COALESCE($16, age_min),
            age_max = COALESCE($17, age_max),
            salary_min = COALESCE($18, salary_min),
            salary_max = COALESCE($19, salary_max),
            salary_currency = COALESCE($20, salary_currency),
            salary_period = COALESCE($21, salary_period),
            benefits = COALESCE($22, benefits),
            application_deadline = COALESCE($23, application_deadline),
            contact_email = COALESCE($24, contact_email),
            application_url = COALESCE($25, application_url),
            vacancies = COALESCE($26, vacancies)
        WHERE id = $27 AND company_id = $28
        RETURNING
            id, company_id, posted_by,
            title, description, responsibilities,
            job_type as "job_type!: JobType",
            industry_id, work_area_id, position_level_id,
            work_modality as "work_modality!: WorkModality",
            work_schedule,
            region_id, municipality_id, is_remote_allowed,
            education_level, years_experience_min, years_experience_max,
            age_min, age_max,
            salary_min as "salary_min: _",
            salary_max as "salary_max: _",
            salary_currency, salary_period, benefits,
            application_deadline, contact_email, application_url,
            vacancies, applications_count,
            status as "status!: JobStatus",
            approved_at, approved_by, rejection_reason,
            completeness_percentage, is_featured, views_count,
            created_at, updated_at
        "#,
        payload.title,
        payload.description,
        payload.responsibilities,
        payload.job_type.map(|t| t as JobType),
        payload.industry_id,
        payload.work_area_id,
        payload.position_level_id,
        payload.work_modality.map(|m| m as WorkModality),
        payload.work_schedule,
        payload.region_id,
        payload.municipality_id,
        payload.is_remote_allowed,
        payload.education_level,
        payload.years_experience_min,
        payload.years_experience_max,
        payload.age_min,
        payload.age_max,
        payload.salary_min,
        payload.salary_max,
        payload.salary_currency,
        payload.salary_period.map(|p| format!("{:?}", p).to_lowercase()),
        payload.benefits,
        payload.application_deadline,
        payload.contact_email,
        payload.application_url,
        payload.vacancies,
        job_id,
        company_id,
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound("Job not found".to_string()))?;

    // Update junction tables if provided
    if let Some(required_skills) = payload.required_skills {
        // Delete existing
        sqlx::query!("DELETE FROM job_required_skills WHERE job_id = $1", job_id)
            .execute(&mut *tx)
            .await?;

        // Insert new
        for skill in required_skills {
            sqlx::query!(
                r#"
                INSERT INTO job_required_skills (job_id, skill_id, minimum_proficiency)
                VALUES ($1, $2, $3)
                "#,
                job_id,
                skill.skill_id,
                skill.minimum_proficiency,
            )
            .execute(&mut *tx)
            .await?;
        }
    }

    if let Some(preferred_skills) = payload.preferred_skills {
        sqlx::query!("DELETE FROM job_preferred_skills WHERE job_id = $1", job_id)
            .execute(&mut *tx)
            .await?;

        for skill_id in preferred_skills {
            sqlx::query!(
                r#"
                INSERT INTO job_preferred_skills (job_id, skill_id)
                VALUES ($1, $2)
                "#,
                job_id,
                skill_id,
            )
            .execute(&mut *tx)
            .await?;
        }
    }

    if let Some(required_languages) = payload.required_languages {
        sqlx::query!("DELETE FROM job_required_languages WHERE job_id = $1", job_id)
            .execute(&mut *tx)
            .await?;

        for language in required_languages {
            sqlx::query!(
                r#"
                INSERT INTO job_required_languages (job_id, language_id, minimum_proficiency)
                VALUES ($1, $2, $3)
                "#,
                job_id,
                language.language_id,
                language.minimum_proficiency,
            )
            .execute(&mut *tx)
            .await?;
        }
    }

    if let Some(accommodations) = payload.disability_accommodations {
        sqlx::query!(
            "DELETE FROM job_disability_accommodations WHERE job_id = $1",
            job_id
        )
        .execute(&mut *tx)
        .await?;

        for category in accommodations {
            sqlx::query!(
                r#"
                INSERT INTO job_disability_accommodations (job_id, disability_category)
                VALUES ($1, $2)
                "#,
                job_id,
                category as _,
            )
            .execute(&mut *tx)
            .await?;
        }
    }

    tx.commit().await?;

    Ok(Json(job))
    */
}

/// DELETE /api/me/jobs/{id}
/// Delete job posting (owner/admin only)
pub async fn delete_job(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(job_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    // Only company members can delete jobs
    if auth_user.user_type != "company_member" {
        return Err(AppError::ForbiddenError(
            "Only company members can delete jobs".to_string(),
        ));
    }

    let (company_id, role) = get_user_company_membership(&state.db, auth_user.id).await?;

    // Only owner/admin can delete jobs
    if !is_owner_or_admin(role) {
        return Err(AppError::ForbiddenError(
            "Only owners and admins can delete jobs".to_string(),
        ));
    }

    // Check if job has applications
    let applications_count: i64 = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*) as "count!"
        FROM job_applications
        WHERE job_id = $1
        "#,
        job_id,
    )
    .fetch_one(&state.db)
    .await?;

    if applications_count > 0 {
        return Err(AppError::ValidationError(
            "Cannot delete job with existing applications. Please close the job instead."
                .to_string(),
        ));
    }

    // Delete job (CASCADE will handle junction tables)
    let result = sqlx::query!(
        r#"
        DELETE FROM jobs
        WHERE id = $1 AND company_id = $2
        "#,
        job_id,
        company_id,
    )
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Job not found".to_string()));
    }

    Ok(Json(serde_json::json!({
        "message": "Job deleted successfully"
    })))
}

/// PATCH /api/me/jobs/{id}/status
/// Change job status (owner/admin only)
pub async fn update_job_status(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(job_id): Path<Uuid>,
    Json(payload): Json<UpdateJobStatusRequest>,
) -> Result<Json<Job>> {
    // Only company members can update job status
    if auth_user.user_type != "company_member" {
        return Err(AppError::ForbiddenError(
            "Only company members can update job status".to_string(),
        ));
    }

    payload.validate()?;

    let (company_id, role) = get_user_company_membership(&state.db, auth_user.id).await?;

    // Only owner/admin can update job status
    if !is_owner_or_admin(role) {
        return Err(AppError::ForbiddenError(
            "Only owners and admins can update job status".to_string(),
        ));
    }

    // Validate rejection_reason if status is rejected
    if payload.status == JobStatus::Rejected && payload.rejection_reason.is_none() {
        return Err(AppError::ValidationError(
            "Rejection reason is required when rejecting a job".to_string(),
        ));
    }

    let job = sqlx::query_as!(
        Job,
        r#"
        UPDATE jobs
        SET
            status = $1,
            rejection_reason = $2
        WHERE id = $3 AND company_id = $4
        RETURNING
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
        "#,
        payload.status as JobStatus,
        payload.rejection_reason,
        job_id,
        company_id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Job not found".to_string()))?;

    Ok(Json(job))
}

/// GET /api/me/jobs/{id}/applications
/// List all applications for a job (company members only)
pub async fn list_job_applications(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(job_id): Path<Uuid>,
) -> Result<Json<Vec<ApplicationWithApplicantDetails>>> {
    // Only company members can access this
    if auth_user.user_type != "company_member" {
        return Err(AppError::ForbiddenError(
            "Only company members can access this endpoint".to_string(),
        ));
    }

    let (company_id, _) = get_user_company_membership(&state.db, auth_user.id).await?;

    // Verify job belongs to company
    let job_exists = sqlx::query_scalar!(
        r#"
        SELECT EXISTS(SELECT 1 FROM jobs WHERE id = $1 AND company_id = $2)
        "#,
        job_id,
        company_id,
    )
    .fetch_one(&state.db)
    .await?;

    if !job_exists.unwrap_or(false) {
        return Err(AppError::NotFound("Job not found".to_string()));
    }

    // Get applications with applicant profiles
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
        WHERE job_id = $1
        ORDER BY applied_at DESC
        "#,
        job_id,
    )
    .fetch_all(&state.db)
    .await?;

    let mut result = Vec::new();
    for application in applications {
        // Profile may not exist if job seeker hasn't created one yet
        let applicant_profile = sqlx::query_as!(
            JobSeekerProfile,
            r#"
            SELECT
                user_id, phone, date_of_birth,
                gender as "gender: crate::models::profile::Gender",
                marital_status as "marital_status: crate::models::profile::MaritalStatus",
                nationality, national_id,
                region_id, municipality_id, address,
                bio, professional_headline,
                profile_image_url, cv_url,
                completeness_percentage,
                created_at, updated_at
            FROM job_seeker_profiles
            WHERE user_id = $1
            "#,
            application.applicant_id,
        )
        .fetch_optional(&state.db)
        .await?;

        result.push(ApplicationWithApplicantDetails {
            application,
            applicant_profile,
        });
    }

    Ok(Json(result))
}

/// PUT /api/me/jobs/{job_id}/applications/{app_id}
/// Update application status (owner/admin only)
pub async fn update_application_status(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path((job_id, app_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<UpdateApplicationStatusRequest>,
) -> Result<Json<JobApplication>> {
    // Only company members can update applications
    if auth_user.user_type != "company_member" {
        return Err(AppError::ForbiddenError(
            "Only company members can update applications".to_string(),
        ));
    }

    payload.validate()?;

    let (company_id, role) = get_user_company_membership(&state.db, auth_user.id).await?;

    // Only owner/admin can update applications
    if !is_owner_or_admin(role) {
        return Err(AppError::ForbiddenError(
            "Only owners and admins can update application status".to_string(),
        ));
    }

    // Verify job belongs to company
    let job_exists = sqlx::query_scalar!(
        r#"
        SELECT EXISTS(SELECT 1 FROM jobs WHERE id = $1 AND company_id = $2)
        "#,
        job_id,
        company_id,
    )
    .fetch_one(&state.db)
    .await?;

    if !job_exists.unwrap_or(false) {
        return Err(AppError::NotFound("Job not found".to_string()));
    }

    // Update application
    let offer_date = if payload.status == ApplicationStatus::Offered {
        Some(Utc::now())
    } else {
        None
    };

    let application = sqlx::query_as!(
        JobApplication,
        r#"
        UPDATE job_applications
        SET
            status = $1::application_status,
            reviewed_at = $2,
            reviewed_by = $3,
            interview_date = COALESCE($4, interview_date),
            interview_notes = COALESCE($5, interview_notes),
            offer_date = COALESCE($6, offer_date),
            offer_details = COALESCE($7, offer_details)
        WHERE id = $8 AND job_id = $9
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
        payload.status as ApplicationStatus,
        Some(Utc::now()),
        Some(auth_user.id),
        payload.interview_date,
        payload.interview_notes,
        offer_date,
        payload.offer_details,
        app_id,
        job_id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Application not found".to_string()))?;

    Ok(Json(application))
}

/// POST /api/me/jobs/{job_id}/applications/{app_id}/notes
/// Add internal note about applicant (all company members)
pub async fn add_application_note(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path((job_id, app_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<CreateApplicationNoteRequest>,
) -> Result<Json<ApplicationNote>> {
    // Only company members can add notes
    if auth_user.user_type != "company_member" {
        return Err(AppError::ForbiddenError(
            "Only company members can add application notes".to_string(),
        ));
    }

    payload.validate()?;

    let (company_id, _) = get_user_company_membership(&state.db, auth_user.id).await?;

    // Verify job belongs to company
    let job_exists = sqlx::query_scalar!(
        r#"
        SELECT EXISTS(SELECT 1 FROM jobs WHERE id = $1 AND company_id = $2)
        "#,
        job_id,
        company_id,
    )
    .fetch_one(&state.db)
    .await?;

    if !job_exists.unwrap_or(false) {
        return Err(AppError::NotFound("Job not found".to_string()));
    }

    // Verify application exists for this job
    let app_exists = sqlx::query_scalar!(
        r#"
        SELECT EXISTS(SELECT 1 FROM job_applications WHERE id = $1 AND job_id = $2)
        "#,
        app_id,
        job_id,
    )
    .fetch_one(&state.db)
    .await?;

    if !app_exists.unwrap_or(false) {
        return Err(AppError::NotFound("Application not found".to_string()));
    }

    // Create note
    let note = sqlx::query_as!(
        ApplicationNote,
        r#"
        INSERT INTO application_notes (application_id, created_by, note_text, is_important)
        VALUES ($1, $2, $3, $4)
        RETURNING id, application_id, created_by, note_text, is_important, created_at, updated_at
        "#,
        app_id,
        auth_user.id,
        payload.note_text,
        payload.is_important.unwrap_or(false),
    )
    .fetch_one(&state.db)
    .await?;

    Ok(Json(note))
}
