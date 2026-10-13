import { describe, expect, it } from 'vitest';
import { mapFields } from '../../src/content/fieldMapper';
import { createEmptyProfile } from '../../src/storage/profiles';
import type { ExtractedField } from '../../src/types';

function field(partial: Partial<ExtractedField> & Pick<ExtractedField, 'id' | 'label' | 'kind'>): ExtractedField {
  return {
    normalizedLabel: partial.label.toLowerCase(),
    name: partial.id,
    type: partial.kind,
    required: false,
    disabled: false,
    visible: true,
    currentValue: '',
    checked: null,
    surroundingText: partial.label,
    selectorHint: `#${partial.id}`,
    ...partial,
  };
}

describe('alias matching', () => {
  const profile = createEmptyProfile({
    fullName: 'Alex Example',
    contactEmail: 'alex@example.com',
    electronicSignature: 'Alex Example',
    reportNumber: 'RPT-1',
  });

  it('maps known aliases to profile values', () => {
    const matches = mapFields(
      [
        field({ id: 'n', label: 'Full name', kind: 'text' }),
        field({ id: 'e', label: 'Contact email', kind: 'email' }),
        field({ id: 'r', label: 'Report number', kind: 'text' }),
      ],
      profile,
    );
    expect(matches[0]?.semanticKey).toBe('fullName');
    expect(matches[0]?.proposedValue).toBe('Alex Example');
    expect(matches[1]?.semanticKey).toBe('contactEmail');
    expect(matches[2]?.confidence).toMatch(/high|medium/);
  });

  it('marks ambiguous duplicate mappings', () => {
    const matches = mapFields(
      [
        field({ id: 'a', label: 'Full name', kind: 'text' }),
        field({ id: 'b', label: 'Full name', kind: 'text' }),
      ],
      profile,
    );
    expect(matches.some((item) => item.confidence === 'ambiguous')).toBe(true);
  });

  it('does not invent a match for unrelated labels', () => {
    const matches = mapFields([field({ id: 'x', label: 'Favorite color', kind: 'text' })], profile);
    expect(matches[0]?.semanticKey).toBe('unknown');
    expect(matches[0]?.confidence).toBe('none');
  });

  it('maps report number and electronic signature only when those labels exist', () => {
    const matches = mapFields(
      [
        field({ id: 'n', label: 'Your name (name and surname)', kind: 'text' }),
        field({ id: 'r', label: 'Report number', kind: 'text' }),
        field({ id: 's', label: 'Electronic signature', kind: 'text' }),
      ],
      profile,
    );
    expect(matches.find((item) => item.field.id === 'n')?.semanticKey).toBe('fullName');
    expect(matches.find((item) => item.field.id === 'r')?.semanticKey).toBe('reportNumber');
    expect(matches.find((item) => item.field.id === 's')?.semanticKey).toBe('electronicSignature');
    expect(matches.every((item) => item.confidence === 'high' || item.confidence === 'medium')).toBe(true);
  });

  it('does not treat a generic name field as an electronic signature', () => {
    const matches = mapFields([field({ id: 'n', label: 'Your name (name and surname)', kind: 'text' })], profile);
    expect(matches).toHaveLength(1);
    expect(matches[0]?.semanticKey).toBe('fullName');
    expect(matches[0]?.semanticKey).not.toBe('electronicSignature');
  });
});
