import type { AppConfig, BookMeta, ChapterData } from '../types';

const BASE = '/api';

export async function initializeSession(): Promise<void> {
  const res = await fetch(`${BASE}/session`);
  if (!res.ok) throw new Error(`Failed to start local session: ${res.statusText}`);
}

export async function fetchBooks(): Promise<BookMeta[]> {
  const res = await fetch(`${BASE}/books`);
  if (!res.ok) throw new Error(`Failed to fetch books: ${res.statusText}`);
  return res.json();
}

export async function fetchChapter(book: string, chapter: number): Promise<ChapterData> {
  const res = await fetch(`${BASE}/books/${book}/${String(chapter).padStart(2, '0')}.json`);
  if (!res.ok) throw new Error(`Failed to fetch chapter: ${res.statusText}`);
  return res.json();
}

export async function fetchConfig(): Promise<AppConfig> {
  const res = await fetch(`${BASE}/config`);
  if (!res.ok) throw new Error(`Failed to fetch config: ${res.statusText}`);
  return res.json();
}

export async function saveConfig(config: AppConfig): Promise<void> {
  const res = await fetch(`${BASE}/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error(`Failed to save config: ${res.statusText}`);
}

export function startBuild(
  book: string,
  chapter: number,
  flags: { keepTemp: boolean; noWhisper: boolean; upload: boolean },
  onLog: (line: string) => void,
  onDone: (url?: string) => void,
  onError: (err: string) => void
): () => void {
  const params = new URLSearchParams({
    book,
    chapter: String(chapter),
    keepTemp: String(flags.keepTemp),
    noWhisper: String(flags.noWhisper),
  });
  const url = `${BASE}/build?${params}`;
  const evtSource = new EventSource(url);
  let finished = false;

  evtSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'log') {
        onLog(data.text);
      } else if (data.type === 'warn') {
        onLog(`Warning: ${data.text}`);
      } else if (data.type === 'done') {
        finished = true;
        onDone(data.url);
        evtSource.close();
      } else if (data.type === 'error') {
        finished = true;
        onError(data.text);
        evtSource.close();
      }
    } catch {
      onLog(event.data);
    }
  };

  evtSource.onerror = () => {
    if (!finished) onError('Connection lost');
    evtSource.close();
  };

  return () => evtSource.close();
}
