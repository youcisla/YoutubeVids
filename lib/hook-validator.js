'use strict';

// ponytail: hook validator for the first scene of a chapter. A "hook" is a
// narrative opener designed to retain viewers in the first 30s — the window
// YouTube's algorithm rewards per Hypefury 2025 + vidIQ. The validator
// recognizes three hook shapes:
//   1. Direct question (ends with ? or starts with question words)
//   2. Bold claim (contains a number, statistic, or "1%", "X times")
//   3. Counter-intuitive framing (starts with "What if", "Imagine", "But",
//      "Most people", "The truth is")
// Pure function — no I/O — so it's trivially testable and reusable from the
// chapter builder, the YouTube uploader, and the test suite.

const QUESTION_PREFIXES = [
  'what if', 'why', 'how', 'when', 'where', 'who',
  'is', 'are', 'do', 'does', 'did', 'can', 'could', 'should', 'would',
  'will', 'have', 'has', 'imagine',
];

const COUNTER_PREFIXES = [
  'what if', 'imagine', 'but', 'most people', 'the truth is',
  'here\'s the thing', 'contrary to', 'everyone thinks',
];

const STAT_PATTERN = /(\d+%|x\s*times|\d+\s*times|\d{2,}|\$[\d,]+|one percent|thirty-seven|37x)/i;

function classifyHook(text) {
  if (typeof text !== 'string' || text.trim().length === 0) {
    return { isHook: false, kind: 'empty' };
  }
  const trimmed = text.trim();
  const firstSentence = trimmed.split(/(?<=[.!?])\s+/)[0] || trimmed;
  const lower = firstSentence.toLowerCase();

  if (firstSentence.endsWith('?')) {
    return { isHook: true, kind: 'question', opener: firstSentence };
  }
  for (const q of QUESTION_PREFIXES) {
    if (lower.startsWith(q + ' ')) {
      return { isHook: true, kind: 'question', opener: firstSentence };
    }
  }
  for (const c of COUNTER_PREFIXES) {
    if (lower.startsWith(c)) {
      return { isHook: true, kind: 'counter', opener: firstSentence };
    }
  }
  if (STAT_PATTERN.test(firstSentence)) {
    return { isHook: true, kind: 'stat', opener: firstSentence };
  }
  return { isHook: false, kind: 'unrecognized', opener: firstSentence };
}

function validateChapterFirstScene(chapter) {
  if (!chapter || !Array.isArray(chapter.scenes) || chapter.scenes.length === 0) {
    return { ok: false, reason: 'no_scenes', scene: null };
  }
  const scene0 = chapter.scenes[0];
  const text = scene0.narration_text || '';
  const verdict = classifyHook(text);
  if (verdict.isHook) {
    return { ok: true, scene: scene0, ...verdict };
  }
  return { ok: false, reason: 'no_hook', scene: scene0, ...verdict };
}

module.exports = { classifyHook, validateChapterFirstScene };
