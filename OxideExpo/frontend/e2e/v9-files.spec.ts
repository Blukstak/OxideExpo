import { test, expect } from '@playwright/test';
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Base URL for the API (backend runs on port 8080 in Docker)
const API_BASE = 'http://localhost:8080';

// Test admin credentials
const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASSWORD = 'AdminSecure123';

// Helper to generate unique test emails
const uniqueEmail = () => `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;

// Helper to login
async function login(request: any, email: string, password: string) {
  const response = await request.post(`${API_BASE}/api/auth/login`, {
    data: { email, password },
  });

  if (!response.ok()) {
    throw new Error(`Login failed: ${await response.text()}`);
  }

  const body = await response.json();
  return {
    accessToken: body.access_token,
    userId: body.user.id,
  };
}

// Helper to register a job seeker
async function registerJobSeeker(request: any) {
  const email = uniqueEmail();
  const response = await request.post(`${API_BASE}/api/auth/register`, {
    data: {
      email,
      password: 'SecurePassword123',
      first_name: 'Test',
      last_name: 'Seeker',
    },
  });

  expect(response.ok()).toBeTruthy();
  const body = await response.json();

  // Activate the account via SQL
  const activateSql = `UPDATE users SET account_status = 'active', email_verified_at = NOW() WHERE id = '${body.user.id}'`;
  execSync(`docker exec empleos_db_dev psql -U postgres -d empleos_inclusivos -c "${activateSql}"`, { encoding: 'utf8' });

  // Create job seeker profile
  const profileSql = `INSERT INTO job_seeker_profiles (user_id, phone, bio, completeness_percentage) VALUES ('${body.user.id}', '+56912345678', 'Test bio', 50) ON CONFLICT (user_id) DO NOTHING`;
  execSync(`docker exec empleos_db_dev psql -U postgres -d empleos_inclusivos -c "${profileSql}"`, { encoding: 'utf8' });

  return {
    email,
    userId: body.user.id,
    accessToken: body.access_token,
  };
}

// Helper to register a company
async function registerCompany(request: any) {
  const email = uniqueEmail();
  const response = await request.post(`${API_BASE}/api/auth/register/company`, {
    data: {
      email,
      password: 'SecurePassword123',
      first_name: 'Test',
      last_name: 'Owner',
      company_name: `Test Company ${Date.now()}`,
    },
  });

  expect(response.ok()).toBeTruthy();
  const body = await response.json();

  // Activate the account via SQL
  const activateSql = `UPDATE users SET account_status = 'active', email_verified_at = NOW() WHERE id = '${body.user.id}'`;
  execSync(`docker exec empleos_db_dev psql -U postgres -d empleos_inclusivos -c "${activateSql}"`, { encoding: 'utf8' });

  // Get company_id from the profile
  const profileResponse = await request.get(`${API_BASE}/api/me/company/profile`, {
    headers: { Authorization: `Bearer ${body.access_token}` },
  });
  const profile = await profileResponse.json();

  return {
    email,
    userId: body.user.id,
    accessToken: body.access_token,
    companyId: profile.id,
  };
}

// Helper to activate a company
function activateCompany(companyId: string, approverId: string) {
  const sql = `UPDATE company_profiles SET status = 'active'::organization_status, approved_at = NOW(), approved_by = '${approverId}' WHERE id = '${companyId}'`;
  execSync(`docker exec empleos_db_dev psql -U postgres -d empleos_inclusivos -c "${sql}"`, { encoding: 'utf8' });
}

test.describe('V9 File Uploads - Access Control', () => {
  test('Job seeker cannot upload CV without a file', async ({ request }) => {
    const seeker = await registerJobSeeker(request);

    // Try to upload without file (empty multipart)
    const response = await request.put(`${API_BASE}/api/me/profile/cv`, {
      headers: { Authorization: `Bearer ${seeker.accessToken}` },
    });

    // Should fail with validation error (no file)
    expect(response.status()).toBe(400);
  });

  test('Job seeker can delete CV (even if none exists)', async ({ request }) => {
    const seeker = await registerJobSeeker(request);

    const response = await request.delete(`${API_BASE}/api/me/profile/cv`, {
      headers: { Authorization: `Bearer ${seeker.accessToken}` },
    });

    // Should return 404 if no CV exists
    expect(response.status()).toBe(404);
  });

  test('Job seeker can delete profile image (even if none exists)', async ({ request }) => {
    const seeker = await registerJobSeeker(request);

    const response = await request.delete(`${API_BASE}/api/me/profile/image`, {
      headers: { Authorization: `Bearer ${seeker.accessToken}` },
    });

    // Should return 404 if no image exists
    expect(response.status()).toBe(404);
  });

  test('Company member cannot upload job seeker profile files', async ({ request }) => {
    const company = await registerCompany(request);

    // Create a dummy PDF for the upload attempt
    const pdfContent = Buffer.from('%PDF-1.4\ntest\n%%EOF');

    // Try to upload CV as company member
    const cvResponse = await request.put(`${API_BASE}/api/me/profile/cv`, {
      headers: { Authorization: `Bearer ${company.accessToken}` },
      multipart: {
        file: {
          name: 'test.pdf',
          mimeType: 'application/pdf',
          buffer: pdfContent,
        },
      },
    });
    expect(cvResponse.status()).toBe(403);

    // Try to upload profile image as company member
    const imageContent = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]); // PNG header
    const imageResponse = await request.put(`${API_BASE}/api/me/profile/image`, {
      headers: { Authorization: `Bearer ${company.accessToken}` },
      multipart: {
        file: {
          name: 'test.png',
          mimeType: 'image/png',
          buffer: imageContent,
        },
      },
    });
    expect(imageResponse.status()).toBe(403);
  });

  test('Job seeker cannot upload company files', async ({ request }) => {
    const seeker = await registerJobSeeker(request);

    // Create a dummy image for the upload attempt
    const imageContent = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]); // PNG header

    // Try to upload company logo as job seeker
    const logoResponse = await request.put(`${API_BASE}/api/me/company/logo`, {
      headers: { Authorization: `Bearer ${seeker.accessToken}` },
      multipart: {
        file: {
          name: 'logo.png',
          mimeType: 'image/png',
          buffer: imageContent,
        },
      },
    });
    expect(logoResponse.status()).toBe(403);

    // Try to upload company cover as job seeker
    const coverResponse = await request.put(`${API_BASE}/api/me/company/cover`, {
      headers: { Authorization: `Bearer ${seeker.accessToken}` },
      multipart: {
        file: {
          name: 'cover.png',
          mimeType: 'image/png',
          buffer: imageContent,
        },
      },
    });
    expect(coverResponse.status()).toBe(403);
  });

  test('Company member can delete company logo (even if none exists)', async ({ request }) => {
    const company = await registerCompany(request);
    const admin = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    activateCompany(company.companyId, admin.userId);

    const response = await request.delete(`${API_BASE}/api/me/company/logo`, {
      headers: { Authorization: `Bearer ${company.accessToken}` },
    });

    // Should return 404 if no logo exists
    expect(response.status()).toBe(404);
  });

  test('Company member can delete company cover (even if none exists)', async ({ request }) => {
    const company = await registerCompany(request);
    const admin = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    activateCompany(company.companyId, admin.userId);

    const response = await request.delete(`${API_BASE}/api/me/company/cover`, {
      headers: { Authorization: `Bearer ${company.accessToken}` },
    });

    // Should return 404 if no cover exists
    expect(response.status()).toBe(404);
  });

  test('File download requires authentication', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/files/00000000-0000-0000-0000-000000000000`);
    expect(response.status()).toBe(401);
  });

  test('File download returns 404 for non-existent file', async ({ request }) => {
    const seeker = await registerJobSeeker(request);

    const response = await request.get(`${API_BASE}/api/files/00000000-0000-0000-0000-000000000000`, {
      headers: { Authorization: `Bearer ${seeker.accessToken}` },
    });

    expect(response.status()).toBe(404);
  });

  test('Unauthenticated user cannot access file upload endpoints', async ({ request }) => {
    const endpoints = [
      { method: 'PUT', path: '/api/me/profile/cv' },
      { method: 'DELETE', path: '/api/me/profile/cv' },
      { method: 'PUT', path: '/api/me/profile/image' },
      { method: 'DELETE', path: '/api/me/profile/image' },
      { method: 'PUT', path: '/api/me/company/logo' },
      { method: 'DELETE', path: '/api/me/company/logo' },
      { method: 'PUT', path: '/api/me/company/cover' },
      { method: 'DELETE', path: '/api/me/company/cover' },
    ];

    for (const endpoint of endpoints) {
      let response;
      if (endpoint.method === 'PUT') {
        response = await request.put(`${API_BASE}${endpoint.path}`);
      } else {
        response = await request.delete(`${API_BASE}${endpoint.path}`);
      }
      expect(response.status()).toBe(401);
    }
  });
});

test.describe('V9 File Uploads - With Actual Files', () => {
  // These tests require the storage service to be configured
  // Skip if storage is not available

  test('Job seeker can upload and download a CV (PDF)', async ({ request }) => {
    const seeker = await registerJobSeeker(request);

    // Create a simple PDF-like content
    const pdfContent = Buffer.from('%PDF-1.4\ntest content\n%%EOF');

    // Upload CV
    const uploadResponse = await request.put(`${API_BASE}/api/me/profile/cv`, {
      headers: {
        Authorization: `Bearer ${seeker.accessToken}`,
      },
      multipart: {
        file: {
          name: 'test-cv.pdf',
          mimeType: 'application/pdf',
          buffer: pdfContent,
        },
      },
    });

    // May fail if storage service is not configured - that's expected
    if (uploadResponse.status() === 500) {
      const body = await uploadResponse.text();
      if (body.includes('Storage service not configured')) {
        test.skip();
        return;
      }
    }

    expect(uploadResponse.ok()).toBeTruthy();
    const uploadData = await uploadResponse.json();

    expect(uploadData).toHaveProperty('file_id');
    expect(uploadData).toHaveProperty('file_type', 'cv');
    expect(uploadData).toHaveProperty('original_filename');
    expect(uploadData).toHaveProperty('download_url');

    // Try to download
    const downloadResponse = await request.get(`${API_BASE}${uploadData.download_url}`, {
      headers: { Authorization: `Bearer ${seeker.accessToken}` },
    });

    expect(downloadResponse.ok()).toBeTruthy();
  });

  test('Job seeker can upload and download a profile image (PNG)', async ({ request }) => {
    const seeker = await registerJobSeeker(request);

    // Create a minimal PNG (1x1 pixel)
    const pngContent = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 pixel
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, // color type, etc
      0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, 0x54, // IDAT chunk
      0x08, 0xD7, 0x63, 0xF8, 0xFF, 0xFF, 0xFF, 0x00,
      0x05, 0xFE, 0x02, 0xFE, 0xDC, 0xCC, 0x59, 0xE7,
      0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, // IEND chunk
      0xAE, 0x42, 0x60, 0x82
    ]);

    // Upload profile image
    const uploadResponse = await request.put(`${API_BASE}/api/me/profile/image`, {
      headers: {
        Authorization: `Bearer ${seeker.accessToken}`,
      },
      multipart: {
        file: {
          name: 'profile.png',
          mimeType: 'image/png',
          buffer: pngContent,
        },
      },
    });

    // May fail if storage service is not configured
    if (uploadResponse.status() === 500) {
      const body = await uploadResponse.text();
      if (body.includes('Storage service not configured')) {
        test.skip();
        return;
      }
    }

    expect(uploadResponse.ok()).toBeTruthy();
    const uploadData = await uploadResponse.json();

    expect(uploadData).toHaveProperty('file_id');
    expect(uploadData).toHaveProperty('file_type', 'profile_image');
  });

  test('Rejects invalid file type for CV (image instead of PDF)', async ({ request }) => {
    const seeker = await registerJobSeeker(request);

    // Try to upload an image as CV
    const pngContent = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

    const response = await request.put(`${API_BASE}/api/me/profile/cv`, {
      headers: {
        Authorization: `Bearer ${seeker.accessToken}`,
      },
      multipart: {
        file: {
          name: 'fake-cv.png',
          mimeType: 'image/png',
          buffer: pngContent,
        },
      },
    });

    // Should be rejected with validation error
    expect(response.status()).toBe(400);
  });

  test('Rejects invalid file type for profile image (PDF instead of image)', async ({ request }) => {
    const seeker = await registerJobSeeker(request);

    // Try to upload PDF as profile image
    const pdfContent = Buffer.from('%PDF-1.4\ntest content\n%%EOF');

    const response = await request.put(`${API_BASE}/api/me/profile/image`, {
      headers: {
        Authorization: `Bearer ${seeker.accessToken}`,
      },
      multipart: {
        file: {
          name: 'fake-image.pdf',
          mimeType: 'application/pdf',
          buffer: pdfContent,
        },
      },
    });

    // Should be rejected with validation error
    expect(response.status()).toBe(400);
  });
});
