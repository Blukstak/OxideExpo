import { test, expect } from '@playwright/test';
const { execSync } = require('child_process');

// Base URL for the API (backend runs on port 8080 in Docker)
const API_BASE = 'http://localhost:8080';

// Helper to generate unique test emails
const uniqueEmail = () => `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;

// Helper to register an OMIL and return auth tokens
async function registerOmil(request: any, orgName?: string) {
  const email = uniqueEmail();
  const response = await request.post(`${API_BASE}/api/auth/register/omil`, {
    data: {
      email,
      password: 'SecurePassword123',
      first_name: 'Test',
      last_name: 'Director',
      organization_name: orgName || `Test OMIL ${Date.now()}`,
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

// Helper to register a job seeker and return auth tokens
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

// Helper to activate an OMIL organization via database
async function activateOmilForTesting(userId: string) {
  // First get the OMIL org ID
  const getOmilSql = `SELECT o.id FROM omil_organizations o JOIN omil_members m ON m.omil_id = o.id WHERE m.user_id = '${userId}'`;
  const getOmilCmd = `docker exec empleos_db_dev psql -U postgres -d empleos_inclusivos -t -A -c "${getOmilSql}"`;
  const omilId = execSync(getOmilCmd, { encoding: 'utf8' }).trim();

  // Activate the OMIL
  const sql = `UPDATE omil_organizations SET status = 'active'::organization_status, approved_at = NOW(), approved_by = '${userId}' WHERE id = '${omilId}'`;
  const cmd = `docker exec empleos_db_dev psql -U postgres -d empleos_inclusivos -c "${sql}"`;
  execSync(cmd, { encoding: 'utf8' });

  return omilId;
}

// Helper to activate a company via database
async function activateCompanyForTesting(companyId: string, approverId: string) {
  const sql = `UPDATE company_profiles SET status = 'active'::organization_status, approved_at = NOW(), approved_by = '${approverId}' WHERE id = '${companyId}'`;
  const cmd = `docker exec empleos_db_dev psql -U postgres -d empleos_inclusivos -c "${sql}"`;
  execSync(cmd, { encoding: 'utf8' });
}

// Helper to create an active job for a company
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

test.describe('V8: OMIL Integration', () => {
  test.describe('OMIL Registration', () => {
    test('can register as OMIL organization', async ({ request }) => {
      const response = await request.post(`${API_BASE}/api/auth/register/omil`, {
        data: {
          email: uniqueEmail(),
          password: 'SecurePassword123',
          first_name: 'Test',
          last_name: 'Director',
          organization_name: `OMIL Registration Test ${Date.now()}`,
        },
      });

      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      expect(body.access_token).toBeDefined();
      expect(body.user.user_type).toBe('omil_member');
    });

    test('OMIL registration creates organization and membership', async ({ request }) => {
      const omil = await registerOmil(request, `Complete OMIL ${Date.now()}`);

      // Activate the OMIL
      const omilId = await activateOmilForTesting(omil.userId);

      // Get OMIL organization details
      const response = await request.get(`${API_BASE}/api/me/omil`, {
        headers: { Authorization: `Bearer ${omil.accessToken}` },
      });

      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.organization).toBeDefined();
      expect(data.members).toBeDefined();
      expect(data.members.length).toBe(1);
      expect(data.members[0].member.role).toBe('director');
    });
  });

  test.describe('OMIL Organization Management', () => {
    test('GET /api/me/omil returns organization with members', async ({ request }) => {
      const omil = await registerOmil(request);
      await activateOmilForTesting(omil.userId);

      const response = await request.get(`${API_BASE}/api/me/omil`, {
        headers: { Authorization: `Bearer ${omil.accessToken}` },
      });

      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.organization.organization_name).toBeDefined();
      expect(data.organization.status).toBe('active');
      expect(data.members).toBeInstanceOf(Array);
    });

    test('PUT /api/me/omil updates organization details (director only)', async ({ request }) => {
      const omil = await registerOmil(request);
      await activateOmilForTesting(omil.userId);

      const newAddress = '123 Main Street, Test City';
      const response = await request.put(`${API_BASE}/api/me/omil`, {
        headers: { Authorization: `Bearer ${omil.accessToken}` },
        data: {
          address: newAddress,
          phone: '+56912345678',
        },
      });

      expect(response.ok()).toBeTruthy();
      const updated = await response.json();
      expect(updated.address).toBe(newAddress);
      expect(updated.phone).toBe('+56912345678');
    });

    test('GET /api/me/omil/stats returns dashboard statistics', async ({ request }) => {
      const omil = await registerOmil(request);
      await activateOmilForTesting(omil.userId);

      const response = await request.get(`${API_BASE}/api/me/omil/stats`, {
        headers: { Authorization: `Bearer ${omil.accessToken}` },
      });

      expect(response.ok()).toBeTruthy();
      const stats = await response.json();
      expect(stats.total_managed_seekers).toBeGreaterThanOrEqual(0);
      expect(stats.active_seekers).toBeGreaterThanOrEqual(0);
      expect(stats.placed_this_month).toBeGreaterThanOrEqual(0);
      expect(stats.placed_this_year).toBeGreaterThanOrEqual(0);
      expect(stats.pending_placements).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('OMIL Member Management', () => {
    test('GET /api/me/omil/members lists organization members', async ({ request }) => {
      const omil = await registerOmil(request);
      await activateOmilForTesting(omil.userId);

      const response = await request.get(`${API_BASE}/api/me/omil/members`, {
        headers: { Authorization: `Bearer ${omil.accessToken}` },
      });

      expect(response.ok()).toBeTruthy();
      const members = await response.json();
      expect(members).toBeInstanceOf(Array);
      expect(members.length).toBeGreaterThan(0);
      expect(members[0].member).toBeDefined();
      expect(members[0].user_name).toBeDefined();
      expect(members[0].user_email).toBeDefined();
    });

    test('POST /api/me/omil/members adds new member', async ({ request }) => {
      const omil = await registerOmil(request);
      await activateOmilForTesting(omil.userId);

      // Create a new user to add
      const newUser = await registerJobSeeker(request);

      // Add as OMIL member
      const response = await request.post(`${API_BASE}/api/me/omil/members`, {
        headers: { Authorization: `Bearer ${omil.accessToken}` },
        data: {
          email: newUser.email,
          role: 'advisor',
        },
      });

      expect(response.ok()).toBeTruthy();
      const member = await response.json();
      expect(member.member.role).toBe('advisor');
      expect(member.user_email).toBe(newUser.email);
    });

    test('PUT /api/me/omil/members/{id} updates member role', async ({ request }) => {
      const omil = await registerOmil(request);
      await activateOmilForTesting(omil.userId);

      // Create and add a new member
      const newUser = await registerJobSeeker(request);
      const addResponse = await request.post(`${API_BASE}/api/me/omil/members`, {
        headers: { Authorization: `Bearer ${omil.accessToken}` },
        data: {
          email: newUser.email,
          role: 'advisor',
        },
      });
      const added = await addResponse.json();

      // Update role to coordinator
      const response = await request.put(`${API_BASE}/api/me/omil/members/${added.member.id}`, {
        headers: { Authorization: `Bearer ${omil.accessToken}` },
        data: {
          role: 'coordinator',
        },
      });

      expect(response.ok()).toBeTruthy();
      const updated = await response.json();
      expect(updated.role).toBe('coordinator');
    });

    test('DELETE /api/me/omil/members/{id} removes member (director only)', async ({ request }) => {
      const omil = await registerOmil(request);
      await activateOmilForTesting(omil.userId);

      // Create and add a new member
      const newUser = await registerJobSeeker(request);
      const addResponse = await request.post(`${API_BASE}/api/me/omil/members`, {
        headers: { Authorization: `Bearer ${omil.accessToken}` },
        data: {
          email: newUser.email,
          role: 'advisor',
        },
      });
      const added = await addResponse.json();

      // Remove member
      const response = await request.delete(`${API_BASE}/api/me/omil/members/${added.member.id}`, {
        headers: { Authorization: `Bearer ${omil.accessToken}` },
      });

      expect(response.ok()).toBeTruthy();
      const result = await response.json();
      expect(result.message).toContain('removed');
    });

    test('cannot remove self from organization', async ({ request }) => {
      const omil = await registerOmil(request);
      await activateOmilForTesting(omil.userId);

      // Get own member ID
      const membersResponse = await request.get(`${API_BASE}/api/me/omil/members`, {
        headers: { Authorization: `Bearer ${omil.accessToken}` },
      });
      const members = await membersResponse.json();
      const selfMember = members.find((m: any) => m.user_email === omil.email);

      // Try to remove self
      const response = await request.delete(`${API_BASE}/api/me/omil/members/${selfMember.member.id}`, {
        headers: { Authorization: `Bearer ${omil.accessToken}` },
      });

      expect(response.status()).toBe(400);
    });
  });

  test.describe('Managed Job Seekers', () => {
    test('POST /api/me/omil/job-seekers registers existing user', async ({ request }) => {
      const omil = await registerOmil(request);
      await activateOmilForTesting(omil.userId);

      // Create a job seeker
      const jobSeeker = await registerJobSeeker(request);

      // Register them in OMIL
      const response = await request.post(`${API_BASE}/api/me/omil/job-seekers`, {
        headers: { Authorization: `Bearer ${omil.accessToken}` },
        data: {
          email: jobSeeker.email,
          first_name: 'Job',
          last_name: 'Seeker',
          notes: 'Registered during E2E test',
          assign_to_self: true,
        },
      });

      expect(response.ok()).toBeTruthy();
      const managed = await response.json();
      expect(managed.job_seeker_id).toBe(jobSeeker.userId);
      expect(managed.placement_outcome).toBe('pending');
      expect(managed.notes).toBe('Registered during E2E test');
    });

    test('POST /api/me/omil/job-seekers creates new user if not exists', async ({ request }) => {
      const omil = await registerOmil(request);
      await activateOmilForTesting(omil.userId);

      const newEmail = uniqueEmail();

      // Register new user via OMIL
      const response = await request.post(`${API_BASE}/api/me/omil/job-seekers`, {
        headers: { Authorization: `Bearer ${omil.accessToken}` },
        data: {
          email: newEmail,
          first_name: 'New',
          last_name: 'User',
          phone: '+56987654321',
        },
      });

      expect(response.ok()).toBeTruthy();
      const managed = await response.json();
      expect(managed.job_seeker_id).toBeDefined();
      expect(managed.placement_outcome).toBe('pending');
    });

    test('GET /api/me/omil/job-seekers lists managed seekers', async ({ request }) => {
      const omil = await registerOmil(request);
      await activateOmilForTesting(omil.userId);

      // Register a job seeker
      const jobSeeker = await registerJobSeeker(request);
      await request.post(`${API_BASE}/api/me/omil/job-seekers`, {
        headers: { Authorization: `Bearer ${omil.accessToken}` },
        data: {
          email: jobSeeker.email,
          first_name: 'Job',
          last_name: 'Seeker',
        },
      });

      // List managed seekers
      const response = await request.get(`${API_BASE}/api/me/omil/job-seekers`, {
        headers: { Authorization: `Bearer ${omil.accessToken}` },
      });

      expect(response.ok()).toBeTruthy();
      const seekers = await response.json();
      expect(seekers).toBeInstanceOf(Array);
      expect(seekers.length).toBeGreaterThan(0);
      expect(seekers[0].user_name).toBeDefined();
      expect(seekers[0].placement_outcome).toBe('pending');
    });

    test('GET /api/me/omil/job-seekers/{id} returns detailed info', async ({ request }) => {
      const omil = await registerOmil(request);
      await activateOmilForTesting(omil.userId);

      // Register a job seeker
      const jobSeeker = await registerJobSeeker(request);
      const registerResponse = await request.post(`${API_BASE}/api/me/omil/job-seekers`, {
        headers: { Authorization: `Bearer ${omil.accessToken}` },
        data: {
          email: jobSeeker.email,
          first_name: 'Job',
          last_name: 'Seeker',
        },
      });
      const registered = await registerResponse.json();

      // Get detail
      const response = await request.get(`${API_BASE}/api/me/omil/job-seekers/${registered.id}`, {
        headers: { Authorization: `Bearer ${omil.accessToken}` },
      });

      expect(response.ok()).toBeTruthy();
      const detail = await response.json();
      expect(detail.managed).toBeDefined();
      expect(detail.profile).toBeDefined();
      expect(detail.user_name).toBeDefined();
      expect(detail.recent_followups).toBeInstanceOf(Array);
    });

    test('PUT /api/me/omil/job-seekers/{id}/placement updates outcome', async ({ request }) => {
      const omil = await registerOmil(request);
      await activateOmilForTesting(omil.userId);

      // Register a job seeker
      const jobSeeker = await registerJobSeeker(request);
      const registerResponse = await request.post(`${API_BASE}/api/me/omil/job-seekers`, {
        headers: { Authorization: `Bearer ${omil.accessToken}` },
        data: {
          email: jobSeeker.email,
          first_name: 'Job',
          last_name: 'Seeker',
        },
      });
      const registered = await registerResponse.json();

      // Update placement to placed
      const response = await request.put(`${API_BASE}/api/me/omil/job-seekers/${registered.id}/placement`, {
        headers: { Authorization: `Bearer ${omil.accessToken}` },
        data: {
          outcome: 'placed',
          notes: 'Successfully placed at Test Company',
        },
      });

      expect(response.ok()).toBeTruthy();
      const updated = await response.json();
      expect(updated.placement_outcome).toBe('placed');
      expect(updated.placed_at).not.toBeNull();
    });
  });

  test.describe('Followups', () => {
    test('POST /api/me/omil/job-seekers/{id}/followups creates followup', async ({ request }) => {
      const omil = await registerOmil(request);
      await activateOmilForTesting(omil.userId);

      // Register a job seeker
      const jobSeeker = await registerJobSeeker(request);
      const registerResponse = await request.post(`${API_BASE}/api/me/omil/job-seekers`, {
        headers: { Authorization: `Bearer ${omil.accessToken}` },
        data: {
          email: jobSeeker.email,
          first_name: 'Job',
          last_name: 'Seeker',
        },
      });
      const registered = await registerResponse.json();

      // Create followup
      const response = await request.post(`${API_BASE}/api/me/omil/job-seekers/${registered.id}/followups`, {
        headers: { Authorization: `Bearer ${omil.accessToken}` },
        data: {
          followup_type: 'follow_up_call',
          title: 'Weekly check-in',
          content: 'Called to check on job search progress. Candidate is actively applying.',
          is_private: false,
        },
      });

      expect(response.ok()).toBeTruthy();
      const followup = await response.json();
      expect(followup.followup_type).toBe('follow_up_call');
      expect(followup.title).toBe('Weekly check-in');
      expect(followup.content).toContain('actively applying');
    });

    test('GET /api/me/omil/job-seekers/{id}/followups lists followups', async ({ request }) => {
      const omil = await registerOmil(request);
      await activateOmilForTesting(omil.userId);

      // Register a job seeker
      const jobSeeker = await registerJobSeeker(request);
      const registerResponse = await request.post(`${API_BASE}/api/me/omil/job-seekers`, {
        headers: { Authorization: `Bearer ${omil.accessToken}` },
        data: {
          email: jobSeeker.email,
          first_name: 'Job',
          last_name: 'Seeker',
        },
      });
      const registered = await registerResponse.json();

      // Create a followup
      await request.post(`${API_BASE}/api/me/omil/job-seekers/${registered.id}/followups`, {
        headers: { Authorization: `Bearer ${omil.accessToken}` },
        data: {
          followup_type: 'general_note',
          content: 'Test followup for listing',
        },
      });

      // List followups
      const response = await request.get(`${API_BASE}/api/me/omil/job-seekers/${registered.id}/followups`, {
        headers: { Authorization: `Bearer ${omil.accessToken}` },
      });

      expect(response.ok()).toBeTruthy();
      const followups = await response.json();
      expect(followups).toBeInstanceOf(Array);
      // Should have at least initial registration + our new followup
      expect(followups.length).toBeGreaterThanOrEqual(2);
    });

    test('PUT /api/me/omil/followups/{id} updates followup', async ({ request }) => {
      const omil = await registerOmil(request);
      await activateOmilForTesting(omil.userId);

      // Register a job seeker
      const jobSeeker = await registerJobSeeker(request);
      const registerResponse = await request.post(`${API_BASE}/api/me/omil/job-seekers`, {
        headers: { Authorization: `Bearer ${omil.accessToken}` },
        data: {
          email: jobSeeker.email,
          first_name: 'Job',
          last_name: 'Seeker',
        },
      });
      const registered = await registerResponse.json();

      // Create a followup
      const createResponse = await request.post(`${API_BASE}/api/me/omil/job-seekers/${registered.id}/followups`, {
        headers: { Authorization: `Bearer ${omil.accessToken}` },
        data: {
          followup_type: 'general_note',
          content: 'Initial content',
        },
      });
      const created = await createResponse.json();

      // Update followup
      const response = await request.put(`${API_BASE}/api/me/omil/followups/${created.id}`, {
        headers: { Authorization: `Bearer ${omil.accessToken}` },
        data: {
          content: 'Updated content with more details',
          is_private: true,
        },
      });

      expect(response.ok()).toBeTruthy();
      const updated = await response.json();
      expect(updated.content).toBe('Updated content with more details');
      expect(updated.is_private).toBe(true);
    });

    test('DELETE /api/me/omil/followups/{id} removes followup', async ({ request }) => {
      const omil = await registerOmil(request);
      await activateOmilForTesting(omil.userId);

      // Register a job seeker
      const jobSeeker = await registerJobSeeker(request);
      const registerResponse = await request.post(`${API_BASE}/api/me/omil/job-seekers`, {
        headers: { Authorization: `Bearer ${omil.accessToken}` },
        data: {
          email: jobSeeker.email,
          first_name: 'Job',
          last_name: 'Seeker',
        },
      });
      const registered = await registerResponse.json();

      // Create a followup
      const createResponse = await request.post(`${API_BASE}/api/me/omil/job-seekers/${registered.id}/followups`, {
        headers: { Authorization: `Bearer ${omil.accessToken}` },
        data: {
          followup_type: 'general_note',
          content: 'Followup to delete',
        },
      });
      const created = await createResponse.json();

      // Delete followup
      const response = await request.delete(`${API_BASE}/api/me/omil/followups/${created.id}`, {
        headers: { Authorization: `Bearer ${omil.accessToken}` },
      });

      expect(response.ok()).toBeTruthy();
      const result = await response.json();
      expect(result.message).toContain('deleted');
    });
  });

  test.describe('Apply on Behalf', () => {
    test('POST /api/me/omil/job-seekers/{id}/apply submits application', async ({ request }) => {
      const omil = await registerOmil(request);
      await activateOmilForTesting(omil.userId);

      // Register a job seeker
      const jobSeeker = await registerJobSeeker(request);
      const registerResponse = await request.post(`${API_BASE}/api/me/omil/job-seekers`, {
        headers: { Authorization: `Bearer ${omil.accessToken}` },
        data: {
          email: jobSeeker.email,
          first_name: 'Job',
          last_name: 'Seeker',
        },
      });
      const registered = await registerResponse.json();

      // Create a company with active job
      const company = await registerCompany(request);
      await activateCompanyForTesting(company.companyId, company.userId);
      const jobId = await createActiveJob(company.companyId, company.userId);

      // Apply on behalf
      const response = await request.post(`${API_BASE}/api/me/omil/job-seekers/${registered.id}/apply`, {
        headers: { Authorization: `Bearer ${omil.accessToken}` },
        data: {
          job_id: jobId,
          cover_letter: 'Application submitted by OMIL on behalf of job seeker.',
          internal_notes: 'Candidate matches job requirements well.',
        },
      });

      expect(response.ok()).toBeTruthy();
      const result = await response.json();
      expect(result.application_id).toBeDefined();
      expect(result.message).toContain('submitted');
    });
  });

  test.describe('Authorization', () => {
    test('non-OMIL user cannot access OMIL endpoints', async ({ request }) => {
      // Register as regular job seeker
      const jobSeeker = await registerJobSeeker(request);

      // Try to access OMIL endpoint
      const response = await request.get(`${API_BASE}/api/me/omil`, {
        headers: { Authorization: `Bearer ${jobSeeker.accessToken}` },
      });

      expect(response.status()).toBe(403);
    });

    test('inactive OMIL cannot access endpoints', async ({ request }) => {
      // Register OMIL but don't activate
      const omil = await registerOmil(request);

      // Try to access OMIL endpoint
      const response = await request.get(`${API_BASE}/api/me/omil`, {
        headers: { Authorization: `Bearer ${omil.accessToken}` },
      });

      expect(response.status()).toBe(403);
    });

    test('unauthenticated request returns 401', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/me/omil`);
      expect(response.status()).toBe(401);
    });
  });
});
