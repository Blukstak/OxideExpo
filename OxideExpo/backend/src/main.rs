use empleos_inclusivos_backend::{handlers, middleware, AppState};
use axum::{
    middleware as axum_middleware,
    routing::{get, post},
    Router,
};
use tower_http::cors::CorsLayer;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive(tracing::Level::INFO.into()),
        )
        .init();

    // Load environment variables
    dotenvy::dotenv().ok();

    // Initialize database connection pool
    let database_url = std::env::var("DATABASE_URL")?;
    tracing::info!("Connecting to database...");
    let pool = sqlx::PgPool::connect(&database_url).await?;

    // Run migrations
    tracing::info!("Running migrations...");
    sqlx::migrate!("./migrations").run(&pool).await?;

    // Build application state
    let app_state = AppState { db: pool };

    // Protected routes (require authentication)
    let protected_routes = Router::new()
        .route("/api/auth/me", get(handlers::me))
        .route("/api/applications", post(handlers::create_application))
        .route("/api/applications/my", get(handlers::my_applications))
        .route_layer(axum_middleware::from_fn(middleware::require_auth));

    // Build router
    let app = Router::new()
        // Health check
        .route("/health", get(|| async { "OK" }))

        // Public routes
        .route("/api/jobs", get(handlers::list_jobs))
        .route("/api/jobs/{id}", get(handlers::get_job))

        // Auth routes
        .route("/api/auth/register", post(handlers::register))
        .route("/api/auth/login", post(handlers::login))

        // Merge protected routes
        .merge(protected_routes)

        // CORS middleware
        .layer(CorsLayer::permissive())

        // Application state
        .with_state(app_state);

    // Start server
    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080").await?;
    tracing::info!("Server listening on {}", listener.local_addr()?);
    axum::serve(listener, app).await?;

    Ok(())
}
