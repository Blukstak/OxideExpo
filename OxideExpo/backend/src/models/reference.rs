use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use ts_rs::TS;
use uuid::Uuid;

/// Country reference data
#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export)]
pub struct Country {
    pub id: Uuid,
    pub name: String,
    pub iso_code: String,
    pub phone_code: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}

/// Region reference data (e.g., Chilean regions)
#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export)]
pub struct Region {
    pub id: Uuid,
    pub country_id: Uuid,
    pub name: String,
    pub code: Option<String>,
    pub sort_order: i32,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}

/// Municipality reference data (comunas)
#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export)]
pub struct Municipality {
    pub id: Uuid,
    pub region_id: Uuid,
    pub name: String,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}

/// Industry reference data
#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export)]
pub struct Industry {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub is_active: bool,
    pub sort_order: i32,
    pub created_at: DateTime<Utc>,
}

/// Work area reference data
#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export)]
pub struct WorkArea {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub is_active: bool,
    pub sort_order: i32,
    pub created_at: DateTime<Utc>,
}

/// Position level reference data
#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export)]
pub struct PositionLevel {
    pub id: Uuid,
    pub name: String,
    pub seniority_rank: i32,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}

/// Career field reference data
#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export)]
pub struct CareerField {
    pub id: Uuid,
    pub name: String,
    pub education_level: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}

/// Institution reference data
#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export)]
pub struct Institution {
    pub id: Uuid,
    pub name: String,
    pub country_id: Option<Uuid>,
    pub institution_type: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}

/// Language reference data
#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export)]
pub struct Language {
    pub id: Uuid,
    pub name: String,
    pub iso_code: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}

/// Skill category reference data
#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export)]
pub struct SkillCategory {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub sort_order: i32,
    pub created_at: DateTime<Utc>,
}

/// Skill reference data
#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export)]
pub struct Skill {
    pub id: Uuid,
    pub category_id: Option<Uuid>,
    pub name: String,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}

/// Skill with category name for API responses
#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export)]
pub struct SkillWithCategory {
    pub id: Uuid,
    pub category_id: Option<Uuid>,
    pub category_name: Option<String>,
    pub name: String,
    pub is_active: bool,
}
