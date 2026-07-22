@echo off
setlocal enabledelayedexpansion
set BASE=C:\Users\Y.CHEHBOUB\PERSONAL__DO_NOT_TOUCH\edu-channel\pilot\scenes
for %%i in (0 1 2 3 4 5 6) do (
  set "INP=!BASE!\scene_%%i\scene_%%i.mp4"
  set "SRT=!BASE!\scene_%%i\captions.srt"
  set "OUT=!BASE!\scene_%%i\scene_%%i_captioned.mp4"
  echo Burning scene %%i...
  ffmpeg -y -i "!INP!" -vf "subtitles=!SRT!:fontsdir=C:/Windows/Fonts:force_style='FontName=Arial,FontSize=22,PrimaryColour=&H00E2E8F0,OutlineColour=&H80000000,BorderStyle=1,Outline=1,Shadow=0,MarginV=50,Alignment=2'" -c:a copy "!OUT!" 2>&1 | findstr "video:"
)
echo === ALL CAPTIONED ===
