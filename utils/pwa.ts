/**
 * Registers the offline service worker (public/sw.js).
 *
 * Only runs in production builds and outside iframes, so the Vite dev server and the
 * Google AI Studio preview (which embeds the app in an iframe) are never affected.
 */
export const shouldRegisterServiceWorker = (env: {
  isProd: boolean;
  hasServiceWorker: boolean;
  isTopLevel: boolean;
}): boolean => env.isProd && env.hasServiceWorker && env.isTopLevel;

const isTopLevelWindow = (): boolean => {
  try {
    return window.self === window.top;
  } catch {
    return false; // cross-origin parent => embedded
  }
};

export const registerServiceWorker = (): void => {
  const enabled = shouldRegisterServiceWorker({
    isProd: Boolean(import.meta.env?.PROD),
    hasServiceWorker: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
    isTopLevel: typeof window !== 'undefined' && isTopLevelWindow(),
  });
  if (!enabled) return;

  const register = () => {
    const swUrl = `${import.meta.env.BASE_URL || '/'}sw.js`;
    navigator.serviceWorker.register(swUrl).catch((err) => {
      console.warn('[PWA] Service worker registration failed', err);
    });
  };
  // The app bootstraps asynchronously, so the load event may already have fired
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
};
