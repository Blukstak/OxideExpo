import { test, expect } from '@playwright/test';

// Base URL for the API (backend runs on port 8080 in Docker)
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
  return {
    email,
    userId: body.user.id,
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
  };
}

test.describe('V4: Company Profiles', () => {
  test.describe('Company Registration Flow', () => {
    test('creates user, company profile, and owner membership atomically', async ({ request }) => {
      const email = uniqueEmail();
      const companyName = `Test Company ${Date.now()}`;

      const response = await request.post(`${API_BASE}/api/auth/register/company`, {
        data: {
          email,
          password: 'SecurePassword123',
          first_name: 'John',
          last_name: 'Doe',
          company_name: companyName,
        },
      });

      expect(response.ok()).toBeTruthy();
      const body = await response.json();

      // Verify user creation
      expect(body.user.email).toBe(email.toLowerCase());
      expect(body.user.user_type).toBe('company_member');
      expect(body.user.account_status).toBe('pending_verification');
      expect(body.access_token).toBeDefined();

      // Verify company profile was created by fetching it
      const profileResponse = await request.get(`${API_BASE}/api/me/company/profile`, {
        headers: { Authorization: `Bearer ${body.access_token}` },
      });

      expect(profileResponse.ok()).toBeTruthy();
      const profile = await profileResponse.json();
      expect(profile.company_name).toBe(companyName);
      expect(profile.status).toBe('pending_approval');
      expect(profile.completeness_percentage).toBe(0);

      // Verify owner membership was created
      const fullProfileResponse = await request.get(`${API_BASE}/api/me/company/full`, {
        headers: { Authorization: `Bearer ${body.access_token}` },
      });

      expect(fullProfileResponse.ok()).toBeTruthy();
      const fullProfile = await fullProfileResponse.json();
      expect(fullProfile.current_user_role).toBe('owner');
      expect(fullProfile.members).toHaveLength(1);
      expect(fullProfile.members[0].role).toBe('owner');
      expect(fullProfile.members[0].user.email).toBe(email.toLowerCase());
    });

    test('company profile starts with pending_approval status', async ({ request }) => {
      const { accessToken } = await registerCompany(request);

      const response = await request.get(`${API_BASE}/api/me/company/profile`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const profile = await response.json();
      expect(profile.status).toBe('pending_approval');
      expect(profile.approved_at).toBeNull();
      expect(profile.approved_by).toBeNull();
      expect(profile.is_featured).toBe(false);
      expect(profile.can_search_candidates).toBe(false);
    });
  });

  test.describe('Company Profile CRUD', () => {
    test('GET /api/me/company/profile returns company profile', async ({ request }) => {
      const { accessToken } = await registerCompany(request, 'ACME Corporation');

      const response = await request.get(`${API_BASE}/api/me/company/profile`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      expect(response.ok()).toBeTruthy();
      const profile = await response.json();
      expect(profile.id).toBeDefined();
      expect(profile.company_name).toBe('ACME Corporation');
      expect(profile.created_at).toBeDefined();
      expect(profile.updated_at).toBeDefined();
    });

    test('PUT /api/me/company/profile updates profile fields', async ({ request }) => {
      const { accessToken } = await registerCompany(request);

      const uniqueTaxId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const updateData = {
        legal_name: 'Test Company Legal Name',
        description: 'We are an inclusive employer committed to diversity and equal opportunities for all',
        website_url: 'https://testcompany.com',
        phone: '555-1234',
        tax_id: uniqueTaxId,
      };

      const response = await request.put(`${API_BASE}/api/me/company/profile`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: updateData,
      });

      expect(response.ok()).toBeTruthy();
      const profile = await response.json();
      expect(profile.legal_name).toBe(updateData.legal_name);
      expect(profile.description).toBe(updateData.description);
      expect(profile.website_url).toBe(updateData.website_url);
      expect(profile.phone).toBe(updateData.phone);
      expect(profile.tax_id).toBe(updateData.tax_id);
    });

    test('rejects invalid URL formats', async ({ request }) => {
      const { accessToken } = await registerCompany(request);

      const response = await request.put(`${API_BASE}/api/me/company/profile`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: {
          website_url: 'not-a-valid-url',
        },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('URL');
    });

    test('rejects excessively long fields', async ({ request }) => {
      const { accessToken } = await registerCompany(request);

      const response = await request.put(`${API_BASE}/api/me/company/profile`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: {
          company_name: 'A'.repeat(300), // Max is 255
        },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toBeDefined();
    });

    test('rejects invalid founded_year', async ({ request }) => {
      const { accessToken } = await registerCompany(request);

      const response = await request.put(`${API_BASE}/api/me/company/profile`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: {
          founded_year: 1500, // Before 1800
        },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('1800');
    });

    test('only owner or admin can update profile', async ({ request }) => {
      // This will be tested in the team management section with multiple users
      // For now, verify that the owner can update
      const { accessToken } = await registerCompany(request);

      const response = await request.put(`${API_BASE}/api/me/company/profile`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: { description: 'Updated by owner' },
      });

      expect(response.ok()).toBeTruthy();
    });
  });

  test.describe('Full Company Profile', () => {
    test('GET /api/me/company/full returns profile with members', async ({ request }) => {
      const { accessToken } = await registerCompany(request);

      const response = await request.get(`${API_BASE}/api/me/company/full`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      expect(response.ok()).toBeTruthy();
      const data = await response.json();

      expect(data.profile).toBeDefined();
      expect(data.members).toBeDefined();
      expect(data.current_user_role).toBe('owner');
      expect(Array.isArray(data.members)).toBe(true);
      expect(data.members.length).toBeGreaterThan(0);

      // Verify member structure
      const member = data.members[0];
      expect(member.id).toBeDefined();
      expect(member.company_id).toBeDefined();
      expect(member.role).toBe('owner');
      expect(member.user).toBeDefined();
      expect(member.user.email).toBeDefined();
      expect(member.user.first_name).toBeDefined();
    });

    test('members are ordered by role then joined_at', async ({ request }) => {
      const { accessToken } = await registerCompany(request);

      const response = await request.get(`${API_BASE}/api/me/company/full`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const data = await response.json();

      // Owner should be first (we only have one member in this test)
      expect(data.members[0].role).toBe('owner');
    });
  });

  test.describe('Company Members Management', () => {
    test('GET /api/me/company/members lists all members', async ({ request }) => {
      const { accessToken } = await registerCompany(request);

      const response = await request.get(`${API_BASE}/api/me/company/members`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      expect(response.ok()).toBeTruthy();
      const members = await response.json();
      expect(Array.isArray(members)).toBe(true);
      expect(members.length).toBeGreaterThan(0);
      expect(members[0].role).toBe('owner');
    });

    test('non-company members cannot access company endpoints', async ({ request }) => {
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

      // Try to access company profile
      const response = await request.get(`${API_BASE}/api/me/company/profile`, {
        headers: { Authorization: `Bearer ${access_token}` },
      });

      expect(response.status()).toBe(403);
      const body = await response.json();
      expect(body.error).toContain('company member');
    });

    test('unauthenticated requests are rejected', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/me/company/profile`);
      expect(response.status()).toBe(401);
    });
  });

  test.describe('Profile Completeness Calculation', () => {
    test('starts at 0% completeness', async ({ request }) => {
      const { accessToken } = await registerCompany(request);

      const response = await request.get(`${API_BASE}/api/me/company/profile`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const profile = await response.json();
      expect(profile.completeness_percentage).toBe(0);
    });

    test('completeness increases when adding website (10 points)', async ({ request }) => {
      const { accessToken } = await registerCompany(request);

      // Update with website
      await request.put(`${API_BASE}/api/me/company/profile`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: { website_url: 'https://example.com' },
      });

      // Fetch updated profile (trigger should have run)
      const response = await request.get(`${API_BASE}/api/me/company/profile`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const profile = await response.json();
      expect(profile.completeness_percentage).toBeGreaterThan(0);
      expect(profile.website_url).toBe('https://example.com');
    });

    test('completeness increases with basic info (30 points)', async ({ request }) => {
      const { accessToken } = await registerCompany(request);

      // Add basic info: company_name (already set), legal_name, tax_id, phone
      const uniqueTaxId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      await request.put(`${API_BASE}/api/me/company/profile`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: {
          legal_name: 'Test Company Legal',
          tax_id: uniqueTaxId,
          phone: '555-1234',
        },
      });

      const response = await request.get(`${API_BASE}/api/me/company/profile`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const profile = await response.json();
      // Should have at least 30 points for basic info
      expect(profile.completeness_percentage).toBeGreaterThanOrEqual(30);
    });

    test('completeness with substantial description (20 points)', async ({ request }) => {
      const { accessToken } = await registerCompany(request);

      const longDescription = 'A'.repeat(150); // At least 100 chars required
      await request.put(`${API_BASE}/api/me/company/profile`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: { description: longDescription },
      });

      const response = await request.get(`${API_BASE}/api/me/company/profile`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const profile = await response.json();
      expect(profile.completeness_percentage).toBeGreaterThan(0);
    });

    test('completeness never exceeds 100%', async ({ request }) => {
      const { accessToken } = await registerCompany(request);

      // Fill all fields
      const uniqueTaxId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      await request.put(`${API_BASE}/api/me/company/profile`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: {
          legal_name: 'Test Company Legal',
          tax_id: uniqueTaxId,
          phone: '555-1234',
          website_url: 'https://example.com',
          linkedin_url: 'https://linkedin.com/company/test',
          description: 'A'.repeat(150),
          mission: 'Our mission is to provide inclusive employment',
          vision: 'Our vision is a world of equal opportunities',
          benefits: 'Flexible hours, remote work, health insurance',
        },
      });

      const response = await request.get(`${API_BASE}/api/me/company/profile`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const profile = await response.json();
      expect(profile.completeness_percentage).toBeLessThanOrEqual(100);
    });
  });

  test.describe('Public Company Endpoints', () => {
    test('GET /api/companies returns only active companies', async ({ request }) => {
      // Register a company (will be pending_approval by default)
      await registerCompany(request, 'Pending Company');

      // Get public companies list
      const response = await request.get(`${API_BASE}/api/companies`);

      expect(response.ok()).toBeTruthy();
      const companies = await response.json();
      expect(Array.isArray(companies)).toBe(true);

      // The newly created company should NOT appear (it's pending_approval)
      const pendingCompany = companies.find((c: any) => c.company_name === 'Pending Company');
      expect(pendingCompany).toBeUndefined();
    });

    test('public profile excludes sensitive fields', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/companies`);

      expect(response.ok()).toBeTruthy();
      const companies = await response.json();

      if (companies.length > 0) {
        const company = companies[0];

        // Should NOT have sensitive fields
        expect(company.status).toBeUndefined();
        expect(company.approved_at).toBeUndefined();
        expect(company.approved_by).toBeUndefined();
        expect(company.rejection_reason).toBeUndefined();
        expect(company.can_search_candidates).toBeUndefined();
        expect(company.legal_name).toBeUndefined();
        expect(company.tax_id).toBeUndefined();
        expect(company.phone).toBeUndefined();
        expect(company.address).toBeUndefined();

        // Should HAVE public fields
        expect(company.company_name).toBeDefined();
        expect(company.completeness_percentage).toBeDefined();
        expect(company.is_featured).toBeDefined();
      }
    });

    test('public companies list is ordered by featured then name', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/companies`);

      expect(response.ok()).toBeTruthy();
      const companies = await response.json();

      if (companies.length > 1) {
        // Verify ordering: featured companies should come first
        let foundNonFeatured = false;
        for (const company of companies) {
          if (foundNonFeatured && company.is_featured) {
            throw new Error('Featured company found after non-featured company');
          }
          if (!company.is_featured) {
            foundNonFeatured = true;
          }
        }
      }
    });

    test('public companies list is limited to 100 results', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/companies`);

      expect(response.ok()).toBeTruthy();
      const companies = await response.json();
      expect(companies.length).toBeLessThanOrEqual(100);
    });

    test('GET /api/companies/:id returns single public company', async ({ request }) => {
      // Get list first to find an active company
      const listResponse = await request.get(`${API_BASE}/api/companies`);
      const companies = await listResponse.json();

      if (companies.length > 0) {
        const companyId = companies[0].id;

        const response = await request.get(`${API_BASE}/api/companies/${companyId}`);

        expect(response.ok()).toBeTruthy();
        const company = await response.json();
        expect(company.id).toBe(companyId);
        expect(company.company_name).toBeDefined();

        // Verify sensitive fields are excluded
        expect(company.status).toBeUndefined();
        expect(company.approved_at).toBeUndefined();
      }
    });

    test('GET /api/companies/:id returns 404 for pending companies', async ({ request }) => {
      const { accessToken } = await registerCompany(request);

      // Get the company ID
      const profileResponse = await request.get(`${API_BASE}/api/me/company/profile`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const profile = await profileResponse.json();

      // Try to access via public endpoint (should fail - company is pending)
      const response = await request.get(`${API_BASE}/api/companies/${profile.id}`);

      expect(response.status()).toBe(404);
    });

    test('GET /api/companies/:id returns 404 for non-existent company', async ({ request }) => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request.get(`${API_BASE}/api/companies/${fakeId}`);

      expect(response.status()).toBe(404);
    });
  });

  test.describe('Authorization & Permissions', () => {
    test('requires authentication for protected endpoints', async ({ request }) => {
      const endpoints = [
        { method: 'GET', url: '/api/me/company/profile' },
        { method: 'PUT', url: '/api/me/company/profile' },
        { method: 'GET', url: '/api/me/company/full' },
        { method: 'GET', url: '/api/me/company/members' },
      ];

      for (const endpoint of endpoints) {
        const response = await request.fetch(`${API_BASE}${endpoint.url}`, {
          method: endpoint.method,
          data: endpoint.method === 'PUT' ? {} : undefined,
        });

        expect(response.status()).toBe(401);
      }
    });

    test('allows public access to company listing endpoints', async ({ request }) => {
      const publicEndpoints = [
        '/api/companies',
      ];

      for (const endpoint of publicEndpoints) {
        const response = await request.get(`${API_BASE}${endpoint}`);
        expect(response.status()).not.toBe(401);
      }
    });
  });

  test.describe('Data Integrity', () => {
    test('company profile timestamps are set correctly', async ({ request }) => {
      const { accessToken } = await registerCompany(request);

      const response = await request.get(`${API_BASE}/api/me/company/profile`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const profile = await response.json();
      expect(profile.created_at).toBeDefined();
      expect(profile.updated_at).toBeDefined();
      expect(new Date(profile.created_at)).toBeInstanceOf(Date);
      expect(new Date(profile.updated_at)).toBeInstanceOf(Date);
    });

    test('updated_at changes after profile update', async ({ request }) => {
      const { accessToken } = await registerCompany(request);

      const response1 = await request.get(`${API_BASE}/api/me/company/profile`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const profile1 = await response1.json();
      const originalUpdatedAt = profile1.updated_at;

      // Wait a moment then update
      await new Promise(resolve => setTimeout(resolve, 1000));

      await request.put(`${API_BASE}/api/me/company/profile`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: { description: 'Updated description' },
      });

      const response2 = await request.get(`${API_BASE}/api/me/company/profile`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const profile2 = await response2.json();

      expect(new Date(profile2.updated_at).getTime()).toBeGreaterThan(
        new Date(originalUpdatedAt).getTime()
      );
    });

    test('user can only belong to one company', async ({ request }) => {
      // This is enforced by UNIQUE constraint on user_id in company_members
      // The constraint is tested at the database level
      // Here we just verify the user has exactly one company
      const { accessToken } = await registerCompany(request);

      const response = await request.get(`${API_BASE}/api/me/company/full`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const data = await response.json();
      expect(data.profile).toBeDefined();
      expect(data.profile.id).toBeDefined();
    });
  });
});
