import { expect, test } from '@playwright/test';

test.describe('local mock trademark appeal form', () => {
  test('detects the mock form and fills confident fields without submitting', async ({ page }) => {
    await page.goto('/index.html');
    const detection = await page.evaluate(() => window.MockAppeal.detect());
    expect(detection.status).toBe('supported');
    expect(detection.fields.length).toBeGreaterThan(5);

    const result = await page.evaluate(() => window.MockAppeal.fill(false));
    expect(result.report.blockedReason).toBeNull();
    expect(result.report.filled).toBeGreaterThan(0);
    await expect(page.locator('#full-name')).toHaveValue('Alex Example');
    await expect(page.locator('#org-url')).toHaveValue('https://example.com/page');
    await expect(page.locator('#removed-content')).toHaveValue(
      'https://example.com/removed-post\nA product photo that was removed in error.',
    );
    await expect(page.locator('#contact-email')).toHaveValue('alex@example.com');
    await expect(page.locator('#report-number')).toHaveValue('RPT-1001');
    await expect(page.locator('#appeal-explanation')).toHaveValue(
      'The reported use is nominative and does not confuse consumers.',
    );
    await expect(page.locator('#signature')).toHaveValue('Alex Example');
    await expect(page.locator('#declaration')).not.toBeChecked();
    await expect(page.locator('#content-missing')).not.toBeChecked();
    expect(await page.evaluate(() => window.__appealSubmitted)).toBeFalsy();
    expect(await page.locator('#help-search').inputValue()).toBe('');

    const retry = await page.evaluate(() => window.MockAppeal.fill(false));
    expect(retry.report.blockedReason).toBeNull();
    expect(retry.report.filled + retry.report.alreadyCorrect + retry.report.skipped).toBeGreaterThan(0);
    expect(retry.report.alreadyCorrect).toBeGreaterThan(0);
    await expect(page.locator('#full-name')).toHaveValue('Alex Example');
    expect(await page.evaluate(() => window.__appealSubmitted)).toBeFalsy();
  });

  test('does not fill OTP or CAPTCHA when those dialogs are shown', async ({ page }) => {
    await page.goto('/index.html');
    await page.evaluate(() => {
      window.MockAppeal.showOtp();
      window.MockAppeal.showCaptcha();
    });
    await page.evaluate(() => window.MockAppeal.fill(true));
    await expect(page.locator('#otp-code')).toHaveValue('');
    await expect(page.locator('#captcha-box')).not.toBeChecked();
  });

  test('ignores the help search box and does not submit after reload', async ({ page }) => {
    await page.goto('/index.html');
    await page.evaluate(() => window.MockAppeal.fill(false));
    await expect(page.locator('#help-search')).toHaveValue('');
    await expect(page.locator('#full-name')).toHaveValue('Alex Example');

    await page.reload();
    await expect(page.locator('#full-name')).toHaveValue('');
    const afterReload = await page.evaluate(() => window.MockAppeal.fill(false));
    expect(afterReload.report.blockedReason).toBeNull();
    await expect(page.locator('#full-name')).toHaveValue('Alex Example');
    await expect(page.locator('#help-search')).toHaveValue('');
    await expect(page.locator('#declaration')).not.toBeChecked();
    expect(await page.evaluate(() => window.__appealSubmitted)).toBeFalsy();
  });

  test('does not treat an ordinary page as a supported form', async ({ page }) => {
    await page.goto('/unsupported.html');
    const detection = await page.evaluate(() => {
      const engine = window.AppealEngine;
      if (!engine) {
        throw new Error('Appeal engine is not loaded.');
      }
      return engine.inspectPage(
        { hostname: location.hostname, pathname: location.pathname },
        document,
        true,
        null,
      );
    });
    expect(detection.status).toBe('unsupported-form');
  });
});
