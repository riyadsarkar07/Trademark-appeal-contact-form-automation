import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { applyAutofill } from '../../src/content/autofill';
import { extractVisibleFields } from '../../src/content/extractor';
import { mapFields } from '../../src/content/fieldMapper';
import { createEmptyProfile } from '../../src/storage/profiles';
import type { SemanticFieldKey } from '../../src/types';

const MOCK_FORM_HTML = readFileSync(resolve(process.cwd(), 'mock/index.html'), 'utf8');

function mountMockForm(): void {
  const searchStart = MOCK_FORM_HTML.indexOf('<form role="search"');
  const formStart = MOCK_FORM_HTML.indexOf('<form id="appeal-form"');
  const start = searchStart >= 0 ? searchStart : formStart;
  const formEnd = MOCK_FORM_HTML.indexOf('</form>', formStart) + '</form>'.length;
  const otpStart = MOCK_FORM_HTML.indexOf('<section id="otp-dialog"');
  const captchaEnd = MOCK_FORM_HTML.indexOf('</section>', MOCK_FORM_HTML.indexOf('id="captcha-dialog"')) + '</section>'.length;
  document.body.innerHTML =
    MOCK_FORM_HTML.slice(start, formEnd) + MOCK_FORM_HTML.slice(otpStart, captchaEnd);
}

const profile = createEmptyProfile({
  id: 'screenshot-profile',
  name: 'Screenshot fixture',
  fullName: 'Alex Example',
  organizationOrPageUrl: 'https://example.com/page',
  removedContentUrlAndDescription: 'https://example.com/removed-post\nA product photo that was removed in error.',
  contactEmail: 'alex@example.com',
  reportNumber: 'RPT-1001',
  appealExplanation: 'The reported use is nominative and does not confuse consumers.',
  electronicSignature: 'Alex Example',
});

function matchKey(key: SemanticFieldKey) {
  const matches = mapFields(extractVisibleFields(document), profile);
  return matches.find((item) => item.semanticKey === key);
}

describe('screenshot-based label mapping against the local mock form', () => {
  it('identifies required appeal fields from visible labels, not indexes', () => {
    mountMockForm();
    const fields = extractVisibleFields(document);
    expect(fields.some((item) => /how can we help/i.test(item.label))).toBe(false);
    expect(fields.some((item) => item.id === 'help-search')).toBe(false);
    const matches = mapFields(fields, profile);

    const required: Array<[SemanticFieldKey, string]> = [
      ['fullName', 'Your name'],
      ['organizationOrPageUrl', 'Please provide a link to your organisation'],
      ['removedContentUrlAndDescription', 'Please provide URL(s)/description leading to where the content appeared on Facebook.'],
      ['contactEmail', 'Email address'],
      ['reportNumber', 'Report number'],
      ['appealExplanation', 'Please explain why you believe that the content should not have been removed.'],
      ['electronicSignature', 'Electronic signature'],
    ];

    for (const [key, expectedLabel] of required) {
      const match = matches.find((item) => item.semanticKey === key);
      expect(match, `${key} must be detected`).toBeTruthy();
      expect(match?.confidence).toMatch(/high|medium/);
      expect(match?.field.label.toLowerCase()).toContain(expectedLabel.toLowerCase().slice(0, 12));
      expect(match?.field.selectorHint.includes(':nth-')).toBe(false);
    }
  });

  it('fills mapped profile values and leaves protected controls alone', () => {
    mountMockForm();
    const matches = mapFields(extractVisibleFields(document), profile);
    const report = applyAutofill({
      root: document,
      matches,
      profile,
      overwriteExisting: false,
      fillProtectedLegal: false,
      previousFingerprint: null,
    });

    expect(report.filled).toBeGreaterThanOrEqual(6);
    expect((document.getElementById('full-name') as HTMLInputElement).value).toBe('Alex Example');
    expect((document.getElementById('org-url') as HTMLInputElement).value).toBe('https://example.com/page');
    expect((document.getElementById('removed-content') as HTMLTextAreaElement).value).toBe(
      'https://example.com/removed-post\nA product photo that was removed in error.',
    );
    expect((document.getElementById('contact-email') as HTMLInputElement).value).toBe('alex@example.com');
    expect((document.getElementById('report-number') as HTMLInputElement).value).toBe('RPT-1001');
    expect((document.getElementById('appeal-explanation') as HTMLTextAreaElement).value).toContain('nominative');
    expect((document.getElementById('signature') as HTMLInputElement).value).toBe('Alex Example');
    expect((document.getElementById('declaration') as HTMLInputElement).checked).toBe(false);
    expect((document.getElementById('content-missing') as HTMLInputElement).checked).toBe(false);
    expect((document.getElementById('otp-code') as HTMLInputElement).value).toBe('');
    expect((document.getElementById('captcha-box') as HTMLInputElement).checked).toBe(false);
    expect(matchKey('declarationCheckbox')?.semanticKey).toBe('declarationCheckbox');
    expect(matchKey('captcha')?.semanticKey).toBe('captcha');
    expect(matchKey('otp')?.semanticKey).toBe('otp');
  });

  it('preserves an existing non-empty value unless overwrite is enabled', () => {
    mountMockForm();
    const email = document.getElementById('contact-email') as HTMLInputElement;
    email.value = 'keep-me@example.com';
    const matches = mapFields(extractVisibleFields(document), profile);
    applyAutofill({
      root: document,
      matches,
      profile,
      overwriteExisting: false,
      fillProtectedLegal: false,
      previousFingerprint: null,
    });
    expect(email.value).toBe('keep-me@example.com');
  });
});
