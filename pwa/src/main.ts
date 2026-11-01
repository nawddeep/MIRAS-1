import './ui/styles.css';
import { AppController } from './ui/App';

const appRoot = document.getElementById('app');
let controller: AppController | null = null;

if (appRoot) {
  controller = new AppController(appRoot);
  void controller.init();
}

window.addEventListener('error', (event) => {
  if (controller && event.error instanceof Error) {
    controller.notifyFatalError(event.error.message);
  }
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  if (reason instanceof Error && reason.message === 'Cancelled') return;
  if (controller) {
    const msg = reason instanceof Error ? reason.message : String(reason ?? 'Unexpected error');
    controller.notifyFatalError(msg);
  }
});

if ('serviceWorker' in navigator) {
  // The new service worker takes control right away (skipWaiting + clientsClaim), but the
  // page keeps running the old code until reloaded. Reload once so testers get the new
  // version on the first open — unless a capture or stitch is in progress.
  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    if (controller && controller.isBusy()) return;
    reloading = true;
    window.location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then((reg) => {
        if (reg.waiting && controller) {
          controller.notifyServiceWorkerUpdate(() => {
            reg.waiting?.postMessage({ type: 'SKIP_WAITING' });
            window.location.reload();
          });
        }
        reg.addEventListener('updatefound', () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (
              installing.state === 'installed' &&
              navigator.serviceWorker.controller &&
              controller
            ) {
              controller.notifyServiceWorkerUpdate(() => {
                installing.postMessage({ type: 'SKIP_WAITING' });
                window.location.reload();
              });
            }
          });
        });
      })
      .catch(() => {
        // Service worker registration is optional in non-HTTPS dev environments
      });
  });
}

// Debug-only self-tests (?debug=1): CPU/GPU renderer consistency, callable from DevTools or
// automated browser checks as `await window.__mirasSelfTest.gpuCpu()`.
if (new URLSearchParams(window.location.search).get('debug') === '1') {
  void import('./services/StitchService').then(({ StitchService }) => {
    (window as unknown as { __mirasSelfTest: unknown }).__mirasSelfTest = {
      gpuCpu: (width?: number) => StitchService.gpuCpuCheck(width)
    };
  });
}
