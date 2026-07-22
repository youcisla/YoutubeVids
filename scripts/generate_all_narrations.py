#!/usr/bin/env python3
"""Generate Edge TTS narrations for all 6 edu-channel episodes."""
import subprocess, json, os, sys

# Import scripts
sys.path.insert(0, r"C:\Users\Y.CHEHBOUB\workspace\edu-channel\scripts")
from scripts_data import SCRIPTS

VOICES = {
    "channel-a": "en-US-GuyNeural",
    "channel-b": "en-US-JennyNeural",
}

BASE = r"C:\Users\Y.CHEHBOUB\workspace\edu-channel"

def synth(text, voice, out_path):
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    cmd = ["edge-tts", "--voice", voice, "--text", text, "--write-media", out_path]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if r.returncode != 0:
        print(f"  FAIL: {r.stderr[:200]}")
        return False
    size = os.path.getsize(out_path) if os.path.exists(out_path) else 0
    print(f"  -> {os.path.basename(os.path.dirname(out_path))}/{os.path.basename(out_path)} ({size} bytes)")
    return size > 1000

results = {}
for slug, text in sorted(SCRIPTS.items()):
    channel = slug.split("/")[0]
    voice = VOICES[channel]
    slug_dir = slug.replace("/", "\\") if slug.count("/") else slug
    out_path = os.path.join(BASE, slug.replace("/", "\\"), "narration.mp3")
    print(f"=== {slug} (voice: {voice}) ===")
    ok = synth(text, voice, out_path)
    results[slug] = {"ok": ok, "path": out_path}
    print()

# Summary
ok = sum(1 for v in results.values() if v["ok"])
print(f"\n=== Done: {ok}/{len(results)} narrations generated ===")
