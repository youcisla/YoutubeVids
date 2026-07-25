const test = require('node:test');
const assert = require('node:assert/strict');

const { validateChapter } = require('../lib/chapter-contract');

function validChapter() {
  return {
    narration_script: 'Short narration.',
    scenes: [{
      index: 0,
      timestamp_end: 4,
      duration: 4,
      narration_text: 'Short narration.',
      html: '<h1 class="h1">Short narration.</h1>',
      animations: 'tl.set(R,{opacity:1});',
      captions: [{ start: 0, end: 4, text: 'Short narration.' }],
    }],
  };
}

test('accepts a valid chapter contract', () => {
  assert.equal(validateChapter(validChapter()), true);
});

test('rejects empty captions', () => {
  const chapter = validChapter();
  chapter.scenes[0].captions[0].text = '   ';
  assert.throws(() => validateChapter(chapter, { strict: true }), /caption 0 text/);
});

test('rejects captions outside scene duration', () => {
  const chapter = validChapter();
  chapter.scenes[0].captions[0].end = 5;
  assert.throws(() => validateChapter(chapter, { strict: true }), /exceeds duration/);
});

test('rejects inconsistent cumulative timing in strict mode', () => {
  const chapter = validChapter();
  chapter.scenes[0].timestamp_end = 3;
  assert.throws(() => validateChapter(chapter, { strict: true }), /timestamp_end/);
});
