'use strict';

// ponytail: canned data for the Vercel showcase deploy. When VITE_DEMO is true,
// api.ts returns these instead of fetching /api/* (which 404s on Vercel).
// Real chapter titles from books/atomic-habits/ so the preview is recognizable.

import type { AppConfig, BookMeta, ChapterData } from '../types';

const ATOMIC_HABITS_CHAPTERS = [
  'The Surprising Power of Tiny Gains',
  'How Your Habits Shape Your Identity',
  'How to Build Better Habits in 4 Simple Steps',
  'The Man Who Didn’t Look Right',
  'The Best Way to Start a New Habit',
  'Motivation is Overrated; Environment Often Matters More',
  'The Secret to Self-Control',
  'How to Make a Habit Irresistible',
  'The Role of Family and Friends in Your Habits',
  'How to Find and Fix the Causes of Your Bad Habits',
  'Walk Slowly, but Never Backward',
  'The Law of Least Effort',
  'How to Stop Procrastinating by Using the Two-Minute Rule',
  'How to Make Good Habits Inevitable and Bad Habits Impossible',
  'The Cardinal Rule of Behavior Change',
  'How to Stick with Good Habits Every Day',
  'How an Accountability Partner Can Change Everything',
  'How to Find a Habit That Sticks',
  'The Goldilocks Rule: How to Keep Going When You Want to Quit',
  'The Downside of Creating Good Habits',
];

function makeChapterTitle(n: number) {
  return ATOMIC_HABITS_CHAPTERS[n - 1] || `Chapter ${n}`;
}

const MOCK_BOOKS: BookMeta[] = [
  {
    name: 'atomic-habits',
    title: 'Atomic Habits',
    chapters: ATOMIC_HABITS_CHAPTERS.map((title, i) => ({
      number: i + 1,
      title: makeChapterTitle(i + 1),
      sceneCount: 6 + (i % 3),
      wordCount: 380 + (i * 17) % 200,
      hasOutput: i < 2,
    })),
  },
];

const MOCK_CONFIG: AppConfig = {
  voice: 'en-US-ChristopherNeural',
  voice_rate: '-3%',
  audio_format: 'mp3',
  wpm: 164,
  fps: 30,
  quality: 'high',
  canvas_width: 1920,
  canvas_height: 1080,
  youtube: {
    publish_type: 'public',
    channel: 'Chapter Zero',
    upload_as_draft: true,
  },
};

const MOCK_CHAPTER_SCRIPT =
  "If you get one percent better each day for one year you will end up thirty seven times better. " +
  "Conversely if you get one percent worse each day for one year you will decline nearly down to zero. " +
  "That is the mathematics of tiny habits. We expect progress to be linear. We put in the work and " +
  "expect results immediately. When they do not arrive we quit. We fail to see that habits are " +
  "the compound interest of self improvement. Getting one percent better matters because it multiplies. " +
  "This is why patience matters as much as effort. Winners and losers have the same goals. What " +
  "separates them is not the goal but the system.";

function makeMockChapter(book: string, num: number): ChapterData {
  return {
    book_title: 'Atomic Habits',
    cover_ext: 'svg',
    chapter: num,
    chapter_title: makeChapterTitle(num),
    narration_script: MOCK_CHAPTER_SCRIPT,
    scene_count: 6,
    scenes: Array.from({ length: 6 }, (_, i) => ({
      index: i,
      timestamp_end: (i + 1) * 6,
      duration: 6,
      html: `<h1>Scene ${i + 1}</h1>`,
      animations: `tl.from('.h1',{opacity:0,duration:1})`,
      captions: [{ start: i * 6, end: (i + 1) * 6, text: `Scene ${i + 1} narration` }],
    })),
  };
}

// ponytail: simulated build log. Streams realistic-looking lines on a timer
// so the UI's live-log component lights up exactly like a real run.
const SIM_BUILD_LINES = [
  '[tts]   synth text → wav via Kokoro (am_adam)',
  '[tts]   duration measured: 9.3s',
  '[tts]   ffmpeg wav → mp3 (libmp3lame, qscale=2)',
  '[tts]   wrote ChapterZero/assets/atomic-habits-teaser.mp3 (130K)',
  '[srt]   derived 6 captions, wrote atomic-habits-teaser.mp3.srt',
  '[thumb] sharp SVG composite → 1280x720 PNG (71K)',
  '[hf]    rendering ChapterZero/compositions/captions.html → 0.png',
  '[hf]    rendering ChapterZero/compositions/intro.html → 1.png',
  '[hf]    rendering ChapterZero/compositions/stats.html → 2.png',
  '[hf]    capturing 450 frames at 30fps (5 workers)',
  '[hf]    static-dedup: reused 116/180 frame(s) (64%)',
  '[hf]    encoding video (H.264, AAC, 1.15 Mbps)',
  '[hf]    assembling final mp4',
  '[done]  ✓ ChapterZero/renders/atomic-habits-teaser.mp4 (2.1 MB, 15.0s)',
];

export function mockInitializeSession(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 80));
}

export function mockFetchBooks(): Promise<BookMeta[]> {
  return new Promise((resolve) => setTimeout(() => resolve(MOCK_BOOKS), 120));
}

export function mockFetchChapter(book: string, num: number): Promise<ChapterData> {
  return new Promise((resolve) => setTimeout(() => resolve(makeMockChapter(book, num)), 100));
}

export function mockFetchConfig(): Promise<AppConfig> {
  return new Promise((resolve) => setTimeout(() => resolve(MOCK_CONFIG), 100));
}

export function mockSaveConfig(config: AppConfig): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 120));
}

// ponytail: "simulated build" — emit SIM_BUILD_LINES on a 220ms cadence for
// ~3s, then resolve with a placeholder mp4 URL (the real chapter sample).
// The cancel handle is an idempotent stop() the caller can invoke.
export function mockStartBuild(
  _book: string,
  _chapter: number,
  _flags: { keepTemp: boolean; noWhisper: boolean; upload: boolean },
  onLog: (line: string) => void,
  onDone: (url?: string) => void,
  onError: (err: string) => void
): () => void {
  let idx = 0;
  let stopped = false;
  const tick = () => {
    if (stopped) return;
    if (idx >= SIM_BUILD_LINES.length) {
      onDone('https://www.youtube.com/@chapterzer');
      return;
    }
    onLog(SIM_BUILD_LINES[idx++]);
    setTimeout(tick, 220);
  };
  setTimeout(tick, 100);
  return () => { stopped = true; };
}

export const IS_DEMO = ((): boolean => {
  // ponytail: import.meta.env is a Vite compile-time constant. VITE_DEMO is
  // set in vercel.json's build env. Local dev leaves it unset, so the UI
  // always talks to the real Express backend.
  try {
    // @ts-ignore — import.meta.env injected by Vite at build time
    return (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_DEMO === 'true');
  } catch {
    return false;
  }
})();
