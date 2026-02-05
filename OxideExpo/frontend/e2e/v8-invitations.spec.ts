import { test, expect } from '@playwright/test';
const { execSync } = require('child_process');

// Base URL for the API
const API_BASE = 'http://localhost:8080';

// Helper to generate unique test emails
const uniqueEmail = () => `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;

// Helper to register a job seeker
async function registerJobSeeker(request: any) {
  const email = uniqueEmail();
  const response = await request.post(`${API_BASE}/api/auth/register`, {
    data: {
      email,
      password: 'SecurePassword123',
      first_name: 'Job',
      last_name: 'Seeker',
    },
  });

  expect(response.ok()).toBeTruthy();
  const body = await response.json();

  return {
    email,
    userId: body.user.id,
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
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

// Helper to activate a company
async function activateCompanyForTesting(companyId: string, approverId: string) {
  const sql = `UPDATE company_profiles SET status = 'active'::organization_status, approved_at = NOW(), approved_by = '${approverId}' WHERE id = '${companyId}'`;
  const cmd = `docker exec empleos_db_dev psql -U postgres -d empleos_inclusivos -c "${sql}"`;
  execSync(cmd, { encoding: 'utf8' });
}

// Helper to create an active job
async function createActiveJob(companyId: string, userId: string): Promise<string> {
  const jobTitle = `Test Job ${Date.now()}`;
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 30);
  const deadlineStr = deadline.toISOString().split('T')[0];

  const sql = `INSERT INTO jobs (company_id, posted_by, title, description, job_type, work_modality, application_deadline, vacancies, status, approved_at, approved_by) VALUES ('${companyId}', '${userId}', '${jobTitle}', 'Test job description', 'full_time', 'on_site', '${deadlineStr}', 1, 'active', NOW(), '${userId}') RETURNING id`;

  const cmd = `docker exec empleos_db_dev psql -U postgres -d empleos_inclusivos -t -A -c "${sql}"`;
  const result = execSync(cmd, { encoding: 'utf8' }).trim().split('\n')[0].trim();
  return result;
}

test.describe('V8: Job Invitations', () => {
  test.describe('Company Sending Invitations', () => {
    test('POST /api/me/jobs/{job_id}/invitations sends invitation to job seeker', async ({ request }) => {
      // Setup: Create company, activate it, create job
      const company = await registerCompany(request);
      await activateCompanyForTesting(company.companyId, company.userId);
      const jobId = await createActiveJob(company.companyId, company.userId);

      // Create job seeker
      const jobSeeker = await registerJobSeeker(request);

      // Send invitation
      const response = await request.post(`${API_BASE}/api/me/jobs/${jobId}/invitations`, {
        headers: { Authorization: `Bearer ${company.accessToken}` },
        data: {
          job_seeker_id: jobSeeker.userId,
          message: 'We think you would be a great fit for this position!',
          expires_in_days: 14,
        },
      });

      expect(response.ok()).toBeTruthy();
      const invitation = await response.json();
      expect(invitation.job_id).toBe(jobId);
      expect(invitation.job_seeker_id).toBe(jobSeeker.userId);
      expect(invitation.status).toBe('pending');
      expect(invitation.message).toContain('great fit');
    });

    test('cannot send duplicate invitation', async ({ request }) => {
      const company = await registerCompany(request);
      await activateCompanyForTesting(company.companyId, company.userId);
      const jobId = await createActiveJob(company.companyId, company.userId);
      const jobSeeker = await registerJobSeeker(request);

      // Send first invitation
      const firstResponse = await request.post(`${API_BASE}/api/me/jobs/${jobId}/invitations`, {
        headers: { Authorization: `Bearer ${company.accessToken}` },
        data: {
          job_seeker_id: jobSeeker.userId,
        },
      });
      expect(firstResponse.ok()).toBeTruthy();

      // Try to send duplicate
      const secondResponse = await request.post(`${API_BASE}/api/me/jobs/${jobId}/invitations`, {
        headers: { Authorization: `Bearer ${company.accessToken}` },
        data: {
          job_seeker_id: jobSeeker.userId,
        },
      });

      expect(secondResponse.status()).toBe(400);
      const error = await secondResponse.json();
      expect(error.error).toContain('already sent');
    });

    test('GET /api/me/jobs/{job_id}/invitations lists invitations for job', async ({ request }) => {
      const company = await registerCompany(request);
      await activateCompanyForTesting(company.companyId, company.userId);
      const jobId = await createActiveJob(company.companyId, company.userId);

      // Send invitations to multiple job seekers
      const jobSeeker1 = await registerJobSeeker(request);
      const jobSeeker2 = await registerJobSeeker(request);

      await request.post(`${API_BASE}/api/me/jobs/${jobId}/invitations`, {
        headers: { Authorization: `Bearer ${company.accessToken}` },
        data: { job_seeker_id: jobSeeker1.userId },
      });
      await request.post(`${API_BASE}/api/me/jobs/${jobId}/invitations`, {
        headers: { Authorization: `Bearer ${company.accessToken}` },
        data: { job_seeker_id: jobSeeker2.userId },
      });

      // List invitations
      const response = await request.get(`${API_BASE}/api/me/jobs/${jobId}/invitations`, {
        headers: { Authorization: `Bearer ${company.accessToken}` },
      });

      expect(response.ok()).toBeTruthy();
      const invitations = await response.json();
      expect(invitations).toBeInstanceOf(Array);
      expect(invitations.length).toBe(2);
    });

    test('cannot invite non-job-seeker user', async ({ request }) => {
      const company = await registerCompany(request);
      await activateCompanyForTesting(company.companyId, company.userId);
      const jobId = await createActiveJob(company.companyId, company.userId);

      // Create another company user (not a job seeker)
      const otherCompany = await registerCompany(request);

      // Try to invite company user
      const response = await request.post(`${API_BASE}/api/me/jobs/${jobId}/invitations`, {
        headers: { Authorization: `Bearer ${company.accessToken}` },
        data: {
          job_seeker_id: otherCompany.userId,
        },
      });

      expect(response.status()).toBe(400);
      const error = await response.json();
      expect(error.error).toContain('job seekers');
    });
  });

  test.describe('Job Seeker Receiving Invitations', () => {
    test('GET /api/me/invitations lists received invitations', async ({ request }) => {
      // Setup
      const company = await registerCompany(request);
      await activateCompanyForTesting(company.companyId, company.userId);
      const jobId = await createActiveJob(company.companyId, company.userId);
      const jobSeeker = await registerJobSeeker(request);

      // Company sends invitation
      await request.post(`${API_BASE}/api/me/jobs/${jobId}/invitations`, {
        headers: { Authorization: `Bearer ${company.accessToken}` },
        data: {
          job_seeker_id: jobSeeker.userId,
          message: 'Please apply!',
        },
      });

      // Job seeker lists invitations
      const response = await request.get(`${API_BASE}/api/me/invitations`, {
        headers: { Authorization: `Bearer ${jobSeeker.accessToken}` },
      });

      expect(response.ok()).toBeTruthy();
      const invitations = await response.json();
      expect(invitations).toBeInstanceOf(Array);
      expect(invitations.length).toBeGreaterThan(0);
      expect(invitations[0].invitation).toBeDefined();
      expect(invitations[0].job).toBeDefined();
      expect(invitations[0].company_name).toBeDefined();
    });

    test('GET /api/me/invitations/{id} marks invitation as viewed', async ({ request }) => {
      const company = await registerCompany(request);
      await activateCompanyForTesting(company.companyId, company.userId);
      const jobId = await createActiveJob(company.companyId, company.userId);
      const jobSeeker = await registerJobSeeker(request);

      // Send invitation
      const sendResponse = await request.post(`${API_BASE}/api/me/jobs/${jobId}/invitations`, {
        headers: { Authorization: `Bearer ${company.accessToken}` },
        data: { job_seeker_id: jobSeeker.userId },
      });
      const sent = await sendResponse.json();
      expect(sent.status).toBe('pending');

      // Job seeker views invitation
      const response = await request.get(`${API_BASE}/api/me/invitations/${sent.id}`, {
        headers: { Authorization: `Bearer ${jobSeeker.accessToken}` },
      });

      expect(response.ok()).toBeTruthy();
      const viewed = await response.json();
      expect(viewed.invitation.status).toBe('viewed');
      expect(viewed.invitation.viewed_at).not.toBeNull();
    });

    test('POST /api/me/invitations/{id}/respond accepts invitation and creates application', async ({ request }) => {
      const company = await registerCompany(request);
      await activateCompanyForTesting(company.companyId, company.userId);
      const jobId = await createActiveJob(company.companyId, company.userId);
      const jobSeeker = await registerJobSeeker(request);

      // Send invitation
      const sendResponse = await request.post(`${API_BASE}/api/me/jobs/${jobId}/invitations`, {
        headers: { Authorization: `Bearer ${company.accessToken}` },
        data: { job_seeker_id: jobSeeker.userId },
      });
      const sent = await sendResponse.json();

      // Accept invitation
      const response = await request.post(`${API_BASE}/api/me/invitations/${sent.id}/respond`, {
        headers: { Authorization: `Bearer ${jobSeeker.accessToken}` },
        data: {
          accept: true,
          cover_letter: 'Thank you for the invitation! I am very interested in this position.',
        },
      });

      expect(response.ok()).toBeTruthy();
      const result = await response.json();
      expect(result.status).toBe('applied');
      expect(result.responded_at).not.toBeNull();

      // Verify application was created
      const applicationsResponse = await request.get(`${API_BASE}/api/me/applications`, {
        headers: { Authorization: `Bearer ${jobSeeker.accessToken}` },
      });
      const applications = await applicationsResponse.json();
      // ApplicationWithJobDetails has nested structure: { application: { job_id }, job: {} }
      const application = applications.find((a: any) => a.application.job_id === jobId);
      expect(application).toBeDefined();
    });

    test('POST /api/me/invitations/{id}/respond declines invitation', async ({ request }) => {
      const company = await registerCompany(request);
      await activateCompanyForTesting(company.companyId, company.userId);
      const jobId = await createActiveJob(company.companyId, company.userId);
      const jobSeeker = await registerJobSeeker(request);

      // Send invitation
      const sendResponse = await request.post(`${API_BASE}/api/me/jobs/${jobId}/invitations`, {
        headers: { Authorization: `Bearer ${company.accessToken}` },
        data: { job_seeker_id: jobSeeker.userId },
      });
      const sent = await sendResponse.json();

      // Decline invitation
      const response = await request.post(`${API_BASE}/api/me/invitations/${sent.id}/respond`, {
        headers: { Authorization: `Bearer ${jobSeeker.accessToken}` },
        data: {
          accept: false,
        },
      });

      expect(response.ok()).toBeTruthy();
      const result = await response.json();
      expect(result.status).toBe('declined');
    });

    test('cannot respond to already responded invitation', async ({ request }) => {
      const company = await registerCompany(request);
      await activateCompanyForTesting(company.companyId, company.userId);
      const jobId = await createActiveJob(company.companyId, company.userId);
      const jobSeeker = await registerJobSeeker(request);

      // Send and accept invitation
      const sendResponse = await request.post(`${API_BASE}/api/me/jobs/${jobId}/invitations`, {
        headers: { Authorization: `Bearer ${company.accessToken}` },
        data: { job_seeker_id: jobSeeker.userId },
      });
      const sent = await sendResponse.json();

      await request.post(`${API_BASE}/api/me/invitations/${sent.id}/respond`, {
        headers: { Authorization: `Bearer ${jobSeeker.accessToken}` },
        data: { accept: true },
      });

      // Try to respond again
      const response = await request.post(`${API_BASE}/api/me/invitations/${sent.id}/respond`, {
        headers: { Authorization: `Bearer ${jobSeeker.accessToken}` },
        data: { accept: false },
      });

      expect(response.status()).toBe(400);
      const error = await response.json();
      expect(error.error).toContain('Already responded');
    });
  });

  test.describe('Authorization', () => {
    test('job seeker cannot send invitations', async ({ request }) => {
      const jobSeeker = await registerJobSeeker(request);
      const company = await registerCompany(request);
      await activateCompanyForTesting(company.companyId, company.userId);
      const jobId = await createActiveJob(company.companyId, company.userId);

      const response = await request.post(`${API_BASE}/api/me/jobs/${jobId}/invitations`, {
        headers: { Authorization: `Bearer ${jobSeeker.accessToken}` },
        data: {
          job_seeker_id: jobSeeker.userId,
        },
      });

      expect(response.status()).toBe(403);
    });

    test('company cannot view job seeker invitations endpoint', async ({ request }) => {
      const company = await registerCompany(request);

      const response = await request.get(`${API_BASE}/api/me/invitations`, {
        headers: { Authorization: `Bearer ${company.accessToken}` },
      });

      expect(response.status()).toBe(403);
    });

    test('cannot invite to inactive job', async ({ request }) => {
      const company = await registerCompany(request);
      await activateCompanyForTesting(company.companyId, company.userId);
      const jobSeeker = await registerJobSeeker(request);

      // Create a draft job (not active)
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + 30);
      const deadlineStr = deadline.toISOString().split('T')[0];
      const sql = `INSERT INTO jobs (company_id, posted_by, title, description, job_type, work_modality, application_deadline, vacancies, status) VALUES ('${company.companyId}', '${company.userId}', 'Draft Job', 'Test', 'full_time', 'on_site', '${deadlineStr}', 1, 'draft') RETURNING id`;
      const cmd = `docker exec empleos_db_dev psql -U postgres -d empleos_inclusivos -t -A -c "${sql}"`;
      const draftJobId = execSync(cmd, { encoding: 'utf8' }).trim().split('\n')[0];

      const response = await request.post(`${API_BASE}/api/me/jobs/${draftJobId}/invitations`, {
        headers: { Authorization: `Bearer ${company.accessToken}` },
        data: {
          job_seeker_id: jobSeeker.userId,
        },
      });

      expect(response.status()).toBe(400);
      const responseText = await response.text();
      expect(responseText).toContain('active');
    });
  });

  test.describe('End-to-End Invitation Flow', () => {
    test('complete invitation lifecycle: send -> view -> accept -> verify application', async ({ request }) => {
      // Setup
      const company = await registerCompany(request, `Invitation Flow Company ${Date.now()}`);
      await activateCompanyForTesting(company.companyId, company.userId);
      const jobId = await createActiveJob(company.companyId, company.userId);
      const jobSeeker = await registerJobSeeker(request);

      // Step 1: Company sends invitation
      const sendResponse = await request.post(`${API_BASE}/api/me/jobs/${jobId}/invitations`, {
        headers: { Authorization: `Bearer ${company.accessToken}` },
        data: {
          job_seeker_id: jobSeeker.userId,
          message: 'We reviewed your profile and think you would be a perfect fit!',
          expires_in_days: 7,
        },
      });
      expect(sendResponse.ok()).toBeTruthy();
      const invitation = await sendResponse.json();
      expect(invitation.status).toBe('pending');

      // Step 2: Job seeker views their invitations
      const listResponse = await request.get(`${API_BASE}/api/me/invitations`, {
        headers: { Authorization: `Bearer ${jobSeeker.accessToken}` },
      });
      expect(listResponse.ok()).toBeTruthy();
      const invitations = await listResponse.json();
      expect(invitations.length).toBe(1);
      expect(invitations[0].invitation.message).toContain('perfect fit');

      // Step 3: Job seeker views invitation detail (marks as viewed)
      const viewResponse = await request.get(`${API_BASE}/api/me/invitations/${invitation.id}`, {
        headers: { Authorization: `Bearer ${jobSeeker.accessToken}` },
      });
      expect(viewResponse.ok()).toBeTruthy();
      const viewedInvitation = await viewResponse.json();
      expect(viewedInvitation.invitation.status).toBe('viewed');

      // Step 4: Company can see invitation was viewed
      const companyListResponse = await request.get(`${API_BASE}/api/me/jobs/${jobId}/invitations`, {
        headers: { Authorization: `Bearer ${company.accessToken}` },
      });
      const companyInvitations = await companyListResponse.json();
      const updatedInvitation = companyInvitations.find((i: any) => i.id === invitation.id);
      expect(updatedInvitation.status).toBe('viewed');

      // Step 5: Job seeker accepts invitation
      const acceptResponse = await request.post(`${API_BASE}/api/me/invitations/${invitation.id}/respond`, {
        headers: { Authorization: `Bearer ${jobSeeker.accessToken}` },
        data: {
          accept: true,
          cover_letter: 'Thank you for reaching out! I am excited about this opportunity.',
        },
      });
      expect(acceptResponse.ok()).toBeTruthy();
      const acceptedInvitation = await acceptResponse.json();
      expect(acceptedInvitation.status).toBe('applied');

      // Step 6: Verify application exists
      const applicationsResponse = await request.get(`${API_BASE}/api/me/applications`, {
        headers: { Authorization: `Bearer ${jobSeeker.accessToken}` },
      });
      const applications = await applicationsResponse.json();
      // ApplicationWithJobDetails has nested structure: { application: { job_id, cover_letter }, job: {} }
      const application = applications.find((a: any) => a.application.job_id === jobId);
      expect(application).toBeDefined();
      expect(application.application.cover_letter).toContain('excited about this opportunity');

      // Step 7: Company can see application in their job applications
      const jobApplicationsResponse = await request.get(`${API_BASE}/api/me/jobs/${jobId}/applications`, {
        headers: { Authorization: `Bearer ${company.accessToken}` },
      });
      expect(jobApplicationsResponse.ok()).toBeTruthy();
      const jobApplications = await jobApplicationsResponse.json();
      expect(jobApplications.length).toBe(1);
    });
  });
});
