import { sendMessage } from '../shared/browser.js';
import { MSG } from '../shared/constants.js';
import { isTranslatableText } from '../shared/lang-detect.js';
import {
  collectBlocks,
  insertTranslation,
  clearTranslations,
  resetProcessed,
  segmentCount,
} from './dom-scan.js';

const FLUSH_COUNT = 20;
const FLUSH_MS = 280;

export class PageTranslator {
  constructor() {
    this.enabled = false;
    this.targetLang = 'zh-CN';
    this.stats = { queued: 0, done: 0, failed: 0, cached: 0, jevSkipped: 0 };
    this.queue = new Map();
    this.batch = [];
    this.flushTimer = 0;
    this.moTimer = 0;
    this.scanRoots = new Set();
    this.seq = 0;
    this.onStats = null;

    this.io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          this.io.unobserve(e.target);
          this.enqueue(e.target);
        }
      },
      { rootMargin: '0px 0px 600px' },
    );

    this.mo = new MutationObserver((muts) => this.onMutate(muts));
  }

  start(targetLang) {
    this.targetLang = targetLang;
    this.enabled = true;
    document.body.dataset.tfActive = '1';
    this.scan(document);
    this.mo.observe(document.body, { childList: true, subtree: true });
  }

  stop() {
    this.enabled = false;
    delete document.body.dataset.tfActive;
    this.mo.disconnect();
    this.io.disconnect();
    clearTimeout(this.flushTimer);
    clearTimeout(this.moTimer);
    this.queue.clear();
    clearTranslations();
    resetProcessed();
  }

  scan(root) {
    if (!this.enabled) return;
    const blocks = collectBlocks(root);
    for (const b of blocks) {
      if (!isTranslatableText(b.text)) continue;
      this.io.observe(b.el);
      this.queue.set(b.el, b);
    }
  }

  onMutate(muts) {
    for (const m of muts) {
      for (const node of m.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        if (node.classList?.contains('tf-translation')) continue;
        this.scanRoots.add(node);
      }
    }
    clearTimeout(this.moTimer);
    this.moTimer = setTimeout(() => {
      const roots = [...this.scanRoots];
      this.scanRoots.clear();
      for (const r of roots) {
        if (r.isConnected) this.scan(r);
      }
    }, 300);
  }

  enqueue(el) {
    const item = this.queue.get(el);
    if (!item) return;
    this.queue.delete(el);
    const key = `k${this.seq++}`;
    item.key = key;
    el.classList.add('tf-pending');
    this.batch.push(item);
    this.stats.queued += 1;
    if (this.batch.length >= FLUSH_COUNT) this.flush();
    else if (!this.flushTimer) this.flushTimer = setTimeout(() => this.flush(), FLUSH_MS);
  }

  async flush() {
    clearTimeout(this.flushTimer);
    this.flushTimer = 0;
    const items = this.batch.splice(0);
    if (!items.length || !this.enabled) return;
    let resp;
    try {
      resp = await sendMessage({
        type: MSG.TRANSLATE,
        to: this.targetLang,
        items: items.map((i) => ({ key: i.key, text: i.text })),
      });
    } catch {
      resp = null;
    }
    const results = resp?.results ?? {};
    const meta = resp?.meta ?? {};
    this.stats.cached += meta.cached ?? 0;
    this.stats.jevSkipped += meta.jevSkipped ?? 0;
    for (const it of items) {
      it.el.classList.remove('tf-pending');
      const text = results[it.key];
      if (text) {
        insertTranslation(it.el, text);
        this.stats.done += 1;
      } else {
        this.stats.failed += 1;
      }
    }
    this.onStats?.();
  }

  get state() {
    return {
      enabled: this.enabled,
      targetLang: this.targetLang,
      stats: this.stats,
      rendered: segmentCount(),
    };
  }
}
