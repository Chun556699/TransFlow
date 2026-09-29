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
    const res = await fetch(`${String(config.baseUrl).replace(/\/+$/, '')}/models`, {
      headers: config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {},
    });
    return { ok: res.ok, status: res.status };
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
});

api.commands?.onCommand?.addListener((command) => {
  if (command !== 'toggle-page') return;
  api.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const id = tabs[0]?.id;
    if (id) api.tabs.sendMessage(id, { type: MSG.TOGGLE_PAGE }, () => void api.runtime.lastError);
  });
});
