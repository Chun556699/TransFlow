const DB = 'transflow';
const STORE = 'cache';
const MAX = 20000;

let dbPromise;
function db() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains(STORE)) {
        const s = d.createObjectStore(STORE, { keyPath: 'k' });
        s.createIndex('t', 't');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(mode, fn) {
  return db().then(
    (d) =>
      new Promise((resolve, reject) => {
        const t = d.transaction(STORE, mode);
        const out = fn(t.objectStore(STORE));
        t.oncomplete = () => resolve(out?.result ?? out);
        t.onerror = () => reject(t.error);
      }),
  );
}

export async function hash(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const cache = {
  async get(key) {
    try {
      return (await tx('readonly', (s) => s.get(key)))?.v ?? null;
    } catch {
      return null;
    }
  },
  async getMany(keys) {
    try {
      return await tx('readonly', (s) =>
        Promise.all(
          keys.map(
            (k) =>
              new Promise((res, rej) => {
                const q = s.get(k);
                q.onsuccess = () => res(q.result);
                q.onerror = () => rej(q.error);
              }),
          ),
        ),
      );
    } catch {
      return keys.map(() => null);
    }
  },
  async set(key, value) {
    try {
      await tx('readwrite', (s) => s.put({ k: key, v: value, t: Date.now() }));
    } catch {
      /* cache is best-effort */
    }
  },
  async clear() {
    try {
      await tx('readwrite', (s) => s.clear());
    } catch {
      /* noop */
    }
  },
  async trim() {
    try {
      const d = await db();
      const t = d.transaction(STORE, 'readwrite');
      const count = await new Promise((r) => {
        const q = t.objectStore(STORE).count();
        q.onsuccess = () => r(q.result);
      });
      if (count <= MAX) return;
      const idx = t.objectStore(STORE).index('t');
      let n = count - MAX;
      idx.openCursor().onsuccess = (e) => {
        const c = e.target.result;
        if (c && n > 0) {
          c.delete();
          n -= 1;
          c.continue();
        }
      };
    } catch {
      /* noop */
    }
  },
};
