const path = require('node:path');

const CONFIG_KEYS = new Set([
  'voice', 'voice_rate', 'audio_format', 'wpm', 'fps', 'quality',
  'canvas_width', 'canvas_height', 'bg_music', 'youtube', 'whisper', 'gsap_source',
]);
const WHISPER_MODELS = new Set(['tiny', 'base', 'small', 'medium', 'large-v2', 'large-v3']);

function assertType(condition, field) {
  if (!condition) throw new Error(`Invalid config field: ${field}`);
}

function validateConfig(config) {
  assertType(config && typeof config === 'object' && !Array.isArray(config), 'root');
  for (const key of Object.keys(config)) {
    if (!CONFIG_KEYS.has(key)) throw new Error(`Unknown config key: ${key}`);
  }
  assertType(typeof config.voice === 'string' && config.voice.length > 0, 'voice');
  assertType(/^[-+]?\d+%$/.test(config.voice_rate), 'voice_rate');
  assertType(config.audio_format === 'wav', 'audio_format');
  assertType(Number.isInteger(config.wpm) && config.wpm > 0, 'wpm');
  assertType(Number.isInteger(config.fps) && config.fps >= 1 && config.fps <= 120, 'fps');
  assertType(['low', 'medium', 'high'].includes(config.quality), 'quality');
  assertType(Number.isInteger(config.canvas_width) && config.canvas_width > 0, 'canvas_width');
  assertType(Number.isInteger(config.canvas_height) && config.canvas_height > 0, 'canvas_height');
  assertType(config.bg_music === null || typeof config.bg_music === 'string', 'bg_music');
  if (config.gsap_source !== undefined) assertType(typeof config.gsap_source === 'string', 'gsap_source');
  if (config.whisper !== undefined) {
    assertType(config.whisper && typeof config.whisper === 'object' && !Array.isArray(config.whisper), 'whisper');
    assertType(WHISPER_MODELS.has(config.whisper.model_size), 'whisper.model_size');
  }
  if (config.youtube !== undefined) {
    assertType(config.youtube && typeof config.youtube === 'object', 'youtube');
    assertType(['public', 'unlisted', 'private'].includes(String(config.youtube.publish_type).toLowerCase()), 'youtube.publish_type');
    assertType(typeof config.youtube.channel === 'string', 'youtube.channel');
    assertType(typeof config.youtube.upload_as_draft === 'boolean', 'youtube.upload_as_draft');
  }
  return config;
}

function isPathInside(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative);
}

module.exports = { validateConfig, isPathInside };
