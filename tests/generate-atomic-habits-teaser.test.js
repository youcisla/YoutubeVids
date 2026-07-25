const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const {
  generateTeaserAudio,
  TEASER_TEXT,
  VOICE_SETTINGS,
  ASSET_BASENAME,
  validateCaptions,
  parseSrt,
} = require('../scripts/generate-atomic-habits-teaser');

function makeEnv(overrides = {}) {
  return {
    ELEVENLABS_API_KEY: 'test-api-key-DO-NOT-LOG-zx9q',
    ELEVENLABS_VOICE_ID: 'warm-male-voice',
    ELEVENLABS_MODEL_ID: 'eleven_multilingual_v2',
    ...overrides,
  };
}

function makeFetchOk({ bytes = new Uint8Array([0xff, 0xfb, 0x90, 0x64]) } = {}) {
  const m = {
    calls: 0,
    impl: async () => {
      m.calls += 1;
      return {
        ok: true,
        status: 200,
        headers: { get: (name) => (name.toLowerCase() === 'content-type' ? 'audio/mpeg' : null) },
        arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      };
    },
  };
  return m;
}

function makeFetchFail(status = 500) {
  const m = {
    calls: 0,
    impl: async () => {
      m.calls += 1;
      return {
        ok: false,
        status,
        headers: { get: () => null },
        arrayBuffer: async () => new ArrayBuffer(0),
      };
    },
  };
  return m;
}

const SAMPLE_SRT = [
  '1',
  '00:00:00,000 --> 00:00:01,500',
  'What if one percent was enough?',
  '',
  '2',
  '00:00:01,500 --> 00:00:03,000',
  'Get one percent better each day.',
  '',
  '3',
  '00:00:03,000 --> 00:00:05,000',
  'Small habits. Big results.',
  '',
].join('\n');

function makeEdgeTtsOk() {
  const m = {
    calls: [],
    impl: async (text, voice, rate, outPath) => {
      m.calls.push({ text, voice, rate, outPath });
      fs.writeFileSync(outPath, Buffer.from('edge-tts-audio-bytes'));
      // ponytail: edge-tts writes the SRT sidecar in the same invocation;
      // the stub mirrors the real call so the parser path is exercised.
      fs.writeFileSync(`${outPath}.srt`, SAMPLE_SRT);
    },
  };
  return m;
}

function makeEdgeTtsNoSrt() {
  const m = {
    calls: [],
    impl: async (text, voice, rate, outPath) => {
      m.calls.push({ text, voice, rate, outPath });
      fs.writeFileSync(outPath, Buffer.from('edge-tts-audio-bytes'));
      // intentionally omit SRT sidecar
    },
  };
  return m;
}

function makeCaptionSpy(scene0Captions) {
  const m = {
    calls: [],
    impl: async (audioPath, sceneTimestamps, sceneDir, sceneDurations) => {
      m.calls.push({ audioPath, sceneTimestamps, sceneDir, sceneDurations });
      fs.mkdirSync(sceneDir, { recursive: true });
      const tempPath = path.join(sceneDir, 'transcript.json');
      fs.writeFileSync(tempPath, JSON.stringify({
        segments: scene0Captions.map(c => ({ words: [{ word: c.text, start: c.start, end: c.end }] })),
      }));
      return [scene0Captions];
    },
  };
  return m;
}

function freshAssetsDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'teaser-assets-'));
}

function freshTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'teaser-tmp-'));
}

function silentLogCapture() {
  const lines = [];
  return {
    log(msg) { lines.push(String(msg)); },
    raw: lines,
  };
}

test('cache miss calls ElevenLabs once and writes audio + metadata + captions', async (t) => {
  const assetsDir = freshAssetsDir();
  t.after(() => { try { fs.rmSync(assetsDir, { recursive: true, force: true }); } catch {} });

  const fetchMock = makeFetchOk();
  const edgeMock = makeEdgeTtsOk();
  const capMock = makeCaptionSpy([{ start: 0, end: 1.2, text: 'What if one percent was enough?' }]);
  const logger = silentLogCapture();

  const meta = await generateTeaserAudio({
    env: makeEnv(),
    assetsDir,
    tmpDir: freshTmpDir(),
    fetchImpl: fetchMock.impl,
    edgeTtsImpl: edgeMock.impl,
    captionImpl: capMock.impl,
    log: logger.log,
  });

  assert.equal(fetchMock.calls, 1, 'ElevenLabs fetched exactly once');
  assert.equal(edgeMock.calls.length, 0, 'Edge TTS not called on ElevenLabs success');
  assert.equal(capMock.calls.length, 1, 'caption impl called once for ElevenLabs path');

  const audioPath = path.join(assetsDir, ASSET_BASENAME + '.mp3');
  const metaPath = path.join(assetsDir, ASSET_BASENAME + '.meta.json');
  const captionsPath = path.join(assetsDir, ASSET_BASENAME + '.captions.json');

  assert.ok(fs.existsSync(audioPath), 'audio file exists');
  assert.ok(fs.statSync(audioPath).size > 0, 'audio non-empty');
  assert.ok(fs.existsSync(metaPath), 'metadata sidecar exists');
  assert.ok(fs.existsSync(captionsPath), 'captions file exists');

  const metaRead = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  assert.equal(metaRead.provider, 'elevenlabs');
  assert.equal(metaRead.voiceId, 'warm-male-voice');
  assert.equal(metaRead.modelId, 'eleven_multilingual_v2');
  assert.deepEqual(metaRead.settings, VOICE_SETTINGS);
  assert.ok(typeof metaRead.cacheKey === 'string' && /^[a-f0-9]{64}$/.test(metaRead.cacheKey));
  assert.ok(typeof metaRead.generatedAt === 'string' && metaRead.generatedAt.length > 0);
  assert.ok(!('apiKey' in metaRead) && !('ELEVENLABS_API_KEY' in metaRead), 'metadata must omit api key');

  assert.equal(meta.audioPath, audioPath);
  assert.equal(meta.captionsPath, captionsPath);
  assert.equal(meta.metaPath, metaPath);

  const tmpLeftovers = fs.readdirSync(assetsDir).filter(f => f.endsWith('.tmp'));
  assert.equal(tmpLeftovers.length, 0, 'no stray .tmp files after atomic write');
});

test('same inputs hit cache and call ElevenLabs zero times', async (t) => {
  const assetsDir = freshAssetsDir();
  t.after(() => { try { fs.rmSync(assetsDir, { recursive: true, force: true }); } catch {} });

  const fetchMock = makeFetchOk();
  const edgeMock = makeEdgeTtsOk();
  const capMock = makeCaptionSpy([{ start: 0, end: 1.0, text: 'What' }]);
  const logger = silentLogCapture();

  await generateTeaserAudio({
    env: makeEnv(),
    assetsDir,
    tmpDir: freshTmpDir(),
    fetchImpl: fetchMock.impl,
    edgeTtsImpl: edgeMock.impl,
    captionImpl: capMock.impl,
    log: logger.log,
  });
  assert.equal(fetchMock.calls, 1);

  const meta = await generateTeaserAudio({
    env: makeEnv(),
    assetsDir,
    tmpDir: freshTmpDir(),
    fetchImpl: fetchMock.impl,
    edgeTtsImpl: edgeMock.impl,
    captionImpl: capMock.impl,
    log: logger.log,
  });

  assert.equal(fetchMock.calls, 1, 'ElevenLabs still at 1 — second call hit cache');
  assert.equal(edgeMock.calls.length, 0, 'Edge TTS not invoked');
  assert.equal(capMock.calls.length, 2, 'captions regenerated each run');
  assert.equal(meta.audioPath, path.join(assetsDir, ASSET_BASENAME + '.mp3'));
});

test('ElevenLabs failure calls Edge TTS fallback once and reads captions from SRT sidecar', async (t) => {
  const assetsDir = freshAssetsDir();
  t.after(() => { try { fs.rmSync(assetsDir, { recursive: true, force: true }); } catch {} });

  const fetchMock = makeFetchFail(500);
  const edgeMock = makeEdgeTtsOk();
  const capMock = makeCaptionSpy([]); // not used on edge-tts path
  const logger = silentLogCapture();

  const meta = await generateTeaserAudio({
    env: makeEnv(),
    assetsDir,
    tmpDir: freshTmpDir(),
    fetchImpl: fetchMock.impl,
    edgeTtsImpl: edgeMock.impl,
    captionImpl: capMock.impl,
    log: logger.log,
  });

  assert.equal(fetchMock.calls, 1, 'ElevenLabs attempted once');
  assert.equal(edgeMock.calls.length, 1, 'Edge TTS invoked once after ElevenLabs failure');
  assert.equal(edgeMock.calls[0].text, TEASER_TEXT);
  assert.equal(edgeMock.calls[0].outPath, path.join(assetsDir, ASSET_BASENAME + '.mp3'));
  assert.ok(typeof edgeMock.calls[0].voice === 'string' && edgeMock.calls[0].voice.length > 0);
  assert.ok(typeof edgeMock.calls[0].rate === 'string' && /%/.test(edgeMock.calls[0].rate));
  assert.equal(capMock.calls.length, 0, 'captionImpl not invoked on edge-tts fallback path');

  assert.equal(meta.provider, 'edge-tts');
  const metaRead = JSON.parse(fs.readFileSync(path.join(assetsDir, ASSET_BASENAME + '.meta.json'), 'utf8'));
  assert.equal(metaRead.provider, 'edge-tts');

  const captions = JSON.parse(fs.readFileSync(path.join(assetsDir, ASSET_BASENAME + '.captions.json'), 'utf8'));
  assert.ok(captions.length > 0, 'edge-tts captions non-empty from SRT');
  assert.match(captions[0].text, /What if one percent was enough\?/);
  captions.forEach((c, idx) => {
    assert.ok(c.text && c.text.trim().length > 0, `caption ${idx} has nonempty text`);
    assert.ok(c.end > c.start, `caption ${idx} end > start`);
    assert.ok(c.start >= 0 && c.end <= 15 + 1e-6, `caption ${idx} within 15s`);
  });
  for (let i = 1; i < captions.length; i++) {
    assert.ok(captions[i].start >= captions[i - 1].start, 'edge-tts caption timings non-decreasing');
  }
});

test('ElevenLabs captions receive the final audio path and write nonempty captions', async (t) => {
  const assetsDir = freshAssetsDir();
  t.after(() => { try { fs.rmSync(assetsDir, { recursive: true, force: true }); } catch {} });

  const fetchMock = makeFetchOk();
  const edgeMock = makeEdgeTtsOk();
  const capMock = makeCaptionSpy([{ start: 0, end: 1.0, text: 'captions-began' }]);
  const logger = silentLogCapture();

  await generateTeaserAudio({
    env: makeEnv(),
    assetsDir,
    tmpDir: freshTmpDir(),
    fetchImpl: fetchMock.impl,
    edgeTtsImpl: edgeMock.impl,
    captionImpl: capMock.impl,
    log: logger.log,
  });

  assert.equal(capMock.calls.length, 1);
  const call = capMock.calls[0];
  assert.equal(call.audioPath, path.join(assetsDir, ASSET_BASENAME + '.mp3'));
  assert.deepEqual(call.sceneTimestamps, [15]);
  assert.deepEqual(call.sceneDurations, [15]);

  const captionsJson = JSON.parse(
    fs.readFileSync(path.join(assetsDir, ASSET_BASENAME + '.captions.json'), 'utf8')
  );
  assert.ok(Array.isArray(captionsJson) && captionsJson.length > 0, 'captions non-empty');
  captionsJson.forEach((c, idx) => {
    assert.ok(typeof c.text === 'string' && c.text.trim().length > 0, `caption ${idx} has nonempty text`);
    assert.ok(typeof c.start === 'number' && typeof c.end === 'number', `caption ${idx} numeric timing`);
    assert.ok(c.end > c.start, `caption ${idx} end > start`);
    assert.ok(c.start >= 0 && c.end <= 15 + 1e-6, `caption ${idx} within 15s`);
  });
  for (let i = 1; i < captionsJson.length; i++) {
    assert.ok(captionsJson[i].start >= captionsJson[i - 1].start, 'caption timings non-decreasing');
  }
});

test('rejects when ElevenLabs captions are empty', async (t) => {
  const assetsDir = freshAssetsDir();
  t.after(() => { try { fs.rmSync(assetsDir, { recursive: true, force: true }); } catch {} });

  const fetchMock = makeFetchOk();
  const edgeMock = makeEdgeTtsOk();
  const capMock = makeCaptionSpy([]);  // whisper returns no captions
  const logger = silentLogCapture();

  await assert.rejects(
    generateTeaserAudio({
      env: makeEnv(),
      assetsDir,
      tmpDir: freshTmpDir(),
      fetchImpl: fetchMock.impl,
      edgeTtsImpl: edgeMock.impl,
      captionImpl: capMock.impl,
      log: logger.log,
    }),
    (err) => {
      assert.match(err.message, /no captions/);
      // Captions file may or may not have been written depending on where the check fires;
      // the partial audio/captions should still exist on disk.
      return true;
    }
  );
});

test('rejects when Edge TTS sidecar SRT is missing', async (t) => {
  const assetsDir = freshAssetsDir();
  t.after(() => { try { fs.rmSync(assetsDir, { recursive: true, force: true }); } catch {} });

  const fetchMock = makeFetchFail(500);
  const edgeMock = makeEdgeTtsNoSrt();
  const capMock = makeCaptionSpy([]);
  const logger = silentLogCapture();

  await assert.rejects(
    generateTeaserAudio({
      env: makeEnv(),
      assetsDir,
      tmpDir: freshTmpDir(),
      fetchImpl: fetchMock.impl,
      edgeTtsImpl: edgeMock.impl,
      captionImpl: capMock.impl,
      log: logger.log,
    }),
    /SRT sidecar/
  );
});

test('--force bypasses cache and regenerates audio', async (t) => {
  const assetsDir = freshAssetsDir();
  t.after(() => { try { fs.rmSync(assetsDir, { recursive: true, force: true }); } catch {} });

  const fetchMock = makeFetchOk();
  const edgeMock = makeEdgeTtsOk();
  const capMock = makeCaptionSpy([{ start: 0, end: 1.0, text: 'caption' }]);
  const logger = silentLogCapture();

  await generateTeaserAudio({
    env: makeEnv(),
    assetsDir,
    tmpDir: freshTmpDir(),
    fetchImpl: fetchMock.impl,
    edgeTtsImpl: edgeMock.impl,
    captionImpl: capMock.impl,
    log: logger.log,
  });
  assert.equal(fetchMock.calls, 1);

  await generateTeaserAudio({
    env: makeEnv(),
    assetsDir,
    tmpDir: freshTmpDir(),
    fetchImpl: fetchMock.impl,
    edgeTtsImpl: edgeMock.impl,
    captionImpl: capMock.impl,
    log: logger.log,
    force: true,
  });
  assert.equal(fetchMock.calls, 2, 'force bypassed cache and invoked ElevenLabs again');

  // Without force, the cache would have triggered a log line; with force it should not.
  const cacheHits = logger.raw.filter(l => l.includes('cache hit')).length;
  assert.equal(cacheHits, 0, 'no cache hit log lines when force=true');
});

test('logs never contain the API key', async (t) => {
  const assetsDir = freshAssetsDir();
  t.after(() => { try { fs.rmSync(assetsDir, { recursive: true, force: true }); } catch {} });

  const fetchMock = makeFetchOk();
  const edgeMock = makeEdgeTtsOk();
  const capMock = makeCaptionSpy([{ start: 0, end: 1.0, text: 'no-leak' }]);
  const logger = silentLogCapture();
  const apiKey = 'test-api-key-DO-NOT-LOG-zx9q';

  await generateTeaserAudio({
    env: makeEnv({ ELEVENLABS_API_KEY: apiKey }),
    assetsDir,
    tmpDir: freshTmpDir(),
    fetchImpl: fetchMock.impl,
    edgeTtsImpl: edgeMock.impl,
    captionImpl: capMock.impl,
    log: logger.log,
  });

  assert.equal(logger.raw.length > 0, true, 'log lines were captured');
  for (const line of logger.raw) {
    assert.doesNotMatch(line, /test-api-key-DO-NOT-LOG-zx9q/);
    assert.doesNotMatch(line, /ELEVENLABS_API_KEY=.*[a-zA-Z0-9]{6,}/);
  }
});

test('validateCaptions does not mutate its input array', () => {
  const input = [
    { start: 2, end: 3, text: 'b' },
    { start: 0, end: 1, text: 'a' },
    { start: 1, end: 2, text: 'c' },
  ];
  const snapshot = JSON.stringify(input);
  const result = validateCaptions(input);
  assert.equal(JSON.stringify(input), snapshot, 'input array unchanged');
  assert.equal(result[0].text, 'a', 'result sorted by start');
  assert.equal(result.length, 3);
});

test('parseSrt handles edge-tts output (HH:MM:SS,mmm --> HH:MM:SS,mmm with leading index)', () => {
  const parsed = parseSrt(SAMPLE_SRT);
  assert.equal(parsed.length, 3);
  assert.equal(parsed[0].text, 'What if one percent was enough?');
  assert.equal(parsed[0].start, 0);
  assert.equal(parsed[0].end, 1.5);
  assert.equal(parsed[1].start, 1.5);
  assert.equal(parsed[1].end, 3);
  assert.equal(parsed[2].text, 'Small habits. Big results.');
});

test('parseSrt tolerates trailing whitespace, blank lines, and missing index line', () => {
  const srt = [
    '00:00:00,000 --> 00:00:01,000',
    'Hello',
    '',
    '00:00:01,000 --> 00:00:02,500',
    'World',
    '',
  ].join('\n');
  const parsed = parseSrt(srt);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].text, 'Hello');
  assert.equal(parsed[1].text, 'World');
});

test('parseSrt returns empty array for empty / non-string input', () => {
  assert.deepEqual(parseSrt(''), []);
  assert.deepEqual(parseSrt(null), []);
  assert.deepEqual(parseSrt(undefined), []);
});

test('narration text matches the approved teaser script', () => {
  assert.equal(
    TEASER_TEXT,
    "What if one percent was enough? Get one percent better each day. After one year, you're thirty-seven times better. Small habits. Big results. Watch the full summary."
  );
  assert.ok(TEASER_TEXT.length > 30 && TEASER_TEXT.length < 2000);
  assert.match(TEASER_TEXT, /^What if one percent was enough\?/);
});

test('VOICE_SETTINGS match the approved defaults', () => {
  assert.deepEqual(VOICE_SETTINGS, {
    stability: 0.42,
    similarity_boost: 0.78,
    style: 0.2,
    use_speaker_boost: true,
  });
});
