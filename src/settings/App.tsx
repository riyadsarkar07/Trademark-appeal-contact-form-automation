import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createEmptyProfile,
  loadSnapshot,
  parseImportedProfiles,
  saveProfiles,
  saveSettings,
  serializeProfiles,
  validateProfile,
} from '../storage/profiles';
import type { AppealProfile, ExtensionSettings, ProfileFieldKey } from '../types';

const FIELD_META: Array<{ key: ProfileFieldKey; label: string; multiline?: boolean; type?: string }> = [
  { key: 'fullName', label: 'Full name' },
  { key: 'contactEmail', label: 'Contact email', type: 'email' },
  { key: 'organizationOrPageUrl', label: 'Official organization, client, or Page URL' },
  { key: 'removedContentUrlAndDescription', label: 'Please provide URL(s)/description leading to where the content appeared on Facebook.', multiline: true },
  { key: 'reportNumber', label: 'Report number' },
  { key: 'appealExplanation', label: 'Please explain why you believe that the content should not have been removed.', multiline: true },
  { key: 'electronicSignature', label: 'Electronic signature' },
];

export function App() {
  const [profiles, setProfiles] = useState<AppealProfile[]>([]);
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AppealProfile>(createEmptyProfile({ name: 'New profile' }));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => profiles.find((item) => item.id === selectedId) ?? null,
    [profiles, selectedId],
  );

  useEffect(() => {
    void (async () => {
      const snapshot = await loadSnapshot();
      setProfiles(snapshot.profiles);
      setSettings(snapshot.settings);
      const initial = snapshot.profiles.find((item) => item.id === snapshot.settings.activeProfileId) ?? snapshot.profiles[0];
      if (initial) {
        setSelectedId(initial.id);
        setDraft(initial);
      }
    })();
  }, []);

  function updateDraft<K extends keyof AppealProfile>(key: K, value: AppealProfile[K]): void {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function persist(nextProfiles: AppealProfile[], nextSettings?: ExtensionSettings): Promise<void> {
    setProfiles(nextProfiles);
    await saveProfiles(nextProfiles);
    if (nextSettings) {
      setSettings(nextSettings);
      await saveSettings(nextSettings);
    }
  }

  function createProfile(): void {
    const next = createEmptyProfile({ name: `Profile ${profiles.length + 1}` });
    const nextProfiles = [...profiles, next];
    setSelectedId(next.id);
    setDraft(next);
    void persist(nextProfiles);
    setMessage('Created a blank local profile. Fill in only the details you have.');
    setError(null);
  }

  async function saveDraft(): Promise<void> {
    const next = { ...draft, updatedAt: new Date().toISOString() };
    const errors = validateProfile(next);
    if (errors.length > 0) {
      setError(errors.join(' '));
      setMessage(null);
      return;
    }
    const exists = profiles.some((item) => item.id === next.id);
    const nextProfiles = exists ? profiles.map((item) => (item.id === next.id ? next : item)) : [...profiles, next];
    await persist(nextProfiles);
    setDraft(next);
    setSelectedId(next.id);
    setError(null);
    setMessage('Profile saved locally. Nothing was sent to a server.');
  }

  async function deleteProfile(): Promise<void> {
    if (!selected) {
      return;
    }
    const confirmed = window.confirm(`Delete profile "${selected.name}" from this device?`);
    if (!confirmed) {
      return;
    }
    const nextProfiles = profiles.filter((item) => item.id !== selected.id);
    const nextSettings = settings
      ? { ...settings, activeProfileId: nextProfiles[0]?.id ?? null }
      : undefined;
    await persist(nextProfiles, nextSettings);
    const fallback = nextProfiles[0] ?? createEmptyProfile({ name: 'New profile' });
    setSelectedId(nextProfiles[0]?.id ?? null);
    setDraft(fallback);
    setMessage('Profile deleted from local storage.');
  }

  async function activate(): Promise<void> {
    if (!settings || !selected) {
      return;
    }
    const next = { ...settings, activeProfileId: selected.id };
    await persist(profiles, next);
    setMessage(`"${selected.name}" is now the active fill profile.`);
  }

  function exportProfiles(): void {
    const confirmed = window.confirm(
      'Exported JSON contains personal information stored in your profiles. Continue?',
    );
    if (!confirmed) {
      return;
    }
    const blob = new Blob([serializeProfiles(profiles)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'meta-appeal-profiles.json';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importProfiles(file: File): Promise<void> {
    try {
      const text = await file.text();
      const imported = parseImportedProfiles(text);
      const merged = [...profiles];
      for (const item of imported) {
        const index = merged.findIndex((existing) => existing.id === item.id);
        if (index >= 0) {
          merged[index] = item;
        } else {
          merged.push(item);
        }
      }
      await persist(merged);
      setMessage(`Imported ${imported.length} profile(s). Review them before use.`);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.');
    }
  }

  return (
    <main className="settings-page">
      <header className="hero">
        <div>
          <h1>Manage profiles</h1>
          <p>
            Profiles are stored only in chrome.storage.local on this device. Do not invent missing case details.
            Exported files contain personal information.
          </p>
        </div>
        <button className="btn primary" type="button" onClick={createProfile}>
          New profile
        </button>
      </header>

      <div className="notice">
        This extension never sends appeals, never solves CAPTCHA, never enters email verification codes, and never
        uploads attachments. Declaration checkboxes stay under your control.
      </div>

      <div className="layout">
        <aside className="panel">
          <div className="toolbar">
            <button className="btn" type="button" onClick={exportProfiles} disabled={profiles.length === 0}>
              Export JSON
            </button>
            <button className="btn" type="button" onClick={() => fileRef.current?.click()}>
              Import JSON
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void importProfiles(file);
                }
                event.target.value = '';
              }}
            />
          </div>
          <div className="profile-list">
            {profiles.length === 0 ? <p>No profiles yet.</p> : null}
            {profiles.map((profile) => (
              <button
                key={profile.id}
                type="button"
                className={`profile-item ${profile.id === selectedId ? 'active' : ''}`}
                onClick={() => {
                  setSelectedId(profile.id);
                  setDraft(profile);
                  setError(null);
                }}
              >
                {profile.name}
                {settings?.activeProfileId === profile.id ? ' (active)' : ''}
              </button>
            ))}
          </div>
        </aside>

        <section className="panel">
          <div className="toolbar">
            <button className="btn primary" type="button" onClick={() => void saveDraft()}>
              Save profile
            </button>
            <button className="btn" type="button" onClick={() => void activate()} disabled={!selected}>
              Use for Auto-Fill
            </button>
            <button className="btn danger" type="button" onClick={() => void deleteProfile()} disabled={!selected}>
              Delete
            </button>
          </div>
          {error ? <p className="error">{error}</p> : null}
          {message ? <p className="success">{message}</p> : null}
          <div className="form-grid">
            <label>
              Profile name
              <input value={draft.name} onChange={(event) => updateDraft('name', event.target.value)} />
            </label>
            {FIELD_META.map((field) => (
              <label key={field.key}>
                {field.label}
                {field.multiline ? (
                  <textarea
                    value={draft[field.key]}
                    onChange={(event) => updateDraft(field.key, event.target.value)}
                  />
                ) : (
                  <input
                    type={field.type ?? 'text'}
                    value={draft[field.key]}
                    onChange={(event) => updateDraft(field.key, event.target.value)}
                  />
                )}
              </label>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
