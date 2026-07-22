$base = "C:\Users\Y.CHEHBOUB\PERSONAL__DO_NOT_TOUCH\edu-channel\pilot\scenes"
for ($i = 0; $i -le 6; $i++) {
    $dir = "$base\scene_$i"
    $inp = "$dir\scene_$i.mp4"
    $out = "$dir\scene_${i}_captioned.mp4"
    Write-Host "Burning scene $i..."
    # Build filter without inline colons to avoid PS parsing issues
    $subFilter = "subtitles=$dir\captions.srt:fontsdir=C:/Windows/Fonts:force_style='FontName=Arial,FontSize=22,PrimaryColour=&H00E2E8F0,OutlineColour=&H80000000,BorderStyle=1,Outline=1,Shadow=0,MarginV=50,Alignment=2'"
    & ffmpeg -y -i $inp -vf $subFilter -c:a copy $out 2>&1 | Select-Object -Last 1
}
Write-Host "=== ALL CAPTIONED ==="
