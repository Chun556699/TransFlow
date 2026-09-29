import { api, sendMessage, storageGet, storageSet } from '../shared/browser.js';
import { MSG, LANGUAGES, THEMES, DEFAULT_SETTINGS } from '../shared/constants.js';
import { loadSettings } from '../shared/settings.js';
import { cache } from '../background/cache.js';

const $ = (s) => document.querySelector(s);
let settings = null;

function bind() {
  const s = settings;
  $('#ver').textContent = api.runtime.getManifest().version;

  $('#jev-enabled').checked = s.jev.enabled;
  $('#jev-url').value = s.jev.baseUrl;
  $('#jev-key').value = s.jev.apiKey;
  $('#jev-timeout').value = s.jev.timeoutMs;
  $('#jev-gate').checked = s.jev.gate;

  $('#llm-enabled').checked = s.llm.enabled;
  $('#llm-url').value = s.llm.baseUrl;
  $('#llm-key').value = s.llm.apiKey;
  $('#llm-model').value = s.llm.model;

  const lang = $('#target-lang');
  for (const [v, label] of LANGUAGES) {
    if (v === 'auto') continue;
    const o = document.createElement('option');
    o.value = v;
    o.textContent = label;
    lang.append(o);
  }
  lang.value = s.targetLang;
  $('#batch').value = s.pipeline.batchSize;
  $('#maxchars').value = s.pipeline.maxChars;
  $('#concurrency').value = s.pipeline.concurrency;
  $('#glossary').value = s.pipeline.glossary;
  $('#sel-enabled').checked = s.selection?.enabled !== false;
  $('#sel-input').checked = s.selection?.inputEnabled !== false;

  $('#accent').value = s.appearance.accent;
  $('#fontscale').value = s.appearance.fontScale;
  $('#translation-only').checked = s.appearance.translationOnly;
  $('#custom-css').value = s.appearance.customCss;

  const themes = $('#themes');
  for (const [key, label] of THEMES) {
    const card = document.createElement('div');
    card.className = 'theme-card' + (s.appearance.theme === key ? ' on' : '');
    card.dataset.theme = key;
    card.innerHTML = `<strong>${label}</strong><span class="demo">原文原文<br><span class="t-${key}">译文译文译文</span></span>`;
    card.addEventListener('click', () => {
      s.appearance.theme = key;
      themes.querySelectorAll('.theme-card').forEach((c) => c.classList.toggle('on', c === card));
    });
    themes.append(card);
  }

  $('#sub-enabled').checked = s.subtitle.enabled;
  $('#sub-generic').checked = s.subtitle.genericVideo;
  $('#sub-hidenative').checked = s.subtitle.hideNative;
  $('#sub-order').value = s.subtitle.bilingualOrder;
  $('#sub-fontsize').value = s.subtitle.fontSize;
  $('#sub-pos').value = s.subtitle.position;

  $('#auto-hosts').value = s.autoTranslateHosts.join('\n');
  $('#never-hosts').value = s.neverTranslateHosts.join('\n');
}

function collect() {
  const s = settings;
  s.jev.enabled = $('#jev-enabled').checked;
  s.jev.baseUrl = $('#jev-url').value.trim() || DEFAULT_SETTINGS.jev.baseUrl;
  s.jev.apiKey = $('#jev-key').value.trim();
  s.jev.timeoutMs = Number($('#jev-timeout').value) || DEFAULT_SETTINGS.jev.timeoutMs;
  s.jev.gate = $('#jev-gate').checked;

  s.llm.enabled = $('#llm-enabled').checked;
  s.llm.baseUrl = $('#llm-url').value.trim() || DEFAULT_SETTINGS.llm.baseUrl;
  s.llm.apiKey = $('#llm-key').value.trim();
  s.llm.model = $('#llm-model').value.trim() || DEFAULT_SETTINGS.llm.model;

  s.targetLang = $('#target-lang').value;
  s.pipeline.batchSize = Number($('#batch').value) || DEFAULT_SETTINGS.pipeline.batchSize;
  s.pipeline.maxChars = Number($('#maxchars').value) || DEFAULT_SETTINGS.pipeline.maxChars;
  s.pipeline.concurrency = Number($('#concurrency').value) || DEFAULT_SETTINGS.pipeline.concurrency;
  s.pipeline.glossary = $('#glossary').value;
  s.selection ??= {};
  s.selection.enabled = $('#sel-enabled').checked;
  s.selection.inputEnabled = $('#sel-input').checked;

  s.appearance.accent = $('#accent').value;
  s.appearance.fontScale = Number($('#fontscale').value);
  s.appearance.translationOnly = $('#translation-only').checked;
  s.appearance.customCss = $('#custom-css').value;

  s.subtitle.enabled = $('#sub-enabled').checked;
  s.subtitle.genericVideo = $('#sub-generic').checked;
  s.subtitle.hideNative = $('#sub-hidenative').checked;
  s.subtitle.bilingualOrder = $('#sub-order').value;
  s.subtitle.fontSize = Number($('#sub-fontsize').value) || DEFAULT_SETTINGS.subtitle.fontSize;
  s.subtitle.position = $('#sub-pos').value;

  const lines = (v) => v.split('\n').map((l) => l.trim()).filter(Boolean);
  s.autoTranslateHosts = lines($('#auto-hosts').value);
  s.neverTranslateHosts = lines($('#never-hosts').value);
}

async function save() {
  collect();
  await storageSet({ settings });
  const el = $('#saved');
  el.textContent = '已保存 ✓ 刷新页面生效';
  setTimeout(() => (el.textContent = ''), 2500);
}

async function testEndpoint(btn) {
  collect();
  const kind = btn.dataset.test;
  btn.classList.remove('tested-ok', 'tested-fail');
  btn.textContent = '测试中…';
  const config =
    kind === 'jev'
      ? { baseUrl: settings.jev.baseUrl, apiKey: settings.jev.apiKey }
      : { baseUrl: settings.llm.baseUrl, apiKey: settings.llm.apiKey };
  const resp = await sendMessage({ type: MSG.TEST_ENDPOINT, kind, config });
  btn.textContent = resp?.ok ? '连接正常 ✓' : `失败 ${resp?.status ?? resp?.error ?? ''}`;
  btn.classList.add(resp?.ok ? 'tested-ok' : 'tested-fail');
}

function navSpy() {
  const links = [...document.querySelectorAll('#nav a')];
  const obs = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        links.forEach((a) => a.classList.toggle('on', a.hash === '#' + e.target.id));
      }
    },
    { rootMargin: '-20% 0px -70% 0px' },
  );
  document.querySelectorAll('main .card').forEach((c) => obs.observe(c));
}

async function boot() {
  settings = await loadSettings();
  bind();
  navSpy();
  $('#save').addEventListener('click', save);
  document.querySelectorAll('[data-test]').forEach((b) => b.addEventListener('click', () => testEndpoint(b)));
  $('#clear-cache').addEventListener('click', async () => {
    await cache.clear();
    $('#clear-cache').textContent = '已清空 ✓';
    setTimeout(() => ($('#clear-cache').textContent = '清空译文缓存'), 2000);
  });
  $('#import-cfg').addEventListener('click', async () => {
    const raw = prompt('粘贴配置 JSON（如 {"settings":{...}}）');
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      const incoming = parsed.settings ?? parsed;
      if (!incoming || typeof incoming !== 'object') throw new Error('bad json');
      settings = { ...settings, ...incoming };
      await storageSet({ settings });
      const el = $('#saved');
      el.textContent = '配置已导入 ✓';
      setTimeout(() => (el.textContent = ''), 2500);
      location.reload();
    } catch {
      alert('JSON 解析失败，请检查格式');
    }
  });
  $('#reset').addEventListener('click', async () => {
    await storageSet({ settings: DEFAULT_SETTINGS });
    location.reload();
  });
}

void boot();
