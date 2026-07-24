/**
 * edu-channel Studio Server
 * Express backend: file API, config read/write, build spawning via SSE
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const express = require('express');

const ROOT = path.resolve(__dirname, '..');
const BOOKS_DIR = path.join(ROOT, 'books');
const CONFIG_PATH = path.join(ROOT, 'config.json');
const DIST_DIR = path.join(ROOT, 'pilot', 'dist');

const app = express();
app.use(express.json());

// ─── Helpers ────────────────────────────────────────────

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

function listBooks() {
  const books = [];
  if (!fs.existsSync(BOOKS_DIR)) return books;
  for (const dir of fs.readdirSync(BOOKS_DIR)) {
    const dirPath = path.join(BOOKS_DIR, dir);
    if (!fs.statSync(dirPath).isDirectory()) continue;
    const coverPath = path.join(dirPath, 'cover.svg');
    const chapters = [];
    for (const f of fs.readdirSync(dirPath).filter(f => f.startsWith('chapter-') && f.endsWith('.json'))) {
      const data = readJson(path.join(dirPath, f));
      const num = parseInt(f.match(/chapter-(\d+)/)?.[1] || '0');
      if (!data) continue;
      const outputFile = path.join(DIST_DIR, `${dir}_Ch${String(num).padStart(2, '0')}.mp4`);
      chapters.push({
        number: num,
        title: data.chapter_title || `Chapter ${num}`,
        sceneCount: data.scene_count || data.scenes?.length || 0,
        wordCount: data.narration_script?.split(' ').length || 0,
        hasOutput: fs.existsSync(outputFile),
      });
    }
    if (chapters.length > 0) {
      books.push({
        name: dir,
        title: chapters[0]?.title?.split('—')[0]?.trim() || dir.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        chapters: chapters.sort((a, b) => a.number - b.number),
        hasCover: fs.existsSync(coverPath),
      });
    }
  }
  return books;
}

// ─── API Routes ─────────────────────────────────────────

// GET /api/books — list all books with chapter metadata
app.get('/api/books', (req, res) => {
  res.json(listBooks());
});

// GET /api/books/:book/:file — serve chapter JSON
app.get('/api/books/:book/:file', (req, res) => {
  const safePath = path.resolve(BOOKS_DIR, req.params.book, req.params.file);
  if (!safePath.startsWith(BOOKS_DIR)) return res.status(403).json({ error: 'Invalid path' });
  if (!fs.existsSync(safePath)) return res.status(404).json({ error: 'Not found' });
  res.sendFile(safePath);
});

// GET /api/config — read config
app.get('/api/config', (req, res) => {
  const cfg = readJson(CONFIG_PATH);
  if (!cfg) return res.status(500).json({ error: 'config.json not found' });
  res.json(cfg);
});

// POST /api/config — write config
app.post('/api/config', (req, res) => {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(req.body, null, 2));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/build — SSE build stream
app.get('/api/build', (req, res) => {
  const { book, chapter, keepTemp, noWhisper, upload } = req.query;
  if (!book || !chapter) return res.status(400).json({ error: 'book and chapter required' });

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const send = (type, text) => {
    res.write(`data: ${JSON.stringify({ type, text })}\n\n`);
  };

  send('log', `Starting build: ${book} chapter ${chapter}...`);

  const args = [
    path.join(ROOT, 'build-chapter.js'),
    '--book', book,
    '--chapter', chapter,
  ];
  if (keepTemp === 'true') args.push('--keep-temp');
  if (noWhisper === 'true') args.push('--no-whisper');
  if (upload === 'true') args.push('--upload');

  const proc = spawn('node', args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });

  proc.stdout.on('data', data => {
    const lines = data.toString().split('\n').filter(Boolean);
    lines.forEach(l => send('log', l));
  });

  proc.stderr.on('data', data => {
    const lines = data.toString().split('\n').filter(Boolean);
    lines.forEach(l => send('error', l));
  });

  proc.on('close', code => {
    if (code === 0) {
      const outPath = path.join(DIST_DIR, `${book}_Ch${String(Number(chapter)).padStart(2, '0')}.mp4`);
      send('done', outPath);
    } else {
      send('error', `Build exited with code ${code}`);
    }
    res.end();
  });

  req.on('close', () => {
    proc.kill();
  });
});

// GET /output/:file — serve rendered MP4s
app.get('/output/:file', (req, res) => {
  const safePath = path.resolve(DIST_DIR, req.params.file);
  if (!safePath.startsWith(DIST_DIR)) return res.status(403).json({ error: 'Invalid path' });
  if (!fs.existsSync(safePath)) return res.status(404).json({ error: 'Not found' });
  res.sendFile(safePath);
});

// Serve Vite static build if available
const uiDist = path.join(__dirname, 'dist');
if (fs.existsSync(uiDist)) {
  app.use(express.static(uiDist));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/output')) return;
    res.sendFile(path.join(uiDist, 'index.html'));
  });
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Edu Channel Studio API on http://localhost:${PORT}`);
  console.log(`Books dir: ${BOOKS_DIR}`);
  console.log(`Output dir: ${DIST_DIR}`);
});
