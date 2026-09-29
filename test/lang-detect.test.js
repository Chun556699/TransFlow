import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guessLang, sameLang, isTranslatableText } from '../src/shared/lang-detect.js';

test('guessLang: 区分简繁中文', () => {
  assert.equal(guessLang('这是一个简体中文字符串，包含常见字。'), 'zh-CN');
  assert.equal(guessLang('這是一個繁體中文字符串，包含常見字。'), 'zh-TW');
});

test('guessLang: 英日韩', () => {
  assert.equal(guessLang('The quick brown fox jumps over the lazy dog.'), 'en');
  assert.equal(guessLang('これは日本語のテスト文章です。'), 'ja');
  assert.equal(guessLang('이것은 한국어 테스트 문장입니다.'), 'ko');
});

test('sameLang: 简繁不互判同语种', () => {
  assert.equal(sameLang('zh-CN', 'zh-CN'), true);
  assert.equal(sameLang('zh-CN', 'zh-TW'), false);
  assert.equal(sameLang('zh-TW', 'zh-Hant'), true);
  assert.equal(sameLang('en', 'en-US'), true);
  assert.equal(sameLang('en', 'ja'), false);
});

test('isTranslatableText: 过滤垃圾文本', () => {
  assert.equal(isTranslatableText('Hello world'), true);
  assert.equal(isTranslatableText('   '), false);
  assert.equal(isTranslatableText('12345'), false);
  assert.equal(isTranslatableText('https://example.com/path'), false);
  assert.equal(isTranslatableText('｜｜｜---'), false);
});

test('pairTarget: 中文→英文，其它→目标语', async () => {
  const { pairTarget } = await import('../src/shared/lang-detect.js');
  assert.equal(pairTarget('今天天气很好', 'zh-CN'), 'en');
  assert.equal(pairTarget('The weather is nice', 'zh-CN'), 'zh-CN');
  assert.equal(pairTarget('こんにちは世界', 'zh-CN'), 'zh-CN');
  assert.equal(pairTarget('Hello there', 'en'), 'zh-CN');
});
