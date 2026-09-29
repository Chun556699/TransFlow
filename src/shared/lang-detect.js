const RANGES = [
  [/[\u3040-\u30ff]/, 'ja'],
  [/[\uac00-\ud7af]/, 'ko'],
  [/[\u4e00-\u9fff]/, 'zh'],
  [/[\u0400-\u04ff]/, 'ru'],
  [/[\u0600-\u06ff]/, 'ar'],
  [/[\u0e00-\u0e7f]/, 'th'],
  [/[\u0900-\u097f]/, 'hi'],
];

const SIMP_ONLY = '体学为国发么丽后点对开关台万与们会这爱没现经术门问题电话时间国家语言单车马鸟鱼贝见页风飞几书龙';
const TRAD_ONLY = '體學為國發麼麗後點對開關臺萬與們會這愛沒現經術門問題電話時間國家語言單車馬鳥魚貝見頁風飛幾書龍';

function zhVariant(sample) {
  let s = 0;
  let t = 0;
  for (const ch of sample) {
    if (SIMP_ONLY.includes(ch)) s += 1;
    else if (TRAD_ONLY.includes(ch)) t += 1;
  }
  if (t > s) return 'zh-TW';
  return 'zh-CN';
}

export function guessLang(text) {
  const sample = text.slice(0, 400);
  for (const [re, code] of RANGES) {
    if (re.test(sample)) return code === 'zh' ? zhVariant(sample) : code;
  }
  if (/[a-zA-Z]/.test(sample)) {
    if (/[àâäçéèêëîïôöùûüÿœæ]/i.test(sample)) return 'fr';
    if (/[äöüß]/i.test(sample)) return 'de';
    if (/[áéíóúñü¿¡]/i.test(sample)) return 'es';
    return 'en';
  }
  return 'und';
}

export function sameLang(a, b) {
  if (!a || !b || a === 'und' || b === 'und' || a === 'auto') return false;
  if (a === b) return true;
  const ap = a.split('-')[0];
  const bp = b.split('-')[0];
  if (ap !== bp) return false;
  // zh 简体↔繁体需互译：两侧繁体属性一致才算同语
  if (ap === 'zh') return /tw|hk|hant/i.test(a) === /tw|hk|hant/i.test(b);
  return true;
}

const JUNK = /^[\s\d\p{P}\p{S}\p{Emoji_Presentation}\uFE0F]+$/u;
const URLISH = /^(https?:\/\/|www\.)\S+$|^\S+@\S+\.\S+$/;

export function isTranslatableText(text) {
  const t = text.trim();
  if (t.length < 2) return false;
  if (JUNK.test(t)) return false;
  if (URLISH.test(t)) return false;
  if (!/\p{L}/u.test(t)) return false;
  return true;
}

// 双向目标语：原文已是目标语（如中文）时反向译成英文，否则译为目标语
export function pairTarget(text, targetLang) {
  const src = guessLang(text);
  if (!sameLang(src, targetLang)) return targetLang;
  return targetLang.startsWith('en') ? 'zh-CN' : 'en';
}
