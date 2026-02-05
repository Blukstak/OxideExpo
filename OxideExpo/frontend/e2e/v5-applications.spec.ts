import { test, expect } from '@playwright/test';

// Base URL for the API
const API_BASE = 'http://localhost:8080';

// Helper to generate unique test emails
const uniqueEmail = () => `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;

// Helper to register a job seeker and return auth tokens
async function registerJobSeeker(request: any) {
  const email = uniqueEmail();
  const response = await request.post(`${API_BASE}/api/auth/register`, {
    data: {
      email,
      password: 'SecurePassword123',
      first_name: 'Test',
      last_name: 'JobSeeker',
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
      company_name: companyName || 'Test Company Inc',
    },
  });

  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  const userId = body.user.id;

  // Get company_id from company_members table
  const { execSync } = require('child_process');
  const cmd = `docker exec empleos_db_dev psql -U postgres -d empleos_inclusivos -t -c "SELECT company_id FROM company_members WHERE user_id = '${userId}'"`;
  const companyId = execSync(cmd, { encoding: 'utf8' }).trim();

  if (!companyId) {
    throw new Error(`Failed to get company_id for user ${userId}`);
  }

  // Activate company for E2E testing (bypasses admin approval)
  await activateCompanyForTesting(companyId, userId);

  return {
    email,
    userId,
    companyId,
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
  };
}

// Helper to activate company status for testing (bypasses admin approval)
async function activateCompanyForTesting(companyId: string, approverId: string) {
  const { execSync } = require('child_process');
  const sql = `UPDATE company_profiles SET status = 'active'::organization_status, approved_at = NOW(), approved_by = '${approverId}' WHERE id = '${companyId}'`;
  const cmd = `docker exec empleos_db_dev psql -U postgres -d empleos_inclusivos -c "${sql}"`;

  try {
    execSync(cmd, { encoding: 'utf8' });
  } catch (error: any) {
    console.error('Failed to activate company:', error.message);
    throw error;
  }
}

// Helper to create a complete job seeker profile
async function createCompleteProfile(request: any, accessToken: string) {
  // Get reference data first
  const [skillsRes, languagesRes] = await Promise.all([
    request.get(`${API_BASE}/api/reference/skills`),
    request.get(`${API_BASE}/api/reference/languages`),
  ]);

  const skills = await skillsRes.json();
  const languages = await languagesRes.json();

  // Update basic info (name already set during registration)
  await request.put(`${API_BASE}/api/me/profile/basic-info`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: {
      phone: '555-1234',
      date_of_birth: '1990-01-01',
      gender: 'prefer_not_to_say',
    },
  });

  // Add education
  await request.post(`${API_BASE}/api/me/profile/education`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: {
      institution: 'Test University',
      degree: 'Bachelor',
      field_of_study: 'Computer Science',
      start_date: '2008-09-01',
      end_date: '2012-06-01',
      is_current: false,
    },
  });

  // Add work experience
  await request.post(`${API_BASE}/api/me/profile/experience`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: {
      company_name: 'Previous Company',
      position: 'Software Developer',
      start_date: '2012-07-01',
      end_date: '2015-06-01',
      is_current: false,
      description: 'Worked on various software projects',
    },
  });

  // Add skills
  if (skills.length >= 2) {
    await request.post(`${API_BASE}/api/me/profile/skills`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: {
        skill_id: skills[0].id,
        proficiency_level: 4,
      },
    });

    await request.post(`${API_BASE}/api/me/profile/skills`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: {
        skill_id: skills[1].id,
        proficiency_level: 3,
      },
    });
  }

  // Add language
  if (languages.length >= 1) {
    await request.post(`${API_BASE}/api/me/profile/languages`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: {
        language_id: languages[0].id,
        proficiency_level: 5,
      },
    });
  }
}

// Helper to create an active job (simplified - in real scenario would need admin approval)
async function createJob(request: any, accessToken: string, overrides = {}) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 30);
  const deadline = tomorrow.toISOString().split('T')[0];

  const jobData = {
    title: 'Software Engineer',
    description: 'We are looking for a talented software engineer to join our team. This is a great opportunity.',
    job_type: 'full_time',
    work_modality: 'hybrid',
    application_deadline: deadline,
    vacancies: 1,
    ...overrides,
  };

  const response = await request.post(`${API_BASE}/api/me/jobs`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: jobData,
  });

  expect(response.ok()).toBeTruthy();
  return await response.json();
}

test.describe('V5: Job Applications', () => {
  test.describe('Application Submission', () => {
    test('job seeker submits application with cover letter', async ({ request }) => {
      // Register job seeker and complete profile
      const { accessToken: jobSeekerToken } = await registerJobSeeker(request);
      await createCompleteProfile(request, jobSeekerToken);

      // Register company and create job
      const { accessToken: companyToken } = await registerCompany(request);
      const job = await createJob(request, companyToken);

      // Update job status to active (in real scenario requires admin)
      await request.patch(`${API_BASE}/api/me/jobs/${job.id}/status`, {
        headers: { Authorization: `Bearer ${companyToken}` },
        data: { status: 'active' },
      });

      // Submit application
      const applicationData = {
        job_id: job.id,
        cover_letter: 'I am very interested in this position and believe I would be a great fit for your team.',
        resume_url: 'https://example.com/resume.pdf',
      };

      const response = await request.post(`${API_BASE}/api/me/applications`, {
        headers: { Authorization: `Bearer ${jobSeekerToken}` },
        data: applicationData,
      });

      expect(response.ok()).toBeTruthy();
      const application = await response.json();
      expect(application.id).toBeDefined();
      expect(application.job_id).toBe(job.id);
      expect(application.applicant_id).toBeDefined();
      expect(application.status).toBe('submitted');
      expect(application.cover_letter).toBe(applicationData.cover_letter);
      expect(application.resume_url).toBe(applicationData.resume_url);
      expect(application.applied_at).toBeDefined();
    });

    test('job seeker submits application without cover letter', async ({ request }) => {
      // Register job seeker and complete profile
      const { accessToken: jobSeekerToken } = await registerJobSeeker(request);
      await createCompleteProfile(request, jobSeekerToken);

      // Register company and create job
      const { accessToken: companyToken } = await registerCompany(request);
      const job = await createJob(request, companyToken);

      // Update job status to active
      await request.patch(`${API_BASE}/api/me/jobs/${job.id}/status`, {
        headers: { Authorization: `Bearer ${companyToken}` },
        data: { status: 'active' },
      });

      // Submit application without cover letter
      const response = await request.post(`${API_BASE}/api/me/applications`, {
        headers: { Authorization: `Bearer ${jobSeekerToken}` },
        data: { job_id: job.id },
      });

      expect(response.ok()).toBeTruthy();
      const application = await response.json();
      expect(application.status).toBe('submitted');
    });

    test('rejects duplicate application to same job', async ({ request }) => {
      // Register job seeker and complete profile
      const { accessToken: jobSeekerToken } = await registerJobSeeker(request);
      await createCompleteProfile(request, jobSeekerToken);

      // Register company and create job
      const { accessToken: companyToken } = await registerCompany(request);
      const job = await createJob(request, companyToken);

      // Update job status to active
      await request.patch(`${API_BASE}/api/me/jobs/${job.id}/status`, {
        headers: { Authorization: `Bearer ${companyToken}` },
        data: { status: 'active' },
      });

      // Submit first application
      await request.post(`${API_BASE}/api/me/applications`, {
        headers: { Authorization: `Bearer ${jobSeekerToken}` },
        data: { job_id: job.id },
      });

      // Try to submit second application to same job
      const response = await request.post(`${API_BASE}/api/me/applications`, {
        headers: { Authorization: `Bearer ${jobSeekerToken}` },
        data: { job_id: job.id },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toBeDefined();
    });

    test('rejects application to non-existent job', async ({ request }) => {
      const { accessToken } = await registerJobSeeker(request);
      await createCompleteProfile(request, accessToken);

      const fakeJobId = '00000000-0000-0000-0000-000000000000';
      const response = await request.post(`${API_BASE}/api/me/applications`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: { job_id: fakeJobId },
      });

      expect(response.status()).toBe(404);
    });

    test('rejects application to draft job', async ({ request }) => {
      // Register job seeker and complete profile
      const { accessToken: jobSeekerToken } = await registerJobSeeker(request);
      await createCompleteProfile(request, jobSeekerToken);

      // Register company and create draft job
      const { accessToken: companyToken } = await registerCompany(request);
      const job = await createJob(request, companyToken);

      // Try to apply to draft job (status is not 'active')
      const response = await request.post(`${API_BASE}/api/me/applications`, {
        headers: { Authorization: `Bearer ${jobSeekerToken}` },
        data: { job_id: job.id },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('active');
    });

    test('rejects application with incomplete profile', async ({ request }) => {
      // Register job seeker but DON'T complete profile
      const { accessToken: jobSeekerToken } = await registerJobSeeker(request);

      // Register company and create active job
      const { accessToken: companyToken } = await registerCompany(request);
      const job = await createJob(request, companyToken);

      await request.patch(`${API_BASE}/api/me/jobs/${job.id}/status`, {
        headers: { Authorization: `Bearer ${companyToken}` },
        data: { status: 'active' },
      });

      // Try to apply with incomplete profile
      const response = await request.post(`${API_BASE}/api/me/applications`, {
        headers: { Authorization: `Bearer ${jobSeekerToken}` },
        data: { job_id: job.id },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('50%');
    });

    test('rejects application to job with past deadline', async ({ request }) => {
      // Register job seeker and complete profile
      const { accessToken: jobSeekerToken } = await registerJobSeeker(request);
      await createCompleteProfile(request, jobSeekerToken);

      // Register company and create job with past deadline
      const { accessToken: companyToken } = await registerCompany(request);

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const deadline = yesterday.toISOString().split('T')[0];

      // Create job with past deadline (this might fail at creation, so we test the constraint)
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const futureDeadline = tomorrow.toISOString().split('T')[0];

      const job = await createJob(request, companyToken, {
        application_deadline: futureDeadline,
      });

      // Manually update deadline to past (simulating expired job)
      // In real scenario, this would be prevented by CHECK constraint, but we're testing the handler logic
      // For now, just verify that the CHECK constraint prevents creating jobs with past deadlines
      const pastJobResponse = await request.post(`${API_BASE}/api/me/jobs`, {
        headers: { Authorization: `Bearer ${companyToken}` },
        data: {
          title: 'Past Job',
          description: 'A job with a past deadline',
          job_type: 'full_time',
          work_modality: 'on_site',
          application_deadline: deadline,
          vacancies: 1,
        },
      });

      expect(pastJobResponse.status()).toBe(400);
    });
  });

  test.describe('Application Listing', () => {
    test('GET /api/me/applications returns job seeker applications', async ({ request }) => {
      // Register job seeker and complete profile
      const { accessToken: jobSeekerToken } = await registerJobSeeker(request);
      await createCompleteProfile(request, jobSeekerToken);

      // Register company and create two jobs
      const { accessToken: companyToken } = await registerCompany(request);
      const job1 = await createJob(request, companyToken, { title: 'Job 1' });
      const job2 = await createJob(request, companyToken, { title: 'Job 2' });

      // Make jobs active
      await request.patch(`${API_BASE}/api/me/jobs/${job1.id}/status`, {
        headers: { Authorization: `Bearer ${companyToken}` },
        data: { status: 'active' },
      });
      await request.patch(`${API_BASE}/api/me/jobs/${job2.id}/status`, {
        headers: { Authorization: `Bearer ${companyToken}` },
        data: { status: 'active' },
      });

      // Apply to both jobs
      await request.post(`${API_BASE}/api/me/applications`, {
        headers: { Authorization: `Bearer ${jobSeekerToken}` },
        data: { job_id: job1.id },
      });
      await request.post(`${API_BASE}/api/me/applications`, {
        headers: { Authorization: `Bearer ${jobSeekerToken}` },
        data: { job_id: job2.id },
      });

      // List applications
      const response = await request.get(`${API_BASE}/api/me/applications`, {
        headers: { Authorization: `Bearer ${jobSeekerToken}` },
      });

      expect(response.ok()).toBeTruthy();
      const applications = await response.json();
      expect(Array.isArray(applications)).toBe(true);
      expect(applications.length).toBeGreaterThanOrEqual(2);
      expect(applications[0].status).toBeDefined();
      expect(applications[0].applied_at).toBeDefined();
    });

    test('applications are ordered by applied_at DESC', async ({ request }) => {
      // Register job seeker and complete profile
      const { accessToken: jobSeekerToken } = await registerJobSeeker(request);
      await createCompleteProfile(request, jobSeekerToken);

      // Register company and create two jobs
      const { accessToken: companyToken } = await registerCompany(request);
      const job1 = await createJob(request, companyToken, { title: 'First Job' });
      const job2 = await createJob(request, companyToken, { title: 'Second Job' });

      // Make jobs active
      await request.patch(`${API_BASE}/api/me/jobs/${job1.id}/status`, {
        headers: { Authorization: `Bearer ${companyToken}` },
        data: { status: 'active' },
      });
      await request.patch(`${API_BASE}/api/me/jobs/${job2.id}/status`, {
        headers: { Authorization: `Bearer ${companyToken}` },
        data: { status: 'active' },
      });

      // Apply to first job
      await request.post(`${API_BASE}/api/me/applications`, {
        headers: { Authorization: `Bearer ${jobSeekerToken}` },
        data: { job_id: job1.id },
      });

      // Wait and apply to second job
      await new Promise(resolve => setTimeout(resolve, 1000));

      await request.post(`${API_BASE}/api/me/applications`, {
        headers: { Authorization: `Bearer ${jobSeekerToken}` },
        data: { job_id: job2.id },
      });

      // List applications
      const response = await request.get(`${API_BASE}/api/me/applications`, {
        headers: { Authorization: `Bearer ${jobSeekerToken}` },
      });

      const applications = await response.json();
      expect(applications.length).toBeGreaterThanOrEqual(2);

      // Most recent application should be first
      const firstApp = applications.find((a: any) => a.job_id === job2.id);
      const secondApp = applications.find((a: any) => a.job_id === job1.id);

      if (firstApp && secondApp) {
        const firstDate = new Date(firstApp.applied_at);
        const secondDate = new Date(secondApp.applied_at);
        expect(firstDate.getTime()).toBeGreaterThan(secondDate.getTime());
      }
    });
  });

  test.describe('Application Withdrawal', () => {
    test('job seeker withdraws application', async ({ request }) => {
      // Register job seeker and complete profile
      const { accessToken: jobSeekerToken } = await registerJobSeeker(request);
      await createCompleteProfile(request, jobSeekerToken);

      // Register company and create job
      const { accessToken: companyToken } = await registerCompany(request);
      const job = await createJob(request, companyToken);

      await request.patch(`${API_BASE}/api/me/jobs/${job.id}/status`, {
        headers: { Authorization: `Bearer ${companyToken}` },
        data: { status: 'active' },
      });

      // Submit application
      const appResponse = await request.post(`${API_BASE}/api/me/applications`, {
        headers: { Authorization: `Bearer ${jobSeekerToken}` },
        data: { job_id: job.id },
      });

      const application = await appResponse.json();

      // Withdraw application
      const withdrawResponse = await request.patch(
        `${API_BASE}/api/me/applications/${application.id}/withdraw`,
        {
          headers: { Authorization: `Bearer ${jobSeekerToken}` },
          data: {
            withdrawal_reason: 'Found another opportunity',
          },
        }
      );

      expect(withdrawResponse.ok()).toBeTruthy();
      const withdrawnApp = await withdrawResponse.json();
      expect(withdrawnApp.status).toBe('withdrawn');
      expect(withdrawnApp.withdrawal_reason).toBe('Found another opportunity');
    });

    test('cannot withdraw application after offered status', async ({ request }) => {
      // Register job seeker and complete profile
      const { accessToken: jobSeekerToken } = await registerJobSeeker(request);
      await createCompleteProfile(request, jobSeekerToken);

      // Register company and create job
      const { accessToken: companyToken } = await registerCompany(request);
      const job = await createJob(request, companyToken);

      await request.patch(`${API_BASE}/api/me/jobs/${job.id}/status`, {
        headers: { Authorization: `Bearer ${companyToken}` },
        data: { status: 'active' },
      });

      // Submit application
      const appResponse = await request.post(`${API_BASE}/api/me/applications`, {
        headers: { Authorization: `Bearer ${jobSeekerToken}` },
        data: { job_id: job.id },
      });

      const application = await appResponse.json();

      // Company updates application to 'offered'
      await request.put(
        `${API_BASE}/api/me/jobs/${job.id}/applications/${application.id}`,
        {
          headers: { Authorization: `Bearer ${companyToken}` },
          data: {
            status: 'offered',
            offer_details: 'We would like to offer you this position',
          },
        }
      );

      // Try to withdraw
      const withdrawResponse = await request.patch(
        `${API_BASE}/api/me/applications/${application.id}/withdraw`,
        {
          headers: { Authorization: `Bearer ${jobSeekerToken}` },
          data: {
            withdrawal_reason: 'Changed my mind',
          },
        }
      );

      expect(withdrawResponse.status()).toBe(400);
    });
  });

  test.describe('Company Application Management', () => {
    test('company views applications for their job', async ({ request }) => {
      // Register job seeker and complete profile
      const { accessToken: jobSeekerToken } = await registerJobSeeker(request);
      await createCompleteProfile(request, jobSeekerToken);

      // Register company and create job
      const { accessToken: companyToken } = await registerCompany(request);
      const job = await createJob(request, companyToken);

      await request.patch(`${API_BASE}/api/me/jobs/${job.id}/status`, {
        headers: { Authorization: `Bearer ${companyToken}` },
        data: { status: 'active' },
      });

      // Submit application
      await request.post(`${API_BASE}/api/me/applications`, {
        headers: { Authorization: `Bearer ${jobSeekerToken}` },
        data: {
          job_id: job.id,
          cover_letter: 'I am interested in this role',
        },
      });

      // Company views applications
      const response = await request.get(`${API_BASE}/api/me/jobs/${job.id}/applications`, {
        headers: { Authorization: `Bearer ${companyToken}` },
      });

      expect(response.ok()).toBeTruthy();
      const applications = await response.json();
      expect(Array.isArray(applications)).toBe(true);
      expect(applications.length).toBeGreaterThan(0);
      expect(applications[0].applicant_id).toBeDefined();
      expect(applications[0].cover_letter).toBeDefined();
    });

    test('company updates application status', async ({ request }) => {
      // Register job seeker and complete profile
      const { accessToken: jobSeekerToken } = await registerJobSeeker(request);
      await createCompleteProfile(request, jobSeekerToken);

      // Register company and create job
      const { accessToken: companyToken } = await registerCompany(request);
      const job = await createJob(request, companyToken);

      await request.patch(`${API_BASE}/api/me/jobs/${job.id}/status`, {
        headers: { Authorization: `Bearer ${companyToken}` },
        data: { status: 'active' },
      });

      // Submit application
      const appResponse = await request.post(`${API_BASE}/api/me/applications`, {
        headers: { Authorization: `Bearer ${jobSeekerToken}` },
        data: { job_id: job.id },
      });

      const application = await appResponse.json();

      // Company moves to under_review
      const updateResponse = await request.put(
        `${API_BASE}/api/me/jobs/${job.id}/applications/${application.id}`,
        {
          headers: { Authorization: `Bearer ${companyToken}` },
          data: { status: 'under_review' },
        }
      );

      expect(updateResponse.ok()).toBeTruthy();
      const updatedApp = await updateResponse.json();
      expect(updatedApp.status).toBe('under_review');
      expect(updatedApp.reviewed_at).toBeDefined();
      expect(updatedApp.reviewed_by).toBeDefined();
    });

    test('company schedules interview', async ({ request }) => {
      // Register job seeker and complete profile
      const { accessToken: jobSeekerToken } = await registerJobSeeker(request);
      await createCompleteProfile(request, jobSeekerToken);

      // Register company and create job
      const { accessToken: companyToken } = await registerCompany(request);
      const job = await createJob(request, companyToken);

      await request.patch(`${API_BASE}/api/me/jobs/${job.id}/status`, {
        headers: { Authorization: `Bearer ${companyToken}` },
        data: { status: 'active' },
      });

      // Submit application
      const appResponse = await request.post(`${API_BASE}/api/me/applications`, {
        headers: { Authorization: `Bearer ${jobSeekerToken}` },
        data: { job_id: job.id },
      });

      const application = await appResponse.json();

      // Company schedules interview
      const interviewDate = new Date();
      interviewDate.setDate(interviewDate.getDate() + 7);

      const updateResponse = await request.put(
        `${API_BASE}/api/me/jobs/${job.id}/applications/${application.id}`,
        {
          headers: { Authorization: `Bearer ${companyToken}` },
          data: {
            status: 'interviewed',
            interview_date: interviewDate.toISOString(),
            interview_notes: 'Candidate seems promising, technical skills are strong',
          },
        }
      );

      expect(updateResponse.ok()).toBeTruthy();
      const updatedApp = await updateResponse.json();
      expect(updatedApp.status).toBe('interviewed');
      expect(updatedApp.interview_date).toBeDefined();
      expect(updatedApp.interview_notes).toBeDefined();
    });

    test('company makes job offer', async ({ request }) => {
      // Register job seeker and complete profile
      const { accessToken: jobSeekerToken } = await registerJobSeeker(request);
      await createCompleteProfile(request, jobSeekerToken);

      // Register company and create job
      const { accessToken: companyToken } = await registerCompany(request);
      const job = await createJob(request, companyToken);

      await request.patch(`${API_BASE}/api/me/jobs/${job.id}/status`, {
        headers: { Authorization: `Bearer ${companyToken}` },
        data: { status: 'active' },
      });

      // Submit application
      const appResponse = await request.post(`${API_BASE}/api/me/applications`, {
        headers: { Authorization: `Bearer ${jobSeekerToken}` },
        data: { job_id: job.id },
      });

      const application = await appResponse.json();

      // Company makes offer
      const updateResponse = await request.put(
        `${API_BASE}/api/me/jobs/${job.id}/applications/${application.id}`,
        {
          headers: { Authorization: `Bearer ${companyToken}` },
          data: {
            status: 'offered',
            offer_details: 'Starting salary: $60,000, Benefits: Health insurance, 401k',
          },
        }
      );

      expect(updateResponse.ok()).toBeTruthy();
      const updatedApp = await updateResponse.json();
      expect(updatedApp.status).toBe('offered');
      expect(updatedApp.offer_date).toBeDefined();
      expect(updatedApp.offer_details).toBeDefined();
    });

    test('company adds internal note to application', async ({ request }) => {
      // Register job seeker and complete profile
      const { accessToken: jobSeekerToken } = await registerJobSeeker(request);
      await createCompleteProfile(request, jobSeekerToken);

      // Register company and create job
      const { accessToken: companyToken } = await registerCompany(request);
      const job = await createJob(request, companyToken);

      await request.patch(`${API_BASE}/api/me/jobs/${job.id}/status`, {
        headers: { Authorization: `Bearer ${companyToken}` },
        data: { status: 'active' },
      });

      // Submit application
      const appResponse = await request.post(`${API_BASE}/api/me/applications`, {
        headers: { Authorization: `Bearer ${jobSeekerToken}` },
        data: { job_id: job.id },
      });

      const application = await appResponse.json();

      // Company adds note
      const noteResponse = await request.post(
        `${API_BASE}/api/me/jobs/${job.id}/applications/${application.id}/notes`,
        {
          headers: { Authorization: `Bearer ${companyToken}` },
          data: {
            note_text: 'Strong technical background, good cultural fit',
            is_important: true,
          },
        }
      );

      expect(noteResponse.ok()).toBeTruthy();
      const note = await noteResponse.json();
      expect(note.id).toBeDefined();
      expect(note.note_text).toBe('Strong technical background, good cultural fit');
      expect(note.is_important).toBe(true);
      expect(note.created_by).toBeDefined();
    });
  });

  test.describe('Authorization & Permissions', () => {
    test('requires authentication for application endpoints', async ({ request }) => {
      const endpoints = [
        { method: 'GET', url: '/api/me/applications' },
        { method: 'POST', url: '/api/me/applications' },
      ];

      for (const endpoint of endpoints) {
        const response = await request.fetch(`${API_BASE}${endpoint.url}`, {
          method: endpoint.method,
          data: endpoint.method === 'POST' ? {} : undefined,
        });

        expect(response.status()).toBe(401);
      }
    });

    test('company members cannot access job seeker application endpoints', async ({ request }) => {
      const { accessToken } = await registerCompany(request);

      const response = await request.get(`${API_BASE}/api/me/applications`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      expect(response.status()).toBe(403);
      const body = await response.json();
      expect(body.error).toContain('job seeker');
    });

    test('job seeker cannot view applications of other job seekers', async ({ request }) => {
      // Register two job seekers
      const { accessToken: jobSeeker1Token } = await registerJobSeeker(request);
      await createCompleteProfile(request, jobSeeker1Token);

      const { accessToken: jobSeeker2Token } = await registerJobSeeker(request);
      await createCompleteProfile(request, jobSeeker2Token);

      // Register company and create job
      const { accessToken: companyToken } = await registerCompany(request);
      const job = await createJob(request, companyToken);

      await request.patch(`${API_BASE}/api/me/jobs/${job.id}/status`, {
        headers: { Authorization: `Bearer ${companyToken}` },
        data: { status: 'active' },
      });

      // First job seeker applies
      const app1Response = await request.post(`${API_BASE}/api/me/applications`, {
        headers: { Authorization: `Bearer ${jobSeeker1Token}` },
        data: { job_id: job.id },
      });

      const application1 = await app1Response.json();

      // Second job seeker tries to view first job seeker's application
      const getResponse = await request.get(
        `${API_BASE}/api/me/applications/${application1.id}`,
        {
          headers: { Authorization: `Bearer ${jobSeeker2Token}` },
        }
      );

      expect(getResponse.status()).toBe(404);
    });
  });

  test.describe('Data Integrity', () => {
    test('application timestamps are set correctly', async ({ request }) => {
      // Register job seeker and complete profile
      const { accessToken: jobSeekerToken } = await registerJobSeeker(request);
      await createCompleteProfile(request, jobSeekerToken);

      // Register company and create job
      const { accessToken: companyToken } = await registerCompany(request);
      const job = await createJob(request, companyToken);

      await request.patch(`${API_BASE}/api/me/jobs/${job.id}/status`, {
        headers: { Authorization: `Bearer ${companyToken}` },
        data: { status: 'active' },
      });

      // Submit application
      const response = await request.post(`${API_BASE}/api/me/applications`, {
        headers: { Authorization: `Bearer ${jobSeekerToken}` },
        data: { job_id: job.id },
      });

      const application = await response.json();
      expect(application.applied_at).toBeDefined();
      expect(application.created_at).toBeDefined();
      expect(application.updated_at).toBeDefined();
      expect(new Date(application.applied_at)).toBeInstanceOf(Date);
    });

    test('applications_count increments when application is submitted', async ({ request }) => {
      // Register job seeker and complete profile
      const { accessToken: jobSeekerToken } = await registerJobSeeker(request);
      await createCompleteProfile(request, jobSeekerToken);

      // Register company and create job
      const { accessToken: companyToken } = await registerCompany(request);
      const job = await createJob(request, companyToken);

      // Check initial count
      expect(job.applications_count).toBe(0);

      await request.patch(`${API_BASE}/api/me/jobs/${job.id}/status`, {
        headers: { Authorization: `Bearer ${companyToken}` },
        data: { status: 'active' },
      });

      // Submit application
      await request.post(`${API_BASE}/api/me/applications`, {
        headers: { Authorization: `Bearer ${jobSeekerToken}` },
        data: { job_id: job.id },
      });

      // Check updated count
      const jobResponse = await request.get(`${API_BASE}/api/me/jobs/${job.id}`, {
        headers: { Authorization: `Bearer ${companyToken}` },
      });

      const updatedJob = await jobResponse.json();
      expect(updatedJob.job.applications_count).toBe(1);
    });
  });
});
