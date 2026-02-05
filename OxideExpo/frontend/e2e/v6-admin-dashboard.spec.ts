import { test, expect } from '@playwright/test';
const { execSync } = require('child_process');

// Base URL for the API (backend runs on port 8080 in Docker)
const API_BASE = 'http://localhost:8080';

// Test admin credentials (created in database setup)
const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASSWORD = 'AdminSecure123';

// Helper to generate unique test emails
const uniqueEmail = () => `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;

// Helper to login as admin
async function loginAsAdmin(request: any) {
  const response = await request.post(`${API_BASE}/api/auth/login`, {
    data: {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    },
  });

  if (!response.ok()) {
    console.log('Admin login failed:', await response.text());
    throw new Error('Admin login failed');
  }

  const body = await response.json();
  return {
    accessToken: body.access_token,
    userId: body.user.id,
  };
}

// Helper to register a company and return auth tokens
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

  // Get company_id from the profile
  const profileResponse = await request.get(`${API_BASE}/api/me/company/profile`, {
    headers: { Authorization: `Bearer ${body.access_token}` },
  });
  const profile = await profileResponse.json();

  return {
    email,
    userId: body.user.id,
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    companyId: profile.id,
    companyName: profile.company_name,
  };
}

// Helper to create a job for a company (directly via SQL since company needs to be active)
async function createPendingJob(companyId: string, userId: string): Promise<string> {
  const jobTitle = `Test Job ${Date.now()}`;
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 30);
  const deadlineStr = deadline.toISOString().split('T')[0];

  const sql = `INSERT INTO jobs (company_id, posted_by, title, description, job_type, work_modality, application_deadline, vacancies, status) VALUES ('${companyId}', '${userId}', '${jobTitle}', 'Test job description for E2E testing', 'full_time', 'on_site', '${deadlineStr}', 1, 'pending_approval') RETURNING id`;

  const cmd = `docker exec empleos_db_dev psql -U postgres -d empleos_inclusivos -t -A -c "${sql}"`;
  const result = execSync(cmd, { encoding: 'utf8' }).trim().split('\n')[0].trim();
  return result;
}

// Helper to activate a company via database (bypassing admin approval for job creation)
async function activateCompanyForTesting(companyId: string, approverId: string) {
  const sql = `UPDATE company_profiles SET status = 'active'::organization_status, approved_at = NOW(), approved_by = '${approverId}' WHERE id = '${companyId}'`;
  const cmd = `docker exec empleos_db_dev psql -U postgres -d empleos_inclusivos -c "${sql}"`;
  execSync(cmd, { encoding: 'utf8' });
}

// Helper to reset company to pending status
async function resetCompanyToPending(companyId: string) {
  const sql = `UPDATE company_profiles SET status = 'pending_approval'::organization_status, approved_at = NULL, approved_by = NULL, rejection_reason = NULL WHERE id = '${companyId}'`;
  const cmd = `docker exec empleos_db_dev psql -U postgres -d empleos_inclusivos -c "${sql}"`;
  execSync(cmd, { encoding: 'utf8' });
}

// Helper to get audit logs for an entity
async function getAuditLogsForEntity(entityType: string, entityId: string): Promise<any[]> {
  const sql = `SELECT * FROM admin_audit_logs WHERE entity_type = '${entityType}' AND entity_id = '${entityId}' ORDER BY created_at DESC`;
  const cmd = `docker exec empleos_db_dev psql -U postgres -d empleos_inclusivos -t -A -F'|' -c "${sql}"`;
  const result = execSync(cmd, { encoding: 'utf8' }).trim();
  if (!result) return [];

  return result.split('\n').map((row: string) => {
    const [id, admin_id, action_type, entity_type, entity_id, details, ip_address, created_at] = row.split('|');
    return { id, admin_id, action_type, entity_type, entity_id, details, ip_address, created_at };
  });
}

test.describe('V6: Admin Dashboard', () => {
  test.describe('Admin Authentication', () => {
    test('admin can login with valid credentials', async ({ request }) => {
      const response = await request.post(`${API_BASE}/api/auth/login`, {
        data: {
          email: ADMIN_EMAIL,
          password: ADMIN_PASSWORD,
        },
      });

      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      expect(body.access_token).toBeDefined();
      expect(body.user.email).toBe(ADMIN_EMAIL);
    });

    test('non-admin user cannot access admin endpoints', async ({ request }) => {
      // Register a regular company user
      const { accessToken } = await registerCompany(request);

      // Try to access admin dashboard
      const response = await request.get(`${API_BASE}/api/admin/dashboard/stats`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      expect(response.status()).toBe(403);
    });

    test('unauthenticated request to admin endpoint returns 401', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/admin/dashboard/stats`);
      expect(response.status()).toBe(401);
    });
  });

  test.describe('Dashboard Stats', () => {
    test('GET /api/admin/dashboard/stats returns overview statistics', async ({ request }) => {
      const { accessToken } = await loginAsAdmin(request);

      const response = await request.get(`${API_BASE}/api/admin/dashboard/stats`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      expect(response.ok()).toBeTruthy();
      const stats = await response.json();

      // Verify all expected fields are present
      expect(stats.total_users).toBeGreaterThanOrEqual(0);
      expect(stats.new_users_today).toBeGreaterThanOrEqual(0);
      expect(stats.new_users_this_week).toBeGreaterThanOrEqual(0);
      expect(stats.new_users_this_month).toBeGreaterThanOrEqual(0);
      expect(stats.total_companies).toBeGreaterThanOrEqual(0);
      expect(stats.pending_companies).toBeGreaterThanOrEqual(0);
      expect(stats.active_companies).toBeGreaterThanOrEqual(0);
      expect(stats.total_jobs).toBeGreaterThanOrEqual(0);
      expect(stats.active_jobs).toBeGreaterThanOrEqual(0);
      expect(stats.pending_jobs).toBeGreaterThanOrEqual(0);
      expect(stats.total_applications).toBeGreaterThanOrEqual(0);
      expect(stats.flagged_content_pending).toBeGreaterThanOrEqual(0);
    });

    // Note: This test is skipped because parallel test execution causes unpredictable counts
    test.skip('dashboard stats reflect new company registration', async ({ request }) => {
      const { accessToken: adminToken } = await loginAsAdmin(request);

      // Get initial stats
      const initialResponse = await request.get(`${API_BASE}/api/admin/dashboard/stats`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const initialStats = await initialResponse.json();

      // Register a new company
      await registerCompany(request);

      // Get updated stats
      const updatedResponse = await request.get(`${API_BASE}/api/admin/dashboard/stats`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const updatedStats = await updatedResponse.json();

      // Verify counts increased
      expect(updatedStats.total_users).toBe(initialStats.total_users + 1);
      expect(updatedStats.total_companies).toBe(initialStats.total_companies + 1);
      expect(updatedStats.pending_companies).toBe(initialStats.pending_companies + 1);
    });
  });

  test.describe('Company Approval Workflow', () => {
    test('GET /api/admin/companies/pending lists companies awaiting approval', async ({ request }) => {
      const { accessToken: adminToken } = await loginAsAdmin(request);

      // Register a new company (starts as pending)
      const company = await registerCompany(request, `Pending Company ${Date.now()}`);

      // Get pending companies
      const response = await request.get(`${API_BASE}/api/admin/companies/pending`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      expect(response.ok()).toBeTruthy();
      const pendingCompanies = await response.json();

      // Find our test company
      const testCompany = pendingCompanies.find((c: any) => c.id === company.companyId);
      expect(testCompany).toBeDefined();
      expect(testCompany.status).toBe('pending_approval');
      expect(testCompany.company_name).toBe(company.companyName);
    });

    test('PATCH /api/admin/companies/{id}/approve activates a company', async ({ request }) => {
      const { accessToken: adminToken, userId: adminId } = await loginAsAdmin(request);

      // Register a new company
      const company = await registerCompany(request, `Company To Approve ${Date.now()}`);

      // Approve the company
      const approveResponse = await request.patch(
        `${API_BASE}/api/admin/companies/${company.companyId}/approve`,
        {
          headers: { Authorization: `Bearer ${adminToken}` },
          data: {
            approval_notes: 'Approved during E2E test',
          },
        }
      );

      expect(approveResponse.ok()).toBeTruthy();
      const approvedCompany = await approveResponse.json();

      // Verify company is now active
      expect(approvedCompany.status).toBe('active');
      expect(approvedCompany.approved_at).not.toBeNull();
      expect(approvedCompany.approved_by).toBe(adminId);
      expect(approvedCompany.rejection_reason).toBeNull();

      // Verify company is no longer in pending list
      const pendingResponse = await request.get(`${API_BASE}/api/admin/companies/pending`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const pendingCompanies = await pendingResponse.json();
      const stillPending = pendingCompanies.find((c: any) => c.id === company.companyId);
      expect(stillPending).toBeUndefined();
    });

    test('PATCH /api/admin/companies/{id}/reject rejects a company with reason', async ({ request }) => {
      const { accessToken: adminToken, userId: adminId } = await loginAsAdmin(request);

      // Register a new company
      const company = await registerCompany(request, `Company To Reject ${Date.now()}`);

      // Reject the company
      const rejectionReason = 'Invalid business documentation provided during E2E test';
      const rejectResponse = await request.patch(
        `${API_BASE}/api/admin/companies/${company.companyId}/reject`,
        {
          headers: { Authorization: `Bearer ${adminToken}` },
          data: {
            rejection_reason: rejectionReason,
          },
        }
      );

      expect(rejectResponse.ok()).toBeTruthy();
      const rejectedCompany = await rejectResponse.json();

      // Verify company is rejected
      expect(rejectedCompany.status).toBe('rejected');
      expect(rejectedCompany.rejection_reason).toBe(rejectionReason);
      expect(rejectedCompany.approved_by).toBe(adminId);
    });

    test('cannot approve already active company', async ({ request }) => {
      const { accessToken: adminToken, userId: adminId } = await loginAsAdmin(request);

      // Register and immediately approve a company
      const company = await registerCompany(request, `Already Active Company ${Date.now()}`);
      await activateCompanyForTesting(company.companyId, adminId);

      // Try to approve again
      const response = await request.patch(
        `${API_BASE}/api/admin/companies/${company.companyId}/approve`,
        {
          headers: { Authorization: `Bearer ${adminToken}` },
          data: {},
        }
      );

      expect(response.status()).toBe(400);
      const error = await response.json();
      expect(error.error).toContain('not pending approval');
    });

    test('rejection requires a reason', async ({ request }) => {
      const { accessToken: adminToken } = await loginAsAdmin(request);

      // Register a new company
      const company = await registerCompany(request, `Company Needs Reason ${Date.now()}`);

      // Try to reject without reason (should fail validation)
      const response = await request.patch(
        `${API_BASE}/api/admin/companies/${company.companyId}/reject`,
        {
          headers: { Authorization: `Bearer ${adminToken}` },
          data: {
            rejection_reason: 'short', // Too short (min 10 chars)
          },
        }
      );

      expect(response.status()).toBe(400);
    });
  });

  test.describe('Job Moderation Workflow', () => {
    test('GET /api/admin/jobs/pending lists jobs awaiting approval', async ({ request }) => {
      const { accessToken: adminToken, userId: adminId } = await loginAsAdmin(request);

      // Register and activate a company
      const company = await registerCompany(request, `Company With Jobs ${Date.now()}`);
      await activateCompanyForTesting(company.companyId, adminId);

      // Create a pending job via SQL
      const jobId = await createPendingJob(company.companyId, company.userId);

      // Get pending jobs
      const response = await request.get(`${API_BASE}/api/admin/jobs/pending`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      expect(response.ok()).toBeTruthy();
      const pendingJobs = await response.json();

      // Find our test job
      const testJob = pendingJobs.find((j: any) => j.id === jobId);
      expect(testJob).toBeDefined();
      expect(testJob.status).toBe('pending_approval');
    });

    test('PATCH /api/admin/jobs/{id}/approve activates a job', async ({ request }) => {
      const { accessToken: adminToken, userId: adminId } = await loginAsAdmin(request);

      // Register and activate a company
      const company = await registerCompany(request, `Company For Job Approval ${Date.now()}`);
      await activateCompanyForTesting(company.companyId, adminId);

      // Create a pending job
      const jobId = await createPendingJob(company.companyId, company.userId);

      // Approve the job
      const approveResponse = await request.patch(
        `${API_BASE}/api/admin/jobs/${jobId}/approve`,
        {
          headers: { Authorization: `Bearer ${adminToken}` },
          data: {
            approval_notes: 'Job approved during E2E test',
          },
        }
      );

      expect(approveResponse.ok()).toBeTruthy();
      const approvedJob = await approveResponse.json();

      // Verify job is now active
      expect(approvedJob.status).toBe('active');
      expect(approvedJob.approved_at).not.toBeNull();
      expect(approvedJob.approved_by).toBe(adminId);
    });

    test('PATCH /api/admin/jobs/{id}/reject rejects a job with reason', async ({ request }) => {
      const { accessToken: adminToken, userId: adminId } = await loginAsAdmin(request);

      // Register and activate a company
      const company = await registerCompany(request, `Company For Job Rejection ${Date.now()}`);
      await activateCompanyForTesting(company.companyId, adminId);

      // Create a pending job
      const jobId = await createPendingJob(company.companyId, company.userId);

      // Reject the job
      const rejectionReason = 'Job posting violates platform guidelines during E2E test';
      const rejectResponse = await request.patch(
        `${API_BASE}/api/admin/jobs/${jobId}/reject`,
        {
          headers: { Authorization: `Bearer ${adminToken}` },
          data: {
            rejection_reason: rejectionReason,
          },
        }
      );

      expect(rejectResponse.ok()).toBeTruthy();
      const rejectedJob = await rejectResponse.json();

      // Verify job is rejected
      expect(rejectedJob.status).toBe('rejected');
      expect(rejectedJob.rejection_reason).toBe(rejectionReason);
    });

    test('returns 404 for non-existent job', async ({ request }) => {
      const { accessToken: adminToken } = await loginAsAdmin(request);

      const fakeJobId = '00000000-0000-0000-0000-000000000000';
      const response = await request.patch(
        `${API_BASE}/api/admin/jobs/${fakeJobId}/approve`,
        {
          headers: { Authorization: `Bearer ${adminToken}` },
          data: {},
        }
      );

      expect(response.status()).toBe(404);
    });
  });

  test.describe('Audit Logging', () => {
    test('company approval creates audit log entry', async ({ request }) => {
      const { accessToken: adminToken, userId: adminId } = await loginAsAdmin(request);

      // Register a new company
      const company = await registerCompany(request, `Audit Test Company ${Date.now()}`);

      // Approve the company
      await request.patch(
        `${API_BASE}/api/admin/companies/${company.companyId}/approve`,
        {
          headers: { Authorization: `Bearer ${adminToken}` },
          data: {
            approval_notes: 'Approved for audit log test',
          },
        }
      );

      // Check audit logs
      const auditLogs = await getAuditLogsForEntity('company', company.companyId);
      expect(auditLogs.length).toBeGreaterThan(0);

      const approvalLog = auditLogs.find((log: any) => log.action_type === 'approve_company');
      expect(approvalLog).toBeDefined();
      expect(approvalLog.entity_type).toBe('company');
      expect(approvalLog.entity_id).toBe(company.companyId);
    });

    test('company rejection creates audit log entry', async ({ request }) => {
      const { accessToken: adminToken } = await loginAsAdmin(request);

      // Register a new company
      const company = await registerCompany(request, `Audit Rejection Test ${Date.now()}`);

      // Reject the company
      await request.patch(
        `${API_BASE}/api/admin/companies/${company.companyId}/reject`,
        {
          headers: { Authorization: `Bearer ${adminToken}` },
          data: {
            rejection_reason: 'Rejected for audit log test verification',
          },
        }
      );

      // Check audit logs
      const auditLogs = await getAuditLogsForEntity('company', company.companyId);
      const rejectionLog = auditLogs.find((log: any) => log.action_type === 'reject_company');
      expect(rejectionLog).toBeDefined();
    });

    test('job approval creates audit log entry', async ({ request }) => {
      const { accessToken: adminToken, userId: adminId } = await loginAsAdmin(request);

      // Register and activate a company
      const company = await registerCompany(request, `Job Audit Test Company ${Date.now()}`);
      await activateCompanyForTesting(company.companyId, adminId);

      // Create and approve a job
      const jobId = await createPendingJob(company.companyId, company.userId);
      await request.patch(
        `${API_BASE}/api/admin/jobs/${jobId}/approve`,
        {
          headers: { Authorization: `Bearer ${adminToken}` },
          data: {},
        }
      );

      // Check audit logs
      const auditLogs = await getAuditLogsForEntity('job', jobId);
      const approvalLog = auditLogs.find((log: any) => log.action_type === 'approve_job');
      expect(approvalLog).toBeDefined();
      expect(approvalLog.entity_type).toBe('job');
      expect(approvalLog.entity_id).toBe(jobId);
    });
  });

  test.describe('End-to-End Company Lifecycle', () => {
    test('complete company lifecycle: register -> approve -> create job -> approve job', async ({
      request,
    }) => {
      const { accessToken: adminToken, userId: adminId } = await loginAsAdmin(request);

      // Step 1: Register a new company
      const company = await registerCompany(request, `Full Lifecycle Company ${Date.now()}`);

      // Verify company starts as pending
      const pendingResponse = await request.get(`${API_BASE}/api/admin/companies/pending`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const pendingCompanies = await pendingResponse.json();
      expect(pendingCompanies.some((c: any) => c.id === company.companyId)).toBeTruthy();

      // Step 2: Admin approves company
      const approveCompanyResponse = await request.patch(
        `${API_BASE}/api/admin/companies/${company.companyId}/approve`,
        {
          headers: { Authorization: `Bearer ${adminToken}` },
          data: { approval_notes: 'Lifecycle test approval' },
        }
      );
      expect(approveCompanyResponse.ok()).toBeTruthy();

      // Step 3: Company can now create a job via API
      const jobResponse = await request.post(`${API_BASE}/api/me/jobs`, {
        headers: { Authorization: `Bearer ${company.accessToken}` },
        data: {
          title: 'Software Engineer',
          description: 'We are looking for a talented software engineer to join our team.',
          job_type: 'full_time',
          work_modality: 'hybrid',
          application_deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0],
          vacancies: 2,
          contact_email: 'jobs@example.com',
        },
      });

      expect(jobResponse.ok()).toBeTruthy();
      const job = await jobResponse.json();
      expect(job.status).toBe('draft'); // Jobs start as draft when created via API

      // Step 4: Company submits job for approval (change status to pending_approval)
      const submitJobResponse = await request.patch(
        `${API_BASE}/api/me/jobs/${job.id}/status`,
        {
          headers: { Authorization: `Bearer ${company.accessToken}` },
          data: { status: 'pending_approval' },
        }
      );
      expect(submitJobResponse.ok()).toBeTruthy();

      // Step 5: Admin approves the job
      const approveJobResponse = await request.patch(
        `${API_BASE}/api/admin/jobs/${job.id}/approve`,
        {
          headers: { Authorization: `Bearer ${adminToken}` },
          data: {},
        }
      );
      expect(approveJobResponse.ok()).toBeTruthy();
      const approvedJob = await approveJobResponse.json();
      expect(approvedJob.status).toBe('active');

      // Step 6: Verify job is now visible in public listings
      const publicJobsResponse = await request.get(`${API_BASE}/api/jobs`);
      expect(publicJobsResponse.ok()).toBeTruthy();
      const publicJobs = await publicJobsResponse.json();
      expect(publicJobs.some((j: any) => j.id === job.id)).toBeTruthy();
    });
  });
});
