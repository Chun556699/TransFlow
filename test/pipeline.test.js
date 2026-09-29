import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chunkBySize } from '../src/background/translate.js';
import { makePool } from '../src/background/pool.js';
import { matchHost } from '../src/shared/settings.js';

const item = (t) => ({ key: 'k', text: t });

test('chunkBySize: 按数量与字符双阈值切批', () => {
  const items = ['aaaa', 'bbbb', 'cccc', 'dddd', 'eeee'].map(item);
  const b1 = chunkBySize(items, 2, 1e9);
  assert.equal(b1.length, 3);
  assert.deepEqual(b1[0].map((i) => i.text), ['aaaa', 'bbbb']);
  const b2 = chunkBySize(items, 99, 9);
  assert.equal(b2.length, 3); // 9 字符/批：每批最多 2 条
});

test('chunkBySize: 空输入', () => {
  assert.deepEqual(chunkBySize([], 5, 100), []);
});

test('makePool: 并发上限且结果有序', async () => {
  const pool = makePool(2);
  let active = 0, peak = 0;
  const out = await Promise.all(
    Array.from({ length: 6 }, (_, i) => pool(async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return i;
    })),
  );
  assert.deepEqual(out, [0, 1, 2, 3, 4, 5]);
  assert.equal(peak, 2);
});

test('matchHost: 通配匹配', () => {
  assert.equal(matchHost('www.youtube.com', ['youtube.com', '*.example.com']), true);
  assert.equal(matchHost('a.b.example.com', ['*.example.com']), true);
  assert.equal(matchHost('example.com', ['*.example.com']), true);
  assert.equal(matchHost('other.com', ['*.example.com']), false);
  assert.equal(matchHost('x', []), false);
});
