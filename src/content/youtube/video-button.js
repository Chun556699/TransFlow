import { storageGet, storageSet } from '../../shared/browser.js';

// 视频内嵌「译」按钮：YouTube 插入播放器控制栏，其它站点悬浮在视频右上角
const SVG_NS = 'http://www.w3.org/2000/svg';

function icon() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 36 36');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.setAttribute('aria-hidden', 'true');
  const t = document.createElementNS(SVG_NS, 'text');
  for (const [k, v] of Object.entries({
    x: '18', y: '24', 'text-anchor': 'middle', 'font-size': '15', 'font-weight': '700', fill: '#fff',
    'font-family': 'PingFang SC, Microsoft YaHei, sans-serif',
  })) t.setAttribute(k, v);
  t.textContent = '译';
  svg.append(t);
  return svg;
}
const KEY = 'subOn';

export async function loadSubOn(fallback) {
  const r = await storageGet(KEY).catch(() => ({}));
  return typeof r?.[KEY] === 'boolean' ? r[KEY] : fallback;
}

export function saveSubOn(on) {
  return storageSet({ [KEY]: on }).catch(() => {});
}

export function makeButton(className, on, onToggle) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = className;
  b.title = 'TransFlow 双语字幕';
  b.setAttribute('aria-label', 'TransFlow 双语字幕');
  b.append(icon());
  setPressed(b, on);
  b.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onToggle(b.getAttribute('aria-pressed') !== 'true');
  });
  return b;
}

export function setPressed(b, on) {
  b?.setAttribute('aria-pressed', on ? 'true' : 'false');
}
