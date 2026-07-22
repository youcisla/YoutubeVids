#!/usr/bin/env python3
"""
Generate timed caption JSON from narration MP3 + script text.

Splits the script into chunks (sentences + pauses) and assigns timestamps
proportional to character count, snapped to the actual audio duration.

Output format is compatible with Hyperframes SRT-style caption display.
"""
import json, os, re, subprocess, sys

# Get audio duration via ffprobe
def get_duration(mp3_path):
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", mp3_path],
        capture_output=True, text=True, check=True
    )
    return float(json.loads(r.stdout)["format"]["duration"])

# Strip SSML / parens / [laughs] etc, keep just readable words
def clean_text(text):
    # Remove SSML tags if any
    text = re.sub(r"<[^>]+>", "", text)
    # Remove (stage direction)
    text = re.sub(r"\([^)]*\)", "", text)
    return text.strip()

# Split text into chunks: split on sentence boundaries + the explicit \n\n pauses
def chunk_script(text):
    text = clean_text(text)
    # Split on double-newlines first (the explicit pauses in our script)
    blocks = re.split(r"\n\n+", text)
    chunks = []
    for block in blocks:
        block = block.strip()
        if not block:
            continue
        # Within a block, split on sentence boundaries
        sentences = re.split(r"(?<=[.!?])\s+", block)
        for s in sentences:
            s = s.strip()
            if s:
                chunks.append(s)
    return chunks

# Build caption cues weighted by character count
def build_cues(chunks, total_duration):
    # Add a tiny buffer at start and end
    start_pad = 0.4
    end_pad = 0.5
    usable = total_duration - start_pad - end_pad

    # Weight by character count, but cap any single cue at 6s so captions don't drag
    weights = [max(1, len(c)) for c in chunks]
    total_w = sum(weights)

    cues = []
    cursor = start_pad
    for i, (chunk, w) in enumerate(zip(chunks, weights)):
        dur = usable * (w / total_w)
        # Snap to readable cadence: ensure min 1.5s, max 6s
        dur = max(1.5, min(6.0, dur))
        cues.append({
            "id": i,
            "start": round(cursor, 3),
            "end": round(cursor + dur, 3),
            "text": chunk,
        })
        cursor += dur
    return cues

if __name__ == "__main__":
    base = r"C:\Users\Y.CHEHBOUB\workspace\edu-channel"
    episodes = [
        ("channel-a/phone-orientation", open(os.path.join(base, "channel-a/phone-orientation/SCRIPT.md")).read() if os.path.exists(os.path.join(base, "channel-a/phone-orientation/SCRIPT.md")) else None),
        ("channel-b/what-is-a-robot", open(os.path.join(base, "channel-b/what-is-a-robot/SCRIPT.md")).read() if os.path.exists(os.path.join(base, "channel-b/what-is-a-robot/SCRIPT.md")) else None),
    ]

    # Pull scripts from the original generator (they're the source of truth)
    from importlib.util import spec_from_file_location, module_from_spec
    spec = spec_from_file_location("gn", os.path.join(base, "scripts/generate_narration.py"))
    gn = module_from_spec(spec); spec.loader.exec_module(gn)

    for slug, _ in episodes:
        script_text = gn.SCRIPTS[slug]
        mp3 = os.path.join(base, slug, "narration.mp3")
        out = os.path.join(base, slug, "captions.json")

        dur = get_duration(mp3)
        chunks = chunk_script(script_text)
        cues = build_cues(chunks, dur)

        with open(out, "w") as f:
            json.dump({"duration": dur, "cues": cues}, f, indent=2)

        print(f"{slug}: {dur:.1f}s, {len(cues)} cues -> {out}")
        for c in cues[:3]:
            print(f"  [{c['start']:.1f}-{c['end']:.1f}] {c['text'][:60]}...")
        print()