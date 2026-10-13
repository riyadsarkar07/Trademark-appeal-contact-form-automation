import type { RuntimeMessage, RuntimeResponse } from '../types';

export async function sendToActiveTab(message: RuntimeMessage): Promise<RuntimeResponse> {
  if (typeof chrome === 'undefined' || !chrome.tabs?.query) {
    return { ok: false, error: 'Chrome tabs API is not available in this context.' };
  }
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab?.id) {
    return { ok: false, error: 'No active tab found.' };
  }
  try {
    return await chrome.tabs.sendMessage(tab.id, message);
  } catch {
    try {
      if (chrome.scripting?.executeScript) {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js'],
        });
        return await chrome.tabs.sendMessage(tab.id, message);
      }
    } catch (injectError) {
      return {
        ok: false,
        error:
          injectError instanceof Error
            ? injectError.message
            : 'The content script is not available on this tab and could not be injected.',
      };
    }
    return {
      ok: false,
      error:
        'The content script is not available on this tab. Open a supported Meta help/contact form or the local mock form, then try again.',
    };
  }
}

export function openSettingsPage(): void {
  if (typeof chrome !== 'undefined' && chrome.runtime?.openOptionsPage) {
    chrome.runtime.openOptionsPage();
    return;
  }
  window.open('./settings.html', '_blank');
}
