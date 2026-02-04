mod common;

use empleos_inclusivos_backend::{handlers, middleware, AppState};
use axum::{
    body::Body,
    http::{Request, StatusCode, header},
    Router,
    routing::{get, post},
    middleware as axum_middleware,
};
use tower::ServiceExt;
use serde_json::json;

async fn create_test_app(pool: sqlx::PgPool) -> Router {
    let state = AppState { db: pool };

    Router::new()
        .route("/applications", post(handlers::create_application))
        .route("/applications/my", get(handlers::my_applications))
        .route_layer(axum_middleware::from_fn(middleware::require_auth))
        .with_state(state)
}

fn create_test_token(user_id: i32) -> String {
    std::env::set_var("JWT_SECRET", "test-secret");
    let (token, _) = empleos_inclusivos_backend::utils::create_jwt(
        user_id,
        "test@example.com",
        "usuario"
    ).unwrap();
    token
}

#[tokio::test]
async fn test_create_application_success() {
    let pool = common::setup_test_db().await;

    let password_hash = bcrypt::hash("password", bcrypt::DEFAULT_COST).unwrap();
    let user_id = common::create_test_user(&pool, "user@test.com", &password_hash).await;
    let company_id = common::create_test_company(&pool).await;
    let job_id = common::create_test_job(&pool, company_id, "Test Job", 1).await;

    let token = create_test_token(user_id);
    let app = create_test_app(pool).await;

    let payload = json!({
        "job_id": job_id,
        "cover_letter": "I am very interested in this position."
    });

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/applications")
                .header("content-type", "application/json")
                .header(header::AUTHORIZATION, format!("Bearer {}", token))
                .body(Body::from(serde_json::to_string(&payload).unwrap()))
                .unwrap()
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let application: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(application["job_id"], job_id);
    assert_eq!(application["user_id"], user_id);
    assert_eq!(application["status"], "pending");
}

#[tokio::test]
async fn test_create_application_without_auth() {
    let pool = common::setup_test_db().await;
    let app = create_test_app(pool).await;

    let payload = json!({
        "job_id": 1,
        "cover_letter": "Test"
    });

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/applications")
                .header("content-type", "application/json")
                .body(Body::from(serde_json::to_string(&payload).unwrap()))
                .unwrap()
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_create_application_duplicate() {
    let pool = common::setup_test_db().await;

    let password_hash = bcrypt::hash("password", bcrypt::DEFAULT_COST).unwrap();
    let user_id = common::create_test_user(&pool, "user@test.com", &password_hash).await;
    let company_id = common::create_test_company(&pool).await;
    let job_id = common::create_test_job(&pool, company_id, "Test Job", 1).await;

    let token = create_test_token(user_id);
    let app = create_test_app(pool).await;

    let payload = json!({
        "job_id": job_id,
        "cover_letter": "First application"
    });

    // First application
    let _ = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/applications")
                .header("content-type", "application/json")
                .header(header::AUTHORIZATION, format!("Bearer {}", token))
                .body(Body::from(serde_json::to_string(&payload).unwrap()))
                .unwrap()
        )
        .await
        .unwrap();

    // Duplicate application
    let payload2 = json!({
        "job_id": job_id,
        "cover_letter": "Second application (duplicate)"
    });

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/applications")
                .header("content-type", "application/json")
                .header(header::AUTHORIZATION, format!("Bearer {}", token))
                .body(Body::from(serde_json::to_string(&payload2).unwrap()))
                .unwrap()
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_create_application_nonexistent_job() {
    let pool = common::setup_test_db().await;

    let password_hash = bcrypt::hash("password", bcrypt::DEFAULT_COST).unwrap();
    let user_id = common::create_test_user(&pool, "user@test.com", &password_hash).await;

    let token = create_test_token(user_id);
    let app = create_test_app(pool).await;

    let payload = json!({
        "job_id": 99999,
        "cover_letter": "Application to non-existent job"
    });

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/applications")
                .header("content-type", "application/json")
                .header(header::AUTHORIZATION, format!("Bearer {}", token))
                .body(Body::from(serde_json::to_string(&payload).unwrap()))
                .unwrap()
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_my_applications_empty() {
    let pool = common::setup_test_db().await;

    let password_hash = bcrypt::hash("password", bcrypt::DEFAULT_COST).unwrap();
    let user_id = common::create_test_user(&pool, "user@test.com", &password_hash).await;

    let token = create_test_token(user_id);
    let app = create_test_app(pool).await;

    let response = app
        .oneshot(
            Request::builder()
                .uri("/applications/my")
                .header(header::AUTHORIZATION, format!("Bearer {}", token))
                .body(Body::empty())
                .unwrap()
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let applications: Vec<serde_json::Value> = serde_json::from_slice(&body).unwrap();

    assert_eq!(applications.len(), 0);
}

#[tokio::test]
async fn test_my_applications_with_data() {
    let pool = common::setup_test_db().await;

    let password_hash = bcrypt::hash("password", bcrypt::DEFAULT_COST).unwrap();
    let user_id = common::create_test_user(&pool, "user@test.com", &password_hash).await;
    let company_id = common::create_test_company(&pool).await;
    let job_id = common::create_test_job(&pool, company_id, "Test Job", 1).await;

    // Create application directly in DB
    sqlx::query!(
        "INSERT INTO job_applications (job_id, user_id, cover_letter, status) VALUES ($1, $2, $3, 'pending')",
        job_id,
        user_id,
        "Test cover letter"
    )
    .execute(&pool)
    .await
    .unwrap();

    let token = create_test_token(user_id);
    let app = create_test_app(pool).await;

    let response = app
        .oneshot(
            Request::builder()
                .uri("/applications/my")
                .header(header::AUTHORIZATION, format!("Bearer {}", token))
                .body(Body::empty())
                .unwrap()
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let applications: Vec<serde_json::Value> = serde_json::from_slice(&body).unwrap();

    assert_eq!(applications.len(), 1);
    assert_eq!(applications[0]["job_id"], job_id);
    assert_eq!(applications[0]["user_id"], user_id);
}
