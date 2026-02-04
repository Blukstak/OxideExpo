use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use ts_rs::TS;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct User {
    pub id: i32,
    pub email: String,
    #[serde(skip_serializing)]
    #[ts(skip)]
    pub password_hash: String,
    pub nombre: String,
    pub apellidos: String,
    pub rut: String,
    pub telefono: Option<String>,
    pub region_id: Option<i32>,
    pub user_type: String,
    pub status: String,
    pub email_verified: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, Serialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct RegisterRequest {
    pub email: String,
    pub password: String,
    pub nombre: String,
    pub apellidos: String,
    pub rut: String,
    pub telefono: Option<String>,
    pub region_id: Option<i32>,
}

#[derive(Debug, Deserialize, Serialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Serialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct AuthResponse {
    pub user: User,
    pub token: String,
    pub expires_at: DateTime<Utc>,
}
