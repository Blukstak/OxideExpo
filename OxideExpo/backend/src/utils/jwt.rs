use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use rand::Rng;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::config::Config;
use crate::models::user::UserType;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    /// Subject (user ID as UUID string)
    pub sub: String,
    /// User email
    pub email: String,
    /// User type
    pub user_type: String,
    /// Expiration time (Unix timestamp)
    pub exp: usize,
    /// Issued at (Unix timestamp)
    pub iat: usize,
    /// JWT ID for blacklisting
    pub jti: String,
}

impl Claims {
    pub fn user_id(&self) -> Result<Uuid, uuid::Error> {
        Uuid::parse_str(&self.sub)
    }
}

/// Creates a JWT access token for the given user
pub fn create_access_token(
    user_id: Uuid,
    email: &str,
    user_type: UserType,
    config: &Config,
) -> Result<(String, i64), jsonwebtoken::errors::Error> {
    let now = Utc::now();
    let expiration = now
        .checked_add_signed(Duration::seconds(config.jwt_access_expiry))
        .expect("valid timestamp")
        .timestamp();

    let jti = Uuid::new_v4().to_string();

    let user_type_str = match user_type {
        UserType::JobSeeker => "job_seeker",
        UserType::CompanyMember => "company_member",
        UserType::OmilMember => "omil_member",
        UserType::Admin => "admin",
    };

    let claims = Claims {
        sub: user_id.to_string(),
        email: email.to_string(),
        user_type: user_type_str.to_string(),
        exp: expiration as usize,
        iat: now.timestamp() as usize,
        jti,
    };

    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(config.jwt_secret.as_bytes()),
    )?;

    Ok((token, config.jwt_access_expiry))
}

/// Verifies a JWT access token and returns the claims
pub fn verify_access_token(token: &str, config: &Config) -> Result<Claims, jsonwebtoken::errors::Error> {
    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(config.jwt_secret.as_bytes()),
        &Validation::default(),
    )?;

    Ok(token_data.claims)
}

/// Generates a cryptographically secure random refresh token (64-character hex string)
pub fn create_refresh_token() -> String {
    let mut rng = rand::thread_rng();
    let bytes: [u8; 32] = rng.gen();
    hex::encode(bytes)
}

/// Hashes a token using SHA256 for secure storage
pub fn hash_token(token: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(token.as_bytes());
    hex::encode(hasher.finalize())
}

// ============================================================================
// IMPERSONATION TOKENS (V10)
// ============================================================================

/// Claims for impersonation tokens - allows OMIL staff to edit job seeker profiles
#[derive(Debug, Serialize, Deserialize)]
pub struct ImpersonationClaims {
    /// Subject (job seeker user ID)
    pub sub: String,
    /// The OMIL member who is impersonating
    pub omil_actor: String,
    /// The OMIL organization ID
    pub omil_id: String,
    /// Token scope - currently only "profile_edit" supported
    pub scope: String,
    /// Expiration time (Unix timestamp)
    pub exp: usize,
    /// Issued at (Unix timestamp)
    pub iat: usize,
    /// JWT ID for tracking/revocation
    pub jti: String,
}

impl ImpersonationClaims {
    pub fn job_seeker_id(&self) -> Result<Uuid, uuid::Error> {
        Uuid::parse_str(&self.sub)
    }

    pub fn omil_actor_id(&self) -> Result<Uuid, uuid::Error> {
        Uuid::parse_str(&self.omil_actor)
    }

    pub fn jti_uuid(&self) -> Result<Uuid, uuid::Error> {
        Uuid::parse_str(&self.jti)
    }
}

/// Creates an impersonation token for OMIL staff to edit a job seeker's profile
/// Token is valid for 30 minutes
pub fn create_impersonation_token(
    job_seeker_id: Uuid,
    omil_actor_id: Uuid,
    omil_id: Uuid,
    config: &Config,
) -> Result<(String, Uuid, chrono::DateTime<Utc>), jsonwebtoken::errors::Error> {
    let now = Utc::now();
    let expires_at = now
        .checked_add_signed(Duration::minutes(30))
        .expect("valid timestamp");

    let jti = Uuid::new_v4();

    let claims = ImpersonationClaims {
        sub: job_seeker_id.to_string(),
        omil_actor: omil_actor_id.to_string(),
        omil_id: omil_id.to_string(),
        scope: "profile_edit".to_string(),
        exp: expires_at.timestamp() as usize,
        iat: now.timestamp() as usize,
        jti: jti.to_string(),
    };

    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(config.jwt_secret.as_bytes()),
    )?;

    Ok((token, jti, expires_at))
}

/// Verifies an impersonation token and returns the claims
pub fn verify_impersonation_token(
    token: &str,
    config: &Config,
) -> Result<ImpersonationClaims, jsonwebtoken::errors::Error> {
    let token_data = decode::<ImpersonationClaims>(
        token,
        &DecodingKey::from_secret(config.jwt_secret.as_bytes()),
        &Validation::default(),
    )?;

    // Verify scope
    if token_data.claims.scope != "profile_edit" {
        return Err(jsonwebtoken::errors::Error::from(
            jsonwebtoken::errors::ErrorKind::InvalidToken,
        ));
    }

    Ok(token_data.claims)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_refresh_token_length() {
        let token = create_refresh_token();
        assert_eq!(token.len(), 64);
    }

    #[test]
    fn test_create_refresh_token_uniqueness() {
        let token1 = create_refresh_token();
        let token2 = create_refresh_token();
        assert_ne!(token1, token2);
    }

    #[test]
    fn test_hash_token_consistency() {
        let token = "test_token";
        let hash1 = hash_token(token);
        let hash2 = hash_token(token);
        assert_eq!(hash1, hash2);
    }

    #[test]
    fn test_hash_token_length() {
        let token = "test_token";
        let hash = hash_token(token);
        assert_eq!(hash.len(), 64); // SHA256 produces 32 bytes = 64 hex chars
    }
}
