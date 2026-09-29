export const MSG = {
  TRANSLATE: 'tf:translate',
  PAGE_STATE: 'tf:page-state',
  TOGGLE_PAGE: 'tf:toggle-page',
  SET_LANG: 'tf:set-lang',
  SUBTITLE_EVENT: 'tf:subtitle-event',
  TEST_ENDPOINT: 'tf:test-endpoint',
};

export const DEFAULT_SETTINGS = {
  targetLang: 'zh-CN',
  autoTranslateHosts: [],
  neverTranslateHosts: [],
  jev: {
    enabled: false,
    baseUrl: 'https://api.typesafe.ai/v1/systemone',
    apiKey: '',
    timeoutMs: 2500,
    gate: true,
  },
  llm: {
    enabled: true,
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-4o-mini',
    temperature: 0.2,
  },
  pipeline: {
    batchSize: 20,
    maxChars: 5000,
    concurrency: 4,
    glossary: '',
  },
  appearance: {
    theme: 'underline',
    accent: '#4f7cff',
    fontScale: 0.95,
    customCss: '',
    translationOnly: false,
  },
  subtitle: {
    enabled: true,
    genericVideo: true,
    hideNative: true,
    bilingualOrder: 'translated-below',
    fontSize: 22,
    position: 'bottom',
  },
};

export const LANGUAGES = [
  ['auto', 'Auto'],
  ['zh-CN', '简体中文'],
  ['zh-TW', '繁體中文'],
  ['en', 'English'],
  ['ja', '日本語'],
  ['ko', '한국어'],
  ['fr', 'Français'],
  ['de', 'Deutsch'],
  ['es', 'Español'],
  ['ru', 'Русский'],
  ['pt', 'Português'],
  ['it', 'Italiano'],
  ['th', 'ไทย'],
  ['vi', 'Tiếng Việt'],
  ['ar', 'العربية'],
  ['hi', 'हिन्दी'],
];

export const THEMES = [
  ['underline', '细线下划线 / Underline'],
  ['card', '磨砂卡片 / Frosted card'],
  ['highlight', '高亮 / Highlight'],
  ['soft', '柔和灰显 / Soft'],
  ['mask', '悬停显字 / Hover reveal'],
];
