import { LlmClient } from './llm.js';
import { api } from '../shared/browser.js';
import { MSG } from '../shared/constants.js';
import { loadSettings } from '../shared/settings.js';
import { translateItems } from './translate.js';
import { cache } from './cache.js';

api.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || typeof msg !== 'object') return false;
  if (msg.type === MSG.TRANSLATE) {
    handleTranslate(msg).then(sendResponse, (e) => sendResponse({ error: String(e) }));
    return true;
  }
  if (msg.type === MSG.TEST_ENDPOINT) {
    testEndpoint(msg).then(sendResponse, (e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  return false;
});

async function handleTranslate(msg) {
  const settings = await loadSettings();
  const { results, meta } = await translateItems(msg.items ?? [], msg.to, settings);
  return { results, meta };
}

async function testEndpoint(msg) {
  const { kind, config } = msg;
  if (kind === 'llm') {
    const llm = new LlmClient({ ...config, timeoutMs: 20000 });
    try {
      const [sample] = await llm.translate(['Hello, world!'], 'zh-CN');
      return { ok: true, sample, provider: llm.provider, url: llm.baseUrl };
    } catch (e) {
      return { ok: false, status: e.status, error: e.message, provider: llm.provider, url: llm.baseUrl };
    }
  }
  if (kind === 'jev') {
    const res = await fetch(config.baseUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: 'jev-latest',
        state: { t: 'hello' },
        questions: { q: { type: 'noul', instructions: 'Is the state text a greeting?' } },
      }),
    });
    return { ok: res.ok, status: res.status };
  }
  return { ok: false, error: 'unknown endpoint kind' };
}

api.runtime.onInstalled?.addListener(() => {
  void cache.trim();
  setupMenus();
});

api.runtime.onStartup?.addListener(() => setupMenus());

const menus = api.contextMenus ?? api.menus;
function setupMenus() {
  if (!menus?.create) return;
  try {
    menus.removeAll?.(() => void api.runtime.lastError);
    menus.create({ id: 'tf-page', title: '翻译此页 / 恢复原文', contexts: ['page'] });
    menus.create({ id: 'tf-selection', title: '用 TransFlow 翻译选中内容', contexts: ['selection'] });
  } catch {
    /* 已存在则忽略 */
  }
}
menus?.onClicked?.addListener?.((info, tab) => {
  const id = tab?.id;
  if (!id) return;
  if (info.menuItemId === 'tf-page') {
    api.tabs.sendMessage(id, { type: MSG.TOGGLE_PAGE }, () => void api.runtime.lastError);
  } else if (info.menuItemId === 'tf-selection') {
    api.tabs.sendMessage(id, { type: MSG.TRANSLATE_SELECTION }, () => void api.runtime.lastError);
  }
});

api.commands?.onCommand?.addListener((command) => {
  const type =
    command === 'toggle-page'
      ? MSG.TOGGLE_PAGE
      : command === 'translate-selection'
        ? MSG.TRANSLATE_SELECTION
        : null;
  if (!type) return;
  api.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const id = tabs[0]?.id;
    if (id) api.tabs.sendMessage(id, { type }, () => void api.runtime.lastError);
  });
});
