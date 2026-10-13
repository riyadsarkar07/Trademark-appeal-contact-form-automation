import { describe, expect, it } from 'vitest';
import { extractVisibleFields } from '../../src/content/extractor';
import { normalizeLabel } from '../../src/data/fieldAliases';

describe('field extraction and label normalization', () => {
  it('extracts visible labeled controls and skips hidden or password inputs', () => {
    document.body.innerHTML = `
      <form>
        <label for="full-name">Full name</label>
        <input id="full-name" name="fullName" />
        <label for="secret">Password</label>
        <input id="secret" type="password" />
        <input type="hidden" name="csrf" value="nope" />
        <label><input id="missing" type="checkbox" /> The content is missing or cannot be located</label>
        <textarea id="why" aria-label="Appeal explanation"></textarea>
      </form>
    `;
    const fields = extractVisibleFields(document);
    const ids = fields.map((item) => item.id);
    expect(ids).toContain('full-name');
    expect(ids).toContain('missing');
    expect(ids).toContain('why');
    expect(ids).not.toContain('secret');
    expect(ids).not.toContain('csrf');
  });

  it('normalizes labels for matching', () => {
    expect(normalizeLabel('URL(s) and description:')).toBe('urls and description');
    expect(normalizeLabel('  Full   Name* ')).toBe('full name');
  });

  it('excludes the How can we help search box and hidden inputs', () => {
    document.body.innerHTML = `
      <form role="search">
        <label for="help-search">How can we help?</label>
        <input id="help-search" name="q" type="search" placeholder="Search help" />
      </form>
      <form>
        <label for="full-name">Full name</label>
        <input id="full-name" name="fullName" />
        <input type="hidden" id="csrf" name="csrf" value="secret" />
        <input id="unrelated" type="text" style="display:none" aria-label="Hidden leftover" />
      </form>
    `;
    const fields = extractVisibleFields(document);
    const ids = fields.map((item) => item.id);
    expect(ids).toContain('full-name');
    expect(ids).not.toContain('help-search');
    expect(ids).not.toContain('csrf');
    expect(ids).not.toContain('unrelated');
  });

  it('does not reuse a shared parent container as every child control label', () => {
    document.body.innerHTML = `
      <section>
        <div>
          <span>Your name (name and surname)</span>
          <input id="full-name" name="name" />
        </div>
        <div>
          <span>Email address</span>
          <input id="contact-email" name="email" type="email" />
        </div>
        <div>
          <span>Report number</span>
          <input id="report-number" name="reportNumber" />
        </div>
        <div>
          <span>Your electronic signature should match your full name.</span>
          <input id="signature" name="signature" />
        </div>
      </section>
    `;
    const fields = extractVisibleFields(document);
    expect(fields.find((item) => item.id === 'full-name')?.label).toMatch(/name and surname/i);
    expect(fields.find((item) => item.id === 'contact-email')?.label).toMatch(/email address/i);
    expect(fields.find((item) => item.id === 'report-number')?.label).toMatch(/report number/i);
    expect(fields.find((item) => item.id === 'signature')?.label).toMatch(/electronic signature/i);
    expect(fields.find((item) => item.id === 'full-name')?.label).not.toMatch(/electronic signature/i);
    expect(fields.find((item) => item.id === 'report-number')?.label).not.toMatch(/electronic signature/i);
    expect(fields.map((item) => item.id)).toEqual([...new Set(fields.map((item) => item.id))]);
  });

  it('extracts radio buttons separately from checkboxes', () => {
    document.body.innerHTML = `
      <form>
        <label><input id="continue" type="radio" name="continue" /> I understand and wish to continue.</label>
        <label><input id="missing" type="checkbox" /> I cannot see the content that I wish to appeal</label>
      </form>
    `;
    const fields = extractVisibleFields(document);
    expect(fields.find((item) => item.id === 'continue')?.kind).toBe('radio');
    expect(fields.find((item) => item.id === 'missing')?.kind).toBe('checkbox');
  });
});
