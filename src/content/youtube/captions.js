// YouTube timedtext 响应解析：json3 与 srv3/xml 两种格式 → 统一 cue 列表
export function parseCaptions(body) {
  if (!body) return [];
  const s = body.trim();
  if (s.startsWith('{')) return parseJson3(s);
  if (s.startsWith('<')) return parseXml(s);
  return [];
}

function parseJson3(s) {
  try {
    const json = JSON.parse(s);
    const events = json.events ?? [];
    const cues = [];
    for (const ev of events) {
      const start = ev.tStartMs ?? 0;
      const dur = ev.dDurationMs ?? ev.tDurationMs ?? 0;
      const text = (ev.segs ?? [])
        .map((seg) => seg.utf8 ?? '')
        .join('')
        .replace(/\n/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (text) cues.push({ start, end: start + dur, text });
    }
    return cues;
  } catch {
    return [];
  }
}

function parseXml(s) {
  try {
    const doc = new DOMParser().parseFromString(s, 'text/xml');
    const cues = [];
    // srv1: <text start="s" dur="s">；srv3: <p t="ms" d="ms">（子 <s> 逐词）
    for (const el of doc.querySelectorAll('text')) {
      const start = Number(el.getAttribute('start') ?? 0) * 1000;
      const dur = Number(el.getAttribute('dur') ?? 0) * 1000;
      const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (text) cues.push({ start, end: start + dur, text });
    }
    for (const el of doc.querySelectorAll('p')) {
      const start = Number(el.getAttribute('t') ?? 0);
      const dur = Number(el.getAttribute('d') ?? 0);
      const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (text) cues.push({ start, end: start + dur, text });
    }
    return cues.sort((a, b) => a.start - b.start);
  } catch {
    return [];
  }
}

const SENT_END = /[.!?。！？…：；:;]["'”’）)\]]?\s*$/;

// ASR 自动字幕是逐词碎片：按时长间隙/句末标点/长度上限合并成句
export function mergeSentences(cues, { gapMs = 900, maxLen = 140 } = {}) {
  const merged = [];
  let cur = null;
  for (const c of cues) {
    if (
      cur &&
      (c.start - cur.end > gapMs ||
        cur.text.length + c.text.length > maxLen ||
        SENT_END.test(cur.text))
    ) {
      merged.push(cur);
      cur = null;
    }
    if (!cur) {
      cur = { start: c.start, end: c.end, text: c.text };
    } else {
      cur.end = c.end;
      cur.text += ' ' + c.text;
    }
  }
  if (cur) merged.push(cur);
  return merged.map((m) => ({ ...m, text: m.text.trim() }));
}

export function trackKey(url) {
  try {
    const u = new URL(url);
    const p = u.searchParams;
    return [p.get('v'), p.get('lang'), p.get('kind') ?? '', p.get('tlang') ?? ''].join('|');
  } catch {
    return url;
  }
}
