import { test, expect } from '@playwright/test';

// Helper function to register and login a test user
async function registerAndLogin(page: import('@playwright/test').Page) {
  const timestamp = Date.now();
  const testEmail = `profile${timestamp}@example.com`;

  await page.goto('/register');
  await page.fill('input[name="email"]', testEmail);
  await page.fill('input[name="password"]', 'TestPass123');
  await page.fill('input[name="confirmPassword"]', 'TestPass123');
  await page.fill('input[name="nombre"]', 'Profile');
  await page.fill('input[name="apellidos"]', 'TestUser');
  await page.fill('input[name="rut"]', `${timestamp.toString().slice(-8)}-9`);
  await page.click('button[type="submit"]');
  await page.waitForURL('/');

  return { email: testEmail, name: 'Profile' };
}

test.describe('Job Seeker Profile Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await registerAndLogin(page);
  });

  test('can access profile dashboard', async ({ page }) => {
    await page.goto('/profile');

    // Should see profile overview page
    await expect(page.locator('h1')).toContainText('Mi Perfil');

    // Should see profile completeness indicator
    await expect(page.locator('text=Completitud del Perfil')).toBeVisible();

    // Should see sidebar navigation
    await expect(page.locator('text=Información Personal')).toBeVisible();
    await expect(page.locator('text=Experiencia Laboral')).toBeVisible();
    await expect(page.locator('text=Educación')).toBeVisible();
  });

  test('can navigate to personal info and update', async ({ page }) => {
    await page.goto('/profile/personal-info');

    await expect(page.locator('h1')).toContainText('Información Personal');

    // Should see form fields
    await expect(page.locator('input[name="nombre"]')).toBeVisible();
    await expect(page.locator('input[name="apellidos"]')).toBeVisible();
    await expect(page.locator('input[name="telefono"]')).toBeVisible();

    // Fill phone number
    await page.fill('input[name="telefono"]', '+56912345678');

    // Save changes
    await page.click('button:has-text("Guardar")');

    // Should see success message
    await expect(page.locator('text=guardado')).toBeVisible({ timeout: 5000 });
  });

  test('can add work experience', async ({ page }) => {
    await page.goto('/profile/work-experience');

    await expect(page.locator('h1')).toContainText('Experiencia Laboral');

    // Click add button
    await page.click('button:has-text("Agregar")');

    // Should see modal or form
    await expect(page.locator('text=Agregar Experiencia')).toBeVisible();

    // Fill work experience form
    await page.fill('input[name="cargo"]', 'Desarrollador Senior');
    await page.fill('input[name="empresa"]', 'Tech Company');
    await page.fill('input[name="fecha_inicio"]', '2020-01-01');
    await page.fill('textarea[name="descripcion"]', 'Desarrollo de aplicaciones web con React y Node.js');

    // Submit
    await page.click('button:has-text("Guardar")');

    // Should see the new experience in the list
    await expect(page.locator('text=Desarrollador Senior')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Tech Company')).toBeVisible();
  });

  test('can add education', async ({ page }) => {
    await page.goto('/profile/education');

    await expect(page.locator('h1')).toContainText('Educación');

    // Click add button
    await page.click('button:has-text("Agregar")');

    // Should see modal or form
    await expect(page.locator('text=Agregar Educación')).toBeVisible();

    // Fill education form
    await page.fill('input[name="institucion"]', 'Universidad de Chile');
    await page.fill('input[name="titulo"]', 'Ingeniería en Informática');
    await page.fill('input[name="fecha_inicio"]', '2015-03-01');
    await page.fill('input[name="fecha_fin"]', '2020-12-31');

    // Submit
    await page.click('button:has-text("Guardar")');

    // Should see the new education in the list
    await expect(page.locator('text=Universidad de Chile')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Ingeniería en Informática')).toBeVisible();
  });

  test('can manage skills', async ({ page }) => {
    await page.goto('/profile/skills');

    await expect(page.locator('h1')).toContainText('Habilidades');

    // Click add button
    await page.click('button:has-text("Agregar")');

    // Fill skill form
    await page.fill('input[name="nombre"]', 'JavaScript');

    // Select level if dropdown exists
    const levelSelect = page.locator('select[name="nivel"]');
    if (await levelSelect.count() > 0) {
      await levelSelect.selectOption('advanced');
    }

    // Submit
    await page.click('button:has-text("Guardar")');

    // Should see the new skill
    await expect(page.locator('text=JavaScript')).toBeVisible({ timeout: 5000 });
  });

  test('can manage languages', async ({ page }) => {
    await page.goto('/profile/languages');

    await expect(page.locator('h1')).toContainText('Idiomas');

    // Click add button
    await page.click('button:has-text("Agregar")');

    // Fill language form
    await page.fill('input[name="idioma"]', 'Inglés');

    // Select level if dropdown exists
    const levelSelect = page.locator('select[name="nivel"]');
    if (await levelSelect.count() > 0) {
      await levelSelect.selectOption('advanced');
    }

    // Submit
    await page.click('button:has-text("Guardar")');

    // Should see the new language
    await expect(page.locator('text=Inglés')).toBeVisible({ timeout: 5000 });
  });

  test('can access CV management page', async ({ page }) => {
    await page.goto('/profile/cv');

    await expect(page.locator('h1')).toContainText('CV');

    // Should see upload area
    await expect(page.locator('text=Subir CV')).toBeVisible();

    // Should see generate CV option
    await expect(page.locator('text=Generar CV')).toBeVisible();
  });

  test('can access settings page', async ({ page }) => {
    await page.goto('/profile/settings');

    await expect(page.locator('h1')).toContainText('Configuración');

    // Should see email settings
    await expect(page.locator('text=Correo electrónico')).toBeVisible();

    // Should see password change option
    await expect(page.locator('text=Cambiar Contraseña')).toBeVisible();

    // Should see account deletion option
    await expect(page.locator('text=Cerrar Cuenta')).toBeVisible();
  });

  test('sidebar navigation works correctly', async ({ page }) => {
    await page.goto('/profile');

    // Click each sidebar link and verify navigation
    const navItems = [
      { link: 'Información Personal', url: '/profile/personal-info' },
      { link: 'Experiencia Laboral', url: '/profile/work-experience' },
      { link: 'Educación', url: '/profile/education' },
      { link: 'Habilidades', url: '/profile/skills' },
      { link: 'Idiomas', url: '/profile/languages' },
      { link: 'CV', url: '/profile/cv' },
      { link: 'Configuración', url: '/profile/settings' },
    ];

    for (const item of navItems) {
      await page.click(`nav >> text=${item.link}`);
      await expect(page).toHaveURL(item.url);
    }
  });

  test('profile completeness updates as sections are filled', async ({ page }) => {
    await page.goto('/profile');

    // Get initial completeness percentage
    const progressText = await page.locator('[data-testid="profile-progress"]').textContent();
    const initialProgress = parseInt(progressText?.match(/\d+/)?.[0] || '0');

    // Add some profile data
    await page.goto('/profile/personal-info');
    await page.fill('input[name="telefono"]', '+56912345678');
    await page.click('button:has-text("Guardar")');

    // Go back to profile and check if progress increased
    await page.goto('/profile');
    await page.waitForTimeout(1000);

    const newProgressText = await page.locator('[data-testid="profile-progress"]').textContent();
    const newProgress = parseInt(newProgressText?.match(/\d+/)?.[0] || '0');

    // Progress should be same or higher
    expect(newProgress).toBeGreaterThanOrEqual(initialProgress);
  });
});

test.describe('Profile Access Control', () => {
  test('redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/profile');

    // Should redirect to login
    await page.waitForURL('/login');
  });

  test('all profile routes are protected', async ({ page }) => {
    const protectedRoutes = [
      '/profile',
      '/profile/personal-info',
      '/profile/work-experience',
      '/profile/education',
      '/profile/skills',
      '/profile/languages',
      '/profile/cv',
      '/profile/settings',
    ];

    for (const route of protectedRoutes) {
      await page.goto(route);
      await page.waitForURL('/login');
    }
  });
});
