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

// Helper to create an active job
function createActiveJob(companyId: string, userId: string): string {
  const jobTitle = `Test Job ${Date.now()}`;
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 30);
  const deadlineStr = deadline.toISOString().split('T')[0];

  const jobSql = `INSERT INTO jobs (company_id, posted_by, title, description, job_type, work_modality, application_deadline, vacancies, status, approved_at, approved_by) VALUES ('${companyId}', '${userId}', '${jobTitle}', 'Test job description', 'full_time', 'on_site', '${deadlineStr}', 1, 'active', NOW(), '${userId}') RETURNING id`;
  const cmd = `docker exec empleos_db_dev psql -U postgres -d empleos_inclusivos -t -A -c "${jobSql}"`;
  return execSync(cmd, { encoding: 'utf8' }).trim().split('\n')[0].trim();
}

// Helper to create a job application
function createApplication(jobId: string, applicantId: string): string {
  const appSql = `INSERT INTO job_applications (job_id, applicant_id, status) VALUES ('${jobId}', '${applicantId}', 'submitted') RETURNING id`;
  const cmd = `docker exec empleos_db_dev psql -U postgres -d empleos_inclusivos -t -A -c "${appSql}"`;
  return execSync(cmd, { encoding: 'utf8' }).trim().split('\n')[0].trim();
}

// ============================================================================
// V12: ADMIN REPORTING TESTS
// ============================================================================

test.describe('V12 Admin Reports', () => {
  test('User registration trends returns data with grouping', async ({ request }) => {
    const admin = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD);

    // Register some users to have data
    await registerJobSeeker(request);
    await registerJobSeeker(request);

    const response = await request.get(`${API_BASE}/api/admin/reports/users?group_by=day`, {
      headers: { Authorization: `Bearer ${admin.accessToken}` },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data).toHaveProperty('trend');
    expect(data).toHaveProperty('total_users');
    expect(Array.isArray(data.trend)).toBeTruthy();
  });

  test('Company statistics returns counts over time', async ({ request }) => {
    const admin = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD);

    // Register a company to have data
    await registerCompany(request);

    const response = await request.get(`${API_BASE}/api/admin/reports/companies?group_by=week`, {
      headers: { Authorization: `Bearer ${admin.accessToken}` },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data).toHaveProperty('trend');
    expect(data).toHaveProperty('total_companies');
    expect(data).toHaveProperty('pending_companies');
    expect(data).toHaveProperty('active_companies');
  });

  test('Job posting trends returns data', async ({ request }) => {
    const admin = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD);

    // Create a company with a job
    const company = await registerCompany(request);
    activateCompany(company.companyId, admin.userId);
    createActiveJob(company.companyId, company.userId);

    const response = await request.get(`${API_BASE}/api/admin/reports/jobs`, {
      headers: { Authorization: `Bearer ${admin.accessToken}` },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data).toHaveProperty('trend');
    expect(data).toHaveProperty('total_jobs');
    expect(data).toHaveProperty('active_jobs');
    expect(data).toHaveProperty('pending_jobs');
  });

  test('Application trends returns data', async ({ request }) => {
    const admin = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD);

    // Create company, job, and application
    const company = await registerCompany(request);
    activateCompany(company.companyId, admin.userId);
    const jobId = createActiveJob(company.companyId, company.userId);
    const seeker = await registerJobSeeker(request);
    createApplication(jobId, seeker.userId);

    const response = await request.get(`${API_BASE}/api/admin/reports/applications`, {
      headers: { Authorization: `Bearer ${admin.accessToken}` },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data).toHaveProperty('trend');
    expect(data).toHaveProperty('total_applications');
    expect(data).toHaveProperty('by_status');
  });

  test('Reports support date range filtering', async ({ request }) => {
    const admin = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD);

    const fromDate = new Date();
    fromDate.setMonth(fromDate.getMonth() - 1);
    const toDate = new Date();

    const response = await request.get(
      `${API_BASE}/api/admin/reports/users?from_date=${fromDate.toISOString()}&to_date=${toDate.toISOString()}`,
      { headers: { Authorization: `Bearer ${admin.accessToken}` } }
    );

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data).toHaveProperty('trend');
    expect(data).toHaveProperty('total_users');
  });

  test('Report export returns valid Excel file', async ({ request }) => {
    const admin = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD);

    const response = await request.get(`${API_BASE}/api/admin/reports/export/users`, {
      headers: { Authorization: `Bearer ${admin.accessToken}` },
    });

    expect(response.ok()).toBeTruthy();
    expect(response.headers()['content-type']).toContain('spreadsheetml');
    expect(response.headers()['content-disposition']).toContain('attachment');
    expect(response.headers()['content-disposition']).toContain('.xlsx');
  });

  test('Unauthenticated user cannot access admin reports', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/admin/reports/users`);
    expect(response.status()).toBe(401);
  });

  test('Non-admin cannot access admin reports', async ({ request }) => {
    const seeker = await registerJobSeeker(request);

    const response = await request.get(`${API_BASE}/api/admin/reports/users`, {
      headers: { Authorization: `Bearer ${seeker.accessToken}` },
    });

    expect(response.status()).toBe(403);
  });
});

// ============================================================================
// V12: COMPANY DASHBOARD TESTS
// ============================================================================

test.describe('V12 Company Dashboard', () => {
  test('Company can view performance dashboard', async ({ request }) => {
    const admin = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    const company = await registerCompany(request);
    activateCompany(company.companyId, admin.userId);

    const response = await request.get(`${API_BASE}/api/me/company/dashboard`, {
      headers: { Authorization: `Bearer ${company.accessToken}` },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data).toHaveProperty('active_jobs');
    expect(data).toHaveProperty('total_applications');
    expect(data).toHaveProperty('applications_by_status');
    expect(data).toHaveProperty('trend');
    expect(data).toHaveProperty('top_jobs');
  });

  test('Dashboard shows application breakdown by status', async ({ request }) => {
    const admin = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    const company = await registerCompany(request);
    activateCompany(company.companyId, admin.userId);
    const jobId = createActiveJob(company.companyId, company.userId);

    // Create some applications
    const seeker1 = await registerJobSeeker(request);
    const seeker2 = await registerJobSeeker(request);
    createApplication(jobId, seeker1.userId);
    createApplication(jobId, seeker2.userId);

    const response = await request.get(`${API_BASE}/api/me/company/dashboard`, {
      headers: { Authorization: `Bearer ${company.accessToken}` },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data.total_applications).toBeGreaterThanOrEqual(2);
    expect(Array.isArray(data.applications_by_status)).toBeTruthy();
  });

  test('Dashboard shows top performing jobs', async ({ request }) => {
    const admin = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    const company = await registerCompany(request);
    activateCompany(company.companyId, admin.userId);

    // Create multiple jobs
    const jobId1 = createActiveJob(company.companyId, company.userId);
    createActiveJob(company.companyId, company.userId);

    // Add applications to one job
    const seeker = await registerJobSeeker(request);
    createApplication(jobId1, seeker.userId);

    const response = await request.get(`${API_BASE}/api/me/company/dashboard`, {
      headers: { Authorization: `Bearer ${company.accessToken}` },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data.active_jobs).toBeGreaterThanOrEqual(2);
    expect(Array.isArray(data.top_jobs)).toBeTruthy();

    if (data.top_jobs.length > 0) {
      const topJob = data.top_jobs[0];
      expect(topJob).toHaveProperty('job_id');
      expect(topJob).toHaveProperty('title');
      expect(topJob).toHaveProperty('applications_count');
      expect(topJob).toHaveProperty('status');
    }
  });

  test('Non-company member cannot access company dashboard', async ({ request }) => {
    const seeker = await registerJobSeeker(request);

    const response = await request.get(`${API_BASE}/api/me/company/dashboard`, {
      headers: { Authorization: `Bearer ${seeker.accessToken}` },
    });

    expect(response.status()).toBe(403);
  });

  test('Unauthenticated user cannot access company dashboard', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/me/company/dashboard`);
    expect(response.status()).toBe(401);
  });
});
