import { test, expect } from '@playwright/test';
const { execSync } = require('child_process');

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

  // Activate the user account via SQL
  const activateSql = `UPDATE users SET account_status = 'active', email_verified_at = NOW() WHERE id = '${body.user.id}'`;
  execSync(`docker exec empleos_db_dev psql -U postgres -d empleos_inclusivos -c "${activateSql}"`, { encoding: 'utf8' });

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

  return {
    email,
    userId: body.user.id,
    accessToken: body.access_token,
  };
}

// Helper to register an OMIL organization
async function registerOmil(request: any) {
  const email = uniqueEmail();
  const orgName = `Test OMIL ${Date.now()}`;

  const response = await request.post(`${API_BASE}/api/auth/register/omil`, {
    data: {
      email,
      password: 'SecurePassword123',
      first_name: 'Test',
      last_name: 'Director',
      organization_name: orgName,
    },
  });

  expect(response.ok()).toBeTruthy();
  const body = await response.json();

  // Activate the user account via SQL
  const activateSql = `UPDATE users SET account_status = 'active', email_verified_at = NOW() WHERE id = '${body.user.id}'`;
  execSync(`docker exec empleos_db_dev psql -U postgres -d empleos_inclusivos -c "${activateSql}"`, { encoding: 'utf8' });

  // Get the OMIL org ID directly from database
  const orgIdSql = `SELECT o.id FROM omil_organizations o JOIN omil_members m ON m.omil_id = o.id WHERE m.user_id = '${body.user.id}'`;
  const orgIdResult = execSync(`docker exec empleos_db_dev psql -U postgres -d empleos_inclusivos -t -A -c "${orgIdSql}"`, { encoding: 'utf8' });
  const organizationId = orgIdResult.trim().split('\n')[0].trim();

  return {
    email,
    userId: body.user.id,
    accessToken: body.access_token,
    organizationId,
    organizationName: orgName,
  };
}

// ============================================================================
// V11: USER MANAGEMENT TESTS
// ============================================================================

test.describe('V11 Admin - User Management', () => {
  test('Admin can list all users with pagination', async ({ request }) => {
    const admin = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD);

    const response = await request.get(`${API_BASE}/api/admin/users?limit=10&offset=0`, {
      headers: { Authorization: `Bearer ${admin.accessToken}` },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    // API uses 'data' for paginated lists
    expect(data).toHaveProperty('data');
    expect(data).toHaveProperty('total');
    expect(Array.isArray(data.data)).toBeTruthy();
    expect(data.data.length).toBeLessThanOrEqual(10);
  });

  test('Admin can filter users by type', async ({ request }) => {
    const admin = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD);

    // Register a job seeker first
    await registerJobSeeker(request);

    const response = await request.get(`${API_BASE}/api/admin/users?user_type=job_seeker`, {
      headers: { Authorization: `Bearer ${admin.accessToken}` },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data).toHaveProperty('data');
    // All returned users should be job seekers
    for (const user of data.data) {
      expect(user.user_type).toBe('job_seeker');
    }
  });

  test('Admin can filter users by status', async ({ request }) => {
    const admin = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD);

    const response = await request.get(`${API_BASE}/api/admin/users?status=active`, {
      headers: { Authorization: `Bearer ${admin.accessToken}` },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data).toHaveProperty('data');
    for (const user of data.data) {
      expect(user.account_status).toBe('active');
    }
  });

  test('Admin can search users by email', async ({ request }) => {
    const admin = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    const seeker = await registerJobSeeker(request);

    // Search for the specific email
    const response = await request.get(`${API_BASE}/api/admin/users?search=${encodeURIComponent(seeker.email)}`, {
      headers: { Authorization: `Bearer ${admin.accessToken}` },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data).toHaveProperty('data');
    expect(data.data.length).toBeGreaterThanOrEqual(1);
    const found = data.data.find((u: any) => u.email === seeker.email);
    expect(found).toBeDefined();
  });

  test('Admin can get user detail', async ({ request }) => {
    const admin = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    const seeker = await registerJobSeeker(request);

    const response = await request.get(`${API_BASE}/api/admin/users/${seeker.userId}`, {
      headers: { Authorization: `Bearer ${admin.accessToken}` },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data).toHaveProperty('id', seeker.userId);
    expect(data).toHaveProperty('email', seeker.email);
    expect(data).toHaveProperty('first_name');
    expect(data).toHaveProperty('last_name');
    expect(data).toHaveProperty('user_type');
    expect(data).toHaveProperty('account_status');
  });

  test('Admin can suspend an active user', async ({ request }) => {
    const admin = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    const seeker = await registerJobSeeker(request);

    const response = await request.patch(`${API_BASE}/api/admin/users/${seeker.userId}/status`, {
      headers: { Authorization: `Bearer ${admin.accessToken}` },
      data: {
        status: 'suspended',
        reason: 'Test suspension',
      },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data).toHaveProperty('message');

    // Verify by fetching user detail
    const detailResponse = await request.get(`${API_BASE}/api/admin/users/${seeker.userId}`, {
      headers: { Authorization: `Bearer ${admin.accessToken}` },
    });
    const detail = await detailResponse.json();
    expect(detail.account_status).toBe('suspended');
  });

  test('Admin can activate a suspended user', async ({ request }) => {
    const admin = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    const seeker = await registerJobSeeker(request);

    // First suspend the user
    await request.patch(`${API_BASE}/api/admin/users/${seeker.userId}/status`, {
      headers: { Authorization: `Bearer ${admin.accessToken}` },
      data: { status: 'suspended', reason: 'Test' },
    });

    // Then activate
    const response = await request.patch(`${API_BASE}/api/admin/users/${seeker.userId}/status`, {
      headers: { Authorization: `Bearer ${admin.accessToken}` },
      data: { status: 'active' },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data).toHaveProperty('message');

    // Verify by fetching user detail
    const detailResponse = await request.get(`${API_BASE}/api/admin/users/${seeker.userId}`, {
      headers: { Authorization: `Bearer ${admin.accessToken}` },
    });
    const detail = await detailResponse.json();
    expect(detail.account_status).toBe('active');
  });

  test('Admin can generate impersonation token for any user', async ({ request }) => {
    const admin = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    const seeker = await registerJobSeeker(request);

    const response = await request.get(`${API_BASE}/api/admin/users/${seeker.userId}/impersonate`, {
      headers: { Authorization: `Bearer ${admin.accessToken}` },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data).toHaveProperty('impersonation_token');
    expect(data).toHaveProperty('user_id', seeker.userId);
    expect(data).toHaveProperty('expires_at');
  });

  test('Non-admin cannot access user management', async ({ request }) => {
    const seeker = await registerJobSeeker(request);

    const response = await request.get(`${API_BASE}/api/admin/users`, {
      headers: { Authorization: `Bearer ${seeker.accessToken}` },
    });

    expect(response.status()).toBe(403);
  });
});

// ============================================================================
// V11: OMIL APPROVALS TESTS
// ============================================================================

test.describe('V11 Admin - OMIL Approvals', () => {
  test('Admin can list pending OMILs', async ({ request }) => {
    const admin = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD);

    // Register an OMIL (stays pending by default)
    await registerOmil(request);

    const response = await request.get(`${API_BASE}/api/admin/omils/pending`, {
      headers: { Authorization: `Bearer ${admin.accessToken}` },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    // API returns array directly
    expect(Array.isArray(data)).toBeTruthy();

    // All returned OMILs should be pending_approval
    for (const omil of data) {
      expect(omil.status).toBe('pending_approval');
    }
  });

  test('Admin can approve OMIL organization', async ({ request }) => {
    const admin = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    const omil = await registerOmil(request);

    const response = await request.patch(`${API_BASE}/api/admin/omils/${omil.organizationId}/approve`, {
      headers: { Authorization: `Bearer ${admin.accessToken}` },
      data: { notes: 'Approved for testing' },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data).toHaveProperty('id', omil.organizationId);
    expect(data).toHaveProperty('status', 'active');
    expect(data).toHaveProperty('approved_at');
    expect(data).toHaveProperty('approved_by');
  });

  test('Admin can reject OMIL organization with reason', async ({ request }) => {
    const admin = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    const omil = await registerOmil(request);

    const response = await request.patch(`${API_BASE}/api/admin/omils/${omil.organizationId}/reject`, {
      headers: { Authorization: `Bearer ${admin.accessToken}` },
      data: { rejection_reason: 'Invalid documentation submitted for this OMIL' },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data).toHaveProperty('id', omil.organizationId);
    expect(data).toHaveProperty('status', 'rejected');
  });
});

// ============================================================================
// V11: AUDIT LOG TESTS
// ============================================================================

test.describe('V11 Admin - Audit Logs', () => {
  test('Admin can view audit logs with pagination', async ({ request }) => {
    const admin = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD);

    // First create some audit activity by approving something
    const company = await registerCompany(request);
    // Get company profile to get company ID
    const profileResponse = await request.get(`${API_BASE}/api/me/company/profile`, {
      headers: { Authorization: `Bearer ${company.accessToken}` },
    });
    const profile = await profileResponse.json();

    await request.patch(`${API_BASE}/api/admin/companies/${profile.id}/approve`, {
      headers: { Authorization: `Bearer ${admin.accessToken}` },
      data: {},
    });

    // Now fetch audit logs
    const response = await request.get(`${API_BASE}/api/admin/audit-logs?limit=20&offset=0`, {
      headers: { Authorization: `Bearer ${admin.accessToken}` },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    // API uses 'data' for paginated lists
    expect(data).toHaveProperty('data');
    expect(data).toHaveProperty('total');
    expect(Array.isArray(data.data)).toBeTruthy();

    if (data.data.length > 0) {
      const log = data.data[0];
      expect(log).toHaveProperty('id');
      expect(log).toHaveProperty('admin_id');
      expect(log).toHaveProperty('action_type');
      expect(log).toHaveProperty('created_at');
    }
  });

  test('Admin can filter audit logs by action type', async ({ request }) => {
    const admin = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD);

    const response = await request.get(`${API_BASE}/api/admin/audit-logs?action_type=approve_company`, {
      headers: { Authorization: `Bearer ${admin.accessToken}` },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data).toHaveProperty('data');
    for (const log of data.data) {
      expect(log.action_type).toBe('approve_company');
    }
  });

  test('Admin can filter audit logs by date range', async ({ request }) => {
    const admin = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD);

    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 7);
    const toDate = new Date();

    const response = await request.get(
      `${API_BASE}/api/admin/audit-logs?from_date=${fromDate.toISOString()}&to_date=${toDate.toISOString()}`,
      { headers: { Authorization: `Bearer ${admin.accessToken}` } }
    );

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data).toHaveProperty('data');
    expect(data).toHaveProperty('total');
  });
});

// ============================================================================
// V11: SYSTEM SETTINGS TESTS
// ============================================================================

test.describe('V11 Admin - System Settings', () => {
  test('Admin can get system settings', async ({ request }) => {
    const admin = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD);

    const response = await request.get(`${API_BASE}/api/admin/settings`, {
      headers: { Authorization: `Bearer ${admin.accessToken}` },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    // API returns array directly
    expect(Array.isArray(data)).toBeTruthy();

    // Check for expected default settings
    const settingKeys = data.map((s: any) => s.key);
    expect(settingKeys).toContain('require_email_verification');
    expect(settingKeys).toContain('auto_approve_companies');
    expect(settingKeys).toContain('maintenance_mode');
  });

  test('Admin can update system settings', async ({ request }) => {
    const admin = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD);

    // Update a setting
    const response = await request.put(`${API_BASE}/api/admin/settings`, {
      headers: { Authorization: `Bearer ${admin.accessToken}` },
      data: {
        settings: [
          { key: 'max_applications_per_seeker', value: 100 },
        ],
      },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    // API returns updated settings array
    expect(Array.isArray(data)).toBeTruthy();

    // Verify the setting was updated
    const updatedSetting = data.find((s: any) => s.key === 'max_applications_per_seeker');
    expect(updatedSetting).toBeDefined();
    expect(updatedSetting.value).toBe(100);

    // Reset to default
    await request.put(`${API_BASE}/api/admin/settings`, {
      headers: { Authorization: `Bearer ${admin.accessToken}` },
      data: {
        settings: [
          { key: 'max_applications_per_seeker', value: 50 },
        ],
      },
    });
  });

  test('Non-admin cannot access system settings', async ({ request }) => {
    const seeker = await registerJobSeeker(request);

    const response = await request.get(`${API_BASE}/api/admin/settings`, {
      headers: { Authorization: `Bearer ${seeker.accessToken}` },
    });

    expect(response.status()).toBe(403);
  });
});
