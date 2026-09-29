import { api } from '../shared/browser.js';
import { MSG } from '../shared/constants.js';
import { loadSettings, matchHost } from '../shared/settings.js';
import { PageTranslator } from './translator.js';
import { YoutubeSubs } from './youtube/index.js';
import { SelectionTranslator } from './selection.js';
import cssText from './styles.css';

let translator = null;
let subs = null;
let sel = null;
let settings = null;

function injectStyles() {
  if (document.getElementById('tf-styles')) return;
  const el = document.createElement('style');
  el.id = 'tf-styles';
  el.textContent = cssText + '\n' + (settings?.appearance.customCss ?? '');
  document.documentElement.append(el);
}

function applyAppearance() {
  const a = settings.appearance;
  document.body.dataset.tfTheme = a.theme;
  document.body.dataset.tfOnly = a.translationOnly ? '1' : '0';
  document.documentElement.style.setProperty('--tf-accent', a.accent);
  document.documentElement.style.setProperty('--tf-scale', String(a.fontScale));
}

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
    document.readyState === 'loading'
      ? document.addEventListener('DOMContentLoaded', autoStart, { once: true })
      : autoStart();
  }

  subs = new YoutubeSubs(settings);
  const startSubs = () => subs.start();
  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', startSubs, { once: true })
    : startSubs();

  if (settings.selection?.enabled !== false) {
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
    sendResponse(translator?.state ?? { enabled: false });
    return false;
  }
  if (msg.type === MSG.TRANSLATE_SELECTION) {
    void sel?.translateContext();
    sendResponse({ ok: true });
    return false;
  }
  return false;
});

void boot();
