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

  // Get the OMIL org ID directly from database (can't use API before org is activated)
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

// Helper to activate OMIL organization
function activateOmil(omilId: string, approverId: string) {
  const sql = `UPDATE omil_organizations SET status = 'active'::organization_status, approved_at = NOW(), approved_by = '${approverId}' WHERE id = '${omilId}'`;
  execSync(`docker exec empleos_db_dev psql -U postgres -d empleos_inclusivos -c "${sql}"`, { encoding: 'utf8' });
}

// Helper to register a managed job seeker
async function registerManagedSeeker(request: any, omilToken: string) {
  const email = uniqueEmail();

  const response = await request.post(`${API_BASE}/api/me/omil/job-seekers`, {
    headers: { Authorization: `Bearer ${omilToken}` },
    data: {
      email,
      first_name: 'Managed',
      last_name: 'Seeker',
      phone: '+56912345678',
      assign_to_self: true,
      notes: 'Test managed seeker',
    },
  });

  expect(response.ok()).toBeTruthy();
  const data = await response.json();
  return {
    managedId: data.id,
    jobSeekerId: data.job_seeker_id,
    email,
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

test.describe('V10 OMIL Integration - Impersonation', () => {
  test('OMIL member can generate impersonation token for managed seeker', async ({ request }) => {
    // Setup
    const omil = await registerOmil(request);
    const admin = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    activateOmil(omil.organizationId, admin.userId);
    const seeker = await registerManagedSeeker(request, omil.accessToken);

    // Generate impersonation token
    const response = await request.get(`${API_BASE}/api/me/omil/job-seekers/${seeker.managedId}/impersonate`, {
      headers: { Authorization: `Bearer ${omil.accessToken}` },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data).toHaveProperty('impersonation_token');
    expect(data).toHaveProperty('expires_at');
    expect(data).toHaveProperty('job_seeker_id', seeker.jobSeekerId);
    expect(data).toHaveProperty('job_seeker_name');
  });

  test('Impersonation token can be used to access profile endpoints', async ({ request }) => {
    // Setup
    const omil = await registerOmil(request);
    const admin = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    activateOmil(omil.organizationId, admin.userId);
    const seeker = await registerManagedSeeker(request, omil.accessToken);

    // Generate impersonation token
    const impResponse = await request.get(`${API_BASE}/api/me/omil/job-seekers/${seeker.managedId}/impersonate`, {
      headers: { Authorization: `Bearer ${omil.accessToken}` },
    });
    const impData = await impResponse.json();

    // Use impersonation token to get profile
    const profileResponse = await request.get(`${API_BASE}/api/me/profile`, {
      headers: { Authorization: `Bearer ${impData.impersonation_token}` },
    });

    expect(profileResponse.ok()).toBeTruthy();
    const profile = await profileResponse.json();
    expect(profile).toHaveProperty('user_id', seeker.jobSeekerId);
  });

  test('Cannot impersonate non-managed job seeker', async ({ request }) => {
    // Setup
    const omil = await registerOmil(request);
    const admin = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    activateOmil(omil.organizationId, admin.userId);

    // Try to impersonate with random UUID
    const response = await request.get(`${API_BASE}/api/me/omil/job-seekers/00000000-0000-0000-0000-000000000000/impersonate`, {
      headers: { Authorization: `Bearer ${omil.accessToken}` },
    });

    expect(response.status()).toBe(404);
  });

  test('Non-OMIL member cannot access impersonation endpoint', async ({ request }) => {
    // Register a regular job seeker
    const email = uniqueEmail();
    const regResponse = await request.post(`${API_BASE}/api/auth/register`, {
      data: {
        email,
        password: 'SecurePassword123',
        first_name: 'Regular',
        last_name: 'User',
      },
    });
    const regData = await regResponse.json();

    // Activate the account
    const activateSql = `UPDATE users SET account_status = 'active', email_verified_at = NOW() WHERE id = '${regData.user.id}'`;
    execSync(`docker exec empleos_db_dev psql -U postgres -d empleos_inclusivos -c "${activateSql}"`, { encoding: 'utf8' });

    // Try to access impersonation endpoint
    const response = await request.get(`${API_BASE}/api/me/omil/job-seekers/00000000-0000-0000-0000-000000000000/impersonate`, {
      headers: { Authorization: `Bearer ${regData.access_token}` },
    });

    expect(response.status()).toBe(403);
  });
});

test.describe('V10 OMIL Integration - Export', () => {
  test('OMIL member can export managed seekers to Excel', async ({ request }) => {
    // Setup
    const omil = await registerOmil(request);
    const admin = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    activateOmil(omil.organizationId, admin.userId);

    // Register some managed seekers
    await registerManagedSeeker(request, omil.accessToken);
    await registerManagedSeeker(request, omil.accessToken);

    // Export to Excel
    const response = await request.get(`${API_BASE}/api/me/omil/job-seekers/export`, {
      headers: { Authorization: `Bearer ${omil.accessToken}` },
    });

    expect(response.ok()).toBeTruthy();
    expect(response.headers()['content-type']).toContain('spreadsheetml');
    expect(response.headers()['content-disposition']).toContain('attachment');
    expect(response.headers()['content-disposition']).toContain('.xlsx');
  });

  test('Export supports placement filter', async ({ request }) => {
    // Setup
    const omil = await registerOmil(request);
    const admin = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    activateOmil(omil.organizationId, admin.userId);

    // Register a seeker
    await registerManagedSeeker(request, omil.accessToken);

    // Export with filter
    const response = await request.get(`${API_BASE}/api/me/omil/job-seekers/export?placement_outcome=pending`, {
      headers: { Authorization: `Bearer ${omil.accessToken}` },
    });

    expect(response.ok()).toBeTruthy();
  });

  test('Unauthenticated user cannot export', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/me/omil/job-seekers/export`);
    expect(response.status()).toBe(401);
  });
});

test.describe('V10 OMIL Integration - Applications List', () => {
  test('OMIL member can list applications submitted by OMIL', async ({ request }) => {
    // Setup OMIL
    const omil = await registerOmil(request);
    const admin = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    activateOmil(omil.organizationId, admin.userId);

    // Setup company and job
    const company = await registerCompany(request);
    activateCompany(company.companyId, admin.userId);
    const jobId = createActiveJob(company.companyId, company.userId);

    // Register managed seeker and apply on their behalf
    const seeker = await registerManagedSeeker(request, omil.accessToken);
    await request.post(`${API_BASE}/api/me/omil/job-seekers/${seeker.managedId}/apply`, {
      headers: { Authorization: `Bearer ${omil.accessToken}` },
      data: {
        job_id: jobId,
        cover_letter: 'Applied by OMIL',
      },
    });

    // List OMIL applications
    const response = await request.get(`${API_BASE}/api/me/omil/applications`, {
      headers: { Authorization: `Bearer ${omil.accessToken}` },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data).toHaveProperty('applications');
    expect(data).toHaveProperty('total');
    expect(data.total).toBeGreaterThanOrEqual(1);

    const app = data.applications[0];
    expect(app).toHaveProperty('application_id');
    expect(app).toHaveProperty('job_id', jobId);
    expect(app).toHaveProperty('job_title');
    expect(app).toHaveProperty('company_name');
    expect(app).toHaveProperty('job_seeker_id', seeker.jobSeekerId);
    expect(app).toHaveProperty('status');
    expect(app).toHaveProperty('submitted_by');
  });

  test('Applications list supports pagination', async ({ request }) => {
    // Setup
    const omil = await registerOmil(request);
    const admin = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    activateOmil(omil.organizationId, admin.userId);

    // List with pagination params
    const response = await request.get(`${API_BASE}/api/me/omil/applications?limit=5&offset=0`, {
      headers: { Authorization: `Bearer ${omil.accessToken}` },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data).toHaveProperty('applications');
    expect(data).toHaveProperty('total');
    expect(data.applications.length).toBeLessThanOrEqual(5);
  });

  test('Applications list supports job seeker filter', async ({ request }) => {
    // Setup OMIL
    const omil = await registerOmil(request);
    const admin = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    activateOmil(omil.organizationId, admin.userId);

    // Setup company and job
    const company = await registerCompany(request);
    activateCompany(company.companyId, admin.userId);
    const jobId = createActiveJob(company.companyId, company.userId);

    // Register multiple seekers and apply with one
    const seeker1 = await registerManagedSeeker(request, omil.accessToken);
    await registerManagedSeeker(request, omil.accessToken);

    await request.post(`${API_BASE}/api/me/omil/job-seekers/${seeker1.managedId}/apply`, {
      headers: { Authorization: `Bearer ${omil.accessToken}` },
      data: { job_id: jobId },
    });

    // Filter by job seeker
    const response = await request.get(`${API_BASE}/api/me/omil/applications?job_seeker_id=${seeker1.jobSeekerId}`, {
      headers: { Authorization: `Bearer ${omil.accessToken}` },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    // All returned applications should be for this seeker
    for (const app of data.applications) {
      expect(app.job_seeker_id).toBe(seeker1.jobSeekerId);
    }
  });

  test('Unauthenticated user cannot list OMIL applications', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/me/omil/applications`);
    expect(response.status()).toBe(401);
  });
});
