use bytes::Bytes;
use object_store::aws::AmazonS3Builder;
use object_store::path::Path as ObjectPath;
use object_store::{ObjectStore, PutPayload};
use std::sync::Arc;
use uuid::Uuid;

use crate::error::AppError;

/// Storage service for file uploads
/// Uses object_store crate for S3/MinIO/R2 compatibility
#[derive(Clone)]
pub struct StorageService {
    store: Arc<dyn ObjectStore>,
    bucket: String,
    public_url_base: Option<String>,
}

impl StorageService {
    /// Create a new storage service
    pub fn new(
        endpoint: &str,
        bucket: &str,
        access_key: &str,
        secret_key: &str,
        region: &str,
        public_url_base: Option<String>,
    ) -> Result<Self, AppError> {
        let store = AmazonS3Builder::new()
            .with_endpoint(endpoint)
            .with_bucket_name(bucket)
            .with_access_key_id(access_key)
            .with_secret_access_key(secret_key)
            .with_region(region)
            .with_allow_http(true) // For local MinIO
            .build()
            .map_err(|e| AppError::InternalError(format!("Failed to create storage: {}", e)))?;

        Ok(Self {
            store: Arc::new(store),
            bucket: bucket.to_string(),
            public_url_base,
        })
    }

    /// Upload a file and return the storage path
    pub async fn upload(
        &self,
        folder: &str,
        filename: &str,
        content_type: &str,
        data: Bytes,
    ) -> Result<StorageResult, AppError> {
        // Generate unique path
        let file_id = Uuid::new_v4();
        let extension = filename
            .rsplit('.')
            .next()
            .unwrap_or("bin");
        let storage_path = format!("{}/{}.{}", folder, file_id, extension);
        let object_path = ObjectPath::from(storage_path.clone());

        // Upload file
        let payload = PutPayload::from_bytes(data.clone());
        self.store
            .put(&object_path, payload)
            .await
            .map_err(|e| AppError::InternalError(format!("Failed to upload file: {}", e)))?;

        Ok(StorageResult {
            storage_path,
            file_size: data.len() as i64,
            content_type: content_type.to_string(),
        })
    }

    /// Delete a file
    pub async fn delete(&self, storage_path: &str) -> Result<(), AppError> {
        let object_path = ObjectPath::from(storage_path.to_string());
        self.store
            .delete(&object_path)
            .await
            .map_err(|e| AppError::InternalError(format!("Failed to delete file: {}", e)))?;
        Ok(())
    }

    /// Get a file's content
    pub async fn get(&self, storage_path: &str) -> Result<Bytes, AppError> {
        let object_path = ObjectPath::from(storage_path.to_string());
        let result = self
            .store
            .get(&object_path)
            .await
            .map_err(|e| AppError::NotFound(format!("File not found: {}", e)))?;

        let data = result
            .bytes()
            .await
            .map_err(|e| AppError::InternalError(format!("Failed to read file: {}", e)))?;

        Ok(data)
    }

    /// Generate a public URL for a file (if public_url_base is configured)
    pub fn get_public_url(&self, storage_path: &str) -> Option<String> {
        self.public_url_base.as_ref().map(|base| {
            format!("{}/{}/{}", base, self.bucket, storage_path)
        })
    }

    /// Generate a presigned URL for temporary access
    /// Note: object_store doesn't directly support presigned URLs,
    /// so we return a direct URL or implement via signed URLs later
    pub fn get_download_url(&self, storage_path: &str) -> String {
        // For now, return the internal path - actual presigned URLs
        // would need additional implementation
        if let Some(url) = self.get_public_url(storage_path) {
            url
        } else {
            format!("/api/files/download/{}", storage_path)
        }
    }
}

/// Result of a successful upload
#[derive(Debug, Clone)]
pub struct StorageResult {
    pub storage_path: String,
    pub file_size: i64,
    pub content_type: String,
}

#[cfg(test)]
mod tests {
    // Tests would go here
}
