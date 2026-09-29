import { api, sendMessage } from '../../shared/browser.js';
import { MSG } from '../../shared/constants.js';
import { pairTarget } from '../../shared/lang-detect.js';
import { parseCaptions, mergeSentences, trackKey } from './captions.js';
import { SubtitleOverlay } from './overlay.js';
import { watchGenericVideos } from './generic.js';
import { loadSubOn, saveSubOn, makeButton, setPressed } from './video-button.js';

// YouTube 字幕翻译：拦截播放器 timedtext 请求（自带 pot 签名），
// 解析 json3 → 断句合并 → 批量翻译 → 自绘双语字幕层；控制栏「译」按钮开关
export class YoutubeSubs {
  constructor(settings) {
    this.settings = settings;
    this.overlay = new SubtitleOverlay(settings.subtitle);
    this.seen = new Set();
    this.pending = null;
    this.on = false;
    this.btns = new Set();
    this.btnTimer = 0;
    this.onMessage = (e) => this.handleMessage(e);
    this.onNavigate = () => this.reset();
    this.stopGeneric = null;
  }

  get isYoutube() {
    return location.hostname.endsWith('youtube.com');
  }

  async start() {
    if (this.isYoutube) {
      this.inject();
      window.addEventListener('message', this.onMessage);
    }
    this.on = await loadSubOn(this.settings.subtitle.enabled);
    const ctl = {
      isOn: () => this.on,
      toggle: (on) => this.toggle(on),
      register: (b) => this.btns.add(b),
    };
    if (this.isYoutube) {
      window.addEventListener('yt-navigate-finish', this.onNavigate);
      this.ensureButton();
      this.watchControls();
      this.apply();
    } else if (this.settings.subtitle.genericVideo) {
      this.stopGeneric = watchGenericVideos(this.settings, this.overlay, ctl);
    }
  }

  stop() {
    window.removeEventListener('message', this.onMessage);
    window.removeEventListener('yt-navigate-finish', this.onNavigate);
    this.mo?.disconnect();
    for (const b of this.btns) b.remove();
    this.btns.clear();
    this.overlay.detach();
    this.stopGeneric?.();
    document.getElementById('tf-hide-native')?.remove();
  }

  toggle(on) {
    this.on = on;
    void saveSubOn(on);
    for (const b of this.btns) setPressed(b, on);
    this.apply();
  }

  apply() {
    this.overlay.setVisible(this.on);
    if (!this.isYoutube) return;
    if (!this.on) {
      document.getElementById('tf-hide-native')?.remove();
      return;
    }
    if (this.settings.subtitle.hideNative) this.hideNative();
    this.enableCaptions();
    if (this.pending && !this.seen.has(this.pending.key)) {
      this.seen.add(this.pending.key);
      void this.processTrack(this.pending.body);
    }
    this.pending = null;
  }

  // 播放器 CC 未开时不会请求 timedtext：替用户按下 CC；
  // 已开但字幕请求早于注入脚本时，关再开一次让播放器重新拉取
  enableCaptions() {
    const cc = document.querySelector('.ytp-subtitles-button');
    if (!cc) return;
    if (cc.getAttribute('aria-pressed') === 'false') {
      cc.click();
      return;
    }
    clearTimeout(this.refetchTimer);
    this.refetchTimer = setTimeout(() => {
      if (!this.on || this.seen.size || cc.getAttribute('aria-pressed') !== 'true') return;
      cc.click();
      setTimeout(() => cc.click(), 300);
    }, 2500);
  }

  ensureButton() {
    const bar = document.querySelector('.ytp-right-controls');
    if (!bar || bar.querySelector('.tf-yt-btn')) return;
    const b = makeButton('ytp-button tf-yt-btn', this.on, (on) => this.toggle(on));
    this.btns.add(b);
    bar.prepend(b);
  }

  inject() {
    if (document.getElementById('tf-injector')) return;
    const s = document.createElement('script');
    s.id = 'tf-injector';
    s.src = api.runtime.getURL('injector-page.js');
    (document.head ?? document.documentElement).append(s);
  }

  hideNative() {
    if (document.getElementById('tf-hide-native')) return;
    const css = document.createElement('style');
    css.id = 'tf-hide-native';
    css.textContent =
      '.ytp-caption-segment,.caption-window,.ytp-caption-window-container{display:none!important}';
    document.head.append(css);
  }

  handleMessage(e) {
    const d = e.data;
    if (e.origin !== location.origin || d?.source !== 'transflow' || d.kind !== 'timedtext') return;
    const key = trackKey(d.url);
    if (this.seen.has(key)) return;
    if (new URL(d.url).searchParams.get('tlang')) return; // 播放器自带的机翻轨，跳过
    if (!this.on) {
      this.pending = { key, body: d.body };
      return;
    }
    this.seen.add(key);
    void this.processTrack(d.body);
  }

  // 播放器控制栏重建频繁：MutationObserver 防抖检查，不轮询
  watchControls() {
    let t = 0;
    this.mo = new MutationObserver(() => {
      if (document.querySelector('.ytp-right-controls .tf-yt-btn')) return;
      clearTimeout(t);
      t = setTimeout(() => this.ensureButton(), 250);
    });
    this.mo.observe(document.documentElement, { childList: true, subtree: true });
  }

  async processTrack(body) {
    let cues = parseCaptions(body);
    if (!cues.length) return;
    cues = mergeSentences(cues);
    const video = document.querySelector('video.html5-main-video') ?? document.querySelector('video');
    const container = document.querySelector('.html5-video-player');
    if (!video || !container) return;
    this.overlay.attach(video, container);
    this.overlay.setVisible(this.on);
    const ocues = cues.map((c) => ({ ...c, src: c.text, tgt: null }));
    this.overlay.setCues(ocues);
    const to = pairTarget(
      cues
        .slice(0, 20)
        .map((c) => c.text)
        .join(' '),
      this.settings.targetLang,
    );

    const CHUNK = 30;
    const chunks = [];
    for (let i = 0; i < cues.length; i += CHUNK) chunks.push(i);
    let cursor = 0;
    const runOne = async () => {
      while (cursor < chunks.length) {
        const i = chunks[cursor++];
        const slice = cues.slice(i, i + CHUNK);
        const resp = await sendMessage({
          type: MSG.TRANSLATE,
          to,
          items: slice.map((c, j) => ({ key: `c${i + j}`, text: c.text })),
        }).catch(() => null);
        const results = resp?.results ?? {};
        slice.forEach((_, j) => {
          ocues[i + j].tgt = results[`c${i + j}`] ?? null;
        });
        this.overlay.setCues(ocues);
      }
    };
    await Promise.all([runOne(), runOne(), runOne()]);
  }

  reset() {
    this.seen.clear();
    this.pending = null;
    this.overlay.detach();
    if (this.on) setTimeout(() => this.enableCaptions(), 1200);
  }
}
