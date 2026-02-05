// V1: Infrastructure & Reference Data
pub mod config;
pub mod handlers;
pub mod models;
pub mod services;

// V2: Authentication
pub mod error;
pub mod middleware;
pub mod utils;

use aws_sdk_s3::Client as S3Client;
use config::Config;
use redis::aio::ConnectionManager;
use services::email::EmailService;
use services::storage::StorageService;
use sqlx::PgPool;
use std::sync::Arc;

/// Application state shared across all handlers
#[derive(Clone)]
pub struct AppState {
    /// PostgreSQL connection pool
    pub db: PgPool,

    /// Redis connection manager for caching and token blacklist
    pub redis: ConnectionManager,

    /// S3 client for file storage (MinIO in development)
    pub s3: S3Client,

    /// Email service for sending transactional emails
    pub email: EmailService,

    /// V9: Storage service using object_store for S3/MinIO/R2 compatibility
    pub storage: Option<StorageService>,

    /// Application configuration
    pub config: Arc<Config>,
}

impl AppState {
    pub async fn new(config: Config) -> Result<Self, Box<dyn std::error::Error>> {
        // Initialize database pool
        tracing::info!("Connecting to PostgreSQL...");
        let db = sqlx::postgres::PgPoolOptions::new()
            .max_connections(config.database_max_connections)
            .connect(&config.database_url)
            .await?;

        // Run migrations
        tracing::info!("Running database migrations...");
        sqlx::migrate!("./migrations").run(&db).await?;

        // Initialize Redis connection
        tracing::info!("Connecting to Redis...");
        let redis_client = redis::Client::open(config.redis_url.clone())?;
        let redis = ConnectionManager::new(redis_client).await?;

        // Initialize S3 client (MinIO compatible)
        tracing::info!("Initializing S3 client...");
        let s3 = aws_sdk_s3::Client::from_conf(
            aws_sdk_s3::Config::builder()
                .behavior_version(aws_sdk_s3::config::BehaviorVersion::latest())
                .credentials_provider(aws_sdk_s3::config::Credentials::new(
                    &config.s3_access_key,
                    &config.s3_secret_key,
                    None,
                    None,
                    "static",
                ))
                .region(aws_sdk_s3::config::Region::new(config.s3_region.clone()))
                .endpoint_url(&config.s3_endpoint)
                .force_path_style(true) // Required for MinIO
                .build(),
        );

        // Initialize email service
        tracing::info!("Initializing email service...");
        let email = EmailService::new(&config)?;

        // Initialize storage service (object_store based)
        tracing::info!("Initializing storage service...");
        let storage = match StorageService::new(
            &config.s3_endpoint,
            &config.s3_bucket,
            &config.s3_access_key,
            &config.s3_secret_key,
            &config.s3_region,
            Some(config.s3_public_url.clone()),
        ) {
            Ok(s) => {
                tracing::info!("Storage service initialized successfully");
                Some(s)
            }
            Err(e) => {
                tracing::warn!("Storage service initialization failed: {:?}. File uploads will be unavailable.", e);
                None
            }
        };

        let config = Arc::new(config);

        Ok(Self {
            db,
            redis,
            s3,
            email,
            storage,
            config,
        })
    }
}
