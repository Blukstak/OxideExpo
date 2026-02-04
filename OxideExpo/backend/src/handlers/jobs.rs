use axum::{
    extract::{Path, Query, State},
    Json,
};
use crate::{
    error::{AppError, Result},
    models::{Job, JobListQuery, JobListResponse, JobWithCompany},
    AppState,
};

pub async fn list_jobs(
    State(state): State<AppState>,
    Query(params): Query<JobListQuery>,
) -> Result<Json<JobListResponse>> {
    let page = params.page.unwrap_or(1).max(1);
    let per_page = params.per_page.unwrap_or(20).min(100);
    let offset = (page - 1) * per_page;

    let mut query_builder = sqlx::QueryBuilder::new(
        r#"
        SELECT j.id, j.company_id, j.category_id, j.region_id, j.title, j.description,
               j.requirements, j.benefits, j.salary_min, j.salary_max, j.salary_currency,
               j.employment_type, j.vacancies, j.application_deadline, j.status, j.views_count,
               j.created_at, j.updated_at, j.published_at,
               c.razon_social as company_name, c.logo_url as company_logo,
               cat.nombre as category_name, r.nombre as region_name
        FROM jobs j
        INNER JOIN companies c ON j.company_id = c.id
        LEFT JOIN job_categories cat ON j.category_id = cat.id
        LEFT JOIN regions r ON j.region_id = r.id
        WHERE j.status = 'T'
        "#
    );

    // Add filters
    if let Some(category_id) = params.category_id {
        query_builder.push(" AND j.category_id = ");
        query_builder.push_bind(category_id);
    }

    if let Some(region_id) = params.region_id {
        query_builder.push(" AND j.region_id = ");
        query_builder.push_bind(region_id);
    }

    if let Some(search) = &params.search {
        let search_pattern = format!("%{}%", search);
        query_builder.push(" AND (j.title ILIKE ");
        query_builder.push_bind(&search_pattern);
        query_builder.push(" OR j.description ILIKE ");
        query_builder.push_bind(&search_pattern);
        query_builder.push(")");
    }

    query_builder.push(" ORDER BY j.published_at DESC NULLS LAST");
    query_builder.push(" LIMIT ");
    query_builder.push_bind(per_page);
    query_builder.push(" OFFSET ");
    query_builder.push_bind(offset);

    let jobs: Vec<JobWithCompany> = query_builder
        .build_query_as()
        .fetch_all(&state.db)
        .await?;

    // Count total
    let mut count_builder = sqlx::QueryBuilder::new(
        "SELECT COUNT(*) as count FROM jobs j WHERE j.status = 'T'"
    );

    if let Some(category_id) = params.category_id {
        count_builder.push(" AND j.category_id = ");
        count_builder.push_bind(category_id);
    }

    if let Some(region_id) = params.region_id {
        count_builder.push(" AND j.region_id = ");
        count_builder.push_bind(region_id);
    }

    if let Some(search) = &params.search {
        let search_pattern = format!("%{}%", search);
        count_builder.push(" AND (j.title ILIKE ");
        count_builder.push_bind(&search_pattern);
        count_builder.push(" OR j.description ILIKE ");
        count_builder.push_bind(&search_pattern);
        count_builder.push(")");
    }

    let total: (i64,) = count_builder
        .build_query_as()
        .fetch_one(&state.db)
        .await?;

    Ok(Json(JobListResponse {
        jobs,
        total: total.0,
        page,
        per_page,
        total_pages: (total.0 + per_page - 1) / per_page,
    }))
}

pub async fn get_job(
    State(state): State<AppState>,
    Path(id): Path<i32>,
) -> Result<Json<JobWithCompany>> {
    let job = sqlx::query_as!(
        JobWithCompany,
        r#"
        SELECT j.id, j.company_id, j.category_id, j.region_id, j.title, j.description,
               j.requirements, j.benefits, j.salary_min, j.salary_max, j.salary_currency,
               j.employment_type, j.vacancies, j.application_deadline, j.status, j.views_count,
               j.created_at, j.updated_at, j.published_at,
               c.razon_social as company_name, c.logo_url as company_logo,
               cat.nombre as category_name, r.nombre as region_name
        FROM jobs j
        INNER JOIN companies c ON j.company_id = c.id
        LEFT JOIN job_categories cat ON j.category_id = cat.id
        LEFT JOIN regions r ON j.region_id = r.id
        WHERE j.id = $1
        "#,
        id
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Job not found".to_string()))?;

    // Increment view count
    sqlx::query!("UPDATE jobs SET views_count = views_count + 1 WHERE id = $1", id)
        .execute(&state.db)
        .await?;

    Ok(Json(job))
}
