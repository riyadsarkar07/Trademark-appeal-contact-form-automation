import { describe, expect, it } from 'vitest';
import { handleRuntimeMessage, inspectPage, type EngineState } from '../../src/content/engine';
import { createEmptyProfile } from '../../src/storage/profiles';

describe('engine message handling', () => {
  const profile = createEmptyProfile({
    id: 'p1',
    fullName: 'Alex Example',
    contactEmail: 'alex@example.com',
    electronicSignature: 'Alex Example',
    reportNumber: 'RPT-2',
  });

  function mountAppeal(): void {
    document.body.innerHTML = `
      <h1>Trademark Appeal Contact Form</h1>
      <h2>Contact Information</h2>
      <label for="full-name">Full name</label>
      <input id="full-name" />
      <h2>Reported Content At Issue</h2>
      <label for="report">Report number</label>
      <input id="report" />
      <h2>Appeal explanation</h2>
      <textarea id="why" aria-label="Appeal explanation"></textarea>
      <h2>Declaration</h2>
      <label for="signature">Electronic signature</label>
      <input id="signature" />
    `;
  }

  it('returns idle fields when extraction is disabled', () => {
    mountAppeal();
    const result = inspectPage(
      { hostname: 'localhost', pathname: '/' },
      document,
      false,
      profile,
    );
    expect(result.status).toBe('idle');
    expect(result.fields).toHaveLength(0);
  });

  it('detects via DETECT_FORM and fills via AUTOFILL without submitting', () => {
    mountAppeal();
    const state: EngineState = { extractionEnabled: true, lastFingerprint: null };
    const detected = handleRuntimeMessage(
      { type: 'DETECT_FORM' },
      {
        locationLike: { hostname: 'localhost', pathname: '/' },
        root: document,
        state,
        profile,
      },
    );
    expect(detected.ok).toBe(true);
    expect(detected.detection?.status).toBe('supported');

    const filled = handleRuntimeMessage(
      {
        type: 'AUTOFILL',
        payload: {
          request: { profile, overwriteExisting: true, fillProtectedLegal: false },
        },
      },
      {
        locationLike: { hostname: 'localhost', pathname: '/' },
        root: document,
        state,
        profile,
      },
    );
    expect(filled.report?.filled).toBeGreaterThan(0);
    expect((document.getElementById('full-name') as HTMLInputElement).value).toBe('Alex Example');
    expect(state.lastFingerprint).toBeTruthy();

    const retried = handleRuntimeMessage(
      {
        type: 'AUTOFILL',
        payload: {
          request: { profile, overwriteExisting: false, fillProtectedLegal: false },
        },
      },
      {
        locationLike: { hostname: 'localhost', pathname: '/' },
        root: document,
        state,
        profile,
      },
    );
    expect(retried.ok).toBe(true);
    expect(retried.report?.blockedReason).toBeNull();
    expect(retried.report?.results.some((item) => item.outcome === 'already-correct')).toBe(true);
    expect((document.getElementById('full-name') as HTMLInputElement).value).toBe('Alex Example');
  });
});
