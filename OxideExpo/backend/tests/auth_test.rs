mod common;

use empleos_inclusivos_backend::{handlers, models::*, AppState};
use axum::{
    body::Body,
    http::{Request, StatusCode},
    Router,
    routing::post,
};
use tower::ServiceExt;
use serde_json::json;

async fn create_test_app(pool: sqlx::PgPool) -> Router {
    let state = AppState { db: pool };

    Router::new()
        .route("/auth/register", post(handlers::register))
        .route("/auth/login", post(handlers::login))
        .with_state(state)
}

#[tokio::test]
async fn test_register_success() {
    let pool = common::setup_test_db().await;
    let app = create_test_app(pool).await;

    let payload = json!({
        "email": "newuser@test.com",
        "password": "SecurePass123",
        "nombre": "New",
        "apellidos": "User",
        "rut": "11111111-1"
    });

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/auth/register")
                .header("content-type", "application/json")
                .body(Body::from(serde_json::to_string(&payload).unwrap()))
                .unwrap()
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let auth_response: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert!(auth_response["token"].is_string());
    assert_eq!(auth_response["user"]["email"], "newuser@test.com");
}

#[tokio::test]
async fn test_register_duplicate_email() {
    let pool = common::setup_test_db().await;
    let app = create_test_app(pool.clone()).await;

    // Create first user
    let payload = json!({
        "email": "duplicate@test.com",
        "password": "SecurePass123",
        "nombre": "First",
        "apellidos": "User",
        "rut": "11111111-1"
    });

    let _ = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/auth/register")
                .header("content-type", "application/json")
                .body(Body::from(serde_json::to_string(&payload).unwrap()))
                .unwrap()
        )
        .await
        .unwrap();

    // Try to create second user with same email
    let payload2 = json!({
        "email": "duplicate@test.com",
        "password": "AnotherPass456",
        "nombre": "Second",
        "apellidos": "User",
        "rut": "22222222-2"
    });

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/auth/register")
                .header("content-type", "application/json")
                .body(Body::from(serde_json::to_string(&payload2).unwrap()))
                .unwrap()
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_login_success() {
    let pool = common::setup_test_db().await;

    // Hash password for test user
    let password_hash = bcrypt::hash("TestPassword123", bcrypt::DEFAULT_COST).unwrap();
    common::create_test_user(&pool, "testuser@test.com", &password_hash).await;

    let app = create_test_app(pool).await;

    let payload = json!({
        "email": "testuser@test.com",
        "password": "TestPassword123"
    });

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/auth/login")
                .header("content-type", "application/json")
                .body(Body::from(serde_json::to_string(&payload).unwrap()))
                .unwrap()
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let auth_response: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert!(auth_response["token"].is_string());
    assert_eq!(auth_response["user"]["email"], "testuser@test.com");
}

#[tokio::test]
async fn test_login_wrong_password() {
    let pool = common::setup_test_db().await;

    let password_hash = bcrypt::hash("CorrectPassword", bcrypt::DEFAULT_COST).unwrap();
    common::create_test_user(&pool, "user@test.com", &password_hash).await;

    let app = create_test_app(pool).await;

    let payload = json!({
        "email": "user@test.com",
        "password": "WrongPassword"
    });

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/auth/login")
                .header("content-type", "application/json")
                .body(Body::from(serde_json::to_string(&payload).unwrap()))
                .unwrap()
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_login_nonexistent_user() {
    let pool = common::setup_test_db().await;
    let app = create_test_app(pool).await;

    let payload = json!({
        "email": "nonexistent@test.com",
        "password": "SomePassword"
    });

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/auth/login")
                .header("content-type", "application/json")
                .body(Body::from(serde_json::to_string(&payload).unwrap()))
                .unwrap()
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}
