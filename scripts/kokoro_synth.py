#!/usr/bin/env python
"""kokoro_synth.py — synth text to a WAV via kokoro-onnx (am_adam by default).

Usage:
  python kokoro_synth.py --model MODEL.onnx --voices VOICES.bin \
      --voice am_adam --speed 1.0 --lang en-us --out out.wav --text "..."

Prints one JSON line to stdout: {"sample_rate": int, "duration_sec": float}.
Long text is split on sentence boundaries and concatenated to dodge the
~510-token per-call ceiling.  ponytail: naive sentence split; upgrade to a
real segmenter only if pacing on multi-paragraph input looks off.
"""
import argparse, json, re, sys
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro


def split_sentences(text):
    parts = re.split(r'(?<=[.!?])\s+', text.strip())
    return [p for p in parts if p.strip()] or [text.strip()]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', required=True)
    ap.add_argument('--voices', required=True)
    ap.add_argument('--voice', default='am_adam')
    ap.add_argument('--speed', type=float, default=1.0)
    ap.add_argument('--lang', default='en-us')
    ap.add_argument('--out', required=True)
    ap.add_argument('--text', required=True)
    a = ap.parse_args()

    k = Kokoro(a.model, a.voices)
    chunks, sr = [], 24000
    for sentence in split_sentences(a.text):
        samples, sr = k.create(sentence, voice=a.voice, speed=a.speed, lang=a.lang)
        chunks.append(samples)
    audio = np.concatenate(chunks) if len(chunks) > 1 else chunks[0]
    sf.write(a.out, audio, sr)
    json.dump({'sample_rate': int(sr), 'duration_sec': len(audio) / sr}, sys.stdout)


if __name__ == '__main__':
    main()
