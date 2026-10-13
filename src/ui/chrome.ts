import type { RuntimeMessage, RuntimeResponse } from '../types';

function isMissingReceiverError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /receiving end does not exist|could not establish connection|no tab with id/i.test(message);
}

async function sendMessage(tabId: number, message: RuntimeMessage): Promise<RuntimeResponse> {
  return chrome.tabs.sendMessage(tabId, message);
}

async function injectContentScript(tabId: number): Promise<void> {
  if (!chrome.scripting?.executeScript) {
    throw new Error('Scripting API is not available to recover the content script.');
  }
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content.js'],
  });
}

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
    return await sendMessage(tab.id, message);
  } catch (firstError) {
    if (!isMissingReceiverError(firstError) && !chrome.scripting?.executeScript) {
      return {
        ok: false,
        error:
          firstError instanceof Error
            ? firstError.message
            : 'The content script is not available on this tab. Open a supported Meta help/contact form or the local mock form, then try again.',
      };
    }
    try {
      await injectContentScript(tab.id);
      return await sendMessage(tab.id, message);
    } catch (injectError) {
      return {
        ok: false,
        error:
          injectError instanceof Error
            ? injectError.message
            : 'The content script is not available on this tab and could not be injected.',
      };
    }
  }
}

export function openSettingsPage(): void {
  if (typeof chrome !== 'undefined' && chrome.runtime?.openOptionsPage) {
    chrome.runtime.openOptionsPage();
    return;
  }
  window.open('./settings.html', '_blank');
}
