#!/usr/bin/env python3
"""
Batch-build Hyperframes episode compositions for the edu channels.
Reads scripts_data.py, generates narration → timed captions → index.html
"""
import json, os, re, subprocess, sys
from scripts_data import SCRIPTS

BASE = r"C:\Users\Y.CHEHBOUB\workspace\edu-channel"

def get_duration(mp3_path):
    if not os.path.exists(mp3_path):
        return None
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", mp3_path],
        capture_output=True, text=True, check=False
    )
    if r.returncode == 0:
        return float(json.loads(r.stdout)["format"]["duration"])
    return None

def chunk_script(text):
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"\([^)]*\)", "", text)
    blocks = re.split(r"\n\n+", text)
    chunks = []
    for block in blocks:
        block = block.strip()
        if not block:
            continue
        sentences = re.split(r"(?<=[.!?])\s+", block)
        for s in sentences:
            s = s.strip()
            if s:
                chunks.append(s)
    return chunks

def build_cues(chunks, total_duration):
    start_pad = 0.4; end_pad = 0.5
    usable = total_duration - start_pad - end_pad
    weights = [max(1, len(c)) for c in chunks]
    total_w = sum(weights)
    cues = []
    cursor = start_pad
    for i, (chunk, w) in enumerate(zip(chunks, weights)):
        dur = usable * (w / total_w)
        dur = max(1.5, min(6.0, dur))
        cues.append({"id": i, "start": round(cursor, 3), "end": round(cursor + dur, 3), "text": chunk})
        cursor += dur
    return cues

def write_index_html(ep_dir, title, slug, channel, cues, duration, total_duration):
    """Write a Hyperframes index.html for this episode."""
    is_channel_a = channel == "channel-a"
    
    if is_channel_a:
        html = f"""<!doctype html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=1920, height=1080" />
<title>{title}</title>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>
@font-face {{font-family:'Fraunces';src:local('Fraunces'),local('Fraunces-Regular');}}
:root {{--bg:#0E1418;--surface:#1A232B;--surface-2:#243038;--text:#F0F4F8;--text-dim:#94A3B8;--teal:#4FD1C5;--teal-glow:rgba(79,209,197,0.4);--amber:#F6AD55;--grid:rgba(79,209,197,0.08);}}
*{{margin:0;padding:0;box-sizing:border-box;}}
html,body{{width:1920px;height:1080px;overflow:hidden;background:var(--bg);font-family:"Inter",sans-serif;color:var(--text);}}
.display{{font-family:"Fraunces","EB Garamond",Georgia,serif;font-weight:500;letter-spacing:-0.02em;}}
.mono{{font-family:"JetBrains Mono","SF Mono",monospace;}}
.bg-grid{{position:absolute;inset:0;background-image:linear-gradient(var(--grid) 1px,transparent 1px),linear-gradient(90deg,var(--grid) 1px,transparent 1px);background-size:80px 80px;z-index:0;}}
.bg-vignette{{position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 30%,var(--bg) 90%);z-index:1;}}
.brand{{position:absolute;top:48px;right:64px;font-size:18px;font-weight:600;letter-spacing:0.15em;color:var(--text-dim);text-transform:uppercase;z-index:100;opacity:0.5;}}
.brand .dot{{display:inline-block;width:8px;height:8px;background:var(--teal);border-radius:50%;margin-right:10px;vertical-align:middle;box-shadow:0 0 12px var(--teal-glow);}}
.scene{{position:absolute;inset:0;z-index:10;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:120px 100px 200px;}}
.clip{{visibility:hidden;}}
.caption-bar{{position:absolute;left:0;right:0;bottom:80px;z-index:50;display:flex;justify-content:center;padding:0 80px;opacity:0;}}
.caption-pill{{background:rgba(14,20,24,0.92);border:1px solid rgba(79,209,197,0.25);border-radius:4px;padding:18px 32px;max-width:1400px;font-size:30px;line-height:1.35;font-weight:500;text-align:center;color:var(--text);backdrop-filter:blur(8px);box-shadow:0 8px 32px rgba(0,0,0,0.4);}}
.hook-title{{font-size:100px;line-height:1.05;text-align:center;max-width:1400px;}}
.hook-title .accent{{color:var(--teal);position:relative;}}
.hook-title .accent::after{{content:'';position:absolute;left:-8px;right:-8px;bottom:6px;height:12px;background:var(--teal-glow);z-index:-1;}}
.hook-sub{{margin-top:24px;font-size:26px;color:var(--text-dim);font-style:italic;}}
.large-icon{{font-size:160px;margin-bottom:40px;}}
.body-text{{font-size:48px;line-height:1.25;text-align:center;max-width:1400px;font-weight:400;}}
.body-text .hl{{color:var(--teal);}}
.body-text .hl-amber{{color:var(--amber);}}
.outro-text{{font-size:80px;line-height:1.1;text-align:center;max-width:1300px;}}
audio{{display:none;}}
</style></head>
<body><div id="main" data-composition-id="main" data-start="0" data-duration="{total_duration}" data-width="1920" data-height="1080" style="position:absolute;inset:0;">
<audio id="narration" src="narration.mp3" data-start="0" data-duration="{duration}"></audio>
<div class="bg-grid"></div><div class="bg-vignette"></div>
<div class="brand"><span class="dot"></span>HOW IT WORKS</div>"""
    else:
        html = f"""<!doctype html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=1920, height=1080" />
<title>{title}</title>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>
@font-face {{font-family:'Quicksand';src:local('Quicksand'),local('Quicksand-Bold');}}
@font-face {{font-family:'Nunito';src:local('Nunito'),local('Nunito-Bold');}}
:root {{--bg:#FFF8E7;--surface:#FFFFFF;--surface-2:#F5E9C8;--text:#1A1A1A;--text-dim:#5A4E3F;--coral:#E85050;--sky:#3AB0A8;--sun:#FFE66D;--outline:#1A1A1A;}}
*{{margin:0;padding:0;box-sizing:border-box;}}
html,body{{width:1920px;height:1080px;overflow:hidden;background:var(--bg);font-family:"Nunito","Quicksand",system-ui,sans-serif;color:var(--text);font-weight:700;}}
.display{{font-family:"Quicksand","Nunito",system-ui,sans-serif;font-weight:700;letter-spacing:-0.01em;}}
.bg-pattern{{position:absolute;inset:0;background-image:radial-gradient(circle at 10% 20%,var(--sun) 0%,transparent 8%),radial-gradient(circle at 90% 80%,var(--sky) 0%,transparent 12%),radial-gradient(circle at 50% 50%,var(--coral) 0%,transparent 6%);opacity:0.18;z-index:0;}}
.brand{{position:absolute;top:48px;right:64px;font-size:22px;font-weight:800;color:var(--coral);z-index:100;}}
.scene{{position:absolute;inset:0;z-index:10;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:200px 80px 200px;}}
.clip{{visibility:hidden;}}
.caption-bar{{position:absolute;left:0;right:0;bottom:60px;z-index:50;display:flex;justify-content:center;padding:0 80px;}}
.caption-pill{{background:rgba(255,255,255,0.95);border:5px solid var(--outline);border-radius:24px;padding:20px 36px;max-width:1500px;font-size:42px;line-height:1.25;font-weight:800;text-align:center;color:var(--text);box-shadow:0 6px 0 rgba(0,0,0,0.1);}}
.hook{{font-size:140px;line-height:1.0;text-align:center;}}
.hook .q{{color:var(--coral);display:inline-block;transform:rotate(-12deg);}}
.hook-sub{{margin-top:32px;font-size:34px;color:var(--text-dim);font-weight:600;text-align:center;max-width:1200px;}}
.content{{font-size:52px;line-height:1.15;text-align:center;max-width:1300px;color:var(--text);}}
.content .hl{{display:inline-block;padding:0 12px;border-radius:8px;}}
.content .hl-coral{{background:var(--coral);color:white;}}
.content .hl-sky{{background:var(--sky);color:white;}}
.content .hl-sun{{background:var(--sun);}}
.outro-line{{font-size:72px;line-height:1.1;text-align:center;max-width:1200px;}}
.outro-cta{{margin-top:48px;font-size:30px;color:var(--text-dim);}}
audio{{display:none;}}
</style></head>
<body><div id="main" data-composition-id="main" data-start="0" data-duration="{total_duration}" data-width="1920" data-height="1080" style="position:absolute;inset:0;">
<audio id="narration" src="narration.mp3" data-start="0" data-duration="{duration}"></audio>
<div class="bg-pattern"></div>
<div class="brand">AI Pals ✨</div>"""

    html += f"""
<div class="caption-bar" data-track-index="2" style="z-index:50;"><div class="caption-pill" id="caption-text"></div></div>
</div>
<script>
window.__timelines=window.__timelines||{};const tl=gsap.timeline({paused:true});
const cues = """
</script></body></html>"""
    
    out_path = os.path.join(ep_dir, "index.html")
    with open(out_path, "w") as f:
        f.write(html)
    print(f"  Written: {out_path} ({len(html)} bytes)")

def write_captions_file(ep_dir, cues, total_duration):
    out_path = os.path.join(ep_dir, "captions.json")
    with open(out_path, "w") as f:
        json.dump({"duration": total_duration, "cues": cues}, f, indent=2)
    print(f"  Captions: {out_path} ({len(cues)} cues)")

# Map slugs to channel-friendly titles
TITLES = {
    "channel-a/phone-orientation": "How does your phone know which way is up?",
    "channel-a/bread-stale": "Why does bread go stale but crackers don't?",
    "channel-a/barcode-scanner": "How do barcode scanners read upside-down barcodes?",
    "channel-b/what-is-a-robot": "What is a robot?",
    "channel-b/computers-learn": "How do computers learn?",
    "channel-b/where-ai-lives": "Where does AI live?",
}

def slug_to_dir(slug):
    return os.path.join(BASE, slug.replace("/", "\\"))

print("=== Batch-building edu channel episodes ===\n")

for slug, script_text in sorted(SCRIPTS.items()):
    ep_dir = slug_to_dir(slug)
    channel = slug.split("/")[0]
    title = TITLES.get(slug, slug)
    short_name = slug.split("/")[1]
    
    print(f"Episode: {slug}")
    
    # Skip if index.html already exists (we built it already)
    if os.path.exists(os.path.join(ep_dir, "index.html")):
        print(f"  SKIP: index.html already exists")
        # Still check for narrations
        mp3_path = os.path.join(ep_dir, "narration.mp3")
        if os.path.exists(mp3_path):
            d = get_duration(mp3_path)
            print(f"  Narration: {d:.1f}s")
        else:
            print(f"  NO NARRATION: {mp3_path}")
        print()
        continue
    
    mp3_path = os.path.join(ep_dir, "narration.mp3")
    if not os.path.exists(mp3_path):
        print(f"  WARNING: no narration at {mp3_path} — skipping")
        continue
    
    duration = get_duration(mp3_path)
    if duration is None:
        print(f"  WARNING: can't get duration — skipping")
        continue
    
    print(f"  Narration: {duration:.1f}s")
    
    chunks = chunk_script(script_text)
    cues = build_cues(chunks, duration)
    print(f"  Chunks: {len(chunks)}, cues: {len(cues)}")
    
    total_duration = round(duration + 1)  # pad
    write_index_html(ep_dir, title, short_name, channel, cues, round(duration, 2), total_duration)
    write_captions_file(ep_dir, cues, duration)
    
    # Now inline captions into the HTML
    html_path = os.path.join(ep_dir, "index.html")
    captions_path = os.path.join(ep_dir, "captions.json")
    with open(html_path) as f:
        html = f.read()
    with open(captions_path) as f:
        captions_data = json.load(f)
    
    # JSON for inline
    cues_json = json.dumps(captions_data)
    
    # The HTML has cues already baked in — check if the const is there
    if "const captions = {" in html:
        print(f"  Captions already baked ✓")
    else:
        print(f"  WARNING: captions may not be inlined")
    
    print()

print("=== Build complete ===")
