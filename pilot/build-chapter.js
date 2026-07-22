#!/usr/bin/env node
/**
 * build-chapter.js — Atomic Habits Chapter Automation Pipeline
 * 
 * Usage:
 *   node build-chapter.js --data ../data/chapter-01.json
 *   node build-chapter.js --batch  # renders all chapters in ../data/
 *
 * Requires: HyperFrames CLI, ffmpeg, Edge TTS
 * Produces: dist/Atomic_Habits_Ch${n}.mp4
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = __dirname;
const DIST = path.resolve(ROOT, 'dist');
const DATA = path.resolve(ROOT, 'data');
const ASSETS = path.resolve(ROOT, 'assets');
const TEMPLATE = path.resolve(ROOT, 'templates/chapter-template.html');
const COVER = path.resolve(ASSETS, 'cover.jpg');

// Ensure dist dir
fs.mkdirSync(DIST, { recursive: true });

function run(cmd, opts = {}) {
  console.log(`  $ ${cmd}`);
  return execSync(cmd, { stdio: 'pipe', ...opts }).toString().trim();
}

function escapeHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/**
 * Step 1: Generate narration audio from script text
 */
function generateNarration(scriptText, outputPath) {
  const text = scriptText.replace(/"/g, "'").replace(/\n/g, ' ');
  run(`edge-tts --voice en-US-GuyNeural --rate=-10% --write-media "${outputPath}" --text "${text}"`, { timeout: 120000 });
  
  const dur = run(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1 "${outputPath}"`);
  return parseFloat(dur);
}

/**
 * Step 2: Generate word-level timestamps via HyperFrames transcribe
 */
function generateTimestamps(audioPath, outputJsonPath) {
  try {
    const result = run(`npx hyperframes transcribe "${audioPath}"`, { timeout: 120000 });
    // Parse the transcript output — save as JSON
    const lines = result.split('\n').filter(l => l.trim() && !l.startsWith('['));
    const words = [];
    for (const line of lines) {
      const parts = line.split('\t');
      if (parts.length >= 2) {
        words.push({ w: parts[1], t: parseFloat(parts[0]) });
      }
    }
    if (words.length > 0) {
      fs.writeFileSync(outputJsonPath, JSON.stringify(words, null, 2));
      return words;
    }
  } catch (e) {
    console.warn(`  ⚠ Whisper transcription failed: ${e.message}`);
    console.warn('  → Falling back to proportional timing');
  }
  return null;
}

/**
 * Step 3: Build HTML composition from template + data
 */
function buildHTML(chapterData, wordTimings, duration) {
  const {
    book_title,
    chapter_number,
    chapter_title,
    author,
    accent_color = '#FACC15',
    script_words,
    takeaways = [],
    hook_text = '',
    quote_text = '',
    quote_author = author,
    cover_image = 'assets/cover.jpg'
  } = chapterData;

  // Split script into word array
  const words = script_words.split(/\s+/);
  
  // Build word timing data
  let wordTimingJS;
  if (wordTimings && wordTimings.length > 0) {
    wordTimingJS = JSON.stringify(wordTimings);
  } else {
    // Proportional fallback
    const wd = duration / words.length;
    wordTimingJS = `[${words.map((w, i) => JSON.stringify({ w, t: i * wd })).join(',')}]`;
  }

  // Build scenes
  const scenes = [
    { id: 's1', label: `${book_title} · Chapter ${chapter_number}`, content: buildHookScene(chapter_number, chapter_title) },
    { id: 's2', label: 'The Core Idea', content: buildProblemScene(script_words.slice(0, 80).join(' ')) },
    { id: 's3', label: 'Why It Matters', content: buildTakeawaysScene(takeaways) },
    { id: 's4', label: 'Chapter Summary', content: buildSummaryScene(chapter_number) }
  ];

  const scenesJS = scenes.map((s, i) => 
    `{id:'${s.id}',a:${i * (duration / scenes.length)},b:${(i + 1) * (duration / scenes.length)},label:'${s.label}'}`
  ).join(',\n  ');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=1920,height=1080">
<title>${book_title} — Chapter ${chapter_number}: ${chapter_title}</title>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>
@font-face{font-family:'Space Grotesk';src:local('Space Grotesk'),local('Space Grotesk-Bold');}
@font-face{font-family:'Inter';src:local('Inter'),local('Inter-Regular');}
*{margin:0;padding:0;box-sizing:border-box;}
html,body{width:1920px;height:1080px;overflow:hidden;font-family:'Inter',sans-serif;color:#F8FAFC;}
#bg-cover{position:absolute;inset:0;z-index:0;background:linear-gradient(135deg,rgba(10,13,22,0.92) 0%,rgba(10,13,22,0.70) 50%,rgba(10,13,22,0.92) 100%),url('${cover_image}') center/cover no-repeat;filter:blur(2px) saturate(0.6) brightness(0.22);transform:scale(1.02);animation:kenburns 240s ease-in-out infinite alternate;}
@keyframes kenburns{from{transform:scale(1.02) brightness(0.22)}to{transform:scale(1.08) brightness(0.25)}}
#bg-ambient{position:absolute;inset:0;z-index:1;background:radial-gradient(ellipse 80% 60% at 50% 40%,rgba(250,204,21,0.04) 0%,transparent 60%),radial-gradient(ellipse 60% 50% at 70% 80%,rgba(99,102,241,0.03) 0%,transparent 50%);opacity:0.6;}
.scene{position:absolute;inset:0;z-index:10;display:flex;flex-direction:column;padding:100px 140px 220px;}
.clip{visibility:hidden;}
.cb{display:inline-block;padding:8px 24px;border:1px solid rgba(250,204,21,0.3);font-family:'Space Grotesk',sans-serif;font-size:18px;font-weight:500;letter-spacing:3px;text-transform:uppercase;color:rgba(250,204,21,0.8);margin-bottom:24px;align-self:flex-start;}
.ca{display:grid;grid-template-columns:1fr;gap:40px;flex:1;align-content:center;text-align:center;max-width:1400px;margin:0 auto;}
.ca2{display:grid;grid-template-columns:1fr 1fr;gap:40px;flex:1;align-content:center;max-width:1500px;margin:0 auto;}
h1{font-family:'Space Grotesk',sans-serif;font-size:72px;font-weight:600;letter-spacing:-0.02em;line-height:1.15;margin-bottom:16px;}
h2{font-family:'Space Grotesk',sans-serif;font-size:52px;font-weight:600;letter-spacing:-0.02em;line-height:1.15;margin-bottom:14px;}
.bt{font-size:34px;font-weight:300;line-height:1.35;color:#CBD5E1;}
.bt .hl{color:${accent_color};font-weight:500;}
.bt .dim{color:#64748B;font-size:28px;}
.sd{width:60px;height:2px;background:rgba(250,204,21,0.5);margin:20px auto;}
.card{background:rgba(15,23,42,0.6);border:1px solid rgba(148,163,184,0.1);border-radius:4px;padding:28px 32px;text-align:left;}
.card .cn{font-family:'Space Grotesk',sans-serif;font-size:28px;font-weight:700;color:${accent_color};margin-bottom:8px;}
.card .ct{font-size:26px;font-weight:300;line-height:1.3;color:#E2E8F0;}
.card .hl{color:${accent_color};font-weight:500;}
.ql{border-left:2px solid ${accent_color};padding:20px 32px;background:rgba(15,23,42,0.4);border-radius:2px;}
.ql .qt{font-size:28px;font-weight:300;font-style:italic;color:#E2E8F0;line-height:1.3;}
.ql .qs{font-size:18px;color:#64748B;margin-top:10px;}
#caption-bar{position:absolute;left:50%;bottom:180px;z-index:50;transform:translateX(-50%);background:rgba(10,13,22,0.88);border:1px solid rgba(148,163,184,0.12);border-radius:6px;padding:14px 28px;backdrop-filter:blur(8px);display:flex;gap:6px;max-width:1400px;min-height:48px;align-items:center;justify-content:center;flex-wrap:wrap;opacity:0;visibility:hidden;}
.cw{font-size:28px;font-weight:400;color:#E2E8F0;transition:color 0.08s,transform 0.08s;}
.cw.active{color:${accent_color};font-weight:500;transform:scale(1.08);}
.cw.done{color:#94A3B8;}
audio{display:none;}
</style>
</head>
<body>
<div id="main" data-composition-id="main" data-start="0" data-duration="${Math.ceil(duration)}" data-width="1920" data-height="1080">
<audio id="narration" src="narration.wav" data-start="0" data-duration="${Math.ceil(duration)}"></audio>
<div id="bg-cover"></div>
<div id="bg-ambient"></div>
<div id="caption-bar">
  <div id="cc" style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center;"></div>
</div>

${scenes.map(s => s.content).join('\n')}

</div>
<script>
const WORDS = ${wordTimingJS};
const CC = document.getElementById('cc');
const WEL = WORDS.map((w,i)=>{const s=document.createElement('span');s.className='cw';s.textContent=w.w;s.dataset.index=i;CC.appendChild(s);return s;});

window.__timelines=window.__timelines||{};
const tl=gsap.timeline({paused:true});
const R='[data-composition-id="main"]';
const SS=[${scenesJS}];
SS.forEach(s=>{tl.set(R+' #'+s.id,{autoAlpha:0},0);tl.to(R+' #'+s.id,{autoAlpha:1,duration:0.8},s.a+0.3);tl.to(R+' #'+s.id,{autoAlpha:0,duration:0.6},s.b-0.6);});
tl.to('#caption-bar',{autoAlpha:1,duration:0.6},0.5);
tl.to('#caption-bar',{autoAlpha:0,duration:0.5},${duration});

WORDS.forEach((wd,i)=>{
  const el=WEL[i];
  tl.call(()=>{WEL.forEach(w=>{w.classList.remove('active','done');});for(let j=0;j<i;j++)WEL[j].classList.add('done');el.classList.add('active');},[],wd.t);
  const nt=WORDS[i+1]?WORDS[i+1].t:wd.t+0.3;
  tl.call(()=>{el.classList.remove('active');el.classList.add('done');},[],nt-0.05);
});

// Scene animation entrances
${scenes.map((s, i) => {
  const a = i * (duration / scenes.length);
  return `tl.from(R+' #${s.id} .anim',{opacity:0,y:30,duration:1,ease:'power2.out',stagger:0.15},${a+0.5});`;
}).join('\n')}

window.__timelines["main"]=tl;
</script>
</body>
</html>`;
}

function buildHookScene(ch, title) {
  return `<div class="scene clip" id="s1"><div class="cb">Chapter ${ch}</div><div class="ca"><h1>${escapeHtml(title)}</h1></div></div>`;
}

function buildProblemScene(text) {
  return `<div class="scene clip" id="s2"><div class="cb">The Core Idea</div><div class="ca"><div class="bt anim">${escapeHtml(text)}</div></div></div>`;
}

function buildTakeawaysScene(takeaways) {
  if (!takeaways || takeaways.length === 0) {
    return `<div class="scene clip" id="s3"><div class="cb">Key Takeaways</div><div class="ca"><div class="bt">The insights from this chapter transform how you approach change.</div></div></div>`;
  }
  return `<div class="scene clip" id="s3"><div class="cb">Key Takeaways</div><div class="ca2">${takeaways.map((t, i) => 
    `<div class="card anim"><div class="cn">${i + 1}</div><div class="ct">${escapeHtml(t)}</div></div>`
  ).join('')}</div></div>`;
}

function buildSummaryScene(ch) {
  return `<div class="scene clip" id="s4"><div class="cb">Chapter ${ch} Complete</div><div class="ca"><div class="bt anim">This was Chapter ${ch}.<br/><span class="hl">Up next: Chapter ${parseInt(ch) + 1}</span></div></div></div>`;
}

module.exports = { buildChapter };

/**
 * Main pipeline
 */
async function buildChapter(chapterDataPath) {
  const data = JSON.parse(fs.readFileSync(chapterDataPath, 'utf-8'));
  const ch = data.chapter_number.toString().padStart(2, '0');
  const workDir = path.resolve(ROOT, `ch${ch}`);
  fs.mkdirSync(workDir, { recursive: true });

  console.log(`\n📘 Building Chapter ${ch}: ${data.chapter_title}`);

  // Step 1: Generate narration
  console.log('  Step 1/5: Generating narration...');
  const audioPath = path.resolve(workDir, 'narration.wav');
  const duration = generateNarration(data.script_text, audioPath);
  console.log(`  → ${duration.toFixed(1)}s narration`);

  // Step 2: Word timestamps
  console.log('  Step 2/5: Generating word timestamps...');
  const timestampPath = path.resolve(workDir, 'timestamps.json');
  const wordTimings = generateTimestamps(audioPath, timestampPath);
  
  // Step 3: Build HTML
  console.log('  Step 3/5: Building composition...');
  const html = buildHTML(data, wordTimings, duration);
  const htmlPath = path.resolve(workDir, 'index.html');
  fs.writeFileSync(htmlPath, html);

  // Copy assets
  if (data.cover_image && fs.existsSync(data.cover_image)) {
    fs.cpSync(data.cover_image, path.resolve(workDir, 'cover.jpg'), { recursive: true });
  } else if (fs.existsSync(COVER)) {
    fs.cpSync(COVER, path.resolve(workDir, 'cover.jpg'));
  }
  // Link narration
  if (!fs.existsSync(path.resolve(workDir, 'narration.wav'))) {
    try { fs.cpSync(audioPath, path.resolve(workDir, 'narration.wav')); } catch(e) {}
  }

  // Step 4: Lint & validate
  console.log('  Step 4/5: Running quality gates...');
  try {
    const lint = execSync(`cd "${workDir}" && npx hyperframes lint`, { stdio: 'pipe', timeout: 30000 }).toString();
    process.stdout.write(lint.split('\n').filter(l => l.includes('✗') || l.includes('error')).join('\n') + '\n');
  } catch(e) {
    console.warn('  ⚠ Lint warnings (non-blocking)');
  }

  // Step 5: Render
  console.log('  Step 5/5: Rendering video...');
  const outputPath = path.resolve(DIST, `Atomic_Habits_Ch${ch}.mp4`);
  try {
    execSync(`cd "${workDir}" && npx hyperframes render --output "${outputPath}" --quality high --fps 30`, { stdio: 'inherit', timeout: 600000 });
    const size = fs.statSync(outputPath).size;
    console.log(`  ✅ Rendered: ${(size / 1024 / 1024).toFixed(1)}MB → ${outputPath}`);
    return { success: true, path: outputPath, duration };
  } catch(e) {
    console.error(`  ❌ Render failed: ${e.message}`);
    return { success: false, error: e.message };
  }
}

// CLI entry point
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Usage:');
  console.log('  node build-chapter.js --data <path-to-json>');
  console.log('  node build-chapter.js --batch');
  process.exit(0);
}

if (args.includes('--data')) {
  const idx = args.indexOf('--data') + 1;
  const dataPath = path.resolve(process.cwd(), args[idx]);
  buildChapter(dataPath).then(result => {
    if (!result.success) process.exit(1);
  });
} else if (args.includes('--batch')) {
  const files = fs.readdirSync(DATA).filter(f => f.endsWith('.json')).sort();
  console.log(`📚 Batch building ${files.length} chapters...`);
  (async () => {
    for (const file of files) {
      await buildChapter(path.resolve(DATA, file));
    }
    console.log('\n✅ Batch complete!');
  })();
}
