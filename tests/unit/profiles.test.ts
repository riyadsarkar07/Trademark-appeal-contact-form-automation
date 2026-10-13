import { describe, expect, it } from 'vitest';
import {
  createEmptyProfile,
  parseImportedProfiles,
  serializeProfiles,
  validateProfile,
} from '../../src/storage/profiles';

describe('profile storage and validation', () => {
  it('creates blank profiles without invented case details', () => {
    const profile = createEmptyProfile({ name: 'Case A' });
    expect(profile.fullName).toBe('');
    expect(profile.reportNumber).toBe('');
    expect(profile.appealExplanation).toBe('');
  });

  it('validates email and signature consistency', () => {
    const invalid = createEmptyProfile({
      name: 'Case A',
      contactEmail: 'not-an-email',
      fullName: 'Alex Example',
      electronicSignature: 'Someone Else',
    });
    const errors = validateProfile(invalid);
    expect(errors.some((item) => item.includes('email'))).toBe(true);
    expect(errors.some((item) => item.includes('signature'))).toBe(true);
  });

  it('round-trips import/export JSON', () => {
    const original = [createEmptyProfile({ name: 'Case A', fullName: 'Alex Example', electronicSignature: 'Alex Example' })];
    const parsed = parseImportedProfiles(serializeProfiles(original));
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.name).toBe('Case A');
    expect(parsed[0]?.fullName).toBe('Alex Example');
  });

  it('migrates legacy profiles with separate URL and description fields', () => {
    const legacyPartial = {
      name: 'Legacy Profile',
      removedContentUrls: 'https://example.com/url',
      removedContentDescription: 'Legacy description',
    };
    const profile = createEmptyProfile(legacyPartial as unknown as Parameters<typeof createEmptyProfile>[0]);
    expect(profile.removedContentUrlAndDescription).toContain('https://example.com/url');
    expect(profile.removedContentUrlAndDescription).toContain('Legacy description');
  });

  it('rejects malformed import payloads', () => {
    expect(() => parseImportedProfiles('{"hello":1}')).toThrow(/profiles array/i);
  });
});
