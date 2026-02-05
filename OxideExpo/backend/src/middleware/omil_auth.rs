use axum::{
    extract::{Request, State},
    http::StatusCode,
    middleware::Next,
    response::Response,
};
use uuid::Uuid;

use crate::middleware::auth::AuthUser;
use crate::models::company::OrganizationStatus;
use crate::models::omil::{OmilMember, OmilOrganization, OmilRole};
use crate::AppState;

/// OMIL member context available to handlers after middleware validation
#[derive(Clone, Debug)]
pub struct OmilContext {
    pub member: OmilMember,
    pub organization: OmilOrganization,
}

/// Middleware that requires the authenticated user to be an OMIL member (any role)
/// Verifies the OMIL organization is active.
/// Must be used after require_auth middleware.
pub async fn require_omil(
    State(state): State<AppState>,
    mut request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    // Extract AuthUser from request extensions (set by require_auth)
    let auth_user = request
        .extensions()
        .get::<AuthUser>()
        .cloned()
        .ok_or_else(|| {
            tracing::error!("require_omil called without require_auth");
            StatusCode::UNAUTHORIZED
        })?;

    // Query OMIL membership with organization details
    let context = fetch_omil_context(&state, auth_user.id).await?;

    // Verify organization is active
    if context.organization.status != OrganizationStatus::Active {
        tracing::debug!(
            "OMIL organization {} is not active (status: {:?})",
            context.organization.id,
            context.organization.status
        );
        return Err(StatusCode::FORBIDDEN);
    }

    // Verify member is active
    if !context.member.is_active {
        tracing::debug!(
            "OMIL member {} is not active",
            context.member.id
        );
        return Err(StatusCode::FORBIDDEN);
    }

    // Insert OmilContext into request extensions for handlers to access
    request.extensions_mut().insert(context);

    Ok(next.run(request).await)
}

/// Middleware that requires the authenticated user to be an OMIL coordinator or director
/// Must be used after require_auth middleware.
pub async fn require_omil_coordinator_or_above(
    State(state): State<AppState>,
    mut request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    // Extract AuthUser from request extensions
    let auth_user = request
        .extensions()
        .get::<AuthUser>()
        .cloned()
        .ok_or_else(|| {
            tracing::error!("require_omil_coordinator_or_above called without require_auth");
            StatusCode::UNAUTHORIZED
        })?;

    // Query OMIL membership with organization details
    let context = fetch_omil_context(&state, auth_user.id).await?;

    // Verify organization is active
    if context.organization.status != OrganizationStatus::Active {
        tracing::debug!(
            "OMIL organization {} is not active (status: {:?})",
            context.organization.id,
            context.organization.status
        );
        return Err(StatusCode::FORBIDDEN);
    }

    // Verify member is active
    if !context.member.is_active {
        tracing::debug!("OMIL member {} is not active", context.member.id);
        return Err(StatusCode::FORBIDDEN);
    }

    // Check role (must be coordinator or director)
    if context.member.role != OmilRole::Coordinator && context.member.role != OmilRole::Director {
        tracing::debug!(
            "User {} has insufficient OMIL permissions (role: {:?})",
            auth_user.id,
            context.member.role
        );
        return Err(StatusCode::FORBIDDEN);
    }

    // Insert OmilContext into request extensions
    request.extensions_mut().insert(context);

    Ok(next.run(request).await)
}

/// Middleware that requires the authenticated user to be an OMIL director
/// Must be used after require_auth middleware.
pub async fn require_omil_director(
    State(state): State<AppState>,
    mut request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    // Extract AuthUser from request extensions
    let auth_user = request
        .extensions()
        .get::<AuthUser>()
        .cloned()
        .ok_or_else(|| {
            tracing::error!("require_omil_director called without require_auth");
            StatusCode::UNAUTHORIZED
        })?;

    // Query OMIL membership with organization details
    let context = fetch_omil_context(&state, auth_user.id).await?;

    // Verify organization is active
    if context.organization.status != OrganizationStatus::Active {
        tracing::debug!(
            "OMIL organization {} is not active (status: {:?})",
            context.organization.id,
            context.organization.status
        );
        return Err(StatusCode::FORBIDDEN);
    }

    // Verify member is active
    if !context.member.is_active {
        tracing::debug!("OMIL member {} is not active", context.member.id);
        return Err(StatusCode::FORBIDDEN);
    }

    // Check role (must be director)
    if context.member.role != OmilRole::Director {
        tracing::debug!(
            "User {} is not an OMIL director (role: {:?})",
            auth_user.id,
            context.member.role
        );
        return Err(StatusCode::FORBIDDEN);
    }

    // Insert OmilContext into request extensions
    request.extensions_mut().insert(context);

    Ok(next.run(request).await)
}

/// Helper function to fetch OMIL member context from database
async fn fetch_omil_context(state: &AppState, user_id: Uuid) -> Result<OmilContext, StatusCode> {
    // Query OMIL member and organization in one query using JOIN
    let row = sqlx::query!(
        r#"
        SELECT
            m.id as member_id,
            m.omil_id,
            m.user_id,
            m.role as "role: OmilRole",
            m.is_active as member_is_active,
            m.joined_at,
            m.left_at,
            m.created_at as member_created_at,
            m.updated_at as member_updated_at,
            o.id as org_id,
            o.organization_name,
            o.municipality_id,
            o.region_id,
            o.address,
            o.phone,
            o.email,
            o.website_url,
            o.status as "status: OrganizationStatus",
            o.approved_at,
            o.approved_by,
            o.created_at as org_created_at,
            o.updated_at as org_updated_at
        FROM omil_members m
        JOIN omil_organizations o ON o.id = m.omil_id
        WHERE m.user_id = $1
        "#,
        user_id
    )
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error fetching OMIL context: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .ok_or_else(|| {
        tracing::debug!("User {} is not an OMIL member", user_id);
        StatusCode::FORBIDDEN
    })?;

    let member = OmilMember {
        id: row.member_id,
        omil_id: row.omil_id,
        user_id: row.user_id,
        role: row.role,
        is_active: row.member_is_active,
        joined_at: row.joined_at,
        left_at: row.left_at,
        created_at: row.member_created_at,
        updated_at: row.member_updated_at,
    };

    let organization = OmilOrganization {
        id: row.org_id,
        organization_name: row.organization_name,
        municipality_id: row.municipality_id,
        region_id: row.region_id,
        address: row.address,
        phone: row.phone,
        email: row.email,
        website_url: row.website_url,
        status: row.status,
        approved_at: row.approved_at,
        approved_by: row.approved_by,
        created_at: row.org_created_at,
        updated_at: row.org_updated_at,
    };

    Ok(OmilContext { member, organization })
}
