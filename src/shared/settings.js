import { DEFAULT_SETTINGS } from './constants.js';
import { storageGet } from './browser.js';

function merge(base, over) {
  if (over === undefined || over === null) return base;
  if (Array.isArray(base) || typeof base !== 'object' || base === null) return over;
  const out = { ...base };
  for (const k of Object.keys(base)) out[k] = merge(base[k], over[k]);
  for (const k of Object.keys(over)) if (!(k in base)) out[k] = over[k];
  return out;
}

export async function loadSettings() {
  const { settings } = await storageGet('settings');
  return merge(DEFAULT_SETTINGS, settings ?? {});
}

export function matchHost(host, patterns) {
  const h = host.toLowerCase();
  return patterns.some((p) => {
    const pat = p.trim().toLowerCase().replace(/^\*\./, '');
    if (!pat) return false;
    return h === pat || h.endsWith('.' + pat);
  });
}
