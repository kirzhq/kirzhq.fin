export type Theme = 'light' | 'dark';

/**
 * The chosen theme lives in a cookie on .kirzhq.ru so that home and fin share it.
 * No cookie means "follow the system".
 */
const COOKIE = 'md-theme';

export function storedTheme(): Theme | null {
  const fromCookie = document.cookie.split('; ').find((item) => item.startsWith(`${COOKIE}=`))?.split('=')[1];
  if (fromCookie === 'light' || fromCookie === 'dark') return fromCookie;
  try {
    const local = localStorage.getItem(COOKIE);
    return local === 'light' || local === 'dark' ? local : null;
  } catch {
    return null;
  }
}

export function effectiveTheme(): Theme {
  return (document.documentElement.dataset.theme as Theme | undefined)
    ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}

export function applyTheme(theme: Theme | null) {
  if (theme) document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
  const color = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  document.querySelector('meta[name="theme-color"]:not([media])')?.setAttribute('content', color);
}

export function saveTheme(theme: Theme) {
  const domain = window.location.hostname.endsWith('kirzhq.ru') ? '; domain=kirzhq.ru' : '';
  document.cookie = `${COOKIE}=${theme}; path=/; max-age=31536000; samesite=lax${domain}`;
  try { localStorage.setItem(COOKIE, theme); } catch { /* private mode */ }
  applyTheme(theme);
}
