import { expect, test } from '@playwright/test';
import { fakeSupabase, logIn } from './fakeSupabase';

// Point cards are headed by their name in the avdelning (e.g. "J3").
const cardTitles = (page: import('@playwright/test').Page) => page.locator('h3.text-2xl');

// A 1x1 PNG: a real image, so the app can compress it like a camera photo.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

test.describe('login', () => {
  test('wrong password shows an error and stays on the login page', async ({ page }) => {
    await fakeSupabase(page, { role: 'LINEFEEDER' });
    await logIn(page, 'fel-lösenord');
    await expect(page.getByText('Fel e-post eller lösenord')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('a LineFeeder lands on the LineFeeder dashboard', async ({ page }) => {
    await fakeSupabase(page, { role: 'LINEFEEDER' });
    await logIn(page);
    await expect(page).toHaveURL(/\/linefeeder$/);
    await expect(cardTitles(page).first()).toBeVisible();
  });

  test('a temporary password must be changed first', async ({ page }) => {
    await fakeSupabase(page, { role: 'LINEFEEDER', must_change_password: true });
    await logIn(page);
    await expect(page).toHaveURL(/\/change-password$/);
  });

  test('users of a closed store are refused', async ({ page }) => {
    await fakeSupabase(page, { role: 'LINEFEEDER', facility_open: false });
    await logIn(page);
    await expect(page.getByText(/Butiken är stängd/)).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('the super admin lands on the store panel', async ({ page }) => {
    await fakeSupabase(page, { role: 'SUPER_ADMIN' });
    await page.route('http://supabase.test/rest/v1/rpc/facility_overview', (route) =>
      route.fulfill({ contentType: 'application/json', body: '[]' })
    );
    await logIn(page);
    await expect(page).toHaveURL(/\/superadmin$/);
    await expect(page.getByRole('heading', { name: 'Butiker' })).toBeVisible();
  });
});

test.describe('access by role', () => {
  test('a LineFeeder cannot open the admin dashboard', async ({ page }) => {
    await fakeSupabase(page, { role: 'LINEFEEDER' });
    await logIn(page);
    await expect(page).toHaveURL(/\/linefeeder$/);
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/linefeeder$/);
  });

  test('an avdelning user cannot open reports', async ({ page }) => {
    await fakeSupabase(page, { role: 'DEPARTMENT', department_id: 'd-bygg' });
    await logIn(page);
    await expect(page).toHaveURL(/\/department$/);
    await page.goto('/reports');
    await expect(page).toHaveURL(/\/department$/);
  });
});

test.describe('LineFeeder dashboard', () => {
  test('shows Kundorder first and flags points busy for over 24 h', async ({ page }) => {
    await fakeSupabase(page, { role: 'LINEFEEDER' });
    await logIn(page);
    await expect(cardTitles(page).first()).toHaveText('IB2'); // Kundorder
    const titles = await cardTitles(page).allTextContents();
    expect(titles.indexOf('J3')).toBeLessThan(titles.indexOf('J2')); // oldest Upptagen first
    await expect(page.getByText('Över 24 h')).toHaveCount(1);
  });

  test('changing a status sends only the status to the database', async ({ page }) => {
    const db = await fakeSupabase(page, { role: 'LINEFEEDER' });
    await logIn(page);
    await cardTitles(page).filter({ hasText: /^IB1$/ }).click(); // Skräp point
    await page.getByRole('button', { name: /Markera som Ledig/ }).click();
    await expect(page.getByText('Status uppdaterad!')).toBeVisible();
    expect(db.statusUpdates).toEqual([{ id: 'p4', body: { status: 'LEDIG' } }]);
  });

  test('a hardware scanner (Zebra) opens the scanned point', async ({ page }) => {
    await fakeSupabase(page, { role: 'LINEFEEDER' });
    await logIn(page);
    await expect(cardTitles(page).first()).toBeVisible();
    await page.keyboard.type('RP-006', { delay: 5 });
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: /Markera som Upptagen/ })).toBeVisible();
    // The opened point shows its avdelning (not the "Bygg" option in the filter).
    await expect(page.getByRole('dialog').getByText('Bygg').first()).toBeVisible();
  });

  test('narrows the points to one avdelning, together with the status filter', async ({ page }) => {
    await fakeSupabase(page, { role: 'LINEFEEDER' });
    await logIn(page);
    await expect(cardTitles(page)).toHaveCount(6);

    await page.getByRole('combobox', { name: 'Avdelning' }).selectOption({ label: 'Bygg' });
    await expect(cardTitles(page)).toHaveText(['IB2', 'IB1', 'IB3']); // Kundorder, Skräp, Ledig

    await page.getByRole('button', { name: 'LEDIG', exact: true }).click();
    await expect(cardTitles(page)).toHaveText(['IB3']);

    await page.getByRole('combobox', { name: 'Avdelning' }).selectOption({ label: 'Järn' });
    await expect(cardTitles(page)).toHaveText(['J1']);

    await page.getByRole('button', { name: 'KUNDORDER', exact: true }).click();
    await expect(page.getByText('Inga punkter matchar filtret.')).toBeVisible();
  });

  test('remembers the chosen avdelning and status on this device', async ({ page }) => {
    await fakeSupabase(page, { role: 'LINEFEEDER' });
    await logIn(page);
    await page.getByRole('combobox', { name: 'Avdelning' }).selectOption({ label: 'Bygg' });
    await expect(cardTitles(page)).toHaveCount(3);
    await page.getByRole('button', { name: 'LEDIG', exact: true }).click();
    await expect(cardTitles(page)).toHaveText(['IB3']);

    await page.reload();
    await expect(page.getByRole('combobox', { name: 'Avdelning' })).toHaveValue('d-bygg');
    await expect(cardTitles(page)).toHaveText(['IB3']);

    // Back to every status and avdelning: nothing is remembered any more.
    await page.getByRole('button', { name: 'Alla', exact: true }).click();
    await page.getByRole('combobox', { name: 'Avdelning' }).selectOption({ label: 'Alla avdelningar' });
    await page.reload();
    await expect(cardTitles(page)).toHaveCount(6);
  });
});

test.describe('Avdelning dashboard', () => {
  test('opens on the user’s own avdelning and cannot mark Upptagen', async ({ page }) => {
    await fakeSupabase(page, { role: 'DEPARTMENT', department_id: 'd-bygg' });
    await logIn(page);
    await expect(page.getByRole('combobox')).toHaveValue('d-bygg');
    await expect(cardTitles(page)).toHaveText(['IB1', 'IB2', 'IB3']);

    await cardTitles(page).filter({ hasText: /^IB3$/ }).click();
    await expect(page.getByRole('button', { name: /Markera som Upptagen/ })).toBeDisabled();
  });
});

test.describe('Extra pallets', () => {
  test('an avdelning allows extra pallets on its own point, in its own name', async ({ page }) => {
    const db = await fakeSupabase(page, { role: 'DEPARTMENT', department_id: 'd-bygg' });
    await logIn(page);

    await cardTitles(page).filter({ hasText: /^IB3$/ }).click();
    const dialog = page.getByRole('dialog');
    // The button opens a form; nothing is saved until it is confirmed.
    await dialog.getByRole('button', { name: 'Tillåt extra pallar' }).click();
    await dialog.getByRole('combobox', { name: 'Antal pallar' }).selectOption('3');
    await dialog.getByRole('textbox', { name: 'Anledning (valfritt)' }).fill('Kampanj');
    await expect(dialog.getByRole('textbox', { name: 'Godkänt av' })).toHaveCount(0);
    expect(db.palletWrites).toEqual([]);
    await dialog.getByRole('button', { name: 'Bekräfta' }).click();

    await expect(dialog.getByText(/Extra pallar tillåtna \(max 3\) av Anna Andersson/)).toBeVisible();
    await expect(page.getByText('0/3 pallar')).toBeVisible(); // on the IB3 card
    // Who granted it is set by the database, never sent by the app.
    expect(db.palletWrites).toEqual([
      {
        table: 'point_allowances',
        method: 'POST',
        body: { point_id: 'p6', max_pallets: 3, note: 'Kampanj', authorized_by_name: null },
      },
    ]);
  });

  test('a LineFeeder registers extra pallets for the avdelning, naming who authorized it', async ({ page }) => {
    const db = await fakeSupabase(page, { role: 'LINEFEEDER' });
    await logIn(page);
    await cardTitles(page).filter({ hasText: /^IB3$/ }).click();
    const dialog = page.getByRole('dialog');

    await dialog.getByRole('button', { name: 'Tillåt extra pallar' }).click();
    await expect(dialog.getByRole('button', { name: 'Bekräfta' })).toBeDisabled();
    await dialog.getByRole('textbox', { name: 'Godkänt av' }).fill('Kalle Bygg');
    await dialog.getByRole('button', { name: 'Bekräfta' }).click();

    await expect(dialog.getByText(/max 2\) av Kalle Bygg \(reg\. Anna Andersson\)/)).toBeVisible();
    expect(db.palletWrites).toEqual([
      {
        table: 'point_allowances',
        method: 'POST',
        body: { point_id: 'p6', max_pallets: 2, note: null, authorized_by_name: 'Kalle Bygg' },
      },
    ]);
  });

  test('zoom is disabled on tablets and phones', async ({ page }) => {
    await fakeSupabase(page, { role: 'LINEFEEDER' });
    await page.goto('/login');
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /maximum-scale=1\.0, user-scalable=no/);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).touchAction)).toBe('manipulation');
  });

  test('an avdelning cannot grant extra pallets on another avdelning’s point', async ({ page }) => {
    await fakeSupabase(page, { role: 'DEPARTMENT', department_id: 'd-bygg' });
    await logIn(page);
    await page.getByRole('combobox').selectOption('d-jarn');

    await cardTitles(page).filter({ hasText: /^J1$/ }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tillåt extra pallar' })).toHaveCount(0);
  });

  test('a LineFeeder sees every pallet on the point and picks an extra one', async ({ page }) => {
    const db = await fakeSupabase(page, { role: 'LINEFEEDER', extraPallets: true });
    await logIn(page);
    await expect(page.getByText('2/3 pallar')).toBeVisible(); // on the J2 card

    await cardTitles(page).filter({ hasText: /^J2$/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText(/Extra pallar tillåtna \(max 3\) av Jonas Järn/)).toBeVisible();
    await expect(dialog.getByRole('listitem')).toHaveCount(2);
    await expect(dialog.getByText('Grillkol')).toBeVisible();

    await dialog.getByRole('button', { name: 'Pall 2 plockad' }).click();
    await expect(dialog.getByRole('listitem')).toHaveCount(1);
    expect(db.palletWrites).toContainEqual(
      expect.objectContaining({ table: 'point_pallets', method: 'PATCH', body: expect.objectContaining({ id: 'pl2' }) })
    );
    // Room for another pallet again: Upptagen counts up.
    await expect(dialog.getByRole('button', { name: 'Markera som Upptagen (2/3)' })).toBeEnabled();
  });

  test('Markera som Upptagen registers each extra pallet with its photo, up to the allowed number', async ({ page }) => {
    const db = await fakeSupabase(page, { role: 'LINEFEEDER', extraPallets: true });
    await logIn(page);
    await cardTitles(page).filter({ hasText: /^J2$/ }).click();
    const dialog = page.getByRole('dialog');

    await dialog.getByPlaceholder('Lägg till noteringar...').fill('Tredje pallen');
    await dialog.locator('input[type="file"]').setInputFiles({ name: 'pall.png', mimeType: 'image/png', buffer: PNG });
    await expect(page.getByText('Pall 3/3 registrerad')).toBeVisible();
    expect(db.palletWrites).toContainEqual(
      expect.objectContaining({
        table: 'point_pallets',
        method: 'POST',
        body: expect.objectContaining({ point_id: 'p2', note: 'Tredje pallen', image_id: expect.any(String) }),
      })
    );
    // Only status 'UPPTAGEN' existed already: no status change was sent.
    expect(db.statusUpdates).toEqual([]);

    await expect(page.getByText('3/3 pallar')).toBeVisible();
    await cardTitles(page).filter({ hasText: /^J2$/ }).click();
    await expect(page.getByRole('dialog').getByRole('listitem')).toHaveCount(3);
    await expect(page.getByRole('button', { name: 'Fullt (3/3)' })).toBeDisabled();
  });

  test('the avdelning cannot lower or end a privilege it gave', async ({ page }) => {
    await fakeSupabase(page, { role: 'DEPARTMENT', department_id: 'd-jarn', extraPallets: true });
    await logIn(page);
    await cardTitles(page).filter({ hasText: /^J2$/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText(/kan bara minskas eller avslutas av LineFeeder eller teamledare/)).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Avsluta tillstånd' })).toHaveCount(0);
  });
});
