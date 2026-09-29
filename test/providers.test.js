import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectProvider, normalizeBaseUrl, buildRequest } from '../src/background/providers.js';

test('detectProvider: 按域名识别', () => {
  assert.equal(detectProvider('https://api.anthropic.com'), 'anthropic');
  assert.equal(detectProvider('https://generativelanguage.googleapis.com'), 'gemini');
  assert.equal(detectProvider('https://x.openai.azure.com/openai/deployments/gpt4o'), 'azure');
  assert.equal(detectProvider('http://localhost:11434'), 'ollama');
  assert.equal(detectProvider('http://localhost:11434/v1'), 'openai');
  assert.equal(detectProvider('https://api.deepseek.com'), 'openai');
  assert.equal(detectProvider('https://api.anthropic.com', 'openai'), 'openai');
});

test('normalizeBaseUrl: 补 https / 补路径 / 去终点', () => {
  assert.equal(
    normalizeBaseUrl('http://llm-5gwthr14damb7ihz.cn-beijing.maas.aliyuncs.com', 'openai'),
    'https://llm-5gwthr14damb7ihz.cn-beijing.maas.aliyuncs.com/compatible-mode/v1',
  );
  assert.equal(normalizeBaseUrl('api.deepseek.com', 'openai'), 'https://api.deepseek.com/v1');
  assert.equal(
    normalizeBaseUrl('https://api.openai.com/v1/chat/completions', 'openai'),
    'https://api.openai.com/v1',
  );
  assert.equal(normalizeBaseUrl('http://localhost:8787/v1/', 'openai'), 'http://localhost:8787/v1');
  assert.equal(normalizeBaseUrl('https://api.anthropic.com', 'anthropic'), 'https://api.anthropic.com/v1');
  assert.equal(
    normalizeBaseUrl('https://generativelanguage.googleapis.com', 'gemini'),
    'https://generativelanguage.googleapis.com/v1beta',
  );
});

const cfg = { baseUrl: 'B', apiKey: 'K', model: 'M' };
const req = { system: 'S', user: 'U', json: true, temperature: 0.1 };

test('buildRequest: 各家请求与解析', () => {
  const o = buildRequest('openai', cfg, req);
  assert.equal(o.url, 'B/chat/completions');
  assert.equal(o.headers.authorization, 'Bearer K');
  assert.equal(o.body.messages[0].role, 'system');
  assert.equal(o.parse({ choices: [{ message: { content: 'x' } }] }), 'x');

  const a = buildRequest('anthropic', cfg, req);
  assert.equal(a.url, 'B/messages');
  assert.equal(a.headers['x-api-key'], 'K');
  assert.equal(a.body.system, 'S');
  assert.equal(a.parse({ content: [{ type: 'text', text: 'y' }] }), 'y');

  const g = buildRequest('gemini', cfg, req);
  assert.equal(g.url, 'B/models/M:generateContent');
  assert.equal(g.body.generationConfig.responseMimeType, 'application/json');
  assert.equal(g.parse({ candidates: [{ content: { parts: [{ text: 'z' }] } }] }), 'z');

  const l = buildRequest('ollama', cfg, req);
  assert.equal(l.url, 'B/api/chat');
  assert.equal(l.body.format, 'json');
  assert.equal(l.parse({ message: { content: 'w' } }), 'w');

  const z = buildRequest('azure', { ...cfg, baseUrl: 'https://r.openai.azure.com/openai/deployments/d' }, req);
  assert.match(z.url, /\/deployments\/d\/chat\/completions\?api-version=/);
  assert.equal(z.headers['api-key'], 'K');
});

test('buildModelsRequest: 各家模型列表接口', async () => {
  const { buildModelsRequest } = await import('../src/background/providers.js');
  const o = buildModelsRequest('openai', { baseUrl: 'https://x.com/v1', apiKey: 'k' });
  assert.equal(o.url, 'https://x.com/v1/models');
  assert.deepEqual(o.parse({ data: [{ id: 'b' }, { id: 'a' }, { id: 'a' }] }), ['a', 'b']);
  const g = buildModelsRequest('gemini', { baseUrl: 'https://g/v1beta', apiKey: 'k' });
  assert.deepEqual(
    g.parse({ models: [{ name: 'models/gemini-x', supportedGenerationMethods: ['generateContent'] }, { name: 'models/emb', supportedGenerationMethods: ['embedContent'] }] }),
    ['gemini-x'],
  );
  const l = buildModelsRequest('ollama', { baseUrl: 'http://localhost:11434' });
  assert.equal(l.url, 'http://localhost:11434/api/tags');
  assert.deepEqual(l.parse({ models: [{ name: 'qwen3:8b' }] }), ['qwen3:8b']);
  const a = buildModelsRequest('anthropic', { baseUrl: 'https://api.anthropic.com/v1', apiKey: 'k' });
  assert.equal(a.headers['x-api-key'], 'k');
});
