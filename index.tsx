import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initPersistentStore, createMemoryBackend } from './utils/persistentStore';
import { isDemoMode } from './utils/demo/demoFlags';
import { registerServiceWorker } from './utils/pwa';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const bootstrap = async () => {
  if (isDemoMode()) {
    // Demo mode: in-memory, read-only snapshot; the real user data is never read or written.
    const { buildDemoSnapshot } = await import('./utils/demo/demoMode');
    const snapshot = await buildDemoSnapshot();
    await initPersistentStore({ backend: createMemoryBackend(snapshot, 'demo'), readOnly: true });
  } else {
    try {
      const { backend, migrated } = await initPersistentStore();
      if (migrated.length > 0) {
        console.info(`[Storage] Migrated ${migrated.length} key(s) from localStorage to ${backend}`);
      }
    } catch (e) {
      console.error('[Storage] Initialization failed', e);
    }
    registerServiceWorker();
  }

  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
};

void bootstrap();
