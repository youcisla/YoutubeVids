'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { buildProportionalCaptions, kokoroCacheKey } = require('../lib/kokoro-tts');

const TEXT = "What if one percent was enough? Get one percent better each day. After one year, you're thirty-seven times better. Small habits. Big results.";

test('captions cover the full duration, in order, non-overlapping', () => {
  const dur = 10;
  const caps = buildProportionalCaptions({ text: TEXT, durationSec: dur });
  assert.ok(caps.length >= 3, 'splits into multiple captions');
  assert.equal(caps[0].start, 0);
  assert.ok(Math.abs(caps[caps.length - 1].end - dur) < 1e-6, 'last caption ends at duration');
  for (let i = 0; i < caps.length; i++) {
    assert.ok(caps[i].text.trim().length > 0, 'no empty caption');
    assert.ok(caps[i].end > caps[i].start, 'positive span');
    if (i > 0) assert.ok(caps[i].start >= caps[i - 1].end - 1e-9, 'monotonic, non-overlapping');
  }
});

test('long sentence is chunked to maxChars', () => {
  const long = 'a '.repeat(80).trim() + '.'; // ~160 chars, one sentence
  const caps = buildProportionalCaptions({ text: long, durationSec: 5, maxChars: 60 });
  assert.ok(caps.length > 1, 'over-long sentence splits');
  for (const c of caps) assert.ok(c.text.length <= 60, 'each chunk within maxChars');
});

test('cacheKey is stable and voice-sensitive', () => {
  const a = kokoroCacheKey({ text: 'x', voice: 'am_adam', speed: 1, lang: 'en-us' });
  const b = kokoroCacheKey({ text: 'x', voice: 'am_adam', speed: 1, lang: 'en-us' });
  const c = kokoroCacheKey({ text: 'x', voice: 'am_michael', speed: 1, lang: 'en-us' });
  assert.equal(a, b);
  assert.notEqual(a, c);
});
