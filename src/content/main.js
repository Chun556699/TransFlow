import { api } from '../shared/browser.js';
import { MSG } from '../shared/constants.js';
import { loadSettings, matchHost } from '../shared/settings.js';
import { loadSubOn } from './youtube/video-button.js';
import { PageTranslator } from './translator.js';
import { YoutubeSubs } from './youtube/index.js';
import { SelectionTranslator } from './selection.js';
import cssText from './styles.css';

let translator = null;
let subs = null;
let sel = null;
let settings = null;
const isTop = window === window.top;

function injectStyles() {
  let el = document.getElementById('tf-styles');
  if (!el) {
    el = document.createElement('style');
    el.id = 'tf-styles';
    document.documentElement.append(el);
  }
  el.textContent = cssText + '\n' + (settings?.appearance.customCss ?? '');
}

// DOM 未就绪时挂一次监听；applyAppearance 需要 body
function ensureBody(fn) {
  if (document.body) return fn();
  document.addEventListener('DOMContentLoaded', fn, { once: true });
}

function applyAppearance() {
  if (!document.body) return;
  const a = settings.appearance;
  document.body.dataset.tfTheme = a.theme;
  document.body.dataset.tfOnly = a.translationOnly ? '1' : '0';
  document.documentElement.style.setProperty('--tf-accent', a.accent);
  document.documentElement.style.setProperty('--tf-scale', String(a.fontScale));
}

// 设置热更新：改完不必刷新页面
function onSettingsChanged(prev, next) {
  settings = next;
  injectStyles();
  ensureBody(applyAppearance);
  if (prev.targetLang !== next.targetLang && translator?.enabled) {
    translator.stop();
    ensureBody(() => translator.start(next.targetLang));
  }
  if (isTop && subs) {
    subs.settings = settings;
    subs.overlay.updateSettings(next.subtitle);
    void loadSubOn(next.subtitle.enabled).then((v) => subs.toggle(v));
  }
  const wantSel = next.selection?.enabled !== false;
  if (isTop && wantSel && !sel) {
    sel = new SelectionTranslator(next);
    sel.start();
  } else if (isTop && !wantSel && sel) {
    sel.stop();
    sel = null;
  } else if (sel) {
    sel.settings = next;
  }
}

api.storage.onChanged?.addListener((changes, area) => {
  if (area !== 'local' || !changes.settings?.newValue) return;
  const prev = settings;
  settings = { ...settings, ...changes.settings.newValue };
  if (prev) onSettingsChanged(prev, settings);
});

async function togglePage(force) {
  const enable = force ?? !translator.enabled;
  if (enable) {
    applyAppearance();
    translator.start(settings.targetLang);
  } else {
    translator.stop();
  }
  return translator.state;
}

async function boot() {
  settings = await loadSettings();
  injectStyles();

  const host = location.hostname;
  translator = new PageTranslator();
  translator.onStats = () => {};

  if (
    matchHost(host, settings.autoTranslateHosts) &&
    !matchHost(host, settings.neverTranslateHosts)
  ) {
    const autoStart = () => {
      applyAppearance();
      translator.start(settings.targetLang);
    };
    // 文档加载极慢的页面兜底：5s 后仍未自动翻译则直接启动
    setTimeout(() => {
      if (!translator.enabled && matchHost(location.hostname, settings.autoTranslateHosts) && !matchHost(location.hostname, settings.neverTranslateHosts)) autoStart();
    }, 5000);
    document.readyState === 'loading'
      ? document.addEventListener('DOMContentLoaded', autoStart, { once: true })
      : autoStart();
  }

  if (isTop) {
    subs = new YoutubeSubs(settings);
    const startSubs = () => subs.start();
    document.readyState === 'loading'
      ? document.addEventListener('DOMContentLoaded', startSubs, { once: true })
      : startSubs();
  }

  if (isTop && settings.selection?.enabled !== false) {
    sel = new SelectionTranslator(settings);
    const startSel = () => sel.start();
    document.readyState === 'loading'
      ? document.addEventListener('DOMContentLoaded', startSel, { once: true })
      : startSel();
  }
}

api.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || typeof msg !== 'object') return false;
  if (msg.type === MSG.TOGGLE_PAGE) {
    togglePage(msg.force).then(sendResponse);
    return true;
  }
  if (msg.type === MSG.SET_LANG) {
    settings.targetLang = msg.lang;
    if (translator.enabled) {
      translator.stop();
      applyAppearance();
      translator.start(settings.targetLang);
    }
    sendResponse(translator.state);
    return false;
  }
  if (msg.type === MSG.PAGE_STATE) {
    if (!isTop) return false; // 多 frame 时只由顶层页汇报状态
    sendResponse(translator?.state ?? { enabled: false });
    return false;
  }
  if (msg.type === MSG.TRANSLATE_SELECTION) {
    if (!isTop) return false;
    void sel?.translateContext();
    sendResponse({ ok: true });
    return false;
  }
  return false;
});

void boot();
