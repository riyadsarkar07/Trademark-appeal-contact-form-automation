import { DEFAULT_SETTINGS, loadSnapshot, saveSettings } from '../storage/profiles';
import type { RuntimeMessage, RuntimeResponse } from '../types';

chrome.runtime.onInstalled.addListener(() => {
  void (async () => {
    const snapshot = await loadSnapshot();
    if (!snapshot.settings) {
      await saveSettings(DEFAULT_SETTINGS);
    }
  })();
});

chrome.runtime.onMessage.addListener((message: RuntimeMessage, sender, sendResponse) => {
  if (message.type !== 'GET_SETTINGS') {
    return;
  }
  void (async () => {
    const snapshot = await loadSnapshot();
    const response: RuntimeResponse = {
      ok: true,
      detection: {
        status: 'idle',
        hostname: sender.tab?.url ? new URL(sender.tab.url).hostname : '',
        formId: null,
        formName: null,
        reason: 'Background settings loaded.',
        fields: [],
        matches: [],
        matchedCount: 0,
        unmatchedCount: 0,
        ambiguousCount: 0,
        challenges: [],
        extractionEnabled: snapshot.settings.extractionEnabled,
      },
    };
    sendResponse(response);
  })();
  return true;
});
