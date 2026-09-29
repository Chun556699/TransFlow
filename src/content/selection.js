import { sendMessage } from '../shared/browser.js';
import { MSG } from '../shared/constants.js';
import { guessLang, isTranslatableText, pairTarget } from '../shared/lang-detect.js';

// 划词翻译 + 输入框翻译：Shadow DOM 浮层，不与页面 CSS 互相影响
const CSS = `
  :host { all: initial; --ff: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', 'Segoe UI', sans-serif; }
  * { box-sizing: border-box; margin: 0; font-family: var(--ff); }
  #icon, #input-icon {
    position: fixed; z-index: 2147483646; width: 28px; height: 28px; border-radius: 9px;
    border: none; cursor: pointer; display: none; align-items: center; justify-content: center;
    background: linear-gradient(135deg, #4f7cff, #7b5cff); color: #fff; font: 700 14px/1 var(--ff);
    box-shadow: 0 6px 16px rgba(79, 124, 255, .4), inset 0 1px 0 rgba(255,255,255,.25);
    transition: transform .15s cubic-bezier(.3,1.6,.6,1);
  }
  #icon:hover, #input-icon:hover { transform: translateY(-1px) scale(1.08); }
  #panel {
    --ac: #5b6cff; --fg: #141a2b; --mut: #7a8399; --line: rgba(20, 30, 60, .07); --bg: rgba(255,255,255,.97);
    position: fixed; z-index: 2147483646; display: none; width: 400px; max-width: calc(100vw - 16px);
    background: var(--bg); backdrop-filter: blur(18px) saturate(1.6); -webkit-backdrop-filter: blur(18px) saturate(1.6);
    border-radius: 16px; overflow: hidden; color: var(--fg);
    box-shadow: 0 24px 60px -12px rgba(28, 38, 90, .28), 0 0 0 1px var(--line);
    animation: tf-in .18s cubic-bezier(.2,.9,.3,1.2);
  }
  #panel::before { content: ''; position: absolute; inset: 0 0 auto; height: 3px;
    background: linear-gradient(90deg, #4f7cff, #7b5cff, #c35cff); }
  @keyframes tf-in { from { opacity: 0; transform: translateY(6px) scale(.98); } }
  .hd { display: flex; align-items: center; gap: 10px; padding: 14px 14px 10px 16px; }
  .logo { width: 22px; height: 22px; border-radius: 7px; display: grid; place-items: center; flex: none;
    background: linear-gradient(135deg, #4f7cff, #7b5cff); color: #fff; font: 700 12px/1 var(--ff); }
  .dir { display: flex; align-items: center; gap: 6px; font: 600 12px/1 var(--ff); color: var(--fg); }
  .dir .arr { color: var(--ac); font-weight: 700; }
  .dir span { padding: 5px 9px; border-radius: 999px; background: rgba(91, 108, 255, .08); }
  .sp { flex: 1; }
  .ib { width: 28px; height: 28px; border-radius: 8px; border: none; background: transparent; color: var(--mut);
    cursor: pointer; display: grid; place-items: center; transition: background .12s, color .12s; }
  .ib:hover { background: rgba(20, 30, 60, .06); color: var(--fg); }
  .ib svg { width: 15px; height: 15px; }
  .src { margin: 0 16px; padding: 2px 0 2px 12px; border-left: 2px solid rgba(91,108,255,.25);
    max-height: 96px; overflow: auto; color: var(--mut); font: 400 12.5px/1.65 var(--ff); white-space: pre-wrap; }
  .tgt { padding: 14px 16px 6px; min-height: 44px; max-height: 280px; overflow: auto;
    font: 500 15px/1.7 var(--ff); color: var(--fg); white-space: pre-wrap; word-break: break-word; }
  .tgt.loading { color: transparent; position: relative; }
  .tgt.loading::before, .tgt.loading::after { content: ''; position: absolute; left: 16px; height: 10px; border-radius: 5px;
    background: linear-gradient(90deg, #eef0f6 25%, #dfe3f0 50%, #eef0f6 75%); background-size: 200% 100%;
    animation: tf-sh 1.1s linear infinite; }
  .tgt.loading::before { top: 18px; right: 16px; }
  .tgt.loading::after { top: 36px; right: 40%; }
  @keyframes tf-sh { to { background-position: -200% 0; } }
  .tgt.error { color: #e0413b; font-size: 13px; }
  .ft { display: flex; align-items: center; gap: 8px; padding: 10px 12px 12px 16px; }
  .ft .meta { font: 11px/1 var(--ff); color: var(--mut); letter-spacing: .02em; }
  .ft .btn { height: 30px; padding: 0 12px; border-radius: 9px; border: 1px solid var(--line); background: rgba(255,255,255,.7);
    color: var(--fg); cursor: pointer; font: 500 12px/1 var(--ff); display: inline-flex; align-items: center; gap: 6px;
    transition: all .12s; }
  .ft .btn:hover { border-color: rgba(91,108,255,.4); color: var(--ac); }
  .ft .btn svg { width: 13px; height: 13px; }
  .ft .btn.primary { border: none; color: #fff; background: linear-gradient(135deg, #4f7cff, #7b5cff);
    box-shadow: 0 4px 12px rgba(91,108,255,.35); }
  .ft .btn.primary:hover { color: #fff; filter: brightness(1.07); }
  .ft .btn.done { color: #1f9d63; border-color: rgba(31,157,99,.35); }
  @media (prefers-color-scheme: dark) {
    #panel { --fg: #eef1f8; --mut: #9aa3b8; --line: rgba(255,255,255,.09); --bg: rgba(28, 33, 48, .97);
      box-shadow: 0 24px 60px -12px rgba(0,0,0,.6), 0 0 0 1px var(--line); }
    .dir span { background: rgba(123, 140, 255, .16); }
    .ib:hover { background: rgba(255,255,255,.08); }
    .ft .btn { background: rgba(255,255,255,.04); }
    .tgt.loading::before, .tgt.loading::after { background: linear-gradient(90deg, #2a3146 25%, #353d56 50%, #2a3146 75%); background-size: 200% 100%; }
  }
`;

const I_COPY =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>';
const I_SWAP =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h13M13 6l6 6-6 6"/></svg>';
const I_CLOSE =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';

const HTML = `
  <button id="icon" title="翻译选中内容">译</button>
  <button id="input-icon" title="翻译输入内容">译</button>
  <div id="panel" role="dialog" aria-label="TransFlow 翻译">
    <div class="hd">
      <div class="logo">译</div>
      <div class="dir"><span id="from">自动</span><b class="arr">→</b><span id="to">中文</span></div>
      <div class="sp"></div>
      <button id="close" class="ib" title="关闭 (Esc)">${I_CLOSE}</button>
    </div>
    <div class="src"></div>
    <div class="tgt">翻译中…</div>
    <div class="ft">
      <span class="meta">TransFlow</span>
      <div class="sp"></div>
      <button id="copy" class="btn">${I_COPY}<span>复制</span></button>
      <button id="replace" class="btn primary" style="display:none">${I_SWAP}<span>替换输入</span></button>
    </div>
  </div>
`;

const LANG_NAME = {
  'zh-CN': '中文', 'zh-TW': '繁中', en: 'English', ja: '日本語', ko: '한국어', fr: 'Français', de: 'Deutsch',
  es: 'Español', ru: 'Русский', pt: 'Português', it: 'Italiano', th: 'ไทย', vi: 'Tiếng Việt', ar: 'العربية', hi: 'हिन्दी',
};
const langName = (c) => LANG_NAME[c] ?? LANG_NAME[c?.split('-')[0]] ?? '自动';

const MAX_LEN = 4800;

export class SelectionTranslator {
  constructor(settings) {
    this.settings = settings;
    this.host = null;
    this.el = null;
    this.inputEl = null;
    this.onMouseUp = (e) => this.handleMouseUp(e);
    this.onFocusIn = (e) => this.handleFocusIn(e);
    this.onDocDown = (e) => this.handleDocDown(e);
    this.onKey = (e) => {
      if (e.key === 'Escape') this.hideAll();
    };
  }

  start() {
    document.addEventListener('mouseup', this.onMouseUp, true);
    document.addEventListener('focusin', this.onFocusIn, true);
    document.addEventListener('mousedown', this.onDocDown, true);
    document.addEventListener('keydown', this.onKey, true);
  }

  stop() {
    document.removeEventListener('mouseup', this.onMouseUp, true);
    document.removeEventListener('focusin', this.onFocusIn, true);
    document.removeEventListener('mousedown', this.onDocDown, true);
    document.removeEventListener('keydown', this.onKey, true);
    this.host?.remove();
    this.host = null;
    this.el = null;
  }

  root() {
    if (!this.host) {
      this.host = document.createElement('div');
      this.host.id = 'tf-sel-host';
      const shadow = this.host.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      style.textContent = CSS;
      shadow.append(style);
      const wrap = document.createElement('div');
      wrap.innerHTML = HTML;
      shadow.append(wrap);
      document.documentElement.append(this.host);
      this.el = {
        icon: shadow.getElementById('icon'),
        inputIcon: shadow.getElementById('input-icon'),
        panel: shadow.getElementById('panel'),
        src: shadow.querySelector('.src'),
        tgt: shadow.querySelector('.tgt'),
        replace: shadow.getElementById('replace'),
        copy: shadow.getElementById('copy'),
        close: shadow.getElementById('close'),
        from: shadow.getElementById('from'),
        to: shadow.getElementById('to'),
        meta: shadow.querySelector('.meta'),
      };
      this.el.icon.addEventListener('mousedown', (e) => e.preventDefault());
      this.el.icon.addEventListener('click', () => this.translateSel());
      this.el.inputIcon.addEventListener('mousedown', (e) => e.preventDefault());
      this.el.inputIcon.addEventListener('click', () => this.translateInput());
      this.el.close.addEventListener('click', () => this.hideAll());
      this.el.hd = shadow.querySelector('.hd');
      this.bindDrag();
      this.el.copy.addEventListener('click', () => {
        void navigator.clipboard?.writeText(this.el.tgt.textContent ?? '');
        const label = this.el.copy.querySelector('span');
        label.textContent = '已复制';
        this.el.copy.classList.add('done');
        setTimeout(() => {
          label.textContent = '复制';
          this.el.copy.classList.remove('done');
        }, 1200);
      });
      this.el.replace.addEventListener('click', () => this.replaceInput());
    }
    return this.el;
  }

  bindDrag() {
    const hd = this.el.hd;
    const panel = this.el.panel;
    hd.style.cursor = 'move';
    let dx = 0;
    let dy = 0;
    const move = (e) => {
      const w = panel.offsetWidth;
      const h = panel.offsetHeight;
      panel.style.left = `${Math.max(0, Math.min(e.clientX - dx, innerWidth - w))}px`;
      panel.style.top = `${Math.max(0, Math.min(e.clientY - dy, innerHeight - h))}px`;
    };
    const up = () => {
      document.removeEventListener('mousemove', move, true);
      document.removeEventListener('mouseup', up, true);
    };
    hd.addEventListener('mousedown', (e) => {
      if (e.target.closest('button')) return;
      const r = panel.getBoundingClientRect();
      dx = e.clientX - r.left;
      dy = e.clientY - r.top;
      e.preventDefault();
      document.addEventListener('mousemove', move, true);
      document.addEventListener('mouseup', up, true);
    });
  }

  selectionText() {
    const s = getSelection();
    if (!s || s.isCollapsed) return '';
    return s.toString().trim();
  }

  inInput(node) {
    const el = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
    return !!el?.closest?.('input, textarea, [contenteditable=""], [contenteditable="true"]');
  }

  handleMouseUp(e) {
    this.root();
    if (e.composedPath?.().includes(this.host)) return;
    if (this.inInput(e.target)) return;
    const text = this.selectionText();
    if (text.length < 2 || !isTranslatableText(text)) {
      this.el.icon.style.display = 'none';
      return;
    }
    const rect = getSelection().getRangeAt(0).getBoundingClientRect();
    if (!rect.width && !rect.height) return;
    this.show(this.el.icon, rect.right + 6, rect.bottom + 6);
  }

  handleFocusIn(e) {
    if (this.settings.selection?.inputEnabled === false) return;
    this.root();
    const t = e.target;
    const isEditable =
      t instanceof HTMLTextAreaElement ||
      (t instanceof HTMLInputElement && /^(text|search|url|email|tel)$/i.test(t.type ?? 'text')) ||
      t?.isContentEditable;
    if (!isEditable) return;
    this.inputEl = t;
    const r = t.getBoundingClientRect();
    this.show(this.el.inputIcon, r.right - 30, r.bottom + 4);
    // 失焦后图标自动收起（点击图标时 preventDefault 会保留焦点）
    t.addEventListener('focusout', () => setTimeout(() => (this.el.inputIcon.style.display = 'none'), 180), {
      once: true,
    });
  }

  handleDocDown(e) {
    if (!this.host || e.composedPath?.().includes(this.host)) return;
    this.hideAll();
  }

  show(el, x, y) {
    el.style.display = 'flex';
    const w = el.offsetWidth || 26;
    el.style.left = `${Math.min(x, innerWidth - w - 8)}px`;
    el.style.top = `${Math.min(y, innerHeight - 30)}px`;
  }

  async translateSel() {
    const text = this.selectionText();
    this.el.icon.style.display = 'none';
    if (!text) return;
    const rect = getSelection()?.rangeCount ? getSelection().getRangeAt(0).getBoundingClientRect() : null;
    await this.run(text, rect, false);
  }

  async translateInput() {
    const el = this.inputEl;
    this.el.inputIcon.style.display = 'none';
    if (!el) return;
    const text = (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
      ? el.value
      : el.textContent
    )?.trim();
    if (!text) return;
    await this.run(text, el.getBoundingClientRect(), true);
  }

  // 右键菜单/快捷键入口：优先划词，其次聚焦的输入框
  async translateContext() {
    const text = this.selectionText();
    if (text.length >= 2 && !this.inInput(getSelection()?.anchorNode)) {
      return this.translateSel();
    }
    const ae = document.activeElement;
    if (ae && (ae instanceof HTMLTextAreaElement || ae instanceof HTMLInputElement || ae.isContentEditable)) {
      this.inputEl = ae;
      return this.translateInput();
    }
  }

  async run(rawText, rect, forInput) {
    const el = this.root();
    const text = rawText.slice(0, MAX_LEN);
    el.src.textContent = text.length > 600 ? `${text.slice(0, 600)}…` : text;
    const to = pairTarget(text, this.settings.targetLang);
    el.from.textContent = langName(guessLang(text));
    el.to.textContent = langName(to);
    el.meta.textContent = 'TransFlow';
    el.tgt.textContent = '翻译中…';
    el.tgt.className = 'tgt loading';
    el.replace.style.display = forInput ? '' : 'none';
    el.panel.style.display = 'block';
    const pw = el.panel.offsetWidth || 400;
    const ph = el.panel.offsetHeight || 200;
    const x = rect ? Math.min(rect.left, Math.max(8, innerWidth - pw - 12)) : (innerWidth - pw) / 2;
    const y = rect ? Math.min(rect.bottom + 8, Math.max(8, innerHeight - ph - 12)) : (innerHeight - ph) / 3;
    el.panel.style.left = `${x}px`;
    el.panel.style.top = `${y}px`;
    const t0 = performance.now();
    try {
      const resp = await sendMessage({
        type: MSG.TRANSLATE,
        to,
        items: [{ key: 's', text }],
      });
      const t = resp?.results?.s;
      if (!t) throw new Error(resp?.error || 'empty');
      el.tgt.textContent = t;
      el.tgt.className = 'tgt';
      const sec = (performance.now() - t0) / 1000;
      el.meta.textContent = sec < 0.1 ? 'TransFlow · 缓存' : `TransFlow · ${sec.toFixed(1)}s`;
    } catch {
      el.tgt.textContent = '翻译失败，请检查模型端点配置';
      el.tgt.className = 'tgt error';
    }
  }

  replaceInput() {
    const el = this.inputEl;
    const t = this.el.tgt.textContent;
    if (!el || !t || this.el.tgt.classList.contains('loading')) return;
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      el.value = t;
    } else if (el.isContentEditable) {
      el.textContent = t;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.focus();
    this.hideAll();
  }

  hideAll() {
    if (!this.el) return;
    this.el.icon.style.display = 'none';
    this.el.inputIcon.style.display = 'none';
    this.el.panel.style.display = 'none';
  }
}
