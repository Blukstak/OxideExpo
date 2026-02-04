use crate::models::reference::*;
use crate::AppState;
use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Generic list response wrapper
#[derive(Serialize)]
pub struct ListResponse<T> {
    pub data: Vec<T>,
    pub total: usize,
}

impl<T> ListResponse<T> {
    pub fn new(data: Vec<T>) -> Self {
        let total = data.len();
        Self { data, total }
    }
}

/// Query parameters for region filtering
#[derive(Deserialize)]
pub struct RegionQuery {
    pub country_id: Option<Uuid>,
}

/// Query parameters for municipality filtering
#[derive(Deserialize)]
pub struct MunicipalityQuery {
    pub region_id: Option<Uuid>,
}

/// Query parameters for skills filtering
#[derive(Deserialize)]
pub struct SkillQuery {
    pub category_id: Option<Uuid>,
}

/// GET /api/reference/countries
pub async fn list_countries(
    State(state): State<AppState>,
) -> Result<Json<ListResponse<Country>>, (StatusCode, String)> {
    let countries = sqlx::query_as::<_, Country>(
        r#"
        SELECT id, name, iso_code, phone_code, is_active, created_at
        FROM countries
        WHERE is_active = true
        ORDER BY name
        "#,
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(ListResponse::new(countries)))
}

/// GET /api/reference/regions
pub async fn list_regions(
    State(state): State<AppState>,
    Query(query): Query<RegionQuery>,
) -> Result<Json<ListResponse<Region>>, (StatusCode, String)> {
    let regions = if let Some(country_id) = query.country_id {
        sqlx::query_as::<_, Region>(
            r#"
            SELECT id, country_id, name, code, sort_order, is_active, created_at
            FROM regions
            WHERE is_active = true AND country_id = $1
            ORDER BY sort_order, name
            "#,
        )
        .bind(country_id)
        .fetch_all(&state.db)
        .await
    } else {
        sqlx::query_as::<_, Region>(
            r#"
            SELECT id, country_id, name, code, sort_order, is_active, created_at
            FROM regions
            WHERE is_active = true
            ORDER BY sort_order, name
            "#,
        )
        .fetch_all(&state.db)
        .await
    }
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(ListResponse::new(regions)))
}

/// GET /api/reference/municipalities
pub async fn list_municipalities(
    State(state): State<AppState>,
    Query(query): Query<MunicipalityQuery>,
) -> Result<Json<ListResponse<Municipality>>, (StatusCode, String)> {
    let municipalities = if let Some(region_id) = query.region_id {
        sqlx::query_as::<_, Municipality>(
            r#"
            SELECT id, region_id, name, is_active, created_at
            FROM municipalities
            WHERE is_active = true AND region_id = $1
            ORDER BY name
            "#,
        )
        .bind(region_id)
        .fetch_all(&state.db)
        .await
    } else {
        sqlx::query_as::<_, Municipality>(
            r#"
            SELECT id, region_id, name, is_active, created_at
            FROM municipalities
            WHERE is_active = true
            ORDER BY name
            "#,
        )
        .fetch_all(&state.db)
        .await
    }
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(ListResponse::new(municipalities)))
}

/// GET /api/reference/industries
pub async fn list_industries(
    State(state): State<AppState>,
) -> Result<Json<ListResponse<Industry>>, (StatusCode, String)> {
    let industries = sqlx::query_as::<_, Industry>(
        r#"
        SELECT id, name, description, is_active, sort_order, created_at
        FROM industries
        WHERE is_active = true
        ORDER BY sort_order, name
        "#,
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(ListResponse::new(industries)))
}

/// GET /api/reference/work-areas
pub async fn list_work_areas(
    State(state): State<AppState>,
) -> Result<Json<ListResponse<WorkArea>>, (StatusCode, String)> {
    let work_areas = sqlx::query_as::<_, WorkArea>(
        r#"
        SELECT id, name, description, is_active, sort_order, created_at
        FROM work_areas
        WHERE is_active = true
        ORDER BY sort_order, name
        "#,
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(ListResponse::new(work_areas)))
}

/// GET /api/reference/position-levels
pub async fn list_position_levels(
    State(state): State<AppState>,
) -> Result<Json<ListResponse<PositionLevel>>, (StatusCode, String)> {
    let levels = sqlx::query_as::<_, PositionLevel>(
        r#"
        SELECT id, name, seniority_rank, is_active, created_at
        FROM position_levels
        WHERE is_active = true
        ORDER BY seniority_rank
        "#,
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(ListResponse::new(levels)))
}

/// GET /api/reference/career-fields
pub async fn list_career_fields(
    State(state): State<AppState>,
) -> Result<Json<ListResponse<CareerField>>, (StatusCode, String)> {
    let fields = sqlx::query_as::<_, CareerField>(
        r#"
        SELECT id, name, education_level::text, is_active, created_at
        FROM career_fields
        WHERE is_active = true
        ORDER BY name
        "#,
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(ListResponse::new(fields)))
}

/// GET /api/reference/institutions
pub async fn list_institutions(
    State(state): State<AppState>,
) -> Result<Json<ListResponse<Institution>>, (StatusCode, String)> {
    let institutions = sqlx::query_as::<_, Institution>(
        r#"
        SELECT id, name, country_id, institution_type, is_active, created_at
        FROM institutions
        WHERE is_active = true
        ORDER BY name
        "#,
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(ListResponse::new(institutions)))
}

/// GET /api/reference/languages
pub async fn list_languages(
    State(state): State<AppState>,
) -> Result<Json<ListResponse<Language>>, (StatusCode, String)> {
    let languages = sqlx::query_as::<_, Language>(
        r#"
        SELECT id, name, iso_code, is_active, created_at
        FROM languages
        WHERE is_active = true
        ORDER BY name
        "#,
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(ListResponse::new(languages)))
}

/// GET /api/reference/skill-categories
pub async fn list_skill_categories(
    State(state): State<AppState>,
) -> Result<Json<ListResponse<SkillCategory>>, (StatusCode, String)> {
    let categories = sqlx::query_as::<_, SkillCategory>(
        r#"
        SELECT id, name, description, sort_order, created_at
        FROM skill_categories
        ORDER BY sort_order, name
        "#,
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(ListResponse::new(categories)))
}

/// GET /api/reference/skills
pub async fn list_skills(
    State(state): State<AppState>,
    Query(query): Query<SkillQuery>,
) -> Result<Json<ListResponse<SkillWithCategory>>, (StatusCode, String)> {
    let skills = if let Some(category_id) = query.category_id {
        sqlx::query_as::<_, SkillWithCategory>(
            r#"
            SELECT s.id, s.category_id, c.name as category_name, s.name, s.is_active
            FROM skills s
            LEFT JOIN skill_categories c ON s.category_id = c.id
            WHERE s.is_active = true AND s.category_id = $1
            ORDER BY s.name
            "#,
        )
        .bind(category_id)
        .fetch_all(&state.db)
        .await
    } else {
        sqlx::query_as::<_, SkillWithCategory>(
            r#"
            SELECT s.id, s.category_id, c.name as category_name, s.name, s.is_active
            FROM skills s
            LEFT JOIN skill_categories c ON s.category_id = c.id
            WHERE s.is_active = true
            ORDER BY c.sort_order, c.name, s.name
            "#,
        )
        .fetch_all(&state.db)
        .await
    }
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(ListResponse::new(skills)))
}
