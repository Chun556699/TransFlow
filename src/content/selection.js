import { sendMessage } from '../shared/browser.js';
import { MSG } from '../shared/constants.js';
import { isTranslatableText, pairTarget } from '../shared/lang-detect.js';

// 划词翻译 + 输入框翻译：Shadow DOM 浮层，不与页面 CSS 互相影响
const CSS = `
  * { box-sizing: border-box; margin: 0; font: 13px/1.6 -apple-system, 'PingFang SC', 'Segoe UI', sans-serif; }
  #icon, #input-icon {
    position: fixed; z-index: 2147483646; width: 26px; height: 26px; border-radius: 8px;
    border: none; cursor: pointer; display: none; align-items: center; justify-content: center;
    background: linear-gradient(135deg, #4f7cff, #7b5cff); color: #fff; font-weight: 700; font-size: 14px;
    box-shadow: 0 4px 14px rgba(79, 124, 255, .45); transition: transform .12s;
  }
  #icon:hover, #input-icon:hover { transform: scale(1.12); }
  #panel {
    position: fixed; z-index: 2147483646; display: none; width: 380px; max-width: 90vw;
    background: #fff; border-radius: 12px; overflow: hidden;
    box-shadow: 0 12px 40px rgba(20, 30, 60, .22), 0 0 0 1px rgba(20, 30, 60, .06);
  }
  #panel .hd { display: flex; align-items: center; justify-content: space-between;
    padding: 8px 12px; background: linear-gradient(135deg, #4f7cff, #7b5cff); color: #fff; }
  #panel .hd b { font-size: 12px; letter-spacing: .08em; }
  #panel .hd button { background: none; border: none; color: #fff; opacity: .8; cursor: pointer; font-size: 14px; }
  #panel .src { max-height: 110px; overflow: auto; padding: 10px 12px; color: #5a6472; font-size: 12px;
    border-bottom: 1px dashed #e4e8f0; }
  #panel .tgt { padding: 12px; font-size: 14px; color: #1a2233; min-height: 38px; }
  #panel .tgt.loading { color: #98a2b3; }
  #panel .tgt.error { color: #d92d20; }
  #panel .ft { display: flex; gap: 8px; padding: 0 12px 12px; }
  #panel .ft button { padding: 5px 12px; border-radius: 7px; border: 1px solid #d9dfeb; background: #fff;
    color: #3a4556; cursor: pointer; font-size: 12px; }
  #panel .ft button.primary { background: linear-gradient(135deg, #4f7cff, #7b5cff); color: #fff; border: none; }
  @media (prefers-color-scheme: dark) {
    #panel { background: #1c2333; box-shadow: 0 12px 40px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.08); }
    #panel .src { color: #9aa4b8; border-bottom-color: #2c3548; }
    #panel .tgt { color: #e8ecf4; }
    #panel .ft button { background: #232b3d; border-color: #3a4357; color: #c9d2e3; }
  }
`;

const HTML = `
  <button id="icon" title="翻译选中内容">译</button>
  <button id="input-icon" title="翻译输入内容">译</button>
  <div id="panel">
    <div class="hd"><b>TRANSFLOW</b><button id="close">✕</button></div>
    <div class="src"></div>
    <div class="tgt">翻译中…</div>
    <div class="ft">
      <button id="replace" class="primary" style="display:none">替换输入</button>
      <button id="copy">复制译文</button>
    </div>
  </div>
`;

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
      };
      this.el.icon.addEventListener('mousedown', (e) => e.preventDefault());
      this.el.icon.addEventListener('click', () => this.translateSel());
      this.el.inputIcon.addEventListener('mousedown', (e) => e.preventDefault());
      this.el.inputIcon.addEventListener('click', () => this.translateInput());
      this.el.close.addEventListener('click', () => this.hideAll());
      this.el.copy.addEventListener('click', () => {
        void navigator.clipboard?.writeText(this.el.tgt.textContent ?? '');
        this.el.copy.textContent = '已复制 ✓';
        setTimeout(() => (this.el.copy.textContent = '复制译文'), 1200);
      });
      this.el.replace.addEventListener('click', () => this.replaceInput());
    }
    return this.el;
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
    el.tgt.textContent = '翻译中…';
    el.tgt.className = 'tgt loading';
    el.replace.style.display = forInput ? '' : 'none';
    el.panel.style.display = 'block';
    const pw = el.panel.offsetWidth || 380;
    const ph = el.panel.offsetHeight || 200;
    const x = rect ? Math.min(rect.left, Math.max(8, innerWidth - pw - 12)) : (innerWidth - pw) / 2;
    const y = rect ? Math.min(rect.bottom + 8, Math.max(8, innerHeight - ph - 12)) : (innerHeight - ph) / 3;
    el.panel.style.left = `${x}px`;
    el.panel.style.top = `${y}px`;
    try {
      const resp = await sendMessage({
        type: MSG.TRANSLATE,
        to: pairTarget(text, this.settings.targetLang),
        items: [{ key: 's', text }],
      });
      const t = resp?.results?.s;
      if (!t) throw new Error(resp?.error || 'empty');
      el.tgt.textContent = t;
      el.tgt.className = 'tgt';
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
