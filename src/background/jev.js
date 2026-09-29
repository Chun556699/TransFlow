import { timeoutSignal } from './pool.js';

// Jev (TypeSafe AI SystemOne) — non-generative decision model.
// POST {baseUrl} { state, questions: {key: {type: choice|score|noul, ...}} }
// -> per-question typed answers evaluated in parallel against shared state.
export class JevClient {
  constructor({ baseUrl, apiKey, timeoutMs = 2500 }) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
  }

  async decide(state, questions) {
    const { signal, done } = timeoutSignal(this.timeoutMs);
    try {
      const res = await fetch(this.baseUrl, {
        method: 'POST',
        signal,
        headers: {
          'content-type': 'application/json',
          ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify({ model: 'jev-latest', state, questions }),
      });
      if (!res.ok) {
        const e = new Error(`jev ${res.status}`);
        e.status = res.status;
        throw e;
      }
      const json = await res.json();
      return json.results ?? json.answers ?? json;
    } finally {
      done();
    }
  }

  // One noul question per item, all evaluated in parallel over shared state.
  async gate(items, targetLang) {
    const questions = {};
    items.forEach((it, i) => {
      questions[`g${i}`] = {
        type: 'noul',
        instructions:
          `state.items[${i}].t is a text fragment extracted from a web page. ` +
          `Answer yes only if it is meaningful natural-language prose worth translating into ${targetLang}: ` +
          'no for navigation, buttons, code, filenames, numbers-only strings, boilerplate, ' +
          `or text already written in ${targetLang}.`,
        true: 'worth translating',
        false: 'skip',
      };
    });
    const out = await this.decide({ items: items.map((it, i) => ({ i, t: it.text })) }, questions);
    return items.map((_, i) => noulOf(out?.[`g${i}`]));
  }
}

function noulOf(r) {
  if (r == null) return null;
  if (typeof r === 'number') return r;
  return r.noul ?? r.p ?? r.prob ?? r.answer ?? null;
}
