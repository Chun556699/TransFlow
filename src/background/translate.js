import { cache, hash } from './cache.js';
import { makePool } from './pool.js';
import { JevClient } from './jev.js';
import { LlmClient } from './llm.js';
import { guessLang, sameLang, isTranslatableText } from '../shared/lang-detect.js';

const SKIPPED = Symbol('skipped');

export async function translateItems(items, targetLang, settings) {
  const out = {};
  const meta = { cached: 0, jevSkipped: 0, failed: 0, translated: 0 };

  const pending = items.filter((it) => {
    if (!isTranslatableText(it.text)) {
      out[it.key] = null;
      return false;
    }
    const src = guessLang(it.text);
    if (sameLang(src, targetLang)) {
      out[it.key] = null;
      return false;
    }
    it._src = src;
    return true;
  });
  if (!pending.length) return { results: out, meta };

  const keys = await Promise.all(
    pending.map((it) => hash(`${settings.llm.model}|${it._src}|${targetLang}|${it.text}`)),
  );
  const hit = await cache.getMany(keys);
  const rest = [];
  pending.forEach((it, i) => {
    const v = hit[i]?.v;
    if (v != null) {
      out[it.key] = v;
      meta.cached += 1;
    } else {
      it._ck = keys[i];
      rest.push(it);
    }
  });
  if (!rest.length) return { results: out, meta };

  const gated = await jevGate(rest, targetLang, settings);
  const toTranslate = rest.filter((it, i) => {
    if (gated[i] === SKIPPED) {
      out[it.key] = null;
      meta.jevSkipped += 1;
      return false;
    }
    return true;
  });

  if (toTranslate.length) {
    const llm = new LlmClient({
      baseUrl: settings.llm.baseUrl,
      apiKey: settings.llm.apiKey,
      model: settings.llm.model,
      temperature: settings.llm.temperature,
      glossary: settings.pipeline.glossary,
    });
    const pool = makePool(settings.pipeline.concurrency);
    const batches = chunkBySize(toTranslate, settings.pipeline.batchSize, settings.pipeline.maxChars);
    await Promise.all(
      batches.map((batch) =>
        pool(async () => {
          let arr;
          try {
            arr = await llm.translate(batch.map((b) => b.text), targetLang);
          } catch {
            arr = await perItem(llm, batch, targetLang);
          }
          batch.forEach((b, i) => {
            const v = arr[i];
            if (v) {
              out[b.key] = v;
              meta.translated += 1;
              void cache.set(b._ck, v);
            } else {
              out[b.key] = null;
              meta.failed += 1;
            }
          });
        }),
      ),
    );
  }

  void cache.trim();
  return { results: out, meta };
}

async function perItem(llm, batch, targetLang) {
  return Promise.all(
    batch.map(async (b) => {
      try {
        const r = await llm.translate([b.text], targetLang);
        return r[0];
      } catch {
        return null;
      }
    }),
  );
}

async function jevGate(items, targetLang, settings) {
  if (!settings.jev.enabled || !settings.jev.gate || !settings.jev.baseUrl) {
    return items.map(() => true);
  }
  const jev = new JevClient({
    baseUrl: settings.jev.baseUrl,
    apiKey: settings.jev.apiKey,
    timeoutMs: settings.jev.timeoutMs,
  });
  const marks = new Array(items.length).fill(true);
  for (let i = 0; i < items.length; i += 100) {
    const slice = items.slice(i, i + 100);
    try {
      const ps = await jev.gate(slice, targetLang);
      ps.forEach((p, j) => {
        if (p !== null && p < 0.5) marks[i + j] = SKIPPED;
      });
    } catch {
      /* fail-open: Jev 不可用时全部放行 */
    }
  }
  return marks;
}

function chunkBySize(items, count, maxChars) {
  const batches = [];
  let cur = [];
  let chars = 0;
  for (const it of items) {
    if (cur.length >= count || (cur.length && chars + it.text.length > maxChars)) {
      batches.push(cur);
      cur = [];
      chars = 0;
    }
    cur.push(it);
    chars += it.text.length;
  }
  if (cur.length) batches.push(cur);
  return batches;
}
