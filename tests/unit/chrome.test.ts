import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendToActiveTab } from '../../src/ui/chrome';

type ChromeMock = {
  tabs: {
    query: ReturnType<typeof vi.fn>;
    sendMessage: ReturnType<typeof vi.fn>;
  };
  scripting: {
    executeScript: ReturnType<typeof vi.fn>;
  };
};

function installChrome(mock: ChromeMock): void {
  Object.defineProperty(globalThis, 'chrome', {
    configurable: true,
    writable: true,
    value: mock,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(globalThis, 'chrome');
});

describe('popup to content-script recovery', () => {
  it('injects content.js once when the receiver is missing, then retries the message', async () => {
    const sendMessage = vi
      .fn()
      .mockRejectedValueOnce(new Error('Could not establish connection. Receiving end does not exist.'))
      .mockResolvedValueOnce({ ok: true });
    const executeScript = vi.fn().mockResolvedValue([{ result: undefined }]);
    installChrome({
      tabs: {
        query: vi.fn().mockResolvedValue([{ id: 42 }]),
        sendMessage,
      },
      scripting: { executeScript },
    });

    const response = await sendToActiveTab({ type: 'DETECT_FORM' });

    expect(executeScript).toHaveBeenCalledTimes(1);
    expect(executeScript).toHaveBeenCalledWith({ target: { tabId: 42 }, files: ['content.js'] });
    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(response).toEqual({ ok: true });
  });

  it('returns a useful error when injection also fails', async () => {
    installChrome({
      tabs: {
        query: vi.fn().mockResolvedValue([{ id: 7 }]),
        sendMessage: vi.fn().mockRejectedValue(new Error('Receiving end does not exist.')),
      },
      scripting: {
        executeScript: vi.fn().mockRejectedValue(new Error('Cannot access contents of the page.')),
      },
    });

    const response = await sendToActiveTab({ type: 'PING' });
    expect(response.ok).toBe(false);
    expect(response.error).toMatch(/cannot access contents/i);
  });
});
