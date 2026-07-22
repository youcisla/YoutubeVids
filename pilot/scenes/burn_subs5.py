import subprocess, os, re, tempfile

base = r'C:\Users\Y.CHEHBOUB\PERSONAL__DO_NOT_TOUCH\edu-channel\pilot\scenes'
tmpdir = os.path.join(tempfile.gettempdir(), 'ah_subs')
os.makedirs(tmpdir, exist_ok=True)

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
    out = os.path.join(d, f'scene_{i}_captioned.mp4')
    
    # Convert SRT → ASS
    with open(srt, 'r', encoding='utf-8') as f:
        srt_text = f.read()
    blocks = srt_text.strip().split('\n\n')
    ass_lines = []
    for block in blocks:
        lines = block.strip().split('\n')
        if len(lines) < 3:
            continue
        tc_match = re.match(r'(\d{2}:\d{2}:\d{2}),(\d{3}) --> (\d{2}:\d{2}:\d{2}),(\d{3})', lines[1])
        if not tc_match:
            continue
        start = f"{tc_match.group(1)}.{tc_match.group(2)[:2]}"
        end = f"{tc_match.group(3)}.{tc_match.group(4)[:2]}"
        text = '\\N'.join(lines[2:])
        ass_lines.append(f'Dialogue: 0,{start},{end},Default,,0,0,0,,{text}')
    
    # Write ASS to scene dir (existing)
    ass_path = os.path.join(d, 'captions.ass')
    with open(ass_path, 'w', encoding='utf-8') as f:
        f.write(style_header + '\n'.join(ass_lines))
    
    # Write filter_script with FORWARD SLASHES in the path (ffmpeg on Windows handles these)
    filter_file = os.path.join(tmpdir, f'vf_{i}.txt')
    ass_fwd = ass_path.replace('\\', '/')
    with open(filter_file, 'w') as f:
        f.write(f"ass={ass_fwd}")
    
    cmd = f'ffmpeg -y -i "{inp}" -filter_script:v "{filter_file}" -c:a copy "{out}"'
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30)
    if r.returncode == 0:
        sz = os.path.getsize(out)
        print(f"scene_{i} captioned ({sz/1024/1024:.1f}MB)")
    else:
        err = r.stderr[-200:]
        print(f"scene_{i} FAILED: {err}")

print("\n=== ALL DONE ===")
