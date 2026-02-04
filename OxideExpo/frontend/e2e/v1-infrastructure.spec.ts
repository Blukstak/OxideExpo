import { test, expect } from '@playwright/test';

// Base URL for the API (backend runs on port 8080 in Docker)
const API_BASE = 'http://localhost:8080';

test.describe('V1: Infrastructure & Reference Data', () => {
  test.describe('Health Check', () => {
    test('GET /api/health returns healthy status', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/health`);
      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      expect(body.status).toBe('healthy');
    });

    test('GET /api/health/ready checks all services', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/health/ready`);
      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      expect(body.status).toBe('healthy');
      expect(body.db).toBe('ok');
      expect(body.redis).toBe('ok');
      expect(body.s3).toBe('ok');
    });
  });

  test.describe('Countries API', () => {
    test('returns list of countries with Chile', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/reference/countries`);
      expect(response.ok()).toBeTruthy();
      const result = await response.json();
      expect(result.data).toBeInstanceOf(Array);
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.total).toBeGreaterThan(0);

      const chile = result.data.find((c: { iso_code: string }) => c.iso_code === 'CL');
      expect(chile).toBeDefined();
      expect(chile.name).toBe('Chile');
    });
  });

  test.describe('Regions API', () => {
    test('returns 16 Chilean regions when filtered by country', async ({ request }) => {
      // Get Chile's UUID first
      const countriesRes = await request.get(`${API_BASE}/api/reference/countries`);
      const countriesResult = await countriesRes.json();
      const chile = countriesResult.data.find((c: { iso_code: string }) => c.iso_code === 'CL');
      expect(chile).toBeDefined();

      const response = await request.get(`${API_BASE}/api/reference/regions?country_id=${chile.id}`);
      expect(response.ok()).toBeTruthy();
      const result = await response.json();
      expect(result.data.length).toBe(16);
    });

    test('includes Región Metropolitana', async ({ request }) => {
      const countriesRes = await request.get(`${API_BASE}/api/reference/countries`);
      const chile = (await countriesRes.json()).data.find((c: { iso_code: string }) => c.iso_code === 'CL');

      const response = await request.get(`${API_BASE}/api/reference/regions?country_id=${chile.id}`);
      const result = await response.json();
      const rm = result.data.find((r: { name: string }) => r.name.includes('Metropolitana'));
      expect(rm).toBeDefined();
      expect(rm.code).toBe('RM');
    });
  });

  test.describe('Municipalities API', () => {
    test('returns municipalities for Región Metropolitana', async ({ request }) => {
      // Get Chile's UUID
      const countriesRes = await request.get(`${API_BASE}/api/reference/countries`);
      const chile = (await countriesRes.json()).data.find((c: { iso_code: string }) => c.iso_code === 'CL');

      // Get RM's UUID
      const regionsRes = await request.get(`${API_BASE}/api/reference/regions?country_id=${chile.id}`);
      const rm = (await regionsRes.json()).data.find((r: { code: string }) => r.code === 'RM');

      const response = await request.get(`${API_BASE}/api/reference/municipalities?region_id=${rm.id}`);
      expect(response.ok()).toBeTruthy();
      const result = await response.json();
      expect(result.data.length).toBeGreaterThan(30); // RM has 52 comunas, we seeded ~43

      // Should include Santiago
      const santiago = result.data.find((m: { name: string }) => m.name === 'Santiago');
      expect(santiago).toBeDefined();
    });
  });

  test.describe('Industries API', () => {
    test('returns list of industries', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/reference/industries`);
      expect(response.ok()).toBeTruthy();
      const result = await response.json();
      expect(result.data.length).toBeGreaterThanOrEqual(15);

      // Should include technology
      const tech = result.data.find((i: { name: string }) => i.name.includes('Tecnología'));
      expect(tech).toBeDefined();
    });
  });

  test.describe('Work Areas API', () => {
    test('returns list of work areas', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/reference/work-areas`);
      expect(response.ok()).toBeTruthy();
      const result = await response.json();
      expect(result.data.length).toBeGreaterThanOrEqual(10);

      // Should include IT
      const it = result.data.find((w: { name: string }) => w.name.includes('Tecnología'));
      expect(it).toBeDefined();
    });
  });

  test.describe('Position Levels API', () => {
    test('returns 7 position levels in seniority order', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/reference/position-levels`);
      expect(response.ok()).toBeTruthy();
      const result = await response.json();
      expect(result.data.length).toBe(7);

      // Verify order by seniority_rank
      for (let i = 0; i < result.data.length - 1; i++) {
        expect(result.data[i].seniority_rank).toBeLessThan(result.data[i + 1].seniority_rank);
      }
    });
  });

  test.describe('Languages API', () => {
    test('returns languages including Spanish and English', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/reference/languages`);
      expect(response.ok()).toBeTruthy();
      const result = await response.json();

      const spanish = result.data.find((l: { iso_code: string | null }) => l.iso_code === 'es');
      const english = result.data.find((l: { iso_code: string | null }) => l.iso_code === 'en');
      expect(spanish).toBeDefined();
      expect(english).toBeDefined();
      expect(spanish.name).toBe('Español');
      expect(english.name).toBe('Inglés');
    });

    test('includes indigenous languages', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/reference/languages`);
      const result = await response.json();

      const mapudungun = result.data.find((l: { name: string }) => l.name === 'Mapudungún');
      expect(mapudungun).toBeDefined();
    });
  });

  test.describe('Skill Categories API', () => {
    test('returns 7 skill categories', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/reference/skill-categories`);
      expect(response.ok()).toBeTruthy();
      const result = await response.json();
      expect(result.data.length).toBe(7);

      // Should include technical and soft skills
      const technical = result.data.find((c: { name: string }) => c.name.includes('Técnicas'));
      const soft = result.data.find((c: { name: string }) => c.name.includes('Blandas'));
      expect(technical).toBeDefined();
      expect(soft).toBeDefined();
    });
  });

  test.describe('Skills API', () => {
    test('returns skills with categories', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/reference/skills`);
      expect(response.ok()).toBeTruthy();
      const result = await response.json();
      expect(result.data.length).toBeGreaterThan(50);

      // Skills should have category information
      const skillWithCategory = result.data.find((s: { category_id: string | null }) => s.category_id !== null);
      expect(skillWithCategory).toBeDefined();
      expect(skillWithCategory.category_name).toBeDefined();
    });

    test('filters skills by category', async ({ request }) => {
      // Get skill categories first
      const categoriesRes = await request.get(`${API_BASE}/api/reference/skill-categories`);
      const categories = (await categoriesRes.json()).data;
      const technicalCategory = categories.find((c: { name: string }) => c.name.includes('Técnicas'));

      // Filter skills by category
      const response = await request.get(
        `${API_BASE}/api/reference/skills?category_id=${technicalCategory.id}`
      );
      expect(response.ok()).toBeTruthy();
      const result = await response.json();

      // All returned skills should belong to the technical category
      for (const skill of result.data) {
        expect(skill.category_id).toBe(technicalCategory.id);
      }

      // Should include JavaScript
      const js = result.data.find((s: { name: string }) => s.name === 'JavaScript');
      expect(js).toBeDefined();
    });
  });

  test.describe('Career Fields API', () => {
    test('returns career fields', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/reference/career-fields`);
      expect(response.ok()).toBeTruthy();
      const result = await response.json();
      // Career fields may be empty initially if not seeded
      expect(result.data).toBeInstanceOf(Array);
    });
  });

  test.describe('Institutions API', () => {
    test('returns institutions', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/reference/institutions`);
      expect(response.ok()).toBeTruthy();
      const result = await response.json();
      // Institutions may be empty initially if not seeded
      expect(result.data).toBeInstanceOf(Array);
    });
  });
});
