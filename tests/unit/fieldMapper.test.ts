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
});
