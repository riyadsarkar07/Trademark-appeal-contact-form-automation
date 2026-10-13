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
});
