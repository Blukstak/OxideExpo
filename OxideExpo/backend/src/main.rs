use axum::{middleware, routing::{get, post}, Router};
use empleos_inclusivos_backend::{
    config::Config,
    handlers::{self, auth},
    middleware::require_auth,
    AppState,
};
use tower_http::{cors::CorsLayer, trace::TraceLayer};

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

    // Build router (V1: Infrastructure + Reference Data, V2: Auth)
    let app = Router::new()
        // Health check routes
        .route("/api/health", get(handlers::health))
        .route("/api/health/ready", get(handlers::readiness))
        // Merge reference data routes
        .merge(reference_routes)
        // Merge auth routes
        .merge(auth_public_routes)
        .merge(auth_protected_routes)
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
