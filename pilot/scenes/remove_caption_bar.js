const fs = require('fs'), path = require('path');
const BASE = "C:/Users/Y.CHEHBOUB/PERSONAL__DO_NOT_TOUCH/edu-channel/pilot";

for(let i = 0; i < 7; i++){
  const p = path.join(BASE, 'scenes', `scene_${i}`, 'index.html');
  let html = fs.readFileSync(p, 'utf8');
  // Remove the GSAP caption bar animation lines (they're in the <script> section)
  // Keep the caption bar HTML element but remove GSAP animation
  html = html.replace(/\/\/ Caption bar fades in[\s\S]*?DUR-0\.3\);/m, '// Caption bar hidden — FFmpeg subtitles handle this');
  // Remove the caption bar visibility toggle in CSS
  html = html.replace(/#cbar\{[\s\S]*?\}/m, 
    '#cbar{position:absolute;left:50%;bottom:120px;z-index:50;'+
    'transform:translateX(-50%);background:rgba(10,13,22,0.60);'+
    'border:1px solid rgba(250,204,21,0.08);border-radius:8px;'+
    'padding:10px 20px;max-width:800px;opacity:0;visibility:hidden;pointer-events:none;}');
  // Hide the text content inside caption bar
  html = html.replace(/#cbar \.text\{[\s\S]*?\}/m, 
    '#cbar .text{font-size:20px;font-weight:300;color:#94A3B8;}');
  // Remove the tl.set/tl.to lines for caption bar in the GSAP section
  html = html.replace(/\/\/ Caption bar hidden[\s\S]*?FFmpeg subtitles handle this\n/, '');
  
  fs.writeFileSync(p, html);
  console.log(`scene_${i} caption bar removed`);
}
console.log("Done.");
