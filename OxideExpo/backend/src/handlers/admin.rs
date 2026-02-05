use axum::{
    body::Body,
    extract::{Path, Query, State},
    http::header,
    response::Response,
    Extension, Json,
};
use chrono::Utc;
use rust_xlsxwriter::{Format, Workbook};
use serde_json::json;
use uuid::Uuid;
use validator::Validate;

use crate::error::AppError;
use crate::middleware::auth::AuthUser;
use crate::models::admin::{
    Admin, AdminAuditLog, AdminDashboardStats, AdminImpersonationResponse, ApplicationStatusCount,
    ApplicationTrendsReport, ApproveCompanyRequest, ApproveJobRequest, ApproveOmilRequest,
    AuditLogFilterParams, CompanyTrendsReport, JobTrendsReport,
    PaginatedResponse, RejectCompanyRequest, RejectJobRequest, RejectOmilRequest,
    ReportDateRangeParams, SystemSetting, TrendDataPoint,
    UpdateSettingsRequest, UpdateUserStatusRequest, UserDetail, UserFilterParams, UserListItem,
    UserTrendsReport, UserTypeCount,
};
use crate::models::company::{CompanyProfile, OrganizationStatus};
use crate::models::job::{Job, JobStatus, JobType, WorkModality};
use crate::models::omil::OmilOrganization;
use crate::models::user::{AccountStatus, UserType};
use crate::utils::jwt::create_impersonation_token;
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

// ============================================================================
// V11: USER MANAGEMENT
// ============================================================================

/// GET /api/admin/users
/// List users with filters and pagination
pub async fn list_users(
    State(state): State<AppState>,
    Extension(_admin): Extension<Admin>,
    Query(params): Query<UserFilterParams>,
) -> Result<Json<PaginatedResponse<UserListItem>>, AppError> {
    let limit = params.limit.unwrap_or(50).min(100);
    let offset = params.offset.unwrap_or(0);

    // Build dynamic query for filtering
    let total: i64 = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*)
        FROM users
        WHERE ($1::text IS NULL OR user_type::text = $1)
        AND ($2::text IS NULL OR account_status::text = $2)
        AND ($3::text IS NULL OR email ILIKE '%' || $3 || '%' OR first_name ILIKE '%' || $3 || '%' OR last_name ILIKE '%' || $3 || '%')
        "#,
        params.user_type,
        params.status,
        params.search
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(0);

    let users = sqlx::query!(
        r#"
        SELECT
            id,
            email,
            first_name,
            last_name,
            user_type as "user_type: UserType",
            account_status as "account_status: AccountStatus",
            email_verified_at,
            created_at
        FROM users
        WHERE ($1::text IS NULL OR user_type::text = $1)
        AND ($2::text IS NULL OR account_status::text = $2)
        AND ($3::text IS NULL OR email ILIKE '%' || $3 || '%' OR first_name ILIKE '%' || $3 || '%' OR last_name ILIKE '%' || $3 || '%')
        ORDER BY created_at DESC
        LIMIT $4 OFFSET $5
        "#,
        params.user_type,
        params.status,
        params.search,
        limit,
        offset
    )
    .fetch_all(&state.db)
    .await?;

    let data: Vec<UserListItem> = users
        .into_iter()
        .map(|u| UserListItem {
            id: u.id,
            email: u.email,
            first_name: u.first_name,
            last_name: u.last_name,
            user_type: u.user_type,
            account_status: u.account_status,
            email_verified_at: u.email_verified_at,
            created_at: u.created_at,
        })
        .collect();

    Ok(Json(PaginatedResponse {
        data,
        total,
        limit,
        offset,
    }))
}

/// GET /api/admin/users/{id}
/// Get user detail
pub async fn get_user_detail(
    State(state): State<AppState>,
    Extension(_admin): Extension<Admin>,
    Path(user_id): Path<Uuid>,
) -> Result<Json<UserDetail>, AppError> {
    let user = sqlx::query!(
        r#"
        SELECT
            u.id,
            u.email,
            u.first_name,
            u.last_name,
            u.user_type as "user_type: UserType",
            u.account_status as "account_status: AccountStatus",
            u.email_verified_at,
            u.created_at,
            u.updated_at,
            cm.company_id as "company_id?",
            cp.company_name as "company_name?",
            om.omil_id as "omil_id?",
            oo.organization_name as "omil_name?"
        FROM users u
        LEFT JOIN company_members cm ON cm.user_id = u.id AND cm.is_active = true
        LEFT JOIN company_profiles cp ON cp.id = cm.company_id
        LEFT JOIN omil_members om ON om.user_id = u.id AND om.is_active = true
        LEFT JOIN omil_organizations oo ON oo.id = om.omil_id
        WHERE u.id = $1
        "#,
        user_id
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("User not found".to_string()))?;

    Ok(Json(UserDetail {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        user_type: user.user_type,
        account_status: user.account_status,
        email_verified_at: user.email_verified_at,
        created_at: user.created_at,
        updated_at: user.updated_at,
        company_id: user.company_id,
        company_name: user.company_name,
        omil_id: user.omil_id,
        omil_name: user.omil_name,
    }))
}

/// PATCH /api/admin/users/{id}/status
/// Update user status (suspend/activate)
pub async fn update_user_status(
    State(state): State<AppState>,
    Extension(admin): Extension<Admin>,
    Path(user_id): Path<Uuid>,
    Json(payload): Json<UpdateUserStatusRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    payload.validate()?;

    // Update user status
    sqlx::query!(
        r#"
        UPDATE users
        SET account_status = $1, updated_at = NOW()
        WHERE id = $2
        "#,
        payload.status as AccountStatus,
        user_id
    )
    .execute(&state.db)
    .await?;

    // Log admin action
    log_admin_action(
        &state.db,
        admin.id,
        if payload.status == AccountStatus::Suspended {
            "suspend_user"
        } else {
            "activate_user"
        },
        "user",
        user_id,
        Some(json!({
            "new_status": format!("{:?}", payload.status),
            "reason": payload.reason
        })),
    )
    .await?;

    Ok(Json(json!({ "message": "User status updated successfully" })))
}

/// GET /api/admin/users/{id}/impersonate
/// Generate impersonation token for admin to act as user
pub async fn impersonate_user(
    State(state): State<AppState>,
    Extension(admin): Extension<Admin>,
    Path(user_id): Path<Uuid>,
) -> Result<Json<AdminImpersonationResponse>, AppError> {
    // Get user info
    let user = sqlx::query!(
        "SELECT id, email FROM users WHERE id = $1",
        user_id
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("User not found".to_string()))?;

    // Generate impersonation token (reuse OMIL impersonation token with admin as actor)
    let (token, jti, expires_at) = create_impersonation_token(
        user.id,
        admin.user_id, // Admin is the impersonator
        Uuid::nil(),   // No OMIL organization
        &state.config,
    )
    .map_err(|e| AppError::InternalError(format!("Failed to create token: {}", e)))?;

    // Log admin action
    log_admin_action(
        &state.db,
        admin.id,
        "impersonate_user",
        "user",
        user_id,
        Some(json!({ "token_jti": jti.to_string() })),
    )
    .await?;

    Ok(Json(AdminImpersonationResponse {
        impersonation_token: token,
        expires_at,
        user_id: user.id,
        user_email: user.email,
    }))
}

// ============================================================================
// V11: OMIL APPROVALS
// ============================================================================

/// GET /api/admin/omils/pending
/// List OMIL organizations pending approval
pub async fn list_pending_omils(
    State(state): State<AppState>,
    Extension(_admin): Extension<Admin>,
) -> Result<Json<Vec<OmilOrganization>>, AppError> {
    let omils = sqlx::query_as!(
        OmilOrganization,
        r#"
        SELECT
            id,
            organization_name,
            municipality_id,
            region_id,
            address,
            phone,
            email,
            website_url,
            status as "status: OrganizationStatus",
            approved_at,
            approved_by,
            created_at,
            updated_at
        FROM omil_organizations
        WHERE status = 'pending_approval'
        ORDER BY created_at ASC
        "#
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(omils))
}

/// PATCH /api/admin/omils/{id}/approve
/// Approve an OMIL organization
pub async fn approve_omil(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Extension(admin): Extension<Admin>,
    Path(omil_id): Path<Uuid>,
    Json(payload): Json<ApproveOmilRequest>,
) -> Result<Json<OmilOrganization>, AppError> {
    payload.validate()?;

    // Check if OMIL exists and is pending
    let existing = sqlx::query!(
        "SELECT status::text as status FROM omil_organizations WHERE id = $1",
        omil_id
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("OMIL organization not found".to_string()))?;

    if existing.status.as_deref() != Some("pending_approval") {
        return Err(AppError::ValidationError(
            "OMIL organization is not pending approval".to_string(),
        ));
    }

    // Update status
    let omil = sqlx::query_as!(
        OmilOrganization,
        r#"
        UPDATE omil_organizations
        SET
            status = 'active'::organization_status,
            approved_at = NOW(),
            approved_by = $1,
            updated_at = NOW()
        WHERE id = $2
        RETURNING
            id,
            organization_name,
            municipality_id,
            region_id,
            address,
            phone,
            email,
            website_url,
            status as "status: OrganizationStatus",
            approved_at,
            approved_by,
            created_at,
            updated_at
        "#,
        auth_user.id,
        omil_id
    )
    .fetch_one(&state.db)
    .await?;

    // Log admin action
    log_admin_action(
        &state.db,
        admin.id,
        "approve_omil",
        "omil",
        omil_id,
        Some(json!({
            "approval_notes": payload.approval_notes,
            "organization_name": omil.organization_name,
        })),
    )
    .await?;

    Ok(Json(omil))
}

/// PATCH /api/admin/omils/{id}/reject
/// Reject an OMIL organization
pub async fn reject_omil(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Extension(admin): Extension<Admin>,
    Path(omil_id): Path<Uuid>,
    Json(payload): Json<RejectOmilRequest>,
) -> Result<Json<OmilOrganization>, AppError> {
    payload.validate()?;

    // Check if OMIL exists and is pending
    let existing = sqlx::query!(
        "SELECT status::text as status FROM omil_organizations WHERE id = $1",
        omil_id
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("OMIL organization not found".to_string()))?;

    if existing.status.as_deref() != Some("pending_approval") {
        return Err(AppError::ValidationError(
            "OMIL organization is not pending approval".to_string(),
        ));
    }

    // Update status - note: omil_organizations doesn't have rejection_reason column
    // We'll add the reason in the audit log
    let omil = sqlx::query_as!(
        OmilOrganization,
        r#"
        UPDATE omil_organizations
        SET
            status = 'rejected'::organization_status,
            approved_by = $1,
            updated_at = NOW()
        WHERE id = $2
        RETURNING
            id,
            organization_name,
            municipality_id,
            region_id,
            address,
            phone,
            email,
            website_url,
            status as "status: OrganizationStatus",
            approved_at,
            approved_by,
            created_at,
            updated_at
        "#,
        auth_user.id,
        omil_id
    )
    .fetch_one(&state.db)
    .await?;

    // Log admin action with rejection reason
    log_admin_action(
        &state.db,
        admin.id,
        "reject_omil",
        "omil",
        omil_id,
        Some(json!({
            "rejection_reason": payload.rejection_reason,
            "organization_name": omil.organization_name,
        })),
    )
    .await?;

    Ok(Json(omil))
}

// ============================================================================
// V11: AUDIT LOG VIEWER
// ============================================================================

/// GET /api/admin/audit-logs
/// View audit logs with filters
pub async fn list_audit_logs(
    State(state): State<AppState>,
    Extension(_admin): Extension<Admin>,
    Query(params): Query<AuditLogFilterParams>,
) -> Result<Json<PaginatedResponse<AdminAuditLog>>, AppError> {
    let limit = params.limit.unwrap_or(50).min(100);
    let offset = params.offset.unwrap_or(0);

    let total: i64 = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*)
        FROM admin_audit_logs
        WHERE ($1::uuid IS NULL OR admin_id = $1)
        AND ($2::text IS NULL OR action_type = $2)
        AND ($3::text IS NULL OR entity_type = $3)
        AND ($4::uuid IS NULL OR entity_id = $4)
        AND ($5::timestamptz IS NULL OR created_at >= $5)
        AND ($6::timestamptz IS NULL OR created_at <= $6)
        "#,
        params.admin_id,
        params.action_type,
        params.entity_type,
        params.entity_id,
        params.from_date,
        params.to_date
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(0);

    let logs = sqlx::query_as!(
        AdminAuditLog,
        r#"
        SELECT
            id,
            admin_id,
            action_type,
            entity_type,
            entity_id,
            details,
            ip_address,
            created_at
        FROM admin_audit_logs
        WHERE ($1::uuid IS NULL OR admin_id = $1)
        AND ($2::text IS NULL OR action_type = $2)
        AND ($3::text IS NULL OR entity_type = $3)
        AND ($4::uuid IS NULL OR entity_id = $4)
        AND ($5::timestamptz IS NULL OR created_at >= $5)
        AND ($6::timestamptz IS NULL OR created_at <= $6)
        ORDER BY created_at DESC
        LIMIT $7 OFFSET $8
        "#,
        params.admin_id,
        params.action_type,
        params.entity_type,
        params.entity_id,
        params.from_date,
        params.to_date,
        limit,
        offset
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(PaginatedResponse {
        data: logs,
        total,
        limit,
        offset,
    }))
}

// ============================================================================
// V11: SYSTEM SETTINGS
// ============================================================================

/// GET /api/admin/settings
/// Get all system settings
pub async fn get_settings(
    State(state): State<AppState>,
    Extension(_admin): Extension<Admin>,
) -> Result<Json<Vec<SystemSetting>>, AppError> {
    let settings = sqlx::query!(
        "SELECT key, value, description, updated_at FROM system_settings ORDER BY key"
    )
    .fetch_all(&state.db)
    .await?;

    let result: Vec<SystemSetting> = settings
        .into_iter()
        .map(|s| SystemSetting {
            key: s.key,
            value: s.value,
            description: s.description,
            updated_at: s.updated_at,
        })
        .collect();

    Ok(Json(result))
}

/// PUT /api/admin/settings
/// Update system settings
pub async fn update_settings(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Extension(admin): Extension<Admin>,
    Json(payload): Json<UpdateSettingsRequest>,
) -> Result<Json<Vec<SystemSetting>>, AppError> {
    payload.validate()?;

    for setting in &payload.settings {
        sqlx::query!(
            r#"
            UPDATE system_settings
            SET value = $1, updated_by = $2, updated_at = NOW()
            WHERE key = $3
            "#,
            setting.value,
            auth_user.id,
            setting.key
        )
        .execute(&state.db)
        .await?;
    }

    // Log admin action
    log_admin_action(
        &state.db,
        admin.id,
        "update_settings",
        "settings",
        Uuid::nil(),
        Some(json!({
            "updated_keys": payload.settings.iter().map(|s| &s.key).collect::<Vec<_>>()
        })),
    )
    .await?;

    // Return updated settings
    get_settings(State(state), Extension(admin)).await
}

// ============================================================================
// V12: REPORTING
// ============================================================================

/// GET /api/admin/reports/users
/// User registration trends report
pub async fn report_users(
    State(state): State<AppState>,
    Extension(_admin): Extension<Admin>,
    Query(params): Query<ReportDateRangeParams>,
) -> Result<Json<UserTrendsReport>, AppError> {
    let from_date = params.from_date.unwrap_or_else(|| {
        Utc::now() - chrono::Duration::days(30)
    });
    let to_date = params.to_date.unwrap_or_else(Utc::now);

    let total_users: i64 = sqlx::query_scalar!("SELECT COUNT(*) FROM users")
        .fetch_one(&state.db)
        .await?
        .unwrap_or(0);

    let new_users_period: i64 = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM users WHERE created_at >= $1 AND created_at <= $2",
        from_date,
        to_date
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(0);

    // Users by type
    let by_type = sqlx::query!(
        r#"
        SELECT user_type::text as "user_type!", COUNT(*) as "count!"
        FROM users
        GROUP BY user_type
        "#
    )
    .fetch_all(&state.db)
    .await?
    .into_iter()
    .map(|r| UserTypeCount {
        user_type: r.user_type,
        count: r.count,
    })
    .collect();

    // Trend data (daily)
    let trend = sqlx::query!(
        r#"
        SELECT DATE(created_at)::text as "date!", COUNT(*) as "count!"
        FROM users
        WHERE created_at >= $1 AND created_at <= $2
        GROUP BY DATE(created_at)
        ORDER BY DATE(created_at)
        "#,
        from_date,
        to_date
    )
    .fetch_all(&state.db)
    .await?
    .into_iter()
    .map(|r| TrendDataPoint {
        date: r.date,
        count: r.count,
    })
    .collect();

    Ok(Json(UserTrendsReport {
        total_users,
        new_users_period,
        by_type,
        trend,
    }))
}

/// GET /api/admin/reports/companies
/// Company statistics report
pub async fn report_companies(
    State(state): State<AppState>,
    Extension(_admin): Extension<Admin>,
    Query(params): Query<ReportDateRangeParams>,
) -> Result<Json<CompanyTrendsReport>, AppError> {
    let from_date = params.from_date.unwrap_or_else(|| {
        Utc::now() - chrono::Duration::days(30)
    });
    let to_date = params.to_date.unwrap_or_else(Utc::now);

    let total_companies: i64 = sqlx::query_scalar!("SELECT COUNT(*) FROM company_profiles")
        .fetch_one(&state.db)
        .await?
        .unwrap_or(0);

    let active_companies: i64 = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM company_profiles WHERE status = 'active'"
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(0);

    let pending_companies: i64 = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM company_profiles WHERE status = 'pending_approval'"
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(0);

    let new_companies_period: i64 = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM company_profiles WHERE created_at >= $1 AND created_at <= $2",
        from_date,
        to_date
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(0);

    let trend = sqlx::query!(
        r#"
        SELECT DATE(created_at)::text as "date!", COUNT(*) as "count!"
        FROM company_profiles
        WHERE created_at >= $1 AND created_at <= $2
        GROUP BY DATE(created_at)
        ORDER BY DATE(created_at)
        "#,
        from_date,
        to_date
    )
    .fetch_all(&state.db)
    .await?
    .into_iter()
    .map(|r| TrendDataPoint {
        date: r.date,
        count: r.count,
    })
    .collect();

    Ok(Json(CompanyTrendsReport {
        total_companies,
        active_companies,
        pending_companies,
        new_companies_period,
        trend,
    }))
}

/// GET /api/admin/reports/jobs
/// Job posting trends report
pub async fn report_jobs(
    State(state): State<AppState>,
    Extension(_admin): Extension<Admin>,
    Query(params): Query<ReportDateRangeParams>,
) -> Result<Json<JobTrendsReport>, AppError> {
    let from_date = params.from_date.unwrap_or_else(|| {
        Utc::now() - chrono::Duration::days(30)
    });
    let to_date = params.to_date.unwrap_or_else(Utc::now);

    let total_jobs: i64 = sqlx::query_scalar!("SELECT COUNT(*) FROM jobs")
        .fetch_one(&state.db)
        .await?
        .unwrap_or(0);

    let active_jobs: i64 = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM jobs WHERE status = 'active'"
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(0);

    let pending_jobs: i64 = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM jobs WHERE status = 'pending_approval'"
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(0);

    let new_jobs_period: i64 = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM jobs WHERE created_at >= $1 AND created_at <= $2",
        from_date,
        to_date
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(0);

    let trend = sqlx::query!(
        r#"
        SELECT DATE(created_at)::text as "date!", COUNT(*) as "count!"
        FROM jobs
        WHERE created_at >= $1 AND created_at <= $2
        GROUP BY DATE(created_at)
        ORDER BY DATE(created_at)
        "#,
        from_date,
        to_date
    )
    .fetch_all(&state.db)
    .await?
    .into_iter()
    .map(|r| TrendDataPoint {
        date: r.date,
        count: r.count,
    })
    .collect();

    Ok(Json(JobTrendsReport {
        total_jobs,
        active_jobs,
        pending_jobs,
        new_jobs_period,
        trend,
    }))
}

/// GET /api/admin/reports/applications
/// Application trends report
pub async fn report_applications(
    State(state): State<AppState>,
    Extension(_admin): Extension<Admin>,
    Query(params): Query<ReportDateRangeParams>,
) -> Result<Json<ApplicationTrendsReport>, AppError> {
    let from_date = params.from_date.unwrap_or_else(|| {
        Utc::now() - chrono::Duration::days(30)
    });
    let to_date = params.to_date.unwrap_or_else(Utc::now);

    let total_applications: i64 = sqlx::query_scalar!("SELECT COUNT(*) FROM job_applications")
        .fetch_one(&state.db)
        .await?
        .unwrap_or(0);

    let new_applications_period: i64 = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM job_applications WHERE applied_at >= $1 AND applied_at <= $2",
        from_date,
        to_date
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(0);

    let by_status = sqlx::query!(
        r#"
        SELECT status::text as "status!", COUNT(*) as "count!"
        FROM job_applications
        GROUP BY status
        "#
    )
    .fetch_all(&state.db)
    .await?
    .into_iter()
    .map(|r| ApplicationStatusCount {
        status: r.status,
        count: r.count,
    })
    .collect();

    let trend = sqlx::query!(
        r#"
        SELECT DATE(applied_at)::text as "date!", COUNT(*) as "count!"
        FROM job_applications
        WHERE applied_at >= $1 AND applied_at <= $2
        GROUP BY DATE(applied_at)
        ORDER BY DATE(applied_at)
        "#,
        from_date,
        to_date
    )
    .fetch_all(&state.db)
    .await?
    .into_iter()
    .map(|r| TrendDataPoint {
        date: r.date,
        count: r.count,
    })
    .collect();

    Ok(Json(ApplicationTrendsReport {
        total_applications,
        new_applications_period,
        by_status,
        trend,
    }))
}

/// GET /api/admin/reports/export/{type}
/// Export report to Excel
pub async fn export_report(
    State(state): State<AppState>,
    Extension(_admin): Extension<Admin>,
    Path(report_type): Path<String>,
    Query(params): Query<ReportDateRangeParams>,
) -> Result<Response, AppError> {
    let from_date = params.from_date.unwrap_or_else(|| {
        Utc::now() - chrono::Duration::days(30)
    });
    let to_date = params.to_date.unwrap_or_else(Utc::now);

    let mut workbook = Workbook::new();
    let worksheet = workbook.add_worksheet();
    let header_format = Format::new().set_bold();
    let xlsx_err = |e: rust_xlsxwriter::XlsxError| AppError::InternalError(format!("Excel error: {}", e));

    match report_type.as_str() {
        "users" => {
            worksheet.write_string_with_format(0, 0, "Date", &header_format).map_err(xlsx_err)?;
            worksheet.write_string_with_format(0, 1, "New Users", &header_format).map_err(xlsx_err)?;

            let data = sqlx::query!(
                r#"
                SELECT DATE(created_at)::text as "date!", COUNT(*) as "count!"
                FROM users
                WHERE created_at >= $1 AND created_at <= $2
                GROUP BY DATE(created_at)
                ORDER BY DATE(created_at)
                "#,
                from_date, to_date
            )
            .fetch_all(&state.db)
            .await?;

            for (i, row) in data.iter().enumerate() {
                worksheet.write_string((i + 1) as u32, 0, &row.date).map_err(xlsx_err)?;
                worksheet.write_number((i + 1) as u32, 1, row.count as f64).map_err(xlsx_err)?;
            }
        }
        "companies" => {
            worksheet.write_string_with_format(0, 0, "Date", &header_format).map_err(xlsx_err)?;
            worksheet.write_string_with_format(0, 1, "New Companies", &header_format).map_err(xlsx_err)?;

            let data = sqlx::query!(
                r#"
                SELECT DATE(created_at)::text as "date!", COUNT(*) as "count!"
                FROM company_profiles
                WHERE created_at >= $1 AND created_at <= $2
                GROUP BY DATE(created_at)
                ORDER BY DATE(created_at)
                "#,
                from_date, to_date
            )
            .fetch_all(&state.db)
            .await?;

            for (i, row) in data.iter().enumerate() {
                worksheet.write_string((i + 1) as u32, 0, &row.date).map_err(xlsx_err)?;
                worksheet.write_number((i + 1) as u32, 1, row.count as f64).map_err(xlsx_err)?;
            }
        }
        "jobs" => {
            worksheet.write_string_with_format(0, 0, "Date", &header_format).map_err(xlsx_err)?;
            worksheet.write_string_with_format(0, 1, "New Jobs", &header_format).map_err(xlsx_err)?;

            let data = sqlx::query!(
                r#"
                SELECT DATE(created_at)::text as "date!", COUNT(*) as "count!"
                FROM jobs
                WHERE created_at >= $1 AND created_at <= $2
                GROUP BY DATE(created_at)
                ORDER BY DATE(created_at)
                "#,
                from_date, to_date
            )
            .fetch_all(&state.db)
            .await?;

            for (i, row) in data.iter().enumerate() {
                worksheet.write_string((i + 1) as u32, 0, &row.date).map_err(xlsx_err)?;
                worksheet.write_number((i + 1) as u32, 1, row.count as f64).map_err(xlsx_err)?;
            }
        }
        "applications" => {
            worksheet.write_string_with_format(0, 0, "Date", &header_format).map_err(xlsx_err)?;
            worksheet.write_string_with_format(0, 1, "New Applications", &header_format).map_err(xlsx_err)?;

            let data = sqlx::query!(
                r#"
                SELECT DATE(applied_at)::text as "date!", COUNT(*) as "count!"
                FROM job_applications
                WHERE applied_at >= $1 AND applied_at <= $2
                GROUP BY DATE(applied_at)
                ORDER BY DATE(applied_at)
                "#,
                from_date, to_date
            )
            .fetch_all(&state.db)
            .await?;

            for (i, row) in data.iter().enumerate() {
                worksheet.write_string((i + 1) as u32, 0, &row.date).map_err(xlsx_err)?;
                worksheet.write_number((i + 1) as u32, 1, row.count as f64).map_err(xlsx_err)?;
            }
        }
        _ => {
            return Err(AppError::ValidationError(format!("Unknown report type: {}", report_type)));
        }
    }

    let buffer = workbook.save_to_buffer()
        .map_err(|e| AppError::InternalError(format!("Failed to generate Excel: {}", e)))?;

    let filename = format!("{}-report-{}.xlsx", report_type, Utc::now().format("%Y%m%d"));

    let response = Response::builder()
        .header(header::CONTENT_TYPE, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        .header(header::CONTENT_DISPOSITION, format!("attachment; filename=\"{}\"", filename))
        .body(Body::from(buffer))
        .map_err(|e| AppError::InternalError(format!("Failed to build response: {}", e)))?;

    Ok(response)
}
