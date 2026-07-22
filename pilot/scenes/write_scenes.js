const fs = require('fs'), path = require('path');
const BASE = "C:/Users/Y.CHEHBOUB/PERSONAL__DO_NOT_TOUCH/edu-channel/pilot";

// Copy static assets per scene
const SCENE_DIRS = ['scene_0','scene_1','scene_2','scene_3','scene_4','scene_5','scene_6'];
for(const dir of SCENE_DIRS){
  const p = path.join(BASE, 'scenes', dir);
  if(!fs.existsSync(p)) fs.mkdirSync(p, {recursive:true});
  if(!fs.existsSync(path.join(p,'gsap.min.js'))) fs.copyFileSync(path.join(BASE,'vendor','gsap.min.js'), path.join(p,'gsap.min.js'));
  if(!fs.existsSync(path.join(p,'cover.svg'))) fs.copyFileSync(path.join(BASE,'assets','cover.svg'), path.join(p,'cover.svg'));
}
console.log("Assets copied");

const tmpl = fs.readFileSync(path.join(BASE,'scenes','scene_base.html'),'utf8');

const scenes = [
  {n:0,dur:22,audio:'narration_0.wav',cover:'url(cover.svg)',
   caption:'If you get <span class="hl">one percent</span> better each day',
   content:`<div class="scene" id="s0"><div class="scene-inner g1 cen"><div class="cb">Atomic Habits · Chapter 1</div><h1 class="h1">The Surprising Power of <span style="color:#FACC15;">Tiny Gains</span></h1><div class="sd cen"></div><div class="bt cen" style="font-size:48px;"><span class="hl">One percent. Every day.</span></div></div></div>`,
   anims:`tl.from(R+' .cb',{opacity:0,y:-20,duration:0.8,ease:'power4.out'},0.3);tl.from(R+' h1',{opacity:0,y:40,scale:0.98,duration:1.2,ease:'power4.out'},0.6);tl.from(R+' .sd',{scaleX:0,transformOrigin:'center',duration:0.8,ease:'power4.out'},1.3);tl.from(R+' .bt',{opacity:0,y:20,duration:1,ease:'power4.out'},1.8);`},
  {n:1,dur:28,audio:'narration_1.wav',cover:'url(cover.svg)',
   caption:'We expect <span class="hl">linear</span> progress. Results feel invisible',
   content:`<div class="scene" id="s1"><div class="scene-inner g1 cen" style="max-width:1200px;"><div class="cb">The Core Problem</div><h2 class="h2" style="font-size:72px;">We expect <span style="color:#FACC15;">linear</span> progress</h2><div class="sd cen"></div><div class="bt cen" style="font-size:44px;">Results feel invisible<br><span class="bt dim" style="font-size:36px;opacity:0.5;">Until they don't</span></div></div></div>`,
   anims:`tl.from(R+' .cb',{opacity:0,y:-15,duration:0.6,ease:'power4.out'},0.3);tl.from(R+' h2',{opacity:0,y:30,duration:1,ease:'power4.out'},0.5);tl.from(R+' .sd',{scaleX:0,transformOrigin:'center',duration:0.6,ease:'power4.out'},1.2);tl.from(R+' .bt',{opacity:0,y:20,duration:0.8,ease:'power4.out'},1.5);`},
  {n:2,dur:38,audio:'narration_2.wav',cover:'url(cover.svg)',
   caption:'Habits are the <span class="hl">compound interest</span> of self-improvement',
   content:`<div class="scene" id="s2"><div class="scene-inner g1 cen" style="max-width:1300px;"><div class="cb">The Mathematics</div><h2 class="h2" style="font-size:64px;">Habits <span style="color:#FACC15;">compound</span></h2><div class="sd cen"></div><div style="display:flex;gap:30px;justify-content:center;margin-top:10px;"><div class="card" style="text-align:center;min-width:240px;"><div class="cn" style="color:#34D399;font-size:42px;">+37x</div><div class="ct" style="font-size:26px;">Daily 1% gain</div></div><div class="card" style="text-align:center;min-width:240px;"><div class="cn" style="color:#EF4444;font-size:42px;">~0</div><div class="ct" style="font-size:26px;">Daily 1% decline</div></div></div></div></div>`,
   anims:`tl.from(R+' .cb',{opacity:0,y:-15,duration:0.6,ease:'power4.out'},0.3);tl.from(R+' h2',{opacity:0,y:30,duration:1,ease:'power4.out'},0.5);tl.from(R+' .sd',{scaleX:0,transformOrigin:'center',duration:0.6,ease:'power4.out'},1.2);tl.from(R+' .card',{opacity:0,y:20,duration:0.7,ease:'power4.out',stagger:0.15},1.8);`},
  {n:3,dur:32,audio:'narration_3.wav',cover:'url(cover.svg)',
   caption:'You do not rise to the level of your <span class="hl">goals</span>. You fall to the level of your <span class="hl">systems</span>',
   content:`<div class="scene" id="s3"><div class="scene-inner g2 cen" style="max-width:1400px;"><div class="cb" style="grid-column:1/-1;">The Shift</div><div class="card" style="text-align:center;border-color:rgba(250,204,21,0.25);"><div class="cn" style="color:#FACC15;font-size:36px;margin-bottom:8px;">Goals</div><div class="ct" style="font-size:32px;"><span class="hl">What</span> you want</div></div><div class="card" style="text-align:center;border-color:rgba(167,139,250,0.25);"><div class="cn" style="color:#A78BFA;font-size:36px;margin-bottom:8px;">Systems</div><div class="ct" style="font-size:32px;"><span class="hl">How</span> you get there</div></div><div class="bt dim" style="grid-column:1/-1;font-size:32px;text-align:center;">You fall to the level of your systems</div></div></div>`,
   anims:`tl.from(R+' .cb',{opacity:0,y:-15,duration:0.6,ease:'power4.out'},0.3);tl.from(R+' .card',{opacity:0,y:20,duration:0.8,ease:'power4.out',stagger:0.2},0.8);tl.from(R+' .bt',{opacity:0,y:15,duration:0.6,ease:'power4.out'},1.8);`},
  {n:4,dur:30,audio:'narration_4.wav',cover:'url(cover.svg)',
   caption:'Focus on <span class="hl">who you wish to become</span>, not what you want to achieve',
   content:`<div class="scene" id="s4"><div class="scene-inner g1 cen" style="max-width:1300px;"><div class="cb">The Deeper Layer</div><h2 class="h2" style="font-size:64px;">Who you <span style="color:#A78BFA;">want to become</span></h2><div class="sd cen"></div><div style="display:flex;gap:20px;justify-content:center;margin-top:8px;"><div class="card" style="text-align:center;padding:20px 24px;"><div class="cn" style="color:#FACC15;font-size:28px;">Outcomes</div><div class="ct" style="font-size:24px;">What you get</div></div><div class="card" style="text-align:center;padding:20px 24px;"><div class="cn" style="color:#FACC15;font-size:28px;">Process</div><div class="ct" style="font-size:24px;">What you do</div></div><div class="card" style="text-align:center;padding:20px 24px;border-color:rgba(167,139,250,0.3);"><div class="cn" style="color:#A78BFA;font-size:28px;">Identity</div><div class="ct" style="font-size:24px;color:#A78BFA;">What you believe</div></div></div></div></div>`,
   anims:`tl.from(R+' .cb',{opacity:0,y:-15,duration:0.6,ease:'power4.out'},0.3);tl.from(R+' h2',{opacity:0,y:30,duration:1,ease:'power4.out'},0.5);tl.from(R+' .sd',{scaleX:0,transformOrigin:'center',duration:0.6,ease:'power4.out'},1.2);tl.from(R+' .card',{opacity:0,y:15,duration:0.5,ease:'power4.out',stagger:0.1},1.5);`},
  {n:5,dur:25,audio:'narration_5.wav',cover:'url(cover.svg)',
   caption:'The Four Laws: <span class="hl">Cue</span> · <span class="hl">Craving</span> · <span class="hl">Response</span> · <span class="hl">Reward</span>',
   content:`<div class="scene" id="s5"><div class="scene-inner g1 cen" style="max-width:1400px;"><div class="cb">The Framework</div><div class="g4" style="max-width:1400px;"><div class="card" style="text-align:center;padding:24px 12px;"><div class="cn" style="color:#FACC15;font-size:32px;">Cue</div><div class="ct" style="font-size:28px;">Make it <span class="hl">obvious</span></div></div><div class="card" style="text-align:center;padding:24px 12px;"><div class="cn" style="color:#A78BFA;font-size:32px;">Craving</div><div class="ct" style="font-size:28px;">Make it <span class="hl">attractive</span></div></div><div class="card" style="text-align:center;padding:24px 12px;"><div class="cn" style="color:#34D399;font-size:32px;">Response</div><div class="ct" style="font-size:28px;">Make it <span class="hl">easy</span></div></div><div class="card" style="text-align:center;padding:24px 12px;"><div class="cn" style="color:#FB923C;font-size:32px;">Reward</div><div class="ct" style="font-size:28px;">Make it <span class="hl">satisfying</span></div></div></div></div></div>`,
   anims:`tl.from(R+' .cb',{opacity:0,y:-15,duration:0.6,ease:'power4.out'},0.3);tl.from(R+' .card',{opacity:0,y:20,duration:0.7,ease:'power4.out',stagger:0.1},0.8);`},
  {n:6,dur:36,audio:'narration_6.wav',cover:'url(cover.svg)',
   caption:'Habits <span class="hl">compound</span>. Systems over <span class="hl">goals</span>. Your <span class="hl" style="color:#A78BFA;">identity</span> drives everything',
   content:`<div class="scene" id="s6"><div class="scene-inner g1 cen" style="max-width:1100px;"><div class="cb">Chapter Summary</div><div style="display:flex;flex-direction:column;gap:20px;width:100%;"><div class="card" style="text-align:center;"><div class="ct" style="font-size:34px;">1. Habits <span class="hl">compound</span></div></div><div class="card" style="text-align:center;"><div class="ct" style="font-size:34px;">2. Systems over <span class="hl">goals</span></div></div><div class="card" style="text-align:center;border-color:rgba(167,139,250,0.3);"><div class="ct" style="font-size:34px;">3. Your <span style="color:#A78BFA;">identity</span> drives everything</div></div></div></div></div>`,
   anims:`tl.from(R+' .cb',{opacity:0,y:-15,duration:0.6,ease:'power4.out'},0.3);tl.from(R+' .card',{opacity:0,y:20,duration:0.7,ease:'power4.out',stagger:0.15},0.8);`}
];

for(const s of scenes){
  const dir = path.join(BASE, 'scenes', `scene_${s.n}`);
  // Copy narration audio
  const srcAudio = path.join(BASE, 'scenes', s.audio);
  const dstAudio = path.join(dir, 'narration.wav');
  if(fs.existsSync(srcAudio)) fs.copyFileSync(srcAudio, dstAudio);
  
  // Build HTML with correct paths for a self-contained scene dir
  let html = tmpl
    .replace(/\{N\}/g, s.n)
    .replace(/\{DUR\}/g, s.dur)
    .replace('{CAPTION}', s.caption)
    .replace('{CONTENT}', s.content)
    .replace('{ANIMATIONS}', s.anims);
  
  // Fix paths for self-contained scene directory
  html = html.replace('src="../vendor/gsap.min.js"', 'src="gsap.min.js"');
  html = html.replace("url('../assets/cover.svg')", "url('cover.svg')");
  html = html.replace(`src="narration_${s.n}.wav"`, 'src="narration.wav"');
  
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  console.log(`scene_${s.n} → ${dir} (${s.dur}s)`);
}
console.log("\nAll 7 scenes written.");
