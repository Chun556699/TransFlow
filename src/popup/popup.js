import { api, sendMessage, storageSet } from '../shared/browser.js';
import { MSG, LANGUAGES } from '../shared/constants.js';
import { loadSettings, matchHost } from '../shared/settings.js';

const $ = (s) => document.querySelector(s);
let tab = null;
let settings = null;
let restricted = false;

async function activeTab() {
  return new Promise((resolve) => {
    api.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs[0]));
  });
}

function toTab(msg) {
  return new Promise((resolve) => {
    try {
      api.tabs.sendMessage(tab.id, msg, (resp) => {
        void api.runtime.lastError;
        resolve(resp);
      });
    } catch {
      resolve(undefined);
    }
  });
}

async function refresh() {
  if (restricted) return;
  const state = await toTab({ type: MSG.PAGE_STATE });
  const enabled = state?.enabled ?? false;
  $('#toggle').classList.toggle('off', !enabled);
  $('#toggle-text').textContent = enabled ? '恢复原文' : '翻译此页';
  $('#status').textContent = enabled ? '翻译中' : '未开启';
  const st = state?.stats;
  $('#stats').textContent = st
    ? `已译 ${st.done} · 缓存 ${st.cached}${st.skipped ? ` · 过滤 ${st.skipped}` : ''}${st.jevSkipped ? ` · Jev过滤 ${st.jevSkipped}` : ''}${st.failed ? ` · 失败 ${st.failed}` : ''}`
    : '';
}

async function boot() {
  settings = await loadSettings();
  tab = await activeTab();

  const langSel = $('#lang');
  for (const [v, label] of LANGUAGES) {
    if (v === 'auto') continue;
    const o = document.createElement('option');
    o.value = v;
    o.textContent = label;
    langSel.append(o);
  }
  langSel.value = settings.targetLang;

  let host = '';
  try {
    host = new URL(tab?.url ?? '').hostname;
  } catch {
    host = '';
  }
  restricted = !host || !/^https?:/.test(tab?.url ?? '');
  if (restricted) {
    $('#toggle').disabled = true;
    $('#toggle-text').textContent = '此页面不可翻译';
    $('#autohost').disabled = true;
  }
  $('#autohost').checked = host ? matchHost(host, settings.autoTranslateHosts) : false;
  $('#subs').checked = settings.subtitle.enabled;

  $('#toggle').addEventListener('click', async () => {
    await toTab({ type: MSG.TOGGLE_PAGE });
    setTimeout(refresh, 250);
    setTimeout(refresh, 2000);
  });
  langSel.addEventListener('change', async () => {
    settings.targetLang = langSel.value;
    await storageSet({ settings });
    await toTab({ type: MSG.SET_LANG, lang: langSel.value });
    setTimeout(refresh, 250);
  });
  $('#autohost').addEventListener('change', async () => {
    const on = $('#autohost').checked;
    const list = new Set(settings.autoTranslateHosts);
    if (on) list.add(host);
    else list.delete(host);
    settings.autoTranslateHosts = [...list];
    await storageSet({ settings });
  });
  $('#subs').addEventListener('change', async () => {
    settings.subtitle.enabled = $('#subs').checked;
    await storageSet({ settings });
  });
  $('#options').addEventListener('click', (e) => {
    e.preventDefault();
    api.runtime.openOptionsPage();
  });

  void refresh();
}

void boot();
