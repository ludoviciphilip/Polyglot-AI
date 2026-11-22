/**
 * Demo mode flags. Enable with `?demo` in the URL (e.g. http://localhost:8080/?demo).
 * `?demo=clean` hides the on-screen demo badge (for screen recordings).
 */
const getParams = (): URLSearchParams | null => {
  try {
    return new URLSearchParams(window.location.search);
  } catch {
    return null;
  }
};

export const isDemoMode = (): boolean => Boolean(getParams()?.has('demo'));

export const isDemoBadgeHidden = (): boolean => getParams()?.get('demo') === 'clean';
