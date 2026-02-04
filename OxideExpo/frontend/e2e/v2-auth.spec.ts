import { test, expect } from '@playwright/test';

// Base URL for the API (backend runs on port 8080 in Docker)
const API_BASE = 'http://localhost:8080';

// Helper to generate unique test emails
const uniqueEmail = () => `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;

test.describe('V2: Authentication', () => {
  test.describe('Job Seeker Registration', () => {
    test('POST /api/auth/register creates a job seeker account', async ({ request }) => {
      const email = uniqueEmail();
      const response = await request.post(`${API_BASE}/api/auth/register`, {
        data: {
          email,
          password: 'SecurePassword123!',
          first_name: 'Test',
          last_name: 'User',
        },
      });

      expect(response.ok()).toBeTruthy();
      const body = await response.json();

      expect(body.user).toBeDefined();
      expect(body.user.email).toBe(email.toLowerCase());
      expect(body.user.first_name).toBe('Test');
      expect(body.user.last_name).toBe('User');
      expect(body.user.user_type).toBe('job_seeker');
      expect(body.user.account_status).toBe('pending_verification');
      expect(body.user.email_verified).toBe(false);

      expect(body.access_token).toBeDefined();
      expect(body.refresh_token).toBeDefined();
      expect(body.token_type).toBe('Bearer');
      expect(body.expires_in).toBeGreaterThan(0);
    });

    test('rejects duplicate email registration', async ({ request }) => {
      const email = uniqueEmail();

      // First registration should succeed
      const response1 = await request.post(`${API_BASE}/api/auth/register`, {
        data: {
          email,
          password: 'SecurePassword123!',
          first_name: 'First',
          last_name: 'User',
        },
      });
      expect(response1.ok()).toBeTruthy();

      // Second registration with same email should fail
      const response2 = await request.post(`${API_BASE}/api/auth/register`, {
        data: {
          email,
          password: 'AnotherPassword456!',
          first_name: 'Second',
          last_name: 'User',
        },
      });
      expect(response2.status()).toBe(409); // Conflict
      const body = await response2.json();
      expect(body.error).toContain('already registered');
    });

    test('rejects weak password (less than 8 characters)', async ({ request }) => {
      const response = await request.post(`${API_BASE}/api/auth/register`, {
        data: {
          email: uniqueEmail(),
          password: 'short',
          first_name: 'Test',
          last_name: 'User',
        },
      });

      expect(response.status()).toBe(400); // Bad Request
      const body = await response.json();
      expect(body.error).toContain('8 characters');
    });

    test('rejects invalid email format', async ({ request }) => {
      const response = await request.post(`${API_BASE}/api/auth/register`, {
        data: {
          email: 'not-an-email',
          password: 'SecurePassword123!',
          first_name: 'Test',
          last_name: 'User',
        },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('email');
    });

    test('rejects missing required fields', async ({ request }) => {
      const response = await request.post(`${API_BASE}/api/auth/register`, {
        data: {
          email: uniqueEmail(),
          password: 'SecurePassword123!',
          // Missing first_name and last_name
        },
      });

      // Axum returns 422 for JSON deserialization failures (missing fields)
      expect([400, 422]).toContain(response.status());
    });
  });

  test.describe('Company Member Registration', () => {
    test('POST /api/auth/register/company creates a company member account', async ({ request }) => {
      const email = uniqueEmail();
      const response = await request.post(`${API_BASE}/api/auth/register/company`, {
        data: {
          email,
          password: 'SecurePassword123!',
          first_name: 'Company',
          last_name: 'Admin',
          company_name: 'Test Company Inc.',
        },
      });

      expect(response.ok()).toBeTruthy();
      const body = await response.json();

      expect(body.user.email).toBe(email.toLowerCase());
      expect(body.user.user_type).toBe('company_member');
      expect(body.user.account_status).toBe('pending_verification');
      expect(body.access_token).toBeDefined();
      expect(body.refresh_token).toBeDefined();
    });

    test('requires company_name field', async ({ request }) => {
      const response = await request.post(`${API_BASE}/api/auth/register/company`, {
        data: {
          email: uniqueEmail(),
          password: 'SecurePassword123!',
          first_name: 'Company',
          last_name: 'Admin',
          // Missing company_name
        },
      });

      // Axum returns 422 for JSON deserialization failures (missing fields)
      expect([400, 422]).toContain(response.status());
    });
  });

  test.describe('OMIL Member Registration', () => {
    test('POST /api/auth/register/omil creates an OMIL member account', async ({ request }) => {
      const email = uniqueEmail();
      const response = await request.post(`${API_BASE}/api/auth/register/omil`, {
        data: {
          email,
          password: 'SecurePassword123!',
          first_name: 'OMIL',
          last_name: 'Officer',
          municipality_name: 'Santiago',
        },
      });

      expect(response.ok()).toBeTruthy();
      const body = await response.json();

      expect(body.user.email).toBe(email.toLowerCase());
      expect(body.user.user_type).toBe('omil_member');
      expect(body.user.account_status).toBe('pending_verification');
      expect(body.access_token).toBeDefined();
      expect(body.refresh_token).toBeDefined();
    });

    test('requires municipality_name field', async ({ request }) => {
      const response = await request.post(`${API_BASE}/api/auth/register/omil`, {
        data: {
          email: uniqueEmail(),
          password: 'SecurePassword123!',
          first_name: 'OMIL',
          last_name: 'Officer',
          // Missing municipality_name
        },
      });

      // Axum returns 422 for JSON deserialization failures (missing fields)
      expect([400, 422]).toContain(response.status());
    });
  });

  test.describe('Login', () => {
    test('POST /api/auth/login with valid credentials returns tokens', async ({ request }) => {
      const email = uniqueEmail();
      const password = 'SecurePassword123!';

      // Register first
      await request.post(`${API_BASE}/api/auth/register`, {
        data: {
          email,
          password,
          first_name: 'Test',
          last_name: 'User',
        },
      });

      // Login
      const response = await request.post(`${API_BASE}/api/auth/login`, {
        data: { email, password },
      });

      expect(response.ok()).toBeTruthy();
      const body = await response.json();

      expect(body.user).toBeDefined();
      expect(body.user.email).toBe(email.toLowerCase());
      expect(body.access_token).toBeDefined();
      expect(body.refresh_token).toBeDefined();
      expect(body.token_type).toBe('Bearer');
      expect(body.expires_in).toBeGreaterThan(0);
    });

    test('login fails with wrong password', async ({ request }) => {
      const email = uniqueEmail();

      // Register
      await request.post(`${API_BASE}/api/auth/register`, {
        data: {
          email,
          password: 'CorrectPassword123!',
          first_name: 'Test',
          last_name: 'User',
        },
      });

      // Login with wrong password
      const response = await request.post(`${API_BASE}/api/auth/login`, {
        data: { email, password: 'WrongPassword456!' },
      });

      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body.error).toContain('Invalid email or password');
    });

    test('login fails with non-existent email', async ({ request }) => {
      const response = await request.post(`${API_BASE}/api/auth/login`, {
        data: {
          email: 'nonexistent@example.com',
          password: 'SomePassword123!',
        },
      });

      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body.error).toContain('Invalid email or password');
    });

    test('login is case-insensitive for email', async ({ request }) => {
      const email = uniqueEmail();
      const password = 'SecurePassword123!';

      // Register with lowercase email
      await request.post(`${API_BASE}/api/auth/register`, {
        data: {
          email: email.toLowerCase(),
          password,
          first_name: 'Test',
          last_name: 'User',
        },
      });

      // Login with uppercase email
      const response = await request.post(`${API_BASE}/api/auth/login`, {
        data: { email: email.toUpperCase(), password },
      });

      expect(response.ok()).toBeTruthy();
    });
  });

  test.describe('Protected Routes', () => {
    test('GET /api/auth/me returns current user with valid token', async ({ request }) => {
      const email = uniqueEmail();

      // Register and get token
      const registerRes = await request.post(`${API_BASE}/api/auth/register`, {
        data: {
          email,
          password: 'SecurePassword123!',
          first_name: 'Test',
          last_name: 'User',
        },
      });
      const { access_token } = await registerRes.json();

      // Access protected route
      const response = await request.get(`${API_BASE}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      });

      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      expect(body.email).toBe(email.toLowerCase());
      expect(body.first_name).toBe('Test');
      expect(body.last_name).toBe('User');
    });

    test('GET /api/auth/me fails without token', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/auth/me`);
      expect(response.status()).toBe(401);
    });

    test('GET /api/auth/me fails with invalid token', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/auth/me`, {
        headers: {
          Authorization: 'Bearer invalid-token-here',
        },
      });
      expect(response.status()).toBe(401);
    });
  });

  test.describe('Logout', () => {
    test('POST /api/auth/logout invalidates token', async ({ request }) => {
      const email = uniqueEmail();

      // Register
      const registerRes = await request.post(`${API_BASE}/api/auth/register`, {
        data: {
          email,
          password: 'SecurePassword123!',
          first_name: 'Test',
          last_name: 'User',
        },
      });
      const { access_token } = await registerRes.json();

      // Verify token works
      const meBeforeLogout = await request.get(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      expect(meBeforeLogout.ok()).toBeTruthy();

      // Logout
      const logoutRes = await request.post(`${API_BASE}/api/auth/logout`, {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      expect(logoutRes.ok()).toBeTruthy();
      const logoutBody = await logoutRes.json();
      expect(logoutBody.message).toContain('Logged out');

      // Token should no longer work (blacklisted)
      const meAfterLogout = await request.get(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      expect(meAfterLogout.status()).toBe(401);
    });
  });

  test.describe('Token Refresh', () => {
    test('POST /api/auth/refresh returns new tokens', async ({ request }) => {
      const email = uniqueEmail();

      // Register
      const registerRes = await request.post(`${API_BASE}/api/auth/register`, {
        data: {
          email,
          password: 'SecurePassword123!',
          first_name: 'Test',
          last_name: 'User',
        },
      });
      const { refresh_token } = await registerRes.json();

      // Refresh tokens
      const refreshRes = await request.post(`${API_BASE}/api/auth/refresh`, {
        data: { refresh_token },
      });

      expect(refreshRes.ok()).toBeTruthy();
      const body = await refreshRes.json();
      expect(body.access_token).toBeDefined();
      expect(body.refresh_token).toBeDefined();
      expect(body.token_type).toBe('Bearer');
      expect(body.expires_in).toBeGreaterThan(0);

      // New access token should work
      const meRes = await request.get(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${body.access_token}` },
      });
      expect(meRes.ok()).toBeTruthy();
    });

    test('refresh token can only be used once (rotation)', async ({ request }) => {
      const email = uniqueEmail();

      // Register
      const registerRes = await request.post(`${API_BASE}/api/auth/register`, {
        data: {
          email,
          password: 'SecurePassword123!',
          first_name: 'Test',
          last_name: 'User',
        },
      });
      const { refresh_token } = await registerRes.json();

      // First refresh should succeed
      const refresh1 = await request.post(`${API_BASE}/api/auth/refresh`, {
        data: { refresh_token },
      });
      expect(refresh1.ok()).toBeTruthy();

      // Second refresh with same token should fail (already revoked)
      const refresh2 = await request.post(`${API_BASE}/api/auth/refresh`, {
        data: { refresh_token },
      });
      expect(refresh2.status()).toBe(401);
      const body = await refresh2.json();
      expect(body.error).toContain('revoked');
    });

    test('refresh fails with invalid token', async ({ request }) => {
      const response = await request.post(`${API_BASE}/api/auth/refresh`, {
        data: { refresh_token: 'invalid-refresh-token' },
      });

      expect(response.status()).toBe(401);
    });
  });

  test.describe('Password Reset', () => {
    test('POST /api/auth/password/forgot always returns success (no enumeration)', async ({ request }) => {
      // Request reset for existing email
      const response1 = await request.post(`${API_BASE}/api/auth/password/forgot`, {
        data: { email: uniqueEmail() },
      });
      expect(response1.ok()).toBeTruthy();
      const body1 = await response1.json();
      expect(body1.message).toContain('If an account exists');

      // Request reset for non-existing email (should also succeed to prevent enumeration)
      const response2 = await request.post(`${API_BASE}/api/auth/password/forgot`, {
        data: { email: 'nonexistent@example.com' },
      });
      expect(response2.ok()).toBeTruthy();
      const body2 = await response2.json();
      expect(body2.message).toContain('If an account exists');
    });

    test('POST /api/auth/password/reset fails with invalid token', async ({ request }) => {
      const response = await request.post(`${API_BASE}/api/auth/password/reset`, {
        data: {
          token: 'invalid-reset-token',
          new_password: 'NewPassword123!',
        },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('Invalid or expired');
    });
  });

  test.describe('Email Verification', () => {
    test('POST /api/auth/email/verify fails with invalid token', async ({ request }) => {
      const response = await request.post(`${API_BASE}/api/auth/email/verify`, {
        data: { token: 'invalid-verification-token' },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('Invalid or expired');
    });

    test('POST /api/auth/email/resend always returns success (no enumeration)', async ({ request }) => {
      // Resend for existing unverified email
      const email = uniqueEmail();
      await request.post(`${API_BASE}/api/auth/register`, {
        data: {
          email,
          password: 'SecurePassword123!',
          first_name: 'Test',
          last_name: 'User',
        },
      });

      const response1 = await request.post(`${API_BASE}/api/auth/email/resend`, {
        data: { email },
      });
      expect(response1.ok()).toBeTruthy();
      const body1 = await response1.json();
      expect(body1.message).toContain('If an unverified account exists');

      // Resend for non-existing email (should also succeed to prevent enumeration)
      const response2 = await request.post(`${API_BASE}/api/auth/email/resend`, {
        data: { email: 'nonexistent@example.com' },
      });
      expect(response2.ok()).toBeTruthy();
      const body2 = await response2.json();
      expect(body2.message).toContain('If an unverified account exists');
    });
  });
});
