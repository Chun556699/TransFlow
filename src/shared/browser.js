export const api = globalThis.browser ?? globalThis.chrome;

export function sendMessage(msg) {
  return new Promise((resolve) => {
    try {
      api.runtime.sendMessage(msg, (resp) => {
        void api.runtime.lastError;
        resolve(resp);
      });
    } catch {
      resolve(undefined);
    }
  });
}

export function storageGet(keys) {
  return new Promise((resolve) => api.storage.local.get(keys, resolve));
}

export function storageSet(obj) {
  return new Promise((resolve) => api.storage.local.set(obj, resolve));
}

export function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}
