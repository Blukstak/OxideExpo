import { test, expect } from '@playwright/test';

// Base URL for the API (backend runs on port 8080 in Docker)
const API_BASE = 'http://localhost:8080';

// Helper to generate unique test emails
const uniqueEmail = () => `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;

// Helper to register a job seeker and return access token
async function registerJobSeeker(request: any) {
  const email = uniqueEmail();
  const password = 'SecurePassword123!';

  const response = await request.post(`${API_BASE}/api/auth/register`, {
    data: {
      email,
      password,
      first_name: 'Test',
      last_name: 'JobSeeker',
    },
  });

  const { access_token } = await response.json();
  return { email, access_token };
}

test.describe('V3: Job Seeker Profile', () => {
  test.describe('Profile Basics', () => {
    test('GET /api/me/profile creates profile on first access', async ({ request }) => {
      const { access_token } = await registerJobSeeker(request);

      const response = await request.get(`${API_BASE}/api/me/profile`, {
        headers: { Authorization: `Bearer ${access_token}` },
      });

      expect(response.ok()).toBeTruthy();
      const profile = await response.json();

      expect(profile.user_id).toBeDefined();
      expect(profile.completeness_percentage).toBe(0); // New profile is 0% complete
      expect(profile.phone).toBeNull();
      expect(profile.date_of_birth).toBeNull();
      expect(profile.bio).toBeNull();
      expect(profile.created_at).toBeDefined();
      expect(profile.updated_at).toBeDefined();
    });

    test('PUT /api/me/profile updates profile information', async ({ request }) => {
      const { access_token } = await registerJobSeeker(request);

      const response = await request.put(`${API_BASE}/api/me/profile`, {
        headers: { Authorization: `Bearer ${access_token}` },
        data: {
          phone: '+56912345678',
          date_of_birth: '1990-05-15',
          gender: 'male',
          marital_status: 'single',
          nationality: 'Chilean',
          national_id: '12.345.678-9',
          bio: 'Experienced software developer',
          professional_headline: 'Senior Full-Stack Developer',
          region_id: null,
          municipality_id: null,
          address: null,
        },
      });

      expect(response.ok()).toBeTruthy();
      const profile = await response.json();

      expect(profile.phone).toBe('+56912345678');
      expect(profile.date_of_birth).toBe('1990-05-15');
      expect(profile.gender).toBe('male');
      expect(profile.marital_status).toBe('single');
      expect(profile.nationality).toBe('Chilean');
      expect(profile.national_id).toBe('12.345.678-9');
      expect(profile.bio).toBe('Experienced software developer');
      expect(profile.professional_headline).toBe('Senior Full-Stack Developer');
      expect(profile.completeness_percentage).toBeGreaterThan(0);
    });

    test('profile endpoints require authentication', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/me/profile`);
      expect(response.status()).toBe(401);
    });

    test('profile endpoints reject non-job-seeker user types', async ({ request }) => {
      // Register a company member
      const email = uniqueEmail();
      const registerRes = await request.post(`${API_BASE}/api/auth/register/company`, {
        data: {
          email,
          password: 'SecurePassword123!',
          first_name: 'Company',
          last_name: 'Admin',
          company_name: 'Test Company',
        },
      });
      const { access_token } = await registerRes.json();

      // Try to access job seeker profile endpoint
      const response = await request.get(`${API_BASE}/api/me/profile`, {
        headers: { Authorization: `Bearer ${access_token}` },
      });

      expect(response.status()).toBe(403);
      const body = await response.json();
      expect(body.error).toContain('job seekers');
    });
  });

  test.describe('Disability Information', () => {
    test('GET /api/me/disability returns null if not set', async ({ request }) => {
      const { access_token } = await registerJobSeeker(request);

      const response = await request.get(`${API_BASE}/api/me/disability`, {
        headers: { Authorization: `Bearer ${access_token}` },
      });

      expect(response.ok()).toBeTruthy();
      const disability = await response.json();
      expect(disability).toBeNull();
    });

    test('PUT /api/me/disability creates disability information', async ({ request }) => {
      const { access_token } = await registerJobSeeker(request);

      const response = await request.put(`${API_BASE}/api/me/disability`, {
        headers: { Authorization: `Bearer ${access_token}` },
        data: {
          category: 'physical_mobility',
          description: 'Uses wheelchair for mobility',
          has_disability_certificate: true,
          disability_percentage: 65,
          requires_accommodations: true,
          accommodation_details: 'Wheelchair accessible workspace required',
        },
      });

      expect(response.ok()).toBeTruthy();
      const disability = await response.json();

      expect(disability.category).toBe('physical_mobility');
      expect(disability.description).toBe('Uses wheelchair for mobility');
      expect(disability.has_disability_certificate).toBe(true);
      expect(disability.disability_percentage).toBe(65);
      expect(disability.requires_accommodations).toBe(true);
      expect(disability.accommodation_details).toBe('Wheelchair accessible workspace required');
    });

    test('PUT /api/me/disability updates existing disability information', async ({ request }) => {
      const { access_token } = await registerJobSeeker(request);

      // Create disability info
      await request.put(`${API_BASE}/api/me/disability`, {
        headers: { Authorization: `Bearer ${access_token}` },
        data: {
          category: 'visual',
          description: 'Initial description',
          has_disability_certificate: false,
          disability_percentage: null,
          requires_accommodations: false,
          accommodation_details: null,
        },
      });

      // Update it
      const response = await request.put(`${API_BASE}/api/me/disability`, {
        headers: { Authorization: `Bearer ${access_token}` },
        data: {
          category: 'hearing',
          description: 'Updated description',
          has_disability_certificate: true,
          disability_percentage: 40,
          requires_accommodations: true,
          accommodation_details: 'Requires sign language interpreter',
        },
      });

      expect(response.ok()).toBeTruthy();
      const disability = await response.json();
      expect(disability.category).toBe('hearing');
      expect(disability.description).toBe('Updated description');
      expect(disability.has_disability_certificate).toBe(true);
      expect(disability.disability_percentage).toBe(40);
    });
  });

  test.describe('Education Records', () => {
    test('GET /api/me/education returns empty array initially', async ({ request }) => {
      const { access_token } = await registerJobSeeker(request);

      const response = await request.get(`${API_BASE}/api/me/education`, {
        headers: { Authorization: `Bearer ${access_token}` },
      });

      expect(response.ok()).toBeTruthy();
      const records = await response.json();
      expect(Array.isArray(records)).toBeTruthy();
      expect(records).toHaveLength(0);
    });

    test('POST /api/me/education creates education record', async ({ request }) => {
      const { access_token } = await registerJobSeeker(request);

      const response = await request.post(`${API_BASE}/api/me/education`, {
        headers: { Authorization: `Bearer ${access_token}` },
        data: {
          institution_id: null,
          institution_name: 'Universidad de Chile',
          level: 'undergraduate',
          field_of_study_id: null,
          field_of_study_name: 'Computer Science',
          degree_title: 'Bachelor of Science in Computer Science',
          status: 'completed',
          start_date: '2015-03-01',
          end_date: '2019-12-15',
          description: 'Specialized in software engineering and databases',
          achievements: 'Graduated with honors, Dean\'s List',
        },
      });

      expect(response.ok()).toBeTruthy();
      const record = await response.json();

      expect(record.id).toBeDefined();
      expect(record.institution_name).toBe('Universidad de Chile');
      expect(record.level).toBe('undergraduate');
      expect(record.field_of_study_name).toBe('Computer Science');
      expect(record.degree_title).toBe('Bachelor of Science in Computer Science');
      expect(record.status).toBe('completed');
      expect(record.start_date).toBe('2015-03-01');
      expect(record.end_date).toBe('2019-12-15');
      expect(record.description).toBe('Specialized in software engineering and databases');
    });

    test('PUT /api/me/education/{id} updates education record', async ({ request }) => {
      const { access_token } = await registerJobSeeker(request);

      // Create a record
      const createRes = await request.post(`${API_BASE}/api/me/education`, {
        headers: { Authorization: `Bearer ${access_token}` },
        data: {
          institution_name: 'Test University',
          level: 'undergraduate',
          status: 'in_progress',
          start_date: '2020-01-01',
          end_date: null,
          institution_id: null,
          field_of_study_id: null,
          field_of_study_name: null,
          degree_title: null,
          description: null,
          achievements: null,
        },
      });
      const created = await createRes.json();

      // Update it
      const updateRes = await request.put(`${API_BASE}/api/me/education/${created.id}`, {
        headers: { Authorization: `Bearer ${access_token}` },
        data: {
          institution_name: 'Updated University',
          level: 'graduate',
          status: 'completed',
          start_date: '2020-01-01',
          end_date: '2022-12-31',
          institution_id: null,
          field_of_study_id: null,
          field_of_study_name: 'Data Science',
          degree_title: 'Master of Science',
          description: 'Advanced machine learning',
          achievements: 'Thesis published',
        },
      });

      expect(updateRes.ok()).toBeTruthy();
      const updated = await updateRes.json();
      expect(updated.id).toBe(created.id);
      expect(updated.institution_name).toBe('Updated University');
      expect(updated.level).toBe('graduate');
      expect(updated.status).toBe('completed');
      expect(updated.field_of_study_name).toBe('Data Science');
    });

    test('DELETE /api/me/education/{id} deletes education record', async ({ request }) => {
      const { access_token } = await registerJobSeeker(request);

      // Create a record
      const createRes = await request.post(`${API_BASE}/api/me/education`, {
        headers: { Authorization: `Bearer ${access_token}` },
        data: {
          institution_name: 'Test University',
          level: 'undergraduate',
          status: 'completed',
          start_date: '2015-01-01',
          end_date: '2019-01-01',
          institution_id: null,
          field_of_study_id: null,
          field_of_study_name: null,
          degree_title: null,
          description: null,
          achievements: null,
        },
      });
      const created = await createRes.json();

      // Delete it
      const deleteRes = await request.delete(`${API_BASE}/api/me/education/${created.id}`, {
        headers: { Authorization: `Bearer ${access_token}` },
      });

      expect(deleteRes.ok()).toBeTruthy();
      const body = await deleteRes.json();
      expect(body.message).toContain('deleted');

      // Verify it's gone
      const listRes = await request.get(`${API_BASE}/api/me/education`, {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      const records = await listRes.json();
      expect(records).toHaveLength(0);
    });
  });

  test.describe('Work Experience', () => {
    test('POST /api/me/experience creates work experience', async ({ request }) => {
      const { access_token } = await registerJobSeeker(request);

      const response = await request.post(`${API_BASE}/api/me/experience`, {
        headers: { Authorization: `Bearer ${access_token}` },
        data: {
          company_name: 'TechCorp Inc.',
          industry_id: null,
          position_title: 'Software Engineer',
          work_area_id: null,
          position_level_id: null,
          employment_type: 'full_time',
          is_current: true,
          start_date: '2020-01-15',
          end_date: null,
          region_id: null,
          municipality_id: null,
          description: 'Developing web applications using React and Node.js',
          achievements: 'Led migration to microservices architecture',
        },
      });

      expect(response.ok()).toBeTruthy();
      const experience = await response.json();

      expect(experience.id).toBeDefined();
      expect(experience.company_name).toBe('TechCorp Inc.');
      expect(experience.position_title).toBe('Software Engineer');
      expect(experience.employment_type).toBe('full_time');
      expect(experience.is_current).toBe(true);
      expect(experience.start_date).toBe('2020-01-15');
      expect(experience.end_date).toBeNull();
      expect(experience.description).toBe('Developing web applications using React and Node.js');
    });

    test('PUT /api/me/experience/{id} updates work experience', async ({ request }) => {
      const { access_token } = await registerJobSeeker(request);

      // Create experience
      const createRes = await request.post(`${API_BASE}/api/me/experience`, {
        headers: { Authorization: `Bearer ${access_token}` },
        data: {
          company_name: 'Old Company',
          position_title: 'Junior Developer',
          employment_type: 'full_time',
          is_current: true,
          start_date: '2020-01-01',
          end_date: null,
          industry_id: null,
          work_area_id: null,
          position_level_id: null,
          region_id: null,
          municipality_id: null,
          description: null,
          achievements: null,
        },
      });
      const created = await createRes.json();

      // Update it (marking as no longer current)
      const updateRes = await request.put(`${API_BASE}/api/me/experience/${created.id}`, {
        headers: { Authorization: `Bearer ${access_token}` },
        data: {
          company_name: 'Old Company',
          position_title: 'Senior Developer',
          employment_type: 'full_time',
          is_current: false,
          start_date: '2020-01-01',
          end_date: '2023-12-31',
          industry_id: null,
          work_area_id: null,
          position_level_id: null,
          region_id: null,
          municipality_id: null,
          description: 'Promoted to senior position',
          achievements: 'Led team of 5 developers',
        },
      });

      expect(updateRes.ok()).toBeTruthy();
      const updated = await updateRes.json();
      expect(updated.position_title).toBe('Senior Developer');
      expect(updated.is_current).toBe(false);
      expect(updated.end_date).toBe('2023-12-31');
    });

    test('DELETE /api/me/experience/{id} deletes work experience', async ({ request }) => {
      const { access_token } = await registerJobSeeker(request);

      // Create experience
      const createRes = await request.post(`${API_BASE}/api/me/experience`, {
        headers: { Authorization: `Bearer ${access_token}` },
        data: {
          company_name: 'Test Company',
          position_title: 'Developer',
          employment_type: null,
          is_current: false,
          start_date: '2015-01-01',
          end_date: '2016-01-01',
          industry_id: null,
          work_area_id: null,
          position_level_id: null,
          region_id: null,
          municipality_id: null,
          description: null,
          achievements: null,
        },
      });
      const created = await createRes.json();

      // Delete it
      const deleteRes = await request.delete(`${API_BASE}/api/me/experience/${created.id}`, {
        headers: { Authorization: `Bearer ${access_token}` },
      });

      expect(deleteRes.ok()).toBeTruthy();
      const body = await deleteRes.json();
      expect(body.message).toContain('deleted');
    });
  });

  test.describe('Skills', () => {
    test('POST /api/me/skills adds a skill', async ({ request }) => {
      const { access_token } = await registerJobSeeker(request);

      // First get a skill_id from reference data (assuming we have some seeded skills)
      const skillsRes = await request.get(`${API_BASE}/api/reference/skills`);
      const skillsData = await skillsRes.json();
      expect(skillsData.data.length).toBeGreaterThan(0);
      const skillId = skillsData.data[0].id;

      const response = await request.post(`${API_BASE}/api/me/skills`, {
        headers: { Authorization: `Bearer ${access_token}` },
        data: {
          skill_id: skillId,
          proficiency_level: 4,
          years_of_experience: 5,
        },
      });

      expect(response.ok()).toBeTruthy();
      const skill = await response.json();

      expect(skill.id).toBeDefined();
      expect(skill.skill_id).toBe(skillId);
      expect(skill.proficiency_level).toBe(4);
      expect(skill.years_of_experience).toBe(5);
    });

    test('POST /api/me/skills rejects duplicate skills', async ({ request }) => {
      const { access_token } = await registerJobSeeker(request);

      const skillsRes = await request.get(`${API_BASE}/api/reference/skills`);
      const skillsData = await skillsRes.json();
      const skillId = skillsData.data[0].id;

      // Add skill first time
      await request.post(`${API_BASE}/api/me/skills`, {
        headers: { Authorization: `Bearer ${access_token}` },
        data: {
          skill_id: skillId,
          proficiency_level: 3,
          years_of_experience: 2,
        },
      });

      // Try to add same skill again
      const response = await request.post(`${API_BASE}/api/me/skills`, {
        headers: { Authorization: `Bearer ${access_token}` },
        data: {
          skill_id: skillId,
          proficiency_level: 4,
          years_of_experience: 3,
        },
      });

      expect(response.status()).toBe(409); // Conflict
      const body = await response.json();
      expect(body.error).toContain('already added');
    });

    test('PUT /api/me/skills/{id} updates skill proficiency', async ({ request }) => {
      const { access_token } = await registerJobSeeker(request);

      const skillsRes = await request.get(`${API_BASE}/api/reference/skills`);
      const skillsData = await skillsRes.json();
      const skillId = skillsData.data[0].id;

      // Create skill
      const createRes = await request.post(`${API_BASE}/api/me/skills`, {
        headers: { Authorization: `Bearer ${access_token}` },
        data: {
          skill_id: skillId,
          proficiency_level: 2,
          years_of_experience: 1,
        },
      });
      const created = await createRes.json();

      // Update proficiency
      const updateRes = await request.put(`${API_BASE}/api/me/skills/${created.id}`, {
        headers: { Authorization: `Bearer ${access_token}` },
        data: {
          proficiency_level: 5,
          years_of_experience: 8,
        },
      });

      expect(updateRes.ok()).toBeTruthy();
      const updated = await updateRes.json();
      expect(updated.proficiency_level).toBe(5);
      expect(updated.years_of_experience).toBe(8);
    });

    test('DELETE /api/me/skills/{id} removes skill', async ({ request }) => {
      const { access_token } = await registerJobSeeker(request);

      const skillsRes = await request.get(`${API_BASE}/api/reference/skills`);
      const skillsData = await skillsRes.json();
      const skillId = skillsData.data[0].id;

      // Create skill
      const createRes = await request.post(`${API_BASE}/api/me/skills`, {
        headers: { Authorization: `Bearer ${access_token}` },
        data: {
          skill_id: skillId,
          proficiency_level: 3,
          years_of_experience: null,
        },
      });
      const created = await createRes.json();

      // Delete it
      const deleteRes = await request.delete(`${API_BASE}/api/me/skills/${created.id}`, {
        headers: { Authorization: `Bearer ${access_token}` },
      });

      expect(deleteRes.ok()).toBeTruthy();
      const body = await deleteRes.json();
      expect(body.message).toContain('deleted');
    });
  });

  test.describe('Languages', () => {
    test('POST /api/me/languages adds a language', async ({ request }) => {
      const { access_token } = await registerJobSeeker(request);

      // Get a language_id from reference data
      const languagesRes = await request.get(`${API_BASE}/api/reference/languages`);
      const languagesData = await languagesRes.json();
      expect(languagesData.data.length).toBeGreaterThan(0);
      const languageId = languagesData.data[0].id;

      const response = await request.post(`${API_BASE}/api/me/languages`, {
        headers: { Authorization: `Bearer ${access_token}` },
        data: {
          language_id: languageId,
          proficiency: 'fluent',
        },
      });

      expect(response.ok()).toBeTruthy();
      const language = await response.json();

      expect(language.id).toBeDefined();
      expect(language.language_id).toBe(languageId);
      expect(language.proficiency).toBe('fluent');
    });

    test('POST /api/me/languages rejects duplicate languages', async ({ request }) => {
      const { access_token } = await registerJobSeeker(request);

      const languagesRes = await request.get(`${API_BASE}/api/reference/languages`);
      const languagesData = await languagesRes.json();
      const languageId = languagesData.data[0].id;

      // Add language first time
      await request.post(`${API_BASE}/api/me/languages`, {
        headers: { Authorization: `Bearer ${access_token}` },
        data: {
          language_id: languageId,
          proficiency: 'basic',
        },
      });

      // Try to add same language again
      const response = await request.post(`${API_BASE}/api/me/languages`, {
        headers: { Authorization: `Bearer ${access_token}` },
        data: {
          language_id: languageId,
          proficiency: 'fluent',
        },
      });

      expect(response.status()).toBe(409); // Conflict
      const body = await response.json();
      expect(body.error).toContain('already added');
    });

    test('PUT /api/me/languages/{id} updates proficiency', async ({ request }) => {
      const { access_token } = await registerJobSeeker(request);

      const languagesRes = await request.get(`${API_BASE}/api/reference/languages`);
      const languagesData = await languagesRes.json();
      const languageId = languagesData.data[0].id;

      // Create language
      const createRes = await request.post(`${API_BASE}/api/me/languages`, {
        headers: { Authorization: `Bearer ${access_token}` },
        data: {
          language_id: languageId,
          proficiency: 'basic',
        },
      });
      const created = await createRes.json();

      // Update proficiency
      const updateRes = await request.put(`${API_BASE}/api/me/languages/${created.id}`, {
        headers: { Authorization: `Bearer ${access_token}` },
        data: {
          proficiency: 'advanced',
        },
      });

      expect(updateRes.ok()).toBeTruthy();
      const updated = await updateRes.json();
      expect(updated.proficiency).toBe('advanced');
    });

    test('DELETE /api/me/languages/{id} removes language', async ({ request }) => {
      const { access_token } = await registerJobSeeker(request);

      const languagesRes = await request.get(`${API_BASE}/api/reference/languages`);
      const languagesData = await languagesRes.json();
      const languageId = languagesData.data[0].id;

      // Create language
      const createRes = await request.post(`${API_BASE}/api/me/languages`, {
        headers: { Authorization: `Bearer ${access_token}` },
        data: {
          language_id: languageId,
          proficiency: 'intermediate',
        },
      });
      const created = await createRes.json();

      // Delete it
      const deleteRes = await request.delete(`${API_BASE}/api/me/languages/${created.id}`, {
        headers: { Authorization: `Bearer ${access_token}` },
      });

      expect(deleteRes.ok()).toBeTruthy();
      const body = await deleteRes.json();
      expect(body.message).toContain('deleted');
    });
  });

  test.describe('Portfolio', () => {
    test('POST /api/me/portfolio creates portfolio item with URL', async ({ request }) => {
      const { access_token } = await registerJobSeeker(request);

      const response = await request.post(`${API_BASE}/api/me/portfolio`, {
        headers: { Authorization: `Bearer ${access_token}` },
        data: {
          title: 'My Awesome Project',
          description: 'A full-stack web application for job seekers',
          url: 'https://github.com/username/awesome-project',
          file_url: null,
          category: 'project',
          completion_date: '2023-06-15',
        },
      });

      expect(response.ok()).toBeTruthy();
      const item = await response.json();

      expect(item.id).toBeDefined();
      expect(item.title).toBe('My Awesome Project');
      expect(item.description).toBe('A full-stack web application for job seekers');
      expect(item.url).toBe('https://github.com/username/awesome-project');
      expect(item.category).toBe('project');
      expect(item.completion_date).toBe('2023-06-15');
    });

    test('POST /api/me/portfolio requires either url or file_url', async ({ request }) => {
      const { access_token } = await registerJobSeeker(request);

      const response = await request.post(`${API_BASE}/api/me/portfolio`, {
        headers: { Authorization: `Bearer ${access_token}` },
        data: {
          title: 'Invalid Item',
          description: 'Has neither URL nor file',
          url: null,
          file_url: null,
          category: null,
          completion_date: null,
        },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('url or file_url');
    });

    test('PUT /api/me/portfolio/{id} updates portfolio item', async ({ request }) => {
      const { access_token } = await registerJobSeeker(request);

      // Create item
      const createRes = await request.post(`${API_BASE}/api/me/portfolio`, {
        headers: { Authorization: `Bearer ${access_token}` },
        data: {
          title: 'Old Title',
          description: 'Old description',
          url: 'https://old-url.com',
          file_url: null,
          category: 'project',
          completion_date: null,
        },
      });
      const created = await createRes.json();

      // Update it
      const updateRes = await request.put(`${API_BASE}/api/me/portfolio/${created.id}`, {
        headers: { Authorization: `Bearer ${access_token}` },
        data: {
          title: 'New Title',
          description: 'New description',
          url: 'https://new-url.com',
          file_url: null,
          category: 'certificate',
          completion_date: '2024-01-15',
        },
      });

      expect(updateRes.ok()).toBeTruthy();
      const updated = await updateRes.json();
      expect(updated.title).toBe('New Title');
      expect(updated.description).toBe('New description');
      expect(updated.url).toBe('https://new-url.com');
      expect(updated.category).toBe('certificate');
      expect(updated.completion_date).toBe('2024-01-15');
    });

    test('DELETE /api/me/portfolio/{id} deletes portfolio item', async ({ request }) => {
      const { access_token } = await registerJobSeeker(request);

      // Create item
      const createRes = await request.post(`${API_BASE}/api/me/portfolio`, {
        headers: { Authorization: `Bearer ${access_token}` },
        data: {
          title: 'Test Item',
          description: null,
          url: 'https://test.com',
          file_url: null,
          category: null,
          completion_date: null,
        },
      });
      const created = await createRes.json();

      // Delete it
      const deleteRes = await request.delete(`${API_BASE}/api/me/portfolio/${created.id}`, {
        headers: { Authorization: `Bearer ${access_token}` },
      });

      expect(deleteRes.ok()).toBeTruthy();
      const body = await deleteRes.json();
      expect(body.message).toContain('deleted');
    });
  });

  test.describe('Full Profile', () => {
    test('GET /api/me/profile/full returns complete profile', async ({ request }) => {
      const { access_token } = await registerJobSeeker(request);

      // Build up a complete profile
      await request.put(`${API_BASE}/api/me/profile`, {
        headers: { Authorization: `Bearer ${access_token}` },
        data: {
          phone: '+56912345678',
          bio: 'Test bio',
          professional_headline: 'Test headline',
          date_of_birth: null,
          gender: null,
          marital_status: null,
          nationality: null,
          national_id: null,
          region_id: null,
          municipality_id: null,
          address: null,
        },
      });

      await request.put(`${API_BASE}/api/me/disability`, {
        headers: { Authorization: `Bearer ${access_token}` },
        data: {
          category: 'visual',
          description: 'Test disability',
          has_disability_certificate: true,
          disability_percentage: 30,
          requires_accommodations: false,
          accommodation_details: null,
        },
      });

      const skillsRes = await request.get(`${API_BASE}/api/reference/skills`);
      const skillsData = await skillsRes.json();
      await request.post(`${API_BASE}/api/me/skills`, {
        headers: { Authorization: `Bearer ${access_token}` },
        data: {
          skill_id: skillsData.data[0].id,
          proficiency_level: 4,
          years_of_experience: 3,
        },
      });

      // Get full profile
      const response = await request.get(`${API_BASE}/api/me/profile/full`, {
        headers: { Authorization: `Bearer ${access_token}` },
      });

      expect(response.ok()).toBeTruthy();
      const fullProfile = await response.json();

      expect(fullProfile.profile).toBeDefined();
      expect(fullProfile.profile.phone).toBe('+56912345678');
      expect(fullProfile.profile.bio).toBe('Test bio');

      expect(fullProfile.disability).toBeDefined();
      expect(fullProfile.disability.category).toBe('visual');

      expect(Array.isArray(fullProfile.education)).toBeTruthy();
      expect(Array.isArray(fullProfile.experience)).toBeTruthy();

      expect(Array.isArray(fullProfile.skills)).toBeTruthy();
      expect(fullProfile.skills).toHaveLength(1);
      expect(fullProfile.skills[0].proficiency_level).toBe(4);

      expect(Array.isArray(fullProfile.languages)).toBeTruthy();
      expect(Array.isArray(fullProfile.portfolio)).toBeTruthy();

      // Profile completeness should have increased
      expect(fullProfile.profile.completeness_percentage).toBeGreaterThan(0);
    });
  });
});
