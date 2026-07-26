'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { classifyHook, validateChapterFirstScene } = require('../lib/hook-validator');

test('classifies a direct question', () => {
  const v = classifyHook('What if one percent held for a year?');
  assert.equal(v.isHook, true);
  assert.equal(v.kind, 'question');
});

test('classifies a counter-intuitive opener', () => {
  assert.equal(classifyHook('What if the answer was simpler than you think?').isHook, true);
  assert.equal(classifyHook('Most people get this backwards.').isHook, true);
  assert.equal(classifyHook('But here is the thing nobody tells you.').isHook, true);
  assert.equal(classifyHook('Imagine if every day you got 1% better.').isHook, true);
});

test('classifies a stat-led opener', () => {
  assert.equal(classifyHook('One percent better each day for one year.').isHook, true);
  assert.equal(classifyHook('After 365 days, 37x better.').isHook, true);
  assert.equal(classifyHook('97% of people fail at this.').isHook, true);
});

test('rejects a plain statement with no question, stat, or counter framing', () => {
  const v = classifyHook('Every action you take is a vote for the type of person you wish to become.');
  assert.equal(v.isHook, false);
  assert.equal(v.kind, 'unrecognized');
});

test('rejects empty / non-string', () => {
  assert.equal(classifyHook('').isHook, false);
  assert.equal(classifyHook(null).isHook, false);
  assert.equal(classifyHook(undefined).isHook, false);
});

test('validateChapterFirstScene returns ok for a chapter with hook-first scene', () => {
  const chapter = {
    scenes: [{ index: 0, narration_text: 'What if one percent held for a year?' }],
  };
  const v = validateChapterFirstScene(chapter);
  assert.equal(v.ok, true);
  assert.equal(v.kind, 'question');
});

test('validateChapterFirstScene flags a chapter with no hook', () => {
  const chapter = {
    scenes: [{ index: 0, narration_text: 'Every action is a vote for who you wish to become.' }],
  };
  const v = validateChapterFirstScene(chapter);
  assert.equal(v.ok, false);
  assert.equal(v.reason, 'no_hook');
});

test('validateChapterFirstScene handles missing scenes', () => {
  assert.equal(validateChapterFirstScene(null).ok, false);
  assert.equal(validateChapterFirstScene({ scenes: [] }).ok, false);
});

test('all shipped atomic-habits chapters are audited (results are advisory, not gate)', () => {
  const dir = path.join(__dirname, '..', 'books', 'atomic-habits');
  const files = fs.readdirSync(dir).filter(f => /^chapter-\d+\.json$/.test(f));
  assert.ok(files.length >= 15, 'expected at least 15 chapter JSONs');
  let passing = 0;
  for (const f of files) {
    const c = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    if (validateChapterFirstScene(c).ok) passing++;
  }
  assert.ok(passing >= 1, `at least one chapter should pass (got ${passing}/${files.length})`);
});
