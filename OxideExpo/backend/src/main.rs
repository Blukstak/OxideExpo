use axum::{middleware, routing::{get, post, put}, Router};
use empleos_inclusivos_backend::{
    config::Config,
    handlers::{self, auth, profile},
    middleware::require_auth,
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

    // Build router (V1: Infrastructure + Reference Data, V2: Auth, V3: Profiles, V4: Companies)
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
