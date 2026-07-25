const test = require('node:test');
const assert = require('node:assert/strict');

const { narrationCacheKey, narrateWithElevenLabs } = require('../lib/elevenlabs-tts');

const base = {
  text: 'What if one percent was enough?',
  voiceId: 'warm-male',
  modelId: 'eleven_multilingual_v2',
  settings: { stability: 0.42, similarity_boost: 0.78, style: 0.2, use_speaker_boost: true },
};

test('cache key is stable and input-sensitive', () => {
  assert.equal(narrationCacheKey(base), narrationCacheKey({ ...base }));
  assert.notEqual(narrationCacheKey(base), narrationCacheKey({ ...base, text: `${base.text}!` }));
  assert.notEqual(narrationCacheKey(base), narrationCacheKey({ ...base, voiceId: 'other' }));
  assert.notEqual(narrationCacheKey(base), narrationCacheKey({ ...base, modelId: 'eleven_turbo_v2_5' }));
  assert.notEqual(
    narrationCacheKey(base),
    narrationCacheKey({ ...base, settings: { ...base.settings, stability: 0.5 } })
  );
});

test('cache key is a 64-char SHA-256 hex digest', () => {
  assert.match(narrationCacheKey(base), /^[a-f0-9]{64}$/);
});

function makeFakeResponse({ status = 200, body = new Uint8Array([0xff, 0xfb, 0x90]), contentType = 'audio/mpeg' } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => (name.toLowerCase() === 'content-type' ? contentType : null) },
    arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
  };
}

test('narrateWithElevenLabs posts to /v1/text-to-speech/{voiceId} and returns binary audio', async () => {
  let capturedUrl;
  let capturedInit;
  const fakeFetch = async (url, init) => {
    capturedUrl = url;
    capturedInit = init;
    return makeFakeResponse();
  };

  const result = await narrateWithElevenLabs({
    apiKey: 'test-key',
    text: base.text,
    voiceId: base.voiceId,
    modelId: base.modelId,
    settings: base.settings,
    fetchImpl: fakeFetch,
  });

  assert.equal(capturedUrl, `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(base.voiceId)}`);
  assert.equal(capturedInit.method, 'POST');
  assert.equal(capturedInit.headers['Content-Type'], 'application/json');
  assert.equal(capturedInit.headers['Accept'], 'audio/mpeg');
  assert.equal(capturedInit.headers['xi-api-key'], 'test-key');
  assert.deepEqual(JSON.parse(capturedInit.body), {
    text: base.text,
    model_id: base.modelId,
    voice_settings: base.settings,
  });
  assert.ok(capturedInit.signal instanceof AbortSignal, 'expected an AbortSignal for timeout');
  assert.ok(Buffer.isBuffer(result.audio));
  assert.equal(result.audio.length, 3);
  assert.equal(result.contentType, 'audio/mpeg');
});

test('narrateWithElevenLabs redacts error messages', async () => {
  const fakeFetch = async () => makeFakeResponse({ status: 401, body: new Uint8Array(), contentType: 'text/plain' });

  await assert.rejects(
    narrateWithElevenLabs({
      apiKey: 'super-secret-key',
      text: 'hi',
      voiceId: 'v',
      modelId: 'm',
      settings: {},
      fetchImpl: fakeFetch,
    }),
    (err) => {
      assert.ok(err instanceof Error);
      assert.equal(err.apiKeyExposed, false);
      assert.match(err.message, /ElevenLabs TTS failed \(401\)/);
      assert.doesNotMatch(err.message, /super-secret-key/);
      return true;
    }
  );
});

test('narrateWithElevenLabs throws when apiKey missing', async () => {
  await assert.rejects(
    narrateWithElevenLabs({ apiKey: '', text: 'hi', voiceId: 'v', modelId: 'm', settings: {} }),
    /ELEVENLABS_API_KEY/
  );
});

test('narrateWithElevenLabs throws when voiceId missing', async () => {
  await assert.rejects(
    narrateWithElevenLabs({ apiKey: 'k', text: 'hi', voiceId: '', modelId: 'm', settings: {} }),
    /ELEVENLABS_VOICE_ID/
  );
});
