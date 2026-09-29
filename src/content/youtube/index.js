import { api, sendMessage } from '../../shared/browser.js';
import { MSG } from '../../shared/constants.js';
import { parseCaptions, mergeSentences, trackKey } from './captions.js';
import { SubtitleOverlay } from './overlay.js';
import { watchGenericVideos } from './generic.js';

// YouTube 字幕翻译：拦截播放器 timedtext 请求（自带 pot 签名），
// 解析 json3 → 断句合并 → 批量翻译 → 自绘双语字幕层
export class YoutubeSubs {
  constructor(settings) {
    this.settings = settings;
    this.overlay = new SubtitleOverlay(settings.subtitle);
    this.seen = new Set();
    this.videoId = null;
    this.onMessage = (e) => this.handleMessage(e);
    this.onNavigate = () => this.reset();
    this.stopGeneric = null;
  }

  start() {
    if (location.hostname.endsWith('youtube.com')) {
      this.inject();
      window.addEventListener('message', this.onMessage);
      window.addEventListener('yt-navigate-finish', this.onNavigate);
      if (this.settings.subtitle.hideNative) this.hideNative();
    } else if (this.settings.subtitle.genericVideo) {
      this.stopGeneric = watchGenericVideos(this.settings, this.overlay);
    }
  }

  stop() {
    window.removeEventListener('message', this.onMessage);
    window.removeEventListener('yt-navigate-finish', this.onNavigate);
    this.overlay.detach();
    this.stopGeneric?.();
    document.getElementById('tf-hide-native')?.remove();
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
    this.seen.add(key);
    const u = new URL(d.url);
    if (u.searchParams.get('tlang')) return; // 播放器自带的机翻轨，跳过
    const videoId = u.searchParams.get('v');
    if (videoId && videoId !== this.videoId) this.videoId = videoId;
    void this.processTrack(d.body);
  }

  async processTrack(body) {
    let cues = parseCaptions(body);
    if (!cues.length) return;
    cues = mergeSentences(cues);
    const video = document.querySelector('video.html5-main-video') ?? document.querySelector('video');
    const container = document.querySelector('.html5-video-player');
    if (!video || !container) return;
    this.overlay.attach(video, container);
    const ocues = cues.map((c) => ({ ...c, src: c.text, tgt: null }));
    this.overlay.setCues(ocues);

    // 分批翻译整轨
    const CHUNK = 30;
    for (let i = 0; i < cues.length; i += CHUNK) {
      const slice = cues.slice(i, i + CHUNK);
      let resp;
      try {
        resp = await sendMessage({
          type: MSG.TRANSLATE,
          to: this.settings.targetLang,
          items: slice.map((c, j) => ({ key: `c${i + j}`, text: c.text })),
        });
      } catch {
        continue;
      }
      const results = resp?.results ?? {};
      slice.forEach((_, j) => {
        ocues[i + j].tgt = results[`c${i + j}`] ?? null;
      });
      this.overlay.setCues(ocues);
    }
  }

  reset() {
    this.seen.clear();
    this.videoId = null;
    this.overlay.detach();
  }
}
