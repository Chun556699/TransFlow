// 设置页 UI 文案：按浏览器界面语言中英切换
const STR = {
  title: { zh: 'TransFlow 设置', en: 'TransFlow Options' },
  tagline: { zh: 'Jev × LLM 极速翻译', en: 'Jev × LLM instant translation' },
  nav_models: { zh: '模型服务', en: 'Models' },
  nav_translate: { zh: '翻译', en: 'Translation' },
  nav_appearance: { zh: '外观', en: 'Appearance' },
  nav_subtitle: { zh: '视频字幕', en: 'Subtitles' },
  nav_sites: { zh: '站点规则', en: 'Site rules' },
  nav_data: { zh: '缓存与隐私', en: 'Cache & privacy' },
  h_models: { zh: '模型服务', en: 'Models' },
  models_hint: {
    zh: 'Jev 决策模型负责快速过滤与路由（可选，不配也能用）；LLM 大模型负责生成译文。两端点均可自定义。',
    en: 'Jev is a decision model for fast filtering and routing (optional — works without it); the LLM generates translations. Both endpoints are configurable.',
  },
  jev_head: { zh: 'Jev · 快决策层', en: 'Jev · Decision layer' },
  llm_head: { zh: 'LLM · 生成层', en: 'LLM · Generation layer' },
  enabled: { zh: '启用', en: 'Enabled' },
  endpoint: { zh: '端点地址', en: 'Endpoint' },
  timeout: { zh: '超时 (ms)', en: 'Timeout (ms)' },
  jev_gate: { zh: '开启智能过滤（跳过无需翻译的文本，省 LLM 调用）', en: 'Smart filtering (skip segments not worth translating, saves LLM calls)' },
  test_conn: { zh: '测试连接', en: 'Test connection' },
  api_format: { zh: '接口格式', en: 'API format' },
  base_url: { zh: '接口地址', en: 'Base URL' },
  url_hint: {
    zh: '可只填域名，会自动补全 https 与路径（如百炼自动补 /compatible-mode/v1）；误贴的 /chat/completions 也会自动去掉。',
    en: 'A bare domain works — https and path auto-complete (Bailian gets /compatible-mode/v1); a pasted /chat/completions is stripped.',
  },
  model: { zh: '模型名', en: 'Model' },
  model_ph: { zh: '选择或直接输入，如 gpt-4o-mini', en: 'Pick or type a model, e.g. gpt-4o-mini' },
  fetch_models: { zh: '获取模型', en: 'Fetch models' },
  h_translate: { zh: '翻译', en: 'Translation' },
  target_lang: { zh: '目标语言', en: 'Target language' },
  batch: { zh: '每批段落', en: 'Segments per batch' },
  maxchars: { zh: '每批字符', en: 'Chars per batch' },
  concurrency: { zh: '并发数', en: 'Concurrency' },
  glossary: { zh: '术语表（每行：原文=译文）', en: 'Glossary (one per line: source=target)' },
  sel_enabled: { zh: '划词翻译（选中文字出现浮窗）', en: 'Selection translation (popover on selected text)' },
  sel_input: { zh: '输入框翻译（聚焦输入框出现翻译按钮，可替换原文）', en: 'Input translation (button on focused inputs, can replace text)' },
  h_appearance: { zh: '外观', en: 'Appearance' },
  accent: { zh: '强调色', en: 'Accent color' },
  fontscale: { zh: '译文字号', en: 'Translation font size' },
  translation_only: { zh: '仅显示译文（隐藏原文）', en: 'Translation only (hide original)' },
  custom_css: { zh: '自定义 CSS', en: 'Custom CSS' },
  h_subtitle: { zh: '视频字幕', en: 'Video subtitles' },
  sub_enabled: { zh: '启用 YouTube 字幕翻译（需先打开播放器原生字幕）', en: 'YouTube subtitle translation (turn on native CC first)' },
  sub_generic: { zh: '其他站点视频：翻译原生 CC 轨道', en: 'Other sites: translate native CC tracks' },
  sub_hidenative: { zh: '隐藏播放器原生字幕（仅显示译文层）', en: 'Hide native captions (show only the translation layer)' },
  sub_order: { zh: '双语顺序', en: 'Bilingual order' },
  order_below: { zh: '原文上 · 译文下', en: 'Original above · translation below' },
  order_top: { zh: '译文上 · 原文下', en: 'Translation above · original below' },
  order_only: { zh: '仅译文', en: 'Translation only' },
  sub_fontsize: { zh: '字号', en: 'Font size' },
  sub_pos: { zh: '位置', en: 'Position' },
  pos_bottom: { zh: '底部', en: 'Bottom' },
  pos_top: { zh: '顶部', en: 'Top' },
  h_sites: { zh: '站点规则', en: 'Site rules' },
  auto_hosts: { zh: '自动翻译站点（每行一个域名）', en: 'Always translate (one host per line)' },
  never_hosts: { zh: '永不翻译站点', en: 'Never translate' },
  h_data: { zh: '缓存与隐私', en: 'Cache & privacy' },
  data_hint: {
    zh: '译文缓存在本机 IndexedDB；API Key 仅存本机 storage。网页文本会发送到你配置的模型端点，请自行评估隐私。',
    en: 'Translations cache in local IndexedDB; API keys stay in local storage. Page text is sent to the model endpoints you configure — assess privacy yourself.',
  },
  import_cfg: { zh: '导入配置 JSON', en: 'Import config JSON' },
  clear_cache: { zh: '清空译文缓存', en: 'Clear translation cache' },
  reset: { zh: '恢复全部默认设置', en: 'Reset all to defaults' },
  save: { zh: '保存设置', en: 'Save settings' },
  saved: { zh: '已保存 ✓ 刷新页面生效', en: 'Saved ✓ — reload pages to apply' },
  imported: { zh: '配置已导入 ✓', en: 'Config imported ✓' },
  testing: { zh: '测试中…', en: 'Testing…' },
  conn_ok: { zh: '连接正常 ✓', en: 'Connected ✓' },
  conn_fail: { zh: '失败', en: 'Failed' },
  no_response: { zh: '无响应', en: 'no response' },
  cleared: { zh: '已清空 ✓', en: 'Cleared ✓' },
  paste_cfg: { zh: '粘贴配置 JSON（如 {"settings":{...}}）', en: 'Paste config JSON (e.g. {"settings":{...}})' },
  bad_json: { zh: 'JSON 解析失败，请检查格式', en: 'Invalid JSON — check the format' },
  fetching: { zh: '获取中…', en: 'Fetching…' },
  got_models: { zh: '已获取 {n} 个模型，可点选或继续手动输入', en: 'Fetched {n} models — click to pick or type your own' },
  no_models: { zh: '接口未返回模型列表，请手动输入模型名', en: 'Endpoint returned no model list — type the model name' },
  fetch_fail: { zh: '获取失败', en: 'Fetch failed' },
  mm_fetched: { zh: '可用模型 {s}/{n}', en: '{n} models available ({s} shown)' },
  mm_presets: { zh: '推荐模型（点「获取模型」拉取你的账号可用列表）', en: 'Suggested models — click "Fetch models" for your account list' },
  mm_empty: { zh: '无匹配，按回车使用当前输入的模型名', en: 'No match — press Enter to use the typed name' },
  resolved: { zh: '实际请求：', en: 'Resolved: ' },
  mt_badge: { zh: '翻译', en: 'MT' },
  theme_src: { zh: '原文原文', en: 'Source source' },
  theme_tgt: { zh: '译文译文译文', en: 'Translated translated' },
  prov_auto: { zh: '自动识别', en: 'Auto-detect' },
  prov_openai: { zh: 'OpenAI 兼容（DeepSeek / 百炼 / 硅基流动 / vLLM / OpenRouter …）', en: 'OpenAI-compatible (DeepSeek / Bailian / vLLM / OpenRouter …)' },
  prov_anthropic: { zh: 'Anthropic Claude', en: 'Anthropic Claude' },
  prov_gemini: { zh: 'Google Gemini', en: 'Google Gemini' },
  prov_azure: { zh: 'Azure OpenAI', en: 'Azure OpenAI' },
  prov_ollama: { zh: 'Ollama 原生', en: 'Ollama (native)' },
};

export const LANG = (() => {
  const l = (navigator.language || 'zh-CN').toLowerCase();
  return l.startsWith('zh') ? 'zh' : 'en';
})();

export function t(key, vars) {
  let s = STR[key]?.[LANG] ?? STR[key]?.zh ?? key;
  for (const [k, v] of Object.entries(vars ?? {})) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

export function applyI18n() {
  document.documentElement.lang = LANG === 'zh' ? 'zh-CN' : 'en';
  document.title = t('title');
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll('[data-i18n-ph]')) el.placeholder = t(el.dataset.i18nPh);
}
