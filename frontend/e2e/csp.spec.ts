import { expect, test } from '@playwright/test';
import { fakeSupabase, logIn } from './fakeSupabase';

// Only meaningful with E2E_CSP=1 (production build + vercel.json CSP), but
// harmless on the dev server too. Fails if the browser blocks anything.
test.describe('Content-Security-Policy', () => {
  test('blocks nothing the app needs', async ({ page }) => {
    const violations: string[] = [];
    page.on('console', (msg) => {
      if (/Content Security Policy|Refused to/i.test(msg.text())) violations.push(msg.text());
    });
    await page.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (e) =>
        console.error(`Refused to load ${e.blockedURI} (${e.violatedDirective})`)
      );
    });

    await fakeSupabase(page, { role: 'DEPARTMENT', department_id: 'd-bygg' });
    await logIn(page);
    await expect(page.locator('h3.text-2xl').first()).toBeVisible();

    // Point dialog.
    await page.locator('h3.text-2xl').first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');

    // PDF generation (jsPDF + QR codes) is the most CSP-sensitive feature.
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: /Alla QR-koder/ }).click();
    expect((await download).suggestedFilename()).toMatch(/\.pdf$/);

    expect(violations).toEqual([]);
  });
});
