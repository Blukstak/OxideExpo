use axum::{
    body::Body,
    extract::{Path, Query, State},
    http::header,
    response::Response,
    Extension, Json,
};
use chrono::Utc;
use rust_xlsxwriter::{Format, Workbook};
use uuid::Uuid;
use validator::Validate;

use crate::error::AppError;
use crate::middleware::omil_auth::OmilContext;
use crate::models::application::ApplicationStatus;
use crate::models::company::OrganizationStatus;
use crate::models::omil::{
    AddOmilMemberRequest, ApplyOnBehalfRequest, CreateFollowupRequest,
    ExportManagedSeekersQuery, FollowupType, FollowupWithCreator, FollowupsQuery,
    ImpersonationResponse, JobSeekerFollowup, ManagedJobSeekerDetail, ManagedJobSeekerSummary,
    ManagedJobSeekersQuery, OmilApplicationWithDetails, OmilApplicationsQuery,
    OmilApplicationsResponse, OmilDashboardStats, OmilManagedJobSeeker, OmilMember,
    OmilMemberWithUser, OmilOrganization, OmilOrganizationWithMembers, OmilRole, PlacementOutcome,
    RegisterJobSeekerOnBehalfRequest, UpdateFollowupRequest, UpdateOmilMemberRequest,
    UpdateOmilOrganizationRequest, UpdatePlacementRequest,
};
use crate::models::profile::{Gender, JobSeekerProfile, MaritalStatus};
use crate::utils::jwt::create_impersonation_token;
use crate::AppState;

// ============================================================================
// OMIL ORGANIZATION MANAGEMENT
// ============================================================================

/// GET /api/me/omil
/// Get current user's OMIL organization with members
pub async fn get_omil_organization(
    State(state): State<AppState>,
    Extension(omil_ctx): Extension<OmilContext>,
) -> Result<Json<OmilOrganizationWithMembers>, AppError> {
    // Fetch members with user info
    let members = sqlx::query!(
        r#"
        SELECT
            m.id,
            m.omil_id,
            m.user_id,
            m.role as "role: OmilRole",
            m.is_active,
            m.joined_at,
            m.left_at,
            m.created_at,
            m.updated_at,
            (u.first_name || ' ' || u.last_name) as "user_name!",
            u.email as "user_email!"
        FROM omil_members m
        JOIN users u ON u.id = m.user_id
        WHERE m.omil_id = $1
        ORDER BY m.role ASC, m.joined_at ASC
        "#,
        omil_ctx.organization.id
    )
    .fetch_all(&state.db)
    .await?;

    let members_with_users: Vec<OmilMemberWithUser> = members
        .into_iter()
        .map(|row| OmilMemberWithUser {
            member: OmilMember {
                id: row.id,
                omil_id: row.omil_id,
                user_id: row.user_id,
                role: row.role,
                is_active: row.is_active,
                joined_at: row.joined_at,
                left_at: row.left_at,
                created_at: row.created_at,
                updated_at: row.updated_at,
            },
            user_name: row.user_name,
            user_email: row.user_email,
        })
        .collect();

    Ok(Json(OmilOrganizationWithMembers {
        organization: omil_ctx.organization,
        members: members_with_users,
    }))
}

/// PUT /api/me/omil
/// Update OMIL organization details (director only - enforced by route middleware)
pub async fn update_omil_organization(
    State(state): State<AppState>,
    Extension(omil_ctx): Extension<OmilContext>,
    Json(payload): Json<UpdateOmilOrganizationRequest>,
) -> Result<Json<OmilOrganization>, AppError> {
    payload.validate()?;

    let organization = sqlx::query_as!(
        OmilOrganization,
        r#"
        UPDATE omil_organizations
        SET
            organization_name = COALESCE($1, organization_name),
            municipality_id = COALESCE($2, municipality_id),
            region_id = COALESCE($3, region_id),
            address = COALESCE($4, address),
            phone = COALESCE($5, phone),
            email = COALESCE($6, email),
            website_url = COALESCE($7, website_url),
            updated_at = NOW()
        WHERE id = $8
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
        payload.organization_name,
        payload.municipality_id,
        payload.region_id,
        payload.address,
        payload.phone,
        payload.email,
        payload.website_url,
        omil_ctx.organization.id
    )
    .fetch_one(&state.db)
    .await?;

    Ok(Json(organization))
}

/// GET /api/me/omil/stats
/// Get OMIL dashboard statistics
pub async fn get_omil_stats(
    State(state): State<AppState>,
    Extension(omil_ctx): Extension<OmilContext>,
) -> Result<Json<OmilDashboardStats>, AppError> {
    let omil_id = omil_ctx.organization.id;

    // Total managed seekers
    let total_managed_seekers: i64 = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM omil_managed_job_seekers WHERE omil_id = $1",
        omil_id
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(0);

    // Active seekers
    let active_seekers: i64 = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM omil_managed_job_seekers WHERE omil_id = $1 AND is_active = true",
        omil_id
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(0);

    // Placed this month
    let placed_this_month: i64 = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*) FROM omil_managed_job_seekers
        WHERE omil_id = $1
        AND placement_outcome = 'placed'
        AND placed_at >= DATE_TRUNC('month', CURRENT_DATE)
        "#,
        omil_id
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(0);

    // Placed this year
    let placed_this_year: i64 = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*) FROM omil_managed_job_seekers
        WHERE omil_id = $1
        AND placement_outcome = 'placed'
        AND placed_at >= DATE_TRUNC('year', CURRENT_DATE)
        "#,
        omil_id
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(0);

    // Pending placements
    let pending_placements: i64 = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM omil_managed_job_seekers WHERE omil_id = $1 AND placement_outcome = 'pending'",
        omil_id
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(0);

    // New registrations this month
    let new_registrations_this_month: i64 = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*) FROM omil_managed_job_seekers
        WHERE omil_id = $1
        AND registered_at >= DATE_TRUNC('month', CURRENT_DATE)
        "#,
        omil_id
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(0);

    // Total applications submitted by OMIL
    let total_applications_submitted: i64 = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM omil_applications WHERE omil_id = $1",
        omil_id
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(0);

    Ok(Json(OmilDashboardStats {
        total_managed_seekers,
        active_seekers,
        placed_this_month,
        placed_this_year,
        pending_placements,
        new_registrations_this_month,
        total_applications_submitted,
    }))
}

// ============================================================================
// OMIL MEMBER MANAGEMENT
// ============================================================================

/// GET /api/me/omil/members
/// List OMIL members
pub async fn list_omil_members(
    State(state): State<AppState>,
    Extension(omil_ctx): Extension<OmilContext>,
) -> Result<Json<Vec<OmilMemberWithUser>>, AppError> {
    let members = sqlx::query!(
        r#"
        SELECT
            m.id,
            m.omil_id,
            m.user_id,
            m.role as "role: OmilRole",
            m.is_active,
            m.joined_at,
            m.left_at,
            m.created_at,
            m.updated_at,
            (u.first_name || ' ' || u.last_name) as "user_name!",
            u.email as "user_email!"
        FROM omil_members m
        JOIN users u ON u.id = m.user_id
        WHERE m.omil_id = $1
        ORDER BY m.role ASC, m.joined_at ASC
        "#,
        omil_ctx.organization.id
    )
    .fetch_all(&state.db)
    .await?;

    let members_with_users: Vec<OmilMemberWithUser> = members
        .into_iter()
        .map(|row| OmilMemberWithUser {
            member: OmilMember {
                id: row.id,
                omil_id: row.omil_id,
                user_id: row.user_id,
                role: row.role,
                is_active: row.is_active,
                joined_at: row.joined_at,
                left_at: row.left_at,
                created_at: row.created_at,
                updated_at: row.updated_at,
            },
            user_name: row.user_name,
            user_email: row.user_email,
        })
        .collect();

    Ok(Json(members_with_users))
}

/// POST /api/me/omil/members
/// Add new OMIL member (coordinator+ only)
pub async fn add_omil_member(
    State(state): State<AppState>,
    Extension(omil_ctx): Extension<OmilContext>,
    Json(payload): Json<AddOmilMemberRequest>,
) -> Result<Json<OmilMemberWithUser>, AppError> {
    payload.validate()?;

    // Find user by email
    let user = sqlx::query!(
        "SELECT id, first_name, last_name, email FROM users WHERE email = $1",
        payload.email
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("User not found with this email".to_string()))?;

    // Check if already a member
    let existing = sqlx::query_scalar!(
        "SELECT id FROM omil_members WHERE omil_id = $1 AND user_id = $2",
        omil_ctx.organization.id,
        user.id
    )
    .fetch_optional(&state.db)
    .await?;

    if existing.is_some() {
        return Err(AppError::ValidationError(
            "User is already a member of this OMIL".to_string(),
        ));
    }

    // Only directors can add coordinators/directors
    if (payload.role == OmilRole::Coordinator || payload.role == OmilRole::Director)
        && omil_ctx.member.role != OmilRole::Director
    {
        return Err(AppError::ForbiddenError(
            "Only directors can add coordinators or directors".to_string(),
        ));
    }

    // Insert new member
    let member = sqlx::query_as!(
        OmilMember,
        r#"
        INSERT INTO omil_members (omil_id, user_id, role)
        VALUES ($1, $2, $3)
        RETURNING
            id,
            omil_id,
            user_id,
            role as "role: OmilRole",
            is_active,
            joined_at,
            left_at,
            created_at,
            updated_at
        "#,
        omil_ctx.organization.id,
        user.id,
        payload.role as OmilRole
    )
    .fetch_one(&state.db)
    .await?;

    let user_name = format!("{} {}", user.first_name, user.last_name);

    Ok(Json(OmilMemberWithUser {
        member,
        user_name,
        user_email: user.email,
    }))
}

/// PUT /api/me/omil/members/{id}
/// Update OMIL member (coordinator+ only)
pub async fn update_omil_member(
    State(state): State<AppState>,
    Extension(omil_ctx): Extension<OmilContext>,
    Path(member_id): Path<Uuid>,
    Json(payload): Json<UpdateOmilMemberRequest>,
) -> Result<Json<OmilMember>, AppError> {
    // Verify member belongs to this OMIL
    let existing = sqlx::query!(
        r#"SELECT id, role as "role: OmilRole" FROM omil_members WHERE id = $1 AND omil_id = $2"#,
        member_id,
        omil_ctx.organization.id
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Member not found".to_string()))?;

    // Only directors can change roles to/from coordinator/director
    if let Some(new_role) = &payload.role {
        let role_change_requires_director =
            (*new_role == OmilRole::Coordinator || *new_role == OmilRole::Director)
                || (existing.role == OmilRole::Coordinator || existing.role == OmilRole::Director);

        if role_change_requires_director && omil_ctx.member.role != OmilRole::Director {
            return Err(AppError::ForbiddenError(
                "Only directors can change coordinator/director roles".to_string(),
            ));
        }
    }

    let member = sqlx::query_as!(
        OmilMember,
        r#"
        UPDATE omil_members
        SET
            role = COALESCE($1, role),
            is_active = COALESCE($2, is_active),
            left_at = CASE WHEN $2 = false THEN NOW() ELSE left_at END,
            updated_at = NOW()
        WHERE id = $3
        RETURNING
            id,
            omil_id,
            user_id,
            role as "role: OmilRole",
            is_active,
            joined_at,
            left_at,
            created_at,
            updated_at
        "#,
        payload.role as Option<OmilRole>,
        payload.is_active,
        member_id
    )
    .fetch_one(&state.db)
    .await?;

    Ok(Json(member))
}

/// DELETE /api/me/omil/members/{id}
/// Remove OMIL member (director only - enforced by route middleware)
pub async fn remove_omil_member(
    State(state): State<AppState>,
    Extension(omil_ctx): Extension<OmilContext>,
    Path(member_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Cannot remove self
    if member_id == omil_ctx.member.id {
        return Err(AppError::ValidationError(
            "Cannot remove yourself from the organization".to_string(),
        ));
    }

    // Verify member belongs to this OMIL
    let deleted = sqlx::query!(
        "DELETE FROM omil_members WHERE id = $1 AND omil_id = $2 RETURNING id",
        member_id,
        omil_ctx.organization.id
    )
    .fetch_optional(&state.db)
    .await?;

    if deleted.is_none() {
        return Err(AppError::NotFound("Member not found".to_string()));
    }

    Ok(Json(serde_json::json!({ "message": "Member removed successfully" })))
}

// ============================================================================
// MANAGED JOB SEEKERS
// ============================================================================

/// GET /api/me/omil/job-seekers
/// List managed job seekers
pub async fn list_managed_job_seekers(
    State(state): State<AppState>,
    Extension(omil_ctx): Extension<OmilContext>,
    Query(query): Query<ManagedJobSeekersQuery>,
) -> Result<Json<Vec<ManagedJobSeekerSummary>>, AppError> {
    let limit = query.limit.unwrap_or(50).min(100);
    let offset = query.offset.unwrap_or(0);

    let seekers = sqlx::query!(
        r#"
        SELECT
            mjs.id,
            mjs.job_seeker_id,
            (u.first_name || ' ' || u.last_name) as "user_name!",
            u.email as "user_email!",
            mjs.placement_outcome as "placement_outcome: PlacementOutcome",
            (SELECT (first_name || ' ' || last_name) FROM users WHERE id = mjs.assigned_advisor_id) as assigned_advisor_name,
            (SELECT COUNT(*) FROM job_seeker_followups f WHERE f.job_seeker_id = mjs.job_seeker_id AND f.omil_id = mjs.omil_id) as "followups_count!",
            (SELECT COUNT(*) FROM job_applications ja WHERE ja.applicant_id = mjs.job_seeker_id) as "applications_count!",
            mjs.registered_at,
            COALESCE(p.completeness_percentage, 0) as "profile_completeness!"
        FROM omil_managed_job_seekers mjs
        JOIN users u ON u.id = mjs.job_seeker_id
        LEFT JOIN job_seeker_profiles p ON p.user_id = mjs.job_seeker_id
        WHERE mjs.omil_id = $1
        AND ($2::placement_outcome IS NULL OR mjs.placement_outcome = $2)
        AND ($3::boolean IS NULL OR $3 = false OR mjs.assigned_advisor_id = $4)
        AND (
            $5::text IS NULL
            OR u.first_name ILIKE '%' || $5 || '%'
            OR u.last_name ILIKE '%' || $5 || '%'
            OR u.email ILIKE '%' || $5 || '%'
        )
        AND mjs.is_active = true
        ORDER BY mjs.registered_at DESC
        LIMIT $6 OFFSET $7
        "#,
        omil_ctx.organization.id,
        query.placement_outcome as Option<PlacementOutcome>,
        query.assigned_to_me,
        omil_ctx.member.user_id,
        query.search,
        limit,
        offset
    )
    .fetch_all(&state.db)
    .await?;

    let summaries: Vec<ManagedJobSeekerSummary> = seekers
        .into_iter()
        .map(|row| ManagedJobSeekerSummary {
            id: row.id,
            job_seeker_id: row.job_seeker_id,
            user_name: row.user_name,
            user_email: row.user_email,
            placement_outcome: row.placement_outcome,
            assigned_advisor_name: row.assigned_advisor_name,
            followups_count: row.followups_count,
            applications_count: row.applications_count,
            registered_at: row.registered_at,
            profile_completeness: row.profile_completeness,
        })
        .collect();

    Ok(Json(summaries))
}

/// POST /api/me/omil/job-seekers
/// Register job seeker on behalf (any OMIL member)
pub async fn register_job_seeker_on_behalf(
    State(state): State<AppState>,
    Extension(omil_ctx): Extension<OmilContext>,
    Json(payload): Json<RegisterJobSeekerOnBehalfRequest>,
) -> Result<Json<OmilManagedJobSeeker>, AppError> {
    payload.validate()?;

    // Check if user already exists
    let existing_user = sqlx::query!(
        "SELECT id FROM users WHERE email = $1",
        payload.email
    )
    .fetch_optional(&state.db)
    .await?;

    let job_seeker_id = if let Some(user) = existing_user {
        // Check if already managed by this OMIL
        let already_managed = sqlx::query_scalar!(
            "SELECT id FROM omil_managed_job_seekers WHERE omil_id = $1 AND job_seeker_id = $2",
            omil_ctx.organization.id,
            user.id
        )
        .fetch_optional(&state.db)
        .await?;

        if already_managed.is_some() {
            return Err(AppError::ValidationError(
                "Job seeker is already managed by this OMIL".to_string(),
            ));
        }

        user.id
    } else {
        // Create new user with job_seeker type (phone is stored in profile, not user)
        let new_user = sqlx::query!(
            r#"
            INSERT INTO users (email, first_name, last_name, user_type, password_hash)
            VALUES ($1, $2, $3, 'job_seeker', '')
            RETURNING id
            "#,
            payload.email,
            payload.first_name,
            payload.last_name
        )
        .fetch_one(&state.db)
        .await?;

        // Create profile for the job seeker with phone if provided
        sqlx::query!(
            "INSERT INTO job_seeker_profiles (user_id, phone) VALUES ($1, $2)",
            new_user.id,
            payload.phone
        )
        .execute(&state.db)
        .await?;

        new_user.id
    };

    // Determine assigned advisor
    let assigned_advisor_id = if payload.assign_to_self.unwrap_or(false) {
        Some(omil_ctx.member.user_id)
    } else {
        None
    };

    // Create managed job seeker record
    let managed = sqlx::query_as!(
        OmilManagedJobSeeker,
        r#"
        INSERT INTO omil_managed_job_seekers (omil_id, job_seeker_id, registered_by, assigned_advisor_id, notes)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING
            id,
            omil_id,
            job_seeker_id,
            assigned_advisor_id,
            registered_by,
            placement_outcome as "placement_outcome: PlacementOutcome",
            placed_at,
            placed_job_id,
            is_active,
            notes,
            registered_at,
            updated_at
        "#,
        omil_ctx.organization.id,
        job_seeker_id,
        omil_ctx.member.user_id,
        assigned_advisor_id,
        payload.notes
    )
    .fetch_one(&state.db)
    .await?;

    // Create initial registration followup
    sqlx::query!(
        r#"
        INSERT INTO job_seeker_followups (job_seeker_id, created_by, omil_id, followup_type, title, content)
        VALUES ($1, $2, $3, 'initial_registration', 'Registro inicial', $4)
        "#,
        job_seeker_id,
        omil_ctx.member.user_id,
        omil_ctx.organization.id,
        format!("Usuario registrado en OMIL por {}", omil_ctx.organization.organization_name)
    )
    .execute(&state.db)
    .await?;

    Ok(Json(managed))
}

/// GET /api/me/omil/job-seekers/{id}
/// Get managed job seeker detail
pub async fn get_managed_job_seeker(
    State(state): State<AppState>,
    Extension(omil_ctx): Extension<OmilContext>,
    Path(managed_id): Path<Uuid>,
) -> Result<Json<ManagedJobSeekerDetail>, AppError> {
    // Fetch the managed record
    let managed = sqlx::query_as!(
        OmilManagedJobSeeker,
        r#"
        SELECT
            id,
            omil_id,
            job_seeker_id,
            assigned_advisor_id,
            registered_by,
            placement_outcome as "placement_outcome: PlacementOutcome",
            placed_at,
            placed_job_id,
            is_active,
            notes,
            registered_at,
            updated_at
        FROM omil_managed_job_seekers
        WHERE id = $1 AND omil_id = $2
        "#,
        managed_id,
        omil_ctx.organization.id
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Managed job seeker not found".to_string()))?;

    // Fetch user info
    let user = sqlx::query!(
        "SELECT first_name, last_name, email FROM users WHERE id = $1",
        managed.job_seeker_id
    )
    .fetch_one(&state.db)
    .await?;

    // Fetch profile (may not exist if user hasn't created one yet)
    let profile = sqlx::query_as!(
        JobSeekerProfile,
        r#"
        SELECT
            user_id,
            phone,
            date_of_birth,
            gender as "gender: Gender",
            marital_status as "marital_status: MaritalStatus",
            nationality,
            national_id,
            region_id,
            municipality_id,
            address,
            bio,
            professional_headline,
            profile_image_url,
            cv_url,
            completeness_percentage,
            created_at,
            updated_at
        FROM job_seeker_profiles
        WHERE user_id = $1
        "#,
        managed.job_seeker_id
    )
    .fetch_optional(&state.db)
    .await?;

    // Fetch recent followups
    let followups = sqlx::query_as!(
        JobSeekerFollowup,
        r#"
        SELECT
            id,
            job_seeker_id,
            created_by,
            omil_id,
            application_id,
            followup_type as "followup_type: FollowupType",
            title,
            content,
            is_private,
            followup_date,
            created_at,
            updated_at
        FROM job_seeker_followups
        WHERE job_seeker_id = $1 AND omil_id = $2
        ORDER BY followup_date DESC
        LIMIT 10
        "#,
        managed.job_seeker_id,
        omil_ctx.organization.id
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(ManagedJobSeekerDetail {
        managed,
        profile,
        user_name: format!("{} {}", user.first_name, user.last_name),
        user_email: user.email,
        recent_followups: followups,
    }))
}

/// PUT /api/me/omil/job-seekers/{id}/placement
/// Update placement outcome
pub async fn update_placement(
    State(state): State<AppState>,
    Extension(omil_ctx): Extension<OmilContext>,
    Path(managed_id): Path<Uuid>,
    Json(payload): Json<UpdatePlacementRequest>,
) -> Result<Json<OmilManagedJobSeeker>, AppError> {
    payload.validate()?;

    // Verify exists
    let _existing = sqlx::query!("SELECT id FROM omil_managed_job_seekers WHERE id = $1 AND omil_id = $2", managed_id, omil_ctx.organization.id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound("Managed job seeker not found".to_string()))?;

    let placed_at = if payload.outcome == PlacementOutcome::Placed {
        Some(Utc::now())
    } else {
        None
    };

    let managed = sqlx::query_as!(
        OmilManagedJobSeeker,
        r#"
        UPDATE omil_managed_job_seekers
        SET
            placement_outcome = $1,
            placed_at = $2,
            placed_job_id = $3,
            notes = COALESCE($4, notes),
            updated_at = NOW()
        WHERE id = $5
        RETURNING
            id,
            omil_id,
            job_seeker_id,
            assigned_advisor_id,
            registered_by,
            placement_outcome as "placement_outcome: PlacementOutcome",
            placed_at,
            placed_job_id,
            is_active,
            notes,
            registered_at,
            updated_at
        "#,
        payload.outcome as PlacementOutcome,
        placed_at,
        payload.job_id,
        payload.notes,
        managed_id
    )
    .fetch_one(&state.db)
    .await?;

    // Create followup for placement update
    sqlx::query!(
        r#"
        INSERT INTO job_seeker_followups (job_seeker_id, created_by, omil_id, followup_type, title, content)
        VALUES ($1, $2, $3, 'placement', 'Actualización de colocación', $4)
        "#,
        managed.job_seeker_id,
        omil_ctx.member.user_id,
        omil_ctx.organization.id,
        format!("Estado actualizado a: {:?}", payload.outcome)
    )
    .execute(&state.db)
    .await?;

    Ok(Json(managed))
}

/// PUT /api/me/omil/job-seekers/{id}/advisor
/// Assign advisor to job seeker (coordinator+ only)
pub async fn assign_advisor(
    State(state): State<AppState>,
    Extension(omil_ctx): Extension<OmilContext>,
    Path(managed_id): Path<Uuid>,
    Json(payload): Json<serde_json::Value>,
) -> Result<Json<OmilManagedJobSeeker>, AppError> {
    let advisor_id: Option<Uuid> = payload.get("advisor_id").and_then(|v| {
        v.as_str()
            .and_then(|s| Uuid::parse_str(s).ok())
    });

    // If advisor_id provided, verify they're a member of this OMIL
    if let Some(aid) = advisor_id {
        let is_member = sqlx::query_scalar!(
            "SELECT id FROM omil_members WHERE omil_id = $1 AND user_id = $2 AND is_active = true",
            omil_ctx.organization.id,
            aid
        )
        .fetch_optional(&state.db)
        .await?;

        if is_member.is_none() {
            return Err(AppError::ValidationError(
                "Advisor must be an active OMIL member".to_string(),
            ));
        }
    }

    let managed = sqlx::query_as!(
        OmilManagedJobSeeker,
        r#"
        UPDATE omil_managed_job_seekers
        SET
            assigned_advisor_id = $1,
            updated_at = NOW()
        WHERE id = $2 AND omil_id = $3
        RETURNING
            id,
            omil_id,
            job_seeker_id,
            assigned_advisor_id,
            registered_by,
            placement_outcome as "placement_outcome: PlacementOutcome",
            placed_at,
            placed_job_id,
            is_active,
            notes,
            registered_at,
            updated_at
        "#,
        advisor_id,
        managed_id,
        omil_ctx.organization.id
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Managed job seeker not found".to_string()))?;

    Ok(Json(managed))
}

/// POST /api/me/omil/job-seekers/{id}/apply
/// Apply to job on behalf of job seeker
pub async fn apply_on_behalf(
    State(state): State<AppState>,
    Extension(omil_ctx): Extension<OmilContext>,
    Path(managed_id): Path<Uuid>,
    Json(payload): Json<ApplyOnBehalfRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    payload.validate()?;

    // Get the managed job seeker
    let managed = sqlx::query!(
        "SELECT job_seeker_id FROM omil_managed_job_seekers WHERE id = $1 AND omil_id = $2",
        managed_id,
        omil_ctx.organization.id
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Managed job seeker not found".to_string()))?;

    // Verify job exists and is active
    let job = sqlx::query!(
        "SELECT id, status::text as status FROM jobs WHERE id = $1",
        payload.job_id
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Job not found".to_string()))?;

    if job.status.as_deref() != Some("active") {
        return Err(AppError::ValidationError(
            "Can only apply to active jobs".to_string(),
        ));
    }

    // Check if already applied
    let existing = sqlx::query_scalar!(
        "SELECT id FROM job_applications WHERE job_id = $1 AND applicant_id = $2",
        payload.job_id,
        managed.job_seeker_id
    )
    .fetch_optional(&state.db)
    .await?;

    if existing.is_some() {
        return Err(AppError::ValidationError(
            "Job seeker has already applied to this job".to_string(),
        ));
    }

    // Create application
    let application = sqlx::query!(
        r#"
        INSERT INTO job_applications (job_id, applicant_id, cover_letter, status)
        VALUES ($1, $2, $3, 'submitted')
        RETURNING id
        "#,
        payload.job_id,
        managed.job_seeker_id,
        payload.cover_letter
    )
    .fetch_one(&state.db)
    .await?;

    // Track in omil_applications
    sqlx::query!(
        r#"
        INSERT INTO omil_applications (application_id, omil_id, submitted_by, internal_notes)
        VALUES ($1, $2, $3, $4)
        "#,
        application.id,
        omil_ctx.organization.id,
        omil_ctx.member.user_id,
        payload.internal_notes
    )
    .execute(&state.db)
    .await?;

    // Create followup
    sqlx::query!(
        r#"
        INSERT INTO job_seeker_followups (job_seeker_id, created_by, omil_id, application_id, followup_type, title, content)
        VALUES ($1, $2, $3, $4, 'job_application', 'Postulación enviada', 'Postulación enviada en representación del usuario')
        "#,
        managed.job_seeker_id,
        omil_ctx.member.user_id,
        omil_ctx.organization.id,
        application.id
    )
    .execute(&state.db)
    .await?;

    Ok(Json(serde_json::json!({
        "message": "Application submitted successfully",
        "application_id": application.id
    })))
}

// ============================================================================
// FOLLOWUPS
// ============================================================================

/// GET /api/me/omil/job-seekers/{id}/followups
/// List followups for a job seeker
pub async fn list_followups(
    State(state): State<AppState>,
    Extension(omil_ctx): Extension<OmilContext>,
    Path(managed_id): Path<Uuid>,
    Query(query): Query<FollowupsQuery>,
) -> Result<Json<Vec<FollowupWithCreator>>, AppError> {
    // Get job_seeker_id from managed record
    let managed = sqlx::query!(
        "SELECT job_seeker_id FROM omil_managed_job_seekers WHERE id = $1 AND omil_id = $2",
        managed_id,
        omil_ctx.organization.id
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Managed job seeker not found".to_string()))?;

    let limit = query.limit.unwrap_or(50).min(100);
    let offset = query.offset.unwrap_or(0);
    let include_private = query.include_private.unwrap_or(true);

    let followups = sqlx::query!(
        r#"
        SELECT
            f.id,
            f.job_seeker_id,
            f.created_by,
            f.omil_id,
            f.application_id,
            f.followup_type as "followup_type: FollowupType",
            f.title,
            f.content,
            f.is_private,
            f.followup_date,
            f.created_at,
            f.updated_at,
            (u.first_name || ' ' || u.last_name) as "creator_name!"
        FROM job_seeker_followups f
        JOIN users u ON u.id = f.created_by
        WHERE f.job_seeker_id = $1
        AND f.omil_id = $2
        AND ($3::followup_type IS NULL OR f.followup_type = $3)
        AND ($4::boolean = true OR f.is_private = false)
        ORDER BY f.followup_date DESC
        LIMIT $5 OFFSET $6
        "#,
        managed.job_seeker_id,
        omil_ctx.organization.id,
        query.followup_type as Option<FollowupType>,
        include_private,
        limit,
        offset
    )
    .fetch_all(&state.db)
    .await?;

    let result: Vec<FollowupWithCreator> = followups
        .into_iter()
        .map(|row| FollowupWithCreator {
            followup: JobSeekerFollowup {
                id: row.id,
                job_seeker_id: row.job_seeker_id,
                created_by: row.created_by,
                omil_id: row.omil_id,
                application_id: row.application_id,
                followup_type: row.followup_type,
                title: row.title,
                content: row.content,
                is_private: row.is_private,
                followup_date: row.followup_date,
                created_at: row.created_at,
                updated_at: row.updated_at,
            },
            creator_name: row.creator_name,
        })
        .collect();

    Ok(Json(result))
}

/// POST /api/me/omil/job-seekers/{id}/followups
/// Create followup for a job seeker
pub async fn create_followup(
    State(state): State<AppState>,
    Extension(omil_ctx): Extension<OmilContext>,
    Path(managed_id): Path<Uuid>,
    Json(payload): Json<CreateFollowupRequest>,
) -> Result<Json<JobSeekerFollowup>, AppError> {
    payload.validate()?;

    // Get job_seeker_id from managed record
    let managed = sqlx::query!(
        "SELECT job_seeker_id FROM omil_managed_job_seekers WHERE id = $1 AND omil_id = $2",
        managed_id,
        omil_ctx.organization.id
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Managed job seeker not found".to_string()))?;

    let followup = sqlx::query_as!(
        JobSeekerFollowup,
        r#"
        INSERT INTO job_seeker_followups (job_seeker_id, created_by, omil_id, application_id, followup_type, title, content, is_private)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING
            id,
            job_seeker_id,
            created_by,
            omil_id,
            application_id,
            followup_type as "followup_type: FollowupType",
            title,
            content,
            is_private,
            followup_date,
            created_at,
            updated_at
        "#,
        managed.job_seeker_id,
        omil_ctx.member.user_id,
        omil_ctx.organization.id,
        payload.application_id,
        payload.followup_type as FollowupType,
        payload.title,
        payload.content,
        payload.is_private.unwrap_or(false)
    )
    .fetch_one(&state.db)
    .await?;

    Ok(Json(followup))
}

/// PUT /api/me/omil/followups/{id}
/// Update followup (only creator can update)
pub async fn update_followup(
    State(state): State<AppState>,
    Extension(omil_ctx): Extension<OmilContext>,
    Path(followup_id): Path<Uuid>,
    Json(payload): Json<UpdateFollowupRequest>,
) -> Result<Json<JobSeekerFollowup>, AppError> {
    payload.validate()?;

    // Verify followup belongs to this OMIL and user is creator
    let existing = sqlx::query!(
        "SELECT created_by FROM job_seeker_followups WHERE id = $1 AND omil_id = $2",
        followup_id,
        omil_ctx.organization.id
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Followup not found".to_string()))?;

    if existing.created_by != omil_ctx.member.user_id {
        return Err(AppError::ForbiddenError(
            "Only the creator can update this followup".to_string(),
        ));
    }

    let followup = sqlx::query_as!(
        JobSeekerFollowup,
        r#"
        UPDATE job_seeker_followups
        SET
            title = COALESCE($1, title),
            content = COALESCE($2, content),
            is_private = COALESCE($3, is_private),
            updated_at = NOW()
        WHERE id = $4
        RETURNING
            id,
            job_seeker_id,
            created_by,
            omil_id,
            application_id,
            followup_type as "followup_type: FollowupType",
            title,
            content,
            is_private,
            followup_date,
            created_at,
            updated_at
        "#,
        payload.title,
        payload.content,
        payload.is_private,
        followup_id
    )
    .fetch_one(&state.db)
    .await?;

    Ok(Json(followup))
}

/// DELETE /api/me/omil/followups/{id}
/// Delete followup (only creator or coordinator+ can delete)
pub async fn delete_followup(
    State(state): State<AppState>,
    Extension(omil_ctx): Extension<OmilContext>,
    Path(followup_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Verify followup belongs to this OMIL
    let existing = sqlx::query!(
        "SELECT created_by FROM job_seeker_followups WHERE id = $1 AND omil_id = $2",
        followup_id,
        omil_ctx.organization.id
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Followup not found".to_string()))?;

    // Only creator or coordinator+ can delete
    let can_delete = existing.created_by == omil_ctx.member.user_id
        || omil_ctx.member.role == OmilRole::Coordinator
        || omil_ctx.member.role == OmilRole::Director;

    if !can_delete {
        return Err(AppError::ForbiddenError(
            "Only the creator or coordinators can delete this followup".to_string(),
        ));
    }

    sqlx::query!("DELETE FROM job_seeker_followups WHERE id = $1", followup_id)
        .execute(&state.db)
        .await?;

    Ok(Json(serde_json::json!({ "message": "Followup deleted successfully" })))
}

// ============================================================================
// V10: IMPERSONATION, EXPORT, APPLICATIONS
// ============================================================================

/// GET /api/me/omil/job-seekers/{id}/impersonate
/// Generate an impersonation token to edit job seeker's profile
pub async fn generate_impersonation(
    State(state): State<AppState>,
    Extension(omil_ctx): Extension<OmilContext>,
    Path(managed_id): Path<Uuid>,
) -> Result<Json<ImpersonationResponse>, AppError> {
    // Get the managed job seeker
    let managed = sqlx::query!(
        r#"
        SELECT mjs.job_seeker_id, (u.first_name || ' ' || u.last_name) as "user_name!"
        FROM omil_managed_job_seekers mjs
        JOIN users u ON u.id = mjs.job_seeker_id
        WHERE mjs.id = $1 AND mjs.omil_id = $2 AND mjs.is_active = true
        "#,
        managed_id,
        omil_ctx.organization.id
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Managed job seeker not found".to_string()))?;

    // Generate impersonation token
    let (token, jti, expires_at) = create_impersonation_token(
        managed.job_seeker_id,
        omil_ctx.member.user_id,
        omil_ctx.organization.id,
        &state.config,
    )
    .map_err(|e| AppError::InternalError(format!("Failed to create token: {}", e)))?;

    // Track the impersonation session
    sqlx::query!(
        r#"
        INSERT INTO omil_impersonation_sessions (omil_member_id, job_seeker_id, token_jti, expires_at)
        VALUES ($1, $2, $3, $4)
        "#,
        omil_ctx.member.id,
        managed.job_seeker_id,
        jti,
        expires_at
    )
    .execute(&state.db)
    .await?;

    Ok(Json(ImpersonationResponse {
        impersonation_token: token,
        expires_at,
        job_seeker_id: managed.job_seeker_id,
        job_seeker_name: managed.user_name,
    }))
}

/// GET /api/me/omil/job-seekers/export
/// Export managed job seekers to Excel
pub async fn export_managed_seekers(
    State(state): State<AppState>,
    Extension(omil_ctx): Extension<OmilContext>,
    Query(query): Query<ExportManagedSeekersQuery>,
) -> Result<Response, AppError> {
    // Fetch all managed seekers with details
    let seekers = sqlx::query!(
        r#"
        SELECT
            (u.first_name || ' ' || u.last_name) as "user_name!",
            u.email as "user_email!",
            p.phone,
            mjs.placement_outcome as "placement_outcome: PlacementOutcome",
            (SELECT (first_name || ' ' || last_name) FROM users WHERE id = mjs.assigned_advisor_id) as assigned_advisor_name,
            mjs.registered_at,
            mjs.is_active
        FROM omil_managed_job_seekers mjs
        JOIN users u ON u.id = mjs.job_seeker_id
        LEFT JOIN job_seeker_profiles p ON p.user_id = mjs.job_seeker_id
        WHERE mjs.omil_id = $1
        AND ($2::placement_outcome IS NULL OR mjs.placement_outcome = $2)
        ORDER BY mjs.registered_at DESC
        "#,
        omil_ctx.organization.id,
        query.placement_outcome as Option<PlacementOutcome>,
    )
    .fetch_all(&state.db)
    .await?;

    // Create Excel workbook
    let mut workbook = Workbook::new();
    let worksheet = workbook.add_worksheet();

    // Header format
    let header_format = Format::new().set_bold();

    // Helper to map XlsxError to AppError
    let xlsx_err =
        |e: rust_xlsxwriter::XlsxError| AppError::InternalError(format!("Excel error: {}", e));

    // Write headers
    let include_contact = query.include_contact.unwrap_or(true);
    let mut col = 0u16;
    worksheet
        .write_string_with_format(0, col, "Name", &header_format)
        .map_err(xlsx_err)?;
    col += 1;
    if include_contact {
        worksheet
            .write_string_with_format(0, col, "Email", &header_format)
            .map_err(xlsx_err)?;
        col += 1;
        worksheet
            .write_string_with_format(0, col, "Phone", &header_format)
            .map_err(xlsx_err)?;
        col += 1;
    }
    worksheet
        .write_string_with_format(0, col, "Placement Status", &header_format)
        .map_err(xlsx_err)?;
    col += 1;
    worksheet
        .write_string_with_format(0, col, "Advisor", &header_format)
        .map_err(xlsx_err)?;
    col += 1;
    worksheet
        .write_string_with_format(0, col, "Registered At", &header_format)
        .map_err(xlsx_err)?;
    col += 1;
    worksheet
        .write_string_with_format(0, col, "Active", &header_format)
        .map_err(xlsx_err)?;

    // Write data rows
    for (row_idx, seeker) in seekers.iter().enumerate() {
        let row = (row_idx + 1) as u32;
        let mut col = 0u16;

        worksheet
            .write_string(row, col, &seeker.user_name)
            .map_err(xlsx_err)?;
        col += 1;

        if include_contact {
            worksheet
                .write_string(row, col, &seeker.user_email)
                .map_err(xlsx_err)?;
            col += 1;
            worksheet
                .write_string(row, col, seeker.phone.as_deref().unwrap_or(""))
                .map_err(xlsx_err)?;
            col += 1;
        }

        let placement_str = format!("{:?}", seeker.placement_outcome);
        worksheet
            .write_string(row, col, &placement_str)
            .map_err(xlsx_err)?;
        col += 1;

        worksheet
            .write_string(
                row,
                col,
                seeker.assigned_advisor_name.as_deref().unwrap_or(""),
            )
            .map_err(xlsx_err)?;
        col += 1;

        worksheet
            .write_string(
                row,
                col,
                &seeker.registered_at.format("%Y-%m-%d %H:%M").to_string(),
            )
            .map_err(xlsx_err)?;
        col += 1;

        worksheet
            .write_string(row, col, if seeker.is_active { "Yes" } else { "No" })
            .map_err(xlsx_err)?;
    }

    // Generate Excel file
    let buffer = workbook
        .save_to_buffer()
        .map_err(|e| AppError::InternalError(format!("Failed to generate Excel: {}", e)))?;

    // Sanitize filename
    let safe_name: String = omil_ctx
        .organization
        .organization_name
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == ' ' || *c == '-' || *c == '_')
        .take(30)
        .collect();
    let filename = format!("managed-seekers-{}.xlsx", safe_name);
    let content_disposition = format!("attachment; filename=\"{}\"", filename);

    let response = Response::builder()
        .header(
            header::CONTENT_TYPE,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        .header(header::CONTENT_DISPOSITION, content_disposition)
        .body(Body::from(buffer))
        .map_err(|e| AppError::InternalError(format!("Failed to build response: {}", e)))?;

    Ok(response)
}

/// GET /api/me/omil/applications
/// List all applications submitted by this OMIL
pub async fn list_omil_applications(
    State(state): State<AppState>,
    Extension(omil_ctx): Extension<OmilContext>,
    Query(query): Query<OmilApplicationsQuery>,
) -> Result<Json<OmilApplicationsResponse>, AppError> {
    let limit = query.limit.unwrap_or(20).min(100);
    let offset = query.offset.unwrap_or(0);

    // Get total count
    let total: i64 = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*)
        FROM omil_applications oa
        JOIN job_applications ja ON ja.id = oa.application_id
        WHERE oa.omil_id = $1
        AND ($2::uuid IS NULL OR ja.applicant_id = $2)
        AND ($3::application_status IS NULL OR ja.status = $3)
        "#,
        omil_ctx.organization.id,
        query.job_seeker_id,
        query.status as Option<ApplicationStatus>,
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(0);

    // Get applications with details
    let applications = sqlx::query!(
        r#"
        SELECT
            ja.id as application_id,
            ja.job_id,
            j.title as job_title,
            cp.legal_name as company_name,
            ja.applicant_id as job_seeker_id,
            (u.first_name || ' ' || u.last_name) as "job_seeker_name!",
            ja.status as "status: ApplicationStatus",
            ja.applied_at,
            oa.submitted_by
        FROM omil_applications oa
        JOIN job_applications ja ON ja.id = oa.application_id
        JOIN jobs j ON j.id = ja.job_id
        JOIN company_profiles cp ON cp.id = j.company_id
        JOIN users u ON u.id = ja.applicant_id
        WHERE oa.omil_id = $1
        AND ($2::uuid IS NULL OR ja.applicant_id = $2)
        AND ($3::application_status IS NULL OR ja.status = $3)
        ORDER BY ja.applied_at DESC
        LIMIT $4 OFFSET $5
        "#,
        omil_ctx.organization.id,
        query.job_seeker_id,
        query.status as Option<ApplicationStatus>,
        limit,
        offset,
    )
    .fetch_all(&state.db)
    .await?;

    let apps: Vec<OmilApplicationWithDetails> = applications
        .into_iter()
        .map(|row| OmilApplicationWithDetails {
            application_id: row.application_id,
            job_id: row.job_id,
            job_title: row.job_title,
            company_name: row.company_name.unwrap_or_default(),
            job_seeker_id: row.job_seeker_id,
            job_seeker_name: row.job_seeker_name,
            status: row.status,
            applied_at: row.applied_at,
            submitted_by: row.submitted_by,
        })
        .collect();

    Ok(Json(OmilApplicationsResponse {
        applications: apps,
        total,
    }))
}
