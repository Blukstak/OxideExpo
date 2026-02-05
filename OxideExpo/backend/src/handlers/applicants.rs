use axum::{
    extract::{Path, Query, State},
    http::header,
    response::IntoResponse,
    Extension, Json,
};
use rust_xlsxwriter::{Workbook, Format};
use uuid::Uuid;
use validator::Validate;

use crate::{
    error::{AppError, Result},
    middleware::AuthUser,
    models::{
        applicant::*,
        application::ApplicationStatus,
        company::MemberRole,
        profile::JobSeekerProfile,
    },
    AppState,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async fn get_user_company_membership(
    db: &sqlx::PgPool,
    user_id: Uuid,
) -> Result<(Uuid, MemberRole)> {
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

async fn verify_job_belongs_to_company(
    db: &sqlx::PgPool,
    job_id: Uuid,
    company_id: Uuid,
) -> Result<()> {
    let exists = sqlx::query_scalar!(
        r#"SELECT EXISTS(SELECT 1 FROM jobs WHERE id = $1 AND company_id = $2)"#,
        job_id,
        company_id,
    )
    .fetch_one(db)
    .await?;

    if !exists.unwrap_or(false) {
        return Err(AppError::NotFound("Job not found".to_string()));
    }
    Ok(())
}

fn is_owner_or_admin(role: MemberRole) -> bool {
    matches!(role, MemberRole::Owner | MemberRole::Admin)
}

// ============================================================================
// ENDPOINTS
// ============================================================================

/// GET /api/me/jobs/{id}/applicants
/// List applicants with filtering, sorting, and pagination
pub async fn list_applicants(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(job_id): Path<Uuid>,
    Query(query): Query<ApplicantFilterQuery>,
) -> Result<Json<PaginatedApplicants>> {
    if auth_user.user_type != "company_member" {
        return Err(AppError::ForbiddenError(
            "Only company members can access this endpoint".to_string(),
        ));
    }

    let (company_id, _) = get_user_company_membership(&state.db, auth_user.id).await?;
    verify_job_belongs_to_company(&state.db, job_id, company_id).await?;

    let limit = query.limit.unwrap_or(20).min(100);
    let offset = query.offset.unwrap_or(0);

    // Get total count
    let total: i64 = sqlx::query_scalar!(
        r#"SELECT COUNT(*) as "count!" FROM job_applications WHERE job_id = $1"#,
        job_id,
    )
    .fetch_one(&state.db)
    .await?;

    // Get paginated results
    let rows = sqlx::query!(
        r#"
        SELECT
            ja.id as application_id,
            ja.applicant_id,
            ja.status as "status: ApplicationStatus",
            ja.applied_at,
            CONCAT(u.first_name, ' ', u.last_name) as "applicant_name!",
            u.email as applicant_email,
            (ja.resume_url IS NOT NULL OR jsp.cv_file_id IS NOT NULL) as "has_cv!"
        FROM job_applications ja
        JOIN users u ON u.id = ja.applicant_id
        LEFT JOIN job_seeker_profiles jsp ON jsp.user_id = ja.applicant_id
        WHERE ja.job_id = $1
        ORDER BY ja.applied_at DESC
        LIMIT $2 OFFSET $3
        "#,
        job_id,
        limit,
        offset,
    )
    .fetch_all(&state.db)
    .await?;

    let applicants: Vec<ApplicantListItem> = rows
        .into_iter()
        .map(|row| ApplicantListItem {
            application_id: row.application_id,
            applicant_id: row.applicant_id,
            status: row.status,
            applied_at: row.applied_at,
            applicant_name: row.applicant_name,
            applicant_email: row.applicant_email,
            match_score: None,
            has_cv: row.has_cv,
        })
        .collect();

    Ok(Json(PaginatedApplicants {
        applicants,
        total,
        limit,
        offset,
    }))
}

/// GET /api/me/jobs/{job_id}/applicants/{app_id}/detail
/// Get full applicant detail with profile and status history
pub async fn get_applicant_detail(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path((job_id, app_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<ApplicantDetailResponse>> {
    if auth_user.user_type != "company_member" {
        return Err(AppError::ForbiddenError(
            "Only company members can access this endpoint".to_string(),
        ));
    }

    let (company_id, _) = get_user_company_membership(&state.db, auth_user.id).await?;
    verify_job_belongs_to_company(&state.db, job_id, company_id).await?;

    // Get application
    let app = sqlx::query!(
        r#"
        SELECT
            ja.id, ja.job_id, ja.applicant_id,
            ja.status as "status: ApplicationStatus",
            ja.cover_letter, ja.resume_url, ja.applied_at,
            ja.reviewed_at, ja.interview_date, ja.interview_notes,
            ja.offer_date, ja.offer_details
        FROM job_applications ja
        WHERE ja.id = $1 AND ja.job_id = $2
        "#,
        app_id,
        job_id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Application not found".to_string()))?;

    // Get profile
    let profile = sqlx::query_as!(
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
        app.applicant_id,
    )
    .fetch_optional(&state.db)
    .await?;

    // Get status history
    let history_rows = sqlx::query!(
        r#"
        SELECT
            ash.id, ash.application_id, ash.previous_status as "previous_status: ApplicationStatus",
            ash.new_status as "new_status: ApplicationStatus",
            ash.changed_by, ash.notes, ash.created_at,
            CONCAT(u.first_name, ' ', u.last_name) as "changed_by_name!",
            u.email as "changed_by_email!"
        FROM application_status_history ash
        JOIN users u ON u.id = ash.changed_by
        WHERE ash.application_id = $1
        ORDER BY ash.created_at DESC
        "#,
        app_id,
    )
    .fetch_all(&state.db)
    .await?;

    let status_history: Vec<StatusHistoryWithUser> = history_rows
        .into_iter()
        .map(|row| StatusHistoryWithUser {
            history: ApplicationStatusHistory {
                id: row.id,
                application_id: row.application_id,
                previous_status: row.previous_status,
                new_status: row.new_status,
                changed_by: row.changed_by,
                notes: row.notes,
                created_at: row.created_at,
            },
            changed_by_name: row.changed_by_name,
            changed_by_email: row.changed_by_email,
        })
        .collect();

    // Get CV URL if exists
    let cv_url = sqlx::query_scalar!(
        r#"
        SELECT uf.storage_path
        FROM job_seeker_profiles jsp
        JOIN uploaded_files uf ON uf.id = jsp.cv_file_id
        WHERE jsp.user_id = $1
        "#,
        app.applicant_id,
    )
    .fetch_optional(&state.db)
    .await?
    .map(|path| format!("/api/files/download/{}", path));

    Ok(Json(ApplicantDetailResponse {
        application_id: app.id,
        job_id: app.job_id,
        applicant_id: app.applicant_id,
        status: app.status,
        cover_letter: app.cover_letter,
        resume_url: app.resume_url,
        applied_at: app.applied_at,
        reviewed_at: app.reviewed_at,
        interview_date: app.interview_date,
        interview_notes: app.interview_notes,
        offer_date: app.offer_date,
        offer_details: app.offer_details,
        profile,
        match_score: None,
        cv_url,
        status_history,
    }))
}

/// GET /api/me/jobs/{job_id}/applicants/{app_id}/cv
/// Get CV download URL for applicant
pub async fn get_applicant_cv(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path((job_id, app_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<CvDownloadResponse>> {
    if auth_user.user_type != "company_member" {
        return Err(AppError::ForbiddenError(
            "Only company members can access this endpoint".to_string(),
        ));
    }

    let (company_id, _) = get_user_company_membership(&state.db, auth_user.id).await?;
    verify_job_belongs_to_company(&state.db, job_id, company_id).await?;

    // Get applicant_id from application
    let applicant_id = sqlx::query_scalar!(
        r#"SELECT applicant_id FROM job_applications WHERE id = $1 AND job_id = $2"#,
        app_id,
        job_id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Application not found".to_string()))?;

    // Get CV file info
    let cv = sqlx::query!(
        r#"
        SELECT uf.storage_path, uf.original_filename, uf.content_type
        FROM job_seeker_profiles jsp
        JOIN uploaded_files uf ON uf.id = jsp.cv_file_id
        WHERE jsp.user_id = $1
        "#,
        applicant_id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("CV not found for this applicant".to_string()))?;

    Ok(Json(CvDownloadResponse {
        download_url: format!("/api/files/download/{}", cv.storage_path),
        filename: cv.original_filename,
        content_type: cv.content_type.unwrap_or_else(|| "application/pdf".to_string()),
    }))
}

/// GET /api/me/jobs/{job_id}/applicants/{app_id}/history
/// Get application status change history
pub async fn get_applicant_history(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path((job_id, app_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<Vec<StatusHistoryWithUser>>> {
    if auth_user.user_type != "company_member" {
        return Err(AppError::ForbiddenError(
            "Only company members can access this endpoint".to_string(),
        ));
    }

    let (company_id, _) = get_user_company_membership(&state.db, auth_user.id).await?;
    verify_job_belongs_to_company(&state.db, job_id, company_id).await?;

    // Verify application belongs to job
    let app_exists = sqlx::query_scalar!(
        r#"SELECT EXISTS(SELECT 1 FROM job_applications WHERE id = $1 AND job_id = $2)"#,
        app_id,
        job_id,
    )
    .fetch_one(&state.db)
    .await?;

    if !app_exists.unwrap_or(false) {
        return Err(AppError::NotFound("Application not found".to_string()));
    }

    let history_rows = sqlx::query!(
        r#"
        SELECT
            ash.id, ash.application_id, ash.previous_status as "previous_status: ApplicationStatus",
            ash.new_status as "new_status: ApplicationStatus",
            ash.changed_by, ash.notes, ash.created_at,
            CONCAT(u.first_name, ' ', u.last_name) as "changed_by_name!",
            u.email as "changed_by_email!"
        FROM application_status_history ash
        JOIN users u ON u.id = ash.changed_by
        WHERE ash.application_id = $1
        ORDER BY ash.created_at DESC
        "#,
        app_id,
    )
    .fetch_all(&state.db)
    .await?;

    let history: Vec<StatusHistoryWithUser> = history_rows
        .into_iter()
        .map(|row| StatusHistoryWithUser {
            history: ApplicationStatusHistory {
                id: row.id,
                application_id: row.application_id,
                previous_status: row.previous_status,
                new_status: row.new_status,
                changed_by: row.changed_by,
                notes: row.notes,
                created_at: row.created_at,
            },
            changed_by_name: row.changed_by_name,
            changed_by_email: row.changed_by_email,
        })
        .collect();

    Ok(Json(history))
}

/// POST /api/me/jobs/{id}/applicants/bulk-status
/// Update status of multiple applications at once
pub async fn bulk_status_update(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(job_id): Path<Uuid>,
    Json(payload): Json<BulkStatusUpdateRequest>,
) -> Result<Json<BulkStatusUpdateResponse>> {
    if auth_user.user_type != "company_member" {
        return Err(AppError::ForbiddenError(
            "Only company members can access this endpoint".to_string(),
        ));
    }

    payload.validate()?;

    let (company_id, role) = get_user_company_membership(&state.db, auth_user.id).await?;

    if !is_owner_or_admin(role) {
        return Err(AppError::ForbiddenError(
            "Only owners and admins can perform bulk updates".to_string(),
        ));
    }

    verify_job_belongs_to_company(&state.db, job_id, company_id).await?;

    let mut updated_count = 0;
    let mut failed_ids = Vec::new();

    for app_id in &payload.application_ids {
        let result = sqlx::query!(
            r#"
            UPDATE job_applications
            SET status = $1, reviewed_by = $2, reviewed_at = NOW()
            WHERE id = $3 AND job_id = $4
            "#,
            payload.status as ApplicationStatus,
            auth_user.id,
            app_id,
            job_id,
        )
        .execute(&state.db)
        .await;

        match result {
            Ok(res) if res.rows_affected() > 0 => {
                updated_count += 1;
            }
            _ => {
                failed_ids.push(*app_id);
            }
        }
    }

    Ok(Json(BulkStatusUpdateResponse {
        updated_count,
        failed_ids,
    }))
}

/// GET /api/me/jobs/{id}/applicants/export
/// Export applicants to Excel (XLSX)
pub async fn export_applicants(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(job_id): Path<Uuid>,
    Query(query): Query<ExportApplicantsQuery>,
) -> Result<impl IntoResponse> {
    if auth_user.user_type != "company_member" {
        return Err(AppError::ForbiddenError(
            "Only company members can access this endpoint".to_string(),
        ));
    }

    let (company_id, _) = get_user_company_membership(&state.db, auth_user.id).await?;
    verify_job_belongs_to_company(&state.db, job_id, company_id).await?;

    // Get job title for filename
    let job_title = sqlx::query_scalar!(
        r#"SELECT title FROM jobs WHERE id = $1"#,
        job_id,
    )
    .fetch_one(&state.db)
    .await?;

    // Get applicants
    let applicants = sqlx::query!(
        r#"
        SELECT
            ja.id, ja.status as "status: ApplicationStatus",
            ja.applied_at, ja.cover_letter,
            u.first_name, u.last_name, u.email,
            jsp.phone, jsp.professional_headline
        FROM job_applications ja
        JOIN users u ON u.id = ja.applicant_id
        LEFT JOIN job_seeker_profiles jsp ON jsp.user_id = ja.applicant_id
        WHERE ja.job_id = $1
        ORDER BY ja.applied_at DESC
        "#,
        job_id,
    )
    .fetch_all(&state.db)
    .await?;

    // Create Excel workbook
    let mut workbook = Workbook::new();
    let worksheet = workbook.add_worksheet();

    // Header format
    let header_format = Format::new().set_bold();

    // Helper to map XlsxError to AppError
    let xlsx_err = |e: rust_xlsxwriter::XlsxError| AppError::InternalError(format!("Excel error: {}", e));

    // Write headers
    let include_contact = query.include_contact.unwrap_or(true);
    let mut col = 0u16;
    worksheet.write_string_with_format(0, col, "Name", &header_format).map_err(xlsx_err)?;
    col += 1;
    if include_contact {
        worksheet.write_string_with_format(0, col, "Email", &header_format).map_err(xlsx_err)?;
        col += 1;
        worksheet.write_string_with_format(0, col, "Phone", &header_format).map_err(xlsx_err)?;
        col += 1;
    }
    worksheet.write_string_with_format(0, col, "Status", &header_format).map_err(xlsx_err)?;
    col += 1;
    worksheet.write_string_with_format(0, col, "Applied At", &header_format).map_err(xlsx_err)?;
    col += 1;
    worksheet.write_string_with_format(0, col, "Headline", &header_format).map_err(xlsx_err)?;

    // Write data rows
    for (row_idx, app) in applicants.iter().enumerate() {
        let row = (row_idx + 1) as u32;
        let mut col = 0u16;

        let name = format!("{} {}", &app.first_name, &app.last_name);
        worksheet.write_string(row, col, &name).map_err(xlsx_err)?;
        col += 1;

        if include_contact {
            worksheet.write_string(row, col, &app.email).map_err(xlsx_err)?;
            col += 1;
            worksheet.write_string(row, col, app.phone.as_deref().unwrap_or("")).map_err(xlsx_err)?;
            col += 1;
        }

        let status_str = format!("{:?}", app.status);
        worksheet.write_string(row, col, &status_str).map_err(xlsx_err)?;
        col += 1;

        worksheet.write_string(row, col, &app.applied_at.format("%Y-%m-%d %H:%M").to_string()).map_err(xlsx_err)?;
        col += 1;

        worksheet.write_string(row, col, app.professional_headline.as_deref().unwrap_or("")).map_err(xlsx_err)?;
    }

    // Generate Excel file
    let buffer = workbook.save_to_buffer()
        .map_err(|e| AppError::InternalError(format!("Failed to generate Excel: {}", e)))?;

    // Sanitize filename
    let safe_title: String = job_title
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == ' ' || *c == '-' || *c == '_')
        .take(50)
        .collect();
    let filename = format!("applicants-{}.xlsx", safe_title);
    let content_disposition = format!("attachment; filename=\"{}\"", filename);

    Ok((
        [
            (header::CONTENT_TYPE, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet".to_string()),
            (header::CONTENT_DISPOSITION, content_disposition),
        ],
        buffer,
    ))
}
