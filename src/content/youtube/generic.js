import { sendMessage } from '../../shared/browser.js';
import { MSG } from '../../shared/constants.js';
import { pairTarget } from '../../shared/lang-detect.js';
import { makeButton } from './video-button.js';

// 通用 <video>：右上角悬浮「译」按钮；开启后读取站点自带 textTracks（CC）整轨翻译，
// 复用同一 overlay 双语渲染
export function watchGenericVideos(settings, overlay, ctl) {
  const withBtn = new WeakSet();
  const done = new WeakMap(); // video -> 轨道签名，换源后重译
  const tick = () => scan(settings, overlay, ctl, withBtn, done);
  let t = 0;
  const schedule = () => {
    clearTimeout(t);
    t = setTimeout(tick, 300);
  };
  const mo = new MutationObserver(schedule);
  mo.observe(document.documentElement, { childList: true, subtree: true });
  tick();
  return () => {
    mo.disconnect();
    clearTimeout(t);
  };
}

function scan(settings, overlay, ctl, withBtn, done) {
  for (const video of document.querySelectorAll('video')) {
    const box = video.parentElement;
    if (!box || video.offsetWidth < 200) continue;
    const tracks = [...(video.textTracks ?? [])].filter((t) => /subtitles|captions/.test(t.kind));
    if (!withBtn.has(video)) {
      withBtn.add(video);
      if (getComputedStyle(box).position === 'static') box.style.position = 'relative';
      const b = makeButton('tf-vbtn', ctl.isOn(), (on) => ctl.toggle(on));
      ctl.register(b);
      box.append(b);
      video.addEventListener('loadstart', () => done.delete(video));
    }
    if (!ctl.isOn() || !tracks.length) continue;
    const track = tracks.find((t) => t.mode === 'showing') ?? tracks[0];
    if (track.mode === 'disabled') track.mode = settings.subtitle.hideNative ? 'hidden' : 'showing';
    if (settings.subtitle.hideNative && track.mode === 'showing') track.mode = 'hidden';
    if (!track.cues?.length) continue;
    const sig = `${video.currentSrc || video.src}|${track.srclang}|${track.src}`;
    if (done.get(video) === sig) continue;
    done.set(video, sig);
    void translateTrack(video, track, settings, overlay);
  }
}

async function translateTrack(video, track, settings, overlay) {
  const cues = [...track.cues].map((c) => ({
    start: c.startTime * 1000,
    end: c.endTime * 1000,
    src: (c.text ?? '').replace(/<[^>]+>/g, '').trim(),
    tgt: null,
  }));
  if (!cues.length) return;
  overlay.attach(video, video.parentElement);
  overlay.setCues(cues);
  const to = pairTarget(
    cues
      .slice(0, 20)
      .map((c) => c.src)
      .join(' '),
    settings.targetLang,
  );
  const resp = await sendMessage({
    type: MSG.TRANSLATE,
    to,
    items: cues.map((c, i) => ({ key: `c${i}`, text: c.src })),
  }).catch(() => null);
  const results = resp?.results ?? {};
  cues.forEach((c, i) => {
    c.tgt = results[`c${i}`] ?? null;
  });
  overlay.setCues(cues);
}
