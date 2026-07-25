/**
 * edu-channel Studio Server
 * Local-only Express backend: file API, config read/write, build spawning via SSE.
 */
const crypto = require('node:crypto');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const express = require('express');
const { isPathInside, validateConfig } = require('../lib/contracts');

const ROOT = path.resolve(__dirname, '..');
const BOOKS_DIR = path.join(ROOT, 'books');
const CONFIG_PATH = path.join(ROOT, 'config.json');
const DIST_DIR = path.join(ROOT, 'pilot', 'dist');
const VALID_BOOK_RE = /^[a-z0-9_-]+$/;
const ACTION_TOKEN = crypto.randomUUID();
const activeBuilds = new Set();

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));

function readJson(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch { return null; }
}

function requireActionToken(req, res, next) {
  const cookie = req.headers.cookie?.split(';').map(value => value.trim()).find(value => value.startsWith('edu_action='));
  const token = cookie?.slice('edu_action='.length) || '';
  const actual = Buffer.from(token);
  const expected = Buffer.from(ACTION_TOKEN);
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    return res.status(403).json({ error: 'Invalid action token' });
  }
  next();
}

function listBooks() {
  const books = [];
  if (!fs.existsSync(BOOKS_DIR)) return books;
  for (const dir of fs.readdirSync(BOOKS_DIR)) {
    const dirPath = path.join(BOOKS_DIR, dir);
    if (!fs.statSync(dirPath).isDirectory()) continue;
    const coverPath = path.join(dirPath, 'cover.svg');
    const chapters = [];
    let bookTitle = '';
    for (const file of fs.readdirSync(dirPath).filter(file => /^chapter-\d+\.json$/.test(file))) {
      const data = readJson(path.join(dirPath, file));
      const num = Number(file.match(/chapter-(\d+)/)?.[1]);
      if (!data || !Number.isInteger(num)) continue;
      bookTitle ||= data.book_title || '';
      const outputFile = path.join(DIST_DIR, `${dir}_Ch${String(num).padStart(2, '0')}.mp4`);
      chapters.push({
        number: num,
        title: data.chapter_title || `Chapter ${num}`,
        sceneCount: data.scene_count || data.scenes?.length || 0,
        wordCount: data.narration_script?.split(/\s+/).filter(Boolean).length || 0,
        hasOutput: fs.existsSync(outputFile),
      });
    }
    if (chapters.length > 0) {
      books.push({
        name: dir,
        title: bookTitle || dir.replace(/-/g, ' ').replace(/\b\w/g, char => char.toUpperCase()),
        chapters: chapters.sort((a, b) => a.number - b.number),
        hasCover: fs.existsSync(coverPath),
      });
    }
  }
  return books;
}

app.get('/api/session', (req, res) => {
  res.setHeader('Set-Cookie', `edu_action=${ACTION_TOKEN}; HttpOnly; SameSite=Strict; Path=/api`);
  res.status(204).end();
});
app.get('/api/books', (req, res) => res.json(listBooks()));

app.get('/api/books/:book/:file', (req, res) => {
  if (!VALID_BOOK_RE.test(req.params.book) || !/^chapter-\d+\.json$/.test(req.params.file)) {
    return res.status(400).json({ error: 'Invalid book or chapter file' });
  }
  const safePath = path.resolve(BOOKS_DIR, req.params.book, req.params.file);
  if (!isPathInside(BOOKS_DIR, safePath)) return res.status(403).json({ error: 'Invalid path' });
  if (!fs.existsSync(safePath)) return res.status(404).json({ error: 'Not found' });
  res.sendFile(safePath);
});

app.get('/api/config', (req, res) => {
  const config = readJson(CONFIG_PATH);
  if (!config) return res.status(500).json({ error: 'config.json not found' });
  res.json(config);
});

app.post('/api/config', requireActionToken, (req, res) => {
  try {
    const config = validateConfig(req.body);
    const temporaryPath = `${CONFIG_PATH}.${process.pid}.tmp`;
    fs.writeFileSync(temporaryPath, `${JSON.stringify(config, null, 2)}\n`, { flag: 'wx' });
    fs.renameSync(temporaryPath, CONFIG_PATH);
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/build', requireActionToken, (req, res) => {
  const { book, chapter, keepTemp, noWhisper } = req.query;
  const chapterNumber = Number(chapter);
  if (!VALID_BOOK_RE.test(String(book || '')) || !Number.isInteger(chapterNumber) || chapterNumber < 1) {
    return res.status(400).json({ error: 'Valid book and chapter required' });
  }
  if (req.query.upload === 'true') {
    return res.status(400).json({ error: 'Upload must be a separate explicit action' });
  }

  const buildKey = `${book}:${chapterNumber}`;
  if (activeBuilds.has(buildKey)) return res.status(409).json({ error: 'Build already running' });
  activeBuilds.add(buildKey);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const send = (type, text, extra = {}) => {
    if (!res.writableEnded) res.write(`data: ${JSON.stringify({ type, text, ...extra })}\n\n`);
  };
  send('log', `Starting build: ${book} chapter ${chapterNumber}...`);

  const args = [
    path.join(ROOT, 'build-chapter.js'),
    '--book', book,
    '--chapter', String(chapterNumber),
  ];
  if (keepTemp === 'true') args.push('--keep-temp');
  if (noWhisper === 'true') args.push('--no-whisper');

  const proc = spawn(process.execPath, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  proc.stdout.on('data', data => data.toString().split('\n').filter(Boolean).forEach(line => send('log', line)));
  proc.stderr.on('data', data => data.toString().split('\n').filter(Boolean).forEach(line => send('warn', line)));
  proc.on('error', error => send('error', error.message));
  proc.on('close', code => {
    activeBuilds.delete(buildKey);
    if (code === 0) {
      const file = `${book}_Ch${String(chapterNumber).padStart(2, '0')}.mp4`;
      send('done', 'Build complete', { url: `/output/${file}` });
    } else {
      send('error', `Build exited with code ${code}`);
    }
    res.end();
  });

  res.on('close', () => {
    if (!res.writableEnded && proc.exitCode === null) proc.kill();
  });
});

app.get('/output/:file', (req, res) => {
  if (!/^[a-z0-9_-]+_Ch\d+\.mp4$/i.test(req.params.file)) return res.status(400).json({ error: 'Invalid output file' });
  const safePath = path.resolve(DIST_DIR, req.params.file);
  if (!isPathInside(DIST_DIR, safePath)) return res.status(403).json({ error: 'Invalid path' });
  if (!fs.existsSync(safePath)) return res.status(404).json({ error: 'Not found' });
  res.sendFile(safePath);
});

const uiDist = path.join(__dirname, 'dist');
if (fs.existsSync(uiDist)) {
  app.use(express.static(uiDist));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/output')) return res.status(404).end();
    res.sendFile(path.join(uiDist, 'index.html'));
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 3001;
  app.listen(port, '127.0.0.1', () => {
    console.log(`Edu Channel Studio API on http://127.0.0.1:${port}`);
  });
}

module.exports = { app, ACTION_TOKEN };
