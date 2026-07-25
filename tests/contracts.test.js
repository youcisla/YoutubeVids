const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { validateConfig, isPathInside } = require('../lib/contracts');

const validConfig = {
  voice: 'en-US-GuyNeural',
  voice_rate: '-3%',
  audio_format: 'wav',
  wpm: 164,
  fps: 30,
  quality: 'high',
  canvas_width: 1920,
  canvas_height: 1080,
  bg_music: null,
  youtube: { publish_type: 'public', channel: 'Books', upload_as_draft: true },
};

test('accepts known config keys', () => {
  assert.deepEqual(validateConfig(validConfig), validConfig);
});

test('rejects unknown config keys', () => {
  assert.throws(() => validateConfig({ ...validConfig, shell_command: 'whoami' }), /Unknown config key/);
});

test('rejects unsafe whisper model names', () => {
  assert.throws(
    () => validateConfig({ ...validConfig, whisper: { model_size: 'base\"); import os' } }),
    /whisper.model_size/,
  );
});

test('path containment rejects sibling-prefix and traversal paths', () => {
  const root = path.resolve('books');
  assert.equal(isPathInside(root, path.join(root, 'atomic-habits', 'chapter-01.json')), true);
  assert.equal(isPathInside(root, path.resolve('books-evil', 'secret.json')), false);
  assert.equal(isPathInside(root, path.resolve(root, '..', 'config.json')), false);
});
