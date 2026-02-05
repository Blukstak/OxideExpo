use axum::{
    extract::{Path, State},
    Extension, Json,
};
use uuid::Uuid;
use validator::Validate;

use crate::{
    error::{AppError, Result},
    middleware::AuthUser,
    models::{
        admin::{ApplicationStatusCount, CompanyDashboard, TopJobPerformance, TrendDataPoint},
        company::*,
        user::{MessageResponse, UserResponse},
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

// ============================================================================
// AUTHENTICATED COMPANY ENDPOINTS
// ============================================================================

/// GET /api/me/company/profile
/// Get current user's company profile
pub async fn get_company_profile(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<CompanyProfile>> {
    // Only company members can access this
    if auth_user.user_type != "company_member" {
        return Err(AppError::ForbiddenError(
            "Only company members can access this endpoint".to_string(),
        ));
    }

    let (company_id, _) = get_user_company_membership(&state.db, auth_user.id).await?;

    // Get company profile
    let profile = sqlx::query_as!(
        CompanyProfile,
        r#"
        SELECT id, company_name, legal_name, tax_id,
               industry_id, company_size, founded_year,
               region_id, municipality_id, address, phone,
               website_url, linkedin_url, video_url,
               logo_url, cover_image_url,
               description, mission, vision, culture, benefits,
               status as "status: crate::models::company::OrganizationStatus",
               approved_at, approved_by, rejection_reason,
               is_featured, can_search_candidates,
               completeness_percentage, created_at, updated_at
        FROM company_profiles
        WHERE id = $1
        "#,
        company_id,
    )
    .fetch_one(&state.db)
    .await?;

    Ok(Json(profile))
}

/// PUT /api/me/company/profile
/// Update current user's company profile (owner/admin only)
pub async fn update_company_profile(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Json(payload): Json<UpdateCompanyProfileRequest>,
) -> Result<Json<CompanyProfile>> {
    payload.validate()?;

    if auth_user.user_type != "company_member" {
        return Err(AppError::ForbiddenError(
            "Only company members can access this endpoint".to_string(),
        ));
    }

    let (company_id, role) = get_user_company_membership(&state.db, auth_user.id).await?;

    // Only owner or admin can update
    if !is_owner_or_admin(role) {
        return Err(AppError::ForbiddenError(
            "Only company owners or admins can update the profile".to_string(),
        ));
    }

    // Update the profile using COALESCE pattern
    let profile = sqlx::query_as!(
        CompanyProfile,
        r#"
        UPDATE company_profiles
        SET company_name = COALESCE($2, company_name),
            legal_name = COALESCE($3, legal_name),
            tax_id = COALESCE($4, tax_id),
            industry_id = COALESCE($5, industry_id),
            company_size = COALESCE($6, company_size),
            founded_year = COALESCE($7, founded_year),
            region_id = COALESCE($8, region_id),
            municipality_id = COALESCE($9, municipality_id),
            address = COALESCE($10, address),
            phone = COALESCE($11, phone),
            website_url = COALESCE($12, website_url),
            linkedin_url = COALESCE($13, linkedin_url),
            video_url = COALESCE($14, video_url),
            logo_url = COALESCE($15, logo_url),
            cover_image_url = COALESCE($16, cover_image_url),
            description = COALESCE($17, description),
            mission = COALESCE($18, mission),
            vision = COALESCE($19, vision),
            culture = COALESCE($20, culture),
            benefits = COALESCE($21, benefits),
            updated_at = NOW()
        WHERE id = $1
        RETURNING id, company_name, legal_name, tax_id,
                  industry_id, company_size, founded_year,
                  region_id, municipality_id, address, phone,
                  website_url, linkedin_url, video_url,
                  logo_url, cover_image_url,
                  description, mission, vision, culture, benefits,
                  status as "status: crate::models::company::OrganizationStatus",
                  approved_at, approved_by, rejection_reason,
                  is_featured, can_search_candidates,
                  completeness_percentage, created_at, updated_at
        "#,
        company_id,
        payload.company_name,
        payload.legal_name,
        payload.tax_id,
        payload.industry_id,
        payload.company_size,
        payload.founded_year,
        payload.region_id,
        payload.municipality_id,
        payload.address,
        payload.phone,
        payload.website_url,
        payload.linkedin_url,
        payload.video_url,
        payload.logo_url,
        payload.cover_image_url,
        payload.description,
        payload.mission,
        payload.vision,
        payload.culture,
        payload.benefits,
    )
    .fetch_one(&state.db)
    .await?;

    Ok(Json(profile))
}

/// GET /api/me/company/full
/// Get full company profile with members list and current user role
pub async fn get_full_company_profile(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<FullCompanyProfileResponse>> {
    if auth_user.user_type != "company_member" {
        return Err(AppError::ForbiddenError(
            "Only company members can access this endpoint".to_string(),
        ));
    }

    let (company_id, current_user_role) =
        get_user_company_membership(&state.db, auth_user.id).await?;

    // Get company profile
    let profile = sqlx::query_as!(
        CompanyProfile,
        r#"
        SELECT id, company_name, legal_name, tax_id,
               industry_id, company_size, founded_year,
               region_id, municipality_id, address, phone,
               website_url, linkedin_url, video_url,
               logo_url, cover_image_url,
               description, mission, vision, culture, benefits,
               status as "status: crate::models::company::OrganizationStatus",
               approved_at, approved_by, rejection_reason,
               is_featured, can_search_candidates,
               completeness_percentage, created_at, updated_at
        FROM company_profiles
        WHERE id = $1
        "#,
        company_id,
    )
    .fetch_one(&state.db)
    .await?;

    // Get all company members with user details
    let members_data = sqlx::query!(
        r#"
        SELECT cm.id, cm.company_id, cm.role as "role: crate::models::company::MemberRole",
               cm.job_title, cm.is_active, cm.joined_at,
               u.id as user_id, u.email, u.first_name, u.last_name,
               u.user_type as "user_type: crate::models::user::UserType",
               u.account_status as "account_status: crate::models::user::AccountStatus",
               u.email_verified_at, u.created_at
        FROM company_members cm
        JOIN users u ON cm.user_id = u.id
        WHERE cm.company_id = $1
        ORDER BY CASE cm.role
            WHEN 'owner' THEN 1
            WHEN 'admin' THEN 2
            WHEN 'member' THEN 3
        END, cm.joined_at
        "#,
        company_id,
    )
    .fetch_all(&state.db)
    .await?;

    // Transform into CompanyMemberWithUser structs
    let members = members_data
        .into_iter()
        .map(|row| CompanyMemberWithUser {
            id: row.id,
            company_id: row.company_id,
            role: row.role,
            job_title: row.job_title,
            is_active: row.is_active,
            joined_at: row.joined_at,
            user: UserResponse {
                id: row.user_id,
                email: row.email,
                first_name: row.first_name,
                last_name: row.last_name,
                user_type: row.user_type,
                account_status: row.account_status,
                email_verified: row.email_verified_at.is_some(),
                created_at: row.created_at,
            },
        })
        .collect();

    Ok(Json(FullCompanyProfileResponse {
        profile,
        members,
        current_user_role,
    }))
}

/// GET /api/me/company/members
/// List all company members
pub async fn list_members(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<Vec<CompanyMemberWithUser>>> {
    if auth_user.user_type != "company_member" {
        return Err(AppError::ForbiddenError(
            "Only company members can access this endpoint".to_string(),
        ));
    }

    let (company_id, _) = get_user_company_membership(&state.db, auth_user.id).await?;

    // Get all company members with user details
    let members_data = sqlx::query!(
        r#"
        SELECT cm.id, cm.company_id, cm.role as "role: crate::models::company::MemberRole",
               cm.job_title, cm.is_active, cm.joined_at,
               u.id as user_id, u.email, u.first_name, u.last_name,
               u.user_type as "user_type: crate::models::user::UserType",
               u.account_status as "account_status: crate::models::user::AccountStatus",
               u.email_verified_at, u.created_at
        FROM company_members cm
        JOIN users u ON cm.user_id = u.id
        WHERE cm.company_id = $1
        ORDER BY CASE cm.role
            WHEN 'owner' THEN 1
            WHEN 'admin' THEN 2
            WHEN 'member' THEN 3
        END, cm.joined_at
        "#,
        company_id,
    )
    .fetch_all(&state.db)
    .await?;

    // Transform into CompanyMemberWithUser structs
    let members = members_data
        .into_iter()
        .map(|row| CompanyMemberWithUser {
            id: row.id,
            company_id: row.company_id,
            role: row.role,
            job_title: row.job_title,
            is_active: row.is_active,
            joined_at: row.joined_at,
            user: UserResponse {
                id: row.user_id,
                email: row.email,
                first_name: row.first_name,
                last_name: row.last_name,
                user_type: row.user_type,
                account_status: row.account_status,
                email_verified: row.email_verified_at.is_some(),
                created_at: row.created_at,
            },
        })
        .collect();

    Ok(Json(members))
}

/// PUT /api/me/company/members/{id}
/// Update a company member (owner/admin only)
pub async fn update_member(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(member_id): Path<Uuid>,
    Json(payload): Json<UpdateMemberRequest>,
) -> Result<Json<CompanyMember>> {
    payload.validate()?;

    if auth_user.user_type != "company_member" {
        return Err(AppError::ForbiddenError(
            "Only company members can access this endpoint".to_string(),
        ));
    }

    let (company_id, role) = get_user_company_membership(&state.db, auth_user.id).await?;

    // Only owner or admin can update members
    if !is_owner_or_admin(role) {
        return Err(AppError::ForbiddenError(
            "Only company owners or admins can update members".to_string(),
        ));
    }

    // Get the target member
    let target_member = sqlx::query!(
        r#"
        SELECT company_id, user_id, role as "role: crate::models::company::MemberRole"
        FROM company_members
        WHERE id = $1
        "#,
        member_id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Member not found".to_string()))?;

    // Verify same company
    if target_member.company_id != company_id {
        return Err(AppError::ForbiddenError(
            "Cannot modify members from other companies".to_string(),
        ));
    }

    // Cannot modify yourself
    if target_member.user_id == auth_user.id {
        return Err(AppError::ValidationError(
            "Cannot modify your own membership".to_string(),
        ));
    }

    // Cannot demote or modify owner
    if target_member.role == MemberRole::Owner {
        return Err(AppError::ForbiddenError(
            "Cannot modify the company owner".to_string(),
        ));
    }

    // Update the member
    let updated_member = sqlx::query_as!(
        CompanyMember,
        r#"
        UPDATE company_members
        SET role = COALESCE($2, role),
            job_title = COALESCE($3, job_title),
            is_active = COALESCE($4, is_active),
            updated_at = NOW()
        WHERE id = $1
        RETURNING id, company_id, user_id,
                  role as "role: crate::models::company::MemberRole",
                  job_title, is_active,
                  invited_by, invited_at, joined_at,
                  created_at, updated_at
        "#,
        member_id,
        payload.role as Option<MemberRole>,
        payload.job_title,
        payload.is_active,
    )
    .fetch_one(&state.db)
    .await?;

    Ok(Json(updated_member))
}

/// DELETE /api/me/company/members/{id}
/// Remove a company member (owner/admin only)
pub async fn remove_member(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(member_id): Path<Uuid>,
) -> Result<Json<MessageResponse>> {
    if auth_user.user_type != "company_member" {
        return Err(AppError::ForbiddenError(
            "Only company members can access this endpoint".to_string(),
        ));
    }

    let (company_id, role) = get_user_company_membership(&state.db, auth_user.id).await?;

    // Only owner or admin can remove members
    if !is_owner_or_admin(role) {
        return Err(AppError::ForbiddenError(
            "Only company owners or admins can remove members".to_string(),
        ));
    }

    // Get the target member
    let target_member = sqlx::query!(
        r#"
        SELECT company_id, user_id, role as "role: crate::models::company::MemberRole"
        FROM company_members
        WHERE id = $1
        "#,
        member_id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Member not found".to_string()))?;

    // Verify same company
    if target_member.company_id != company_id {
        return Err(AppError::ForbiddenError(
            "Cannot remove members from other companies".to_string(),
        ));
    }

    // Cannot remove yourself
    if target_member.user_id == auth_user.id {
        return Err(AppError::ValidationError(
            "Cannot remove yourself from the company".to_string(),
        ));
    }

    // Cannot remove owner
    if target_member.role == MemberRole::Owner {
        return Err(AppError::ForbiddenError(
            "Cannot remove the company owner".to_string(),
        ));
    }

    // Delete the member
    sqlx::query!(
        "DELETE FROM company_members WHERE id = $1",
        member_id
    )
    .execute(&state.db)
    .await?;

    Ok(Json(MessageResponse::new("Member removed successfully")))
}

// ============================================================================
// PUBLIC COMPANY ENDPOINTS
// ============================================================================

/// GET /api/companies
/// List active companies (public)
pub async fn list_public_companies(
    State(state): State<AppState>,
) -> Result<Json<Vec<PublicCompanyProfile>>> {
    // Get active companies only
    let companies = sqlx::query_as!(
        CompanyProfile,
        r#"
        SELECT id, company_name, legal_name, tax_id,
               industry_id, company_size, founded_year,
               region_id, municipality_id, address, phone,
               website_url, linkedin_url, video_url,
               logo_url, cover_image_url,
               description, mission, vision, culture, benefits,
               status as "status: crate::models::company::OrganizationStatus",
               approved_at, approved_by, rejection_reason,
               is_featured, can_search_candidates,
               completeness_percentage, created_at, updated_at
        FROM company_profiles
        WHERE status = 'active'
        ORDER BY is_featured DESC, company_name ASC
        LIMIT 100
        "#,
    )
    .fetch_all(&state.db)
    .await?;

    // Convert to public profiles
    let public_profiles = companies
        .into_iter()
        .map(PublicCompanyProfile::from)
        .collect();

    Ok(Json(public_profiles))
}

/// GET /api/companies/{id}
/// Get single company public profile
pub async fn get_public_company(
    State(state): State<AppState>,
    Path(company_id): Path<Uuid>,
) -> Result<Json<PublicCompanyProfile>> {
    // Get active company only
    let company = sqlx::query_as!(
        CompanyProfile,
        r#"
        SELECT id, company_name, legal_name, tax_id,
               industry_id, company_size, founded_year,
               region_id, municipality_id, address, phone,
               website_url, linkedin_url, video_url,
               logo_url, cover_image_url,
               description, mission, vision, culture, benefits,
               status as "status: crate::models::company::OrganizationStatus",
               approved_at, approved_by, rejection_reason,
               is_featured, can_search_candidates,
               completeness_percentage, created_at, updated_at
        FROM company_profiles
        WHERE id = $1 AND status = 'active'
        "#,
        company_id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Company not found".to_string()))?;

    Ok(Json(PublicCompanyProfile::from(company)))
}

// ============================================================================
// V12: COMPANY DASHBOARD
// ============================================================================

/// GET /api/me/company/dashboard
/// Get company performance dashboard with job metrics
pub async fn get_company_dashboard(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<CompanyDashboard>> {
    if auth_user.user_type != "company_member" {
        return Err(AppError::ForbiddenError(
            "Only company members can access this endpoint".to_string(),
        ));
    }

    let (company_id, _) = get_user_company_membership(&state.db, auth_user.id).await?;

    // Get active jobs count
    let active_jobs: i64 = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM jobs WHERE company_id = $1 AND status = 'active'",
        company_id
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(0);

    // Get total applications received across all jobs
    let total_applications: i64 = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*) FROM job_applications ja
        JOIN jobs j ON ja.job_id = j.id
        WHERE j.company_id = $1
        "#,
        company_id
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(0);

    // Get application breakdown by status
    let status_counts = sqlx::query!(
        r#"
        SELECT ja.status::TEXT AS "status!", COUNT(*) AS "count!"
        FROM job_applications ja
        JOIN jobs j ON ja.job_id = j.id
        WHERE j.company_id = $1
        GROUP BY ja.status
        "#,
        company_id
    )
    .fetch_all(&state.db)
    .await?;

    let applications_by_status: Vec<ApplicationStatusCount> = status_counts
        .into_iter()
        .map(|row| ApplicationStatusCount {
            status: row.status,
            count: row.count,
        })
        .collect();

    // Get applications trend for last 30 days
    let applications_trend = sqlx::query!(
        r#"
        SELECT DATE(ja.applied_at) AS "date!", COUNT(*) AS "count!"
        FROM job_applications ja
        JOIN jobs j ON ja.job_id = j.id
        WHERE j.company_id = $1 AND ja.applied_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(ja.applied_at)
        ORDER BY DATE(ja.applied_at) ASC
        "#,
        company_id
    )
    .fetch_all(&state.db)
    .await?;

    let trend: Vec<TrendDataPoint> = applications_trend
        .into_iter()
        .map(|row| TrendDataPoint {
            date: row.date.to_string(),
            count: row.count,
        })
        .collect();

    // Get top performing jobs (by application count)
    let top_jobs = sqlx::query!(
        r#"
        SELECT j.id, j.title, j.status::TEXT AS "status!", COUNT(ja.id) AS "applications_count!"
        FROM jobs j
        LEFT JOIN job_applications ja ON ja.job_id = j.id
        WHERE j.company_id = $1 AND j.status = 'active'
        GROUP BY j.id, j.title, j.status
        ORDER BY COUNT(ja.id) DESC
        LIMIT 5
        "#,
        company_id
    )
    .fetch_all(&state.db)
    .await?;

    let top_jobs_list: Vec<TopJobPerformance> = top_jobs
        .into_iter()
        .map(|row| TopJobPerformance {
            job_id: row.id,
            title: row.title,
            applications_count: row.applications_count,
            status: row.status,
        })
        .collect();

    Ok(Json(CompanyDashboard {
        active_jobs,
        total_applications,
        applications_by_status,
        trend,
        top_jobs: top_jobs_list,
    }))
}
