export function makePool(size) {
  let active = 0;
  const queue = [];
  const next = () => {
    if (active >= size || queue.length === 0) return;
    active += 1;
    const { fn, resolve, reject } = queue.shift();
    fn()
      .then(resolve, reject)
      .finally(() => {
        active -= 1;
        next();
      });
  };
  return (fn) =>
    new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      next();
    });
}

export async function retry(fn, { tries = 3, baseMs = 400 } = {}) {
  let err;
  for (let i = 0; i < tries; i += 1) {
    try {
      return await fn();
    } catch (e) {
      err = e;
      const status = e?.status ?? 0;
      if (status && status !== 429 && status < 500) throw e;
      await new Promise((r) => setTimeout(r, baseMs * 2 ** i + Math.random() * 200));
    }
  }
  throw err;
}

export function timeoutSignal(ms) {
  const c = new AbortController();
  const id = setTimeout(() => c.abort(new Error('timeout')), ms);
  return { signal: c.signal, done: () => clearTimeout(id) };
}
