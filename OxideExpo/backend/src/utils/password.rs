use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};

#[derive(Debug, thiserror::Error)]
pub enum PasswordError {
    #[error("Failed to hash password: {0}")]
    HashError(String),

    #[error("Failed to verify password: {0}")]
    VerifyError(String),
}

pub fn hash_password(password: &str) -> Result<String, PasswordError> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();

    argon2
        .hash_password(password.as_bytes(), &salt)
        .map(|hash| hash.to_string())
        .map_err(|e| PasswordError::HashError(e.to_string()))
}

pub fn verify_password(password: &str, hash: &str) -> Result<bool, PasswordError> {
    let parsed_hash =
        PasswordHash::new(hash).map_err(|e| PasswordError::VerifyError(e.to_string()))?;

    Ok(Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .is_ok())
}
