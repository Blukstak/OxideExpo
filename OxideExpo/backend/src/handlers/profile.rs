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
        profile::*,
        user::MessageResponse,
    },
    AppState,
};

// ============================================================================
// PROFILE ENDPOINTS
// ============================================================================

/// GET /api/me/profile
/// Get current user's job seeker profile
pub async fn get_profile(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<JobSeekerProfile>> {
    // Only job seekers can access this
    if auth_user.user_type != "job_seeker" {
        return Err(AppError::ForbiddenError(
            "Only job seekers can access this endpoint".to_string(),
        ));
    }

    // Get or create profile
    let profile = sqlx::query_as!(
        JobSeekerProfile,
        r#"
        INSERT INTO job_seeker_profiles (user_id)
        VALUES ($1)
        ON CONFLICT (user_id) DO UPDATE SET user_id = $1
        RETURNING user_id, phone, date_of_birth,
                  gender as "gender: Gender",
                  marital_status as "marital_status: MaritalStatus",
                  nationality, national_id, region_id, municipality_id,
                  address, bio, professional_headline, profile_image_url, cv_url,
                  completeness_percentage, created_at, updated_at
        "#,
        auth_user.id,
    )
    .fetch_one(&state.db)
    .await?;

    Ok(Json(profile))
}

/// PUT /api/me/profile
/// Update current user's job seeker profile
pub async fn update_profile(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Json(payload): Json<UpdateProfileRequest>,
) -> Result<Json<JobSeekerProfile>> {
    payload.validate()?;

    if auth_user.user_type != "job_seeker" {
        return Err(AppError::ForbiddenError(
            "Only job seekers can access this endpoint".to_string(),
        ));
    }

    // Upsert the profile
    sqlx::query!(
        r#"
        INSERT INTO job_seeker_profiles (
            user_id, phone, date_of_birth, gender, marital_status,
            nationality, national_id, region_id, municipality_id,
            address, bio, professional_headline
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (user_id) DO UPDATE SET
            phone = EXCLUDED.phone,
            date_of_birth = EXCLUDED.date_of_birth,
            gender = EXCLUDED.gender,
            marital_status = EXCLUDED.marital_status,
            nationality = EXCLUDED.nationality,
            national_id = EXCLUDED.national_id,
            region_id = EXCLUDED.region_id,
            municipality_id = EXCLUDED.municipality_id,
            address = EXCLUDED.address,
            bio = EXCLUDED.bio,
            professional_headline = EXCLUDED.professional_headline
        "#,
        auth_user.id,
        payload.phone,
        payload.date_of_birth,
        payload.gender as Option<Gender>,
        payload.marital_status as Option<MaritalStatus>,
        payload.nationality,
        payload.national_id,
        payload.region_id,
        payload.municipality_id,
        payload.address,
        payload.bio,
        payload.professional_headline,
    )
    .execute(&state.db)
    .await?;

    // Fetch the profile with updated completeness_percentage (calculated by trigger)
    let profile = sqlx::query_as!(
        JobSeekerProfile,
        r#"
        SELECT user_id, phone, date_of_birth,
               gender as "gender: Gender",
               marital_status as "marital_status: MaritalStatus",
               nationality, national_id, region_id, municipality_id,
               address, bio, professional_headline, profile_image_url, cv_url,
               completeness_percentage, created_at, updated_at
        FROM job_seeker_profiles
        WHERE user_id = $1
        "#,
        auth_user.id,
    )
    .fetch_one(&state.db)
    .await?;

    Ok(Json(profile))
}

// ============================================================================
// DISABILITY INFO ENDPOINTS
// ============================================================================

/// GET /api/me/disability
/// Get current user's disability information
pub async fn get_disability(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<Option<JobSeekerDisability>>> {
    if auth_user.user_type != "job_seeker" {
        return Err(AppError::ForbiddenError(
            "Only job seekers can access this endpoint".to_string(),
        ));
    }

    let disability = sqlx::query_as!(
        JobSeekerDisability,
        r#"
        SELECT id, user_id,
               category as "category: DisabilityCategory",
               description, has_disability_certificate, disability_percentage,
               requires_accommodations, accommodation_details, created_at, updated_at
        FROM job_seeker_disabilities
        WHERE user_id = $1
        LIMIT 1
        "#,
        auth_user.id,
    )
    .fetch_optional(&state.db)
    .await?;

    Ok(Json(disability))
}

/// PUT /api/me/disability
/// Update or create disability information
pub async fn update_disability(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Json(payload): Json<UpdateDisabilityRequest>,
) -> Result<Json<JobSeekerDisability>> {
    payload.validate()?;

    if auth_user.user_type != "job_seeker" {
        return Err(AppError::ForbiddenError(
            "Only job seekers can access this endpoint".to_string(),
        ));
    }

    let disability = sqlx::query_as!(
        JobSeekerDisability,
        r#"
        INSERT INTO job_seeker_disabilities (
            user_id, category, description, has_disability_certificate,
            disability_percentage, requires_accommodations, accommodation_details
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (user_id) DO UPDATE SET
            category = $2,
            description = $3,
            has_disability_certificate = $4,
            disability_percentage = $5,
            requires_accommodations = $6,
            accommodation_details = $7
        RETURNING id, user_id,
                  category as "category: DisabilityCategory",
                  description, has_disability_certificate, disability_percentage,
                  requires_accommodations, accommodation_details, created_at, updated_at
        "#,
        auth_user.id,
        payload.category as DisabilityCategory,
        payload.description,
        payload.has_disability_certificate,
        payload.disability_percentage,
        payload.requires_accommodations,
        payload.accommodation_details,
    )
    .fetch_one(&state.db)
    .await?;

    Ok(Json(disability))
}

// ============================================================================
// EDUCATION ENDPOINTS
// ============================================================================

/// GET /api/me/education
/// List all education records for current user
pub async fn list_education(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<Vec<EducationRecord>>> {
    if auth_user.user_type != "job_seeker" {
        return Err(AppError::ForbiddenError(
            "Only job seekers can access this endpoint".to_string(),
        ));
    }

    let records = sqlx::query_as!(
        EducationRecord,
        r#"
        SELECT id, user_id, institution_id, institution_name,
               level as "level: EducationLevel",
               field_of_study_id, field_of_study_name, degree_title,
               status as "status: EducationStatus",
               start_date, end_date, description, achievements, display_order,
               created_at, updated_at
        FROM education_records
        WHERE user_id = $1
        ORDER BY start_date DESC, display_order
        "#,
        auth_user.id,
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(records))
}

/// POST /api/me/education
/// Create new education record
pub async fn create_education(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Json(payload): Json<CreateEducationRequest>,
) -> Result<Json<EducationRecord>> {
    payload.validate()?;

    if auth_user.user_type != "job_seeker" {
        return Err(AppError::ForbiddenError(
            "Only job seekers can access this endpoint".to_string(),
        ));
    }

    let record = sqlx::query_as!(
        EducationRecord,
        r#"
        INSERT INTO education_records (
            user_id, institution_id, institution_name, level, field_of_study_id,
            field_of_study_name, degree_title, status, start_date, end_date,
            description, achievements
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id, user_id, institution_id, institution_name,
                  level as "level: EducationLevel",
                  field_of_study_id, field_of_study_name, degree_title,
                  status as "status: EducationStatus",
                  start_date, end_date, description, achievements, display_order,
                  created_at, updated_at
        "#,
        auth_user.id,
        payload.institution_id,
        payload.institution_name,
        payload.level as EducationLevel,
        payload.field_of_study_id,
        payload.field_of_study_name,
        payload.degree_title,
        payload.status as EducationStatus,
        payload.start_date,
        payload.end_date,
        payload.description,
        payload.achievements,
    )
    .fetch_one(&state.db)
    .await?;

    Ok(Json(record))
}

/// PUT /api/me/education/:id
/// Update education record
pub async fn update_education(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateEducationRequest>,
) -> Result<Json<EducationRecord>> {
    payload.validate()?;

    if auth_user.user_type != "job_seeker" {
        return Err(AppError::ForbiddenError(
            "Only job seekers can access this endpoint".to_string(),
        ));
    }

    let record = sqlx::query_as!(
        EducationRecord,
        r#"
        UPDATE education_records
        SET
            institution_id = $3,
            institution_name = $4,
            level = $5,
            field_of_study_id = $6,
            field_of_study_name = $7,
            degree_title = $8,
            status = $9,
            start_date = $10,
            end_date = $11,
            description = $12,
            achievements = $13
        WHERE id = $1 AND user_id = $2
        RETURNING id, user_id, institution_id, institution_name,
                  level as "level: EducationLevel",
                  field_of_study_id, field_of_study_name, degree_title,
                  status as "status: EducationStatus",
                  start_date, end_date, description, achievements, display_order,
                  created_at, updated_at
        "#,
        id,
        auth_user.id,
        payload.institution_id,
        payload.institution_name,
        payload.level as Option<EducationLevel>,
        payload.field_of_study_id,
        payload.field_of_study_name,
        payload.degree_title,
        payload.status as Option<EducationStatus>,
        payload.start_date,
        payload.end_date,
        payload.description,
        payload.achievements,
    )
    .fetch_one(&state.db)
    .await
    .map_err(|e| match e {
        sqlx::Error::RowNotFound => AppError::NotFound("Education record not found".to_string()),
        _ => AppError::DatabaseError(e),
    })?;

    Ok(Json(record))
}

/// DELETE /api/me/education/:id
/// Delete education record
pub async fn delete_education(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(id): Path<Uuid>,
) -> Result<Json<MessageResponse>> {
    if auth_user.user_type != "job_seeker" {
        return Err(AppError::ForbiddenError(
            "Only job seekers can access this endpoint".to_string(),
        ));
    }

    let result = sqlx::query!(
        "DELETE FROM education_records WHERE id = $1 AND user_id = $2",
        id,
        auth_user.id,
    )
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(
            "Education record not found".to_string(),
        ));
    }

    Ok(Json(MessageResponse::new("Education record deleted")))
}

// ============================================================================
// WORK EXPERIENCE ENDPOINTS
// ============================================================================

/// GET /api/me/experience
/// List all work experiences for current user
pub async fn list_experiences(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<Vec<WorkExperience>>> {
    if auth_user.user_type != "job_seeker" {
        return Err(AppError::ForbiddenError(
            "Only job seekers can access this endpoint".to_string(),
        ));
    }

    let experiences = sqlx::query_as!(
        WorkExperience,
        r#"
        SELECT id, user_id, company_name, industry_id, position_title,
               work_area_id, position_level_id,
               employment_type as "employment_type: JobType",
               is_current, start_date, end_date, region_id, municipality_id,
               description, achievements, display_order, created_at, updated_at
        FROM work_experiences
        WHERE user_id = $1
        ORDER BY is_current DESC, start_date DESC, display_order
        "#,
        auth_user.id,
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(experiences))
}

/// POST /api/me/experience
/// Create new work experience
pub async fn create_experience(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Json(payload): Json<CreateWorkExperienceRequest>,
) -> Result<Json<WorkExperience>> {
    payload.validate()?;

    if auth_user.user_type != "job_seeker" {
        return Err(AppError::ForbiddenError(
            "Only job seekers can access this endpoint".to_string(),
        ));
    }

    let experience = sqlx::query_as!(
        WorkExperience,
        r#"
        INSERT INTO work_experiences (
            user_id, company_name, industry_id, position_title, work_area_id,
            position_level_id, employment_type, is_current, start_date, end_date,
            region_id, municipality_id, description, achievements
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING id, user_id, company_name, industry_id, position_title,
                  work_area_id, position_level_id,
                  employment_type as "employment_type: JobType",
                  is_current, start_date, end_date, region_id, municipality_id,
                  description, achievements, display_order, created_at, updated_at
        "#,
        auth_user.id,
        payload.company_name,
        payload.industry_id,
        payload.position_title,
        payload.work_area_id,
        payload.position_level_id,
        payload.employment_type as Option<JobType>,
        payload.is_current,
        payload.start_date,
        payload.end_date,
        payload.region_id,
        payload.municipality_id,
        payload.description,
        payload.achievements,
    )
    .fetch_one(&state.db)
    .await?;

    Ok(Json(experience))
}

/// PUT /api/me/experience/:id
/// Update work experience
pub async fn update_experience(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateWorkExperienceRequest>,
) -> Result<Json<WorkExperience>> {
    payload.validate()?;

    if auth_user.user_type != "job_seeker" {
        return Err(AppError::ForbiddenError(
            "Only job seekers can access this endpoint".to_string(),
        ));
    }

    let experience = sqlx::query_as!(
        WorkExperience,
        r#"
        UPDATE work_experiences
        SET
            company_name = $3,
            industry_id = $4,
            position_title = $5,
            work_area_id = $6,
            position_level_id = $7,
            employment_type = $8,
            is_current = $9,
            start_date = $10,
            end_date = $11,
            region_id = $12,
            municipality_id = $13,
            description = $14,
            achievements = $15
        WHERE id = $1 AND user_id = $2
        RETURNING id, user_id, company_name, industry_id, position_title,
                  work_area_id, position_level_id,
                  employment_type as "employment_type: JobType",
                  is_current, start_date, end_date, region_id, municipality_id,
                  description, achievements, display_order, created_at, updated_at
        "#,
        id,
        auth_user.id,
        payload.company_name,
        payload.industry_id,
        payload.position_title,
        payload.work_area_id,
        payload.position_level_id,
        payload.employment_type as Option<JobType>,
        payload.is_current,
        payload.start_date,
        payload.end_date,
        payload.region_id,
        payload.municipality_id,
        payload.description,
        payload.achievements,
    )
    .fetch_one(&state.db)
    .await
    .map_err(|e| match e {
        sqlx::Error::RowNotFound => AppError::NotFound("Work experience not found".to_string()),
        _ => AppError::DatabaseError(e),
    })?;

    Ok(Json(experience))
}

/// DELETE /api/me/experience/:id
/// Delete work experience
pub async fn delete_experience(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(id): Path<Uuid>,
) -> Result<Json<MessageResponse>> {
    if auth_user.user_type != "job_seeker" {
        return Err(AppError::ForbiddenError(
            "Only job seekers can access this endpoint".to_string(),
        ));
    }

    let result = sqlx::query!(
        "DELETE FROM work_experiences WHERE id = $1 AND user_id = $2",
        id,
        auth_user.id,
    )
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(
            "Work experience not found".to_string(),
        ));
    }

    Ok(Json(MessageResponse::new("Work experience deleted")))
}

// ============================================================================
// SKILLS ENDPOINTS
// ============================================================================

/// GET /api/me/skills
/// List all skills for current user
pub async fn list_skills(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<Vec<UserSkill>>> {
    if auth_user.user_type != "job_seeker" {
        return Err(AppError::ForbiddenError(
            "Only job seekers can access this endpoint".to_string(),
        ));
    }

    let skills = sqlx::query_as!(
        UserSkill,
        r#"
        SELECT id, user_id, skill_id, proficiency_level, years_of_experience,
               created_at, updated_at
        FROM user_skills
        WHERE user_id = $1
        ORDER BY proficiency_level DESC, created_at DESC
        "#,
        auth_user.id,
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(skills))
}

/// POST /api/me/skills
/// Add a skill
pub async fn create_skill(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Json(payload): Json<CreateSkillRequest>,
) -> Result<Json<UserSkill>> {
    payload.validate()?;

    if auth_user.user_type != "job_seeker" {
        return Err(AppError::ForbiddenError(
            "Only job seekers can access this endpoint".to_string(),
        ));
    }

    let skill = sqlx::query_as!(
        UserSkill,
        r#"
        INSERT INTO user_skills (user_id, skill_id, proficiency_level, years_of_experience)
        VALUES ($1, $2, $3, $4)
        RETURNING id, user_id, skill_id, proficiency_level, years_of_experience,
                  created_at, updated_at
        "#,
        auth_user.id,
        payload.skill_id,
        payload.proficiency_level,
        payload.years_of_experience,
    )
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        if e.to_string().contains("unique") || e.to_string().contains("duplicate") {
            AppError::ConflictError("Skill already added".to_string())
        } else {
            AppError::DatabaseError(e)
        }
    })?;

    Ok(Json(skill))
}

/// PUT /api/me/skills/:id
/// Update a skill
pub async fn update_skill(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateSkillRequest>,
) -> Result<Json<UserSkill>> {
    payload.validate()?;

    if auth_user.user_type != "job_seeker" {
        return Err(AppError::ForbiddenError(
            "Only job seekers can access this endpoint".to_string(),
        ));
    }

    let skill = sqlx::query_as!(
        UserSkill,
        r#"
        UPDATE user_skills
        SET
            proficiency_level = $3,
            years_of_experience = $4
        WHERE id = $1 AND user_id = $2
        RETURNING id, user_id, skill_id, proficiency_level, years_of_experience,
                  created_at, updated_at
        "#,
        id,
        auth_user.id,
        payload.proficiency_level,
        payload.years_of_experience,
    )
    .fetch_one(&state.db)
    .await
    .map_err(|e| match e {
        sqlx::Error::RowNotFound => AppError::NotFound("Skill not found".to_string()),
        _ => AppError::DatabaseError(e),
    })?;

    Ok(Json(skill))
}

/// DELETE /api/me/skills/:id
/// Delete a skill
pub async fn delete_skill(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(id): Path<Uuid>,
) -> Result<Json<MessageResponse>> {
    if auth_user.user_type != "job_seeker" {
        return Err(AppError::ForbiddenError(
            "Only job seekers can access this endpoint".to_string(),
        ));
    }

    let result = sqlx::query!(
        "DELETE FROM user_skills WHERE id = $1 AND user_id = $2",
        id,
        auth_user.id,
    )
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Skill not found".to_string()));
    }

    Ok(Json(MessageResponse::new("Skill deleted")))
}

// ============================================================================
// LANGUAGES ENDPOINTS
// ============================================================================

/// GET /api/me/languages
/// List all languages for current user
pub async fn list_languages(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<Vec<UserLanguage>>> {
    if auth_user.user_type != "job_seeker" {
        return Err(AppError::ForbiddenError(
            "Only job seekers can access this endpoint".to_string(),
        ));
    }

    let languages = sqlx::query_as!(
        UserLanguage,
        r#"
        SELECT id, user_id, language_id,
               proficiency as "proficiency: LanguageProficiency",
               created_at, updated_at
        FROM user_languages
        WHERE user_id = $1
        ORDER BY created_at DESC
        "#,
        auth_user.id,
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(languages))
}

/// POST /api/me/languages
/// Add a language
pub async fn create_language(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Json(payload): Json<CreateLanguageRequest>,
) -> Result<Json<UserLanguage>> {
    payload.validate()?;

    if auth_user.user_type != "job_seeker" {
        return Err(AppError::ForbiddenError(
            "Only job seekers can access this endpoint".to_string(),
        ));
    }

    let language = sqlx::query_as!(
        UserLanguage,
        r#"
        INSERT INTO user_languages (user_id, language_id, proficiency)
        VALUES ($1, $2, $3)
        RETURNING id, user_id, language_id,
                  proficiency as "proficiency: LanguageProficiency",
                  created_at, updated_at
        "#,
        auth_user.id,
        payload.language_id,
        payload.proficiency as LanguageProficiency,
    )
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        if e.to_string().contains("unique") || e.to_string().contains("duplicate") {
            AppError::ConflictError("Language already added".to_string())
        } else {
            AppError::DatabaseError(e)
        }
    })?;

    Ok(Json(language))
}

/// PUT /api/me/languages/:id
/// Update a language
pub async fn update_language(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateLanguageRequest>,
) -> Result<Json<UserLanguage>> {
    payload.validate()?;

    if auth_user.user_type != "job_seeker" {
        return Err(AppError::ForbiddenError(
            "Only job seekers can access this endpoint".to_string(),
        ));
    }

    let language = sqlx::query_as!(
        UserLanguage,
        r#"
        UPDATE user_languages
        SET proficiency = $3
        WHERE id = $1 AND user_id = $2
        RETURNING id, user_id, language_id,
                  proficiency as "proficiency: LanguageProficiency",
                  created_at, updated_at
        "#,
        id,
        auth_user.id,
        payload.proficiency as LanguageProficiency,
    )
    .fetch_one(&state.db)
    .await
    .map_err(|e| match e {
        sqlx::Error::RowNotFound => AppError::NotFound("Language not found".to_string()),
        _ => AppError::DatabaseError(e),
    })?;

    Ok(Json(language))
}

/// DELETE /api/me/languages/:id
/// Delete a language
pub async fn delete_language(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(id): Path<Uuid>,
) -> Result<Json<MessageResponse>> {
    if auth_user.user_type != "job_seeker" {
        return Err(AppError::ForbiddenError(
            "Only job seekers can access this endpoint".to_string(),
        ));
    }

    let result = sqlx::query!(
        "DELETE FROM user_languages WHERE id = $1 AND user_id = $2",
        id,
        auth_user.id,
    )
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Language not found".to_string()));
    }

    Ok(Json(MessageResponse::new("Language deleted")))
}

// ============================================================================
// PORTFOLIO ENDPOINTS
// ============================================================================

/// GET /api/me/portfolio
/// List all portfolio items for current user
pub async fn list_portfolio(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<Vec<PortfolioItem>>> {
    if auth_user.user_type != "job_seeker" {
        return Err(AppError::ForbiddenError(
            "Only job seekers can access this endpoint".to_string(),
        ));
    }

    let items = sqlx::query_as!(
        PortfolioItem,
        r#"
        SELECT id, user_id, title, description, url, file_url, category,
               completion_date, display_order, created_at, updated_at
        FROM portfolio_items
        WHERE user_id = $1
        ORDER BY display_order, created_at DESC
        "#,
        auth_user.id,
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(items))
}

/// POST /api/me/portfolio
/// Create portfolio item
pub async fn create_portfolio(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Json(payload): Json<CreatePortfolioRequest>,
) -> Result<Json<PortfolioItem>> {
    payload.validate()?;

    if auth_user.user_type != "job_seeker" {
        return Err(AppError::ForbiddenError(
            "Only job seekers can access this endpoint".to_string(),
        ));
    }

    // Validate that at least one of url or file_url is provided
    if payload.url.is_none() && payload.file_url.is_none() {
        return Err(AppError::ValidationError(
            "Either url or file_url must be provided".to_string(),
        ));
    }

    let item = sqlx::query_as!(
        PortfolioItem,
        r#"
        INSERT INTO portfolio_items (
            user_id, title, description, url, file_url, category, completion_date
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, user_id, title, description, url, file_url, category,
                  completion_date, display_order, created_at, updated_at
        "#,
        auth_user.id,
        payload.title,
        payload.description,
        payload.url,
        payload.file_url,
        payload.category,
        payload.completion_date,
    )
    .fetch_one(&state.db)
    .await?;

    Ok(Json(item))
}

/// PUT /api/me/portfolio/:id
/// Update portfolio item
pub async fn update_portfolio(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdatePortfolioRequest>,
) -> Result<Json<PortfolioItem>> {
    payload.validate()?;

    if auth_user.user_type != "job_seeker" {
        return Err(AppError::ForbiddenError(
            "Only job seekers can access this endpoint".to_string(),
        ));
    }

    let item = sqlx::query_as!(
        PortfolioItem,
        r#"
        UPDATE portfolio_items
        SET
            title = $3,
            description = $4,
            url = $5,
            file_url = $6,
            category = $7,
            completion_date = $8
        WHERE id = $1 AND user_id = $2
        RETURNING id, user_id, title, description, url, file_url, category,
                  completion_date, display_order, created_at, updated_at
        "#,
        id,
        auth_user.id,
        payload.title,
        payload.description,
        payload.url,
        payload.file_url,
        payload.category,
        payload.completion_date,
    )
    .fetch_one(&state.db)
    .await
    .map_err(|e| match e {
        sqlx::Error::RowNotFound => AppError::NotFound("Portfolio item not found".to_string()),
        _ => AppError::DatabaseError(e),
    })?;

    Ok(Json(item))
}

/// DELETE /api/me/portfolio/:id
/// Delete portfolio item
pub async fn delete_portfolio(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(id): Path<Uuid>,
) -> Result<Json<MessageResponse>> {
    if auth_user.user_type != "job_seeker" {
        return Err(AppError::ForbiddenError(
            "Only job seekers can access this endpoint".to_string(),
        ));
    }

    let result = sqlx::query!(
        "DELETE FROM portfolio_items WHERE id = $1 AND user_id = $2",
        id,
        auth_user.id,
    )
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(
            "Portfolio item not found".to_string(),
        ));
    }

    Ok(Json(MessageResponse::new("Portfolio item deleted")))
}

// ============================================================================
// FULL PROFILE ENDPOINT
// ============================================================================

/// GET /api/me/profile/full
/// Get complete profile with all related data
pub async fn get_full_profile(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<FullProfileResponse>> {
    if auth_user.user_type != "job_seeker" {
        return Err(AppError::ForbiddenError(
            "Only job seekers can access this endpoint".to_string(),
        ));
    }

    // Get or create profile
    let profile = sqlx::query_as!(
        JobSeekerProfile,
        r#"
        INSERT INTO job_seeker_profiles (user_id)
        VALUES ($1)
        ON CONFLICT (user_id) DO UPDATE SET user_id = $1
        RETURNING user_id, phone, date_of_birth,
                  gender as "gender: Gender",
                  marital_status as "marital_status: MaritalStatus",
                  nationality, national_id, region_id, municipality_id,
                  address, bio, professional_headline, profile_image_url, cv_url,
                  completeness_percentage, created_at, updated_at
        "#,
        auth_user.id,
    )
    .fetch_one(&state.db)
    .await?;

    // Get disability info
    let disability = sqlx::query_as!(
        JobSeekerDisability,
        r#"
        SELECT id, user_id,
               category as "category: DisabilityCategory",
               description, has_disability_certificate, disability_percentage,
               requires_accommodations, accommodation_details, created_at, updated_at
        FROM job_seeker_disabilities
        WHERE user_id = $1
        LIMIT 1
        "#,
        auth_user.id,
    )
    .fetch_optional(&state.db)
    .await?;

    // Get education records
    let education = sqlx::query_as!(
        EducationRecord,
        r#"
        SELECT id, user_id, institution_id, institution_name,
               level as "level: EducationLevel",
               field_of_study_id, field_of_study_name, degree_title,
               status as "status: EducationStatus",
               start_date, end_date, description, achievements, display_order,
               created_at, updated_at
        FROM education_records
        WHERE user_id = $1
        ORDER BY start_date DESC, display_order
        "#,
        auth_user.id,
    )
    .fetch_all(&state.db)
    .await?;

    // Get work experiences
    let experience = sqlx::query_as!(
        WorkExperience,
        r#"
        SELECT id, user_id, company_name, industry_id, position_title,
               work_area_id, position_level_id,
               employment_type as "employment_type: JobType",
               is_current, start_date, end_date, region_id, municipality_id,
               description, achievements, display_order, created_at, updated_at
        FROM work_experiences
        WHERE user_id = $1
        ORDER BY is_current DESC, start_date DESC, display_order
        "#,
        auth_user.id,
    )
    .fetch_all(&state.db)
    .await?;

    // Get skills
    let skills = sqlx::query_as!(
        UserSkill,
        r#"
        SELECT id, user_id, skill_id, proficiency_level, years_of_experience,
               created_at, updated_at
        FROM user_skills
        WHERE user_id = $1
        ORDER BY proficiency_level DESC, created_at DESC
        "#,
        auth_user.id,
    )
    .fetch_all(&state.db)
    .await?;

    // Get languages
    let languages = sqlx::query_as!(
        UserLanguage,
        r#"
        SELECT id, user_id, language_id,
               proficiency as "proficiency: LanguageProficiency",
               created_at, updated_at
        FROM user_languages
        WHERE user_id = $1
        ORDER BY created_at DESC
        "#,
        auth_user.id,
    )
    .fetch_all(&state.db)
    .await?;

    // Get portfolio
    let portfolio = sqlx::query_as!(
        PortfolioItem,
        r#"
        SELECT id, user_id, title, description, url, file_url, category,
               completion_date, display_order, created_at, updated_at
        FROM portfolio_items
        WHERE user_id = $1
        ORDER BY display_order, created_at DESC
        "#,
        auth_user.id,
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(FullProfileResponse {
        profile,
        disability,
        education,
        experience,
        skills,
        languages,
        portfolio,
    }))
}
