import { makeProject } from '@revideo/core';
import TeaserScene from './scenes/TeaserScene';

/**
 * Chapter Zero Studio — Revideo project.
 *
 * Parametric: every variable here is overridable by `renderVideo({ variables })`
 * in render-chapter.mjs. Defaults match the Atomic Habits teaser for a
 * reproducible first render; subsequent runs override `audioPath`,
 * `audioDurationSec`, `chapterNumber`, `chapterTitle`, `captions`, and `stat`.
 */
export default makeProject({
  scenes: [TeaserScene],
  variables: {
    bookTitle: 'Atomic Habits',
    chapterNumber: 1,
    chapterTitle: 'The Surprising Power of Tiny Gains',
    audioPath: 'assets/atomic-habits-teaser.mp3',
    audioDurationSec: 13.65,
    stat: { from: '1%', to: '37×', atSec: 2.5 },
    captions: [
      { start: 0.00, end: 1.80, text: 'What if one percent... was enough?' },
      { start: 1.80, end: 3.66, text: 'Get one percent better, every day.' },
      { start: 3.66, end: 6.51, text: "After one year, you'll be thirty-seven times better." },
      { start: 6.51, end: 7.27, text: 'Small habits.' },
      { start: 7.27, end: 7.96, text: 'Big results.' },
      { start: 7.96, end: 9.30, text: 'Watch the full summary.' },
    ],
  },
  settings: {
    shared: {
      background: '#0a1633',
      range: [0, 15],
      size: { x: 1920, y: 1080 },
    },
    rendering: {
      fps: 30,
      resolutionScale: 1,
      colorSpace: 'srgb',
    },
  },
});
