// LLM 接口格式适配：把 {system, user, json} 统一请求映射到各家 API
export const PROVIDERS = [
  ['auto', '自动识别'],
  ['openai', 'OpenAI 兼容（DeepSeek / 百炼 / 硅基流动 / vLLM / OpenRouter …）'],
  ['anthropic', 'Anthropic Claude'],
  ['gemini', 'Google Gemini'],
  ['azure', 'Azure OpenAI'],
  ['ollama', 'Ollama 原生'],
];

const KNOWN_OPENAI_PATHS = [
  [/(^|\.)aliyuncs\.com$/i, '/compatible-mode/v1'],
  [/(^|\.)dashscope\.aliyuncs\.com$/i, '/compatible-mode/v1'],
  [/(^|\.)volces\.com$/i, '/api/v3'],
  [/(^|\.)bigmodel\.cn$/i, '/api/paas/v4'],
  [/(^|\.)openrouter\.ai$/i, '/api/v1'],
  [/(^|\.)groq\.com$/i, '/openai/v1'],
];

export function detectProvider(baseUrl, provider = 'auto') {
  if (provider && provider !== 'auto') return provider;
  let u;
  try {
    u = new URL(withScheme(baseUrl));
  } catch {
    return 'openai';
  }
  const h = u.hostname;
  if (/anthropic\.com$/i.test(h)) return 'anthropic';
  if (/generativelanguage\.googleapis\.com$/i.test(h)) return 'gemini';
  if (/\.openai\.azure\.com$/i.test(h) || /\.cognitiveservices\.azure\.com$/i.test(h)) return 'azure';
  if (u.port === '11434' && !/\/v1\/?$/.test(u.pathname)) return 'ollama';
  return 'openai';
}

function withScheme(url) {
  const s = String(url ?? '').trim();
  if (!s) return s;
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `https://${s}`;
}

// 规范化 base URL：补 https、去掉用户误贴的 /chat/completions 等终点、补常见路径前缀
export function normalizeBaseUrl(baseUrl, provider) {
  let s = withScheme(baseUrl).replace(/\/+$/, '');
  s = s.replace(/\/(chat\/completions|completions|messages|api\/chat|models)$/i, '');
  let u;
  try {
    u = new URL(s);
  } catch {
    return s;
  }
  // 远程域名强制 https（http 常被网关 301/404）
  const local = /^(localhost|127\.|10\.|192\.168\.|\[::1\])/.test(u.hostname);
  if (u.protocol === 'http:' && !local) u.protocol = 'https:';
  const path = u.pathname.replace(/\/+$/, '');
  if (provider === 'openai' && !path) {
    const hit = KNOWN_OPENAI_PATHS.find(([re]) => re.test(u.hostname));
    u.pathname = hit ? hit[1] : '/v1';
  }
  if (provider === 'anthropic' && !path) u.pathname = '/v1';
  if (provider === 'gemini' && !path) u.pathname = '/v1beta';
  return u.toString().replace(/\/+$/, '');
}

// 返回 {url, headers, body, parse(json) -> text}
export function buildRequest(provider, cfg, { system, user, json, temperature, extra }) {
  const base = cfg.baseUrl;
  const key = cfg.apiKey;
  const t = temperature ?? 0.2;
  switch (provider) {
    case 'anthropic':
      return {
        url: `${base}/messages`,
        headers: {
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: {
          model: cfg.model,
          max_tokens: 4096,
          temperature: t,
          ...(system ? { system } : {}),
          messages: [{ role: 'user', content: user }],
        },
        parse: (j) => (j.content ?? []).map((p) => p.text ?? '').join(''),
      };
    case 'gemini':
      return {
        url: `${base}/models/${encodeURIComponent(cfg.model)}:generateContent`,
        headers: { 'x-goog-api-key': key },
        body: {
          ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: {
            temperature: t,
            ...(json ? { responseMimeType: 'application/json' } : {}),
          },
        },
        parse: (j) => (j.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join(''),
      };
    case 'ollama':
      return {
        url: `${base}/api/chat`,
        headers: {},
        body: {
          model: cfg.model,
          stream: false,
          options: { temperature: t },
          ...(json ? { format: 'json' } : {}),
          messages: [
            ...(system ? [{ role: 'system', content: system }] : []),
            { role: 'user', content: user },
          ],
        },
        parse: (j) => j.message?.content ?? '',
      };
    case 'azure': {
      const sep = base.includes('?') ? '&' : '?';
      const ver = /api-version=/.test(base) ? '' : `${sep}api-version=2024-10-21`;
      const [path, query = ''] = base.split('?');
      return {
        url: `${path}/chat/completions${query ? `?${query}` : ''}${ver}`,
        headers: { 'api-key': key },
        body: openaiBody(cfg, system, user, json, t, extra),
        parse: openaiParse,
      };
    }
    default:
      return {
        url: `${base}/chat/completions`,
        headers: key ? { authorization: `Bearer ${key}` } : {},
        body: openaiBody(cfg, system, user, json, t, extra),
        parse: openaiParse,
      };
  }
}

function openaiBody(cfg, system, user, json, t, extra) {
  return {
    model: cfg.model,
    temperature: t,
    ...(json ? { response_format: { type: 'json_object' } } : {}),
    messages: [
      ...(system ? [{ role: 'system', content: system }] : []),
      { role: 'user', content: user },
    ],
    ...(extra ?? {}),
  };
}

function openaiParse(j) {
  const c = j.choices?.[0]?.message?.content;
  if (Array.isArray(c)) return c.map((p) => p.text ?? '').join('');
  return c ?? j.choices?.[0]?.text ?? '';
}

// 模型列表接口：返回 {url, headers, parse(json) -> string[]}
export function buildModelsRequest(provider, cfg) {
  const base = cfg.baseUrl;
  const key = cfg.apiKey;
  const ids = (arr, f) => [...new Set((arr ?? []).map(f).filter(Boolean))].sort();
  switch (provider) {
    case 'anthropic':
      return {
        url: `${base}/models?limit=1000`,
        headers: {
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        parse: (j) => ids(j.data, (m) => m.id),
      };
    case 'gemini':
      return {
        url: `${base}/models?pageSize=1000`,
        headers: { 'x-goog-api-key': key },
        parse: (j) =>
          ids(
            (j.models ?? []).filter((m) => !m.supportedGenerationMethods || m.supportedGenerationMethods.includes('generateContent')),
            (m) => String(m.name ?? '').replace(/^models\//, ''),
          ),
      };
    case 'ollama':
      return { url: `${base}/api/tags`, headers: {}, parse: (j) => ids(j.models, (m) => m.name ?? m.model) };
    case 'azure': {
      const [path, query = ''] = base.split('?');
      const ver = /api-version=/.test(query) ? query : `${query ? `${query}&` : ''}api-version=2024-10-21`;
      return { url: `${path.replace(/\/deployments\/[^/]+$/, '')}/models?${ver}`, headers: { 'api-key': key }, parse: (j) => ids(j.data, (m) => m.id) };
    }
    default:
      return {
        url: `${base}/models`,
        headers: key ? { authorization: `Bearer ${key}` } : {},
        parse: (j) => ids(Array.isArray(j) ? j : (j.data ?? j.models), (m) => (typeof m === 'string' ? m : (m.id ?? m.name))),
      };
  }
}
