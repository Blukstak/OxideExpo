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
  const jobTitle = `Saveable Job ${Date.now()}`;
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 30);
  const deadlineStr = deadline.toISOString().split('T')[0];

  const jobSql = `INSERT INTO jobs (company_id, posted_by, title, description, job_type, work_modality, application_deadline, vacancies, status, approved_at, approved_by) VALUES ('${companyId}', '${userId}', '${jobTitle}', 'Test job for saving', 'full_time', 'on_site', '${deadlineStr}', 1, 'active', NOW(), '${userId}') RETURNING id`;
  const cmd = `docker exec empleos_db_dev psql -U postgres -d empleos_inclusivos -t -A -c "${jobSql}"`;
  return execSync(cmd, { encoding: 'utf8' }).trim().split('\n')[0].trim();
}

test.describe('V9 Saved Jobs (Favorites)', () => {
  test('Job seeker can save a job', async ({ request }) => {
    // Setup
    const company = await registerCompany(request);
    const admin = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    activateCompany(company.companyId, admin.userId);
    const jobId = createActiveJob(company.companyId, company.userId);

    const seeker = await registerJobSeeker(request);

    // Save the job
    const response = await request.post(`${API_BASE}/api/me/saved-jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${seeker.accessToken}` },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data).toHaveProperty('saved_job_id');
    expect(data).toHaveProperty('job_id', jobId);
    expect(data).toHaveProperty('message');
  });

  test('Job seeker can list saved jobs', async ({ request }) => {
    const company = await registerCompany(request);
    const admin = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    activateCompany(company.companyId, admin.userId);
    const jobId1 = createActiveJob(company.companyId, company.userId);
    const jobId2 = createActiveJob(company.companyId, company.userId);

    const seeker = await registerJobSeeker(request);

    // Save both jobs
    await request.post(`${API_BASE}/api/me/saved-jobs/${jobId1}`, {
      headers: { Authorization: `Bearer ${seeker.accessToken}` },
    });
    await request.post(`${API_BASE}/api/me/saved-jobs/${jobId2}`, {
      headers: { Authorization: `Bearer ${seeker.accessToken}` },
    });

    // List saved jobs
    const response = await request.get(`${API_BASE}/api/me/saved-jobs`, {
      headers: { Authorization: `Bearer ${seeker.accessToken}` },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data).toHaveProperty('saved_jobs');
    expect(data).toHaveProperty('total');
    expect(data.total).toBeGreaterThanOrEqual(2);
    expect(Array.isArray(data.saved_jobs)).toBeTruthy();

    // Verify structure of saved jobs
    const savedJob = data.saved_jobs[0];
    expect(savedJob).toHaveProperty('saved_job');
    expect(savedJob).toHaveProperty('job');
    expect(savedJob.job).toHaveProperty('title');
    expect(savedJob.job).toHaveProperty('company_name');
  });

  test('Job seeker can unsave a job', async ({ request }) => {
    const company = await registerCompany(request);
    const admin = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    activateCompany(company.companyId, admin.userId);
    const jobId = createActiveJob(company.companyId, company.userId);

    const seeker = await registerJobSeeker(request);

    // Save the job
    await request.post(`${API_BASE}/api/me/saved-jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${seeker.accessToken}` },
    });

    // Unsave the job
    const response = await request.delete(`${API_BASE}/api/me/saved-jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${seeker.accessToken}` },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty('message');

    // Verify job is no longer in saved list
    const listResponse = await request.get(`${API_BASE}/api/me/saved-jobs`, {
      headers: { Authorization: `Bearer ${seeker.accessToken}` },
    });
    const listData = await listResponse.json();

    const stillSaved = listData.saved_jobs.some((sj: any) => sj.job.id === jobId);
    expect(stillSaved).toBeFalsy();
  });

  test('Job seeker can check if a job is saved', async ({ request }) => {
    const company = await registerCompany(request);
    const admin = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    activateCompany(company.companyId, admin.userId);
    const jobId = createActiveJob(company.companyId, company.userId);

    const seeker = await registerJobSeeker(request);

    // Check before saving
    const beforeResponse = await request.get(`${API_BASE}/api/me/saved-jobs/${jobId}/check`, {
      headers: { Authorization: `Bearer ${seeker.accessToken}` },
    });

    expect(beforeResponse.ok()).toBeTruthy();
    const beforeData = await beforeResponse.json();
    expect(beforeData).toHaveProperty('job_id', jobId);
    expect(beforeData).toHaveProperty('is_saved', false);

    // Save the job
    await request.post(`${API_BASE}/api/me/saved-jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${seeker.accessToken}` },
    });

    // Check after saving
    const afterResponse = await request.get(`${API_BASE}/api/me/saved-jobs/${jobId}/check`, {
      headers: { Authorization: `Bearer ${seeker.accessToken}` },
    });

    expect(afterResponse.ok()).toBeTruthy();
    const afterData = await afterResponse.json();
    expect(afterData).toHaveProperty('is_saved', true);
  });

  test('Cannot save the same job twice', async ({ request }) => {
    const company = await registerCompany(request);
    const admin = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    activateCompany(company.companyId, admin.userId);
    const jobId = createActiveJob(company.companyId, company.userId);

    const seeker = await registerJobSeeker(request);

    // Save the job first time
    const firstSave = await request.post(`${API_BASE}/api/me/saved-jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${seeker.accessToken}` },
    });
    expect(firstSave.ok()).toBeTruthy();

    // Try to save again
    const secondSave = await request.post(`${API_BASE}/api/me/saved-jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${seeker.accessToken}` },
    });
    expect(secondSave.status()).toBe(400);
  });

  test('Cannot save a non-existent job', async ({ request }) => {
    const seeker = await registerJobSeeker(request);

    const response = await request.post(`${API_BASE}/api/me/saved-jobs/00000000-0000-0000-0000-000000000000`, {
      headers: { Authorization: `Bearer ${seeker.accessToken}` },
    });

    expect(response.status()).toBe(404);
  });

  test('Cannot unsave a job that was not saved', async ({ request }) => {
    const company = await registerCompany(request);
    const admin = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    activateCompany(company.companyId, admin.userId);
    const jobId = createActiveJob(company.companyId, company.userId);

    const seeker = await registerJobSeeker(request);

    const response = await request.delete(`${API_BASE}/api/me/saved-jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${seeker.accessToken}` },
    });

    expect(response.status()).toBe(404);
  });

  test('Company member cannot access saved jobs endpoints', async ({ request }) => {
    const company = await registerCompany(request);
    const admin = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    activateCompany(company.companyId, admin.userId);
    const jobId = createActiveJob(company.companyId, company.userId);

    // Try to save a job as company member
    const saveResponse = await request.post(`${API_BASE}/api/me/saved-jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${company.accessToken}` },
    });
    expect(saveResponse.status()).toBe(403);

    // Try to list saved jobs
    const listResponse = await request.get(`${API_BASE}/api/me/saved-jobs`, {
      headers: { Authorization: `Bearer ${company.accessToken}` },
    });
    expect(listResponse.status()).toBe(403);
  });

  test('Saved jobs list supports pagination', async ({ request }) => {
    const company = await registerCompany(request);
    const admin = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    activateCompany(company.companyId, admin.userId);

    const seeker = await registerJobSeeker(request);

    // Create and save multiple jobs
    for (let i = 0; i < 5; i++) {
      const jobId = createActiveJob(company.companyId, company.userId);
      await request.post(`${API_BASE}/api/me/saved-jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${seeker.accessToken}` },
      });
    }

    // Get with pagination
    const response = await request.get(`${API_BASE}/api/me/saved-jobs?limit=2&offset=0`, {
      headers: { Authorization: `Bearer ${seeker.accessToken}` },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data.saved_jobs.length).toBe(2);
    expect(data.total).toBeGreaterThanOrEqual(5);
  });

  test('Unauthenticated user cannot access saved jobs endpoints', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/me/saved-jobs`);
    expect(response.status()).toBe(401);
  });
});
