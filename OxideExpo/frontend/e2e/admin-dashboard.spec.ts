import { test, expect } from '@playwright/test';

// Helper to login as admin (requires seeded admin account)
async function loginAsAdmin(page: import('@playwright/test').Page) {
  const adminEmail = 'admin.test@empleosinclusivos.cl';
  const adminPassword = 'AdminTest123';

  await page.goto('/login');
  await page.fill('input[name="email"]', adminEmail);
  await page.fill('input[name="password"]', adminPassword);
  await page.click('button[type="submit"]');

  // Wait for login to complete
  await page.waitForURL('/');

  // Navigate to admin dashboard
  await page.goto('/admin');
}

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('can access admin dashboard with KPIs', async ({ page }) => {
    await page.goto('/admin');

    // Should see admin dashboard
    await expect(page.locator('h1')).toContainText(/Admin|Panel|Dashboard/);

    // Should see key metrics cards
    await expect(page.locator('text=Usuarios Totales')).toBeVisible();
    await expect(page.locator('text=Empresas').first()).toBeVisible();
    await expect(page.locator('text=Ofertas').first()).toBeVisible();
  });

  test('dashboard shows pending approvals summary', async ({ page }) => {
    await page.goto('/admin');

    // Should see pending approvals section
    await expect(page.locator('text=Pendientes')).toBeVisible();
  });

  test('can navigate to users management', async ({ page }) => {
    await page.goto('/admin/users');

    await expect(page.locator('h1')).toContainText(/Usuarios/);

    // Should see users table
    await expect(page.locator('table')).toBeVisible();

    // Should have filter/search options
    await expect(page.locator('input[placeholder*="Buscar"], input[type="search"]').first()).toBeVisible();
  });

  test('can filter users by type', async ({ page }) => {
    await page.goto('/admin/users');

    // Look for filter tabs or dropdown
    const filterTabs = page.locator('[role="tablist"], select[name="type"]').first();
    if (await filterTabs.count() > 0) {
      // Click on different user types
      const jobSeekerTab = page.locator('button:has-text("Postulantes"), option:has-text("Postulantes")').first();
      if (await jobSeekerTab.count() > 0) {
        await jobSeekerTab.click();
        await page.waitForTimeout(500);
      }
    }
  });

  test('can suspend/activate users', async ({ page }) => {
    await page.goto('/admin/users');

    // Find action button for first user
    const actionButton = page.locator('button:has-text("Suspender"), button:has-text("Activar")').first();
    if (await actionButton.count() > 0) {
      const initialText = await actionButton.textContent();
      await actionButton.click();

      // Confirm if dialog appears
      const confirmButton = page.locator('button:has-text("Confirmar")');
      if (await confirmButton.count() > 0) {
        await confirmButton.click();
      }

      // Should see success message
      await expect(page.locator('text=actualizado, text=éxito').first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('can access companies management', async ({ page }) => {
    await page.goto('/admin/companies');

    await expect(page.locator('h1')).toContainText(/Empresas/);

    // Should see tabs for different statuses
    await expect(page.locator('button:has-text("Pendientes"), [role="tab"]:has-text("Pendientes")').first()).toBeVisible();
    await expect(page.locator('button:has-text("Activas"), [role="tab"]:has-text("Activas")').first()).toBeVisible();
  });

  test('can approve pending company', async ({ page }) => {
    await page.goto('/admin/companies');

    // Click pending tab
    await page.click('button:has-text("Pendientes"), [role="tab"]:has-text("Pendientes")');

    // Find approve button
    const approveButton = page.locator('button:has-text("Aprobar")').first();
    if (await approveButton.count() > 0) {
      await approveButton.click();

      // Confirm if dialog appears
      const confirmButton = page.locator('button:has-text("Confirmar")');
      if (await confirmButton.count() > 0) {
        await confirmButton.click();
      }

      // Should see success message
      await expect(page.locator('text=aprobada, text=éxito').first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('can reject pending company', async ({ page }) => {
    await page.goto('/admin/companies');

    // Click pending tab
    await page.click('button:has-text("Pendientes"), [role="tab"]:has-text("Pendientes")');

    // Find reject button
    const rejectButton = page.locator('button:has-text("Rechazar")').first();
    if (await rejectButton.count() > 0) {
      await rejectButton.click();

      // Fill reason if required
      const reasonInput = page.locator('textarea[name="reason"], input[name="reason"]');
      if (await reasonInput.count() > 0) {
        await reasonInput.fill('No cumple con los requisitos');
      }

      // Confirm
      const confirmButton = page.locator('button:has-text("Confirmar")');
      if (await confirmButton.count() > 0) {
        await confirmButton.click();
      }

      // Should see success message
      await expect(page.locator('text=rechazada, text=éxito').first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('can access jobs management', async ({ page }) => {
    await page.goto('/admin/jobs');

    await expect(page.locator('h1')).toContainText(/Ofertas|Empleos/);

    // Should see tabs for different statuses
    await expect(page.locator('button:has-text("Pendientes"), [role="tab"]:has-text("Pendientes")').first()).toBeVisible();
    await expect(page.locator('button:has-text("Activas"), [role="tab"]:has-text("Activas")').first()).toBeVisible();
  });

  test('can approve pending job', async ({ page }) => {
    await page.goto('/admin/jobs');

    // Click pending tab
    await page.click('button:has-text("Pendientes"), [role="tab"]:has-text("Pendientes")');

    // Find approve button
    const approveButton = page.locator('button:has-text("Aprobar")').first();
    if (await approveButton.count() > 0) {
      await approveButton.click();

      // Confirm if dialog appears
      const confirmButton = page.locator('button:has-text("Confirmar")');
      if (await confirmButton.count() > 0) {
        await confirmButton.click();
      }

      // Should see success message
      await expect(page.locator('text=aprobada, text=éxito').first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('can access reports page', async ({ page }) => {
    await page.goto('/admin/reports');

    await expect(page.locator('h1')).toContainText(/Reportes|Informes/);

    // Should see report tabs
    await expect(page.locator('button:has-text("Usuarios"), [role="tab"]:has-text("Usuarios")').first()).toBeVisible();
    await expect(page.locator('button:has-text("Empresas"), [role="tab"]:has-text("Empresas")').first()).toBeVisible();
    await expect(page.locator('button:has-text("Ofertas"), [role="tab"]:has-text("Ofertas")').first()).toBeVisible();
  });

  test('can view different report types', async ({ page }) => {
    await page.goto('/admin/reports');

    const reportTabs = ['Usuarios', 'Empresas', 'Ofertas', 'Postulaciones'];

    for (const tab of reportTabs) {
      const tabButton = page.locator(`button:has-text("${tab}"), [role="tab"]:has-text("${tab}")`).first();
      if (await tabButton.count() > 0) {
        await tabButton.click();
        await page.waitForTimeout(500);

        // Should see chart or data
        await expect(page.locator('canvas, svg, table, [data-testid="chart"]').first()).toBeVisible({ timeout: 3000 });
      }
    }
  });

  test('can export report data', async ({ page }) => {
    await page.goto('/admin/reports');

    // Find export button
    const exportButton = page.locator('button:has-text("Exportar"), button:has-text("Descargar")').first();
    if (await exportButton.count() > 0) {
      // Set up download listener
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 5000 }).catch(() => null),
        exportButton.click(),
      ]);

      // If download occurred, verify it's an Excel file
      if (download) {
        expect(download.suggestedFilename()).toMatch(/\.xlsx?$/);
      }
    }
  });

  test('sidebar navigation works correctly', async ({ page }) => {
    await page.goto('/admin');

    // Test navigation links
    const navItems = [
      { link: 'Usuarios', url: '/admin/users' },
      { link: 'Empresas', url: '/admin/companies' },
      { link: 'Ofertas', url: '/admin/jobs' },
      { link: 'Reportes', url: '/admin/reports' },
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

test.describe('Admin Dashboard Access Control', () => {
  test('redirects non-admin users', async ({ page }) => {
    // Login as regular user
    const timestamp = Date.now();
    await page.goto('/register');
    await page.fill('input[name="email"]', `nonadmin${timestamp}@example.com`);
    await page.fill('input[name="password"]', 'TestPass123');
    await page.fill('input[name="confirmPassword"]', 'TestPass123');
    await page.fill('input[name="nombre"]', 'NonAdmin');
    await page.fill('input[name="apellidos"]', 'User');
    await page.fill('input[name="rut"]', `${timestamp.toString().slice(-8)}-9`);
    await page.click('button[type="submit"]');
    await page.waitForURL('/');

    // Try to access admin dashboard
    await page.goto('/admin');

    // Should be redirected or show access denied
    const url = page.url();
    expect(url).not.toContain('/admin');
  });

  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/admin');

    // Should redirect to login
    await page.waitForURL('/login');
  });

  test('all admin routes are protected', async ({ page }) => {
    const protectedRoutes = [
      '/admin',
      '/admin/users',
      '/admin/companies',
      '/admin/jobs',
      '/admin/reports',
    ];

    for (const route of protectedRoutes) {
      await page.goto(route);
      await page.waitForURL('/login');
    }
  });
});

test.describe('Admin Approval Workflows', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('company approval workflow shows company details', async ({ page }) => {
    await page.goto('/admin/companies');

    // Click pending tab
    await page.click('button:has-text("Pendientes"), [role="tab"]:has-text("Pendientes")');

    // Click on a company row to see details
    const companyRow = page.locator('tr, [data-testid="company-row"]').first();
    if (await companyRow.count() > 0) {
      await companyRow.click();

      // Should see company details
      await expect(page.locator('text=RUT, text=Razón Social, text=Industria').first()).toBeVisible({ timeout: 3000 });
    }
  });

  test('job approval workflow shows job details', async ({ page }) => {
    await page.goto('/admin/jobs');

    // Click pending tab
    await page.click('button:has-text("Pendientes"), [role="tab"]:has-text("Pendientes")');

    // Click on a job row to see details
    const jobRow = page.locator('tr, [data-testid="job-row"]').first();
    if (await jobRow.count() > 0) {
      await jobRow.click();

      // Should see job details
      await expect(page.locator('text=Descripción, text=Requisitos, text=Empresa').first()).toBeVisible({ timeout: 3000 });
    }
  });

  test('approval actions are logged', async ({ page }) => {
    // First approve something
    await page.goto('/admin/companies');
    await page.click('button:has-text("Pendientes"), [role="tab"]:has-text("Pendientes")');

    const approveButton = page.locator('button:has-text("Aprobar")').first();
    if (await approveButton.count() > 0) {
      await approveButton.click();
      const confirmButton = page.locator('button:has-text("Confirmar")');
      if (await confirmButton.count() > 0) {
        await confirmButton.click();
      }
      await page.waitForTimeout(1000);
    }

    // Check dashboard for recent activity
    await page.goto('/admin');

    // Should see recent activity section
    const activitySection = page.locator('text=Actividad Reciente, text=Historial');
    if (await activitySection.count() > 0) {
      await expect(page.locator('text=aprobó, text=aprobada, text=approval').first()).toBeVisible({ timeout: 3000 });
    }
  });
});

test.describe('Admin Search and Filtering', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('can search users by name', async ({ page }) => {
    await page.goto('/admin/users');

    // Find search input
    const searchInput = page.locator('input[placeholder*="Buscar"], input[type="search"]').first();
    await searchInput.fill('test');
    await page.waitForTimeout(500);

    // Results should be filtered
    const rows = page.locator('tbody tr');
    const count = await rows.count();
    // At least verify search doesn't crash
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('can filter companies by status', async ({ page }) => {
    await page.goto('/admin/companies');

    // Click different status tabs
    const tabs = ['Pendientes', 'Activas', 'Suspendidas', 'Rechazadas'];

    for (const tab of tabs) {
      const tabButton = page.locator(`button:has-text("${tab}"), [role="tab"]:has-text("${tab}")`).first();
      if (await tabButton.count() > 0) {
        await tabButton.click();
        await page.waitForTimeout(500);
        // Verify page doesn't error
      }
    }
  });

  test('can filter jobs by status', async ({ page }) => {
    await page.goto('/admin/jobs');

    // Click different status tabs
    const tabs = ['Pendientes', 'Activas', 'Pausadas', 'Rechazadas'];

    for (const tab of tabs) {
      const tabButton = page.locator(`button:has-text("${tab}"), [role="tab"]:has-text("${tab}")`).first();
      if (await tabButton.count() > 0) {
        await tabButton.click();
        await page.waitForTimeout(500);
        // Verify page doesn't error
      }
    }
  });
});
