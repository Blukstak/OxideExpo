pub mod error;
pub mod handlers;
pub mod middleware;
pub mod models;
pub mod utils;

use sqlx::PgPool;

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
}
