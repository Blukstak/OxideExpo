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
      last_name: 'Applicant',
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

// Helper to register a company
async function registerCompany(request: any, companyName?: string) {
  const email = uniqueEmail();
  const response = await request.post(`${API_BASE}/api/auth/register/company`, {
    data: {
      email,
      password: 'SecurePassword123',
      first_name: 'Test',
      last_name: 'Owner',
      company_name: companyName || `Test Company ${Date.now()}`,
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

// Helper to activate a company for testing
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

// Helper to create a job seeker profile
function createJobSeekerProfile(userId: string) {
  const sql = `INSERT INTO job_seeker_profiles (user_id, phone, bio, completeness_percentage) VALUES ('${userId}', '+56912345678', 'Test bio', 50) ON CONFLICT (user_id) DO UPDATE SET phone = '+56912345678', bio = 'Test bio', completeness_percentage = 50`;
  execSync(`docker exec empleos_db_dev psql -U postgres -d empleos_inclusivos -c "${sql}"`, { encoding: 'utf8' });
}

// Helper to create an application
function createApplication(jobId: string, applicantId: string): string {
  const sql = `INSERT INTO job_applications (job_id, applicant_id, status) VALUES ('${jobId}', '${applicantId}', 'submitted') RETURNING id`;
  const cmd = `docker exec empleos_db_dev psql -U postgres -d empleos_inclusivos -t -A -c "${sql}"`;
  return execSync(cmd, { encoding: 'utf8' }).trim().split('\n')[0].trim();
}

test.describe('V9 Enhanced Applicant Management', () => {
  test('Company can list applicants for a job', async ({ request }) => {
    // Setup
    const company = await registerCompany(request);
    const admin = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    activateCompany(company.companyId, admin.userId);
    const jobId = createActiveJob(company.companyId, company.userId);

    // Create some applicants
    const seeker1 = await registerJobSeeker(request);
    createJobSeekerProfile(seeker1.userId);
    createApplication(jobId, seeker1.userId);

    const seeker2 = await registerJobSeeker(request);
    createJobSeekerProfile(seeker2.userId);
    createApplication(jobId, seeker2.userId);

    // List applicants
    const response = await request.get(`${API_BASE}/api/me/jobs/${jobId}/applicants`, {
      headers: { Authorization: `Bearer ${company.accessToken}` },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data).toHaveProperty('applicants');
    expect(data).toHaveProperty('total');
    expect(data).toHaveProperty('limit');
    expect(data).toHaveProperty('offset');
    expect(data.total).toBeGreaterThanOrEqual(2);
    expect(Array.isArray(data.applicants)).toBeTruthy();
  });

  test('Applicant list supports pagination', async ({ request }) => {
    const company = await registerCompany(request);
    const admin = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    activateCompany(company.companyId, admin.userId);
    const jobId = createActiveJob(company.companyId, company.userId);

    // Create applicants
    for (let i = 0; i < 3; i++) {
      const seeker = await registerJobSeeker(request);
      createJobSeekerProfile(seeker.userId);
      createApplication(jobId, seeker.userId);
    }

    // Get first page
    const page1 = await request.get(`${API_BASE}/api/me/jobs/${jobId}/applicants?limit=2&offset=0`, {
      headers: { Authorization: `Bearer ${company.accessToken}` },
    });
    const page1Data = await page1.json();

    expect(page1Data.applicants.length).toBe(2);
    expect(page1Data.limit).toBe(2);
    expect(page1Data.offset).toBe(0);

    // Get second page
    const page2 = await request.get(`${API_BASE}/api/me/jobs/${jobId}/applicants?limit=2&offset=2`, {
      headers: { Authorization: `Bearer ${company.accessToken}` },
    });
    const page2Data = await page2.json();

    expect(page2Data.offset).toBe(2);
  });

  test('Company can get applicant detail', async ({ request }) => {
    const company = await registerCompany(request);
    const admin = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    activateCompany(company.companyId, admin.userId);
    const jobId = createActiveJob(company.companyId, company.userId);

    const seeker = await registerJobSeeker(request);
    createJobSeekerProfile(seeker.userId);
    const appId = createApplication(jobId, seeker.userId);

    // Get applicant detail
    const response = await request.get(`${API_BASE}/api/me/jobs/${jobId}/applicants/${appId}/detail`, {
      headers: { Authorization: `Bearer ${company.accessToken}` },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data).toHaveProperty('application_id', appId);
    expect(data).toHaveProperty('job_id', jobId);
    expect(data).toHaveProperty('applicant_id', seeker.userId);
    expect(data).toHaveProperty('status');
    expect(data).toHaveProperty('profile');
    expect(data).toHaveProperty('status_history');
    expect(Array.isArray(data.status_history)).toBeTruthy();
  });

  test('Company can get applicant status history', async ({ request }) => {
    const company = await registerCompany(request);
    const admin = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    activateCompany(company.companyId, admin.userId);
    const jobId = createActiveJob(company.companyId, company.userId);

    const seeker = await registerJobSeeker(request);
    createJobSeekerProfile(seeker.userId);
    const appId = createApplication(jobId, seeker.userId);

    // Update status to trigger history
    await request.put(`${API_BASE}/api/me/jobs/${jobId}/applications/${appId}`, {
      headers: { Authorization: `Bearer ${company.accessToken}` },
      data: { status: 'under_review' },
    });

    // Get history
    const response = await request.get(`${API_BASE}/api/me/jobs/${jobId}/applicants/${appId}/history`, {
      headers: { Authorization: `Bearer ${company.accessToken}` },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(Array.isArray(data)).toBeTruthy();
  });

  test('Company can perform bulk status update', async ({ request }) => {
    const company = await registerCompany(request);
    const admin = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    activateCompany(company.companyId, admin.userId);
    const jobId = createActiveJob(company.companyId, company.userId);

    // Create applicants
    const appIds: string[] = [];
    for (let i = 0; i < 3; i++) {
      const seeker = await registerJobSeeker(request);
      createJobSeekerProfile(seeker.userId);
      appIds.push(createApplication(jobId, seeker.userId));
    }

    // Bulk update
    const response = await request.post(`${API_BASE}/api/me/jobs/${jobId}/applicants/bulk-status`, {
      headers: { Authorization: `Bearer ${company.accessToken}` },
      data: {
        application_ids: appIds,
        status: 'under_review',
      },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data).toHaveProperty('updated_count', 3);
    expect(data).toHaveProperty('failed_ids');
    expect(data.failed_ids).toHaveLength(0);
  });

  test('Company can export applicants to Excel', async ({ request }) => {
    const company = await registerCompany(request);
    const admin = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    activateCompany(company.companyId, admin.userId);
    const jobId = createActiveJob(company.companyId, company.userId);

    const seeker = await registerJobSeeker(request);
    createJobSeekerProfile(seeker.userId);
    createApplication(jobId, seeker.userId);

    // Export to Excel
    const response = await request.get(`${API_BASE}/api/me/jobs/${jobId}/applicants/export`, {
      headers: { Authorization: `Bearer ${company.accessToken}` },
    });

    expect(response.ok()).toBeTruthy();

    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    const contentDisposition = response.headers()['content-disposition'];
    expect(contentDisposition).toContain('attachment');
    expect(contentDisposition).toContain('.xlsx');
  });

  test('Job seeker cannot access applicant endpoints', async ({ request }) => {
    const company = await registerCompany(request);
    const admin = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    activateCompany(company.companyId, admin.userId);
    const jobId = createActiveJob(company.companyId, company.userId);

    const seeker = await registerJobSeeker(request);

    // Try to list applicants
    const response = await request.get(`${API_BASE}/api/me/jobs/${jobId}/applicants`, {
      headers: { Authorization: `Bearer ${seeker.accessToken}` },
    });

    expect(response.status()).toBe(403);
  });

  test('Company cannot access applicants for another company job', async ({ request }) => {
    const company1 = await registerCompany(request, 'Company One');
    const company2 = await registerCompany(request, 'Company Two');
    const admin = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD);

    activateCompany(company1.companyId, admin.userId);
    const jobId = createActiveJob(company1.companyId, company1.userId);

    // Company 2 tries to access Company 1's applicants
    const response = await request.get(`${API_BASE}/api/me/jobs/${jobId}/applicants`, {
      headers: { Authorization: `Bearer ${company2.accessToken}` },
    });

    expect(response.status()).toBe(404);
  });

  test('Unauthenticated user cannot access applicant endpoints', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/me/jobs/00000000-0000-0000-0000-000000000000/applicants`);
    expect(response.status()).toBe(401);
  });
});
