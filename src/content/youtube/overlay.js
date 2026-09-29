// 视频字幕覆盖层：挂在播放器容器内，timeupdate 二分查找当前 cue，双语渲染
export class SubtitleOverlay {
  constructor(settings) {
    this.settings = settings;
    this.cues = [];
    this.el = null;
    this.video = null;
    this.onTime = () => this.render();
  }

  attach(video, container) {
    this.detach();
    this.video = video;
    const el = document.createElement('div');
    el.className = 'tf-sub-overlay';
    el.dataset.order = this.settings.bilingualOrder;
    el.style.fontSize = `${this.settings.fontSize}px`;
    el.style.bottom = this.settings.position === 'top' ? 'auto' : '8%';
    el.style.top = this.settings.position === 'top' ? '8%' : 'auto';
    el.style.display = 'none';
    const src = document.createElement('span');
    src.className = 'tf-sub-src';
    const tgt = document.createElement('span');
    tgt.className = 'tf-sub-tgt';
    el.append(src, tgt);
    el.style.display = 'flex';
    el.style.flexDirection = 'column';
    el.style.visibility = 'hidden';
    (container ?? video.parentElement)?.append(el);
    this.el = el;
    video.addEventListener('timeupdate', this.onTime);
    video.addEventListener('seeked', this.onTime);
  }

  updateSettings(s) {
    this.settings = s;
    if (!this.el) return;
    this.el.dataset.order = s.bilingualOrder;
    this.el.style.fontSize = `${s.fontSize}px`;
    this.el.style.bottom = s.position === 'top' ? 'auto' : '8%';
    this.el.style.top = s.position === 'top' ? '8%' : 'auto';
    this.render();
  }

  setVisible(on) {
    this.hidden = !on;
    this.render();
  }

  setCues(cues) {
    this.cues = cues;
    this.render();
  }

  render() {
    if (!this.el || !this.video) return;
    const ms = this.video.currentTime * 1000;
    const cue = this.current(ms);
    if (!cue || this.hidden) {
      this.el.style.visibility = 'hidden';
      return;
    }
    this.el.style.visibility = 'visible';
    const [srcEl, tgtEl] = this.el.children;
    const showSrc = this.settings.bilingualOrder !== 'translated-only';
    srcEl.textContent = showSrc ? cue.src : '';
    srcEl.style.display = showSrc ? '' : 'none';
    tgtEl.textContent = cue.tgt ?? cue.src;
  }

  current(ms) {
    const a = this.cues;
    let lo = 0;
    let hi = a.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (ms < a[mid].start) hi = mid - 1;
      else if (ms >= a[mid].end) lo = mid + 1;
      else return a[mid];
    }
    return null;
  }

  detach() {
    if (this.video) {
      this.video.removeEventListener('timeupdate', this.onTime);
      this.video.removeEventListener('seeked', this.onTime);
    }
    this.el?.remove();
    this.el = null;
    this.video = null;
    this.cues = [];
  }
}
