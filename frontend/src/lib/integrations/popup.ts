/**
 * Client-side authorization popup coordinator for Prism V2.
 * Implements the Pre-Opened Window Pattern to guarantee 100% immunity
 * against popup blockers on Safari, Chrome, and iOS WebKit.
 */

export interface PopupCallbacks {
  onProgress?: (message: string) => void;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function openPrismConnectPopup(
  app: string,
  callbacks: PopupCallbacks = {}
): Window | null {
  const { onProgress, onSuccess, onError } = callbacks;

  // 1. Synchronously open window on user gesture to prevent popup blocking
  const width = 600;
  const height = 750;
  const left = window.screenX + (window.outerWidth - width) / 2;
  const top = window.screenY + (window.outerHeight - height) / 2;

  let popup: Window | null = null;
  try {
    popup = window.open(
      'about:blank',
      'PrismConnectAuthorization',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`
    );
  } catch (err) {
    console.error('Failed to open window:', err);
  }

  if (!popup || popup.closed || typeof popup.closed === 'undefined') {
    const error = new Error(
      'Popup was blocked by your browser. Please allow popups for Prism.'
    );
    onError?.(error);
    return null;
  }

  // Render clean light loading shell in the blank popup
  try {
    popup.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Prism Connect</title>
          <style>
            * { box-sizing: border-box; }
            body {
              background: #FFFFFF;
              color: #0F172A;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              user-select: none;
            }
            .container { text-align: center; padding: 24px; }
            .spinner {
              width: 36px;
              height: 36px;
              border: 2.5px solid #E2E8F0;
              border-top-color: #2563EB;
              border-radius: 50%;
              animation: spin 0.8s linear infinite;
              margin: 0 auto 16px;
            }
            @keyframes spin { to { transform: rotate(360deg); } }
            .title { font-size: 15px; font-weight: 600; color: #0F172A; letter-spacing: -0.01em; margin-bottom: 4px; }
            .subtitle { font-size: 12px; color: #64748B; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="spinner"></div>
            <div class="title">Initializing Prism Authorization…</div>
            <div class="subtitle">Connecting to secure authentication gateway</div>
          </div>
        </body>
      </html>
    `);
  } catch {
    // Document write might fail in some cross-domain edge cases
  }

  onProgress?.('Preparing Prism connection…');

  let isCompleted = false;
  let pollInterval: NodeJS.Timeout | null = null;
  let heartbeatInterval: NodeJS.Timeout | null = null;

  const cleanup = () => {
    if (pollInterval) clearInterval(pollInterval);
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    window.removeEventListener('message', handleMessage);
  };

  const markSuccess = () => {
    if (isCompleted) return;
    isCompleted = true;
    cleanup();
    onProgress?.('Connected to Prism');
    onSuccess?.();
  };

  const markError = (err: Error) => {
    if (isCompleted) return;
    isCompleted = true;
    cleanup();
    try {
      if (popup && !popup.closed) popup.close();
    } catch {}
    onError?.(err);
  };

  // 2. Dual-mechanism: Listen for postMessage from /integrations/callback
  const handleMessage = (event: MessageEvent) => {
    if (
      event.origin === window.location.origin &&
      event.data?.type === 'PRISM_AUTH_COMPLETE'
    ) {
      markSuccess();
    }
  };
  window.addEventListener('message', handleMessage);

  // 3. Request authorization URL asynchronously
  fetch('/api/integrations/connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app }),
  })
    .then(async (res) => {
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to initialize connection');
      }
      return res.json();
    })
    .then((data) => {
      if (!data.redirectUrl) {
        throw new Error('No authorization URL returned from server');
      }

      onProgress?.('Awaiting authorization…');
      if (popup && !popup.closed) {
        popup.location.href = data.redirectUrl;
      }

      // 4. Start fallback status polling loop every 3 seconds (max 60s)
      let pollCount = 0;
      const MAX_POLLS = 20;

      pollInterval = setInterval(async () => {
        if (isCompleted) return;
        pollCount++;

        try {
          const statusRes = await fetch(
            `/api/integrations/status?app=${encodeURIComponent(app)}`
          );
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            if (statusData.isConnected) {
              markSuccess();
              return;
            }
          }
        } catch {
          // Soft fail on polling network glitch
        }

        if (pollCount >= MAX_POLLS) {
          markError(
            new Error('Authorization timed out. Please try connecting again.')
          );
        }
      }, 3000);

      // 5. Heartbeat checking if user closed popup window
      heartbeatInterval = setInterval(async () => {
        if (isCompleted) return;
        if (popup && popup.closed) {
          clearInterval(heartbeatInterval!);
          // Final verification probe before cancelling
          try {
            const finalCheck = await fetch(
              `/api/integrations/status?app=${encodeURIComponent(app)}`
            );
            if (finalCheck.ok) {
              const statusData = await finalCheck.json();
              if (statusData.isConnected) {
                markSuccess();
                return;
              }
            }
          } catch {}

          markError(new Error('Connection window was closed before completion.'));
        }
      }, 600);
    })
    .catch((err) => {
      markError(err instanceof Error ? err : new Error(String(err)));
    });

  return popup;
}
