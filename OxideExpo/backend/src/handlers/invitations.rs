use axum::{
    extract::{Path, Query, State},
    Extension, Json,
};
use chrono::{Duration, Utc};
use uuid::Uuid;
use validator::Validate;

use crate::error::AppError;
use crate::middleware::auth::AuthUser;
use crate::models::company::MemberRole;
use crate::models::job::{JobType, PublicJobListing, WorkModality};
use crate::models::omil::{
    InvitationStatus, InvitationsQuery, JobInvitation, JobInvitationWithDetails,
    RespondToInvitationRequest, SendJobInvitationRequest,
};
use crate::AppState;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/// Get the user's company membership
async fn get_user_company_membership(
    db: &sqlx::PgPool,
    user_id: Uuid,
) -> Result<(Uuid, MemberRole), AppError> {
    let member = sqlx::query!(
        r#"
        SELECT company_id, role as "role: MemberRole"
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

// ============================================================================
// COMPANY ENDPOINTS - SEND INVITATIONS
// ============================================================================

/// POST /api/me/jobs/{job_id}/invitations
/// Send job invitation to a job seeker (company members only)
pub async fn send_job_invitation(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(job_id): Path<Uuid>,
    Json(payload): Json<SendJobInvitationRequest>,
) -> Result<Json<JobInvitation>, AppError> {
    payload.validate()?;

    // Verify user is company member
    if auth_user.user_type != "company_member" {
        return Err(AppError::ForbiddenError(
            "Only company members can send invitations".to_string(),
        ));
    }

    let (company_id, _role) = get_user_company_membership(&state.db, auth_user.id).await?;

    // Verify job belongs to this company and is active
    let job = sqlx::query!(
        "SELECT company_id, status::text as status FROM jobs WHERE id = $1",
        job_id
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Job not found".to_string()))?;

    if job.company_id != company_id {
        return Err(AppError::ForbiddenError(
            "Job does not belong to your company".to_string(),
        ));
    }

    if job.status.as_deref() != Some("active") {
        return Err(AppError::ValidationError(
            "Can only invite to active jobs".to_string(),
        ));
    }

    // Verify job seeker exists and is a job_seeker type
    let job_seeker = sqlx::query!(
        "SELECT id, user_type::text as user_type FROM users WHERE id = $1",
        payload.job_seeker_id
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Job seeker not found".to_string()))?;

    if job_seeker.user_type.as_deref() != Some("job_seeker") {
        return Err(AppError::ValidationError(
            "Can only invite job seekers".to_string(),
        ));
    }

    // Check if invitation already exists
    let existing = sqlx::query_scalar!(
        "SELECT id FROM job_invitations WHERE job_id = $1 AND job_seeker_id = $2",
        job_id,
        payload.job_seeker_id
    )
    .fetch_optional(&state.db)
    .await?;

    if existing.is_some() {
        return Err(AppError::ValidationError(
            "Invitation already sent to this job seeker for this job".to_string(),
        ));
    }

    // Calculate expiration date
    let expires_in_days = payload.expires_in_days.unwrap_or(30);
    let expires_at = Utc::now() + Duration::days(expires_in_days as i64);

    // Create invitation
    let invitation = sqlx::query_as!(
        JobInvitation,
        r#"
        INSERT INTO job_invitations (job_id, job_seeker_id, invited_by, company_id, message, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING
            id,
            job_id,
            job_seeker_id,
            invited_by,
            company_id,
            message,
            status as "status: InvitationStatus",
            viewed_at,
            responded_at,
            expires_at,
            created_at,
            updated_at
        "#,
        job_id,
        payload.job_seeker_id,
        auth_user.id,
        company_id,
        payload.message,
        expires_at
    )
    .fetch_one(&state.db)
    .await?;

    Ok(Json(invitation))
}

/// GET /api/me/jobs/{job_id}/invitations
/// List invitations sent for a specific job
pub async fn list_job_invitations(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(job_id): Path<Uuid>,
    Query(query): Query<InvitationsQuery>,
) -> Result<Json<Vec<JobInvitation>>, AppError> {
    // Verify user is company member
    if auth_user.user_type != "company_member" {
        return Err(AppError::ForbiddenError(
            "Only company members can view invitations".to_string(),
        ));
    }

    let (company_id, _role) = get_user_company_membership(&state.db, auth_user.id).await?;

    // Verify job belongs to this company
    let job = sqlx::query!("SELECT company_id FROM jobs WHERE id = $1", job_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound("Job not found".to_string()))?;

    if job.company_id != company_id {
        return Err(AppError::ForbiddenError(
            "Job does not belong to your company".to_string(),
        ));
    }

    let limit = query.limit.unwrap_or(50).min(100);
    let offset = query.offset.unwrap_or(0);

    let invitations = sqlx::query_as!(
        JobInvitation,
        r#"
        SELECT
            id,
            job_id,
            job_seeker_id,
            invited_by,
            company_id,
            message,
            status as "status: InvitationStatus",
            viewed_at,
            responded_at,
            expires_at,
            created_at,
            updated_at
        FROM job_invitations
        WHERE job_id = $1
        AND ($2::invitation_status IS NULL OR status = $2)
        ORDER BY created_at DESC
        LIMIT $3 OFFSET $4
        "#,
        job_id,
        query.status as Option<InvitationStatus>,
        limit,
        offset
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(invitations))
}

// ============================================================================
// JOB SEEKER ENDPOINTS - RECEIVE INVITATIONS
// ============================================================================

/// GET /api/me/invitations
/// List invitations received by the job seeker
pub async fn list_my_invitations(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Query(query): Query<InvitationsQuery>,
) -> Result<Json<Vec<JobInvitationWithDetails>>, AppError> {
    // Verify user is job seeker
    if auth_user.user_type != "job_seeker" {
        return Err(AppError::ForbiddenError(
            "Only job seekers can view their invitations".to_string(),
        ));
    }

    let limit = query.limit.unwrap_or(50).min(100);
    let offset = query.offset.unwrap_or(0);

    let invitations = sqlx::query!(
        r#"
        SELECT
            i.id,
            i.job_id,
            i.job_seeker_id,
            i.invited_by,
            i.company_id,
            i.message,
            i.status as "status: InvitationStatus",
            i.viewed_at,
            i.responded_at,
            i.expires_at,
            i.created_at,
            i.updated_at,
            -- Job details (matching PublicJobListing struct)
            j.title as job_title,
            j.description as job_description,
            j.responsibilities as job_responsibilities,
            j.job_type as "job_type: JobType",
            j.industry_id as job_industry_id,
            j.work_area_id as job_work_area_id,
            j.position_level_id as job_position_level_id,
            j.work_modality as "work_modality: WorkModality",
            j.work_schedule as job_work_schedule,
            j.region_id as job_region_id,
            j.municipality_id as job_municipality_id,
            j.is_remote_allowed as job_is_remote_allowed,
            j.education_level as job_education_level,
            j.years_experience_min as job_years_experience_min,
            j.years_experience_max as job_years_experience_max,
            j.benefits as job_benefits,
            j.application_deadline as job_application_deadline,
            j.contact_email as job_contact_email,
            j.application_url as job_application_url,
            j.vacancies as job_vacancies,
            j.is_featured as job_is_featured,
            j.created_at as job_created_at,
            -- Company info
            c.company_name,
            c.logo_url as company_logo_url
        FROM job_invitations i
        JOIN jobs j ON j.id = i.job_id
        JOIN company_profiles c ON c.id = i.company_id
        WHERE i.job_seeker_id = $1
        AND ($2::invitation_status IS NULL OR i.status = $2)
        ORDER BY i.created_at DESC
        LIMIT $3 OFFSET $4
        "#,
        auth_user.id,
        query.status as Option<InvitationStatus>,
        limit,
        offset
    )
    .fetch_all(&state.db)
    .await?;

    let result: Vec<JobInvitationWithDetails> = invitations
        .into_iter()
        .map(|row| {
            let invitation = JobInvitation {
                id: row.id,
                job_id: row.job_id,
                job_seeker_id: row.job_seeker_id,
                invited_by: row.invited_by,
                company_id: row.company_id,
                message: row.message,
                status: row.status,
                viewed_at: row.viewed_at,
                responded_at: row.responded_at,
                expires_at: row.expires_at,
                created_at: row.created_at,
                updated_at: row.updated_at,
            };

            let job = PublicJobListing {
                id: row.job_id,
                company_name: row.company_name.clone(),
                company_logo_url: row.company_logo_url.clone(),
                title: row.job_title,
                description: row.job_description,
                responsibilities: row.job_responsibilities,
                job_type: row.job_type,
                industry_id: row.job_industry_id,
                work_area_id: row.job_work_area_id,
                position_level_id: row.job_position_level_id,
                work_modality: row.work_modality,
                work_schedule: row.job_work_schedule,
                region_id: row.job_region_id,
                municipality_id: row.job_municipality_id,
                is_remote_allowed: row.job_is_remote_allowed.unwrap_or(false),
                education_level: row.job_education_level,
                years_experience_min: row.job_years_experience_min,
                years_experience_max: row.job_years_experience_max,
                benefits: row.job_benefits,
                application_deadline: row.job_application_deadline,
                contact_email: row.job_contact_email,
                application_url: row.job_application_url,
                vacancies: row.job_vacancies,
                is_featured: row.job_is_featured.unwrap_or(false),
                created_at: row.job_created_at,
            };

            JobInvitationWithDetails {
                invitation,
                job,
                company_name: row.company_name,
            }
        })
        .collect();

    Ok(Json(result))
}

/// GET /api/me/invitations/{id}
/// Get invitation details and mark as viewed
pub async fn get_invitation(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(invitation_id): Path<Uuid>,
) -> Result<Json<JobInvitationWithDetails>, AppError> {
    // Verify user is job seeker
    if auth_user.user_type != "job_seeker" {
        return Err(AppError::ForbiddenError(
            "Only job seekers can view their invitations".to_string(),
        ));
    }

    let row = sqlx::query!(
        r#"
        SELECT
            i.id,
            i.job_id,
            i.job_seeker_id,
            i.invited_by,
            i.company_id,
            i.message,
            i.status as "status: InvitationStatus",
            i.viewed_at,
            i.responded_at,
            i.expires_at,
            i.created_at,
            i.updated_at,
            -- Job details (matching PublicJobListing struct)
            j.title as job_title,
            j.description as job_description,
            j.responsibilities as job_responsibilities,
            j.job_type as "job_type: JobType",
            j.industry_id as job_industry_id,
            j.work_area_id as job_work_area_id,
            j.position_level_id as job_position_level_id,
            j.work_modality as "work_modality: WorkModality",
            j.work_schedule as job_work_schedule,
            j.region_id as job_region_id,
            j.municipality_id as job_municipality_id,
            j.is_remote_allowed as job_is_remote_allowed,
            j.education_level as job_education_level,
            j.years_experience_min as job_years_experience_min,
            j.years_experience_max as job_years_experience_max,
            j.benefits as job_benefits,
            j.application_deadline as job_application_deadline,
            j.contact_email as job_contact_email,
            j.application_url as job_application_url,
            j.vacancies as job_vacancies,
            j.is_featured as job_is_featured,
            j.created_at as job_created_at,
            -- Company info
            c.company_name,
            c.logo_url as company_logo_url
        FROM job_invitations i
        JOIN jobs j ON j.id = i.job_id
        JOIN company_profiles c ON c.id = i.company_id
        WHERE i.id = $1 AND i.job_seeker_id = $2
        "#,
        invitation_id,
        auth_user.id
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Invitation not found".to_string()))?;

    // Mark as viewed if pending
    if row.status == InvitationStatus::Pending {
        sqlx::query!(
            "UPDATE job_invitations SET status = 'viewed', viewed_at = NOW() WHERE id = $1",
            invitation_id
        )
        .execute(&state.db)
        .await?;
    }

    let invitation = JobInvitation {
        id: row.id,
        job_id: row.job_id,
        job_seeker_id: row.job_seeker_id,
        invited_by: row.invited_by,
        company_id: row.company_id,
        message: row.message,
        status: if row.status == InvitationStatus::Pending {
            InvitationStatus::Viewed
        } else {
            row.status
        },
        viewed_at: row.viewed_at.or(Some(Utc::now())),
        responded_at: row.responded_at,
        expires_at: row.expires_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };

    let job = PublicJobListing {
        id: row.job_id,
        company_name: row.company_name.clone(),
        company_logo_url: row.company_logo_url.clone(),
        title: row.job_title,
        description: row.job_description,
        responsibilities: row.job_responsibilities,
        job_type: row.job_type,
        industry_id: row.job_industry_id,
        work_area_id: row.job_work_area_id,
        position_level_id: row.job_position_level_id,
        work_modality: row.work_modality,
        work_schedule: row.job_work_schedule,
        region_id: row.job_region_id,
        municipality_id: row.job_municipality_id,
        is_remote_allowed: row.job_is_remote_allowed.unwrap_or(false),
        education_level: row.job_education_level,
        years_experience_min: row.job_years_experience_min,
        years_experience_max: row.job_years_experience_max,
        benefits: row.job_benefits,
        application_deadline: row.job_application_deadline,
        contact_email: row.job_contact_email,
        application_url: row.job_application_url,
        vacancies: row.job_vacancies,
        is_featured: row.job_is_featured.unwrap_or(false),
        created_at: row.job_created_at,
    };

    Ok(Json(JobInvitationWithDetails {
        invitation,
        job,
        company_name: row.company_name,
    }))
}

/// POST /api/me/invitations/{id}/respond
/// Respond to an invitation (accept/decline)
pub async fn respond_to_invitation(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(invitation_id): Path<Uuid>,
    Json(payload): Json<RespondToInvitationRequest>,
) -> Result<Json<JobInvitation>, AppError> {
    // Verify user is job seeker
    if auth_user.user_type != "job_seeker" {
        return Err(AppError::ForbiddenError(
            "Only job seekers can respond to invitations".to_string(),
        ));
    }

    // Get invitation
    let existing = sqlx::query!(
        r#"
        SELECT
            id,
            job_id,
            status as "status: InvitationStatus",
            expires_at
        FROM job_invitations
        WHERE id = $1 AND job_seeker_id = $2
        "#,
        invitation_id,
        auth_user.id
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Invitation not found".to_string()))?;

    // Check if already responded
    if existing.status == InvitationStatus::Applied || existing.status == InvitationStatus::Declined
    {
        return Err(AppError::ValidationError(
            "Already responded to this invitation".to_string(),
        ));
    }

    // Check if expired
    if existing.expires_at < Utc::now() {
        return Err(AppError::ValidationError(
            "This invitation has expired".to_string(),
        ));
    }

    let new_status = if payload.accept {
        InvitationStatus::Applied
    } else {
        InvitationStatus::Declined
    };

    // If accepting, create application
    if payload.accept {
        // Check if already applied
        let already_applied = sqlx::query_scalar!(
            "SELECT id FROM job_applications WHERE job_id = $1 AND applicant_id = $2",
            existing.job_id,
            auth_user.id
        )
        .fetch_optional(&state.db)
        .await?;

        if already_applied.is_some() {
            return Err(AppError::ValidationError(
                "Already applied to this job".to_string(),
            ));
        }

        // Create application
        sqlx::query!(
            r#"
            INSERT INTO job_applications (job_id, applicant_id, cover_letter, status)
            VALUES ($1, $2, $3, 'submitted')
            "#,
            existing.job_id,
            auth_user.id,
            payload.cover_letter
        )
        .execute(&state.db)
        .await?;
    }

    // Update invitation
    let invitation = sqlx::query_as!(
        JobInvitation,
        r#"
        UPDATE job_invitations
        SET
            status = $1,
            responded_at = NOW(),
            updated_at = NOW()
        WHERE id = $2
        RETURNING
            id,
            job_id,
            job_seeker_id,
            invited_by,
            company_id,
            message,
            status as "status: InvitationStatus",
            viewed_at,
            responded_at,
            expires_at,
            created_at,
            updated_at
        "#,
        new_status as InvitationStatus,
        invitation_id
    )
    .fetch_one(&state.db)
    .await?;

    Ok(Json(invitation))
}
