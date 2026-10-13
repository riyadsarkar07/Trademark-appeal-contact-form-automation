import { describe, expect, it } from 'vitest';
import { applyAutofill, neverActivateSubmit } from '../../src/content/autofill';
import { extractVisibleFields } from '../../src/content/extractor';
import { mapFields } from '../../src/content/fieldMapper';
import { createEmptyProfile } from '../../src/storage/profiles';

function setupForm(): HTMLFormElement {
  document.body.innerHTML = `
    <form id="appeal">
      <h2>Contact Information</h2>
      <label for="full-name">Full name</label>
      <input id="full-name" name="fullName" />
      <label for="email">Contact email</label>
      <input id="email" name="email" type="email" value="keep-me@example.com" />
      <label for="report">Report number</label>
      <input id="report" name="reportNumber" />
      <label><input id="declare" type="checkbox" /> I declare this appeal is in good faith</label>
      <label for="otp">Verification code</label>
      <input id="otp" name="otp" />
      <label><input id="captcha" type="checkbox" /> I'm not a robot</label>
      <label for="file">Optional attachment</label>
      <input id="file" type="file" />
      <button id="send" type="submit">Send</button>
    </form>
  `;
  return document.getElementById('appeal') as HTMLFormElement;
}

const profile = createEmptyProfile({
  id: 'p1',
  fullName: 'Alex Example',
  contactEmail: 'alex@example.com',
  reportNumber: 'RPT-9',
  electronicSignature: 'Alex Example',
});

describe('autofill safety', () => {
  it('fills confident text fields and preserves existing values', () => {
    setupForm();
    const matches = mapFields(extractVisibleFields(document), profile);
    const events: string[] = [];
    document.getElementById('full-name')?.addEventListener('input', () => events.push('input'));
    document.getElementById('full-name')?.addEventListener('change', () => events.push('change'));

    const report = applyAutofill({
      root: document,
      matches,
      profile,
      overwriteExisting: false,
      fillProtectedLegal: false,
      previousFingerprint: null,
    });

    expect((document.getElementById('full-name') as HTMLInputElement).value).toBe('Alex Example');
    expect((document.getElementById('email') as HTMLInputElement).value).toBe('keep-me@example.com');
    expect(events).toEqual(expect.arrayContaining(['input', 'change']));
    expect(report.results.find((item) => item.fieldId === 'email')?.outcome).toBe('skipped-existing-value');
  });

  it('never fills CAPTCHA, OTP, attachments, or declaration checkboxes', () => {
    setupForm();
    const matches = mapFields(extractVisibleFields(document), profile);
    applyAutofill({
      root: document,
      matches,
      profile,
      overwriteExisting: true,
      fillProtectedLegal: false,
      previousFingerprint: null,
    });
    expect((document.getElementById('otp') as HTMLInputElement).value).toBe('');
    expect((document.getElementById('captcha') as HTMLInputElement).checked).toBe(false);
    expect((document.getElementById('declare') as HTMLInputElement).checked).toBe(false);
    expect((document.getElementById('file') as HTMLInputElement).files?.length ?? 0).toBe(0);
  });

  it('allows repeat fill attempts and reports already-correct when values match', () => {
    setupForm();
    const matches = mapFields(extractVisibleFields(document), profile);
    const first = applyAutofill({
      root: document,
      matches,
      profile,
      overwriteExisting: true,
      fillProtectedLegal: false,
    });
    expect(first.filled).toBeGreaterThan(0);
    const second = applyAutofill({
      root: document,
      matches,
      profile,
      overwriteExisting: false,
      fillProtectedLegal: false,
    });
    expect(second.results.some((item) => item.outcome === 'already-correct')).toBe(true);
  });

  it('reports accurate filled, skipped, and failed counts after a retry', () => {
    setupForm();
    const matches = mapFields(extractVisibleFields(document), profile);
    const first = applyAutofill({
      root: document,
      matches,
      profile,
      overwriteExisting: true,
      fillProtectedLegal: false,
    });
    const second = applyAutofill({
      root: document,
      matches,
      profile,
      overwriteExisting: false,
      fillProtectedLegal: false,
    });
    expect(first.filled + first.alreadyCorrect + first.skipped + first.failed).toBe(first.results.length);
    expect(second.filled + second.alreadyCorrect + second.skipped + second.failed).toBe(second.results.length);
    expect(second.filled).toBe(0);
    expect(second.results.filter((item) => item.outcome === 'already-correct').length).toBeGreaterThan(0);
    expect(second.blockedReason).toBeNull();
  });

  it('re-queries the live DOM after a node is replaced and still fills', () => {
    setupForm();
    const original = document.getElementById('full-name') as HTMLInputElement;
    const replacement = original.cloneNode(true) as HTMLInputElement;
    original.replaceWith(replacement);
    const matches = mapFields(extractVisibleFields(document), profile);
    const report = applyAutofill({
      root: document,
      matches,
      profile,
      overwriteExisting: true,
      fillProtectedLegal: false,
    });
    expect(report.results.find((item) => item.fieldId === 'full-name')?.outcome).toBe('filled');
    expect((document.getElementById('full-name') as HTMLInputElement).value).toBe('Alex Example');
  });

  it('never activates the final submission button', () => {
    const form = setupForm();
    let submitted = false;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submitted = true;
    });
    const matches = mapFields(extractVisibleFields(document), profile);
    applyAutofill({
      root: document,
      matches,
      profile,
      overwriteExisting: true,
      fillProtectedLegal: true,
      previousFingerprint: null,
    });
    expect(submitted).toBe(false);
    expect(neverActivateSubmit(document)).toBe(true);
  });
});
