mod common;

use empleos_inclusivos_backend::{handlers, AppState};
use axum::{
    body::Body,
    http::{Request, StatusCode},
    Router,
    routing::get,
};
use tower::ServiceExt;

async fn create_test_app(pool: sqlx::PgPool) -> Router {
    let state = AppState { db: pool };

    Router::new()
        .route("/jobs", get(handlers::list_jobs))
        .route("/jobs/:id", get(handlers::get_job))
        .with_state(state)
}

#[tokio::test]
async fn test_list_jobs_empty() {
    let pool = common::setup_test_db().await;
    let app = create_test_app(pool).await;

    let response = app
        .oneshot(
            Request::builder()
                .uri("/jobs")
                .body(Body::empty())
                .unwrap()
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let job_list: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(job_list["total"], 0);
    assert_eq!(job_list["jobs"].as_array().unwrap().len(), 0);
}

#[tokio::test]
async fn test_list_jobs_with_data() {
    let pool = common::setup_test_db().await;

    // Create test data
    let company_id = common::create_test_company(&pool).await;
    common::create_test_job(&pool, company_id, "Backend Developer", 1).await;
    common::create_test_job(&pool, company_id, "Frontend Developer", 1).await;

    let app = create_test_app(pool).await;

    let response = app
        .oneshot(
            Request::builder()
                .uri("/jobs")
                .body(Body::empty())
                .unwrap()
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let job_list: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(job_list["total"], 2);
    assert_eq!(job_list["jobs"].as_array().unwrap().len(), 2);
}

#[tokio::test]
async fn test_list_jobs_with_category_filter() {
    let pool = common::setup_test_db().await;

    let company_id = common::create_test_company(&pool).await;
    common::create_test_job(&pool, company_id, "Tech Job", 1).await;
    common::create_test_job(&pool, company_id, "Sales Job", 2).await;

    let app = create_test_app(pool).await;

    let response = app
        .oneshot(
            Request::builder()
                .uri("/jobs?category_id=1")
                .body(Body::empty())
                .unwrap()
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let job_list: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(job_list["total"], 1);
    assert_eq!(job_list["jobs"][0]["title"], "Tech Job");
}

#[tokio::test]
async fn test_list_jobs_with_search() {
    let pool = common::setup_test_db().await;

    let company_id = common::create_test_company(&pool).await;
    common::create_test_job(&pool, company_id, "Rust Developer", 1).await;
    common::create_test_job(&pool, company_id, "Python Developer", 1).await;

    let app = create_test_app(pool).await;

    let response = app
        .oneshot(
            Request::builder()
                .uri("/jobs?search=Rust")
                .body(Body::empty())
                .unwrap()
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let job_list: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(job_list["total"], 1);
    assert_eq!(job_list["jobs"][0]["title"], "Rust Developer");
}

#[tokio::test]
async fn test_get_job_success() {
    let pool = common::setup_test_db().await;

    let company_id = common::create_test_company(&pool).await;
    let job_id = common::create_test_job(&pool, company_id, "Test Job", 1).await;

    let app = create_test_app(pool).await;

    let response = app
        .oneshot(
            Request::builder()
                .uri(&format!("/jobs/{}", job_id))
                .body(Body::empty())
                .unwrap()
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let job: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(job["title"], "Test Job");
    assert_eq!(job["company_name"], "Test Company");
}

#[tokio::test]
async fn test_get_job_not_found() {
    let pool = common::setup_test_db().await;
    let app = create_test_app(pool).await;

    let response = app
        .oneshot(
            Request::builder()
                .uri("/jobs/99999")
                .body(Body::empty())
                .unwrap()
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_list_jobs_pagination() {
    let pool = common::setup_test_db().await;

    let company_id = common::create_test_company(&pool).await;
    for i in 1..=25 {
        common::create_test_job(&pool, company_id, &format!("Job {}", i), 1).await;
    }

    let app = create_test_app(pool).await;

    // Test first page
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/jobs?page=1&per_page=10")
                .body(Body::empty())
                .unwrap()
        )
        .await
        .unwrap();

    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let job_list: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(job_list["total"], 25);
    assert_eq!(job_list["jobs"].as_array().unwrap().len(), 10);
    assert_eq!(job_list["page"], 1);
    assert_eq!(job_list["total_pages"], 3);

    // Test second page
    let response = app
        .oneshot(
            Request::builder()
                .uri("/jobs?page=2&per_page=10")
                .body(Body::empty())
                .unwrap()
        )
        .await
        .unwrap();

    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let job_list: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(job_list["page"], 2);
    assert_eq!(job_list["jobs"].as_array().unwrap().len(), 10);
}
