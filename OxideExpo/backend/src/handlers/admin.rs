use axum::{extract::{Path, State}, Extension, Json};
use serde_json::json;
use uuid::Uuid;
use validator::Validate;

use crate::error::AppError;
use crate::middleware::auth::AuthUser;
use crate::models::admin::{
    Admin, AdminDashboardStats, ApproveCompanyRequest, ApproveJobRequest, RejectCompanyRequest,
    RejectJobRequest,
};
use crate::models::company::{CompanyProfile, OrganizationStatus};
use crate::models::job::{Job, JobStatus, JobType, WorkModality};
use crate::AppState;

// ============================================================================
// DASHBOARD & ANALYTICS
// ============================================================================

/// GET /api/admin/dashboard/stats
/// Get overview statistics for admin dashboard
pub async fn get_dashboard_stats(
    State(state): State<AppState>,
    Extension(_admin): Extension<Admin>,
) -> Result<Json<AdminDashboardStats>, AppError> {
    // Count total users
    let total_users: i64 = sqlx::query_scalar!("SELECT COUNT(*) FROM users")
        .fetch_one(&state.db)
        .await?
        .unwrap_or(0);

    // Count new users today
    let new_users_today: i64 = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM users WHERE created_at >= CURRENT_DATE"
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(0);

    // Count new users this week
    let new_users_this_week: i64 = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM users WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'"
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(0);

    // Count new users this month
    let new_users_this_month: i64 = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM users WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)"
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(0);

    // Count total companies
    let total_companies: i64 = sqlx::query_scalar!("SELECT COUNT(*) FROM company_profiles")
        .fetch_one(&state.db)
        .await?
        .unwrap_or(0);

    // Count pending companies
    let pending_companies: i64 = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM company_profiles WHERE status = 'pending_approval'"
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(0);

    // Count active companies
    let active_companies: i64 = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM company_profiles WHERE status = 'active'"
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(0);

    // Count total jobs
    let total_jobs: i64 = sqlx::query_scalar!("SELECT COUNT(*) FROM jobs")
        .fetch_one(&state.db)
        .await?
        .unwrap_or(0);

    // Count active jobs
    let active_jobs: i64 = sqlx::query_scalar!("SELECT COUNT(*) FROM jobs WHERE status = 'active'")
        .fetch_one(&state.db)
        .await?
        .unwrap_or(0);

    // Count pending jobs
    let pending_jobs: i64 =
        sqlx::query_scalar!("SELECT COUNT(*) FROM jobs WHERE status = 'pending_approval'")
            .fetch_one(&state.db)
            .await?
            .unwrap_or(0);

    // Count total applications
    let total_applications: i64 = sqlx::query_scalar!("SELECT COUNT(*) FROM job_applications")
        .fetch_one(&state.db)
        .await?
        .unwrap_or(0);

    // Count pending flagged content
    let flagged_content_pending: i64 = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM flagged_content WHERE status = 'pending'"
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(0);

    Ok(Json(AdminDashboardStats {
        total_users,
        new_users_today,
        new_users_this_week,
        new_users_this_month,
        total_companies,
        pending_companies,
        active_companies,
        total_jobs,
        active_jobs,
        pending_jobs,
        total_applications,
        flagged_content_pending,
    }))
}

// ============================================================================
// COMPANY MANAGEMENT
// ============================================================================

/// GET /api/admin/companies/pending
/// List companies pending approval
pub async fn list_pending_companies(
    State(state): State<AppState>,
    Extension(_admin): Extension<Admin>,
) -> Result<Json<Vec<CompanyProfile>>, AppError> {
    let companies = sqlx::query_as!(
        CompanyProfile,
        r#"
        SELECT
            id,
            company_name,
            legal_name,
            tax_id,
            industry_id,
            company_size,
            founded_year,
            region_id,
            municipality_id,
            address,
            phone,
            website_url,
            linkedin_url,
            video_url,
            logo_url,
            cover_image_url,
            description,
            mission,
            vision,
            culture,
            benefits,
            status as "status: OrganizationStatus",
            approved_at,
            approved_by,
            rejection_reason,
            is_featured,
            can_search_candidates,
            completeness_percentage,
            created_at,
            updated_at
        FROM company_profiles
        WHERE status = 'pending_approval'
        ORDER BY created_at ASC
        "#
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(companies))
}

/// PATCH /api/admin/companies/{id}/approve
/// Approve a company registration
pub async fn approve_company(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Extension(admin): Extension<Admin>,
    Path(company_id): Path<Uuid>,
    Json(payload): Json<ApproveCompanyRequest>,
) -> Result<Json<CompanyProfile>, AppError> {
    // Validate payload
    payload.validate()?;

    // Check if company exists and is pending
    let existing_company = sqlx::query!(
        "SELECT status::text as status FROM company_profiles WHERE id = $1",
        company_id
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Company not found".to_string()))?;

    if existing_company.status.as_deref() != Some("pending_approval") {
        return Err(AppError::ValidationError(
            "Company is not pending approval".to_string(),
        ));
    }

    // Update company status to active (MUST set both approved_at and approved_by)
    let company = sqlx::query_as!(
        CompanyProfile,
        r#"
        UPDATE company_profiles
        SET
            status = 'active'::organization_status,
            approved_at = NOW(),
            approved_by = $1,
            updated_at = NOW()
        WHERE id = $2
        RETURNING
            id,
            company_name,
            legal_name,
            tax_id,
            industry_id,
            company_size,
            founded_year,
            region_id,
            municipality_id,
            address,
            phone,
            website_url,
            linkedin_url,
            video_url,
            logo_url,
            cover_image_url,
            description,
            mission,
            vision,
            culture,
            benefits,
            status as "status: OrganizationStatus",
            approved_at,
            approved_by,
            rejection_reason,
            is_featured,
            can_search_candidates,
            completeness_percentage,
            created_at,
            updated_at
        "#,
        auth_user.id,
        company_id
    )
    .fetch_one(&state.db)
    .await?;

    // Log admin action
    log_admin_action(
        &state.db,
        admin.id,
        "approve_company",
        "company",
        company_id,
        Some(json!({
            "approval_notes": payload.approval_notes,
            "company_name": company.company_name,
        })),
    )
    .await?;

    Ok(Json(company))
}

/// PATCH /api/admin/companies/{id}/reject
/// Reject a company registration
pub async fn reject_company(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Extension(admin): Extension<Admin>,
    Path(company_id): Path<Uuid>,
    Json(payload): Json<RejectCompanyRequest>,
) -> Result<Json<CompanyProfile>, AppError> {
    // Validate payload
    payload.validate()?;

    // Check if company exists and is pending
    let existing_company = sqlx::query!(
        "SELECT status::text as status FROM company_profiles WHERE id = $1",
        company_id
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Company not found".to_string()))?;

    if existing_company.status.as_deref() != Some("pending_approval") {
        return Err(AppError::ValidationError(
            "Company is not pending approval".to_string(),
        ));
    }

    // Update company status to rejected
    let company = sqlx::query_as!(
        CompanyProfile,
        r#"
        UPDATE company_profiles
        SET
            status = 'rejected'::organization_status,
            rejection_reason = $1,
            approved_by = $2,
            updated_at = NOW()
        WHERE id = $3
        RETURNING
            id,
            company_name,
            legal_name,
            tax_id,
            industry_id,
            company_size,
            founded_year,
            region_id,
            municipality_id,
            address,
            phone,
            website_url,
            linkedin_url,
            video_url,
            logo_url,
            cover_image_url,
            description,
            mission,
            vision,
            culture,
            benefits,
            status as "status: OrganizationStatus",
            approved_at,
            approved_by,
            rejection_reason,
            is_featured,
            can_search_candidates,
            completeness_percentage,
            created_at,
            updated_at
        "#,
        payload.rejection_reason,
        auth_user.id,
        company_id
    )
    .fetch_one(&state.db)
    .await?;

    // Log admin action
    log_admin_action(
        &state.db,
        admin.id,
        "reject_company",
        "company",
        company_id,
        Some(json!({
            "rejection_reason": payload.rejection_reason,
            "company_name": company.company_name,
        })),
    )
    .await?;

    Ok(Json(company))
}

// ============================================================================
// JOB MODERATION
// ============================================================================

/// GET /api/admin/jobs/pending
/// List jobs pending approval
pub async fn list_pending_jobs(
    State(state): State<AppState>,
    Extension(_admin): Extension<Admin>,
) -> Result<Json<Vec<Job>>, AppError> {
    let jobs = sqlx::query_as!(
        Job,
        r#"
        SELECT
            id,
            company_id,
            posted_by,
            title,
            description,
            responsibilities,
            job_type as "job_type: JobType",
            industry_id,
            work_area_id,
            position_level_id,
            work_modality as "work_modality: WorkModality",
            work_schedule,
            region_id,
            municipality_id,
            is_remote_allowed,
            education_level,
            years_experience_min,
            years_experience_max,
            age_min,
            age_max,
            salary_min as "salary_min: rust_decimal::Decimal",
            salary_max as "salary_max: rust_decimal::Decimal",
            salary_currency,
            salary_period,
            benefits,
            application_deadline,
            contact_email,
            application_url,
            vacancies,
            applications_count,
            status as "status: JobStatus",
            approved_at,
            approved_by,
            rejection_reason,
            completeness_percentage,
            is_featured,
            views_count,
            created_at,
            updated_at
        FROM jobs
        WHERE status = 'pending_approval'
        ORDER BY created_at ASC
        "#
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(jobs))
}

/// PATCH /api/admin/jobs/{id}/approve
/// Approve a job posting
pub async fn approve_job(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Extension(admin): Extension<Admin>,
    Path(job_id): Path<Uuid>,
    Json(payload): Json<ApproveJobRequest>,
) -> Result<Json<Job>, AppError> {
    // Validate payload
    payload.validate()?;

    // Check if job exists and is pending
    let existing_job = sqlx::query!("SELECT status::text as status FROM jobs WHERE id = $1", job_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound("Job not found".to_string()))?;

    if existing_job.status.as_deref() != Some("pending_approval") {
        return Err(AppError::ValidationError(
            "Job is not pending approval".to_string(),
        ));
    }

    // Update job status to active (MUST set both approved_at and approved_by)
    let job = sqlx::query_as!(
        Job,
        r#"
        UPDATE jobs
        SET
            status = 'active'::job_status,
            approved_at = NOW(),
            approved_by = $1,
            updated_at = NOW()
        WHERE id = $2
        RETURNING
            id,
            company_id,
            posted_by,
            title,
            description,
            responsibilities,
            job_type as "job_type: JobType",
            industry_id,
            work_area_id,
            position_level_id,
            work_modality as "work_modality: WorkModality",
            work_schedule,
            region_id,
            municipality_id,
            is_remote_allowed,
            education_level,
            years_experience_min,
            years_experience_max,
            age_min,
            age_max,
            salary_min as "salary_min: rust_decimal::Decimal",
            salary_max as "salary_max: rust_decimal::Decimal",
            salary_currency,
            salary_period,
            benefits,
            application_deadline,
            contact_email,
            application_url,
            vacancies,
            applications_count,
            status as "status: JobStatus",
            approved_at,
            approved_by,
            rejection_reason,
            completeness_percentage,
            is_featured,
            views_count,
            created_at,
            updated_at
        "#,
        auth_user.id,
        job_id
    )
    .fetch_one(&state.db)
    .await?;

    // Log admin action
    log_admin_action(
        &state.db,
        admin.id,
        "approve_job",
        "job",
        job_id,
        Some(json!({
            "approval_notes": payload.approval_notes,
            "job_title": job.title,
        })),
    )
    .await?;

    Ok(Json(job))
}

/// PATCH /api/admin/jobs/{id}/reject
/// Reject a job posting
pub async fn reject_job(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Extension(admin): Extension<Admin>,
    Path(job_id): Path<Uuid>,
    Json(payload): Json<RejectJobRequest>,
) -> Result<Json<Job>, AppError> {
    // Validate payload
    payload.validate()?;

    // Check if job exists and is pending
    let existing_job = sqlx::query!("SELECT status::text as status FROM jobs WHERE id = $1", job_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound("Job not found".to_string()))?;

    if existing_job.status.as_deref() != Some("pending_approval") {
        return Err(AppError::ValidationError(
            "Job is not pending approval".to_string(),
        ));
    }

    // Update job status to rejected
    let job = sqlx::query_as!(
        Job,
        r#"
        UPDATE jobs
        SET
            status = 'rejected'::job_status,
            rejection_reason = $1,
            approved_by = $2,
            updated_at = NOW()
        WHERE id = $3
        RETURNING
            id,
            company_id,
            posted_by,
            title,
            description,
            responsibilities,
            job_type as "job_type: JobType",
            industry_id,
            work_area_id,
            position_level_id,
            work_modality as "work_modality: WorkModality",
            work_schedule,
            region_id,
            municipality_id,
            is_remote_allowed,
            education_level,
            years_experience_min,
            years_experience_max,
            age_min,
            age_max,
            salary_min as "salary_min: rust_decimal::Decimal",
            salary_max as "salary_max: rust_decimal::Decimal",
            salary_currency,
            salary_period,
            benefits,
            application_deadline,
            contact_email,
            application_url,
            vacancies,
            applications_count,
            status as "status: JobStatus",
            approved_at,
            approved_by,
            rejection_reason,
            completeness_percentage,
            is_featured,
            views_count,
            created_at,
            updated_at
        "#,
        payload.rejection_reason,
        auth_user.id,
        job_id
    )
    .fetch_one(&state.db)
    .await?;

    // Log admin action
    log_admin_action(
        &state.db,
        admin.id,
        "reject_job",
        "job",
        job_id,
        Some(json!({
            "rejection_reason": payload.rejection_reason,
            "job_title": job.title,
        })),
    )
    .await?;

    Ok(Json(job))
}

// ============================================================================
// AUDIT LOGGING HELPER
// ============================================================================

/// Internal helper to log admin actions to audit table
async fn log_admin_action(
    db: &sqlx::PgPool,
    admin_id: Uuid,
    action_type: &str,
    entity_type: &str,
    entity_id: Uuid,
    details: Option<serde_json::Value>,
) -> Result<(), AppError> {
    sqlx::query!(
        r#"
        INSERT INTO admin_audit_logs (admin_id, action_type, entity_type, entity_id, details)
        VALUES ($1, $2, $3, $4, $5)
        "#,
        admin_id,
        action_type,
        entity_type,
        entity_id,
        details
    )
    .execute(db)
    .await?;

    Ok(())
}
