// 块级候选元素：拥有独立文本段落的元素。内联元素(a/button/label)单独成段，
// 其余内联元素(span/b/i/em...)的文本并入外层段。
const SEG_SEL =
  'p,li,dd,dt,blockquote,h1,h2,h3,h4,h5,h6,td,th,figcaption,caption,summary,' +
  'legend,div,section,article,aside,nav,header,footer,main,a,button,label';
const INLINE_SEG = new Set(['A', 'BUTTON', 'LABEL']);
const EXCLUDE_SEL =
  'script,style,code,pre,kbd,samp,textarea,svg,math,noscript,template,' +
  'iframe,select,input,option,[translate="no"],.notranslate,[contenteditable="true"],' +
  '.tf-translation,.tf-injector';

let processed = new WeakSet();

export function resetProcessed() {
  processed = new WeakSet();
}

export function isExcluded(el) {
  return el.nodeType !== 1 || el.matches(EXCLUDE_SEL) || !!el.closest(EXCLUDE_SEL);
}

// 元素自身文本：合并直接文本节点与内联后代文本，跳过嵌套段元素/排除区/已插入译文
function ownText(el) {
  let out = '';
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      out += ' ' + node.nodeValue;
    } else if (
      node.nodeType === Node.ELEMENT_NODE &&
      !node.matches(EXCLUDE_SEL) &&
      !node.matches(SEG_SEL)
    ) {
      out += ' ' + ownText(node);
    }
  }
  return out.replace(/\s+/g, ' ').trim();
}

export function collectBlocks(root, out = []) {
  if (root.nodeType !== 1 && root.nodeType !== 9) return out;
  const scope = root === document ? document.body : root;
  if (!scope) return out;
  const roots =
    scope.nodeType === 1 && scope.matches?.(SEG_SEL)
      ? [scope, ...scope.querySelectorAll(SEG_SEL)]
      : scope.querySelectorAll(SEG_SEL);
  for (const el of roots) {
    if (processed.has(el) || isExcluded(el)) continue;
    const text = ownText(el);
    if (text) {
      processed.add(el);
      out.push({ el, text });
    }
  }
  return out;
}

// 译文插入：内联元素插为后兄弟节点（避免链接内可点），块元素追加进内部末尾
export function insertTranslation(el, text) {
  const node = document.createElement('span');
  node.className = 'tf-translation';
  node.textContent = text;
  if (INLINE_SEG.has(el.tagName)) {
    el.insertAdjacentElement('afterend', node);
  } else {
    el.append(node);
  }
}

export function clearTranslations() {
  for (const n of document.querySelectorAll('.tf-translation')) n.remove();
}

export function segmentCount() {
  return document.querySelectorAll('.tf-translation').length;
}
