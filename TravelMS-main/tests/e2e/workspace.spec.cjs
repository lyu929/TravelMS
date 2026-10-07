const { test, expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const { PNG_RECEIPT } = require('../fixtures.cjs');
const { PDFDocument } = require('pdf-lib');
async function signIn(page, role = 'Traveler') {
  await page.getByRole('button', { name: role + ' demo', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
}
async function signOut(page) {
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
}
test('sign-in returns to settings and preserves profile choices after reload', async ({ page }) => {
  await page.goto('/settings');
  await expect(page).toHaveURL(/\/login\?returnUrl=/);
  await signIn(page);
  await expect(page).toHaveURL(/\/settings$/);
  await page.getByRole('button', { name: 'Plane', exact: true }).click();
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('profile has been updated');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Plane', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
});
test('traveler and owner complete a journey, receipt and saved PDF workflow', async ({
  page,
}, testInfo) => {
  await page.goto('/login');
  await signIn(page);
  await page.getByRole('link', { name: 'Plan a trip', exact: true }).click();
  await page.getByLabel('Destination', { exact: true }).fill('Browser test journey');
  await page.getByLabel('Start date', { exact: true }).fill('2027-05-01');
  await page.getByLabel('End date', { exact: true }).fill('2027-05-03');
  await page.getByLabel('Purpose', { exact: true }).fill('Automated course demo');
  await page.getByLabel('Budget (USD)', { exact: true }).fill('100');
  await page.getByRole('button', { name: 'Submit trip', exact: true }).click();
  const card = page
    .locator('article')
    .filter({ has: page.getByRole('heading', { name: 'Browser test journey', exact: true }) });
  await card.getByRole('link', { name: 'View journey', exact: true }).click();
  await expect(page).toHaveURL(/\/trips\/\d+$/);
  const journey = new URL(page.url()).pathname;
  await page.getByRole('tab', { name: /^Itinerary/ }).click();
  await page.getByRole('button', { name: 'Add item', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill('Workshop');
  await page.getByRole('button', { name: 'Save item', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Workshop', exact: true })).toBeVisible();
  await signOut(page);
  await page.goto(journey);
  await signIn(page, 'Owner');
  await expect(page).toHaveURL(new RegExp(journey + '$'));
  await page.getByRole('button', { name: 'Revise', exact: true }).click();
  await page
    .getByLabel('Review comment (required)', { exact: true })
    .fill('Add a location before approval.');
  await page.getByRole('button', { name: 'Return for revision', exact: true }).click();
  await expect(page.getByText('Add a location before approval.', { exact: true })).toBeVisible();
  await signOut(page);
  await page.goto(journey);
  await signIn(page);
  await page.getByRole('link', { name: 'Edit trip', exact: true }).click();
  await page
    .getByLabel('Purpose', { exact: true })
    .fill('Automated course demo - workshop location confirmed');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await signOut(page);
  await page.goto(journey);
  await signIn(page, 'Owner');
  await page.getByRole('button', { name: 'Approve', exact: true }).click();
  await page.getByLabel('Review comment (optional)', { exact: true }).fill('Agenda approved.');
  await page.getByRole('button', { name: 'Approve trip', exact: true }).click();
  await expect(page.getByText('Agenda approved.', { exact: true })).toBeVisible();
  await signOut(page);
  await page.goto(journey);
  await signIn(page);
  await page.getByRole('link', { name: 'Add expense', exact: true }).click();
  await page.getByLabel('Amount (USD)', { exact: true }).fill('120');
  await page.getByLabel('Description', { exact: true }).fill('Workshop travel');
  await page.getByRole('button', { name: 'Save expense', exact: true }).click();
  const row = page.getByRole('row').filter({ hasText: 'Workshop travel' });
  const chooser = page.waitForEvent('filechooser');
  await row.getByRole('button', { name: /Add receipt / }).click();
  await (
    await chooser
  ).setFiles({ name: 'workshop.png', mimeType: 'image/png', buffer: PNG_RECEIPT });
  await expect(row.getByRole('button', { name: /Preview receipt / })).toBeVisible();
  await row.getByRole('button', { name: /Preview receipt / }).click();
  await expect(page.getByRole('img', { name: 'workshop.png', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close receipt preview', exact: true }).click();
  const receiptPdf = await PDFDocument.create();
  receiptPdf.addPage().drawText('Course demo receipt - USD 120', { x: 60, y: 700, size: 18 });
  receiptPdf.addPage().drawText('Receipt page two', { x: 60, y: 700, size: 18 });
  const pdfChooser = page.waitForEvent('filechooser');
  await row.getByRole('button', { name: /Replace receipt / }).click();
  await (
    await pdfChooser
  ).setFiles({
    name: 'workshop.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await receiptPdf.save()),
  });
  await expect(row.getByRole('button', { name: /Preview receipt / })).toHaveText('workshop.pdf');
  const previewResponse = page.waitForResponse(
    (response) =>
      /\/expenses\/\d+\/receipt$/.test(new URL(response.url()).pathname) &&
      response.request().method() === 'GET',
  );
  await row.getByRole('button', { name: /Preview receipt / }).click();
  expect((await previewResponse).status()).toBe(200);
  const preview = page.getByRole('dialog');
  const canvas = preview.getByRole('img', { name: 'workshop.pdf, PDF page 1', exact: true });
  await expect(canvas).toHaveAttribute('data-rendered', 'true');
  expect(
    await canvas.evaluate((element) => {
      const pixels = element
        .getContext('2d')
        .getImageData(0, 0, element.width, element.height).data;
      let dark = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i + 3] && pixels[i] < 150 && pixels[i + 1] < 150 && pixels[i + 2] < 150) dark++;
      }
      return dark;
    }),
  ).toBeGreaterThan(100);
  await expect(preview.getByText('Page 1 of 2', { exact: true })).toBeVisible();
  await preview.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(
    preview.getByRole('img', { name: 'workshop.pdf, PDF page 2', exact: true }),
  ).toHaveAttribute('data-rendered', 'true');
  await preview.getByRole('button', { name: 'Previous', exact: true }).click();
  await expect(canvas).toHaveAttribute('data-rendered', 'true');
  await page.screenshot({ path: testInfo.outputPath('pdf-receipt-preview.png') });
  await page.getByRole('button', { name: 'Close receipt preview', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await row.getByRole('button', { name: /Preview receipt / }).click();
  await expect(canvas).toHaveAttribute('data-rendered', 'true');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('pdf-receipt-mobile.png') });
  await page.getByRole('button', { name: 'Close receipt preview', exact: true }).click();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(journey);
  await expect(page.getByText('$20.00 above the budget.', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Reports', exact: true }).click();
  await page.getByRole('button', { name: 'Create report', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Report \d+/ })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Export PDF', exact: true }).click();
  const pdf = await download;
  expect(pdf.suggestedFilename()).toMatch(/\.pdf$/);
  expect((await fs.readFile(await pdf.path())).subarray(0, 5).toString()).toBe('%PDF-');
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(page.getByText('Submitted', { exact: true })).toBeVisible();
  await signOut(page);
  await page.goto(journey);
  await signIn(page, 'Owner');
  await page.getByRole('tab', { name: 'Reports', exact: true }).click();
  await page.getByRole('button', { name: 'Approve report', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Approve report', exact: true })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Activity', exact: true }).click();
  await expect(page.getByText('Add a location before approval.', { exact: true })).toBeVisible();
  await expect(page.getByText('Agenda approved.', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
});
