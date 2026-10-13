import type { AppealProfile, RuntimeMessage, RuntimeResponse } from '../types';
import { DEFAULT_SETTINGS, loadSnapshot, saveSettings } from '../storage/profiles';
import { handleRuntimeMessage, type EngineState } from './engine';

const state: EngineState = {
  extractionEnabled: DEFAULT_SETTINGS.extractionEnabled,
  lastFingerprint: null,
};

async function currentProfile(): Promise<AppealProfile | null> {
  const snapshot = await loadSnapshot();
  state.extractionEnabled = snapshot.settings.extractionEnabled;
  state.lastFingerprint = snapshot.settings.lastFilledFingerprint;
  if (!snapshot.settings.activeProfileId) {
    return snapshot.profiles[0] ?? null;
  }
  return snapshot.profiles.find((item) => item.id === snapshot.settings.activeProfileId) ?? snapshot.profiles[0] ?? null;
}

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  void (async () => {
    try {
      const profile = await currentProfile();
      const response: RuntimeResponse = handleRuntimeMessage(message, {
        locationLike: { hostname: window.location.hostname, pathname: window.location.pathname },
        root: document,
        state,
        profile,
      });
      if (message.type === 'AUTOFILL' && response.report?.fingerprint) {
        const snapshot = await loadSnapshot();
        await saveSettings({ ...snapshot.settings, lastFilledFingerprint: response.report.fingerprint });
      }
      sendResponse(response);
    } catch (error) {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : 'Content script failed.',
      } satisfies RuntimeResponse);
    }
  })();
  return true;
});
