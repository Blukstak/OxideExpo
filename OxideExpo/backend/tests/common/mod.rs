use sqlx::PgPool;

pub async fn setup_test_db() -> PgPool {
    let database_url = std::env::var("TEST_DATABASE_URL")
        .unwrap_or_else(|_| "postgresql://postgres:postgres@localhost:5432/empleos_inclusivos_test".to_string());

    let pool = PgPool::connect(&database_url).await.unwrap();

    // Run migrations
    sqlx::migrate!("./migrations").run(&pool).await.unwrap();

    // Clear all data
    sqlx::query!("TRUNCATE users, companies, jobs, job_applications, sessions, regions, job_categories CASCADE")
        .execute(&pool)
        .await
        .unwrap();

    // Seed minimal test data
    sqlx::query!("INSERT INTO regions (id, nombre, codigo) VALUES (1, 'RM', 'RM'), (2, 'V', 'V') ON CONFLICT DO NOTHING")
        .execute(&pool)
        .await
        .unwrap();

    sqlx::query!("INSERT INTO job_categories (id, nombre) VALUES (1, 'Tech'), (2, 'Sales') ON CONFLICT DO NOTHING")
        .execute(&pool)
        .await
        .unwrap();

    pool
}

pub async fn create_test_user(pool: &PgPool, email: &str, password_hash: &str) -> i32 {
    sqlx::query_scalar!(
        r#"
        INSERT INTO users (email, password_hash, nombre, apellidos, rut, user_type, status)
        VALUES ($1, $2, 'Test', 'User', '12345678-9', 'usuario', 'T')
        RETURNING id
        "#,
        email,
        password_hash
    )
    .fetch_one(pool)
    .await
    .unwrap()
}

pub async fn create_test_company(pool: &PgPool) -> i32 {
    sqlx::query_scalar!(
        r#"
        INSERT INTO companies (razon_social, rut, email, status)
        VALUES ('Test Company', '76123456-7', 'company@test.com', 'T')
        RETURNING id
        "#
    )
    .fetch_one(pool)
    .await
    .unwrap()
}

pub async fn create_test_job(pool: &PgPool, company_id: i32, title: &str, category_id: i32) -> i32 {
    sqlx::query_scalar!(
        r#"
        INSERT INTO jobs (company_id, category_id, region_id, title, description, status, published_at)
        VALUES ($1, $2, 1, $3, 'Test job description', 'T', NOW())
        RETURNING id
        "#,
        company_id,
        category_id,
        title
    )
    .fetch_one(pool)
    .await
    .unwrap()
}
