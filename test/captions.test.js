import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCaptions, mergeSentences, trackKey } from '../src/content/youtube/captions.js';

const json3 = JSON.stringify({
  events: [
    { tStartMs: 0, dDurationMs: 800, segs: [{ utf8: 'Hello' }, { utf8: ' world' }] },
    { tStartMs: 900, dDurationMs: 800, segs: [{ utf8: 'this is a test.' }] },
    { tStartMs: 8000, dDurationMs: 1000, segs: [{ utf8: 'New sentence here.' }] },
  ],
});

const srv3 = `<timedtext><body>
  <p t="0" d="800"><s>Hello</s> <s>world</s></p>
  <p t="900" d="800">this is a test.</p>
</body></timedtext>`;

const srv1 = `<timedtext><body>
  <text start="0" dur="0.8">Hello world</text>
</body></timedtext>`;

test('parseCaptions: json3 拼接 segs', () => {
  const cues = parseCaptions(json3);
  assert.equal(cues.length, 3);
  assert.deepEqual({ start: cues[0].start, end: cues[0].end, text: cues[0].text }, {
    start: 0, end: 800, text: 'Hello world',
  });
  assert.equal(cues[2].text, 'New sentence here.');
});

const dom = typeof DOMParser !== 'undefined';
test('parseCaptions: srv3 <p t d>', { skip: !dom && 'no DOMParser in node' }, () => {
  const cues = parseCaptions(srv3);
  assert.equal(cues.length, 2);
  assert.equal(cues[0].text, 'Hello world');
  assert.equal(cues[1].start, 900);
});
test('parseCaptions: srv1 <text start dur>', { skip: !dom && 'no DOMParser in node' }, () => {
  const cues = parseCaptions(srv1);
  assert.equal(cues.length, 1);
  assert.equal(cues[0].end, 800);
});

test('parseCaptions: 非法输入返回空', () => {
  assert.deepEqual(parseCaptions('not json or xml'), []);
  assert.deepEqual(parseCaptions(''), []);
});

test('mergeSentences: 小间隔合并成句', () => {
  const merged = mergeSentences(parseCaptions(json3));
  assert.equal(merged.length, 2);
  assert.equal(merged[0].text, 'Hello world this is a test.');
  assert.equal(merged[1].text, 'New sentence here.');
});

test('trackKey: tlang 变化产生不同 key', () => {
  const a = trackKey('https://www.youtube.com/api/timedtext?v=abc&lang=en');
  const b = trackKey('https://www.youtube.com/api/timedtext?v=abc&lang=zh');
  assert.notEqual(a, b);
  assert.equal(trackKey('x'), 'x');
});
