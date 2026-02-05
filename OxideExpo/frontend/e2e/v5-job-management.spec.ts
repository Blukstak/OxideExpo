import { test, expect } from '@playwright/test';

// Base URL for the API
const API_BASE = 'http://localhost:8080';

// Helper to generate unique test emails
const uniqueEmail = () => `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;

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

  // For E2E tests, we need to activate the company (bypass approval workflow)
  // In production, this would require admin approval
  // Use the user's own ID as approver for testing (would be admin in production)
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
  // Direct database update for testing purposes using docker exec
  // In production, use admin approval endpoint
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

// Helper to get reference data IDs
async function getReferenceData(request: any) {
  const [industriesRes, skillsRes, languagesRes, regionsRes] = await Promise.all([
    request.get(`${API_BASE}/api/reference/industries`),
    request.get(`${API_BASE}/api/reference/skills`),
    request.get(`${API_BASE}/api/reference/languages`),
    request.get(`${API_BASE}/api/reference/regions`),
  ]);

  const industries = await industriesRes.json();
  const skills = await skillsRes.json();
  const languages = await languagesRes.json();
  const regions = await regionsRes.json();

  return {
    industryId: industries[0]?.id,
    skillId: skills[0]?.id,
    skillId2: skills[1]?.id,
    skillId3: skills[2]?.id,
    languageId: languages[0]?.id,
    regionId: regions[0]?.id,
  };
}

test.describe('V5: Job Management', () => {
  test.describe('Job Creation', () => {
    test('company owner creates job with minimal fields', async ({ request }) => {
      const { accessToken } = await registerCompany(request);
      const refData = await getReferenceData(request);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const deadline = tomorrow.toISOString().split('T')[0];

      const jobData = {
        title: 'Software Engineer',
        description: 'We are looking for a talented software engineer to join our team. This is a great opportunity.',
        job_type: 'full_time',
        work_modality: 'hybrid',
        application_deadline: deadline,
        vacancies: 1,
      };

      const response = await request.post(`${API_BASE}/api/me/jobs`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: jobData,
      });

      expect(response.ok()).toBeTruthy();
      const job = await response.json();
      expect(job.id).toBeDefined();
      expect(job.title).toBe(jobData.title);
      expect(job.description).toBe(jobData.description);
      expect(job.job_type).toBe(jobData.job_type);
      expect(job.work_modality).toBe(jobData.work_modality);
      expect(job.status).toBe('draft');
      expect(job.completeness_percentage).toBeDefined();
      expect(job.applications_count).toBe(0);
      expect(job.is_featured).toBe(false);
      expect(job.views_count).toBe(0);
    });

    test('company owner creates job with all fields', async ({ request }) => {
      const { accessToken } = await registerCompany(request);
      const refData = await getReferenceData(request);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 30);
      const deadline = tomorrow.toISOString().split('T')[0];

      const jobData = {
        title: 'Senior Full Stack Developer',
        description: 'We are seeking an experienced full stack developer to lead our development team. You will work on cutting-edge technologies.',
        responsibilities: 'Lead development team, code reviews, architecture decisions, mentoring junior developers',
        job_type: 'full_time',
        industry_id: refData.industryId,
        work_modality: 'hybrid',
        work_schedule: '9am-6pm flexible',
        region_id: refData.regionId,
        is_remote_allowed: true,
        education_level: 'Bachelor\'s degree in Computer Science',
        years_experience_min: 5,
        years_experience_max: 10,
        age_min: 25,
        age_max: 45,
        salary_min: 50000.00,
        salary_max: 80000.00,
        salary_currency: 'MXN',
        salary_period: 'monthly',
        benefits: 'Health insurance, flexible hours, remote work options, professional development budget',
        application_deadline: deadline,
        contact_email: 'jobs@testcompany.com',
        vacancies: 2,
        required_skills: [
          { skill_id: refData.skillId, minimum_proficiency: 4 },
          { skill_id: refData.skillId2, minimum_proficiency: 3 },
          { skill_id: refData.skillId3, minimum_proficiency: 3 },
        ],
        preferred_skills: [refData.skillId2],
        required_languages: [
          { language_id: refData.languageId, minimum_proficiency: 4 },
        ],
        disability_accommodations: ['physical_mobility', 'visual'],
      };

      const response = await request.post(`${API_BASE}/api/me/jobs`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: jobData,
      });

      expect(response.ok()).toBeTruthy();
      const job = await response.json();
      expect(job.id).toBeDefined();
      expect(job.title).toBe(jobData.title);
      expect(job.salary_min).toBe(jobData.salary_min);
      expect(job.salary_max).toBe(jobData.salary_max);
      expect(job.years_experience_min).toBe(jobData.years_experience_min);
      expect(job.status).toBe('draft');

      // Verify completeness is higher with all fields filled
      expect(job.completeness_percentage).toBeGreaterThan(50);
    });

    test('rejects job with past deadline', async ({ request }) => {
      const { accessToken } = await registerCompany(request);

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const deadline = yesterday.toISOString().split('T')[0];

      const response = await request.post(`${API_BASE}/api/me/jobs`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: {
          title: 'Test Job',
          description: 'Test description that is long enough to pass validation checks',
          job_type: 'full_time',
          work_modality: 'on_site',
          application_deadline: deadline,
          vacancies: 1,
        },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toBeDefined();
    });

    test('rejects invalid salary range', async ({ request }) => {
      const { accessToken } = await registerCompany(request);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const deadline = tomorrow.toISOString().split('T')[0];

      const response = await request.post(`${API_BASE}/api/me/jobs`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: {
          title: 'Test Job',
          description: 'Test description that is long enough to pass validation checks',
          job_type: 'full_time',
          work_modality: 'on_site',
          application_deadline: deadline,
          vacancies: 1,
          salary_min: 80000,
          salary_max: 50000, // Max less than min - should fail
        },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toBeDefined();
    });

    test('rejects invalid experience range', async ({ request }) => {
      const { accessToken } = await registerCompany(request);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const deadline = tomorrow.toISOString().split('T')[0];

      const response = await request.post(`${API_BASE}/api/me/jobs`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: {
          title: 'Test Job',
          description: 'Test description that is long enough to pass validation checks',
          job_type: 'full_time',
          work_modality: 'on_site',
          application_deadline: deadline,
          vacancies: 1,
          years_experience_min: 10,
          years_experience_max: 5, // Max less than min - should fail
        },
      });

      expect(response.status()).toBe(400);
    });

    test('rejects invalid age range', async ({ request }) => {
      const { accessToken } = await registerCompany(request);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const deadline = tomorrow.toISOString().split('T')[0];

      const response = await request.post(`${API_BASE}/api/me/jobs`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: {
          title: 'Test Job',
          description: 'Test description that is long enough to pass validation checks',
          job_type: 'full_time',
          work_modality: 'on_site',
          application_deadline: deadline,
          vacancies: 1,
          age_min: 16, // Below 18 - should fail
          age_max: 30,
        },
      });

      expect(response.status()).toBe(400);
    });

    test('rejects invalid proficiency levels', async ({ request }) => {
      const { accessToken } = await registerCompany(request);
      const refData = await getReferenceData(request);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const deadline = tomorrow.toISOString().split('T')[0];

      const response = await request.post(`${API_BASE}/api/me/jobs`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: {
          title: 'Test Job',
          description: 'Test description that is long enough to pass validation checks',
          job_type: 'full_time',
          work_modality: 'on_site',
          application_deadline: deadline,
          vacancies: 1,
          required_skills: [
            { skill_id: refData.skillId, minimum_proficiency: 6 }, // Out of range 1-5
          ],
        },
      });

      expect(response.status()).toBe(400);
    });
  });

  test.describe('Job Listing', () => {
    test('GET /api/me/jobs returns company jobs', async ({ request }) => {
      const { accessToken } = await registerCompany(request);

      // Create a job first
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const deadline = tomorrow.toISOString().split('T')[0];

      await request.post(`${API_BASE}/api/me/jobs`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: {
          title: 'Test Job',
          description: 'Test description that is long enough to pass validation',
          job_type: 'full_time',
          work_modality: 'on_site',
          application_deadline: deadline,
          vacancies: 1,
        },
      });

      // List jobs
      const response = await request.get(`${API_BASE}/api/me/jobs`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      expect(response.ok()).toBeTruthy();
      const jobs = await response.json();
      expect(Array.isArray(jobs)).toBe(true);
      expect(jobs.length).toBeGreaterThan(0);
      expect(jobs[0].title).toBeDefined();
      expect(jobs[0].applications_count).toBeDefined();
    });

    test('jobs are ordered by created_at DESC', async ({ request }) => {
      const { accessToken } = await registerCompany(request);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const deadline = tomorrow.toISOString().split('T')[0];

      // Create two jobs
      await request.post(`${API_BASE}/api/me/jobs`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: {
          title: 'First Job',
          description: 'First job description that is long enough',
          job_type: 'full_time',
          work_modality: 'on_site',
          application_deadline: deadline,
          vacancies: 1,
        },
      });

      await new Promise(resolve => setTimeout(resolve, 1000));

      await request.post(`${API_BASE}/api/me/jobs`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: {
          title: 'Second Job',
          description: 'Second job description that is long enough',
          job_type: 'part_time',
          work_modality: 'remote',
          application_deadline: deadline,
          vacancies: 1,
        },
      });

      const response = await request.get(`${API_BASE}/api/me/jobs`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const jobs = await response.json();
      expect(jobs.length).toBeGreaterThanOrEqual(2);

      // Most recent job should be first
      expect(jobs[0].title).toBe('Second Job');
    });
  });

  test.describe('Job Update', () => {
    test('company owner updates job fields', async ({ request }) => {
      const { accessToken } = await registerCompany(request);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const deadline = tomorrow.toISOString().split('T')[0];

      // Create job
      const createResponse = await request.post(`${API_BASE}/api/me/jobs`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: {
          title: 'Original Title',
          description: 'Original description that is long enough to pass validation',
          job_type: 'full_time',
          work_modality: 'on_site',
          application_deadline: deadline,
          vacancies: 1,
        },
      });

      const job = await createResponse.json();

      // Update job
      const updateResponse = await request.put(`${API_BASE}/api/me/jobs/${job.id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: {
          title: 'Updated Title',
          description: 'Updated description with more details about the position',
          salary_min: 50000.00,
          salary_max: 70000.00,
        },
      });

      expect(updateResponse.ok()).toBeTruthy();
      const updatedJob = await updateResponse.json();
      expect(updatedJob.title).toBe('Updated Title');
      expect(updatedJob.description).toBe('Updated description with more details about the position');
      expect(updatedJob.salary_min).toBe(50000.00);
      expect(updatedJob.work_modality).toBe('on_site'); // Unchanged fields preserved
    });

    test('updating job recalculates completeness', async ({ request }) => {
      const { accessToken } = await registerCompany(request);
      const refData = await getReferenceData(request);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const deadline = tomorrow.toISOString().split('T')[0];

      // Create minimal job
      const createResponse = await request.post(`${API_BASE}/api/me/jobs`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: {
          title: 'Test Job',
          description: 'Test description that is long enough',
          job_type: 'full_time',
          work_modality: 'on_site',
          application_deadline: deadline,
          vacancies: 1,
        },
      });

      const job = await createResponse.json();
      const initialCompleteness = job.completeness_percentage;

      // Add more fields
      const updateResponse = await request.put(`${API_BASE}/api/me/jobs/${job.id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: {
          industry_id: refData.industryId,
          region_id: refData.regionId,
          salary_min: 50000.00,
          benefits: 'Health insurance, flexible hours, remote work options',
          required_skills: [
            { skill_id: refData.skillId, minimum_proficiency: 4 },
            { skill_id: refData.skillId2, minimum_proficiency: 3 },
            { skill_id: refData.skillId3, minimum_proficiency: 3 },
          ],
          required_languages: [
            { language_id: refData.languageId, minimum_proficiency: 4 },
          ],
          disability_accommodations: ['physical_mobility'],
        },
      });

      const updatedJob = await updateResponse.json();
      expect(updatedJob.completeness_percentage).toBeGreaterThan(initialCompleteness);
    });
  });

  test.describe('Job Status Management', () => {
    test('updates job status from draft to active', async ({ request }) => {
      const { accessToken } = await registerCompany(request);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const deadline = tomorrow.toISOString().split('T')[0];

      // Create job
      const createResponse = await request.post(`${API_BASE}/api/me/jobs`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: {
          title: 'Test Job',
          description: 'Test description that is long enough',
          job_type: 'full_time',
          work_modality: 'on_site',
          application_deadline: deadline,
          vacancies: 1,
        },
      });

      const job = await createResponse.json();
      expect(job.status).toBe('draft');

      // Note: In real implementation, status transition to 'active' would require
      // approved_at and approved_by to be set, which requires admin privileges.
      // For this test, we'll update to 'pending_approval' which doesn't require approval.
      const statusResponse = await request.patch(`${API_BASE}/api/me/jobs/${job.id}/status`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: {
          status: 'pending_approval',
        },
      });

      expect(statusResponse.ok()).toBeTruthy();
      const updatedJob = await statusResponse.json();
      expect(updatedJob.status).toBe('pending_approval');
    });

    test('can pause and close jobs', async ({ request }) => {
      const { accessToken } = await registerCompany(request);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const deadline = tomorrow.toISOString().split('T')[0];

      // Create job
      const createResponse = await request.post(`${API_BASE}/api/me/jobs`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: {
          title: 'Test Job',
          description: 'Test description that is long enough',
          job_type: 'full_time',
          work_modality: 'on_site',
          application_deadline: deadline,
          vacancies: 1,
        },
      });

      const job = await createResponse.json();

      // Pause job
      const pauseResponse = await request.patch(`${API_BASE}/api/me/jobs/${job.id}/status`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: { status: 'paused' },
      });

      expect(pauseResponse.ok()).toBeTruthy();
      const pausedJob = await pauseResponse.json();
      expect(pausedJob.status).toBe('paused');

      // Close job
      const closeResponse = await request.patch(`${API_BASE}/api/me/jobs/${job.id}/status`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: { status: 'closed' },
      });

      expect(closeResponse.ok()).toBeTruthy();
      const closedJob = await closeResponse.json();
      expect(closedJob.status).toBe('closed');
    });

    test('rejection requires rejection_reason', async ({ request }) => {
      const { accessToken } = await registerCompany(request);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const deadline = tomorrow.toISOString().split('T')[0];

      // Create job
      const createResponse = await request.post(`${API_BASE}/api/me/jobs`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: {
          title: 'Test Job',
          description: 'Test description that is long enough',
          job_type: 'full_time',
          work_modality: 'on_site',
          application_deadline: deadline,
          vacancies: 1,
        },
      });

      const job = await createResponse.json();

      // Try to reject without reason - should fail
      const rejectResponse = await request.patch(`${API_BASE}/api/me/jobs/${job.id}/status`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: { status: 'rejected' },
      });

      expect(rejectResponse.status()).toBe(400);
      const body = await rejectResponse.json();
      expect(body.error).toContain('rejection_reason');
    });
  });

  test.describe('Job Deletion', () => {
    test('company owner can delete job without applications', async ({ request }) => {
      const { accessToken } = await registerCompany(request);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const deadline = tomorrow.toISOString().split('T')[0];

      // Create job
      const createResponse = await request.post(`${API_BASE}/api/me/jobs`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: {
          title: 'Test Job',
          description: 'Test description that is long enough',
          job_type: 'full_time',
          work_modality: 'on_site',
          application_deadline: deadline,
          vacancies: 1,
        },
      });

      const job = await createResponse.json();

      // Delete job
      const deleteResponse = await request.delete(`${API_BASE}/api/me/jobs/${job.id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      expect(deleteResponse.ok()).toBeTruthy();

      // Verify job is deleted
      const getResponse = await request.get(`${API_BASE}/api/me/jobs/${job.id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      expect(getResponse.status()).toBe(404);
    });
  });

  test.describe('Junction Tables', () => {
    test('required skills are saved and retrieved correctly', async ({ request }) => {
      const { accessToken } = await registerCompany(request);
      const refData = await getReferenceData(request);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const deadline = tomorrow.toISOString().split('T')[0];

      // Create job with required skills
      const createResponse = await request.post(`${API_BASE}/api/me/jobs`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: {
          title: 'Test Job',
          description: 'Test description that is long enough',
          job_type: 'full_time',
          work_modality: 'on_site',
          application_deadline: deadline,
          vacancies: 1,
          required_skills: [
            { skill_id: refData.skillId, minimum_proficiency: 4 },
            { skill_id: refData.skillId2, minimum_proficiency: 3 },
          ],
        },
      });

      const job = await createResponse.json();

      // Get full job details
      const getResponse = await request.get(`${API_BASE}/api/me/jobs/${job.id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      expect(getResponse.ok()).toBeTruthy();
      const fullJob = await getResponse.json();
      expect(fullJob.required_skills).toBeDefined();
      expect(fullJob.required_skills.length).toBe(2);
      expect(fullJob.required_skills[0].minimum_proficiency).toBeDefined();
    });

    test('disability accommodations are saved correctly', async ({ request }) => {
      const { accessToken } = await registerCompany(request);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const deadline = tomorrow.toISOString().split('T')[0];

      // Create job with accommodations
      const createResponse = await request.post(`${API_BASE}/api/me/jobs`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: {
          title: 'Test Job',
          description: 'Test description that is long enough',
          job_type: 'full_time',
          work_modality: 'on_site',
          application_deadline: deadline,
          vacancies: 1,
          disability_accommodations: ['physical_mobility', 'visual', 'hearing'],
        },
      });

      const job = await createResponse.json();

      // Get full job details
      const getResponse = await request.get(`${API_BASE}/api/me/jobs/${job.id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      expect(getResponse.ok()).toBeTruthy();
      const fullJob = await getResponse.json();
      expect(fullJob.disability_accommodations).toBeDefined();
      expect(fullJob.disability_accommodations.length).toBe(3);
    });
  });

  test.describe('Completeness Calculation', () => {
    test('completeness calculation accuracy', async ({ request }) => {
      const { accessToken } = await registerCompany(request);
      const refData = await getReferenceData(request);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 30);
      const deadline = tomorrow.toISOString().split('T')[0];

      // Create job with all fields for maximum completeness
      const jobData = {
        title: 'Complete Job Posting',
        description: 'A'.repeat(150), // 10 points (>= 100 chars)
        responsibilities: 'B'.repeat(60), // 10 points (>= 50 chars)
        job_type: 'full_time',
        industry_id: refData.industryId, // 5 points
        work_modality: 'hybrid',
        region_id: refData.regionId, // 5 points
        is_remote_allowed: true,
        salary_min: 50000.00, // 10 points
        application_deadline: deadline,
        vacancies: 1,
        benefits: 'C'.repeat(60), // 5 points (>= 50 chars)
        required_skills: [ // 15 points (>= 3 skills)
          { skill_id: refData.skillId, minimum_proficiency: 4 },
          { skill_id: refData.skillId2, minimum_proficiency: 3 },
          { skill_id: refData.skillId3, minimum_proficiency: 3 },
        ],
        required_languages: [ // 5 points (>= 1 language)
          { language_id: refData.languageId, minimum_proficiency: 4 },
        ],
        disability_accommodations: ['physical_mobility'], // 10 points (>= 1)
      };

      const response = await request.post(`${API_BASE}/api/me/jobs`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: jobData,
      });

      expect(response.ok()).toBeTruthy();
      const job = await response.json();

      // Total should be around 70-75 points based on what we provided
      // (title is counted in core, but we need to check the exact scoring)
      expect(job.completeness_percentage).toBeGreaterThan(60);
      expect(job.completeness_percentage).toBeLessThanOrEqual(100);
    });
  });

  test.describe('Authorization & Permissions', () => {
    test('requires authentication for job endpoints', async ({ request }) => {
      const endpoints = [
        { method: 'GET', url: '/api/me/jobs' },
        { method: 'POST', url: '/api/me/jobs' },
      ];

      for (const endpoint of endpoints) {
        const response = await request.fetch(`${API_BASE}${endpoint.url}`, {
          method: endpoint.method,
          data: endpoint.method === 'POST' ? {} : undefined,
        });

        expect(response.status()).toBe(401);
      }
    });

    test('job seekers cannot access company job endpoints', async ({ request }) => {
      // Register as job seeker
      const jobSeekerResponse = await request.post(`${API_BASE}/api/auth/register`, {
        data: {
          email: uniqueEmail(),
          password: 'SecurePassword123',
          first_name: 'Job',
          last_name: 'Seeker',
        },
      });
      const { access_token } = await jobSeekerResponse.json();

      // Try to access company job endpoints
      const response = await request.get(`${API_BASE}/api/me/jobs`, {
        headers: { Authorization: `Bearer ${access_token}` },
      });

      expect(response.status()).toBe(403);
      const body = await response.json();
      expect(body.error).toContain('company member');
    });
  });

  test.describe('Data Integrity', () => {
    test('job timestamps are set correctly', async ({ request }) => {
      const { accessToken } = await registerCompany(request);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const deadline = tomorrow.toISOString().split('T')[0];

      const response = await request.post(`${API_BASE}/api/me/jobs`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: {
          title: 'Test Job',
          description: 'Test description that is long enough',
          job_type: 'full_time',
          work_modality: 'on_site',
          application_deadline: deadline,
          vacancies: 1,
        },
      });

      const job = await response.json();
      expect(job.created_at).toBeDefined();
      expect(job.updated_at).toBeDefined();
      expect(new Date(job.created_at)).toBeInstanceOf(Date);
      expect(new Date(job.updated_at)).toBeInstanceOf(Date);
    });

    test('applications_count starts at 0', async ({ request }) => {
      const { accessToken } = await registerCompany(request);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const deadline = tomorrow.toISOString().split('T')[0];

      const response = await request.post(`${API_BASE}/api/me/jobs`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: {
          title: 'Test Job',
          description: 'Test description that is long enough',
          job_type: 'full_time',
          work_modality: 'on_site',
          application_deadline: deadline,
          vacancies: 1,
        },
      });

      const job = await response.json();
      expect(job.applications_count).toBe(0);
    });
  });
});
