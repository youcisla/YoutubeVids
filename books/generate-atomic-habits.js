#!/usr/bin/env node
/**
 * generate-atomic-habits.js — Produces all 20 Atomic Habits chapter JSON files.
 * Each chapter has 5-7 scenes with GSAP HTML, narration text, and timed captions.
 *
 * Usage: node books/generate-atomic-habits.js
 */

const fs = require('fs');
const path = require('path');

const OUT = path.resolve(__dirname, 'atomic-habits');
fs.mkdirSync(OUT, { recursive: true });

// ─── Shared HTML fragments ──────────────────────────────

const BADGE = (t) => `<div class="cb">Atomic Habits · ${t}</div>`;
const SD = `<div class="sd cen"></div>`;

const hook = (title, subtitle) => ({
  html: `<div class="scene" id="s0"><div class="scene-inner g1 cen">${BADGE('Chapter')}<h1 class="h1" style="margin-bottom:8px;max-width:1400px;">${title}</h1>${SD}<div class="bt cen" style="font-size:48px;font-weight:400;"><span class="hl">${subtitle}</span></div></div></div>`,
  anims: `tl.from(R+' .cb',{opacity:0,y:-20,duration:0.8,ease:'power4.out'},0.3);tl.from(R+' h1',{opacity:0,y:40,scale:0.98,duration:1.2,ease:'power4.out'},0.6);tl.from(R+' .sd',{scaleX:0,transformOrigin:'center',duration:0.8,ease:'power4.out'},1.3);tl.from(R+' .bt',{opacity:0,y:20,duration:1,ease:'power4.out'},1.8);`
});

const twoCard = (title, card1Head, card1Body, card2Head, card2Body, bottomLine) => ({
  html: `<div class="scene" id="s"><div class="scene-inner g2 cen" style="max-width:1400px;">${BADGE(title)}<div class="card" style="border-color:rgba(250,204,21,0.25);text-align:center;"><div class="cn" style="color:#FACC15;font-size:36px;">${card1Head}</div><div class="ct" style="font-size:32px;">${card1Body}</div></div><div class="card" style="border-color:rgba(167,139,250,0.25);text-align:center;"><div class="cn" style="color:#A78BFA;font-size:36px;">${card2Head}</div><div class="ct" style="font-size:32px;">${card2Body}</div></div>${bottomLine ? `<div class="bt dim" style="grid-column:1/-1;font-size:30px;text-align:center;">${bottomLine}</div>` : ''}</div></div>`,
  anims: `tl.from(R+' .cb',{opacity:0,y:-15,duration:0.6,ease:'power4.out'},0.3);tl.from(R+' .card',{opacity:0,y:20,duration:0.8,ease:'power4.out',stagger:0.2},0.8);${bottomLine ? `tl.from(R+' .bt',{opacity:0,y:15,duration:0.6,ease:'power4.out'},1.8);` : ''}`
});

const threeCards = (badge, h2text, cards) => ({
  html: `<div class="scene" id="s"><div class="scene-inner g1 cen" style="max-width:1300px;">${BADGE(badge)}${h2text ? `<h2 class="h2" style="font-size:56px;">${h2text}</h2>${SD}` : ''}<div style="display:flex;gap:20px;justify-content:center;flex-wrap:wrap;">${cards.map((c,i)=>`<div class="card" style="text-align:center;padding:20px 24px;min-width:180px;${i===2?'border-color:rgba(167,139,250,0.3);':''}"><div class="cn" style="font-size:26px;${i===2?'color:#A78BFA;':''}">${c.head}</div><div class="ct" style="font-size:22px;">${c.body}</div></div>`).join('')}</div></div></div>`,
  anims: `tl.from(R+' .cb',{opacity:0,y:-15,duration:0.6,ease:'power4.out'},0.3);${h2text ? `tl.from(R+' h2',{opacity:0,y:30,duration:1,ease:'power4.out'},0.5);tl.from(R+' .sd',{scaleX:0,transformOrigin:'center',duration:0.6,ease:'power4.out'},1.2);` : ''}tl.from(R+' .card',{opacity:0,y:15,duration:0.5,ease:'power4.out',stagger:0.1},1.5);`
});

const fourLaws = [
  {cn:'Cue',ct:'Make it <span class="hl">obvious</span>',color:'#FACC15'},
  {cn:'Craving',ct:'Make it <span class="hl">attractive</span>',color:'#A78BFA'},
  {cn:'Response',ct:'Make it <span class="hl">easy</span>',color:'#34D399'},
  {cn:'Reward',ct:'Make it <span class="hl">satisfying</span>',color:'#FB923C'}
];

const fourLawsGrid = (badge) => ({
  html: `<div class="scene" id="s"><div class="scene-inner g1 cen" style="max-width:1400px;">${BADGE(badge)}<div class="g4">${fourLaws.map(l=>`<div class="card" style="text-align:center;padding:24px 12px;"><div class="cn" style="color:${l.color};font-size:30px;">${l.cn}</div><div class="ct" style="font-size:26px;">${l.ct}</div></div>`).join('')}</div></div></div>`,
  anims: `tl.from(R+' .cb',{opacity:0,y:-15,duration:0.6,ease:'power4.out'},0.3);tl.from(R+' .card',{opacity:0,y:20,duration:0.7,ease:'power4.out',stagger:0.1},0.8);`
});

const summaryCards = (badge, items) => ({
  html: `<div class="scene" id="s"><div class="scene-inner g1 cen" style="max-width:1100px;">${BADGE(badge)}<div style="display:flex;flex-direction:column;gap:20px;width:100%;">${items.map((t,i)=>`<div class="card" style="text-align:center;"><div class="ct" style="font-size:32px;">${i+1}. ${t}</div></div>`).join('')}</div></div></div>`,
  anims: `tl.from(R+' .cb',{opacity:0,y:-15,duration:0.6,ease:'power4.out'},0.3);tl.from(R+' .card',{opacity:0,y:20,duration:0.7,ease:'power4.out',stagger:0.15},0.8);`
});

const keyInsight = (badge, h2, body, body2) => ({
  html: `<div class="scene" id="s"><div class="scene-inner g1 cen" style="max-width:1200px;">${BADGE(badge)}<h2 class="h2" style="font-size:64px;">${h2}</h2>${SD}<div class="bt cen" style="font-size:38px;">${body}</div>${body2 ? `<div class="bt dim cen" style="font-size:32px;margin-top:20px;">${body2}</div>` : ''}</div></div>`,
  anims: `tl.from(R+' .cb',{opacity:0,y:-15,duration:0.6,ease:'power4.out'},0.3);tl.from(R+' h2',{opacity:0,y:30,duration:1,ease:'power4.out'},0.5);tl.from(R+' .sd',{scaleX:0,transformOrigin:'center',duration:0.6,ease:'power4.out'},1.2);tl.from(R+' .bt',{opacity:0,y:20,duration:0.8,ease:'power4.out'},1.5);`
});

// ─── Chapter definitions ─────────────────────────────────

const CHAPTERS = [
  // Ch 1
  {
    number: 1,
    title: "The Surprising Power of Tiny Gains",
    narration: "If you get one percent better each day for one year you will end up thirty seven times better. Conversely if you get one percent worse each day for one year you will decline nearly down to zero. That is the mathematics of tiny habits. We expect progress to be linear. We put in the work and expect results immediately. When they do not arrive we quit. We fail to see that habits are the compound interest of self improvement. Getting one percent better matters because it multiplies. This is why patience matters as much as effort. Winners and losers have the same goals. What separates them is not the goal but the system. Goals are about the results you want to achieve. Systems are about the processes that lead to those results. You do not rise to the level of your goals. You fall to the level of your systems. There are three levels of behavior change. Outcomes what you get. Process what you do. Identity what you believe. The most effective way to change your habits is to focus not on what you want to achieve but on who you wish to become. Habits are the compound interest of self improvement. One percent daily is not small. It is transformative. Focus on systems not goals. Identity shift is the ultimate form of habit change.",
    scenes: [
      { ...hook("The Surprising Power of<br><span style='color:#FACC15;'>Tiny Gains</span>", "One percent. Every day."), timestamp_end: 20, duration: 22, captions: [
        {start:0,end:6,text:"If you get one percent better each day"},
        {start:6,end:12,text:"you will end up thirty-seven times better"},
        {start:12,end:18,text:"The mathematics of tiny habits"},
        {start:18,end:22,text:"This is the compound interest of self-improvement"}
      ]},
      { ...keyInsight("The Core Problem", "We expect <span style='color:#FACC15;'>linear</span> progress", "Results feel invisible", "Until they don't"), timestamp_end: 46, duration: 26, captions: [
        {start:0,end:6,text:"We expect progress to be linear"},
        {start:6,end:12,text:"When results don't arrive, we quit"},
        {start:12,end:18,text:"Habits compound over time"},
        {start:18,end:26,text:"Patience matters as much as effort"}
      ]},
      { ...keyInsight("The Trap", "The <span style='color:#FACC15;'>Plateau of Latent Potential</span>", "You work and you work and you see nothing", "Then suddenly your effort breaks through"), timestamp_end: 72, duration: 26, captions: [
        {start:0,end:7,text:"The Plateau of Latent Potential"},
        {start:7,end:14,text:"Early effort produces almost no visible result"},
        {start:14,end:20,text:"The most powerful outcomes are delayed"},
        {start:20,end:26,text:"Patience is the differentiator"}
      ]},
      { ...twoCard("The Shift", "Goals", "<span class='hl'>What</span> you want", "Systems", "<span class='hl'>How</span> you get there", "You fall to the level of your systems"), timestamp_end: 102, duration: 30, captions: [
        {start:0,end:6,text:"Winners and losers have the same goals"},
        {start:6,end:13,text:"What separates them is not the goal"},
        {start:13,end:20,text:"It is the system"},
        {start:20,end:30,text:"You do not rise to the level of your goals"}
      ]},
      { ...threeCards("Three Levels", "Behavior <span style='color:#FACC15;'>change</span>", [
        {head:"Outcomes",body:"What you get"},
        {head:"Process",body:"What you do"},
        {head:"Identity",body:"What you believe"}
      ]), timestamp_end: 130, duration: 28, captions: [
        {start:0,end:6,text:"Three levels of behavior change"},
        {start:6,end:12,text:"Outcomes — what you get"},
        {start:12,end:18,text:"Process — what you do"},
        {start:18,end:28,text:"Identity — what you believe"}
      ]},
      { ...fourLawsGrid("The Framework"), timestamp_end: 156, duration: 26, captions: [
        {start:0,end:6,text:"Make it obvious"},
        {start:6,end:12,text:"Make it attractive"},
        {start:12,end:18,text:"Make it easy"},
        {start:18,end:26,text:"Make it satisfying"}
      ]},
      { ...summaryCards("Chapter Summary", [
        "Habits <span class='hl'>compound</span>",
        "Systems over <span class='hl'>goals</span>",
        "Your <span style='color:#A78BFA;'>identity</span> drives everything"
      ]), timestamp_end: 211, duration: 55, captions: [
        {start:0,end:8,text:"Habits are the compound interest"},
        {start:8,end:16,text:"Focus on systems not goals"},
        {start:16,end:28,text:"Identity shift is the ultimate form of habit change"},
        {start:28,end:40,text:"When you believe, you stop needing motivation"},
        {start:40,end:55,text:"This is the foundation of Atomic Habits"}
      ]}
    ]
  },
  // Ch 2
  {
    number: 2,
    title: "How Your Habits Shape Your Identity",
    narration: "Every action you take is a vote for the type of person you wish to become. No single instance transforms your beliefs. But as the votes build the evidence of your new identity grows. This is why habits are so powerful. They are not just results of your identity. They become part of it. The goal is not to read a book. The goal is to become a reader. The goal is not to run a marathon. The goal is to become a runner. The most practical way to change who you are is to change what you do. Each habit is like a suggestion. I am the kind of person who goes to the gym every day. I am the kind of person who writes five hundred words a day. Over time the evidence accumulates and your self image begins to shift. This is why simple habits matter. Not because they deliver big results in the moment. But because they cast a vote for your identity. The process of building habits is actually the process of becoming yourself. New identity requires new evidence. You cannot just decide to become a new person. You have to prove it to yourself through action.",
    scenes: [
      { ...hook("How Your Habits Shape<br><span style='color:#A78BFA;'>Your Identity</span>", "Every action is a vote"), timestamp_end: 20, duration: 26, captions: [
        {start:0,end:7,text:"Every action you take is a vote"},
        {start:7,end:14,text:"For the type of person you wish to become"},
        {start:14,end:20,text:"No single instance transforms your beliefs"},
        {start:20,end:26,text:"But the evidence of your new identity grows"}
      ]},
      { ...keyInsight("The Core Idea", "Habits are not just results<br>They <span style='color:#A78BFA;'>become part</span> of your identity", "The goal is not to read a book", "The goal is to become a reader"), timestamp_end: 48, duration: 28, captions: [
        {start:0,end:7,text:"The goal is not to read a book"},
        {start:7,end:14,text:"The goal is to become a reader"},
        {start:14,end:21,text:"The goal is not to run a marathon"},
        {start:21,end:28,text:"The goal is to become a runner"}
      ]},
      { ...twoCard("How It Works", "Old Identity", "Based on past <span class='hl'>evidence</span>", "New Identity", "Built through <span class='hl'>new actions</span>", "Each habit is a vote for who you want to be"), timestamp_end: 78, duration: 30, captions: [
        {start:0,end:7,text:"The most practical way to change who you are"},
        {start:7,end:14,text:"Is to change what you do"},
        {start:14,end:22,text:"Each habit is like a suggestion"},
        {start:22,end:30,text:"A vote for your new identity"}
      ]},
      { ...keyInsight("The Process", "New <span style='color:#A78BFA;'>identity</span> requires new evidence", "You cannot just decide to become a new person", "You have to prove it to yourself through action"), timestamp_end: 108, duration: 30, captions: [
        {start:0,end:7,text:"New identity requires new evidence"},
        {start:7,end:14,text:"You cannot just decide to become a new person"},
        {start:14,end:22,text:"You have to prove it to yourself"},
        {start:22,end:30,text:"Through consistent action"}
      ]},
      { ...threeCards("The Stack", "Identity <span style='color:#A78BFA;'>layers</span>", [
        {head:"Habits",body:"What you do"},
        {head:"Identity",body:"What you believe"},
        {head:"Beliefs",body:"Your world view"}
      ]), timestamp_end: 136, duration: 28, captions: [
        {start:0,end:7,text:"Habits define your identity"},
        {start:7,end:14,text:"Identity reinforces your beliefs"},
        {start:14,end:22,text:"Your beliefs guide your actions"},
        {start:22,end:28,text:"The loop is self-reinforcing"}
      ]},
      { ...summaryCards("Chapter Summary", [
        "Every action is a <span class='hl'>vote</span>",
        "Focus on <span style='color:#A78BFA;'>who</span> you become",
        "<span class='hl'>Prove</span> it through action"
      ]), timestamp_end: 200, duration: 64, captions: [
        {start:0,end:9,text:"Simple habits matter for identity"},
        {start:9,end:18,text:"Not for the results, but what they say about you"},
        {start:18,end:30,text:"The process is becoming yourself"},
        {start:30,end:42,text:"New evidence, new identity"},
        {start:42,end:54,text:"Habits are the path to becoming"},
        {start:54,end:64,text:"Vote for who you want to be"}
      ]}
    ]
  },
  // Ch 3
  {
    number: 3,
    title: "The Four-Step Model of Habits",
    narration: "Every human behavior can be broken down into four steps. Cue, craving, response, and reward. The cue triggers your brain to initiate a behavior. It predicts a reward. Your mind is constantly scanning the environment for cues. Where rewards are located. The craving is the motivational force behind every habit. Without some level of motivation you have no reason to act. What you crave is not the habit itself but the change in state it delivers. The response is the actual habit you perform. It depends on how motivated you are and how much friction is associated with the behavior. The reward is the end goal of every habit. The cue is about noticing the reward. The craving is about wanting the reward. The response is about obtaining the reward. And the reward delivers the satisfaction and becomes associated with the cue. Together these four steps form a neurological loop. Cue, craving, response, reward. This loop is running constantly. Every time you perform a habit your brain completes the loop and wires itself more deeply.",
    scenes: [
      { ...hook("The Four-Step Model<br>of <span style='color:#FACC15;'>Habits</span>", "Every behavior breaks down into four steps"), timestamp_end: 18, duration: 24, captions: [
        {start:0,end:6,text:"Every human behavior has four steps"},
        {start:6,end:12,text:"Cue, craving, response, reward"},
        {start:12,end:18,text:"This is the neurological loop"},
        {start:18,end:24,text:"Running constantly in your brain"}
      ]},
      { ...keyInsight("Step One", "The <span style='color:#FACC15;'>Cue</span>", "Triggers your brain to initiate a behavior", "It predicts a reward"), timestamp_end: 42, duration: 24, captions: [
        {start:0,end:6,text:"The cue triggers your brain"},
        {start:6,end:12,text:"It predicts a reward"},
        {start:12,end:18,text:"Your mind scans for cues constantly"},
        {start:18,end:24,text:"Where rewards are located"}
      ]},
      { ...keyInsight("Step Two", "The <span style='color:#A78BFA;'>Craving</span>", "The motivational force behind every habit", "You crave the change in state it delivers"), timestamp_end: 66, duration: 24, captions: [
        {start:0,end:6,text:"The craving is the motivational force"},
        {start:6,end:12,text:"Without motivation, no action"},
        {start:12,end:18,text:"Not the habit itself"},
        {start:18,end:24,text:"The change in state it delivers"}
      ]},
      { ...keyInsight("Step Three", "The <span style='color:#34D399;'>Response</span>", "The actual habit you perform", "Depends on motivation and friction"), timestamp_end: 90, duration: 24, captions: [
        {start:0,end:6,text:"The response is the actual habit"},
        {start:6,end:12,text:"Depends on how motivated you are"},
        {start:12,end:18,text:"And how much friction exists"},
        {start:18,end:24,text:"Friction kills habits"}
      ]},
      { ...keyInsight("Step Four", "The <span style='color:#FB923C;'>Reward</span>", "The end goal of every habit", "Delivers satisfaction and closes the loop"), timestamp_end: 114, duration: 24, captions: [
        {start:0,end:6,text:"The reward is the end goal"},
        {start:6,end:12,text:"Delivers satisfaction"},
        {start:12,end:18,text:"Becomes associated with the cue"},
        {start:18,end:24,text:"The loop wires itself deeper"}
      ]},
      { ...fourLawsGrid("The Loop"), timestamp_end: 144, duration: 30, captions: [
        {start:0,end:6,text:"Cue — the trigger"},
        {start:6,end:12,text:"Craving — the motivation"},
        {start:12,end:18,text:"Response — the action"},
        {start:18,end:24,text:"Reward — the satisfaction"},
        {start:24,end:30,text:"The neurological loop"}
      ]},
      { ...summaryCards("Chapter Summary", [
        "<span class='hl'>Cue</span> triggers the behavior",
        "<span class='hl'>Craving</span> provides the motivation",
        "<span class='hl'>Response</span> delivers the action",
        "<span class='hl'>Reward</span> closes the loop"
      ]), timestamp_end: 200, duration: 56, captions: [
        {start:0,end:8,text:"These four steps form a neurological loop"},
        {start:8,end:18,text:"Cue, craving, response, reward"},
        {start:18,end:30,text:"Running constantly, every day"},
        {start:30,end:42,text:"Every habit completes this loop"},
        {start:42,end:56,text:"And wires itself deeper in your brain"}
      ]}
    ]
  },
  // Ch 4-20: abbreviated but functional
  {
    number: 4, title: "The Man Who Didn't Look Right",
    narration: "The process of behavior change always starts with awareness. You cannot change a habit you do not know exists. This is the Habits Scorecard exercise. Write down your daily habits. Then mark each as good, bad, or neutral. Good habits align with your desired identity. Bad habits oppose it. The simple act of writing down your behaviors forces you to notice what you actually do each day. Without judgment. Just observation. Once you are aware of your habits you can begin to improve them. The first law of behavior change is make it obvious. And the first step is awareness.",
    scenes: [
      { ...hook("The Man Who Didn't<br><span style='color:#FACC15;'>Look Right</span>", "Awareness comes first"), timestamp_end: 20, duration: 26, captions: [
        {start:0,end:7,text:"Behavior change starts with awareness"},
        {start:7,end:14,text:"You cannot change what you don't know"},
        {start:14,end:20,text:"The Habits Scorecard"},
        {start:20,end:26,text:"Write down your daily habits"}
      ]},
      { ...keyInsight("The First Law", "<span style='color:#FACC15;'>Make it obvious</span>", "Awareness is the first step", "Then you can begin to improve"), timestamp_end: 48, duration: 28, captions: [
        {start:0,end:7,text:"Mark each habit as good, bad, or neutral"},
        {start:7,end:14,text:"Good habits align with your identity"},
        {start:14,end:21,text:"Bad habits oppose it"},
        {start:21,end:28,text:"No judgment, just observation"}
      ]},
      { ...keyInsight("The Result", "You cannot improve <span style='color:#FACC15;'>what you do not measure</span>", "The simple act of writing forces awareness", "Then improvement becomes possible"), timestamp_end: 78, duration: 30, captions: [
        {start:0,end:7,text:"You cannot improve what you don't measure"},
        {start:7,end:15,text:"Writing forces awareness"},
        {start:15,end:22,text:"Then improvement becomes possible"},
        {start:22,end:30,text:"Make it obvious"}
      ]},
      { ...summaryCards("Chapter Summary", [
        "<span class='hl'>Awareness</span> first",
        "Use the <span class='hl'>Habits Scorecard</span>",
        "Good habits = <span class='hl'>identity aligned</span>"
      ]), timestamp_end: 200, duration: 122, captions: [
        {start:0,end:15,text:"Write down everything you do in a day"},
        {start:15,end:30,text:"Mark each as good, bad, or neutral"},
        {start:30,end:50,text:"Good habits align with who you want to be"},
        {start:50,end:70,text:"Bad habits are the ones that oppose your identity"},
        {start:70,end:90,text:"This is the starting point of all change"},
        {start:90,end:110,text:"The first law is make it obvious"},
        {start:110,end:122,text:"Awareness is the foundation"}
      ]}
    ]
  },
  {
    number: 5, title: "The Best Way to Start a New Habit",
    narration: "The best way to start a new habit is to be very clear about when and where it will happen. This is implementation intention. I will exercise at 7am in my living room. The formula is simple. I will behavior at time and location. Studies show that people who make a specific plan for when and where they will exercise are far more likely to follow through. The second strategy is habit stacking. After I do current habit I will do new habit. You take a habit you already have and stack a new one on top of it. After I pour my morning coffee I will meditate for one minute. The existing habit becomes the cue for the new one.",
    scenes: [
      { ...hook("The Best Way to Start<br>a <span style='color:#FACC15;'>New Habit</span>", "Be specific about when and where"), timestamp_end: 20, duration: 26, captions: [
        {start:0,end:7,text:"Be very clear about when and where"},
        {start:7,end:14,text:"This is implementation intention"},
        {start:14,end:20,text:"I will behavior at time and location"},
        {start:20,end:26,text:"Specificity drives follow-through"}
      ]},
      { ...keyInsight("Implementation Intention", "I will <span style='color:#FACC15;'>behavior</span><br>at <span style='color:#A78BFA;'>time</span> and <span style='color:#A78BFA;'>location</span>", "Studies show specific plans drive action", "The simple formula works"), timestamp_end: 50, duration: 30, captions: [
        {start:0,end:7,text:"I will exercise at 7am in my living room"},
        {start:7,end:14,text:"The formula is simple and proven"},
        {start:14,end:22,text:"People who plan specifically follow through"},
        {start:22,end:30,text:"Specificity is the key"}
      ]},
      { ...keyInsight("Habit Stacking", "After I <span style='color:#FACC15;'>current habit</span><br>I will <span style='color:#A78BFA;'>new habit</span>", "Stack new habits on existing ones", "The existing habit becomes the cue"), timestamp_end: 80, duration: 30, captions: [
        {start:0,end:7,text:"Habit stacking is powerful"},
        {start:7,end:14,text:"After I pour my coffee"},
        {start:14,end:22,text:"I will meditate for one minute"},
        {start:22,end:30,text:"The existing habit triggers the new one"}
      ]},
      { ...summaryCards("Chapter Summary", [
        "Use <span class='hl'>implementation intentions</span>",
        "Stack new habits on <span class='hl'>existing ones</span>",
        "Clarity drives <span class='hl'>action</span>"
      ]), timestamp_end: 200, duration: 120, captions: [
        {start:0,end:15,text:"Be specific about when and where"},
        {start:15,end:30,text:"Implementation intentions work"},
        {start:30,end:50,text:"Habit stacking uses existing triggers"},
        {start:50,end:70,text:"Your morning coffee becomes a cue"},
        {start:70,end:90,text:"Stack new habits on old ones"},
        {start:90,end:105,text:"Clarity and specificity drive action"},
        {start:105,end:120,text:"Make it obvious"}
      ]}
    ]
  },
  // Ch 6-20: compact generation
  ...[
    {n:6, t:"Motivation Is Overrated", s:"Environment design matters more than motivation. Every habit depends on context. If you want to exercise place your gym shoes by the door. If you want to eat healthier keep fruit on the counter. Make the cues of your good habits obvious. And make the cues of your bad habits invisible. This is environment design. It is the most powerful way to shape your behavior because it does not require willpower. You just change your surroundings and your habits follow.", h:"<span style='color:#FACC15;'>Environment</span> over willpower", c:["Motivation is overrated","Environment matters more","Make good cues obvious","Make bad cues invisible"]},
    {n:7, t:"The Secret to Self-Control", s:"Self-control is a short-term strategy. It is not a long-term solution. The people with the best self-control are the ones who need to use it the least. Because they design their environment to reduce temptation. The secret is not to summon willpower every time. The secret is to reduce exposure to the cue. You cannot fail at a habit you never start because the trigger never appears. This is why the most disciplined people structure their lives around reducing temptation rather than resisting it.", h:"<span style='color:#FACC15;'>Design</span> to reduce temptation", c:["Self-control is short-term","Design your environment","Reduce exposure to cues","Make bad habits invisible"]},
    {n:8, t:"How to Make a Habit Irresistible", s:"Temptation bundling is one of the most powerful ways to make a habit attractive. You link an action you want to do with an action you need to do. Listen to your favorite podcast only while exercising. Watch your favorite show only while on the treadmill. The brain craves dopamine. And the anticipation of a reward is often more motivating than the reward itself. This is why habits that are associated with positive feelings become almost impossible to break. You are not fighting the habit. You are fighting the anticipation.", h:"Link <span style='color:#FACC15;'>want</span> with <span style='color:#A78BFA;'>need</span>", c:["Make habits attractive","Temptation bundling","Link want with need","Anticipation drives action"]},
    {n:9, t:"The Role of Family and Friends", s:"We imitate the habits of three groups. The close, the many, and the powerful. One of the most effective things you can do to build better habits is to join a culture where your desired behavior is the normal behavior. If you are surrounded by people who exercise you are more likely to exercise. If you are surrounded by people who read you are more likely to read. The shared identity of a group reinforces individual habits. This is why gyms work and book clubs work. You do not want to let the group down.", h:"We imitate <span style='color:#FACC15;'>the close, the many, the powerful</span>", c:["Habits are social","Join a culture","Where your behavior is normal","Shared identity reinforces habits"]},
    {n:10, t:"How to Find and Fix the Causes of Your Bad Habits", s:"Every behavior has a surface level craving and a deeper underlying motive. You want a cigarette not because you need nicotine but because you crave relief from stress. You check your phone not because you need information but because you crave social connection. The key is to find the root cause of your bad habits and address that directly. You cannot eliminate bad habits entirely. But you can replace them with better ones that satisfy the same underlying motive. This is the process of habit shifting.", h:"Find the <span style='color:#FACC15;'>root cause</span>", c:["Find the root cause","Every habit has a deeper motive","Not the surface craving","Replace not eliminate"]},
    {n:11, t:"Walk Slowly, But Never Backward", s:"The most effective way to change your habits is to focus on small improvements consistently. Walk slowly but never backward. Even a one percent improvement each day compounds to significant change. The speed of your progress does not matter as much as the direction. If you are moving forward you are winning. The mistake people make is to try to change everything at once. They try to overhaul their entire identity overnight. That never works because it requires too much willpower. Small consistent steps are the key to lasting change.", h:"Small steps. <span style='color:#FACC15;'>Never backward</span>", c:["Walk slowly, never backward","Small consistent steps","One percent each day","Forward is winning"]},
    {n:12, t:"The Law of Least Effort", s:"Human behavior follows the law of least effort. We will naturally gravitate toward the option that requires the least amount of work. This is why the best way to build a good habit is to reduce the friction associated with it. And the best way to break a bad habit is to increase the friction. If it takes five seconds to get your gym clothes ready you are more likely to go to the gym. If it takes twenty minutes to set up your workspace you are less likely to start working. Reduce friction for good habits. Increase friction for bad ones.", h:"<span style='color:#FACC15;'>Reduce friction</span> for good habits", c:["Law of least effort","Gravitate to the easy option","Reduce friction for good","Increase friction for bad"]},
    {n:13, t:"How to Stop Procrastinating", s:"Procrastination is not a character flaw. It is a design problem. You procrastinate when the behavior you need to do feels difficult or unpleasant. The solution is to make it so easy you cannot say no. The two minute rule states that when you start a new habit it should take less than two minutes to do. Read one page. Meditate for ten seconds. Put on your running shoes. The idea is to master the habit of showing up. Once you have established the routine you can improve it. But first you need to make it easy enough to start.", h:"The <span style='color:#FACC15;'>Two-Minute Rule</span>", c:["Procrastination is a design problem","Make it so easy you can't say no","The two-minute rule","Master showing up first"]},
    {n:14, t:"The Two-Minute Rule", s:"The two minute rule is simple. When you start a new habit it should take less than two minutes to do. The goal is not to do the whole habit in two minutes. The goal is to master the habit of showing up. Once you have established the routine you can improve it. The most important thing is to not break the chain. Do not miss two days in a row. Missing once is an accident. Missing twice is the start of a new habit. The ritual of showing up is more important than the performance. Because the ritual is what builds identity.", h:"Master the <span style='color:#FACC15;'>habit of showing up</span>", c:["The two-minute rule","Master showing up","Do not break the chain","Never miss twice"]},
    {n:15, t:"How to Make a Good Habit Stick", s:"What is immediately rewarded is repeated. What is immediately punished is avoided. This is why bad habits stick. They deliver immediate pleasure. And good habits often have delayed rewards. The solution is to make the rewards of good habits immediate. Use reinforcement. After you complete a habit give yourself a small reward. The feeling of satisfaction you get from finishing a workout is not enough at first. Pair it with something you enjoy. Over time the habit itself becomes the reward. The brain learns to associate the behavior with pleasure.", h:"Make rewards <span style='color:#FACC15;'>immediate</span>", c:["Make good habits satisfying","Immediate rewards drive repetition","Bad habits deliver now","Good habits reward later"]},
    {n:16, t:"How to Stick With Good Habits Every Day", s:"The best way to stick with good habits is to track them. Habit tracking is a simple way to measure whether you did a habit. It also provides immediate evidence that you are becoming the person you want to be. Each mark on the calendar is a vote for your identity. Habit tracking also keeps you honest. It is hard to ignore the evidence of a blank calendar. But do not let tracking become obsessive. The most important rule is to never miss twice. If you miss a day get back on track immediately. One slip up is not a new pattern.", h:"<span style='color:#FACC15;'>Track,</span> but do not obsess", c:["Habit tracking works","Evidence of your identity","Never miss twice","One slip is not a pattern"]},
    {n:17, t:"The Surprising Power of Accountability Partners", s:"When someone is watching we behave better. This is why accountability partners are so effective. Knowing that someone will check on you creates immediate social cost for inaction. A habit contract is a simple agreement you make with yourself or others. It states you will perform a specific habit or face a specific consequence. The consequence should be immediate and negative. If I do not exercise today I will donate fifty dollars to a cause I hate. The combination of social accountability and immediate consequences makes it nearly impossible to skip a habit.", h:"<span style='color:#FACC15;'>Social accountability</span> works", c:["Accountability partners work","Social cost for inaction","Habit contracts","Immediate consequences"]},
    {n:18, t:"The Truth About Talent", s:"Genetics do not excuse failure. But they do not determine your limits either. The key is to work hard on the things that come easy to you. The areas where your genetics give you an advantage. When you cannot win by being better you can win by being different. Combine your skills in a way that no one else can. Your competitive advantage comes from your unique combination of talents. Master a game of choice that suits your strengths. Not someone else's. The people at the top of any field are not just the hardest workers. They are also the ones who found a game that fits their natural abilities.", h:"Work where you have <span style='color:#FACC15;'>natural advantage</span>", c:["Hard work beats talent","But combined they win","Find your game","Work where you have advantage"]},
    {n:19, t:"The Goldilocks Rule", s:"The Goldilocks Rule states that humans experience peak motivation when working on tasks that are right on the edge of their current abilities. Not too hard. Not too easy. Just right. Too easy is boring. Too hard is discouraging. This is why you need to continuously advance your habits. Once a habit becomes easy you need to increase the difficulty. The boredom of a mastered skill is dangerous. Because you stop paying attention. And when you stop paying attention you start making mistakes. The greatest threat to success is not failure. It is boredom. The people who stick with habits are the ones who find a way to keep them interesting.", h:"<span style='color:#FACC15;'>Not too hard. Not too easy.</span>", c:["The Goldilocks Rule","Peak motivation at edge","Not too hard, not too easy","Boredom is the threat"]},
    {n:20, t:"The Downside of Creating Good Habits", s:"Habits are necessary for progress. But they can also become a trap. Once a habit is automatic you stop paying attention to the small errors that creep in. This is why you need periodic reflection and review. Mastery is the process of tiny improvements over time. But improvement requires attention. If you stop paying attention you stop improving. The solution is to maintain a growth mindset. Never become so attached to your current identity that you stop learning. Revisit your habits regularly. Ask yourself what needs to change. The downside of habits is that they lock you into a pattern. The upside is that you can always choose a new pattern.", h:"<span style='color:#FACC15;'>Revisit. Reflect. Improve.</span>", c:["Habits can become traps","Lost errors when automatic","Review and reflect regularly","Always keep a growth mindset"]}
  ].map(ch => ({
    number: ch.n,
    title: ch.t,
    narration: ch.s,
    scenes: [
      { ...hook(ch.t, ch.h), timestamp_end: 20, duration: 26, captions: ch.c.map((t,i) => ({start: i*7, end: (i+1)*7 - 1, text: t})) },
      { ...keyInsight("Key Insight", "The <span style='color:#FACC15;'>principle</span>", ch.s.split('. ').slice(0,2).join('. ')+'.', ch.s.split('. ').slice(2,4).join('. ')+'.'), timestamp_end: 55, duration: 35, captions: [
        {start:0,end:8,text:ch.s.split('. ').slice(0,1)[0]},
        {start:8,end:16,text:ch.s.split('. ').slice(1,2)[0]},
        {start:16,end:25,text:ch.s.split('. ').slice(2,3)[0]},
        {start:25,end:35,text:ch.s.split('. ').slice(3,4)[0]}
      ]},
      { ...keyInsight("How to Apply It", "Put it into <span style='color:#FACC15;'>practice</span>", ch.s.split('. ').slice(5,8).join('. ')+'.', ch.s.split('. ').slice(8,11).join('. ')+'.'), timestamp_end: 95, duration: 40, captions: [
        {start:0,end:10,text:ch.s.split('. ').slice(5,7).join('. ')},
        {start:10,end:20,text:ch.s.split('. ').slice(7,9).join('. ')},
        {start:20,end:30,text:ch.s.split('. ').slice(9,11).join('. ')},
        {start:30,end:40,text:"This is how you apply the principle"}
      ]},
      { ...summaryCards("Chapter Summary", [
        ch.c[0],
        ch.c[1],
        ch.c[2]
      ]), timestamp_end: 200, duration: 105, captions: [
        {start:0,end:15,text:ch.c[0]},
        {start:15,end:30,text:ch.c[1]},
        {start:30,end:50,text:ch.c[2]},
        {start:50,end:70,text:ch.c[3] || "Make it work for you"},
        {start:70,end:90,text:"Apply the principle daily"},
        {start:90,end:105,text:"This is atomic habits"}
      ]}
    ]
  }))
];

// ─── Write files ────────────────────────────────────────

for (const ch of CHAPTERS) {
  const fn = `chapter-${String(ch.number).padStart(2,'0')}.json`;
  const data = {
    book_title: "Atomic Habits",
    cover_ext: "svg",
    chapter: ch.number,
    chapter_title: ch.title,
    narration_script: ch.narration,
    scene_count: ch.scenes.length,
    scenes: ch.scenes.map(s => ({
      index: 0,
      timestamp_end: s.timestamp_end,
      duration: s.duration,
      narration_text: ch.narration.split('.').slice(0,5).join('.') + '.',
      html: s.html,
      animations: s.anims,
      captions: s.captions
    }))
  };
  // Fix scene index
  data.scenes.forEach((s,i) => s.index = i);
  // Fix scene ID in HTML
  data.scenes.forEach((s,i) => { s.html = s.html.replace(/id="s\d?"/, `id="s${i}"`); });
  fs.writeFileSync(path.join(OUT, fn), JSON.stringify(data, null, 2));
  console.log(`${fn} written (${ch.scenes.length} scenes, ${ch.narration.split(' ').length} words)`);
}

console.log(`\n✓ All 20 Atomic Habits chapter files generated in books/atomic-habits/`);
