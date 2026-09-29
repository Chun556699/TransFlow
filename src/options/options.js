import { api, sendMessage, storageGet, storageSet } from '../shared/browser.js';
import { MSG, LANGUAGES, THEMES, DEFAULT_SETTINGS } from '../shared/constants.js';
import { loadSettings } from '../shared/settings.js';
import { PROVIDERS, detectProvider, normalizeBaseUrl } from '../background/providers.js';
import { cache } from '../background/cache.js';
import { t, applyI18n } from './i18n.js';

const $ = (s) => document.querySelector(s);
let settings = null;

const PRESET_MODELS = [
  ['qwen-mt-turbo', '阿里专用翻译 · 高性价比'],
  ['qwen-mt-plus', '阿里专用翻译 · 质量最高'],
  ['qwen-mt-flash', '阿里专用翻译 · 最速'],
  ['qwen3.8-flash', '通用 · JSON 批量省请求'],
  ['deepseek-v4.1-flash', '通用'],
  ['glm-5.3', '通用'],
  ['kimi-k3', '通用'],
  ['gpt-4o-mini', 'OpenAI'],
  ['deepseek-chat', 'DeepSeek'],
];
let fetchedModels = null;

function renderModelMenu(show = true) {
  const menu = $('#model-menu');
  const q = $('#llm-model').value.trim().toLowerCase();
  const all = fetchedModels ? fetchedModels.map((m) => [m, '']) : PRESET_MODELS;
  const list = all.filter(([m]) => !q || m.toLowerCase().includes(q) || fetchedModels === null);
  menu.replaceChildren();
  const head = document.createElement('div');
  head.className = 'mm-head';
  head.textContent = fetchedModels ? t('mm_fetched', { s: list.length, n: fetchedModels.length }) : t('mm_presets');
  menu.append(head);
  for (const [m, note] of list.slice(0, 300)) {
    const o = document.createElement('div');
    o.className = 'mm-item' + (m === $('#llm-model').value.trim() ? ' on' : '');
    o.setAttribute('role', 'option');
    o.dataset.value = m;
    const name = document.createElement('b');
    name.textContent = m;
    o.append(name);
    if (note) {
      const n = document.createElement('small');
      n.textContent = note;
      o.append(n);
    }
    if (/(^|[-/])(mt|translat)/i.test(m)) o.classList.add('mt');
    menu.append(o);
  }
  if (!list.length) {
    const e = document.createElement('div');
    e.className = 'mm-empty';
    e.textContent = t('mm_empty');
    menu.append(e);
  }
  menu.hidden = !show;
}

function bindModelPicker() {
  const input = $('#llm-model');
  const menu = $('#model-menu');
  input.addEventListener('focus', () => renderModelMenu());
  input.addEventListener('input', () => renderModelMenu());
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === 'Escape') menu.hidden = true;
  });
  menu.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const it = e.target.closest('.mm-item');
    if (!it) return;
    input.value = it.dataset.value;
    menu.hidden = true;
  });
  document.addEventListener('mousedown', (e) => {
    if (!e.target.closest('.model-pick')) menu.hidden = true;
  });
  $('#fetch-models').addEventListener('click', fetchModels);
}

async function fetchModels() {
  collect();
  const btn = $('#fetch-models');
  const msg = $('#model-msg');
  btn.disabled = true;
  btn.textContent = t('fetching');
  const resp = await sendMessage({
    type: MSG.LIST_MODELS,
    config: { baseUrl: settings.llm.baseUrl, apiKey: settings.llm.apiKey, provider: settings.llm.provider },
  }).catch((e) => ({ ok: false, error: String(e) }));
  btn.disabled = false;
  btn.textContent = t('fetch_models');
  if (resp?.ok && resp.models?.length) {
    fetchedModels = resp.models;
    msg.className = 'test-msg ok';
    msg.textContent = t('got_models', { n: resp.models.length });
    $('#llm-model').focus();
    renderModelMenu();
  } else {
    msg.className = 'test-msg fail';
    msg.textContent = resp?.ok
      ? t('no_models')
      : `${t('fetch_fail')} ${resp?.status ?? ''} ${resp?.error ?? ''} · ${resp?.url ?? ''}`.trim();
  }
}

function bind() {
  const s = settings;
  $('#ver').textContent = api.runtime.getManifest().version;

  $('#jev-enabled').checked = s.jev.enabled;
  $('#jev-url').value = s.jev.baseUrl;
  $('#jev-key').value = s.jev.apiKey;
  $('#jev-timeout').value = s.jev.timeoutMs;
  $('#jev-gate').checked = s.jev.gate;

  const prov = $('#llm-provider');
  for (const [v] of PROVIDERS) {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = t(`prov_${v}`);
    prov.append(o);
  }
  prov.value = s.llm.provider ?? 'auto';
  const hint = () => {
    const raw = $('#llm-url').value.trim();
    if (!raw) return;
    const p = detectProvider(raw, prov.value);
    $('#llm-url-hint').textContent = `${t('resolved')}${normalizeBaseUrl(raw, p)}（${t(`prov_${p}`)}）`;
  };
  $('#llm-url').addEventListener('input', hint);
  prov.addEventListener('change', hint);
  $('#llm-enabled').checked = s.llm.enabled;
  $('#llm-url').value = s.llm.baseUrl;
  $('#llm-key').value = s.llm.apiKey;
  $('#llm-model').value = s.llm.model;
  hint();

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
    card.innerHTML = `<strong>${label}</strong><span class="demo">${t('theme_src')}<br><span class="t-${key}">${t('theme_tgt')}</span></span>`;
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
  s.llm.provider = $('#llm-provider').value;
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
  el.textContent = t('saved');
  setTimeout(() => (el.textContent = ''), 2500);
}

async function testEndpoint(btn) {
  collect();
  const kind = btn.dataset.test;
  btn.classList.remove('tested-ok', 'tested-fail');
  btn.textContent = t('testing');
  const config =
    kind === 'jev'
      ? { baseUrl: settings.jev.baseUrl, apiKey: settings.jev.apiKey }
      : {
          baseUrl: settings.llm.baseUrl,
          apiKey: settings.llm.apiKey,
          model: settings.llm.model,
          provider: settings.llm.provider,
        };
  const resp = await sendMessage({ type: MSG.TEST_ENDPOINT, kind, config });
  btn.textContent = resp?.ok ? t('conn_ok') : `${t('conn_fail')} ${resp?.status ?? ''}`;
  btn.classList.add(resp?.ok ? 'tested-ok' : 'tested-fail');
  if (kind === 'llm') {
    const msg = $('#llm-test-msg');
    msg.className = 'test-msg ' + (resp?.ok ? 'ok' : 'fail');
    msg.textContent = resp?.ok
      ? `「Hello, world!」→「${resp.sample}」`
      : `${resp?.error ?? t('no_response')} · ${resp?.url ?? ''}`;
  }
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
  applyI18n();
  bind();
  bindModelPicker();
  navSpy();
  $('#save').addEventListener('click', save);
  document.querySelectorAll('[data-test]').forEach((b) => b.addEventListener('click', () => testEndpoint(b)));
  $('#clear-cache').addEventListener('click', async () => {
    await cache.clear();
    $('#clear-cache').textContent = t('cleared');
    setTimeout(() => ($('#clear-cache').textContent = t('clear_cache')), 2000);
  });
  $('#import-cfg').addEventListener('click', async () => {
    const raw = prompt(t('paste_cfg'));
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      const incoming = parsed.settings ?? parsed;
      if (!incoming || typeof incoming !== 'object') throw new Error('bad json');
      settings = { ...settings, ...incoming };
      await storageSet({ settings });
      const el = $('#saved');
      el.textContent = t('imported');
      setTimeout(() => (el.textContent = ''), 2500);
      location.reload();
    } catch {
      alert(t('bad_json'));
    }
  });
  $('#reset').addEventListener('click', async () => {
    await storageSet({ settings: DEFAULT_SETTINGS });
    location.reload();
  });
}

void boot();
