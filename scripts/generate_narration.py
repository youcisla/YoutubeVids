#!/usr/bin/env python3
"""
Generate Edge TTS narration for the two pilot episodes.
Outputs MP3 narration files ready for Hyperframes / FFmpeg composition.
"""
import os, subprocess, json, sys

# Edge TTS voices — no API key needed, runs locally via Edge
# channel-a: deeper adult male (US English "Guy" or "Davis")
# channel-b: warmer female (US English "Jenny" or "Aria")
VOICES = {
    "channel-a": "en-US-GuyNeural",
    "channel-b": "en-US-JennyNeural",
}

# Scripts — short, deliberate, paced
SCRIPTS = {
    "channel-a/phone-orientation": (
        "How does your phone know which way is up?\n\n"
        "Inside your phone, there is a tiny sensor — smaller than a grain of rice. "
        "It's called an accelerometer.\n\n"
        "An accelerometer measures acceleration — including the one you feel right now. "
        "Gravity. About nine point eight meters per second squared, pulling you down.\n\n"
        "The sensor has three tiny structures inside. Each one can move a little — like a spring with a weight on it. "
        "When your phone tilts, gravity pulls one weight harder than another.\n\n"
        "Your phone reads these tiny movements and does some math. "
        "If the down-pull on the bottom sensor is stronger than the top, you are holding the phone upright.\n\n"
        "And that is how your phone knows which way is up. "
        "No magic. Just a few milligrams of silicon, listening to gravity."
    ),
    "channel-b/what-is-a-robot": (
        "What is a robot?\n\n"
        "A robot is something that can do a job all by itself.\n\n"
        "Some robots have arms and wheels and big shiny eyes. "
        "Some look more like boxes with lights.\n\n"
        "But here is a fun secret. Some of the smartest robots in the world do not look like robots at all. "
        "They live inside computers and phones. You cannot hug them. But they can answer your questions, "
        "draw pictures, and help you learn.\n\n"
        "If it can think a little, and do a job by itself, congratulations. It is a robot."
    ),
}

def synth(text, voice, out_path):
    # Write script to temp file (Edge TTS CLI reads from text directly with --text)
    cmd = ["edge-tts", "--voice", voice, "--text", text, "--write-media", out_path]
    print(f"$ {' '.join(cmd)}")
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if r.returncode != 0:
        print("STDERR:", r.stderr)
        return False
    size = os.path.getsize(out_path) if os.path.exists(out_path) else 0
    print(f"  -> {out_path} ({size} bytes)")
    return size > 1000

# Check edge-tts
r = subprocess.run(["edge-tts", "--version"], capture_output=True, text=True)
print(f"edge-tts: {r.stdout.strip()} or err: {r.stderr.strip()}")
if "command not found" in (r.stderr + r.stdout).lower() or r.returncode not in (0, 2):
    print("Installing edge-tts via pip...")
    subprocess.run([sys.executable, "-m", "pip", "install", "edge-tts", "--quiet"], check=False)

OUT_BASE = r"C:\Users\Y.CHEHBOUB\workspace\edu-channel"
results = {}
for slug, text in SCRIPTS.items():
    channel = slug.split("/")[0]
    voice = VOICES[channel]
    out_path = os.path.join(OUT_BASE, slug, "narration.mp3")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    ok = synth(text, voice, out_path)
    results[slug] = {"ok": ok, "path": out_path, "voice": voice}
    print()

print(json.dumps(results, indent=2))