import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LlmClient, parseMtTerms } from '../src/background/llm.js';

function mockFetch(handler) {
  const calls = [];
  const orig = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), body: JSON.parse(init.body) });
    return new Response(JSON.stringify(handler(JSON.parse(init.body))), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  return {
    calls,
    restore: () => { globalThis.fetch = orig; },
  };
}

const openAiReply = (texts) => (payload) => ({
  choices: [{ message: { content: JSON.stringify({ translations: texts }) } }],
});

test('LlmClient: JSON 批路径返回多条', async () => {
  const m = mockFetch(openAiReply(['你好', '再见']));
  try {
    const llm = new LlmClient({ baseUrl: 'http://x/v1', apiKey: 'k', model: 'gpt-x' });
    const out = await llm.translate(['Hello', 'Bye'], 'zh-CN');
    assert.deepEqual(out, ['你好', '再见']);
    assert.equal(m.calls.length, 1);
    const payload = m.calls[0].body;
    assert.equal(payload.messages[0].role, 'system');
    assert.match(m.calls[0].url, /chat\/completions$/);
  } finally {
    m.restore();
  }
});

test('LlmClient: 对齐失败抛错', async () => {
  const m = mockFetch(() => ({ choices: [{ message: { content: JSON.stringify({ translations: ['only'] }) } }] }));
  try {
    const llm = new LlmClient({ baseUrl: 'http://x/v1', apiKey: 'k', model: 'gpt-x' });
    await assert.rejects(() => llm.translate(['Hello', 'Bye'], 'zh-CN'), /misaligned|unparseable/);
  } finally {
    m.restore();
  }
});

test('LlmClient MT: qwen-mt 走 translation_options，无 system', async () => {
  const m = mockFetch((payload) => {
    assert.equal(payload.messages.length, 1);
    assert.equal(payload.messages[0].role, 'user');
    assert.equal(payload.translation_options.target_lang, 'Chinese');
    assert.equal(payload.translation_options.source_lang, 'auto');
    assert.deepEqual(payload.translation_options.terms, [{ source: 'GPU', target: '显卡' }]);
    return { choices: [{ message: { content: '你好，世界' } }] };
  });
  try {
    const llm = new LlmClient({
      baseUrl: 'http://x/v1', apiKey: 'k', model: 'qwen-mt-turbo', glossary: 'GPU=显卡',
    });
    assert.equal(llm.isMt, true);
    const out = await llm.translate(['Hello, world', 'Second'], 'zh-CN');
    assert.deepEqual(out, ['你好，世界', '你好，世界']);
    assert.equal(m.calls.length, 2); // 逐条请求
  } finally {
    m.restore();
  }
});

test('parseMtTerms: = 与 → 分隔，忽略坏行', () => {
  assert.deepEqual(parseMtTerms('GPU=显卡\nAPI → 接口\nbad-line\n=only'), [
    { source: 'GPU', target: '显卡' },
    { source: 'API', target: '接口' },
  ]);
  assert.deepEqual(parseMtTerms(''), []);
});
