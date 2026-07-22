import subprocess, os, re

base = r'C:\Users\Y.CHEHBOUB\PERSONAL__DO_NOT_TOUCH\edu-channel\pilot\scenes'
style_header = '''[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BorderStyle, Outline, Shadow, Alignment, MarginV
Style: Default,Arial,22,&H00E2E8F0,&H80000000,1,2,0,2,50

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
'''

for i in range(7):
    d = os.path.join(base, f'scene_{i}')
    inp = os.path.join(d, f'scene_{i}.mp4')
    srt = os.path.join(d, 'captions.srt')
    ass_out = os.path.join(d, 'captions.ass')
    out = os.path.join(d, f'scene_{i}_captioned.mp4')
    
    # Convert SRT to clean ASS (no style embedded yet)
    # Read SRT entries, convert to ASS dialogue lines
    with open(srt, 'r', encoding='utf-8') as f:
        srt_text = f.read()
    
    # Pattern: 1\n00:00:00,000 --> 00:00:05,000\nText\n\n
    # ASS format: Dialogue: 0,0:00:00.00,0:00:05.00,Default,,0,0,0,,Text
    ass_lines = []
    block_pattern = re.compile(r'(\d+)\n(\d{2}:\d{2}:\d{2}),(\d{3}) --> (\d{2}:\d{2}:\d{2}),(\d{3})\n(.*?)\n\n', re.DOTALL)
    
    # Simpler: split by blank lines
    blocks = srt_text.strip().split('\n\n')
    for block in blocks:
        lines = block.strip().split('\n')
        if len(lines) < 3:
            continue
        # lines[0] = index, lines[1] = timecode, lines[2+] = text
        tc = lines[1]
        tc_match = re.match(r'(\d{2}:\d{2}:\d{2}),(\d{3}) --> (\d{2}:\d{2}:\d{2}),(\d{3})', tc)
        if not tc_match:
            continue
        start = tc_match.group(1) + '.' + tc_match.group(2)[:2]
        end = tc_match.group(3) + '.' + tc_match.group(4)[:2]
        text = '\\N'.join(lines[2:])  # SRT multiline to ASS \N
        ass_lines.append(f'Dialogue: 0,{start},{end},Default,,0,0,0,,{text}')
    
    ass_content = style_header + '\n'.join(ass_lines)
    with open(ass_out, 'w', encoding='utf-8') as f:
        f.write(ass_content)
    
    # Burn ASS without force_style (style is embedded)
    cmd = f'ffmpeg -y -i "{inp}" -vf "ass={ass_out}" -c:a copy "{out}"'
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30)
    if r.returncode == 0:
        sz = os.path.getsize(out)
        print(f"scene_{i} captioned ({sz/1024/1024:.1f}MB)")
    else:
        err = r.stderr[-200:]
        print(f"scene_{i} FAILED: {err}")

print("\n=== ALL DONE ===")
