use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use ts_rs::TS;
use chrono::{DateTime, Utc, NaiveDate};

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct Job {
    pub id: i32,
    pub company_id: i32,
    pub category_id: Option<i32>,
    pub region_id: Option<i32>,
    pub title: String,
    pub description: String,
    pub requirements: Option<String>,
    pub benefits: Option<String>,
    pub salary_min: Option<i32>,
    pub salary_max: Option<i32>,
    pub salary_currency: Option<String>,
    pub employment_type: Option<String>,
    pub vacancies: i32,
    pub application_deadline: Option<NaiveDate>,
    pub status: String,
    pub views_count: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub published_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, FromRow, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct JobWithCompany {
    pub id: i32,
    pub company_id: i32,
    pub category_id: Option<i32>,
    pub region_id: Option<i32>,
    pub title: String,
    pub description: String,
    pub requirements: Option<String>,
    pub benefits: Option<String>,
    pub salary_min: Option<i32>,
    pub salary_max: Option<i32>,
    pub salary_currency: Option<String>,
    pub employment_type: Option<String>,
    pub vacancies: i32,
    pub application_deadline: Option<NaiveDate>,
    pub status: String,
    pub views_count: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub published_at: Option<DateTime<Utc>>,
    pub company_name: String,
    pub company_logo: Option<String>,
    pub category_name: Option<String>,
    pub region_name: Option<String>,
}

#[derive(Debug, Deserialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct JobListQuery {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    pub category_id: Option<i32>,
    pub region_id: Option<i32>,
    pub search: Option<String>,
}

#[derive(Debug, Serialize, TS)]
#[ts(export, export_to = "../frontend/src/types/")]
pub struct JobListResponse {
    pub jobs: Vec<JobWithCompany>,
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
    pub total_pages: i64,
}
