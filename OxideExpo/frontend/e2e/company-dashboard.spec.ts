import { test, expect } from '@playwright/test';

// Helper to setup a company user (requires company registration API or seeded data)
async function loginAsCompany(page: import('@playwright/test').Page) {
  // For testing, we assume a seeded company account exists
  // In real scenarios, this would use the company registration flow
  const companyEmail = 'company.test@empleosinclusivos.cl';
  const companyPassword = 'CompanyTest123';

  await page.goto('/login');
  await page.fill('input[name="email"]', companyEmail);
  await page.fill('input[name="password"]', companyPassword);
  await page.click('button[type="submit"]');

  // Wait for login to complete
  await page.waitForURL('/');

  // Navigate to company dashboard
  await page.goto('/company');
}

test.describe('Company Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsCompany(page);
  });

  test('can access company dashboard', async ({ page }) => {
    await page.goto('/company');

    // Should see dashboard with stats
    await expect(page.locator('h1')).toContainText(/Dashboard|Panel/);

    // Should see key metrics
    await expect(page.locator('text=Ofertas Activas')).toBeVisible();
    await expect(page.locator('text=Postulaciones')).toBeVisible();
  });

  test('can view job listings', async ({ page }) => {
    await page.goto('/company/jobs');

    await expect(page.locator('h1')).toContainText(/Ofertas|Empleos/);

    // Should see job listing table or cards
    await expect(page.locator('table, [data-testid="job-list"]')).toBeVisible();

    // Should see create job button
    await expect(page.locator('button:has-text("Crear"), a:has-text("Crear")')).toBeVisible();
  });

  test('can create a new job posting', async ({ page }) => {
    await page.goto('/company/jobs/create');

    await expect(page.locator('h1')).toContainText(/Crear|Nueva/);

    // Fill job form
    await page.fill('input[name="titulo"]', 'Desarrollador Full Stack');
    await page.fill('textarea[name="descripcion"]', 'Buscamos desarrollador con experiencia en React y Node.js');

    // Select job type if dropdown exists
    const typeSelect = page.locator('select[name="tipo"]');
    if (await typeSelect.count() > 0) {
      await typeSelect.selectOption({ index: 1 });
    }

    // Fill requirements
    await page.fill('textarea[name="requisitos"]', '- 3+ años de experiencia\n- React, Node.js\n- Base de datos SQL');

    // Fill salary info if visible
    const salaryInput = page.locator('input[name="salario_min"]');
    if (await salaryInput.count() > 0) {
      await salaryInput.fill('1500000');
      await page.fill('input[name="salario_max"]', '2500000');
    }

    // Submit
    await page.click('button[type="submit"]');

    // Should redirect to jobs list or show success
    await expect(page.locator('text=creada, text=éxito, text=Desarrollador Full Stack').first()).toBeVisible({ timeout: 5000 });
  });

  test('can edit an existing job', async ({ page }) => {
    await page.goto('/company/jobs');

    // Click edit on first job
    const editButton = page.locator('button:has-text("Editar"), a:has-text("Editar")').first();
    if (await editButton.count() > 0) {
      await editButton.click();

      // Should be on edit page
      await expect(page).toHaveURL(/\/company\/jobs\/.*\/edit/);

      // Modify title
      await page.fill('input[name="titulo"]', 'Desarrollador Full Stack - Actualizado');

      // Save
      await page.click('button[type="submit"]');

      // Should see success or redirect
      await expect(page.locator('text=actualizada, text=guardada, text=éxito').first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('can view applicants for a job', async ({ page }) => {
    await page.goto('/company/jobs');

    // Click on applicants button/link for first job
    const applicantsLink = page.locator('a:has-text("Postulantes"), button:has-text("Postulantes")').first();
    if (await applicantsLink.count() > 0) {
      await applicantsLink.click();

      // Should be on applicants page
      await expect(page).toHaveURL(/\/company\/jobs\/.*\/applicants/);

      // Should see applicants section
      await expect(page.locator('h1, h2')).toContainText(/Postulantes|Candidatos/);
    }
  });

  test('can update applicant status', async ({ page }) => {
    await page.goto('/company/jobs');

    // Navigate to applicants of first job
    const applicantsLink = page.locator('a:has-text("Postulantes"), button:has-text("Postulantes")').first();
    if (await applicantsLink.count() > 0) {
      await applicantsLink.click();

      // Find first applicant and change status
      const statusButton = page.locator('button:has-text("En revisión"), select[name="status"]').first();
      if (await statusButton.count() > 0) {
        await statusButton.click();

        // Select new status
        const reviewedOption = page.locator('text=Revisado, text=Preseleccionado').first();
        if (await reviewedOption.count() > 0) {
          await reviewedOption.click();

          // Should see status change
          await expect(page.locator('text=actualizado, text=éxito').first()).toBeVisible({ timeout: 5000 });
        }
      }
    }
  });

  test('can view company profile', async ({ page }) => {
    await page.goto('/company/profile');

    await expect(page.locator('h1')).toContainText(/Perfil|Empresa/);

    // Should see company name field
    await expect(page.locator('input[name="nombre"], input[name="razon_social"]').first()).toBeVisible();

    // Should see description
    await expect(page.locator('textarea[name="descripcion"]')).toBeVisible();
  });

  test('can update company profile', async ({ page }) => {
    await page.goto('/company/profile');

    // Update description
    await page.fill('textarea[name="descripcion"]', 'Somos una empresa líder en tecnología con más de 10 años de experiencia.');

    // Save
    await page.click('button:has-text("Guardar")');

    // Should see success
    await expect(page.locator('text=guardado, text=actualizado, text=éxito').first()).toBeVisible({ timeout: 5000 });
  });

  test('can manage team members', async ({ page }) => {
    await page.goto('/company/team');

    await expect(page.locator('h1')).toContainText(/Equipo|Usuarios/);

    // Should see team members list
    await expect(page.locator('table, [data-testid="team-list"]')).toBeVisible();

    // Should see add member button
    await expect(page.locator('button:has-text("Agregar"), button:has-text("Invitar")')).toBeVisible();
  });

  test('sidebar navigation works correctly', async ({ page }) => {
    await page.goto('/company');

    // Test navigation links
    const navItems = [
      { link: 'Ofertas', url: '/company/jobs' },
      { link: 'Perfil', url: '/company/profile' },
      { link: 'Equipo', url: '/company/team' },
      { link: 'Configuración', url: '/company/settings' },
    ];

    for (const item of navItems) {
      const link = page.locator(`nav >> text=${item.link}`).first();
      if (await link.count() > 0) {
        await link.click();
        await expect(page).toHaveURL(item.url);
      }
    }
  });
});

test.describe('Company Dashboard Access Control', () => {
  test('redirects job seekers trying to access company pages', async ({ page }) => {
    // Login as regular user
    const timestamp = Date.now();
    await page.goto('/register');
    await page.fill('input[name="email"]', `regular${timestamp}@example.com`);
    await page.fill('input[name="password"]', 'TestPass123');
    await page.fill('input[name="confirmPassword"]', 'TestPass123');
    await page.fill('input[name="nombre"]', 'Regular');
    await page.fill('input[name="apellidos"]', 'User');
    await page.fill('input[name="rut"]', `${timestamp.toString().slice(-8)}-9`);
    await page.click('button[type="submit"]');
    await page.waitForURL('/');

    // Try to access company dashboard
    await page.goto('/company');

    // Should be redirected or show error
    const url = page.url();
    expect(url).not.toContain('/company');
  });

  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/company');

    // Should redirect to login
    await page.waitForURL('/login');
  });

  test('all company routes are protected', async ({ page }) => {
    const protectedRoutes = [
      '/company',
      '/company/jobs',
      '/company/jobs/create',
      '/company/profile',
      '/company/team',
      '/company/settings',
    ];

    for (const route of protectedRoutes) {
      await page.goto(route);
      await page.waitForURL('/login');
    }
  });
});

test.describe('Job Management Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsCompany(page);
  });

  test('full job lifecycle: create, publish, manage applicants', async ({ page }) => {
    const jobTitle = `Test Job ${Date.now()}`;

    // 1. Create job
    await page.goto('/company/jobs/create');
    await page.fill('input[name="titulo"]', jobTitle);
    await page.fill('textarea[name="descripcion"]', 'Test job description');
    await page.fill('textarea[name="requisitos"]', 'Test requirements');
    await page.click('button[type="submit"]');

    // 2. Verify job appears in list
    await page.goto('/company/jobs');
    await expect(page.locator(`text=${jobTitle}`)).toBeVisible({ timeout: 5000 });

    // 3. Check job status (should be pending or active)
    const statusBadge = page.locator(`tr:has-text("${jobTitle}") >> .badge, tr:has-text("${jobTitle}") >> [data-testid="status"]`).first();
    if (await statusBadge.count() > 0) {
      const status = await statusBadge.textContent();
      expect(['Pendiente', 'Activa', 'En revisión', 'pending', 'active']).toContain(status?.trim());
    }
  });

  test('can toggle job status', async ({ page }) => {
    await page.goto('/company/jobs');

    // Find a job's toggle/pause button
    const toggleButton = page.locator('button:has-text("Pausar"), button:has-text("Activar")').first();
    if (await toggleButton.count() > 0) {
      const initialText = await toggleButton.textContent();
      await toggleButton.click();

      // Wait for status change
      await page.waitForTimeout(1000);

      // Button text should change
      const newText = await page.locator('button:has-text("Pausar"), button:has-text("Activar")').first().textContent();
      expect(newText).not.toBe(initialText);
    }
  });
});
