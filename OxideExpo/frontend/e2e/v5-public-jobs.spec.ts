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

  // Get company_id and activate for testing
  const { execSync } = require('child_process');
  const cmd = `docker exec empleos_db_dev psql -U postgres -d empleos_inclusivos -t -c "SELECT company_id FROM company_members WHERE user_id = '${userId}'"`;
  const companyId = execSync(cmd, { encoding: 'utf8' }).trim();

  if (!companyId) {
    throw new Error(`Failed to get company_id for user ${userId}`);
  }

  await activateCompanyForTesting(companyId, userId);

  return {
    email,
    userId,
    companyId,
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
  };
}

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

// Helper to get reference data IDs
async function getReferenceData(request: any) {
  const [industriesRes, workAreasRes, regionsRes] = await Promise.all([
    request.get(`${API_BASE}/api/reference/industries`),
    request.get(`${API_BASE}/api/reference/work-areas`),
    request.get(`${API_BASE}/api/reference/regions`),
  ]);

  const industries = await industriesRes.json();
  const workAreas = await workAreasRes.json();
  const regions = await regionsRes.json();

  return {
    industryId: industries[0]?.id,
    industryId2: industries[1]?.id,
    workAreaId: workAreas[0]?.id,
    regionId: regions[0]?.id,
    regionId2: regions[1]?.id,
  };
}

// Helper to create an active job
async function createActiveJob(request: any, accessToken: string, userId: string, overrides = {}) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 30);
  const deadline = tomorrow.toISOString().split('T')[0];

  const jobData = {
    title: 'Software Engineer',
    description: 'We are looking for a talented software engineer to join our team. This is a great opportunity with excellent benefits.',
    job_type: 'full_time',
    work_modality: 'hybrid',
    application_deadline: deadline,
    vacancies: 1,
    ...overrides,
  };

  // Create job
  const createResponse = await request.post(`${API_BASE}/api/me/jobs`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: jobData,
  });

  expect(createResponse.ok()).toBeTruthy();
  const job = await createResponse.json();

  // Activate job for E2E testing (bypass admin approval)
  const { execSync } = require('child_process');
  const sql = `UPDATE jobs SET status = 'active'::job_status, approved_at = NOW(), approved_by = '${userId}' WHERE id = '${job.id}'`;
  const cmd = `docker exec empleos_db_dev psql -U postgres -d empleos_inclusivos -c "${sql}"`;
  execSync(cmd, { encoding: 'utf8' });

  return job;
}

test.describe('V5: Public Job Listings', () => {
  test.describe('Public Job Listing Endpoint', () => {
    test('GET /api/jobs returns active jobs without authentication', async ({ request }) => {
      // Create an active job
      const { accessToken, userId } = await registerCompany(request, 'Public Test Company');
      await createActiveJob(request, accessToken, userId, {
        title: 'Public Software Engineer',
      });

      // Fetch public jobs without authentication
      const response = await request.get(`${API_BASE}/api/jobs`);

      expect(response.ok()).toBeTruthy();
      const jobs = await response.json();
      expect(Array.isArray(jobs)).toBe(true);

      // Verify response structure
      if (jobs.length > 0) {
        const job = jobs[0];
        expect(job.id).toBeDefined();
        expect(job.title).toBeDefined();
        expect(job.description).toBeDefined();
        expect(job.job_type).toBeDefined();
        expect(job.work_modality).toBeDefined();
        expect(job.application_deadline).toBeDefined();
        expect(job.company_name).toBeDefined();
        expect(job.is_featured).toBeDefined();
        expect(job.created_at).toBeDefined();
      }
    });

    test('public job listing excludes sensitive fields', async ({ request }) => {
      // Create an active job
      const { accessToken, userId } = await registerCompany(request);
      await createActiveJob(request, accessToken, userId);

      // Fetch public jobs
      const response = await request.get(`${API_BASE}/api/jobs`);

      expect(response.ok()).toBeTruthy();
      const jobs = await response.json();

      if (jobs.length > 0) {
        const job = jobs[0];

        // Should NOT have sensitive company data
        expect(job.company_id).toBeUndefined();
        expect(job.posted_by).toBeUndefined();
        expect(job.status).toBeUndefined();
        expect(job.approved_at).toBeUndefined();
        expect(job.approved_by).toBeUndefined();
        expect(job.rejection_reason).toBeUndefined();
        expect(job.completeness_percentage).toBeUndefined();
        expect(job.applications_count).toBeUndefined();

        // Should NOT have salary details in public view
        expect(job.salary_min).toBeUndefined();
        expect(job.salary_max).toBeUndefined();
        expect(job.salary_currency).toBeUndefined();
        expect(job.salary_period).toBeUndefined();

        // SHOULD have public-facing fields
        expect(job.title).toBeDefined();
        expect(job.description).toBeDefined();
        expect(job.company_name).toBeDefined();
        expect(job.benefits).toBeDefined();
      }
    });

    test('only returns active jobs with future deadlines', async ({ request }) => {
      const { accessToken, userId } = await registerCompany(request);

      // Create draft job (should NOT appear)
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const deadline = tomorrow.toISOString().split('T')[0];

      await request.post(`${API_BASE}/api/me/jobs`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: {
          title: 'Draft Job',
          description: 'This is a draft job that should not appear publicly',
          job_type: 'full_time',
          work_modality: 'on_site',
          application_deadline: deadline,
          vacancies: 1,
        },
      });

      // Create active job (SHOULD appear)
      await createActiveJob(request, accessToken, userId, {
        title: 'Active Public Job',
      });

      // Fetch public jobs
      const response = await request.get(`${API_BASE}/api/jobs`);
      const jobs = await response.json();

      // Verify draft job doesn't appear
      const draftJob = jobs.find((j: any) => j.title === 'Draft Job');
      expect(draftJob).toBeUndefined();

      // Verify active job appears
      const activeJob = jobs.find((j: any) => j.title === 'Active Public Job');
      expect(activeJob).toBeDefined();
    });

    test('paused and closed jobs do not appear in public listing', async ({ request }) => {
      const { accessToken, userId } = await registerCompany(request);

      // Create active job
      const activeJob = await createActiveJob(request, accessToken, userId, {
        title: 'Active Job',
      });

      // Pause it
      await request.patch(`${API_BASE}/api/me/jobs/${activeJob.id}/status`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: { status: 'paused' },
      });

      // Fetch public jobs
      const response = await request.get(`${API_BASE}/api/jobs`);
      const jobs = await response.json();

      // Paused job should NOT appear
      const pausedJob = jobs.find((j: any) => j.id === activeJob.id);
      expect(pausedJob).toBeUndefined();
    });
  });

  test.describe('Job Filtering', () => {
    test('filters jobs by industry_id', async ({ request }) => {
      const { accessToken, userId } = await registerCompany(request);
      const refData = await getReferenceData(request);

      // Create job with specific industry
      await createActiveJob(request, accessToken, userId, {
        title: 'Tech Job',
        industry_id: refData.industryId,
      });

      // Filter by industry
      const response = await request.get(
        `${API_BASE}/api/jobs?industry_id=${refData.industryId}`
      );

      expect(response.ok()).toBeTruthy();
      const jobs = await response.json();

      // All returned jobs should match the industry filter
      for (const job of jobs) {
        expect(job.industry_id).toBe(refData.industryId);
      }
    });

    test('filters jobs by region_id', async ({ request }) => {
      const { accessToken, userId } = await registerCompany(request);
      const refData = await getReferenceData(request);

      // Create job with specific region
      await createActiveJob(request, accessToken, userId, {
        title: 'Regional Job',
        region_id: refData.regionId,
      });

      // Filter by region
      const response = await request.get(`${API_BASE}/api/jobs?region_id=${refData.regionId}`);

      expect(response.ok()).toBeTruthy();
      const jobs = await response.json();

      // All returned jobs should match the region filter
      for (const job of jobs) {
        expect(job.region_id).toBe(refData.regionId);
      }
    });

    test('filters jobs by work_area_id', async ({ request }) => {
      const { accessToken, userId } = await registerCompany(request);
      const refData = await getReferenceData(request);

      // Create job with specific work area
      await createActiveJob(request, accessToken, userId, {
        title: 'Work Area Job',
        work_area_id: refData.workAreaId,
      });

      // Filter by work area
      const response = await request.get(
        `${API_BASE}/api/jobs?work_area_id=${refData.workAreaId}`
      );

      expect(response.ok()).toBeTruthy();
      const jobs = await response.json();

      // All returned jobs should match the work area filter
      for (const job of jobs) {
        expect(job.work_area_id).toBe(refData.workAreaId);
      }
    });

    test('filters jobs by job_type', async ({ request }) => {
      const { accessToken, userId } = await registerCompany(request);

      // Create jobs with different types
      await createActiveJob(request, accessToken, userId, {
        title: 'Full Time Job',
        job_type: 'full_time',
      });

      await createActiveJob(request, accessToken, userId, {
        title: 'Part Time Job',
        job_type: 'part_time',
      });

      // Filter by full_time
      const response = await request.get(`${API_BASE}/api/jobs?job_type=full_time`);

      expect(response.ok()).toBeTruthy();
      const jobs = await response.json();

      // All returned jobs should be full_time
      for (const job of jobs) {
        expect(job.job_type).toBe('full_time');
      }
    });

    test('filters jobs by work_modality', async ({ request }) => {
      const { accessToken, userId } = await registerCompany(request);

      // Create jobs with different modalities
      await createActiveJob(request, accessToken, userId, {
        title: 'Remote Job',
        work_modality: 'remote',
      });

      await createActiveJob(request, accessToken, userId, {
        title: 'On-site Job',
        work_modality: 'on_site',
      });

      // Filter by remote
      const response = await request.get(`${API_BASE}/api/jobs?work_modality=remote`);

      expect(response.ok()).toBeTruthy();
      const jobs = await response.json();

      // All returned jobs should be remote
      for (const job of jobs) {
        expect(job.work_modality).toBe('remote');
      }
    });

    test('filters jobs by is_remote_allowed', async ({ request }) => {
      const { accessToken, userId } = await registerCompany(request);

      // Create job that allows remote
      await createActiveJob(request, accessToken, userId, {
        title: 'Remote Allowed Job',
        is_remote_allowed: true,
      });

      // Filter by remote allowed
      const response = await request.get(`${API_BASE}/api/jobs?is_remote_allowed=true`);

      expect(response.ok()).toBeTruthy();
      const jobs = await response.json();

      // All returned jobs should allow remote
      for (const job of jobs) {
        expect(job.is_remote_allowed).toBe(true);
      }
    });

    test('combines multiple filters', async ({ request }) => {
      const { accessToken, userId } = await registerCompany(request);
      const refData = await getReferenceData(request);

      // Create job matching multiple criteria
      await createActiveJob(request, accessToken, userId, {
        title: 'Filtered Job',
        industry_id: refData.industryId,
        job_type: 'full_time',
        work_modality: 'remote',
      });

      // Filter with multiple parameters
      const response = await request.get(
        `${API_BASE}/api/jobs?industry_id=${refData.industryId}&job_type=full_time&work_modality=remote`
      );

      expect(response.ok()).toBeTruthy();
      const jobs = await response.json();

      // All returned jobs should match all filters
      for (const job of jobs) {
        expect(job.industry_id).toBe(refData.industryId);
        expect(job.job_type).toBe('full_time');
        expect(job.work_modality).toBe('remote');
      }
    });
  });

  test.describe('Full-Text Search', () => {
    test('searches jobs by title', async ({ request }) => {
      const { accessToken, userId } = await registerCompany(request);

      const uniqueTitle = `Unique-Engineer-${Date.now()}`;
      await createActiveJob(request, accessToken, userId, {
        title: uniqueTitle,
        description: 'Standard job description',
      });

      // Search by title
      const response = await request.get(`${API_BASE}/api/jobs?search=${uniqueTitle}`);

      expect(response.ok()).toBeTruthy();
      const jobs = await response.json();

      // Should find the job with matching title
      const foundJob = jobs.find((j: any) => j.title === uniqueTitle);
      expect(foundJob).toBeDefined();
    });

    test('searches jobs by description', async ({ request }) => {
      const { accessToken, userId } = await registerCompany(request);

      const uniqueTerm = `UniqueSkill${Date.now()}`;
      await createActiveJob(request, accessToken, userId, {
        title: 'Generic Job Title',
        description: `We are looking for someone with ${uniqueTerm} expertise.`,
      });

      // Search by description keyword
      const response = await request.get(`${API_BASE}/api/jobs?search=${uniqueTerm}`);

      expect(response.ok()).toBeTruthy();
      const jobs = await response.json();

      // Should find the job with matching description
      const foundJob = jobs.find((j: any) => j.description.includes(uniqueTerm));
      expect(foundJob).toBeDefined();
    });

    test('search is case-insensitive', async ({ request }) => {
      const { accessToken, userId } = await registerCompany(request);

      const baseTitle = `Engineer${Date.now()}`;
      await createActiveJob(request, accessToken, userId, {
        title: baseTitle,
      });

      // Search with different case
      const response = await request.get(
        `${API_BASE}/api/jobs?search=${baseTitle.toLowerCase()}`
      );

      expect(response.ok()).toBeTruthy();
      const jobs = await response.json();

      // Should still find the job
      const foundJob = jobs.find((j: any) => j.title.includes(baseTitle));
      expect(foundJob).toBeDefined();
    });

    test('combines search with filters', async ({ request }) => {
      const { accessToken, userId } = await registerCompany(request);
      const refData = await getReferenceData(request);

      const searchTerm = `SearchableJob${Date.now()}`;
      await createActiveJob(request, accessToken, userId, {
        title: searchTerm,
        job_type: 'full_time',
        work_modality: 'remote',
        industry_id: refData.industryId,
      });

      // Search with filters
      const response = await request.get(
        `${API_BASE}/api/jobs?search=${searchTerm}&job_type=full_time&industry_id=${refData.industryId}`
      );

      expect(response.ok()).toBeTruthy();
      const jobs = await response.json();

      // Should find job matching both search and filters
      const foundJob = jobs.find((j: any) => j.title.includes(searchTerm));
      expect(foundJob).toBeDefined();
      if (foundJob) {
        expect(foundJob.job_type).toBe('full_time');
        expect(foundJob.industry_id).toBe(refData.industryId);
      }
    });
  });

  test.describe('Job Ordering', () => {
    test('featured jobs appear first', async ({ request }) => {
      const { accessToken, userId } = await registerCompany(request);

      // Create regular job
      await createActiveJob(request, accessToken, userId, {
        title: 'Regular Job',
      });

      // Note: Setting is_featured requires database-level modification or admin privileges
      // This test verifies the ordering works if featured jobs exist

      const response = await request.get(`${API_BASE}/api/jobs`);
      const jobs = await response.json();

      // If there are featured and non-featured jobs, featured should come first
      let foundNonFeatured = false;
      for (const job of jobs) {
        if (foundNonFeatured && job.is_featured) {
          throw new Error('Featured job found after non-featured job');
        }
        if (!job.is_featured) {
          foundNonFeatured = true;
        }
      }

      // Test passes if no ordering violations found
      expect(true).toBe(true);
    });

    test('jobs ordered by created_at DESC within featured/non-featured groups', async ({
      request,
    }) => {
      const { accessToken, userId } = await registerCompany(request);

      // Create two jobs with delay
      await createActiveJob(request, accessToken, userId, {
        title: 'Older Job',
      });

      await new Promise(resolve => setTimeout(resolve, 1000));

      await createActiveJob(request, accessToken, userId, {
        title: 'Newer Job',
      });

      const response = await request.get(`${API_BASE}/api/jobs`);
      const jobs = await response.json();

      // Find our test jobs
      const olderJob = jobs.find((j: any) => j.title === 'Older Job');
      const newerJob = jobs.find((j: any) => j.title === 'Newer Job');

      if (olderJob && newerJob) {
        const olderIndex = jobs.indexOf(olderJob);
        const newerIndex = jobs.indexOf(newerJob);

        // Newer job should appear before older job (lower index)
        expect(newerIndex).toBeLessThan(olderIndex);
      }
    });
  });

  test.describe('Pagination', () => {
    test('respects limit parameter', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/jobs?limit=5`);

      expect(response.ok()).toBeTruthy();
      const jobs = await response.json();
      expect(jobs.length).toBeLessThanOrEqual(5);
    });

    test('respects offset parameter', async ({ request }) => {
      // Get first page
      const firstPage = await request.get(`${API_BASE}/api/jobs?limit=10&offset=0`);
      const firstJobs = await firstPage.json();

      // Get second page
      const secondPage = await request.get(`${API_BASE}/api/jobs?limit=10&offset=10`);
      const secondJobs = await secondPage.json();

      // Jobs should be different
      if (firstJobs.length > 0 && secondJobs.length > 0) {
        const firstIds = firstJobs.map((j: any) => j.id);
        const secondIds = secondJobs.map((j: any) => j.id);

        // No overlap between pages
        const overlap = firstIds.filter((id: string) => secondIds.includes(id));
        expect(overlap.length).toBe(0);
      }
    });

    test('default limit prevents excessive results', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/jobs`);

      expect(response.ok()).toBeTruthy();
      const jobs = await response.json();

      // Default limit should be 50 based on plan
      expect(jobs.length).toBeLessThanOrEqual(50);
    });
  });

  test.describe('Single Job Public Endpoint', () => {
    test('GET /api/jobs/:id returns single job without authentication', async ({ request }) => {
      // Create active job
      const { accessToken, userId } = await registerCompany(request, 'Single Job Test Company');
      const job = await createActiveJob(request, accessToken, userId, {
        title: 'Single Job Test',
      });

      // Fetch single job without authentication
      const response = await request.get(`${API_BASE}/api/jobs/${job.id}`);

      expect(response.ok()).toBeTruthy();
      const publicJob = await response.json();

      expect(publicJob.id).toBe(job.id);
      expect(publicJob.title).toBe('Single Job Test');
      expect(publicJob.company_name).toBeDefined();

      // Verify sensitive fields are excluded
      expect(publicJob.company_id).toBeUndefined();
      expect(publicJob.posted_by).toBeUndefined();
      expect(publicJob.status).toBeUndefined();
      expect(publicJob.applications_count).toBeUndefined();
    });

    test('returns 404 for non-active jobs', async ({ request }) => {
      // Create draft job
      const { accessToken, userId } = await registerCompany(request);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const deadline = tomorrow.toISOString().split('T')[0];

      const createResponse = await request.post(`${API_BASE}/api/me/jobs`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: {
          title: 'Draft Job',
          description: 'This is a draft job',
          job_type: 'full_time',
          work_modality: 'on_site',
          application_deadline: deadline,
          vacancies: 1,
        },
      });

      const draftJob = await createResponse.json();

      // Try to fetch draft job via public endpoint
      const response = await request.get(`${API_BASE}/api/jobs/${draftJob.id}`);

      expect(response.status()).toBe(404);
    });

    test('returns 404 for non-existent job', async ({ request }) => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request.get(`${API_BASE}/api/jobs/${fakeId}`);

      expect(response.status()).toBe(404);
    });

    test('returns 400 for invalid job ID format', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/jobs/invalid-uuid`);

      expect(response.status()).toBe(400);
    });
  });

  test.describe('Company Information', () => {
    test('includes minimal company information', async ({ request }) => {
      const companyName = `Test Company ${Date.now()}`;
      const { accessToken, userId } = await registerCompany(request, companyName);

      await createActiveJob(request, accessToken, userId, {
        title: 'Job with Company Info',
      });

      const response = await request.get(`${API_BASE}/api/jobs`);
      const jobs = await response.json();

      const testJob = jobs.find((j: any) => j.title === 'Job with Company Info');

      if (testJob) {
        // Should have company name
        expect(testJob.company_name).toBe(companyName);

        // Should have company logo URL if set (optional)
        expect(testJob.company_logo_url).toBeDefined();

        // Should NOT have other company details
        expect(testJob.company_id).toBeUndefined();
        expect(testJob.company_description).toBeUndefined();
      }
    });
  });

  test.describe('Data Integrity', () => {
    test('public jobs have valid date formats', async ({ request }) => {
      const { accessToken, userId } = await registerCompany(request);
      await createActiveJob(request, accessToken, userId);

      const response = await request.get(`${API_BASE}/api/jobs`);
      const jobs = await response.json();

      if (jobs.length > 0) {
        const job = jobs[0];

        // Verify date fields are valid
        expect(new Date(job.application_deadline)).toBeInstanceOf(Date);
        expect(new Date(job.created_at)).toBeInstanceOf(Date);

        // Deadline should be in the future
        const deadline = new Date(job.application_deadline);
        const now = new Date();
        expect(deadline.getTime()).toBeGreaterThan(now.getTime());
      }
    });

    test('public jobs have valid enum values', async ({ request }) => {
      const { accessToken, userId } = await registerCompany(request);
      await createActiveJob(request, accessToken, userId);

      const response = await request.get(`${API_BASE}/api/jobs`);
      const jobs = await response.json();

      if (jobs.length > 0) {
        const job = jobs[0];

        // Verify enum fields have valid values
        const validJobTypes = [
          'full_time',
          'part_time',
          'contract',
          'temporary',
          'internship',
          'freelance',
        ];
        expect(validJobTypes).toContain(job.job_type);

        const validModalities = ['on_site', 'remote', 'hybrid'];
        expect(validModalities).toContain(job.work_modality);

        expect(typeof job.is_remote_allowed).toBe('boolean');
        expect(typeof job.is_featured).toBe('boolean');
        expect(typeof job.vacancies).toBe('number');
        expect(job.vacancies).toBeGreaterThanOrEqual(1);
      }
    });
  });
});
