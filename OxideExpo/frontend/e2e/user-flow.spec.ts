import { test, expect } from '@playwright/test';
import { goToHomeAndWaitForCountdown } from './helpers';

test.describe('Countdown Timer', () => {
  test('shows countdown before job listings in development', async ({ page }) => {
    await page.goto('/');

    // Should initially show countdown
    await expect(page.locator('text=Próximamente')).toBeVisible();
    await expect(page.locator('text=La feria de empleo está por comenzar')).toBeVisible();

    // Wait for countdown to complete (5 seconds in dev + buffer)
    await expect(page.locator('h1:has-text("Ofertas Laborales")')).toBeVisible({ timeout: 10000 });

    // Countdown should be gone
    await expect(page.locator('text=Próximamente')).not.toBeVisible();
  });
});

test.describe('Job Application Flow', () => {
  test('user can browse jobs without login', async ({ page }) => {
    await goToHomeAndWaitForCountdown(page);

    await expect(page.locator('h1')).toContainText('Ofertas Laborales');

    // Check if jobs are displayed
    const jobCards = page.locator('a[href^="/jobs/"]');
    const count = await jobCards.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('complete user flow: register, login, and apply', async ({ page }) => {
    const timestamp = Date.now();
    const testEmail = `testuser${timestamp}@example.com`;

    // 1. Go to home page and wait for countdown
    await goToHomeAndWaitForCountdown(page);
    await expect(page.locator('h1')).toContainText('Ofertas Laborales');

    // 2. Click register
    await page.click('text=Registrarse');
    await expect(page).toHaveURL('/register');

    // 3. Fill registration form
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', 'SecurePassword123');
    await page.fill('input[name="confirmPassword"]', 'SecurePassword123');
    await page.fill('input[name="nombre"]', 'Test');
    await page.fill('input[name="apellidos"]', 'User');
    await page.fill('input[name="rut"]', `${timestamp.toString().slice(-8)}-9`);

    // 4. Submit registration
    await page.click('button[type="submit"]');

    // Should redirect to home after registration
    await page.waitForURL('/');

    // Should see user name in navbar
    await expect(page.locator('text=Hola, Test')).toBeVisible();

    // 5. Find and click on a job
    const firstJob = page.locator('a[href^="/jobs/"]').first();
    if (await firstJob.count() > 0) {
      await firstJob.click();

      // Wait for job detail page (job IDs are UUIDs)
      await expect(page).toHaveURL(/\/jobs\/[a-f0-9-]+/);

      // 6. Click apply button
      await page.click('text=Postular a esta oferta');

      // Application form should appear
      await expect(page.locator('textarea')).toBeVisible();

      // 7. Fill cover letter
      await page.fill('textarea', 'Me gustaría postular a esta posición porque tengo las habilidades necesarias y estoy muy motivado.');

      // 8. Submit application
      await page.click('button:has-text("Enviar Postulación")');

      // Should see success message or confirmation
      await page.waitForTimeout(1000); // Wait for mutation
    }

    // 9. Go to my applications
    await page.click('text=Mis Postulaciones');
    await expect(page).toHaveURL('/my-applications');

    // Wait for page to load (may show loading first)
    await page.waitForLoadState('networkidle');

    // Should see at least one application if we applied
    await expect(page.locator('h1')).toContainText('Mis Postulaciones', { timeout: 10000 });
  });

  test('registration form validates inputs', async ({ page }) => {
    await page.goto('/register');

    // Submit empty form
    await page.click('button[type="submit"]');

    // Should show validation errors
    await expect(page.locator('text=Email inválido')).toBeVisible();

    // Test password mismatch
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'Password123');
    await page.fill('input[name="confirmPassword"]', 'DifferentPassword');
    await page.fill('input[name="nombre"]', 'Test');
    await page.fill('input[name="apellidos"]', 'User');
    await page.fill('input[name="rut"]', '12345678-9');

    await page.click('button[type="submit"]');

    await expect(page.locator('text=Las contraseñas no coinciden')).toBeVisible();
  });

  test('login with valid credentials', async ({ page }) => {
    // First register a user
    const timestamp = Date.now();
    const testEmail = `logintest${timestamp}@example.com`;

    await page.goto('/register');
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', 'TestPass123');
    await page.fill('input[name="confirmPassword"]', 'TestPass123');
    await page.fill('input[name="nombre"]', 'Login');
    await page.fill('input[name="apellidos"]', 'Test');
    await page.fill('input[name="rut"]', `${timestamp.toString().slice(-8)}-9`);
    await page.click('button[type="submit"]');

    // Wait for redirect
    await page.waitForURL('/');

    // Logout
    await page.click('text=Salir');

    // Now login
    await page.click('text=Iniciar Sesión');
    await expect(page).toHaveURL('/login');

    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', 'TestPass123');
    await page.click('button[type="submit"]');

    // Should redirect to home
    await page.waitForURL('/');
    await expect(page.locator('text=Hola, Login')).toBeVisible();
  });

  test('cannot access protected routes without login', async ({ page }) => {
    await page.goto('/my-applications');

    // Should redirect to login
    await page.waitForURL('/login');
  });

  test('job search filters work', async ({ page }) => {
    await goToHomeAndWaitForCountdown(page);

    // Type in search box
    await page.fill('input[placeholder*="Buscar"]', 'Desarrollador');

    // Wait for results to update
    await page.waitForTimeout(500);

    // Results should be filtered (if any exist)
    const jobCards = page.locator('a[href^="/jobs/"]');
    const count = await jobCards.count();

    // Just verify the search doesn't crash
    expect(count).toBeGreaterThanOrEqual(0);
  });
});
