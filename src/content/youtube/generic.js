import { sendMessage } from '../../shared/browser.js';
import { MSG } from '../../shared/constants.js';
import { pairTarget } from '../../shared/lang-detect.js';
import { makeButton } from './video-button.js';

// 通用 <video>：右上角悬浮「译」按钮；开启后读取站点自带 textTracks（CC）整轨翻译，
// 复用同一 overlay 双语渲染
export function watchGenericVideos(settings, overlay, ctl) {
  const withBtn = new WeakSet();
  const done = new WeakSet();
  const tick = () => scan(settings, overlay, ctl, withBtn, done);
  const timer = setInterval(tick, 2000);
  tick();
  return () => clearInterval(timer);
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
    }
    if (!ctl.isOn() || done.has(video) || !tracks.length) continue;
    const track = tracks.find((t) => t.mode === 'showing') ?? tracks[0];
    if (track.mode === 'disabled') track.mode = settings.subtitle.hideNative ? 'hidden' : 'showing';
    if (settings.subtitle.hideNative && track.mode === 'showing') track.mode = 'hidden';
    if (!track.cues?.length) continue;
    done.add(video);
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
