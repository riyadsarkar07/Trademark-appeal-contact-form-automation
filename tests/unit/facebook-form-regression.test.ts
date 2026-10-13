import { describe, expect, it } from 'vitest';
import { applyAutofill } from '../../src/content/autofill';
import { extractVisibleFields } from '../../src/content/extractor';
import { countMatchStates, mapFields } from '../../src/content/fieldMapper';
import { createEmptyProfile } from '../../src/storage/profiles';
import type { SemanticFieldKey } from '../../src/types';

const profile = createEmptyProfile({
  id: 'fb-regression',
  name: 'Facebook regression profile',
  fullName: 'Alex Example',
  organizationOrPageUrl: 'https://example.com/page',
  removedContentUrlAndDescription: 'https://facebook.com/removed-post\nProduct photo removed in error.',
  contactEmail: 'alex@example.com',
  reportNumber: 'RPT-321897',
  appealExplanation: 'The reported use is nominative and does not confuse consumers.',
  electronicSignature: 'Alex Example',
});

function mountFacebookLikeForm(): void {
  document.body.innerHTML = `
    <form role="search">
      <label for="help-search">How can we help?</label>
      <input id="help-search" name="q" type="search" placeholder="Search help" />
    </form>
    <form id="appeal-form">
      <div class="shared-section">
        <p>I understand and wish to continue.</p>
        <label>
          <input id="continue" name="continue" type="radio" value="continue" />
          I understand and wish to continue.
        </label>
      </div>
      <div class="shared-section">
        <p>Your name (name and surname)</p>
        <label for="full-name">Your name (name and surname)</label>
        <input id="full-name" name="name" type="text" />
      </div>
      <div class="shared-section">
        <p>Please provide a link to your organisation's or client's official online presence. (E.g. a website, Facebook Page etc.)</p>
        <input id="org-url" name="presence" type="url" value="https://keep.example.com" />
      </div>
      <div class="shared-section">
        <p>Please provide URL(s)/description leading to where the content appeared on Facebook.</p>
        <textarea id="removed-content" name="contentUrls"></textarea>
      </div>
      <div class="shared-section">
        <p>Email address</p>
        <label for="contact-email">Email address</label>
        <input id="contact-email" name="email" type="email" />
      </div>
      <div class="shared-section">
        <p>Report number</p>
        <label for="report-number">Report number</label>
        <input id="report-number" name="reportNumber" type="text" />
      </div>
      <div class="shared-section">
        <label>
          <input id="content-missing" name="missing" type="checkbox" />
          I cannot see the content that I wish to appeal, or some of the content is missing
        </label>
      </div>
      <div class="shared-section">
        <p>Please explain why you believe that the content should not have been removed.</p>
        <textarea id="appeal-explanation" name="explanation"></textarea>
      </div>
      <div class="shared-section">
        <label for="attachment">Optional attachment</label>
        <input id="attachment" name="attachment" type="file" />
      </div>
      <div class="shared-section">
        <p>Your electronic signature should match your full name.</p>
        <label for="signature">Your electronic signature should match your full name.</label>
        <input id="signature" name="signature" type="text" />
      </div>
      <div class="shared-section">
        <label>
          <input id="declaration" name="declaration" type="checkbox" />
          I declare that this appeal is submitted in good faith
        </label>
      </div>
      <button id="send-appeal" type="submit">Send</button>
    </form>
  `;
}

function uniqueKey(key: SemanticFieldKey) {
  const matches = mapFields(extractVisibleFields(document), profile);
  return matches.filter((item) => item.semanticKey === key && !item.field.id.startsWith('unavailable:'));
}

describe('Facebook trademark appeal form regression fixture', () => {
  it('does not extract the help search box or the same control twice', () => {
    mountFacebookLikeForm();
    const fields = extractVisibleFields(document);
    expect(fields.some((item) => /how can we help/i.test(item.label))).toBe(false);
    expect(fields.some((item) => item.id === 'help-search')).toBe(false);
    const ids = fields.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(fields.find((item) => item.id === 'continue')?.kind).toBe('radio');
    expect(fields.find((item) => item.id === 'content-missing')?.kind).toBe('checkbox');
  });

  it('assigns each semantic field to at most one control', () => {
    mountFacebookLikeForm();
    const matches = mapFields(extractVisibleFields(document), profile).filter(
      (item) => !item.field.id.startsWith('unavailable:'),
    );
    const byKey = new Map<string, string[]>();
    for (const match of matches) {
      if (match.confidence === 'none') {
        continue;
      }
      const list = byKey.get(match.semanticKey) ?? [];
      list.push(match.field.id);
      byKey.set(match.semanticKey, list);
    }
    for (const [key, ids] of byKey) {
      expect(ids, `${key} assigned to ${ids.join(',')}`).toHaveLength(1);
    }
    expect(matches.filter((item) => item.confidence === 'ambiguous')).toHaveLength(0);
  });

  it('maps name, email, report number, and signature without competing', () => {
    mountFacebookLikeForm();
    expect(uniqueKey('fullName')[0]?.field.id).toBe('full-name');
    expect(uniqueKey('contactEmail')[0]?.field.id).toBe('contact-email');
    expect(uniqueKey('reportNumber')[0]?.field.id).toBe('report-number');
    expect(uniqueKey('electronicSignature')[0]?.field.id).toBe('signature');
    expect(uniqueKey('fullName')[0]?.confidence).toMatch(/high|medium/);
    expect(uniqueKey('contactEmail')[0]?.confidence).toMatch(/high|medium/);
    expect(uniqueKey('reportNumber')[0]?.confidence).toMatch(/high|medium/);
    expect(uniqueKey('electronicSignature')[0]?.confidence).toMatch(/high|medium/);
  });

  it('maps the two textareas to content URL/description and appeal explanation', () => {
    mountFacebookLikeForm();
    expect(uniqueKey('removedContentUrlAndDescription')[0]?.field.id).toBe('removed-content');
    expect(uniqueKey('appealExplanation')[0]?.field.id).toBe('appeal-explanation');
    expect(uniqueKey('organizationOrPageUrl')[0]?.field.id).toBe('org-url');
  });

  it('fills uniquely matched fields and reports already-correct without treating them as skipped', () => {
    mountFacebookLikeForm();
    const matches = mapFields(extractVisibleFields(document), profile);
    const first = applyAutofill({
      root: document,
      matches,
      profile,
      overwriteExisting: false,
      fillProtectedLegal: false,
    });
    expect(first.filled).toBeGreaterThanOrEqual(6);
    expect(first.filled + first.alreadyCorrect + first.skipped + first.failed).toBe(first.results.length);
    expect((document.getElementById('full-name') as HTMLInputElement).value).toBe('Alex Example');
    expect((document.getElementById('org-url') as HTMLInputElement).value).toBe('https://keep.example.com');
    expect(first.results.find((item) => item.fieldId === 'org-url')?.outcome).toBe('skipped-existing-value');
    expect((document.getElementById('contact-email') as HTMLInputElement).value).toBe('alex@example.com');
    expect((document.getElementById('report-number') as HTMLInputElement).value).toBe('RPT-321897');
    expect((document.getElementById('signature') as HTMLInputElement).value).toBe('Alex Example');
    expect((document.getElementById('continue') as HTMLInputElement).checked).toBe(false);
    expect((document.getElementById('declaration') as HTMLInputElement).checked).toBe(false);
    expect((document.getElementById('content-missing') as HTMLInputElement).checked).toBe(false);
    expect((document.getElementById('help-search') as HTMLInputElement).value).toBe('');

    const second = applyAutofill({
      root: document,
      matches: mapFields(extractVisibleFields(document), profile),
      profile,
      overwriteExisting: false,
      fillProtectedLegal: false,
    });
    expect(second.alreadyCorrect).toBeGreaterThan(0);
    expect(second.results.filter((item) => item.outcome === 'already-correct').length).toBe(second.alreadyCorrect);
    expect(second.filled + second.alreadyCorrect + second.skipped + second.failed).toBe(second.results.length);
  });

  it('never automates declaration, continuation, attachments, or send', () => {
    mountFacebookLikeForm();
    const matches = mapFields(extractVisibleFields(document), profile);
    applyAutofill({
      root: document,
      matches,
      profile,
      overwriteExisting: true,
      fillProtectedLegal: true,
    });
    expect((document.getElementById('declaration') as HTMLInputElement).checked).toBe(false);
    expect((document.getElementById('continue') as HTMLInputElement).checked).toBe(false);
    expect((document.getElementById('content-missing') as HTMLInputElement).checked).toBe(false);
    expect((document.getElementById('attachment') as HTMLInputElement).files?.length ?? 0).toBe(0);
    expect(uniqueKey('continuationRadio')[0]?.semanticKey).toBe('continuationRadio');
    expect(uniqueKey('attachment')[0]?.semanticKey).toBe('attachment');
  });

  it('reports signature absence honestly instead of substituting report number or name', () => {
    mountFacebookLikeForm();
    document.getElementById('signature')?.remove();
    const matches = mapFields(extractVisibleFields(document), profile);
    const signature = matches.find((item) => item.semanticKey === 'electronicSignature');
    expect(signature?.confidence).toBe('none');
    expect(signature?.reason).toMatch(/not found/i);
    expect(matches.find((item) => item.field.id === 'report-number')?.semanticKey).toBe('reportNumber');
    expect(matches.find((item) => item.field.id === 'full-name')?.semanticKey).toBe('fullName');
    const counts = countMatchStates(matches);
    expect(counts.matchedCount + counts.unmatchedCount + counts.ambiguousCount).toBe(matches.length);
  });
});

/**
 * Reproduces the real-browser popup errors:
 *   "Email address: Multiple controls mapped to the same semantic field."
 *   "Report number ...: Multiple controls mapped to the same semantic field."
 *
 * Facebook markup renders hidden text-measurement/sizing inputs next to the
 * real controls, inside a display:none wrapper. Those measurement controls
 * must never be extracted, must not break the field group's exclusivity, and
 * must not compete for contactEmail/reportNumber.
 */
function mountFacebookFormWithMeasurementControls(): void {
  document.body.innerHTML = `
    <form role="search">
      <label for="help-search">How can we help?</label>
      <input id="help-search" name="q" type="search" placeholder="Search help" />
    </form>
    <form id="appeal-form">
      <div class="shared-section">
        <p>I understand and wish to continue.</p>
        <label>
          <input id="continue" name="continue" type="radio" value="continue" />
          I understand and wish to continue.
        </label>
      </div>
      <div class="shared-section">
        <p>Your name (name and surname)</p>
        <label for="full-name">Your name (name and surname)</label>
        <input id="full-name" name="name" type="text" />
      </div>
      <div class="shared-section">
        <p>Please provide a link to your organisation's or client's official online presence. (E.g. a website, Facebook Page etc.)</p>
        <input id="org-url" name="presence" type="url" value="https://keep.example.com" />
      </div>
      <div class="shared-section">
        <p>Please provide URL(s)/description leading to where the content appeared on Facebook.</p>
        <textarea id="removed-content" name="contentUrls"></textarea>
      </div>
      <div class="shared-section">
        <p>Email address</p>
        <span class="text-measure" style="display:none" aria-hidden="true">
          <input type="text" name="emailShadow" aria-label="Email address" tabindex="-1" />
        </span>
        <input id="contact-email" name="email" type="email" />
      </div>
      <div class="shared-section">
        <p>Report number</p>
        <span class="text-measure" style="display:none" aria-hidden="true">
          <input type="text" name="reportShadow" aria-label="Report number" tabindex="-1" />
        </span>
        <input id="report-number" name="reportNumber" type="text" />
      </div>
      <div class="shared-section">
        <label>
          <input id="content-missing" name="missing" type="checkbox" />
          I cannot see the content that I wish to appeal, or some of the content is missing
        </label>
      </div>
      <div class="shared-section">
        <p>Please explain why you believe that the content should not have been removed.</p>
        <textarea id="appeal-explanation" name="explanation"></textarea>
      </div>
      <div class="shared-section">
        <label for="attachment">Optional attachment</label>
        <input id="attachment" name="attachment" type="file" />
      </div>
      <div class="shared-section">
        <p>Your electronic signature should match your full name.</p>
        <label for="signature">Your electronic signature should match your full name.</label>
        <input id="signature" name="signature" type="text" />
      </div>
      <div class="shared-section">
        <label>
          <input id="declaration" name="declaration" type="checkbox" />
          I declare that this appeal is submitted in good faith
        </label>
      </div>
      <button id="send-appeal" type="submit">Send</button>
    </form>
  `;
}

describe('Facebook form with hidden text-measurement controls', () => {
  it('does not extract hidden measurement controls or treat them as visible', () => {
    mountFacebookFormWithMeasurementControls();
    const fields = extractVisibleFields(document);
    const ids = fields.map((item) => item.id);
    expect(ids).not.toContain('emailShadow');
    expect(ids).not.toContain('reportShadow');
    expect(ids).toContain('contact-email');
    expect(ids).toContain('report-number');
    expect(fields.filter((item) => item.kind === 'email')).toHaveLength(1);
  });

  it('maps Email address and Report number to exactly one visible control each', () => {
    mountFacebookFormWithMeasurementControls();
    const matches = mapFields(extractVisibleFields(document), profile).filter(
      (item) => !item.field.id.startsWith('unavailable:'),
    );
    expect(uniqueKey('contactEmail')).toHaveLength(1);
    expect(uniqueKey('contactEmail')[0]?.field.id).toBe('contact-email');
    expect(uniqueKey('contactEmail')[0]?.field.label).toMatch(/email address/i);
    expect(uniqueKey('reportNumber')).toHaveLength(1);
    expect(uniqueKey('reportNumber')[0]?.field.id).toBe('report-number');
    expect(uniqueKey('reportNumber')[0]?.field.label).toMatch(/report number/i);
    expect(matches.filter((item) => item.semanticKey === 'contactEmail')).toHaveLength(1);
    expect(matches.filter((item) => item.semanticKey === 'reportNumber')).toHaveLength(1);
    expect(matches.filter((item) => item.confidence === 'ambiguous')).toHaveLength(0);

    const byKey = new Map<string, string[]>();
    for (const match of matches) {
      if (match.confidence === 'none') {
        continue;
      }
      const list = byKey.get(match.semanticKey) ?? [];
      list.push(match.field.id);
      byKey.set(match.semanticKey, list);
    }
    for (const [key, ids] of byKey) {
      expect(ids, `${key} assigned to ${ids.join(',')}`).toHaveLength(1);
    }
  });

  it('keeps the other profile fields mapped and reconciles fill counters', () => {
    mountFacebookFormWithMeasurementControls();
    const matches = mapFields(extractVisibleFields(document), profile);
    const report = applyAutofill({
      root: document,
      matches,
      profile,
      overwriteExisting: false,
      fillProtectedLegal: false,
    });
    expect((document.getElementById('contact-email') as HTMLInputElement).value).toBe('alex@example.com');
    expect((document.getElementById('report-number') as HTMLInputElement).value).toBe('RPT-321897');
    expect((document.getElementById('full-name') as HTMLInputElement).value).toBe('Alex Example');
    expect((document.getElementById('signature') as HTMLInputElement).value).toBe('Alex Example');
    expect((document.getElementById('org-url') as HTMLInputElement).value).toBe('https://keep.example.com');
    expect(uniqueKey('removedContentUrlAndDescription')[0]?.field.id).toBe('removed-content');
    expect(uniqueKey('appealExplanation')[0]?.field.id).toBe('appeal-explanation');
    expect(uniqueKey('organizationOrPageUrl')[0]?.field.id).toBe('org-url');
    expect(report.failed).toBe(0);
    expect(report.filled + report.alreadyCorrect + report.skipped + report.failed).toBe(report.results.length);
    expect((document.getElementById('continue') as HTMLInputElement).checked).toBe(false);
    expect((document.getElementById('declaration') as HTMLInputElement).checked).toBe(false);
    expect((document.getElementById('content-missing') as HTMLInputElement).checked).toBe(false);
  });
});
