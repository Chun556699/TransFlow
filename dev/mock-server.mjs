// 本地 Mock 端点：Jev /v1/systemone + OpenAI 兼容 /v1/chat/completions
// 用法: node dev/mock-server.mjs [port]
import http from 'node:http';

const port = Number(process.argv[2] ?? 8787);

const server = http.createServer(async (req, res) => {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-headers', 'content-type,authorization');
  res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.end();
  const body = req.method === 'POST' ? await read(req) : '';

  if (req.url === '/v1/systemone' && req.method === 'POST') {
    const { questions = {} } = JSON.parse(body || '{}');
    const results = {};
    for (const k of Object.keys(questions)) results[k] = { noul: 0.92 };
    return json(res, { results });
  }

  if (req.url === '/v1/models') {
    return json(res, { data: [{ id: 'mock-translator' }] });
  }

  if (req.url === '/v1/chat/completions' && req.method === 'POST') {
    const payload = JSON.parse(body || '{}');
    const user = payload.messages?.find?.((m) => m.role === 'user')?.content ?? '';
    const i = user.lastIndexOf('<<<');
    const j = user.lastIndexOf('>>>');
    let texts = [];
    try {
      if (i >= 0 && j > i) texts = JSON.parse(user.slice(i + 3, j));
    } catch {
      /* noop */
    }
    const translations = texts.map((t) => `〔译〕${t}`);
    return json(res, {
      choices: [{ message: { content: JSON.stringify({ translations }) } }],
      usage: { prompt_tokens: 10, completion_tokens: 10 },
    });
  }

  res.writeHead(404).end('not found');
});

function read(req) {
  return new Promise((r) => {
    let s = '';
    req.on('data', (c) => (s += c));
    req.on('end', () => r(s));
  });
}
function json(res, obj) {
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(obj));
}

server.listen(port, () => console.log(`mock endpoints on http://localhost:${port}/v1`));
