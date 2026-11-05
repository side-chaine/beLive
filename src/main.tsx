import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ThemeProvider } from './theme/components/ThemeProvider';
import { bridgeFacade } from './foundation/event-bus';
import './character'; // side effect: registers initRegistry entries BEFORE runAll()

import { initBridgeRegistry } from './boot/registry';
import { bootAether, disposeAether } from './boot/aetherBoot';
import { installLegacyHost } from './boot/legacyHost';
import { installDevHooks } from './boot/devHooks';

declare global { interface Window { __BELIVE_BOOTED__?: boolean } }

/**
 * Thin application entry. Boot order is EXPLICIT and intentionally unchanged:
 *   1. bridge facade + event wrappers (synchronous, DOM-free)
 *   2. Aether audio engine (Router -> Interceptor -> before-track-change)
 *   3. legacy DOM host patches, once the document is parsed
 *   4. dev / deep-link hooks
 *   5. React shell, which renders the startup splash over the mounted app
 *
 * Responsibility is split by module, NOT by timing: Aether has ordering
 * contracts with the legacy audio facade that must be established before any
 * track event can fire, so heavy init stays on the eager path.
 */
const cleanupAll = initBridgeRegistry();
bootAether();

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    cleanupAll();
    bridgeFacade.destroy();
    disposeAether();
  });
}

const startLegacyHost = () => {
  void installLegacyHost().catch((e) => console.error('[boot] legacy host failed', e));
};
// Robust to a module graph that finishes after DOMContentLoaded has fired.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startLegacyHost, { once: true });
} else {
  startLegacyHost();
}

installDevHooks();

// Mount React Shell
const reactRoot = document.getElementById('react-root');
if (reactRoot) {
  createRoot(reactRoot).render(
    React.createElement(
      React.Fragment,
      null,
      React.createElement(ThemeProvider),
      React.createElement(App)
    )
  );
} else {
  console.warn('[beLive] #react-root not found, React Shell not mounted');
}
