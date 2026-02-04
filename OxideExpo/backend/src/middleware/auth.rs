use axum::{
    extract::Request,
    http::{StatusCode, header},
    middleware::Next,
    response::Response,
};
use crate::utils::jwt;

#[derive(Clone, Debug)]
pub struct AuthUser {
    pub id: i32,
    pub email: String,
    pub user_type: String,
}

pub async fn require_auth(
    mut request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let auth_header = request
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|header| header.to_str().ok());

    let token = match auth_header {
        Some(header) if header.starts_with("Bearer ") => {
            header.trim_start_matches("Bearer ")
        }
        _ => return Err(StatusCode::UNAUTHORIZED),
    };

    match jwt::verify_jwt(token) {
        Ok(claims) => {
            let user_id: i32 = claims.sub.parse().map_err(|_| StatusCode::UNAUTHORIZED)?;

            request.extensions_mut().insert(AuthUser {
                id: user_id,
                email: claims.email,
                user_type: claims.user_type,
            });

            Ok(next.run(request).await)
        }
        Err(_) => Err(StatusCode::UNAUTHORIZED),
    }
}
