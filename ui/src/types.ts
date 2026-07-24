export interface BookMeta {
  name: string;
  title: string;
  chapters: ChapterMeta[];
}

export interface ChapterMeta {
  number: number;
  title: string;
  sceneCount: number;
  wordCount: number;
  hasOutput: boolean;
}

export interface ChapterData {
  book_title: string;
  cover_ext: string;
  chapter: number;
  chapter_title: string;
  narration_script: string;
  scene_count: number;
  scenes: SceneData[];
}

export interface SceneData {
  index: number;
  timestamp_end: number;
  duration: number;
  html: string;
  animations: string;
  captions: CaptionEntry[];
}

export interface CaptionEntry {
  start: number;
  end: number;
  text: string;
}

export interface AppConfig {
  voice: string;
  voice_rate: string;
  audio_format: string;
  wpm: number;
  fps: number;
  quality: string;
  canvas_width: number;
  canvas_height: number;
  youtube?: {
    publish_type: string;
    channel: string;
    upload_as_draft: boolean;
  };
}

export interface BuildOptions {
  book: string;
  chapter: number;
  keepTemp: boolean;
  noWhisper: boolean;
  upload: boolean;
}

export type BuildStatus = 'idle' | 'building' | 'done' | 'error';

export interface BuildLog {
  session: string;
  lines: LogLine[];
}

export interface LogLine {
  timestamp: number;
  text: string;
  level: 'info' | 'warn' | 'error' | 'system';
}
