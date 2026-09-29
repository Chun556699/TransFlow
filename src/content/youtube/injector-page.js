// 注入到页面主世界（MAIN world）：拦截播放器自己发出的 timedtext 请求，
// 复用其带 pot 签名的 URL 与响应，postMessage 回 content script。
(() => {
  const MATCH = '/api/timedtext';
  const post = (url, body) => {
    try {
      window.postMessage(
        { source: 'transflow', kind: 'timedtext', url: String(url), body: String(body ?? '') },
        window.location.origin,
      );
    } catch {
      /* noop */
    }
  };

  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function open(method, url, ...rest) {
    if (typeof url === 'string' && url.includes(MATCH)) {
      this.addEventListener('load', () => post(url, this.responseText));
    }
    return origOpen.call(this, method, url, ...rest);
  };

  const origFetch = window.fetch;
  window.fetch = function fetch(input, init) {
    const p = origFetch.call(this, input, init);
    try {
      const url = typeof input === 'string' ? input : input?.url;
      if (typeof url === 'string' && url.includes(MATCH)) {
        p.then((res) => res.clone().text().then((t) => post(url, t))).catch(() => {});
      }
    } catch {
      /* noop */
    }
    return p;
  };
})();
