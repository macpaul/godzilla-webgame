/* =========================================================
   data.js — 全データ / all tuning data
   Stats, attacks and weaknesses come from docs/research.md.
   Attack names use the canonical Japanese name from Wikizilla.
   ========================================================= */
'use strict';

const W = 1024, H = 576;
const GROUND = 486;
const GRAV = 2600;

/* ---------------- elements ---------------- */
const ELEMENTS = {
  radiation: { ja: '放射', color: '#7fd8ff' },
  fire:      { ja: '火炎', color: '#ff8a3c' },
  beast:     { ja: '獣',   color: '#c8a06a' },
  water:     { ja: '水',   color: '#5fc8e8' },
  air:       { ja: '風',   color: '#d8e8f0' },
  mech:      { ja: '機械', color: '#b8c4d0' },
  toxic:     { ja: '毒',   color: '#8fd05a' },
  cosmic:    { ja: '宇宙', color: '#ffd75e' },
  plant:     { ja: '植物', color: '#6ec86a' },
  crystal:   { ja: '結晶', color: '#cfe8ff' },
  oxygen:    { ja: '微氧', color: '#ff6a6a' },
};

/* ---------------- player: ゴジラ ---------------- */
const PLAYER = {
  ja: 'ゴジラ', en: 'Godzilla',
  hp: 1000, energy: 100, energyRegen: 9,
  walk: 190, backWalk: 140, jump: 1050,
  guardCut: 0.75,
  w: 74, h: 190,
  staggerMax: 100,
  kit: {
    punch: { id:'punch', ja:'パンチ', kind:'melee', dmg:10, windup:.10, active:.10, recover:.16,
             reach:92, boxH:70, boxY:-120, knock:90, stagger:8, element:'melee' },
    kick:  { id:'kick', ja:'キック', kind:'melee', dmg:20, windup:.20, active:.14, recover:.30,
             reach:116, boxH:86, boxY:-100, knock:340, stagger:20, element:'melee' },
    stomp: { id:'stomp', ja:'踏みつけ', kind:'quake', dmg:16, windup:.12, active:.12, recover:.26,
             area:{r:150}, knock:260, stagger:16, element:'melee' },
    beam:  { id:'beam', ja:'放射熱線', kind:'beam', dmg:38, windup:.35, active:.30, recover:.42,
             beam:{len:900, h:26, yOff:-128}, cost:30, knock:180, stagger:26, element:'radiation' },
    pulse: { id:'pulse', ja:'全身放射熱線', kind:'quake', dmg:30, windup:.28, active:.20, recover:.55,
             area:{r:230}, cost:55, knock:420, stagger:40, element:'radiation', breaksGuard:true },
    fireray:{ id:'fireray', ja:'放射火炎', kind:'beam', dmg:70, windup:.42, active:.40, recover:.55,
             beam:{len:960, h:44, yOff:-124}, cost:60, knock:300, stagger:50, element:'fire' },
  },
  /* atomic breath tiers: tier 1 base, tier 2 after L4, tier 3 after L7 */
  beamTiers: [
    { name:'放射熱線', element:'radiation', dmgMul:1.0, color:'#7fd8ff' },
    { name:'レッド熱線', element:'radiation', dmgMul:1.35, color:'#ff5a5a' },
    { name:'放射火炎', element:'fire', dmgMul:1.7, color:'#ffa040' },
  ],
  /* burning form, level 10 only: he is melting down, so the finale is a race */
  burn: { drain: 4, dmgMul: 1.35 },
};

/* ---------------- upgrades offered between levels ---------------- */
const UPGRADES = [
  { id:'hp',      ja:'最大体力 +12%',   en:'max HP +12%',   apply:s=>{ s.hpMul*=1.12; } },
  { id:'regen',   ja:'エネルギー回復 +25%', en:'energy regen +25%', apply:s=>{ s.regenMul*=1.25; } },
  { id:'beam',    ja:'放射熱線 +15%',   en:'beam +15%',     apply:s=>{ s.beamMul*=1.15; } },
  { id:'melee',   ja:'格闘攻撃 +12%',   en:'melee +12%',    apply:s=>{ s.meleeMul*=1.12; } },
  { id:'heal',    ja:'体力 40% 回復',   en:'heal 40%',      apply:s=>{ s.healNow=0.40; } },
  { id:'cost',    ja:'光線コスト -20%', en:'beam cost -20%',apply:s=>{ s.costMul*=0.80; } },
  { id:'guard',   ja:'ガード 85%',      en:'guard 85%',     apply:s=>{ s.guardCut=0.85; } },
];

/* =========================================================
   The ten kaiju.
   attack.kind: melee | dash | beam | proj | grab | aura | channel | quake | special
   telegraph:  flash | line | ring
   resist:     damage multipliers applied to the player's damage by element class
   ========================================================= */
const MONSTERS = [

/* ---------- 1. アンギラス ---------- */
{
  id:'anguirus', n:1, ja:'アンギラス', en:'Anguirus', subtitle:'暴竜',
  film:'ゴジラの逆襲 (1955)', era:'Showa', height:'60 m', weight:'—',
  element:'beast', threat:1,
  hp:720, speed:170, w:110, h:150, staggerMax:110,
  resist:{ radiation:0.6, melee:1.0, fire:1.0 },   // 装甲 carapace
  weakness:{ element:'melee', text:'装甲で放射熱線を防ぐ。格闘で攻める。',
             en:'Armoured carapace shrugs off the beam — hit him with melee.' },
  palette:{ skin:'#8a6f52', skin2:'#6d563f', belly:'#a89070', eye:'#d84a3a',
            spike:'#e0d6c4', accent:'#e8e2d0' },
  art:'anguirus', stage:{ bg:'ruins', sky:['#1a1220','#3a2436','#6a4048'] },
  ai:{ aggression:.55, preferRange:150, dodge:.15, flank:.2 },
  attacks:[
    { id:'charge', ja:'突進', kind:'dash', dmg:18, windup:.55, active:.45, recover:.55,
      speed:520, knock:300, telegraph:'flash', cooldown:4.5, minRange:230, maxRange:640,
      stagger:14, weight:1.0, note:'charges opponents' },
    { id:'bite', ja:'噛付き', kind:'melee', dmg:22, windup:.45, active:.18, recover:.50,
      reach:120, boxH:80, boxY:-90, knock:180, telegraph:'flash', cooldown:2.6,
      minRange:0, maxRange:150, stagger:18, weight:1.3 },
    { id:'tail', ja:'尻尾回し', kind:'melee', dmg:16, windup:.50, active:.24, recover:.55,
      reach:170, boxH:70, boxY:-60, knock:360, telegraph:'ring', cooldown:3.4,
      minRange:60, maxRange:210, stagger:16, weight:1.0 },
    { id:'roar', ja:'音波咆哮', kind:'aura', dmg:12, windup:.60, active:.50, recover:.60,
      area:{r:230, cone:true}, knock:200, telegraph:'flash', cooldown:8,
      minRange:0, maxRange:300, stagger:10, weight:.6, tags:['noClash'],
      note:'cannot beam-lock with energy weapons' },
  ],
  phases:[],
},

/* ---------- 2. エビラ ---------- */
{
  id:'ebirah', n:2, ja:'エビラ', en:'Ebirah', subtitle:'大エビ怪獣',
  film:'ゴジラ・エビラ・モスラ (1966)', era:'Showa', height:'50 m', weight:'23,000 t',
  element:'water', threat:1.5,
  hp:880, speed:150, w:130, h:160, staggerMax:120,
  resist:{ radiation:1.4, melee:0.8, fire:1.0 },   // 軟甲 soft shell
  weakness:{ element:'radiation', text:'甲羅が軟らかく放射熱線に弱い。鋏の届く範囲に注意。',
             en:'Soft shell — the beam hurts. Mind pincer range.' },
  palette:{ skin:'#c03a2e', skin2:'#96291f', belly:'#d8654a', eye:'#f2e0c0',
            spike:'#f0e6d8', accent:'#ff7a5a' },
  art:'ebirah', stage:{ bg:'sea', sky:['#0d1a2a','#1e3a52','#3f6a7a'] },
  ai:{ aggression:.6, preferRange:230, dodge:.1, flank:.35 },
  attacks:[
    { id:'crush', ja:'右鋏', kind:'melee', dmg:28, windup:.62, active:.20, recover:.70,
      reach:200, boxH:100, boxY:-110, knock:420, telegraph:'flash', cooldown:4.2,
      minRange:90, maxRange:250, stagger:24, weight:1.2, note:'bludgeons and grasps' },
    { id:'stab', ja:'左鋏', kind:'melee', dmg:18, windup:.42, active:.16, recover:.45,
      reach:225, boxH:60, boxY:-90, knock:150, telegraph:'flash', cooldown:2.8,
      minRange:110, maxRange:280, stagger:14, weight:1.2, tags:['pierce'] },
    { id:'sweep', ja:'鋸足掃', kind:'quake', dmg:14, windup:.50, active:.18, recover:.55,
      area:{r:210}, knock:300, telegraph:'ring', cooldown:4.0, minRange:0, maxRange:240,
      stagger:18, weight:.9, note:'Tail Strike — sweeps Godzilla off his feet' },
    { id:'water', ja:'水鉄砲', kind:'proj', dmg:15, windup:.55, active:.10, recover:.55,
      proj:{ speed:640, grav:760, r:14, life:2.4, splash:60, color:'#8fdcf0' },
      telegraph:'line', cooldown:3.6, minRange:260, maxRange:820, stagger:8, weight:1.1 },
    { id:'leap', ja:'跳ね上がり', kind:'dash', dmg:22, windup:.45, active:.60, recover:.60,
      speed:400, rise:760, knock:300, telegraph:'flash', cooldown:7, minRange:150,
      maxRange:460, stagger:20, weight:.6 },
  ],
  phases:[ { at:0.40, note:'激怒', speedMul:1.25, dmgMul:1.15, cooldownMul:0.75 } ],
},

/* ---------- 3. ラドン ---------- */
{
  id:'rodan', n:3, ja:'ラドン', en:'Rodan', subtitle:'空の大怪獣',
  film:'ラドン (1956)', era:'Showa', height:'50 m / 翼長120 m', weight:'—',
  element:'air', threat:2,
  hp:1000, speed:230, w:120, h:150, staggerMax:120, airborne:true,
  resist:{ radiation:1.5, melee:0.5, fire:1.0 },
  weakness:{ element:'radiation', text:'飛行中はガードできない。空中で放射熱線、急降下は格闘で叩く。',
             en:'Cannot guard while flying — beam him airborne, melee the dives.' },
  palette:{ skin:'#8a4a3c', skin2:'#6a3529', belly:'#c08a5a', eye:'#f0d060',
            spike:'#e8d8b8', accent:'#ff9a4a' },
  art:'rodan', stage:{ bg:'mountain', sky:['#1a1428','#3a2a3a','#7a5a4a'] },
  ai:{ aggression:.65, preferRange:340, dodge:.45, flank:.5 },
  attacks:[
    { id:'dive', ja:'急降下', kind:'dash', dmg:24, windup:.45, active:.55, recover:.55,
      speed:620, rise:-260, knock:300, telegraph:'flash', cooldown:4.0, minRange:180,
      maxRange:700, stagger:20, weight:1.3, tags:['air'] },
    { id:'shock', ja:'音波衝撃', kind:'proj', dmg:16, windup:.55, active:.10, recover:.50,
      proj:{ speed:420, grav:0, r:26, life:3.0, ring:true, splash:90, color:'#e0eef8' },
      telegraph:'line', cooldown:3.4, minRange:200, maxRange:900, stagger:12, weight:1.2 },
    { id:'gust', ja:'羽ばたき', kind:'aura', dmg:6, windup:.45, active:.60, recover:.55,
      area:{r:260}, knock:520, telegraph:'flash', cooldown:5.0, minRange:0, maxRange:300,
      stagger:4, weight:.8, note:'knocks kaiju down' },
    { id:'talon', ja:'掴み', kind:'grab', dmg:20, windup:.50, active:.30, recover:.60,
      grab:{ dur:1.1, dmg:14, throwVx:520, throwVy:-420 }, telegraph:'flash', cooldown:6.5,
      minRange:0, maxRange:170, stagger:0, weight:.8, note:'lifts creatures many times its weight' },
    { id:'fireball', ja:'火球', kind:'proj', dmg:18, windup:.50, active:.10, recover:.45,
      proj:{ speed:560, grav:300, r:16, life:2.6, splash:70, fire:true, color:'#ffb04a' },
      telegraph:'line', cooldown:3.0, minRange:220, maxRange:900, stagger:10, weight:1.2,
      phase:1 },
    { id:'uranium', ja:'ウラニウム熱線', kind:'beam', dmg:30, windup:.60, active:.35, recover:.60,
      beam:{ len:880, h:24, yOff:-90 }, telegraph:'line', cooldown:6.0, minRange:240,
      maxRange:900, stagger:22, weight:1.0, phase:1, note:'Fire Rodan' },
  ],
  phases:[ { at:0.55, note:'ファイヤーラドン', art:'rodan_fire', speedMul:1.1,
            addMoves:['fireball','uranium'], dmgMul:1.1 } ],
},

/* ---------- 4. モスラ ---------- */
{
  id:'mothra', n:4, ja:'モスラ', en:'Mothra', subtitle:'怪獣の女王',
  film:'モスラ (1961)', era:'Showa', height:'45 m', weight:'—',
  element:'air', threat:2,
  hp:1150, speed:190, w:130, h:170, staggerMax:130, airborne:true,
  resist:{ radiation:1.0, melee:1.3, fire:1.0 },
  weakness:{ element:'melee', text:'鱗粉が光線を反射する。毒の鱗粉の中へ格闘で入る。',
             en:'Scales reflect beams — push through the poison cloud with melee.' },
  palette:{ skin:'#e8e0c8', skin2:'#c04a3a', belly:'#f4ecd8', eye:'#2a2a3a',
            wing:'#d8e8b0', accent:'#ffe87a' },
  art:'mothra', stage:{ bg:'island', sky:['#101a2e','#2a4a6a','#6a9ab0'] },
  ai:{ aggression:.5, preferRange:300, dodge:.35, flank:.45 },
  attacks:[
    { id:'scales', ja:'鱗粉', kind:'aura', dmg:5, windup:.50, active:2.2, recover:.60,
      area:{ r:280, dot:true, dur:5.0 }, telegraph:'flash', cooldown:7.0, minRange:0,
      maxRange:340, stagger:0, weight:1.0, tags:['reflect'],
      note:'poisonous powder; later incarnations reflect attacks' },
    { id:'silk', ja:'糸', kind:'proj', dmg:6, windup:.45, active:.10, recover:.45,
      proj:{ speed:480, grav:180, r:16, life:2.4, bind:1.6, color:'#f0f0e0' },
      telegraph:'line', cooldown:4.2, minRange:180, maxRange:800, stagger:6, weight:1.1,
      note:'disorients or entangles' },
    { id:'gust', ja:'羽ばたき', kind:'aura', dmg:8, windup:.45, active:.55, recover:.55,
      area:{r:270}, knock:560, telegraph:'flash', cooldown:5.2, minRange:0, maxRange:300,
      stagger:4, weight:.8 },
    { id:'antenna', ja:'触覚ビーム', kind:'beam', dmg:22, windup:.55, active:.30, recover:.55,
      beam:{ len:860, h:20, yOff:-120 }, telegraph:'line', cooldown:4.4, minRange:240,
      maxRange:900, stagger:16, weight:1.1, note:'Beam Pulser' },
    { id:'stingers', ja:'尖刺', kind:'proj', dmg:9, windup:.55, active:.12, recover:.55,
      proj:{ speed:520, grav:420, r:9, count:5, spread:0.42, life:2.6, color:'#b8e05a' },
      telegraph:'line', cooldown:4.8, minRange:200, maxRange:900, stagger:6, weight:1.2,
      note:'hail of poisonous darts' },
  ],
  /* imago falls, larva rises — the phoenix life cycle */
  phases:[ { at:0.05, note:'幼虫', art:'mothra_larva', hp:420, speedMul:0.7,
             replaceMoves:['scales','antenna','stingers'],
             addMoves:['silk','bite','roll'] } ],
  larvaMoves:[
    { id:'bite', ja:'噛付き', kind:'melee', dmg:26, windup:.55, active:.20, recover:.60,
      reach:150, boxH:90, boxY:-70, knock:280, telegraph:'flash', cooldown:3.0,
      minRange:0, maxRange:190, stagger:22, weight:1.4 },
    { id:'roll', ja:'体当たり', kind:'dash', dmg:20, windup:.60, active:.50, recover:.60,
      speed:360, knock:340, telegraph:'flash', cooldown:5.0, minRange:150, maxRange:600,
      stagger:20, weight:1.0 },
  ],
},

/* ---------- 5. ガイガン ---------- */
{
  id:'gigan', n:5, ja:'ガイガン', en:'Gigan', subtitle:'サイボーグ怪獣',
  film:'ゴジラ対ガイガン (1972)', era:'Showa', height:'65 m', weight:'—',
  element:'mech', threat:3,
  hp:1300, speed:215, w:110, h:180, staggerMax:150,
  resist:{ radiation:1.3, melee:0.7, fire:1.0 },   // plating vs electronics
  weakness:{ element:'radiation', text:'金属の甲羅は格闘を防ぐが、電子回路は放射熱線に弱い。',
             en:'Metal plating blocks melee; the electronics hate the beam.' },
  palette:{ skin:'#3f6a4a', skin2:'#2c4a34', plate:'#c8a84a', eye:'#ff3a2a',
            visor:'#d02020', accent:'#5ac8e8', saw:'#d8d8e0' },
  art:'gigan', stage:{ bg:'city', sky:['#141024','#2a2038','#5a3a48'] },
  ai:{ aggression:.8, preferRange:170, dodge:.4, flank:.5 },
  attacks:[
    { id:'saw', ja:'回転カッター', kind:'channel', dmg:8, windup:.55, active:1.30, recover:.65,
      channel:{ hits:7, interval:.18, reach:150 }, knock:40, telegraph:'flash', cooldown:6.0,
      minRange:60, maxRange:190, stagger:0, weight:1.4, tags:['interruptible'],
      note:'abdominal rotating cutter' },
    { id:'hammer', ja:'ハンマーハンド', kind:'melee', dmg:24, windup:.40, active:.16, recover:.45,
      reach:150, boxH:90, boxY:-120, knock:300, telegraph:'flash', cooldown:2.8,
      minRange:40, maxRange:190, stagger:18, weight:1.3, note:'metal hooks batter and stab' },
    { id:'laser', ja:'レーザーアイ', kind:'beam', dmg:26, windup:.55, active:.28, recover:.55,
      beam:{ len:880, h:20, yOff:-140 }, telegraph:'line', cooldown:4.2, minRange:250,
      maxRange:900, stagger:18, weight:1.2, note:'forehead aperture above the visor' },
    { id:'slicers', ja:'ブレードスライサー', kind:'proj', dmg:16, windup:.50, active:.12, recover:.50,
      proj:{ speed:600, grav:0, r:13, count:2, spread:0.20, life:3.2, boomerang:true,
             spin:true, color:'#dfe8f0' },
      telegraph:'line', cooldown:4.6, minRange:220, maxRange:900, stagger:12, weight:1.2,
      note:'guided razor discs that boomerang back' },
    { id:'flydash', ja:'原子推進翼', kind:'dash', dmg:20, windup:.40, active:.45, recover:.45,
      speed:640, rise:120, knock:280, telegraph:'flash', cooldown:5.0, minRange:200,
      maxRange:700, stagger:16, weight:1.0, tags:['air'], note:'Mach 3 jet wings' },
  ],
  phases:[],
},

/* ---------- 6. ヘドラ ---------- */
{
  id:'hedorah', n:6, ja:'ヘドラ', en:'Hedorah', subtitle:'公害怪獣',
  film:'ゴジラ対ヘドラ (1971)', era:'Showa', height:'60 m', weight:'48,000 t',
  element:'toxic', threat:3,
  hp:1450, speed:150, w:140, h:180, staggerMax:170,
  resist:{ radiation:0.5, melee:1.2, fire:2.0 },   // drying out is the canon kill
  weakness:{ element:'fire', text:'水分で動く集団生命体。熱・電気に極端に弱い。放射熱線は無意味。',
             en:'A wet colony organism — heat dries it out. The beam only feeds it.' },
  palette:{ skin:'#5a6a5a', skin2:'#3e4c40', belly:'#7a8a72', eye:'#f0c020',
            sclera:'#c02a2a', accent:'#a8e06a' },
  art:'hedorah', stage:{ bg:'smog', sky:['#181c18','#2e3628','#4a5240'] },
  ai:{ aggression:.6, preferRange:260, dodge:.25, flank:.3 },
  attacks:[
    { id:'sludge', ja:'酸性スラッジ', kind:'proj', dmg:14, windup:.50, active:.14, recover:.50,
      proj:{ speed:430, grav:820, r:20, count:3, spread:0.30, life:3.0, pool:{ dur:3.0, dps:6 },
             color:'#8fb84a' },
      telegraph:'line', cooldown:3.6, minRange:150, maxRange:800, stagger:8, weight:1.3,
      note:'launches pieces of its own body, precisely' },
    { id:'mist', ja:'硫酸ミスト', kind:'aura', dmg:6, windup:.70, active:1.6, recover:.70,
      area:{ r:340, dot:true, dur:7.0, blind:true }, telegraph:'flash', cooldown:9.0,
      minRange:0, maxRange:400, stagger:0, weight:1.0, note:'suffocating exhaust byproduct' },
    { id:'hedrium', ja:'ヘドリューム光線', kind:'beam', dmg:28, windup:.62, active:.34, recover:.62,
      beam:{ len:900, h:22, yOff:-130 }, telegraph:'line', cooldown:5.0, minRange:260,
      maxRange:900, stagger:20, weight:1.2, note:'crimson eye beam' },
    { id:'split', ja:'分裂', kind:'special', dmg:0, windup:.70, active:.60, recover:.60,
      telegraph:'flash', cooldown:12, minRange:0, maxRange:9999, stagger:0, weight:.5,
      tags:['phase'], note:'splits into smaller Hedorahs and recombines' },
  ],
  phases:[
    { at:0.62, note:'円盤形態', art:'hedorah_saucer', speedMul:1.5, invuln:0.35,
      replaceMoves:['sludge'], addMoves:['orbRain'], cooldownMul:0.85 },
    { at:0.30, note:'完全体', art:'hedorah', speedMul:1.15, dmgMul:1.2, restore:true },
  ],
  saucerMoves:[
    { id:'orbRain', ja:'球体雨', kind:'proj', dmg:12, windup:.50, active:.20, recover:.50,
      proj:{ speed:300, grav:900, r:14, count:6, spread:1.30, life:3.4, color:'#a8e06a' },
      telegraph:'line', cooldown:3.2, minRange:0, maxRange:9999, stagger:6, weight:1.4 },
  ],
},

/* ---------- 7. キングギドラ ---------- */
{
  id:'ghidorah', n:7, ja:'キングギドラ', en:'King Ghidorah', subtitle:'宇宙超怪獣',
  film:'三大怪獣 地球最大の決戦 (1964)', era:'Showa', height:'80 m', weight:'—',
  element:'cosmic', threat:4,
  hp:1650, speed:200, w:150, h:230, staggerMax:200, airborne:true,
  resist:{ radiation:1.0, melee:1.0, fire:1.0 },
  weakness:{ element:'melee', text:'三つの首を個別に怯ませると合体重力光束が消える。バリア中は光線を止める。',
             en:'Stagger the three necks to cancel the merged beam; stop beaming into the barrier.' },
  palette:{ skin:'#c8a83a', skin2:'#9a7c22', belly:'#e0cc7a', eye:'#e8e0d0',
            wing:'#a88c2c', accent:'#ffe060' },
  art:'ghidorah', stage:{ bg:'city', sky:['#120e22','#241c38','#4a3a58'] },
  ai:{ aggression:.85, preferRange:380, dodge:.5, flank:.55 },
  attacks:[
    { id:'beams', ja:'重力光束', kind:'beam', dmg:20, windup:.62, active:.34, recover:.55,
      beam:{ len:940, h:18, yOff:-190, lanes:3, laneGap:64 }, telegraph:'line', cooldown:3.8,
      minRange:200, maxRange:9999, stagger:14, weight:1.5,
      note:'golden lightning from all three mouths' },
    { id:'merged', ja:'合体重力光束', kind:'beam', dmg:55, windup:.95, active:.45, recover:.75,
      beam:{ len:980, h:46, yOff:-170 }, telegraph:'line', cooldown:9.0, minRange:220,
      maxRange:9999, stagger:40, weight:1.0, tags:['needsHeads'],
      note:'all three gravity beams combined into one' },
    { id:'hurricane', ja:'ハリケーン暴風', kind:'aura', dmg:14, windup:.60, active:.80, recover:.60,
      area:{ r:320, knockback:true }, knock:680, telegraph:'flash', cooldown:6.0,
      minRange:0, maxRange:360, stagger:8, weight:1.0, note:'blows buildings away' },
    { id:'constrict', ja:'首絞め', kind:'grab', dmg:26, windup:.55, active:.35, recover:.65,
      grab:{ dur:1.6, dmg:16, throwVx:-260, throwVy:-300 }, telegraph:'flash', cooldown:7.0,
      minRange:0, maxRange:210, stagger:0, weight:.9, note:'strangles, foaming at the mouth' },
    { id:'fireballs', ja:'火球', kind:'proj', dmg:16, windup:.50, active:.14, recover:.50,
      proj:{ speed:520, grav:520, r:15, count:3, spread:0.34, life:2.8, fire:true, color:'#ffc050' },
      telegraph:'line', cooldown:4.4, minRange:240, maxRange:9999, stagger:10, weight:1.0 },
    { id:'barrier', ja:'バリア', kind:'special', dmg:0, windup:.40, active:2.4, recover:.60,
      telegraph:'flash', cooldown:11, minRange:0, maxRange:9999, stagger:0, weight:.5,
      tags:['reflect'], note:'scales bend light into a shield' },
  ],
  phases:[ { at:0.45, note:'第三形態', speedMul:1.15, dmgMul:1.15, cooldownMul:0.8 } ],
},

/* ---------- 8. ビオランテ ---------- */
{
  id:'biollante', n:8, ja:'ビオランテ', en:'Biollante', subtitle:'巨大植物怪獣',
  film:'ゴジラvsビオランテ (1989)', era:'Heisei', height:'85 m → 120 m', weight:'60,000–200,000 t',
  element:'plant', threat:4,
  hp:1800, speed:0, w:180, h:210, staggerMax:190, rooted:true,
  resist:{ radiation:1.0, melee:0.8, fire:1.8 },
  weakness:{ element:'fire', text:'基部の核が露出した時だけ放射熱線が2倍。蔓は燃やせる。',
             en:'Only the exposed nucleus sac is vulnerable — 2× to the beam. Vines burn.' },
  palette:{ skin:'#a83a4a', skin2:'#7a2836', petal:'#d04a5a', leaf:'#4a8a4a',
            vine:'#5a9a52', core:'#ffd86a', eye:'#f0e0a0' },
  art:'biollante', stage:{ bg:'lake', sky:['#101a26','#243a4a','#4a6a72'] },
  ai:{ aggression:.7, preferRange:260, dodge:0, flank:0, stationary:true },
  attacks:[
    { id:'tendrils', ja:'蔓藤', kind:'grab', dmg:22, windup:.60, active:.40, recover:.70,
      grab:{ dur:1.8, dmg:14, throwVx:-320, throwVy:-260, drain:12 }, telegraph:'flash',
      cooldown:5.5, minRange:0, maxRange:330, stagger:0, weight:1.4,
      tags:['exposeCore'], note:'mouthed vines constrict and spit corrosive sap' },
    { id:'sap', ja:'樹液', kind:'aura', dmg:26, windup:.75, active:.50, recover:.70,
      area:{ r:300, cone:true, dot:false }, knock:200, telegraph:'line', cooldown:5.0,
      minRange:60, maxRange:340, stagger:16, weight:1.3, note:'radioactive corrosive sap' },
    { id:'thorns', ja:'荊棘', kind:'proj', dmg:10, windup:.50, active:.16, recover:.50,
      proj:{ speed:560, grav:340, r:10, count:4, spread:0.40, life:2.6, color:'#c8e07a' },
      telegraph:'line', cooldown:3.8, minRange:120, maxRange:9999, stagger:6, weight:1.2 },
    { id:'spores', ja:'エネルギー胞子', kind:'special', dmg:0, windup:.90, active:1.4, recover:.80,
      telegraph:'flash', cooldown:16, minRange:0, maxRange:9999, stagger:0, weight:.4,
      tags:['phase','heal'], note:'breaks apart into golden particles and returns healed' },
  ],
  phases:[
    { at:0.55, note:'植物獣', art:'biollante_beast', rooted:false, speed:150, h:250, w:170,
      dmgMul:1.2, addMoves:['heatRay','bite'], coreMul:0.6 },
  ],
  beastMoves:[
    { id:'heatRay', ja:'熱線', kind:'beam', dmg:30, windup:.65, active:.35, recover:.60,
      beam:{ len:900, h:24, yOff:-160 }, telegraph:'line', cooldown:5.5, minRange:240,
      maxRange:9999, stagger:22, weight:1.1, note:'the secondary Godzilla mouth' },
    { id:'bite', ja:'噛付き', kind:'melee', dmg:30, windup:.50, active:.20, recover:.55,
      reach:180, boxH:110, boxY:-160, knock:320, telegraph:'flash', cooldown:3.4,
      minRange:0, maxRange:220, stagger:24, weight:1.3 },
  ],
  weakPoint:{ name:'核', mult:2.0, openAfter:['tendrils'], openFor:3.0, yFrac:0.18 },
},

/* ---------- 9. スペースゴジラ ---------- */
{
  id:'spacegodzilla', n:9, ja:'スペースゴジラ', en:'SpaceGodzilla', subtitle:'宇宙凶悪戦闘獣',
  film:'ゴジラvsスペースゴジラ (1994)', era:'Heisei', height:'120 m', weight:'80,000 t',
  element:'crystal', threat:4.5,
  hp:2050, speed:120, w:130, h:250, staggerMax:220,
  resist:{ radiation:1.0, melee:1.2, fire:1.0 },
  weakness:{ element:'melee', text:'フォトン・リアクティブ・シールドが放射熱線を反射する。接近して叩く。',
             en:'The photon shield reflects your beam. Get in and hit him — he cannot run.' },
  palette:{ skin:'#2a3a5a', skin2:'#1c2840', belly:'#6a2a3a', plate:'#2f4a6a',
            crystal:'#e8f4ff', fin:'#dceaf8', eye:'#e8e0d0', accent:'#bfe0ff' },
  art:'spacegodzilla', stage:{ bg:'tower', sky:['#0e1428','#1e2a4a','#3a4a72'] },
  ai:{ aggression:.8, preferRange:330, dodge:.2, flank:.2 },
  attacks:[
    { id:'corona', ja:'コロナビーム', kind:'beam', dmg:34, windup:.68, active:.38, recover:.62,
      beam:{ len:960, h:28, yOff:-190, emitters:['mouth','shoulderL','shoulderR'] },
      telegraph:'line', cooldown:4.6, minRange:200, maxRange:9999, stagger:26, weight:1.4,
      note:'fired from the mouth and both shoulder crystals' },
    { id:'shield', ja:'フォトン・リアクティブ・シールド', kind:'special', dmg:0, windup:.35,
      active:2.6, recover:.70, telegraph:'flash', cooldown:9, minRange:0, maxRange:9999,
      stagger:0, weight:.7, tags:['reflect'], note:'dissipates and reflects energy beams' },
    { id:'ghosts', ja:'ホーミングゴースト', kind:'proj', dmg:12, windup:.60, active:.24, recover:.60,
      proj:{ speed:230, grav:0, r:15, count:6, spread:1.6, life:6.0, homing:.9, color:'#dcecff' },
      telegraph:'flash', cooldown:5.5, minRange:0, maxRange:9999, stagger:8, weight:1.3,
      note:'slow crystals, too many to dodge' },
    { id:'tornado', ja:'グラビ・トルネード', kind:'grab', dmg:24, windup:.62, active:.45, recover:.70,
      grab:{ dur:1.9, dmg:12, throwVx:640, throwVy:-360 }, telegraph:'flash', cooldown:7.5,
      minRange:0, maxRange:520, stagger:0, weight:1.1, note:'telekinesis Godzilla cannot break' },
    { id:'spikes', ja:'結晶生成', kind:'quake', dmg:18, windup:.55, active:.30, recover:.55,
      area:{ r:300, crystals:true }, knock:340, telegraph:'ring', cooldown:5.0, minRange:0,
      maxRange:340, stagger:16, weight:1.2, note:'raises crystal towers from the ground' },
    { id:'hurricane', ja:'フォトン・ハリケーン', kind:'proj', dmg:10, windup:.70, active:.20, recover:.60,
      proj:{ speed:340, grav:0, r:34, life:3.0, ring:true, drainEnergy:35, silence:4.0,
             color:'#bfe0ff' }, telegraph:'line', cooldown:10, minRange:0, maxRange:9999,
      stagger:6, weight:.8, note:'disrupts electrical instruments' },
  ],
  phases:[ { at:0.35, note:'浮遊形態', art:'spacegodzilla_fly', speed:210, airborne:true,
            cooldownMul:0.8, dmgMul:1.1 } ],
},

/* ---------- 10. デストロイア ---------- */
{
  id:'destoroyah', n:10, ja:'デストロイア', en:'Destoroyah', subtitle:'完全生命体',
  film:'ゴジラvsデストロイア (1995)', era:'Heisei', height:'40 m → 120 m', weight:'15,000 t →',
  element:'oxygen', threat:5,
  hp:2400, speed:200, w:150, h:240, staggerMax:240,
  resist:{ radiation:1.0, melee:1.0, fire:2.0 },   // extreme heat destroys micro-oxygen
  weakness:{ element:'fire', text:'高温が体内のマイクロオキシゲンを壊す。放射火炎とレッド熱線が2倍。',
             en:'Extreme heat destroys his micro-oxygen — Fire Ray and the red ray hit 2×.' },
  palette:{ skin:'#8a2a2a', skin2:'#5e1c1c', plate:'#a8403a', belly:'#c06a52',
            eye:'#f0e0c0', horn:'#e8d8c0', accent:'#ff7a5a' },
  art:'destoroyah', stage:{ bg:'bay', sky:['#1a0e14','#3a1a22','#6a3038'] },
  ai:{ aggression:.95, preferRange:200, dodge:.45, flank:.5 },
  attacks:[
    { id:'microoxygen', ja:'マイクロオキシゲン', kind:'beam', dmg:30, windup:.60, active:.36,
      recover:.58, beam:{ len:940, h:26, yOff:-160 }, telegraph:'line', cooldown:4.0,
      minRange:180, maxRange:9999, stagger:22, weight:1.4,
      note:'penetrates metal, disintegrates organic matter' },
    { id:'slicer', ja:'ヴァリアブルスライサー', kind:'melee', dmg:34, windup:.48, active:.18,
      recover:.50, reach:190, boxH:130, boxY:-180, knock:200, telegraph:'flash', cooldown:3.2,
      minRange:40, maxRange:230, stagger:26, weight:1.4, tags:['close'],
      note:'forehead horn blade, strongest at close quarters' },
    { id:'pincer', ja:'鋏尾', kind:'grab', dmg:24, windup:.55, active:.35, recover:.60,
      grab:{ dur:1.5, dmg:14, drain:25, throwVx:-300, throwVy:-240 }, telegraph:'flash',
      cooldown:6.5, minRange:0, maxRange:250, stagger:0, weight:1.1,
      note:'tail pincer holds Godzilla and drains energy' },
    { id:'split', ja:'分裂', kind:'special', dmg:0, windup:.80, active:.80, recover:.80,
      telegraph:'flash', cooldown:14, minRange:0, maxRange:9999, stagger:0, weight:.6,
      tags:['phase','spawn'], note:'trillions of organisms scatter, then recombine' },
    { id:'oxybomb', ja:'オキシジェン爆弾', kind:'aura', dmg:12, windup:.90, active:2.0, recover:.80,
      area:{ r:520, dot:true, dur:6.0, arena:true }, telegraph:'ring', cooldown:13,
      minRange:0, maxRange:9999, stagger:0, weight:.7, note:'environmental corruption' },
  ],
  phases:[
    { at:0.70, note:'幼体群', art:'destoroyah_juv', spawnJuveniles:3, dmgMul:1.1 },
    { at:0.30, note:'完全体', art:'destoroyah', dmgMul:1.25, speedMul:1.1, cooldownMul:0.8 },
  ],
},
];

/* ---------------- difficulty ---------------- */
const DIFFICULTY = {
  easy:   { hp:0.75, dmg:0.75, telegraph:1.4, name:'イージー' },
  normal: { hp:1.00, dmg:1.00, telegraph:1.0, name:'ノーマル' },
  hard:   { hp:1.30, dmg:1.35, telegraph:0.72, name:'ハード' },
};

/* ---------------- level order ---------------- */
const CAMPAIGN = MONSTERS.map(m => m.id);
