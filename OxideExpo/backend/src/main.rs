use axum::{middleware, routing::{get, patch, post, put}, Router};
use axum::routing::delete;
use empleos_inclusivos_backend::{
    config::Config,
    handlers::{self, auth, profile},
    middleware::{
        require_admin, require_auth, require_omil, require_omil_coordinator_or_above,
        require_omil_director,
    },
    AppState,
};
use tower_http::{cors::CorsLayer, trace::TraceLayer};

/// Validates that critical platform reference data is present
async fn validate_platform_data(state: &AppState) -> Result<(), Box<dyn std::error::Error>> {
    // Check skills
    let skills_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM skills WHERE is_active = true"
    )
    .fetch_one(&state.db)
    .await?;

    if skills_count < 10 {
        return Err(format!(
            "Platform data validation failed: Only {} skills found. Expected at least 10. \
            This indicates migration 0004 (seed reference data) may not have run. \
            Please check database migrations.",
            skills_count
        ).into());
    }

    // Check languages
    let languages_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM languages WHERE is_active = true"
    )
    .fetch_one(&state.db)
    .await?;

    if languages_count < 5 {
        return Err(format!(
            "Platform data validation failed: Only {} languages found. Expected at least 5. \
            This indicates migration 0004 (seed reference data) may not have run. \
            Please check database migrations.",
            languages_count
        ).into());
    }

    tracing::info!(
        "Platform data validation passed: {} skills, {} languages",
        skills_count,
        languages_count
    );

    Ok(())
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Load environment variables
    dotenvy::dotenv().ok();

    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive(tracing::Level::INFO.into()),
        )
        .json()
        .init();

    // Load configuration
    let config = Config::from_env()?;
    let port = config.app_port;

    tracing::info!("Starting EmpleosInclusivos backend in {} mode", config.app_env);

    // Initialize application state (DB, Redis, S3, Email)
    let app_state = AppState::new(config).await?;

    // Validate platform data (skills, languages, etc.)
    validate_platform_data(&app_state).await?;

    // Reference data routes (public)
    let reference_routes = Router::new()
        .route("/api/reference/countries", get(handlers::list_countries))
        .route("/api/reference/regions", get(handlers::list_regions))
        .route(
            "/api/reference/municipalities",
            get(handlers::list_municipalities),
        )
        .route("/api/reference/industries", get(handlers::list_industries))
        .route("/api/reference/work-areas", get(handlers::list_work_areas))
        .route(
            "/api/reference/position-levels",
            get(handlers::list_position_levels),
        )
        .route(
            "/api/reference/career-fields",
            get(handlers::list_career_fields),
        )
        .route(
            "/api/reference/institutions",
            get(handlers::list_institutions),
        )
        .route("/api/reference/languages", get(handlers::list_languages))
        .route(
            "/api/reference/skill-categories",
            get(handlers::list_skill_categories),
        )
        .route("/api/reference/skills", get(handlers::list_skills));

    // Auth routes (public)
    let auth_public_routes = Router::new()
        // Registration
        .route("/api/auth/register", post(auth::register_job_seeker))
        .route("/api/auth/register/company", post(auth::register_company))
        .route("/api/auth/register/omil", post(auth::register_omil))
        // Login/Token
        .route("/api/auth/login", post(auth::login))
        .route("/api/auth/refresh", post(auth::refresh))
        // Password reset
        .route("/api/auth/password/forgot", post(auth::forgot_password))
        .route("/api/auth/password/reset", post(auth::reset_password))
        // Email verification
        .route("/api/auth/email/verify", post(auth::verify_email))
        .route("/api/auth/email/resend", post(auth::resend_verification));

    // Auth routes (protected - require valid JWT)
    let auth_protected_routes = Router::new()
        .route("/api/auth/me", get(auth::me))
        .route("/api/auth/logout", post(auth::logout))
        .route_layer(middleware::from_fn_with_state(
            app_state.clone(),
            require_auth,
        ));

    // V3: Job Seeker Profile routes (protected)
    let profile_routes = Router::new()
        // Profile basics
        .route("/api/me/profile", get(profile::get_profile).put(profile::update_profile))
        .route("/api/me/profile/full", get(profile::get_full_profile))
        // Disability info
        .route("/api/me/disability", get(profile::get_disability).put(profile::update_disability))
        // Education
        .route("/api/me/education", get(profile::list_education).post(profile::create_education))
        .route("/api/me/education/{id}", put(profile::update_education).delete(profile::delete_education))
        // Work experience
        .route("/api/me/experience", get(profile::list_experiences).post(profile::create_experience))
        .route("/api/me/experience/{id}", put(profile::update_experience).delete(profile::delete_experience))
        // Skills
        .route("/api/me/skills", get(profile::list_skills).post(profile::create_skill))
        .route("/api/me/skills/{id}", put(profile::update_skill).delete(profile::delete_skill))
        // Languages
        .route("/api/me/languages", get(profile::list_languages).post(profile::create_language))
        .route("/api/me/languages/{id}", put(profile::update_language).delete(profile::delete_language))
        // Portfolio
        .route("/api/me/portfolio", get(profile::list_portfolio).post(profile::create_portfolio))
        .route("/api/me/portfolio/{id}", put(profile::update_portfolio).delete(profile::delete_portfolio))
        .route_layer(middleware::from_fn_with_state(
            app_state.clone(),
            require_auth,
        ));

    // V4: Company Profile routes (protected)
    let company_routes = Router::new()
        .route(
            "/api/me/company/profile",
            get(handlers::company::get_company_profile)
                .put(handlers::company::update_company_profile),
        )
        .route(
            "/api/me/company/full",
            get(handlers::company::get_full_company_profile),
        )
        .route(
            "/api/me/company/members",
            get(handlers::company::list_members),
        )
        .route(
            "/api/me/company/members/{id}",
            put(handlers::company::update_member).delete(handlers::company::remove_member),
        )
        // V12: Company Dashboard
        .route(
            "/api/me/company/dashboard",
            get(handlers::company::get_company_dashboard),
        )
        .route_layer(middleware::from_fn_with_state(
            app_state.clone(),
            require_auth,
        ));

    // V4: Public company routes (no auth required)
    let company_public_routes = Router::new()
        .route("/api/companies", get(handlers::company::list_public_companies))
        .route(
            "/api/companies/{id}",
            get(handlers::company::get_public_company),
        );

    // V5: Job Management routes (protected - company members)
    let job_routes = Router::new()
        .route(
            "/api/me/jobs",
            get(handlers::jobs::list_company_jobs).post(handlers::jobs::create_job),
        )
        .route(
            "/api/me/jobs/{id}",
            get(handlers::jobs::get_job_with_applications)
                .put(handlers::jobs::update_job)
                .delete(handlers::jobs::delete_job),
        )
        .route(
            "/api/me/jobs/{id}/status",
            patch(handlers::jobs::update_job_status),
        )
        .route(
            "/api/me/jobs/{id}/applications",
            get(handlers::jobs::list_job_applications),
        )
        .route(
            "/api/me/jobs/{job_id}/applications/{app_id}",
            put(handlers::jobs::update_application_status),
        )
        .route(
            "/api/me/jobs/{job_id}/applications/{app_id}/notes",
            post(handlers::jobs::add_application_note),
        )
        .route_layer(middleware::from_fn_with_state(
            app_state.clone(),
            require_auth,
        ));

    // V5: Application routes (protected - job seekers)
    let application_routes = Router::new()
        .route(
            "/api/me/applications",
            get(handlers::applications::list_my_applications)
                .post(handlers::applications::submit_application),
        )
        .route(
            "/api/me/applications/{id}",
            get(handlers::applications::get_application),
        )
        .route(
            "/api/me/applications/{id}/withdraw",
            patch(handlers::applications::withdraw_application),
        )
        .route_layer(middleware::from_fn_with_state(
            app_state.clone(),
            require_auth,
        ));

    // V5: Public job listings (no auth)
    let job_public_routes = Router::new()
        .route("/api/jobs", get(handlers::applications::list_public_jobs))
        .route("/api/jobs/{id}", get(handlers::applications::get_public_job));

    // V6: Admin dashboard routes (protected - admin only)
    let admin_routes = Router::new()
        // Dashboard & analytics
        .route(
            "/api/admin/dashboard/stats",
            get(handlers::admin::get_dashboard_stats),
        )
        // Company management (super admin only)
        .route(
            "/api/admin/companies/pending",
            get(handlers::admin::list_pending_companies),
        )
        .route(
            "/api/admin/companies/{id}/approve",
            patch(handlers::admin::approve_company),
        )
        .route(
            "/api/admin/companies/{id}/reject",
            patch(handlers::admin::reject_company),
        )
        // Job moderation (moderator or above)
        .route(
            "/api/admin/jobs/pending",
            get(handlers::admin::list_pending_jobs),
        )
        .route(
            "/api/admin/jobs/{id}/approve",
            patch(handlers::admin::approve_job),
        )
        .route(
            "/api/admin/jobs/{id}/reject",
            patch(handlers::admin::reject_job),
        )
        // V11: User management
        .route("/api/admin/users", get(handlers::admin::list_users))
        .route(
            "/api/admin/users/{id}",
            get(handlers::admin::get_user_detail),
        )
        .route(
            "/api/admin/users/{id}/status",
            patch(handlers::admin::update_user_status),
        )
        .route(
            "/api/admin/users/{id}/impersonate",
            get(handlers::admin::impersonate_user),
        )
        // V11: OMIL approvals
        .route(
            "/api/admin/omils/pending",
            get(handlers::admin::list_pending_omils),
        )
        .route(
            "/api/admin/omils/{id}/approve",
            patch(handlers::admin::approve_omil),
        )
        .route(
            "/api/admin/omils/{id}/reject",
            patch(handlers::admin::reject_omil),
        )
        // V11: Audit log viewer
        .route(
            "/api/admin/audit-logs",
            get(handlers::admin::list_audit_logs),
        )
        // V11: System settings
        .route(
            "/api/admin/settings",
            get(handlers::admin::get_settings).put(handlers::admin::update_settings),
        )
        // V12: Reporting
        .route(
            "/api/admin/reports/users",
            get(handlers::admin::report_users),
        )
        .route(
            "/api/admin/reports/companies",
            get(handlers::admin::report_companies),
        )
        .route(
            "/api/admin/reports/jobs",
            get(handlers::admin::report_jobs),
        )
        .route(
            "/api/admin/reports/applications",
            get(handlers::admin::report_applications),
        )
        .route(
            "/api/admin/reports/export/{report_type}",
            get(handlers::admin::export_report),
        )
        // Require authentication first, then admin privileges
        .route_layer(middleware::from_fn_with_state(
            app_state.clone(),
            require_admin,
        ))
        .route_layer(middleware::from_fn_with_state(
            app_state.clone(),
            require_auth,
        ));

    // V7: Matching routes (protected - job seekers)
    let matching_routes = Router::new()
        .route(
            "/api/me/recommended-jobs",
            get(handlers::matching::get_recommended_jobs),
        )
        .route(
            "/api/me/preferences",
            get(handlers::matching::get_preferences).put(handlers::matching::update_preferences),
        )
        .route(
            "/api/me/jobs/{id}/recommended-candidates",
            get(handlers::matching::get_recommended_candidates),
        )
        .route_layer(middleware::from_fn_with_state(
            app_state.clone(),
            require_auth,
        ));

    // V7: Job match score route (protected - job seekers)
    let match_score_routes = Router::new()
        .route(
            "/api/jobs/{id}/match-score",
            get(handlers::matching::get_job_match_score),
        )
        .route_layer(middleware::from_fn_with_state(
            app_state.clone(),
            require_auth,
        ));

    // V8: OMIL routes (protected - any OMIL member)
    let omil_routes = Router::new()
        // Organization management
        .route(
            "/api/me/omil",
            get(handlers::omil::get_omil_organization),
        )
        .route(
            "/api/me/omil/stats",
            get(handlers::omil::get_omil_stats),
        )
        // Member listing (any member can view)
        .route(
            "/api/me/omil/members",
            get(handlers::omil::list_omil_members),
        )
        // Managed job seekers
        .route(
            "/api/me/omil/job-seekers",
            get(handlers::omil::list_managed_job_seekers)
                .post(handlers::omil::register_job_seeker_on_behalf),
        )
        .route(
            "/api/me/omil/job-seekers/{id}",
            get(handlers::omil::get_managed_job_seeker),
        )
        .route(
            "/api/me/omil/job-seekers/{id}/placement",
            put(handlers::omil::update_placement),
        )
        .route(
            "/api/me/omil/job-seekers/{id}/apply",
            post(handlers::omil::apply_on_behalf),
        )
        // Followups
        .route(
            "/api/me/omil/job-seekers/{id}/followups",
            get(handlers::omil::list_followups).post(handlers::omil::create_followup),
        )
        .route(
            "/api/me/omil/followups/{id}",
            put(handlers::omil::update_followup).delete(handlers::omil::delete_followup),
        )
        // V10: Impersonation
        .route(
            "/api/me/omil/job-seekers/{id}/impersonate",
            get(handlers::omil::generate_impersonation),
        )
        // V10: Export managed seekers
        .route(
            "/api/me/omil/job-seekers/export",
            get(handlers::omil::export_managed_seekers),
        )
        // V10: List all OMIL applications
        .route(
            "/api/me/omil/applications",
            get(handlers::omil::list_omil_applications),
        )
        .route_layer(middleware::from_fn_with_state(
            app_state.clone(),
            require_omil,
        ))
        .route_layer(middleware::from_fn_with_state(
            app_state.clone(),
            require_auth,
        ));

    // V8: OMIL coordinator+ routes (protected - coordinator or director only)
    let omil_coordinator_routes = Router::new()
        .route(
            "/api/me/omil/members",
            post(handlers::omil::add_omil_member),
        )
        .route(
            "/api/me/omil/members/{id}",
            put(handlers::omil::update_omil_member),
        )
        .route(
            "/api/me/omil/job-seekers/{id}/advisor",
            put(handlers::omil::assign_advisor),
        )
        .route_layer(middleware::from_fn_with_state(
            app_state.clone(),
            require_omil_coordinator_or_above,
        ))
        .route_layer(middleware::from_fn_with_state(
            app_state.clone(),
            require_auth,
        ));

    // V8: OMIL director routes (protected - director only)
    let omil_director_routes = Router::new()
        .route(
            "/api/me/omil",
            put(handlers::omil::update_omil_organization),
        )
        .route(
            "/api/me/omil/members/{id}",
            delete(handlers::omil::remove_omil_member),
        )
        .route_layer(middleware::from_fn_with_state(
            app_state.clone(),
            require_omil_director,
        ))
        .route_layer(middleware::from_fn_with_state(
            app_state.clone(),
            require_auth,
        ));

    // V8: Job invitation routes - company side (protected - company members)
    let invitation_company_routes = Router::new()
        .route(
            "/api/me/jobs/{job_id}/invitations",
            get(handlers::invitations::list_job_invitations)
                .post(handlers::invitations::send_job_invitation),
        )
        .route_layer(middleware::from_fn_with_state(
            app_state.clone(),
            require_auth,
        ));

    // V8: Job invitation routes - job seeker side (protected - job seekers)
    let invitation_seeker_routes = Router::new()
        .route(
            "/api/me/invitations",
            get(handlers::invitations::list_my_invitations),
        )
        .route(
            "/api/me/invitations/{id}",
            get(handlers::invitations::get_invitation),
        )
        .route(
            "/api/me/invitations/{id}/respond",
            post(handlers::invitations::respond_to_invitation),
        )
        .route_layer(middleware::from_fn_with_state(
            app_state.clone(),
            require_auth,
        ));

    // V9: Enhanced Applicant Management routes (protected - company members)
    let applicant_routes = Router::new()
        .route(
            "/api/me/jobs/{id}/applicants",
            get(handlers::applicants::list_applicants),
        )
        .route(
            "/api/me/jobs/{job_id}/applicants/{app_id}/detail",
            get(handlers::applicants::get_applicant_detail),
        )
        .route(
            "/api/me/jobs/{job_id}/applicants/{app_id}/cv",
            get(handlers::applicants::get_applicant_cv),
        )
        .route(
            "/api/me/jobs/{job_id}/applicants/{app_id}/history",
            get(handlers::applicants::get_applicant_history),
        )
        .route(
            "/api/me/jobs/{id}/applicants/bulk-status",
            post(handlers::applicants::bulk_status_update),
        )
        .route(
            "/api/me/jobs/{id}/applicants/export",
            get(handlers::applicants::export_applicants),
        )
        .route_layer(middleware::from_fn_with_state(
            app_state.clone(),
            require_auth,
        ));

    // V9: Saved Jobs routes (protected - job seekers)
    let saved_jobs_routes = Router::new()
        .route(
            "/api/me/saved-jobs",
            get(handlers::saved_jobs::list_saved_jobs),
        )
        .route(
            "/api/me/saved-jobs/{job_id}",
            post(handlers::saved_jobs::save_job).delete(handlers::saved_jobs::unsave_job),
        )
        .route(
            "/api/me/saved-jobs/{job_id}/check",
            get(handlers::saved_jobs::check_job_saved),
        )
        .route_layer(middleware::from_fn_with_state(
            app_state.clone(),
            require_auth,
        ));

    // V9: File upload routes - Job seeker files (protected)
    let file_seeker_routes = Router::new()
        .route(
            "/api/me/profile/cv",
            put(handlers::files::upload_cv).delete(handlers::files::delete_cv),
        )
        .route(
            "/api/me/profile/image",
            put(handlers::files::upload_profile_image).delete(handlers::files::delete_profile_image),
        )
        .route_layer(middleware::from_fn_with_state(
            app_state.clone(),
            require_auth,
        ));

    // V9: File upload routes - Company files (protected)
    let file_company_routes = Router::new()
        .route(
            "/api/me/company/logo",
            put(handlers::files::upload_company_logo).delete(handlers::files::delete_company_logo),
        )
        .route(
            "/api/me/company/cover",
            put(handlers::files::upload_company_cover).delete(handlers::files::delete_company_cover),
        )
        .route_layer(middleware::from_fn_with_state(
            app_state.clone(),
            require_auth,
        ));

    // V9: File download route (protected - any authenticated user)
    let file_download_routes = Router::new()
        .route("/api/files/{id}", get(handlers::files::download_file))
        .route_layer(middleware::from_fn_with_state(
            app_state.clone(),
            require_auth,
        ));

    // Build router (V1-V9)
    let app = Router::new()
        // Health check routes
        .route("/api/health", get(handlers::health))
        .route("/api/health/ready", get(handlers::readiness))
        // Merge reference data routes
        .merge(reference_routes)
        // Merge auth routes
        .merge(auth_public_routes)
        .merge(auth_protected_routes)
        // Merge V3 profile routes
        .merge(profile_routes)
        // Merge V4 company routes
        .merge(company_routes)
        .merge(company_public_routes)
        // Merge V5 job and application routes
        .merge(job_routes)
        .merge(application_routes)
        .merge(job_public_routes)
        // Merge V6 admin routes
        .merge(admin_routes)
        // Merge V7 matching routes
        .merge(matching_routes)
        .merge(match_score_routes)
        // Merge V8 OMIL routes
        .merge(omil_routes)
        .merge(omil_coordinator_routes)
        .merge(omil_director_routes)
        // Merge V8 invitation routes
        .merge(invitation_company_routes)
        .merge(invitation_seeker_routes)
        // Merge V9 applicant management routes
        .merge(applicant_routes)
        // Merge V9 saved jobs routes
        .merge(saved_jobs_routes)
        // Merge V9 file upload routes
        .merge(file_seeker_routes)
        .merge(file_company_routes)
        .merge(file_download_routes)
        // Middleware layers
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::permissive())
        // Application state
        .with_state(app_state);

    // Start server
    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", port)).await?;
    tracing::info!("Server listening on {}", listener.local_addr()?);
    axum::serve(listener, app).await?;

    Ok(())
}
