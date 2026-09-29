import { sendMessage } from '../../shared/browser.js';
import { MSG } from '../../shared/constants.js';

// 通用 <video> 兜底：站点自带 textTracks（CC）时，整轨翻译后复用同一 overlay 渲染
export function watchGenericVideos(settings, overlay) {
  const seen = new WeakSet();
  const timer = setInterval(() => scan(settings, overlay, seen), 3000);
  scan(settings, overlay, seen);
  return () => clearInterval(timer);
}

function scan(settings, overlay, seen) {
  for (const video of document.querySelectorAll('video')) {
    if (seen.has(video)) continue;
    const track = [...(video.textTracks ?? [])].find((t) => t.mode === 'showing');
    if (!track?.cues?.length) continue;
    seen.add(video);
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
  const resp = await sendMessage({
    type: MSG.TRANSLATE,
    to: settings.targetLang,
    items: cues.map((c, i) => ({ key: `c${i}`, text: c.src })),
  }).catch(() => null);
  const results = resp?.results ?? {};
  cues.forEach((c, i) => {
    c.tgt = results[`c${i}`] ?? null;
  });
  overlay.setCues(cues);
}
