use std::env;

#[derive(Clone, Debug)]
pub struct Config {
    // Application
    pub app_env: String,
    pub app_port: u16,
    pub app_base_url: String,
    pub frontend_url: String,

    // Database
    pub database_url: String,
    pub database_max_connections: u32,

    // Redis
    pub redis_url: String,

    // JWT
    pub jwt_secret: String,
    pub jwt_access_expiry: i64,
    pub jwt_refresh_expiry: i64,

    // OAuth (optional in development)
    pub google_client_id: Option<String>,
    pub google_client_secret: Option<String>,
    pub linkedin_client_id: Option<String>,
    pub linkedin_client_secret: Option<String>,

    // Storage (S3/MinIO)
    pub s3_endpoint: String,
    pub s3_access_key: String,
    pub s3_secret_key: String,
    pub s3_bucket: String,
    pub s3_region: String,
    pub s3_public_url: String,

    // Email
    pub smtp_host: String,
    pub smtp_port: u16,
    pub smtp_user: Option<String>,
    pub smtp_password: Option<String>,
    pub smtp_from: String,
}

impl Config {
    pub fn from_env() -> Result<Self, ConfigError> {
        Ok(Config {
            // Application
            app_env: env::var("APP_ENV").unwrap_or_else(|_| "development".to_string()),
            app_port: env::var("APP_PORT")
                .unwrap_or_else(|_| "3000".to_string())
                .parse()
                .map_err(|_| ConfigError::InvalidValue("APP_PORT".to_string()))?,
            app_base_url: env::var("APP_BASE_URL")
                .unwrap_or_else(|_| "http://localhost:3000".to_string()),
            frontend_url: env::var("FRONTEND_URL")
                .unwrap_or_else(|_| "http://localhost:3001".to_string()),

            // Database
            database_url: env::var("DATABASE_URL")
                .map_err(|_| ConfigError::Missing("DATABASE_URL".to_string()))?,
            database_max_connections: env::var("DATABASE_MAX_CONNECTIONS")
                .unwrap_or_else(|_| "10".to_string())
                .parse()
                .map_err(|_| ConfigError::InvalidValue("DATABASE_MAX_CONNECTIONS".to_string()))?,

            // Redis
            redis_url: env::var("REDIS_URL")
                .unwrap_or_else(|_| "redis://localhost:6379".to_string()),

            // JWT
            jwt_secret: env::var("JWT_SECRET")
                .map_err(|_| ConfigError::Missing("JWT_SECRET".to_string()))?,
            jwt_access_expiry: env::var("JWT_ACCESS_EXPIRY")
                .unwrap_or_else(|_| "900".to_string())
                .parse()
                .map_err(|_| ConfigError::InvalidValue("JWT_ACCESS_EXPIRY".to_string()))?,
            jwt_refresh_expiry: env::var("JWT_REFRESH_EXPIRY")
                .unwrap_or_else(|_| "604800".to_string())
                .parse()
                .map_err(|_| ConfigError::InvalidValue("JWT_REFRESH_EXPIRY".to_string()))?,

            // OAuth (optional)
            google_client_id: env::var("GOOGLE_CLIENT_ID").ok().filter(|s| !s.is_empty()),
            google_client_secret: env::var("GOOGLE_CLIENT_SECRET").ok().filter(|s| !s.is_empty()),
            linkedin_client_id: env::var("LINKEDIN_CLIENT_ID").ok().filter(|s| !s.is_empty()),
            linkedin_client_secret: env::var("LINKEDIN_CLIENT_SECRET").ok().filter(|s| !s.is_empty()),

            // Storage (S3/MinIO)
            s3_endpoint: env::var("S3_ENDPOINT")
                .unwrap_or_else(|_| "http://localhost:9000".to_string()),
            s3_access_key: env::var("S3_ACCESS_KEY")
                .unwrap_or_else(|_| "minioadmin".to_string()),
            s3_secret_key: env::var("S3_SECRET_KEY")
                .unwrap_or_else(|_| "minioadmin".to_string()),
            s3_bucket: env::var("S3_BUCKET")
                .unwrap_or_else(|_| "empleos-inclusivos".to_string()),
            s3_region: env::var("S3_REGION")
                .unwrap_or_else(|_| "us-east-1".to_string()),
            s3_public_url: env::var("S3_PUBLIC_URL")
                .unwrap_or_else(|_| "http://localhost:9000/empleos-inclusivos".to_string()),

            // Email
            smtp_host: env::var("SMTP_HOST")
                .unwrap_or_else(|_| "localhost".to_string()),
            smtp_port: env::var("SMTP_PORT")
                .unwrap_or_else(|_| "1025".to_string())
                .parse()
                .map_err(|_| ConfigError::InvalidValue("SMTP_PORT".to_string()))?,
            smtp_user: env::var("SMTP_USER").ok().filter(|s| !s.is_empty()),
            smtp_password: env::var("SMTP_PASSWORD").ok().filter(|s| !s.is_empty()),
            smtp_from: env::var("SMTP_FROM")
                .unwrap_or_else(|_| "noreply@empleosinclusivos.cl".to_string()),
        })
    }

    pub fn is_development(&self) -> bool {
        self.app_env == "development"
    }

    pub fn is_production(&self) -> bool {
        self.app_env == "production"
    }
}

#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("Missing required environment variable: {0}")]
    Missing(String),

    #[error("Invalid value for environment variable: {0}")]
    InvalidValue(String),
}
