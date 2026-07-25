const crypto = require('node:crypto');

function narrationCacheKey(options) {
  return crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        text: options.text,
        voiceId: options.voiceId,
        modelId: options.modelId,
        settings: options.settings,
      })
    )
    .digest('hex');
}

async function narrateWithElevenLabs({
  apiKey,
  text,
  voiceId,
  modelId,
  settings,
  fetchImpl = fetch,
}) {
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY is not set');
  if (!voiceId) throw new Error('ELEVENLABS_VOICE_ID is not set');

  const response = await fetchImpl(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({ text, model_id: modelId, voice_settings: settings }),
      signal: AbortSignal.timeout(45000),
    }
  );

  if (!response.ok) {
    const err = new Error(`ElevenLabs TTS failed (${response.status})`);
    err.apiKeyExposed = false;
    throw err;
  }

  return {
    audio: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get('content-type') || 'audio/mpeg',
  };
}

module.exports = { narrationCacheKey, narrateWithElevenLabs };
