import { useEffect, useMemo, useState } from 'react';
import { DetectIcon, FillIcon, GearIcon, ShieldIcon, WarnIcon } from '../ui/icons';
import { openSettingsPage, sendToActiveTab } from '../ui/chrome';
import { loadSnapshot, saveSettings } from '../storage/profiles';
import type { AppealProfile, AutofillReport, ExtensionSettings, FormDetectionResult } from '../types';

function statusClass(status: FormDetectionResult['status'] | 'idle'): string {
  if (status === 'supported') {
    return 'supported';
  }
  if (status === 'manual-action-required') {
    return 'warning';
  }
  if (status === 'error' || status === 'unsupported-form' || status === 'unsupported-host') {
    return status;
  }
  return '';
}

function statusLabel(status: FormDetectionResult['status'] | 'idle'): string {
  switch (status) {
    case 'supported':
      return 'Form detected';
    case 'manual-action-required':
      return 'Manual action';
    case 'unsupported-host':
      return 'Host blocked';
    case 'unsupported-form':
      return 'Form unknown';
    case 'error':
      return 'Error';
    default:
      return 'Idle';
  }
}

export function App() {
  const [profiles, setProfiles] = useState<AppealProfile[]>([]);
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [detection, setDetection] = useState<FormDetectionResult | null>(null);
  const [report, setReport] = useState<AutofillReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overwriteExisting, setOverwriteExisting] = useState(false);

  const activeProfile = useMemo(
    () => profiles.find((item) => item.id === settings?.activeProfileId) ?? profiles[0] ?? null,
    [profiles, settings],
  );

  useEffect(() => {
    void refreshLocal();
  }, []);

  async function refreshLocal(): Promise<void> {
    const snapshot = await loadSnapshot();
    setProfiles(snapshot.profiles);
    setSettings(snapshot.settings);
  }

  async function persistSettings(next: ExtensionSettings): Promise<void> {
    setSettings(next);
    await saveSettings(next);
  }

  async function detectForm(): Promise<void> {
    setBusy(true);
    setError(null);
    setReport(null);
    const response = await sendToActiveTab({ type: 'DETECT_FORM' });
    setBusy(false);
    if (!response.ok || !response.detection) {
      setError(response.error ?? 'Detection failed.');
      return;
    }
    setDetection(response.detection);
  }

  async function toggleExtraction(enabled: boolean): Promise<void> {
    if (!settings) {
      return;
    }
    await persistSettings({ ...settings, extractionEnabled: enabled });
    const response = await sendToActiveTab({ type: 'SET_EXTRACTION', payload: { enabled } });
    if (response.detection) {
      setDetection(response.detection);
    }
  }

  async function changeProfile(id: string): Promise<void> {
    if (!settings) {
      return;
    }
    await persistSettings({ ...settings, activeProfileId: id });
  }

  async function autoFill(): Promise<void> {
    if (!activeProfile) {
      setError('Create a profile in Settings before filling.');
      return;
    }
    setBusy(true);
    setError(null);
    const response = await sendToActiveTab({
      type: 'AUTOFILL',
      payload: {
        request: {
          profile: activeProfile,
          overwriteExisting,
          fillProtectedLegal: false,
        },
      },
    });
    setBusy(false);
    if (!response.ok) {
      setError(response.error ?? 'Autofill failed.');
      return;
    }
    if (response.detection) {
      setDetection(response.detection);
    }
    if (response.report) {
      setReport(response.report);
      if (response.report.blockedReason) {
        setError(response.report.blockedReason);
      }
    }
  }

  const unmatched = detection?.matches.filter((item) => item.confidence === 'none' || item.confidence === 'low') ?? [];
  const ambiguous = detection?.matches.filter((item) => item.confidence === 'ambiguous') ?? [];
  const canFill = detection?.status === 'supported' && Boolean(activeProfile) && !busy;

  return (
    <main className="popup">
      <header className="header">
        <div className="brand">
          <div className="brand-mark">
            <ShieldIcon />
          </div>
          <div>
            <h1>Meta Appeal AutoFill</h1>
            <p>Local assistant. Never submits.</p>
          </div>
        </div>
        <span className={`status-pill ${statusClass(detection?.status ?? 'idle')}`}>
          {statusLabel(detection?.status ?? 'idle')}
        </span>
      </header>

      <section className="card">
        <div className="row">
          <label className="toggle" htmlFor="extraction-toggle">
            <input
              id="extraction-toggle"
              type="checkbox"
              checked={settings?.extractionEnabled ?? true}
              onChange={(event) => void toggleExtraction(event.target.checked)}
            />
            Extraction {settings?.extractionEnabled ? 'ON' : 'OFF'}
          </label>
          <button className="btn" type="button" onClick={openSettingsPage}>
            <GearIcon />
            Settings
          </button>
        </div>
        <label htmlFor="profile-select">
          Saved profile
          <select
            id="profile-select"
            value={activeProfile?.id ?? ''}
            onChange={(event) => void changeProfile(event.target.value)}
            disabled={profiles.length === 0}
          >
            {profiles.length === 0 ? <option value="">No profiles yet</option> : null}
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="card">
        <div className="stats">
          <div className="stat">
            <strong>{detection?.fields.length ?? 0}</strong>
            <span>Detected fields</span>
          </div>
          <div className="stat">
            <strong>{detection?.matchedCount ?? 0}</strong>
            <span>Matched</span>
          </div>
          <div className="stat">
            <strong>{(detection?.unmatchedCount ?? 0) + (detection?.ambiguousCount ?? 0)}</strong>
            <span>Unmatched</span>
          </div>
        </div>
        <p className="footer-note">
          {busy ? 'Working…' : detection?.reason ?? 'Detect the current tab before filling.'}
        </p>
        <div className="actions">
          <button className="btn primary" type="button" onClick={() => void detectForm()} disabled={busy}>
            <DetectIcon />
            Detect Current Form
          </button>
          <button className="btn accent" type="button" onClick={() => void autoFill()} disabled={!canFill}>
            <FillIcon />
            Auto-Fill
          </button>
        </div>
        <label className="toggle" htmlFor="overwrite-toggle">
          <input
            id="overwrite-toggle"
            type="checkbox"
            checked={overwriteExisting}
            onChange={(event) => setOverwriteExisting(event.target.checked)}
          />
          Overwrite existing non-empty values
        </label>
      </section>

      {detection?.challenges.length ? (
        <div className="banner">
          <WarnIcon />
          <span>{detection.challenges.map((item) => item.label).join(' ')}</span>
        </div>
      ) : null}

      {error ? (
        <div className="banner">
          <WarnIcon />
          <span>{error}</span>
        </div>
      ) : null}

      {ambiguous.length + unmatched.length > 0 ? (
        <section className="card">
          <strong>Unmatched / ambiguous</strong>
          <div className="list">
            {[...ambiguous, ...unmatched].map((item) => (
              <div className="item warn" key={item.field.id}>
                {item.field.label || item.field.id}: {item.reason}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {report ? (
        <section className="card">
          <strong>
            Fill results: {report.filled} filled, {report.alreadyCorrect} already correct, {report.skipped} skipped,{' '}
            {report.failed} failed
          </strong>
          <div className="list">
            {report.results.map((item) => (
              <div
                key={item.fieldId}
                className={`item ${item.outcome === 'filled' || item.outcome === 'already-correct' ? 'ok' : item.outcome === 'failed' ? 'error' : 'warn'}`}
              >
                {item.label || item.fieldId}: {item.message}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <p className="footer-note">
        CAPTCHA, email codes, declarations, attachments, and Send remain under your control. Profiles stay on this
        device.
      </p>
    </main>
  );
}
