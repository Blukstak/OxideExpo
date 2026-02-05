use axum::{
    extract::{Path, Query, State},
    Extension, Json,
};
use uuid::Uuid;
use validator::Validate;

use crate::{
    error::{AppError, Result},
    middleware::AuthUser,
    models::{
        job::PublicJobListing,
        matching::*,
    },
    services::matching::MatchingService,
    AppState,
};

// ============================================================================
// JOB SEEKER ENDPOINTS
// ============================================================================

/// GET /api/me/recommended-jobs
/// Get personalized job recommendations for the current job seeker
pub async fn get_recommended_jobs(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Query(query): Query<RecommendedJobsQuery>,
) -> Result<Json<RecommendedJobsResponse>> {
    // Only job seekers can access this
    if auth_user.user_type != "job_seeker" {
        return Err(AppError::ForbiddenError(
            "Only job seekers can access this endpoint".to_string(),
        ));
    }

    let limit = query.limit.unwrap_or(20).min(100);
    let offset = query.offset.unwrap_or(0);
    let min_score = query.min_score.unwrap_or(0);
    let exclude_applied = query.exclude_applied.unwrap_or(true);

    // Get active jobs
    let active_jobs = sqlx::query!(
        r#"
        SELECT
            j.id,
            j.title,
            j.description,
            j.responsibilities,
            j.job_type as "job_type: String",
            j.industry_id,
            j.work_area_id,
            j.position_level_id,
            j.work_modality as "work_modality: String",
            j.work_schedule,
            j.region_id,
            j.municipality_id,
            COALESCE(j.is_remote_allowed, false) as "is_remote_allowed!",
            j.education_level,
            j.years_experience_min,
            j.years_experience_max,
            j.benefits,
            j.application_deadline,
            j.contact_email,
            j.application_url,
            j.vacancies,
            COALESCE(j.is_featured, false) as "is_featured!",
            j.created_at,
            c.company_name,
            c.logo_url as company_logo_url
        FROM jobs j
        JOIN company_profiles c ON j.company_id = c.id
        WHERE j.status = 'active'
          AND j.application_deadline >= CURRENT_DATE
        ORDER BY j.is_featured DESC, j.created_at DESC
        LIMIT 200
        "#
    )
    .fetch_all(&state.db)
    .await?;

    let mut recommended_jobs = Vec::new();

    for job in active_jobs {
        // Check if already applied
        let already_applied =
            MatchingService::check_already_applied(&state.db, job.id, auth_user.id).await?;

        if exclude_applied && already_applied {
            continue;
        }

        // Calculate match score
        let score_breakdown =
            MatchingService::calculate_match_score(&state.db, job.id, auth_user.id).await?;

        if score_breakdown.total_score < min_score {
            continue;
        }

        // Cache the score
        let _ = MatchingService::save_match_score(&state.db, job.id, auth_user.id, &score_breakdown)
            .await;

        // Parse enums
        let job_type = match job.job_type.as_str() {
            "full_time" => crate::models::job::JobType::FullTime,
            "part_time" => crate::models::job::JobType::PartTime,
            "contract" => crate::models::job::JobType::Contract,
            "temporary" => crate::models::job::JobType::Temporary,
            "internship" => crate::models::job::JobType::Internship,
            _ => crate::models::job::JobType::FullTime,
        };

        let work_modality = match job.work_modality.as_str() {
            "on_site" => crate::models::job::WorkModality::OnSite,
            "remote" => crate::models::job::WorkModality::Remote,
            "hybrid" => crate::models::job::WorkModality::Hybrid,
            _ => crate::models::job::WorkModality::OnSite,
        };

        let public_job = PublicJobListing {
            id: job.id,
            title: job.title,
            description: job.description,
            responsibilities: job.responsibilities,
            job_type,
            industry_id: job.industry_id,
            work_area_id: job.work_area_id,
            position_level_id: job.position_level_id,
            work_modality,
            work_schedule: job.work_schedule,
            region_id: job.region_id,
            municipality_id: job.municipality_id,
            is_remote_allowed: job.is_remote_allowed,
            education_level: job.education_level,
            years_experience_min: job.years_experience_min,
            years_experience_max: job.years_experience_max,
            benefits: job.benefits,
            application_deadline: job.application_deadline,
            contact_email: job.contact_email,
            application_url: job.application_url,
            vacancies: job.vacancies,
            is_featured: job.is_featured,
            created_at: job.created_at,
            company_name: job.company_name,
            company_logo_url: job.company_logo_url,
        };

        recommended_jobs.push(RecommendedJob {
            job: public_job,
            match_score: score_breakdown.total_score,
            score_breakdown,
            already_applied,
        });
    }

    // Sort by match score descending
    recommended_jobs.sort_by(|a, b| b.match_score.cmp(&a.match_score));

    let total_count = recommended_jobs.len() as i64;
    let has_more = (offset + limit) < total_count;

    // Apply pagination
    let jobs: Vec<RecommendedJob> = recommended_jobs
        .into_iter()
        .skip(offset as usize)
        .take(limit as usize)
        .collect();

    Ok(Json(RecommendedJobsResponse {
        jobs,
        total_count,
        has_more,
    }))
}

/// GET /api/jobs/{id}/match-score
/// Get match score for a specific job
pub async fn get_job_match_score(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(job_id): Path<Uuid>,
) -> Result<Json<JobMatchScoreResponse>> {
    // Only job seekers can access this
    if auth_user.user_type != "job_seeker" {
        return Err(AppError::ForbiddenError(
            "Only job seekers can access this endpoint".to_string(),
        ));
    }

    // Verify job exists and is active
    let job_exists = sqlx::query_scalar!(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM jobs
            WHERE id = $1 AND status = 'active'
        ) as "exists!"
        "#,
        job_id
    )
    .fetch_one(&state.db)
    .await?;

    if !job_exists {
        return Err(AppError::NotFound("Job not found or not active".to_string()));
    }

    // Calculate match score
    let score_breakdown =
        MatchingService::calculate_match_score(&state.db, job_id, auth_user.id).await?;

    // Check if already applied
    let already_applied =
        MatchingService::check_already_applied(&state.db, job_id, auth_user.id).await?;

    // Cache the score
    let _ =
        MatchingService::save_match_score(&state.db, job_id, auth_user.id, &score_breakdown).await;

    Ok(Json(JobMatchScoreResponse {
        job_id,
        match_score: score_breakdown.total_score,
        score_breakdown,
        already_applied,
    }))
}

// ============================================================================
// PREFERENCES ENDPOINTS
// ============================================================================

/// GET /api/me/preferences
/// Get current user's recommendation preferences
pub async fn get_preferences(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<JobSeekerPreferences>> {
    // Only job seekers can access this
    if auth_user.user_type != "job_seeker" {
        return Err(AppError::ForbiddenError(
            "Only job seekers can access this endpoint".to_string(),
        ));
    }

    // Get or create preferences
    let preferences = sqlx::query!(
        r#"
        INSERT INTO job_seeker_preferences (user_id)
        VALUES ($1)
        ON CONFLICT (user_id) DO UPDATE SET user_id = $1
        RETURNING
            user_id,
            willing_to_relocate,
            salary_expectation_min,
            salary_expectation_max,
            COALESCE(salary_currency, 'CLP') as "salary_currency!",
            profile_visibility as "profile_visibility: ProfileVisibility",
            show_disability_info,
            email_job_alerts,
            alert_frequency as "alert_frequency: AlertFrequency",
            created_at,
            updated_at
        "#,
        auth_user.id
    )
    .fetch_one(&state.db)
    .await?;

    Ok(Json(JobSeekerPreferences {
        user_id: preferences.user_id,
        preferred_work_modalities: Vec::new(), // TODO: implement array columns
        preferred_job_types: Vec::new(),
        preferred_region_ids: Vec::new(),
        preferred_industry_ids: Vec::new(),
        willing_to_relocate: preferences.willing_to_relocate.unwrap_or(false),
        salary_expectation_min: preferences.salary_expectation_min,
        salary_expectation_max: preferences.salary_expectation_max,
        salary_currency: preferences.salary_currency,
        profile_visibility: preferences.profile_visibility,
        show_disability_info: preferences.show_disability_info,
        email_job_alerts: preferences.email_job_alerts,
        alert_frequency: preferences.alert_frequency,
        created_at: preferences.created_at,
        updated_at: preferences.updated_at,
    }))
}

/// PUT /api/me/preferences
/// Update current user's recommendation preferences
pub async fn update_preferences(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Json(payload): Json<UpdatePreferencesRequest>,
) -> Result<Json<JobSeekerPreferences>> {
    payload.validate()?;

    if auth_user.user_type != "job_seeker" {
        return Err(AppError::ForbiddenError(
            "Only job seekers can access this endpoint".to_string(),
        ));
    }

    // Ensure preferences row exists first
    sqlx::query!(
        "INSERT INTO job_seeker_preferences (user_id) VALUES ($1) ON CONFLICT DO NOTHING",
        auth_user.id
    )
    .execute(&state.db)
    .await?;

    // Update preferences
    let preferences = sqlx::query!(
        r#"
        UPDATE job_seeker_preferences
        SET
            willing_to_relocate = COALESCE($2, willing_to_relocate),
            salary_expectation_min = COALESCE($3, salary_expectation_min),
            salary_expectation_max = COALESCE($4, salary_expectation_max),
            salary_currency = COALESCE($5, salary_currency),
            profile_visibility = COALESCE($6, profile_visibility),
            show_disability_info = COALESCE($7, show_disability_info),
            email_job_alerts = COALESCE($8, email_job_alerts),
            alert_frequency = COALESCE($9, alert_frequency),
            updated_at = NOW()
        WHERE user_id = $1
        RETURNING
            user_id,
            willing_to_relocate,
            salary_expectation_min,
            salary_expectation_max,
            COALESCE(salary_currency, 'CLP') as "salary_currency!",
            profile_visibility as "profile_visibility: ProfileVisibility",
            show_disability_info,
            email_job_alerts,
            alert_frequency as "alert_frequency: AlertFrequency",
            created_at,
            updated_at
        "#,
        auth_user.id,
        payload.willing_to_relocate,
        payload.salary_expectation_min,
        payload.salary_expectation_max,
        payload.salary_currency,
        payload.profile_visibility as Option<ProfileVisibility>,
        payload.show_disability_info,
        payload.email_job_alerts,
        payload.alert_frequency as Option<AlertFrequency>,
    )
    .fetch_one(&state.db)
    .await?;

    Ok(Json(JobSeekerPreferences {
        user_id: preferences.user_id,
        preferred_work_modalities: Vec::new(),
        preferred_job_types: Vec::new(),
        preferred_region_ids: Vec::new(),
        preferred_industry_ids: Vec::new(),
        willing_to_relocate: preferences.willing_to_relocate.unwrap_or(false),
        salary_expectation_min: preferences.salary_expectation_min,
        salary_expectation_max: preferences.salary_expectation_max,
        salary_currency: preferences.salary_currency,
        profile_visibility: preferences.profile_visibility,
        show_disability_info: preferences.show_disability_info,
        email_job_alerts: preferences.email_job_alerts,
        alert_frequency: preferences.alert_frequency,
        created_at: preferences.created_at,
        updated_at: preferences.updated_at,
    }))
}

// ============================================================================
// COMPANY ENDPOINTS
// ============================================================================

/// GET /api/me/jobs/{id}/recommended-candidates
/// Get recommended candidates for a job (company endpoint)
pub async fn get_recommended_candidates(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(job_id): Path<Uuid>,
    Query(query): Query<RecommendedCandidatesQuery>,
) -> Result<Json<RecommendedCandidatesResponse>> {
    // Only company members can access this
    if auth_user.user_type != "company_member" {
        return Err(AppError::ForbiddenError(
            "Only company members can access this endpoint".to_string(),
        ));
    }

    // Verify job belongs to user's company
    let _job = sqlx::query!(
        r#"
        SELECT j.id, j.company_id
        FROM jobs j
        JOIN company_members cm ON j.company_id = cm.company_id
        WHERE j.id = $1 AND cm.user_id = $2
        "#,
        job_id,
        auth_user.id
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| {
        AppError::ForbiddenError("You don't have access to this job".to_string())
    })?;

    let limit = query.limit.unwrap_or(20).min(100);
    let offset = query.offset.unwrap_or(0);
    let min_score = query.min_score.unwrap_or(0);
    let include_applied_only = query.include_applied_only.unwrap_or(false);

    // Get job seekers with visible profiles
    let candidates = sqlx::query!(
        r#"
        SELECT DISTINCT
            u.id as user_id,
            (u.first_name || ' ' || u.last_name) as "user_name!",
            u.email as user_email,
            p.user_id as profile_user_id,
            p.phone,
            p.date_of_birth,
            p.gender as "gender: String",
            p.marital_status as "marital_status: String",
            p.nationality,
            p.region_id,
            p.municipality_id,
            p.bio,
            p.professional_headline,
            p.profile_image_url,
            p.cv_url,
            p.completeness_percentage,
            p.created_at as profile_created_at,
            p.updated_at as profile_updated_at,
            COALESCE(pref.profile_visibility::text, 'visible') as "visibility!",
            COALESCE(pref.show_disability_info, true) as "show_disability!",
            EXISTS(
                SELECT 1 FROM job_applications ja
                WHERE ja.job_id = $1 AND ja.applicant_id = u.id
            ) as "has_applied!"
        FROM users u
        JOIN job_seeker_profiles p ON u.id = p.user_id
        LEFT JOIN job_seeker_preferences pref ON u.id = pref.user_id
        WHERE u.user_type = 'job_seeker'
          AND u.account_status = 'active'
          AND p.completeness_percentage >= 50
          AND (
              COALESCE(pref.profile_visibility::text, 'visible') = 'visible'
              OR (
                  COALESCE(pref.profile_visibility::text, 'visible') = 'applied_only'
                  AND EXISTS(
                      SELECT 1 FROM job_applications ja
                      WHERE ja.job_id = $1 AND ja.applicant_id = u.id
                  )
              )
          )
        ORDER BY p.completeness_percentage DESC
        LIMIT 500
        "#,
        job_id
    )
    .fetch_all(&state.db)
    .await?;

    let mut recommended_candidates = Vec::new();

    for candidate in candidates {
        if include_applied_only && !candidate.has_applied {
            continue;
        }

        // Calculate match score
        let score_breakdown = MatchingService::calculate_match_score(
            &state.db,
            job_id,
            candidate.user_id,
        )
        .await?;

        if score_breakdown.total_score < min_score {
            continue;
        }

        // Create profile struct
        let profile = crate::models::profile::JobSeekerProfile {
            user_id: candidate.profile_user_id,
            phone: candidate.phone,
            date_of_birth: candidate.date_of_birth,
            gender: candidate.gender.and_then(|g| match g.as_str() {
                "male" => Some(crate::models::profile::Gender::Male),
                "female" => Some(crate::models::profile::Gender::Female),
                "non_binary" => Some(crate::models::profile::Gender::NonBinary),
                "prefer_not_to_say" => Some(crate::models::profile::Gender::PreferNotToSay),
                _ => None,
            }),
            marital_status: candidate.marital_status.and_then(|m| match m.as_str() {
                "single" => Some(crate::models::profile::MaritalStatus::Single),
                "married" => Some(crate::models::profile::MaritalStatus::Married),
                "divorced" => Some(crate::models::profile::MaritalStatus::Divorced),
                "widowed" => Some(crate::models::profile::MaritalStatus::Widowed),
                "domestic_partnership" => Some(crate::models::profile::MaritalStatus::DomesticPartnership),
                _ => None,
            }),
            nationality: candidate.nationality,
            national_id: None, // Don't expose this
            region_id: candidate.region_id,
            municipality_id: candidate.municipality_id,
            address: None, // Don't expose this
            bio: candidate.bio,
            professional_headline: candidate.professional_headline,
            profile_image_url: candidate.profile_image_url,
            cv_url: candidate.cv_url,
            completeness_percentage: candidate.completeness_percentage,
            created_at: candidate.profile_created_at,
            updated_at: candidate.profile_updated_at,
        };

        // Only show email if candidate has applied
        let user_email = if candidate.has_applied {
            Some(candidate.user_email)
        } else {
            None
        };

        recommended_candidates.push(RecommendedCandidate {
            profile,
            user_name: candidate.user_name,
            user_email,
            match_score: score_breakdown.total_score,
            score_breakdown,
            has_applied: candidate.has_applied,
        });
    }

    // Sort by match score descending, then by whether they've applied
    recommended_candidates.sort_by(|a, b| {
        match b.has_applied.cmp(&a.has_applied) {
            std::cmp::Ordering::Equal => b.match_score.cmp(&a.match_score),
            other => other,
        }
    });

    let total_count = recommended_candidates.len() as i64;
    let has_more = (offset + limit) < total_count;

    // Apply pagination
    let candidates: Vec<RecommendedCandidate> = recommended_candidates
        .into_iter()
        .skip(offset as usize)
        .take(limit as usize)
        .collect();

    Ok(Json(RecommendedCandidatesResponse {
        candidates,
        total_count,
        has_more,
    }))
}
