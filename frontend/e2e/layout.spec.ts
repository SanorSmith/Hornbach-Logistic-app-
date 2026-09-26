import { expect, test, type Page } from '@playwright/test';
import { fakeSupabase, logIn, type Role } from './fakeSupabase';

// Zoom is disabled on tablets (index.html), so nothing may be wider than the
// screen, and dialogs must fit the visible height (browser bars included).
const TABLETS = [
  { name: 'tablet portrait', width: 800, height: 1280 },
  { name: 'tablet landscape', width: 1280, height: 800 },
  { name: 'iPad portrait', width: 768, height: 1024 },
  { name: 'iPad landscape', width: 1024, height: 768 },
];

const SCREENS: { role: Role; path?: string; dialog?: boolean }[] = [
  { role: 'LINEFEEDER', dialog: true },
  { role: 'DEPARTMENT', dialog: true },
  { role: 'MONITOR' },
  { role: 'TEAM_LEADER' },
  { role: 'ADMIN' },
  { role: 'ADMIN', path: '/reports' },
];

async function expectFitsWidth(page: Page) {
  const { viewport, content } = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(content, 'page is wider than the screen').toBeLessThanOrEqual(viewport);
}

test.describe('fits on tablets', () => {
  // One browser project is enough: the viewport is set per test.
  test.skip(({ browserName, isMobile }) => browserName !== 'chromium' || isMobile);

  for (const size of TABLETS) {
    for (const s of SCREENS) {
      test(`${s.role}${s.path ?? ''} on ${size.name}`, async ({ page }) => {
        await page.setViewportSize({ width: size.width, height: size.height });
        await fakeSupabase(page, { role: s.role, department_id: s.role === 'DEPARTMENT' ? 'd-bygg' : undefined, extraPallets: true });
        await logIn(page);
        if (s.path) await page.goto(s.path);
        await expect(page.locator('h1').first()).toBeVisible();
        await expectFitsWidth(page);

        if (s.dialog) {
          await page.locator('h3.text-2xl').first().click();
          const dialog = page.getByRole('dialog').locator('> div').first();
          await expect(dialog).toBeVisible();
          const box = await dialog.boundingBox();
          expect(box!.y).toBeGreaterThanOrEqual(0);
          expect(box!.y + box!.height, 'dialog is taller than the screen').toBeLessThanOrEqual(size.height);
          await expectFitsWidth(page);
        }
      });
    }
  }
});
