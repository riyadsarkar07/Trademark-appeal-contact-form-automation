import { describe, expect, it } from 'vitest';
import {
  createEmptyProfile,
  loadSnapshot,
  parseImportedProfiles,
  saveProfiles,
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

  it('persists profiles across save and reload using local storage fallback', async () => {
    localStorage.clear();
    const profile = createEmptyProfile({
      name: 'Persist me',
      fullName: 'Alex Example',
      removedContentUrlAndDescription: 'https://example.com/removed\nTaken down by mistake',
    });
    await saveProfiles([profile]);
    const snapshot = await loadSnapshot();
    expect(snapshot.profiles).toHaveLength(1);
    expect(snapshot.profiles[0]?.name).toBe('Persist me');
    expect(snapshot.profiles[0]?.removedContentUrlAndDescription).toContain('https://example.com/removed');
    expect(snapshot.profiles[0]?.fullName).toBe('Alex Example');
  });

  it('preserves legacy removed-content fields during JSON import', () => {
    const imported = parseImportedProfiles(
      JSON.stringify({
        version: 1,
        profiles: [
          {
            id: 'legacy-1',
            name: 'Legacy import',
            removedContentUrls: 'https://facebook.com/removed',
            removedContentDescription: 'Photo that was taken down',
            fullName: 'Alex Example',
          },
        ],
      }),
    );
    expect(imported[0]?.removedContentUrlAndDescription).toContain('https://facebook.com/removed');
    expect(imported[0]?.removedContentUrlAndDescription).toContain('Photo that was taken down');
    expect(imported[0]?.fullName).toBe('Alex Example');
  });
});
