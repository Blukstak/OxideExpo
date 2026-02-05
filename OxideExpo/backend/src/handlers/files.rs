use axum::{
    body::Body,
    extract::{Multipart, Path, State},
    http::{header, StatusCode},
    response::Response,
    Extension, Json,
};
use bytes::Bytes;
use uuid::Uuid;

use crate::{
    error::{AppError, Result},
    middleware::AuthUser,
    models::{
        company::MemberRole,
        file::*,
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

fn is_owner_or_admin(role: MemberRole) -> bool {
    matches!(role, MemberRole::Owner | MemberRole::Admin)
}

async fn validate_and_extract_file(
    multipart: &mut Multipart,
    file_type: FileType,
) -> Result<(String, String, Bytes)> {
    let field = multipart
        .next_field()
        .await
        .map_err(|e| AppError::ValidationError(format!("Failed to read upload: {}", e)))?
        .ok_or_else(|| AppError::ValidationError("No file provided".to_string()))?;

    let filename = field
        .file_name()
        .map(|s| s.to_string())
        .unwrap_or_else(|| "unknown".to_string());

    let content_type = field
        .content_type()
        .map(|s| s.to_string())
        .unwrap_or_else(|| "application/octet-stream".to_string());

    // Validate content type
    let allowed_types = file_type.allowed_content_types();
    if !allowed_types.contains(&content_type.as_str()) {
        return Err(AppError::ValidationError(format!(
            "Invalid file type. Allowed types: {}",
            allowed_types.join(", ")
        )));
    }

    let data = field
        .bytes()
        .await
        .map_err(|e| AppError::ValidationError(format!("Failed to read file: {}", e)))?;

    // Validate file size
    let max_size = file_type.max_size_bytes();
    if data.len() as i64 > max_size {
        return Err(AppError::ValidationError(format!(
            "File too large. Maximum size: {} MB",
            max_size / 1024 / 1024
        )));
    }

    Ok((filename, content_type, data))
}

async fn upload_file_internal(
    state: &AppState,
    user_id: Uuid,
    file_type: FileType,
    filename: String,
    content_type: String,
    data: Bytes,
) -> Result<UploadedFile> {
    let storage = state.storage.as_ref().ok_or_else(|| {
        AppError::InternalError("Storage service not configured".to_string())
    })?;

    // Upload to storage
    let result = storage
        .upload(file_type.storage_folder(), &filename, &content_type, data.clone())
        .await?;

    // Save to database
    let file = sqlx::query_as!(
        UploadedFile,
        r#"
        INSERT INTO uploaded_files (user_id, file_type, original_filename, storage_path, content_type, file_size_bytes)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, user_id, file_type as "file_type: FileType", original_filename, storage_path, content_type, file_size_bytes, created_at
        "#,
        user_id,
        file_type as FileType,
        filename,
        result.storage_path,
        content_type,
        result.file_size,
    )
    .fetch_one(&state.db)
    .await?;

    Ok(file)
}

async fn delete_file_internal(
    state: &AppState,
    file_id: Uuid,
    user_id: Uuid,
) -> Result<()> {
    let storage = state.storage.as_ref().ok_or_else(|| {
        AppError::InternalError("Storage service not configured".to_string())
    })?;

    // Get file info
    let file = sqlx::query!(
        r#"SELECT storage_path FROM uploaded_files WHERE id = $1 AND user_id = $2"#,
        file_id,
        user_id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("File not found".to_string()))?;

    // Delete from storage
    storage.delete(&file.storage_path).await?;

    // Delete from database
    sqlx::query!(
        r#"DELETE FROM uploaded_files WHERE id = $1"#,
        file_id,
    )
    .execute(&state.db)
    .await?;

    Ok(())
}

// ============================================================================
// JOB SEEKER FILE ENDPOINTS
// ============================================================================

/// PUT /api/me/profile/cv
/// Upload CV for job seeker
pub async fn upload_cv(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    mut multipart: Multipart,
) -> Result<Json<FileUploadResponse>> {
    if auth_user.user_type != "job_seeker" {
        return Err(AppError::ForbiddenError(
            "Only job seekers can upload CVs".to_string(),
        ));
    }

    let (filename, content_type, data) = validate_and_extract_file(&mut multipart, FileType::Cv).await?;

    // Delete existing CV if any
    if let Some(existing) = sqlx::query!(
        r#"SELECT cv_file_id FROM job_seeker_profiles WHERE user_id = $1"#,
        auth_user.id,
    )
    .fetch_optional(&state.db)
    .await?
    {
        if let Some(file_id) = existing.cv_file_id {
            let _ = delete_file_internal(&state, file_id, auth_user.id).await;
        }
    }

    // Upload new file
    let file = upload_file_internal(&state, auth_user.id, FileType::Cv, filename, content_type, data).await?;

    // Update profile reference
    sqlx::query!(
        r#"UPDATE job_seeker_profiles SET cv_file_id = $1 WHERE user_id = $2"#,
        file.id,
        auth_user.id,
    )
    .execute(&state.db)
    .await?;

    let download_url = format!("/api/files/{}", file.id);

    Ok(Json(FileUploadResponse {
        file_id: file.id,
        file_type: file.file_type,
        original_filename: file.original_filename,
        file_size_bytes: file.file_size_bytes.unwrap_or(0),
        download_url,
    }))
}

/// DELETE /api/me/profile/cv
/// Delete job seeker's CV
pub async fn delete_cv(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<FileDeleteResponse>> {
    if auth_user.user_type != "job_seeker" {
        return Err(AppError::ForbiddenError(
            "Only job seekers can delete CVs".to_string(),
        ));
    }

    let profile = sqlx::query!(
        r#"SELECT cv_file_id FROM job_seeker_profiles WHERE user_id = $1"#,
        auth_user.id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Profile not found".to_string()))?;

    let file_id = profile
        .cv_file_id
        .ok_or_else(|| AppError::NotFound("No CV uploaded".to_string()))?;

    // Clear profile reference first
    sqlx::query!(
        r#"UPDATE job_seeker_profiles SET cv_file_id = NULL WHERE user_id = $1"#,
        auth_user.id,
    )
    .execute(&state.db)
    .await?;

    // Delete file
    delete_file_internal(&state, file_id, auth_user.id).await?;

    Ok(Json(FileDeleteResponse {
        message: "CV deleted successfully".to_string(),
    }))
}

/// PUT /api/me/profile/image
/// Upload profile image for job seeker
pub async fn upload_profile_image(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    mut multipart: Multipart,
) -> Result<Json<FileUploadResponse>> {
    if auth_user.user_type != "job_seeker" {
        return Err(AppError::ForbiddenError(
            "Only job seekers can upload profile images".to_string(),
        ));
    }

    let (filename, content_type, data) = validate_and_extract_file(&mut multipart, FileType::ProfileImage).await?;

    // Delete existing image if any
    if let Some(existing) = sqlx::query!(
        r#"SELECT profile_image_file_id FROM job_seeker_profiles WHERE user_id = $1"#,
        auth_user.id,
    )
    .fetch_optional(&state.db)
    .await?
    {
        if let Some(file_id) = existing.profile_image_file_id {
            let _ = delete_file_internal(&state, file_id, auth_user.id).await;
        }
    }

    // Upload new file
    let file = upload_file_internal(&state, auth_user.id, FileType::ProfileImage, filename, content_type, data).await?;

    // Update profile reference
    sqlx::query!(
        r#"UPDATE job_seeker_profiles SET profile_image_file_id = $1 WHERE user_id = $2"#,
        file.id,
        auth_user.id,
    )
    .execute(&state.db)
    .await?;

    let download_url = format!("/api/files/{}", file.id);

    Ok(Json(FileUploadResponse {
        file_id: file.id,
        file_type: file.file_type,
        original_filename: file.original_filename,
        file_size_bytes: file.file_size_bytes.unwrap_or(0),
        download_url,
    }))
}

/// DELETE /api/me/profile/image
/// Delete job seeker's profile image
pub async fn delete_profile_image(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<FileDeleteResponse>> {
    if auth_user.user_type != "job_seeker" {
        return Err(AppError::ForbiddenError(
            "Only job seekers can delete profile images".to_string(),
        ));
    }

    let profile = sqlx::query!(
        r#"SELECT profile_image_file_id FROM job_seeker_profiles WHERE user_id = $1"#,
        auth_user.id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Profile not found".to_string()))?;

    let file_id = profile
        .profile_image_file_id
        .ok_or_else(|| AppError::NotFound("No profile image uploaded".to_string()))?;

    // Clear profile reference first
    sqlx::query!(
        r#"UPDATE job_seeker_profiles SET profile_image_file_id = NULL WHERE user_id = $1"#,
        auth_user.id,
    )
    .execute(&state.db)
    .await?;

    // Delete file
    delete_file_internal(&state, file_id, auth_user.id).await?;

    Ok(Json(FileDeleteResponse {
        message: "Profile image deleted successfully".to_string(),
    }))
}

// ============================================================================
// COMPANY FILE ENDPOINTS
// ============================================================================

/// PUT /api/me/company/logo
/// Upload company logo (owner/admin only)
pub async fn upload_company_logo(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    mut multipart: Multipart,
) -> Result<Json<FileUploadResponse>> {
    if auth_user.user_type != "company_member" {
        return Err(AppError::ForbiddenError(
            "Only company members can upload company logos".to_string(),
        ));
    }

    let (company_id, role) = get_user_company_membership(&state.db, auth_user.id).await?;

    if !is_owner_or_admin(role) {
        return Err(AppError::ForbiddenError(
            "Only owners and admins can upload company logos".to_string(),
        ));
    }

    let (filename, content_type, data) = validate_and_extract_file(&mut multipart, FileType::CompanyLogo).await?;

    // Delete existing logo if any
    if let Some(existing) = sqlx::query!(
        r#"SELECT logo_file_id FROM company_profiles WHERE id = $1"#,
        company_id,
    )
    .fetch_optional(&state.db)
    .await?
    {
        if let Some(file_id) = existing.logo_file_id {
            let _ = delete_file_internal(&state, file_id, auth_user.id).await;
        }
    }

    // Upload new file
    let file = upload_file_internal(&state, auth_user.id, FileType::CompanyLogo, filename, content_type, data).await?;

    // Update company profile reference
    sqlx::query!(
        r#"UPDATE company_profiles SET logo_file_id = $1 WHERE id = $2"#,
        file.id,
        company_id,
    )
    .execute(&state.db)
    .await?;

    let download_url = format!("/api/files/{}", file.id);

    Ok(Json(FileUploadResponse {
        file_id: file.id,
        file_type: file.file_type,
        original_filename: file.original_filename,
        file_size_bytes: file.file_size_bytes.unwrap_or(0),
        download_url,
    }))
}

/// DELETE /api/me/company/logo
/// Delete company logo (owner/admin only)
pub async fn delete_company_logo(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<FileDeleteResponse>> {
    if auth_user.user_type != "company_member" {
        return Err(AppError::ForbiddenError(
            "Only company members can delete company logos".to_string(),
        ));
    }

    let (company_id, role) = get_user_company_membership(&state.db, auth_user.id).await?;

    if !is_owner_or_admin(role) {
        return Err(AppError::ForbiddenError(
            "Only owners and admins can delete company logos".to_string(),
        ));
    }

    let company = sqlx::query!(
        r#"SELECT logo_file_id FROM company_profiles WHERE id = $1"#,
        company_id,
    )
    .fetch_one(&state.db)
    .await?;

    let file_id = company
        .logo_file_id
        .ok_or_else(|| AppError::NotFound("No company logo uploaded".to_string()))?;

    // Clear company reference first
    sqlx::query!(
        r#"UPDATE company_profiles SET logo_file_id = NULL WHERE id = $1"#,
        company_id,
    )
    .execute(&state.db)
    .await?;

    // Delete file
    delete_file_internal(&state, file_id, auth_user.id).await?;

    Ok(Json(FileDeleteResponse {
        message: "Company logo deleted successfully".to_string(),
    }))
}

/// PUT /api/me/company/cover
/// Upload company cover image (owner/admin only)
pub async fn upload_company_cover(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    mut multipart: Multipart,
) -> Result<Json<FileUploadResponse>> {
    if auth_user.user_type != "company_member" {
        return Err(AppError::ForbiddenError(
            "Only company members can upload company covers".to_string(),
        ));
    }

    let (company_id, role) = get_user_company_membership(&state.db, auth_user.id).await?;

    if !is_owner_or_admin(role) {
        return Err(AppError::ForbiddenError(
            "Only owners and admins can upload company covers".to_string(),
        ));
    }

    let (filename, content_type, data) = validate_and_extract_file(&mut multipart, FileType::CompanyCover).await?;

    // Delete existing cover if any
    if let Some(existing) = sqlx::query!(
        r#"SELECT cover_file_id FROM company_profiles WHERE id = $1"#,
        company_id,
    )
    .fetch_optional(&state.db)
    .await?
    {
        if let Some(file_id) = existing.cover_file_id {
            let _ = delete_file_internal(&state, file_id, auth_user.id).await;
        }
    }

    // Upload new file
    let file = upload_file_internal(&state, auth_user.id, FileType::CompanyCover, filename, content_type, data).await?;

    // Update company profile reference
    sqlx::query!(
        r#"UPDATE company_profiles SET cover_file_id = $1 WHERE id = $2"#,
        file.id,
        company_id,
    )
    .execute(&state.db)
    .await?;

    let download_url = format!("/api/files/{}", file.id);

    Ok(Json(FileUploadResponse {
        file_id: file.id,
        file_type: file.file_type,
        original_filename: file.original_filename,
        file_size_bytes: file.file_size_bytes.unwrap_or(0),
        download_url,
    }))
}

/// DELETE /api/me/company/cover
/// Delete company cover image (owner/admin only)
pub async fn delete_company_cover(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<FileDeleteResponse>> {
    if auth_user.user_type != "company_member" {
        return Err(AppError::ForbiddenError(
            "Only company members can delete company covers".to_string(),
        ));
    }

    let (company_id, role) = get_user_company_membership(&state.db, auth_user.id).await?;

    if !is_owner_or_admin(role) {
        return Err(AppError::ForbiddenError(
            "Only owners and admins can delete company covers".to_string(),
        ));
    }

    let company = sqlx::query!(
        r#"SELECT cover_file_id FROM company_profiles WHERE id = $1"#,
        company_id,
    )
    .fetch_one(&state.db)
    .await?;

    let file_id = company
        .cover_file_id
        .ok_or_else(|| AppError::NotFound("No company cover uploaded".to_string()))?;

    // Clear company reference first
    sqlx::query!(
        r#"UPDATE company_profiles SET cover_file_id = NULL WHERE id = $1"#,
        company_id,
    )
    .execute(&state.db)
    .await?;

    // Delete file
    delete_file_internal(&state, file_id, auth_user.id).await?;

    Ok(Json(FileDeleteResponse {
        message: "Company cover deleted successfully".to_string(),
    }))
}

// ============================================================================
// FILE DOWNLOAD ENDPOINT
// ============================================================================

/// GET /api/files/{id}
/// Download a file by ID (authenticated users only)
pub async fn download_file(
    State(state): State<AppState>,
    Extension(_auth_user): Extension<AuthUser>,
    Path(file_id): Path<Uuid>,
) -> Result<Response> {
    let storage = state.storage.as_ref().ok_or_else(|| {
        AppError::InternalError("Storage service not configured".to_string())
    })?;

    // Get file info
    let file = sqlx::query!(
        r#"
        SELECT storage_path, original_filename, content_type
        FROM uploaded_files
        WHERE id = $1
        "#,
        file_id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("File not found".to_string()))?;

    // Get file content
    let data = storage.get(&file.storage_path).await?;

    let content_type = file
        .content_type
        .unwrap_or_else(|| "application/octet-stream".to_string());

    let response = Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, content_type)
        .header(
            header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"{}\"", file.original_filename),
        )
        .body(Body::from(data))
        .map_err(|e| AppError::InternalError(format!("Failed to build response: {}", e)))?;

    Ok(response)
}
