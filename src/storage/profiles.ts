import type {
  AppealProfile,
  ExtensionSettings,
  ProfileFieldKey,
  ProfileImportPayload,
  StorageSnapshot,
} from '../types';
import { PROFILE_FIELDS } from '../types';

export const STORAGE_KEYS = {
  profiles: 'metaAppeal.profiles',
  settings: 'metaAppeal.settings',
} as const;

export const DEFAULT_SETTINGS: ExtensionSettings = {
  extractionEnabled: true,
  activeProfileId: null,
  lastFilledFingerprint: null,
};

export function createEmptyProfile(partial?: Partial<AppealProfile>): AppealProfile {
  const now = new Date().toISOString();
  const rawUrlAndDesc = (partial as unknown as Record<string, unknown>)?.removedContentUrlAndDescription;
  let removedContentUrlAndDescription = '';
  if (typeof rawUrlAndDesc === 'string') {
    removedContentUrlAndDescription = rawUrlAndDesc;
  } else {
    const oldUrls = typeof (partial as unknown as Record<string, unknown>)?.removedContentUrls === 'string'
      ? ((partial as unknown as Record<string, unknown>).removedContentUrls as string)
      : '';
    const oldDesc = typeof (partial as unknown as Record<string, unknown>)?.removedContentDescription === 'string'
      ? ((partial as unknown as Record<string, unknown>).removedContentDescription as string)
      : '';
    if (oldUrls && oldDesc) {
      removedContentUrlAndDescription = `${oldUrls}\n${oldDesc}`;
    } else {
      removedContentUrlAndDescription = oldUrls || oldDesc || '';
    }
  }
  return {
    id: partial?.id ?? createId(),
    name: partial?.name?.trim() || 'Untitled profile',
    updatedAt: partial?.updatedAt ?? now,
    fullName: partial?.fullName ?? '',
    organizationOrPageUrl: partial?.organizationOrPageUrl ?? '',
    removedContentUrlAndDescription,
    contactEmail: partial?.contactEmail ?? '',
    reportNumber: partial?.reportNumber ?? '',
    appealExplanation: partial?.appealExplanation ?? '',
    electronicSignature: partial?.electronicSignature ?? '',
  };
}

export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `profile-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function isValidEmail(value: string): boolean {
  if (!value) {
    return true;
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function validateProfile(profile: AppealProfile): string[] {
  const errors: string[] = [];
  if (!profile.name.trim()) {
    errors.push('Profile name is required.');
  }
  if (!isValidEmail(profile.contactEmail)) {
    errors.push('Contact email is not a valid email address.');
  }
  if (profile.electronicSignature && profile.fullName) {
    if (normalizeComparable(profile.electronicSignature) !== normalizeComparable(profile.fullName)) {
      errors.push('Electronic signature should match the full name.');
    }
  }
  return errors;
}

export function normalizeComparable(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function getProfileValue(profile: AppealProfile, key: ProfileFieldKey): string {
  return profile[key] ?? '';
}

function getLocalChromeStorage(): chrome.storage.StorageArea | null {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    return chrome.storage.local;
  }
  return null;
}

function readFallback(): StorageSnapshot {
  if (typeof localStorage === 'undefined') {
    return { profiles: [], settings: { ...DEFAULT_SETTINGS } };
  }
  try {
    const raw = localStorage.getItem('meta-appeal-autofill-fallback');
    if (!raw) {
      return { profiles: [], settings: { ...DEFAULT_SETTINGS } };
    }
    const parsed = JSON.parse(raw) as StorageSnapshot;
    return {
      profiles: Array.isArray(parsed.profiles) ? parsed.profiles.map((item) => createEmptyProfile(item)) : [],
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
    };
  } catch {
    return { profiles: [], settings: { ...DEFAULT_SETTINGS } };
  }
}

function writeFallback(snapshot: StorageSnapshot): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  localStorage.setItem('meta-appeal-autofill-fallback', JSON.stringify(snapshot));
}

export async function loadSnapshot(): Promise<StorageSnapshot> {
  const area = getLocalChromeStorage();
  if (!area) {
    return readFallback();
  }
  const result = await area.get([STORAGE_KEYS.profiles, STORAGE_KEYS.settings]);
  const profilesRaw = result[STORAGE_KEYS.profiles];
  const settingsRaw = result[STORAGE_KEYS.settings];
  const profiles = Array.isArray(profilesRaw)
    ? (profilesRaw as AppealProfile[]).map((item) => createEmptyProfile(item))
    : [];
  const settings: ExtensionSettings = {
    ...DEFAULT_SETTINGS,
    ...(settingsRaw && typeof settingsRaw === 'object' ? (settingsRaw as ExtensionSettings) : {}),
  };
  return { profiles, settings };
}

export async function saveSnapshot(snapshot: StorageSnapshot): Promise<void> {
  const area = getLocalChromeStorage();
  if (!area) {
    writeFallback(snapshot);
    return;
  }
  await area.set({
    [STORAGE_KEYS.profiles]: snapshot.profiles,
    [STORAGE_KEYS.settings]: snapshot.settings,
  });
}

export async function saveProfiles(profiles: AppealProfile[]): Promise<void> {
  const snapshot = await loadSnapshot();
  snapshot.profiles = profiles;
  if (snapshot.settings.activeProfileId && !profiles.some((item) => item.id === snapshot.settings.activeProfileId)) {
    snapshot.settings.activeProfileId = profiles[0]?.id ?? null;
  }
  await saveSnapshot(snapshot);
}

export async function saveSettings(settings: ExtensionSettings): Promise<void> {
  const snapshot = await loadSnapshot();
  snapshot.settings = settings;
  await saveSnapshot(snapshot);
}

export function serializeProfiles(profiles: AppealProfile[]): string {
  const payload: ProfileImportPayload = { version: 1, profiles };
  return JSON.stringify(payload, null, 2);
}

export function parseImportedProfiles(raw: string): AppealProfile[] {
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Import file is not valid JSON.');
  }
  const candidate = parsed as { profiles?: unknown };
  if (!Array.isArray(candidate.profiles)) {
    throw new Error('Import file must contain a profiles array.');
  }
  return candidate.profiles.map((item) => {
    if (!item || typeof item !== 'object') {
      throw new Error('Each profile must be an object.');
    }
    const record = item as unknown as Record<string, unknown>;
    const next = createEmptyProfile({
      id: typeof record.id === 'string' ? record.id : createId(),
      name: typeof record.name === 'string' ? record.name : 'Imported profile',
      updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : new Date().toISOString(),
    });
    for (const key of PROFILE_FIELDS) {
      const value = record[key];
      next[key] = typeof value === 'string' ? value : '';
    }
    return next;
  });
}

export function fingerprintFill(profileId: string, fieldIds: string[]): string {
  return `${profileId}::${[...fieldIds].sort().join('|')}`;
}
