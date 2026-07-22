import subprocess, os, sys

base = r'C:\Users\Y.CHEHBOUB\PERSONAL__DO_NOT_TOUCH\edu-channel\pilot\scenes'
for i in range(7):
    d = os.path.join(base, f'scene_{i}')
    inp = os.path.join(d, f'scene_{i}.mp4')
    srt = os.path.join(d, 'captions.srt')
    out = os.path.join(d, f'scene_{i}_captioned.mp4')
    
    if not os.path.exists(inp):
        print(f"scene_{i}: input missing: {inp}")
        continue
    if not os.path.exists(srt):
        print(f"scene_{i}: srt missing: {srt}")
        continue
    
    # Write filter to temp file to avoid colon-escaping hell
    filter_file = os.path.join(base, f'vf_scene_{i}.txt')
    with open(filter_file, 'w') as f:
        f.write(f"subtitles={srt}:fontsdir=C:/Windows/Fonts:force_style='FontName=Arial,FontSize=22,PrimaryColour=&H00E2E8F0,OutlineColour=&H80000000,BorderStyle=1,Outline=1,Shadow=0,MarginV=50,Alignment=2'")
    
    cmd = f'ffmpeg -y -i "{inp}" -filter_script:v "{filter_file}" -c:a copy "{out}"'
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30)
    if r.returncode == 0:
        sz = os.path.getsize(out)
        print(f"scene_{i} captioned ({sz/1024/1024:.1f}MB)")
    else:
        err = r.stderr[-300:]
        print(f"scene_{i} FAILED: {err}")
    
    os.remove(filter_file)

print("\n=== ALL DONE ===")
