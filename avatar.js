'use strict';
/* Avatar: a little full-body athlete that appears on the athlete card, in
   battles and on the leaderboard. Cosmetics are bought with coins (from study)
   or Grit (from training); free basics are always owned. */

const COSMETICS = [
  // skin tones (free)
  ...[['sk1', '#f6d7b8'], ['sk2', '#f1c9a5'], ['sk3', '#d9a066'], ['sk4', '#a86b3c'], ['sk5', '#6b4226']].map(([id, c], i) => ({ id, cat: 'skin', name: `Tone ${i + 1}`, c })),
  // hair styles
  { id: 'h_short', cat: 'hair', name: 'Short' }, { id: 'h_buzz', cat: 'hair', name: 'Buzz cut' },
  { id: 'h_long', cat: 'hair', name: 'Long' }, { id: 'h_curly', cat: 'hair', name: 'Curls' },
  { id: 'h_side', cat: 'hair', name: 'Side part' }, { id: 'h_fringe', cat: 'hair', name: 'Fringe' }, { id: 'h_wavy', cat: 'hair', name: 'Wavy' },
  { id: 'h_afro', cat: 'hair', name: 'Afro' }, { id: 'h_pony', cat: 'hair', name: 'Ponytail' }, { id: 'h_bald', cat: 'hair', name: 'Shaved' },
  { id: 'h_spiky', cat: 'hair', name: 'Spiky', coins: 90 }, { id: 'h_bun', cat: 'hair', name: 'Man bun', coins: 100 },
  { id: 'h_mohawk', cat: 'hair', name: 'Mohawk', coins: 150 }, { id: 'h_mullet', cat: 'hair', name: 'Footy mullet', grit: 120 },
  { id: 'h_crop', cat: 'hair', name: 'Textured crop' }, { id: 'h_quiff', cat: 'hair', name: 'Quiff' }, { id: 'h_bob', cat: 'hair', name: 'Bob' },
  { id: 'h_flow', cat: 'hair', name: 'Surfer flow' }, { id: 'h_locs', cat: 'hair', name: 'Locs' }, { id: 'h_cornrows', cat: 'hair', name: 'Cornrows' },
  { id: 'h_twists', cat: 'hair', name: 'Twists' }, { id: 'h_slick', cat: 'hair', name: 'Slicked back' }, { id: 'h_undercut', cat: 'hair', name: 'Undercut', coins: 80 },
  { id: 'h_frosted', cat: 'hair', name: 'Frosted tips', coins: 140 }, { id: 'h_pigtails', cat: 'hair', name: 'Bunches', coins: 90 },
  // hair colours
  ...[['hc_brown', 'Brown', '#5c3a21'], ['hc_black', 'Black', '#1f1a17'], ['hc_blonde', 'Blonde', '#e0b44c']].map(([id, name, c]) => ({ id, cat: 'hairCol', name, c })),
  { id: 'hc_ginger', cat: 'hairCol', name: 'Ginger', c: '#c8541c' }, { id: 'hc_silver', cat: 'hairCol', name: 'Silver dye', c: '#c9ced6', coins: 80 },
  { id: 'hc_blue', cat: 'hairCol', name: 'Electric blue', c: '#228be6', coins: 120 }, { id: 'hc_pink', cat: 'hairCol', name: 'Hot pink', c: '#e64980', coins: 120 },
  { id: 'hc_green', cat: 'hairCol', name: 'Toxic green', c: '#40c057', coins: 120 },
  // faces
  { id: 'f_smile', cat: 'face', name: 'Smile' }, { id: 'f_focus', cat: 'face', name: 'Focused', coins: 30 },
  { id: 'f_grin', cat: 'face', name: 'Big grin', coins: 40 }, { id: 'f_fierce', cat: 'face', name: 'Game face', grit: 60 },
  // headwear
  { id: 'hat_none', cat: 'hat', name: 'None' }, { id: 'hat_band', cat: 'hat', name: 'Sweatband', coins: 50 },
  { id: 'hat_cap', cat: 'hat', name: 'Cap', coins: 90 }, { id: 'hat_beanie', cat: 'hat', name: 'Beanie', coins: 90 },
  { id: 'hat_backcap', cat: 'hat', name: 'Backwards cap', coins: 120 }, { id: 'hat_crown', cat: 'hat', name: 'Champion crown', grit: 600 },
  // eyewear
  { id: 'eye_none', cat: 'eyes', name: 'None' }, { id: 'eye_sport', cat: 'eyes', name: 'Sport shades', coins: 110 },
  { id: 'eye_aviator', cat: 'eyes', name: 'Aviators', coins: 160 }, { id: 'eye_paint', cat: 'eyes', name: 'Eye black', grit: 80 },
  // kit colours (override the colour of your top)
  { id: 'kit_gear', cat: 'kit', name: 'From your gear' },
  ...[['kit_navy', 'Navy', '#1b2a6b', 60], ['kit_red', 'Red', '#c92a2a', 60], ['kit_green', 'Green', '#2b8a3e', 60], ['kit_black', 'Black', '#212529', 80], ['kit_purple', 'Purple', '#7048e8', 80], ['kit_teal', 'Teal', '#0c8599', 80], ['kit_white', 'White', '#f1f3f5', 80]].map(([id, name, c, coins]) => ({ id, cat: 'kit', name, c, coins })),
  { id: 'kit_gold', cat: 'kit', name: 'Gold', c: '#f2b705', grit: 400 },
  // shoes
  { id: 'sh_white', cat: 'shoes', name: 'White' }, { id: 'sh_black', cat: 'shoes', name: 'Black', coins: 30 },
  { id: 'sh_neon', cat: 'shoes', name: 'Neon', c: '#94d82d', coins: 90 }, { id: 'sh_red', cat: 'shoes', name: 'Red', c: '#fa5252', coins: 90 }, { id: 'sh_gold', cat: 'shoes', name: 'Gold', c: '#fcc419', grit: 300 },
  // extras
  { id: 'x_none', cat: 'extra', name: 'None' }, { id: 'x_chain', cat: 'extra', name: 'Gold chain', coins: 200 },
  { id: 'x_medal', cat: 'extra', name: 'Medal', grit: 150 }, { id: 'x_cape', cat: 'extra', name: 'Hero cape', grit: 350 },
  { id: 'x_wings', cat: 'extra', name: 'Wings', coins: 500 }, { id: 'x_aura', cat: 'extra', name: 'Flame aura', grit: 800 },
  // backgrounds (card and leaderboard)
  { id: 'bg_none', cat: 'bg', name: 'Plain' }, { id: 'bg_sunset', cat: 'bg', name: 'Sunset', coins: 80 },
  { id: 'bg_track', cat: 'bg', name: 'Running track', grit: 120 }, { id: 'bg_oval', cat: 'bg', name: 'Footy oval', grit: 150 },
  { id: 'bg_galaxy', cat: 'bg', name: 'Galaxy', coins: 250 }, { id: 'bg_fire', cat: 'bg', name: 'On fire', grit: 400 },
  // victory dances (after a battle win)
  { id: 'd_jump', cat: 'dance', name: 'Jump for joy' }, { id: 'd_flex', cat: 'dance', name: 'Flex', grit: 100 },
  { id: 'd_spin', cat: 'dance', name: 'Spin', coins: 120 }, { id: 'd_flip', cat: 'dance', name: 'Backflip', grit: 300 },
  // more headwear
  { id: 'hat_phones', cat: 'hat', name: 'Headphones', coins: 140 }, { id: 'hat_bucket', cat: 'hat', name: 'Bucket hat', coins: 110 },
  { id: 'hat_party', cat: 'hat', name: 'Party hat', coins: 70 }, { id: 'hat_viking', cat: 'hat', name: 'Viking helmet', grit: 250 },
  { id: 'hat_halo', cat: 'hat', name: 'Halo', coins: 400 }, { id: 'hat_horns', cat: 'hat', name: 'Devil horns', coins: 300 },
  { id: 'hat_snap', cat: 'hat', name: 'Flat-brim snapback', coins: 130 }, { id: 'hat_durag', cat: 'hat', name: 'Durag', coins: 100 },
  { id: 'hat_bandana', cat: 'hat', name: 'Bandana', grit: 90 }, { id: 'hat_beret', cat: 'hat', name: 'Beret', coins: 120 },
  { id: 'hat_flowers', cat: 'hat', name: 'Flower crown', coins: 140 }, { id: 'hat_helmet', cat: 'hat', name: 'Bike helmet', grit: 180 },
  // more eyewear
  { id: 'eye_goggles', cat: 'eyes', name: 'Swim goggles', grit: 90 }, { id: 'eye_nerd', cat: 'eyes', name: 'Study glasses', coins: 80 },
  { id: 'eye_star', cat: 'eyes', name: 'Star shades', coins: 220 }, { id: 'eye_laser', cat: 'eyes', name: 'Laser eyes', grit: 500 },
  { id: 'eye_3d', cat: 'eyes', name: '3D glasses', coins: 90 }, { id: 'eye_mono', cat: 'eyes', name: 'Monocle', coins: 150 },
  { id: 'eye_ski', cat: 'eyes', name: 'Ski goggles', grit: 160 }, { id: 'eye_heart', cat: 'eyes', name: 'Heart shades', coins: 200 },
  // more kits and patterns
  { id: 'kit_stripes', cat: 'kit', name: 'Striped jumper', c: '#1b2a6b', pattern: 'stripes', coins: 150 },
  { id: 'kit_hoops', cat: 'kit', name: 'Hooped jumper', c: '#c92a2a', pattern: 'hoops', coins: 150 },
  { id: 'kit_camo', cat: 'kit', name: 'Camo', c: '#5c6b3a', pattern: 'camo', grit: 250 },
  { id: 'kit_rainbow', cat: 'kit', name: 'Rainbow', c: '#7048e8', pattern: 'rainbow', coins: 450 },
  // more extras
  { id: 'x_ball', cat: 'extra', name: 'Footy under arm', grit: 120 }, { id: 'x_trophy', cat: 'extra', name: 'Trophy', grit: 500 },
  { id: 'x_books', cat: 'extra', name: 'Stack of books', coins: 150 }, { id: 'x_sparkle', cat: 'extra', name: 'Sparkles', coins: 350 },
  // more backgrounds
  { id: 'bg_beach', cat: 'bg', name: 'Beach', coins: 150 }, { id: 'bg_snow', cat: 'bg', name: 'Snowy peaks', coins: 200 },
  { id: 'bg_everest', cat: 'bg', name: 'Everest base camp', grit: 300 }, { id: 'bg_neon', cat: 'bg', name: 'Neon city', coins: 300 },
  { id: 'bg_gold', cat: 'bg', name: 'Hall of Fame gold', grit: 700 },
  // more dances
  { id: 'd_dab', cat: 'dance', name: 'Dab', coins: 150 }, { id: 'd_moon', cat: 'dance', name: 'Moonwalk', coins: 250 }, { id: 'd_worm', cat: 'dance', name: 'The worm', grit: 220 },
  // pets that follow you around
  { id: 'p_none', cat: 'pet', name: 'No pet' }, { id: 'p_dog', cat: 'pet', name: 'Puppy', e: '🐶', coins: 200 }, { id: 'p_cat', cat: 'pet', name: 'Cat', e: '🐱', coins: 200 },
  { id: 'p_roo', cat: 'pet', name: 'Joey', e: '🦘', grit: 250 }, { id: 'p_koala', cat: 'pet', name: 'Koala', e: '🐨', coins: 300 }, { id: 'p_penguin', cat: 'pet', name: 'Penguin', e: '🐧', coins: 300 },
  { id: 'p_fox', cat: 'pet', name: 'Fox', e: '🦊', grit: 350 }, { id: 'p_owl', cat: 'pet', name: 'Study owl', e: '🦉', coins: 400 }, { id: 'p_dragon', cat: 'pet', name: 'Dragon', e: '🐉', grit: 900 },
  { id: 'p_unicorn', cat: 'pet', name: 'Unicorn', e: '🦄', coins: 900 },
  // only won in battle (boss drops, daily challenges, survival)
  { id: 'x_belt', cat: 'extra', name: 'Champion belt', drop: 'Beat Coach Crusher' },
  { id: 'kit_storm', cat: 'kit', name: 'Storm kit', c: '#0b7285', pattern: 'hoops', drop: 'Beat Storm Rider' },
  { id: 'eye_titan', cat: 'eyes', name: 'Titan visor', drop: 'Beat The Titan' },
  { id: 'hat_goat', cat: 'hat', name: 'GOAT horns', drop: 'Beat The GOAT' },
  { id: 'p_eagle', cat: 'pet', name: 'Eagle', e: '🦅', drop: 'Win 3 daily challenges' },
  { id: 'bg_arena', cat: 'bg', name: 'Arena lights', drop: 'Reach wave 8 in Survival' },
  // 2.22.8: more styles, some unlocked by what you do rather than bought
  { id: 'h_braids', cat: 'hair', name: 'Box braids' }, { id: 'h_hightop', cat: 'hair', name: 'High top' },
  { id: 'h_wolf', cat: 'hair', name: 'Wolf cut', coins: 120 }, { id: 'h_spacebuns', cat: 'hair', name: 'Space buns', coins: 120 },
  { id: 'hc_purple', cat: 'hairCol', name: 'Purple haze', c: '#845ef7', coins: 120 }, { id: 'hc_flame', cat: 'hairCol', name: 'Flame red', c: '#f03e3e', grit: 150 },
  { id: 'hat_cowboy', cat: 'hat', name: 'Cowboy hat', coins: 220 }, { id: 'hat_tophat', cat: 'hat', name: 'Top hat', coins: 260 },
  { id: 'hat_wizard', cat: 'hat', name: 'Wizard hat', req: { level: 10 } }, { id: 'hat_beta', cat: 'hat', name: 'Beta tester cap', req: { badge: 'beta' } },
  { id: 'eye_visor', cat: 'eyes', name: 'Cyber visor', coins: 300 }, { id: 'eye_vr', cat: 'eyes', name: 'VR headset', grit: 350 },
  { id: 'kit_flames', cat: 'kit', name: 'Flame jumper', c: '#212529', pattern: 'flames', grit: 350 },
  { id: 'kit_checker', cat: 'kit', name: 'Checkerboard', c: '#212529', pattern: 'checker', coins: 200 },
  { id: 'kit_galaxy', cat: 'kit', name: 'Galaxy kit', c: '#2b1d5c', pattern: 'galaxy', req: { streak: 14 } },
  { id: 'kit_beta', cat: 'kit', name: 'Beta jersey', c: '#7048e8', pattern: 'beta', req: { badge: 'beta' } },
  { id: 'kit_dev', cat: 'kit', name: 'Dev hoodie', c: '#1b1f2a', pattern: 'dev', req: { badge: 'dev' } },
  { id: 'sh_purple', cat: 'shoes', name: 'Purple', c: '#845ef7', coins: 90 }, { id: 'sh_glow', cat: 'shoes', name: 'Glow-in-the-dark', c: '#3bc9db', coins: 250 },
  { id: 'x_backpack', cat: 'extra', name: 'School bag', coins: 120 }, { id: 'x_guitar', cat: 'extra', name: 'Guitar', coins: 300 },
  { id: 'x_skate', cat: 'extra', name: 'Skateboard', coins: 220 }, { id: 'x_jetpack', cat: 'extra', name: 'Jetpack', req: { level: 20 } },
  { id: 'x_laptop', cat: 'extra', name: 'Dev laptop', req: { badge: 'dev' } },
  { id: 'bg_ocean', cat: 'bg', name: 'Under the sea', coins: 250 }, { id: 'bg_night', cat: 'bg', name: 'Stadium at night', grit: 250 },
  { id: 'bg_volcano', cat: 'bg', name: 'Volcano', grit: 400 }, { id: 'bg_aurora', cat: 'bg', name: 'Aurora', req: { streak: 7 } },
  { id: 'd_robot', cat: 'dance', name: 'The robot', coins: 200 }, { id: 'd_floss', cat: 'dance', name: 'Floss', coins: 180 },
  { id: 'p_bunny', cat: 'pet', name: 'Bunny', e: '🐰', coins: 250 }, { id: 'p_frog', cat: 'pet', name: 'Frog', e: '🐸', grit: 200 },
  { id: 'p_panda', cat: 'pet', name: 'Panda', e: '🐼', coins: 350 }, { id: 'p_lion', cat: 'pet', name: 'Lion', e: '🦁', grit: 600 },
  { id: 'p_robot', cat: 'pet', name: 'Robo pal', e: '🤖', coins: 600 }, { id: 'p_turtle', cat: 'pet', name: 'Wise turtle', e: '🐢', req: { streak: 30 } },
];
// unlocked by doing things: a level, a study streak, or a badge
function cosReq(c) {
  const r = c?.req; if (!r) return null;
  if (r.level) { const n = typeof levelInfo === 'function' ? levelInfo().n : 0; return { ok: n >= r.level, label: `Reach level ${r.level}`, prog: `${Math.min(n, r.level)}/${r.level}` }; }
  if (r.streak) { const n = typeof studyStreak === 'function' ? studyStreak() : 0; return { ok: n >= r.streak, label: `${r.streak}-day study streak`, prog: `${Math.min(n, r.streak)}/${r.streak}` }; }
  if (r.badge) { const has = typeof myBadges !== 'undefined' && myBadges.includes(r.badge); return { ok: has, label: r.badge === 'beta' ? 'Beta testers only' : 'Developer only', prog: '' }; }
  return null;
}
const COS_CATS = [['look', '🪞 Look like me'], ['skin', 'Skin'], ['hair', 'Hair'], ['hairCol', 'Hair colour'], ['face', 'Face'], ['hat', 'Headwear'], ['eyes', 'Eyewear'], ['kit', 'Kit colour'], ['shoes', 'Shoes'], ['extra', 'Extras'], ['bg', 'Background'], ['dance', 'Victory dance'], ['pet', 'Pet']];
const AV_DEFAULT = { skin: 'sk2', hair: 'h_short', hairCol: 'hc_brown', face: 'f_smile', hat: 'hat_none', eyes: 'eye_none', kit: 'kit_gear', shoes: 'sh_white', extra: 'x_none', bg: 'bg_none', dance: 'd_jump', pet: 'p_none' };
const cos = id => COSMETICS.find(c => c.id === id);
const cosFree = c => !c.coins && !c.grit && !c.drop && !c.req;
const ownsCos = id => { const c = cos(id); if (!c) return false; if (cosFree(c) || (D.arena.owned || {})[id]) return true; const r = cosReq(c); if (r?.ok && !c.req.badge) { D.arena.owned = { ...(D.arena.owned || {}), [id]: new Date().toISOString() }; return true; } return !!r?.ok; };
const myAv = () => Object.assign({}, AV_DEFAULT, D.arena.av || {});

function buyCos(id) {
  const c = cos(id); if (!c || ownsCos(id)) return;
  if (c.coins && coins() < c.coins) { toast('Not enough coins', `${c.name} costs ${c.coins} ${COIN}. Study to earn more.`); return; }
  if (c.grit && grit() < c.grit) { toast('Not enough Grit', `${c.name} costs ${c.grit} ${GRIT}. Train to earn more.`); return; }
  if (c.coins) D.game.spent = (D.game.spent || 0) + c.coins;
  if (c.grit) D.arena.spent = (D.arena.spent || 0) + c.grit;
  D.arena.owned = { ...(D.arena.owned || {}), [id]: new Date().toISOString() };
  wearCos(id, true);
  toast(`✨ ${c.name} unlocked`, 'Equipped on your avatar.');
}
function wearCos(id, quiet) {
  const c = cos(id); if (!c || !ownsCos(id)) return;
  D.arena.av = { ...myAv(), [c.cat]: id }; save(); render();
}

// avatar as a compact object other people's copies can draw (for the leaderboard)
function avatarSpec(av = myAv()) {
  const top = equippedGear().find(g => g.slot === 'top');
  return { ...av, look: myLook(), kitC: av.kit === 'kit_gear' ? (top?.color || '#5c7cfa') : cos(av.kit)?.c, no: D.settings.jerseyNo ?? 11 };
}

// ---------- character creator (free): features that make the avatar look like you ----------
const LOOK_OPTS = {
  skinC: ['#fde3cf', '#f6d7b8', '#f1c9a5', '#e8b48a', '#d9a066', '#c58c5c', '#a86b3c', '#8a5530', '#6b4226', '#4a2d1a'],
  hairC: ['#1f1a17', '#3b2416', '#5c3a21', '#7a4f2b', '#a0703f', '#c8a060', '#e0c07a', '#b5541c', '#8c2f1a', '#9aa0a6', '#e9ecef'],
  eyeCol: ['#4a2f1b', '#6b4423', '#8a6a3a', '#3f7d4e', '#5b8fb9', '#2f5f8a', '#7b8b99'],
  face: [['round', 'Round'], ['oval', 'Oval'], ['square', 'Square'], ['long', 'Long'], ['heart', 'Heart']],
  eyes: [['dots', 'Classic'], ['round', 'Round'], ['almond', 'Almond'], ['wide', 'Big'], ['sleepy', 'Relaxed'], ['narrow', 'Narrow']],
  brows: [['straight', 'Straight'], ['arched', 'Arched'], ['thick', 'Thick'], ['thin', 'Thin'], ['angled', 'Angled'], ['none', 'Light']],
  nose: [['small', 'Small'], ['button', 'Button'], ['long', 'Long'], ['wide', 'Wide'], ['pointed', 'Pointed']],
  mouth: [['smile', 'Smile'], ['neutral', 'Neutral'], ['smirk', 'Smirk'], ['open', 'Big smile'], ['braces', 'Braces'], ['small', 'Small']],
  ears: [['normal', 'Normal'], ['small', 'Small'], ['big', 'Big']],
  beard: [['none', 'None'], ['stubble', 'Stubble'], ['moustache', 'Moustache'], ['goatee', 'Goatee'], ['full', 'Full beard']],
  extras: [['none', 'None'], ['freckles', 'Freckles'], ['blush', 'Rosy cheeks'], ['mole', 'Beauty spot'], ['scar', 'Scar'], ['dimples', 'Dimples']],
  glasses: [['none', 'None'], ['rect', 'Rectangle'], ['round', 'Round'], ['thick', 'Thick frames'], ['rimless', 'Rimless']],
  build: [['slim', 'Slim'], ['regular', 'Regular'], ['athletic', 'Athletic'], ['broad', 'Broad']],
  earrings: [['none', 'None'], ['stud', 'One stud'], ['studs', 'Two studs'], ['hoop', 'One hoop'], ['hoops', 'Two hoops']],
  browCut: [['none', 'None'], ['one', 'One slit'], ['two', 'Two slits']],
  sideburns: [['none', 'None'], ['short', 'Short'], ['long', 'Long']],
  lashes: [['none', 'Normal'], ['lashes', 'Long lashes']],
  height: [['short', 'Shorter'], ['average', 'Average'], ['tall', 'Taller']],
};
const LOOK_DEFAULT = { skinC: '', hairC: '', eyeCol: '#6b4423', face: 'round', eyes: 'dots', brows: 'straight', nose: 'small', mouth: 'smile', ears: 'normal', beard: 'none', extras: 'none', glasses: 'none', build: 'regular', height: 'average', earrings: 'none', browCut: 'none', sideburns: 'none', lashes: 'none' };
const myLook = () => Object.assign({}, LOOK_DEFAULT, D.arena.look || {});
function setLook(k, v) { if (!(k in LOOK_DEFAULT)) return; D.arena.look = { ...myLook(), [k]: v }; save(); render(); }

// full-body SVG. Parts are groups so the fight animations can swing them.
let avatarN = 0;
function avatarFull(spec = avatarSpec(), { size = 140, cls = '', face = 'right' } = {}) {
  const C = id => cos(id) || {};
  const L = Object.assign({}, LOOK_DEFAULT, spec.look || {});
  const dyed = spec.hairCol && C(spec.hairCol).coins || C(spec.hairCol).grit; // a bought dye beats the natural colour
  const skin = L.skinC || C(spec.skin).c || '#f1c9a5', hairC = (dyed ? C(spec.hairCol).c : L.hairC) || C(spec.hairCol).c || '#5c3a21', kit = spec.kitC || '#5c7cfa';
  const shade = (hex, f) => { const n = parseInt(hex.slice(1), 16); const ch = sh => Math.max(0, Math.min(255, Math.round(((n >> sh) & 255) * f))); return `rgb(${ch(16)},${ch(8)},${ch(0)})`; };
  const dark = shade(skin, .8), ink = '#3b2a1e';
  const shoe = C(spec.shoes).c || (spec.shoes === 'sh_black' ? '#212529' : '#f8f9fa');
  const light = kit === '#f1f3f5' ? '#495057' : 'rgba(255,255,255,.9)';
  const ex = spec.face || 'f_smile';
  const headShape = { round: '<circle cx="62" cy="38" r="20" fill="SK"/>', oval: '<ellipse cx="62" cy="39" rx="18" ry="22" fill="SK"/>', square: '<rect x="43" y="18" width="38" height="40" rx="11" fill="SK"/>',
    long: '<ellipse cx="62" cy="40" rx="17" ry="23" fill="SK"/>', heart: '<path d="M42 34 Q42 17 62 17 Q82 17 82 34 Q82 50 62 60 Q42 50 42 34Z" fill="SK"/>' }[L.face].replace('SK', skin);
  // Hair is built on the head's own outline (the head shape, a little bigger,
  // cut off at the hairline), so every style fits every face shape and hats
  // sit on the same outline.
  const G = { round: [42, 82, 18, 38], oval: [44, 80, 17, 39], square: [43, 81, 18, 38], long: [45, 79, 17, 40], heart: [42, 82, 17, 36] }[L.face] || [42, 82, 18, 38];
  const [hl, hr, ht, hcy] = G, hw = hr - hl, uidH = 'hc' + (++avatarN) + '_';
  let capK = 0;
  const hd = shade(hairC, .72), hh = shade(hairC, 1.25);
  const covered = /^hat_(cap|backcap|beanie|bucket|viking|snap|durag|bandana|beret|helmet|cowboy|tophat|wizard|beta)$/.test(spec.hat || '');
  const line = (fore, side, inset = 4) => `M-10 -40 H134 V${side} H${hr - inset} Q${hr - inset} ${fore} 62 ${fore} Q${hl + inset} ${fore} ${hl + inset} ${side} H-10Z`;
  const zig = (y, side, inset = 4, n = 7, d = 3) => { const x0 = hl + inset, x1 = hr - inset, st = (x1 - x0) / n; let p = `M-10 -40 H134 V${side} H${x1} L${x1} ${y}`; for (let k = n - 1; k >= 0; k--) p += ` L${(x0 + st * (k + .5)).toFixed(1)} ${y + d} L${(x0 + st * k).toFixed(1)} ${y}`; return p + ` L${x0} ${side} H-10Z`; };
  const capOf = (clip, extra = '', op = 1) => { const id = uidH + (++capK); return `<clipPath id="${id}"><path d="${clip}"/></clipPath><g clip-path="url(#${id})" opacity="${op}">${headShape.replace(/fill="[^"]+"/, `fill="${hairC}" stroke="${hairC}" stroke-width="3.6" stroke-linejoin="round"`)}${extra}</g>`; };
  const arcPts = (n, from = 200, to = -20, grow = 1) => Array.from({ length: n }, (_, k) => { const a = (from + (to - from) * k / (n - 1)) * Math.PI / 180; return [62 + (hw / 2 + grow) * Math.cos(a), hcy - (hcy - ht + grow) * Math.sin(a)]; });
  const backPanel = (len, flick = 0) => `<path d="M${hl - 2.5} ${hcy - 8} Q${hl - 4} ${hcy + len * .6} ${hl - 2 - flick} ${hcy + len} L${hr + 2 + flick} ${hcy + len} Q${hr + 4} ${hcy + len * .6} ${hr + 2.5} ${hcy - 8}Z" fill="${hairC}"/>`;
  const H = { back: '', cap: '', top: '' };
  switch (spec.hair) {
    case 'h_bald': H.cap = `<ellipse cx="56" cy="${ht + 6}" rx="5" ry="2.2" fill="#fff" opacity=".22"/>`; break;
    case 'h_buzz': H.cap = capOf(line(26.5, 35, 3), '', .72); break;
    case 'h_short': H.cap = capOf(line(27.5, 36)); break;
    case 'h_crop': H.cap = capOf(zig(27.5, 36, 4, 8, 2.6), arcPts(9, 170, 10, -2).map(([x, y]) => `<path d="M${x - 2} ${y + 2} l2 -3 l2 3" stroke="${hd}" stroke-width=".8" fill="none"/>`).join('')); break;
    case 'h_fringe': H.cap = capOf(zig(29.5, 38, 3.5, 7, 2.2)); break;
    case 'h_side': H.cap = capOf(`M-10 -40 H134 V37 H${hr - 4} Q${hr - 4} 31.5 68 30.5 Q60 28.5 52 25 Q${hl + 4} 25.5 ${hl + 4} 37 H-10Z`, `<path d="M53 ${ht} Q52 ${ht + 4} 52 25" stroke="${hd}" stroke-width="1" fill="none"/>`); break;
    case 'h_slick': H.cap = capOf(line(26, 37), [56, 62, 68].map(x => `<path d="M${x} 27 Q${x + 1} ${ht + 4} ${x + 3} ${ht - 2}" stroke="${hh}" stroke-width=".9" fill="none" opacity=".7"/>`).join('')); break;
    case 'h_quiff': H.cap = capOf(line(27, 36)); H.top = `<path d="M49 ${ht + 6} Q48 ${ht - 9} 64 ${ht - 10} Q79 ${ht - 9} 77 ${ht + 5} Q70 ${ht - 2} 60 ${ht + 1} Q53 ${ht + 2} 49 ${ht + 6}Z" fill="${hairC}"/><path d="M54 ${ht - 3} Q62 ${ht - 8} 72 ${ht - 5}" stroke="${hh}" stroke-width="1" fill="none"/>`; break;
    case 'h_spiky': H.cap = capOf(line(27, 36)); H.top = `<path d="M${hl + 3} ${ht + 9} ${arcPts(7, 165, 15, 0).map(([x, y], k) => `L${(x - 2.5).toFixed(1)} ${y.toFixed(1)} L${x.toFixed(1)} ${(y - 9 + Math.abs(k - 3)).toFixed(1)} L${(x + 2.5).toFixed(1)} ${y.toFixed(1)}`).join(' ')} L${hr - 3} ${ht + 9}Z" fill="${hairC}"/>`; break;
    case 'h_frosted': H.cap = capOf(line(27, 36)); H.top = arcPts(7, 165, 15, 0).map(([x, y], k) => `<path d="M${(x - 2.6).toFixed(1)} ${(y + 3).toFixed(1)} L${x.toFixed(1)} ${(y - 8 + Math.abs(k - 3)).toFixed(1)} L${(x + 2.6).toFixed(1)} ${(y + 3).toFixed(1)}Z" fill="${hairC}"/><path d="M${(x - 1.3).toFixed(1)} ${(y - 2.5 + Math.abs(k - 3) / 2).toFixed(1)} L${x.toFixed(1)} ${(y - 8 + Math.abs(k - 3)).toFixed(1)} L${(x + 1.3).toFixed(1)} ${(y - 2.5 + Math.abs(k - 3) / 2).toFixed(1)}Z" fill="#f8e7a1"/>`).join(''); break;
    case 'h_mohawk': H.cap = capOf(line(27, 35), '', .3) + capOf(`M55 -40 H69 V30 H55Z`); H.top = `<path d="M55.5 ${ht + 6} L56.5 ${ht - 14} Q62 ${ht - 21} 67.5 ${ht - 14} L68.5 ${ht + 6}Z" fill="${hairC}"/>`; break;
    case 'h_undercut': H.cap = capOf(line(27, 36), '', .3) + capOf(line(27, ht + 9, 7)); H.top = `<path d="M49 ${ht + 7} Q50 ${ht - 6} 66 ${ht - 6} Q79 ${ht - 5} 77 ${ht + 7} Q66 ${ht + 1} 49 ${ht + 7}Z" fill="${hairC}"/>`; break;
    case 'h_cornrows': H.cap = capOf(line(26.5, 36), [-12, -6, 0, 6, 12].map(dx => `<path d="M${62 + dx * .9} 26 Q${62 + dx * 1.3} ${hcy - 8} ${62 + dx * 1.2} ${ht + 1.5}" stroke="${hd}" stroke-width="1" fill="none" stroke-dasharray="1.6 1.2"/>`).join('')); break;
    case 'h_twists': H.cap = capOf(line(27, 36)); H.top = [...arcPts(8, 172, 8, .5), ...arcPts(5, 140, 40, -5)].map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.4" fill="${hairC}" stroke="${hd}" stroke-width=".6"/>`).join(''); break;
    case 'h_curly': H.cap = capOf(line(27, 37)); H.top = arcPts(8, 190, -10, 1).map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5.6" fill="${hairC}"/>`).join(''); break;
    case 'h_afro': { const R = hw / 2 + 9; H.back = `<circle cx="62" cy="${hcy - 6}" r="${R}" fill="${hairC}"/><circle cx="62" cy="${hcy - 6}" r="${R}" fill="none" stroke="${hd}" stroke-width="1" stroke-dasharray="2 3" opacity=".6"/>`; H.cap = capOf(line(26.5, 37)); break; }
    case 'h_long': H.back = backPanel(24); H.cap = capOf(line(27.5, 42, 3)); break;
    case 'h_wavy': H.back = `<path d="M${hl - 2.5} ${hcy - 8} Q${hl - 6} ${hcy + 4} ${hl - 2} ${hcy + 8} Q${hl - 6} ${hcy + 13} ${hl - 1} ${hcy + 18} L${hr + 1} ${hcy + 18} Q${hr + 6} ${hcy + 13} ${hr + 2} ${hcy + 8} Q${hr + 6} ${hcy + 4} ${hr + 2.5} ${hcy - 8}Z" fill="${hairC}"/>`; H.cap = capOf(line(27, 40, 3)); break;
    case 'h_bob': H.back = backPanel(12); H.cap = capOf(zig(29, 44, 2.5, 6, 1.2)); break;
    case 'h_flow': H.back = backPanel(10, 3); H.cap = capOf(`M-10 -40 H134 V42 H${hr - 3} Q${hr - 3} 30 66 28 Q58 27 54 24 Q${hl + 3} 28 ${hl + 3} 42 H-10Z`); break;
    case 'h_mullet': H.back = `<path d="M${hl} ${hcy - 2} Q${hl - 2} ${hcy + 16} ${hl + 6} ${hcy + 21} L${hr - 6} ${hcy + 21} Q${hr + 2} ${hcy + 16} ${hr} ${hcy - 2}Z" fill="${hairC}"/>`; H.cap = capOf(line(27, 37)); break;
    case 'h_locs': H.back = [-1, 0, 1, 2, 3].flatMap(k => [hl - 2 + k * 2.6, hr + 2 - k * 2.6]).map(x => `<rect x="${(x - 1.7).toFixed(1)}" y="${hcy - 6}" width="3.4" height="${26 - Math.abs(x - 62) / 6}" rx="1.7" fill="${hairC}" stroke="${hd}" stroke-width=".5"/>`).join(''); H.cap = capOf(line(27, 38), arcPts(7, 175, 5, -3).map(([x, y]) => `<path d="M${x.toFixed(1)} ${(y - 3).toFixed(1)} v5" stroke="${hd}" stroke-width=".7"/>`).join('')); break;
    case 'h_pony': H.back = `<path d="M${hr - 3} ${hcy - 12} Q${hr + 13} ${hcy - 6} ${hr + 7} ${hcy + 16} Q${hr + 2} ${hcy + 3} ${hr - 4} ${hcy - 3}Z" fill="${hairC}"/>`; H.cap = capOf(line(27.5, 37)); break;
    case 'h_pigtails': H.back = `<circle cx="${hl - 5}" cy="${hcy - 4}" r="6.5" fill="${hairC}"/><circle cx="${hr + 5}" cy="${hcy - 4}" r="6.5" fill="${hairC}"/>`; H.cap = capOf(zig(29, 37, 3.5, 6, 2)) + `<circle cx="${hl}" cy="${hcy - 6}" r="1.8" fill="#e64980"/><circle cx="${hr}" cy="${hcy - 6}" r="1.8" fill="#e64980"/>`; break;
    case 'h_bun': H.cap = capOf(line(27, 36)); H.top = `<circle cx="62" cy="${ht - 4}" r="6.5" fill="${hairC}"/><path d="M57 ${ht - 1} Q62 ${ht + 1} 67 ${ht - 1}" stroke="${hd}" stroke-width="1.2" fill="none"/>`; break;
    case 'h_braids': H.back = [-1, 0, 1, 2, 3, 4].flatMap(k => [hl - 2.5 + k * 2.2, hr + 2.5 - k * 2.2]).map(x => `<rect x="${(x - 1.3).toFixed(1)}" y="${hcy - 6}" width="2.6" height="${30 - Math.abs(x - 62) / 5}" rx="1.3" fill="${hairC}"/><circle cx="${x.toFixed(1)}" cy="${(hcy + 24 - Math.abs(x - 62) / 5).toFixed(1)}" r="1.5" fill="#fcc419"/>`).join(''); H.cap = capOf(line(27, 38), [-9, -3, 3, 9].map(dx => `<path d="M${62 + dx} 27 L${62 + dx * 1.2} ${ht + 1}" stroke="${hd}" stroke-width=".7"/>`).join('')); break;
    case 'h_hightop': H.cap = capOf(line(27, 36)); H.top = `<path d="M${hl + 4} ${ht + 8} L${hl + 6} ${ht - 14} Q62 ${ht - 17} ${hr - 6} ${ht - 14} L${hr - 4} ${ht + 8}Z" fill="${hairC}"/><path d="M${hl + 7} ${ht - 12} Q62 ${ht - 15} ${hr - 7} ${ht - 12}" stroke="${hh}" stroke-width="1" fill="none" opacity=".6"/>`; break;
    case 'h_wolf': H.back = `<path d="M${hl - 2} ${hcy - 6} L${hl - 4} ${hcy + 12} L${hl + 1} ${hcy + 8} L${hl} ${hcy + 15} L${hr} ${hcy + 15} L${hr - 1} ${hcy + 8} L${hr + 4} ${hcy + 12} L${hr + 2} ${hcy - 6}Z" fill="${hairC}"/>`; H.cap = capOf(zig(30, 40, 2.5, 6, 3.5)); H.top = arcPts(6, 160, 20, 1).map(([x, y]) => `<path d="M${(x - 3).toFixed(1)} ${(y + 3).toFixed(1)} L${x.toFixed(1)} ${(y - 4).toFixed(1)} L${(x + 3).toFixed(1)} ${(y + 3).toFixed(1)}Z" fill="${hairC}"/>`).join(''); break;
    case 'h_spacebuns': H.cap = capOf(line(27.5, 37)); H.top = [hl + 7, hr - 7].map(x => `<circle cx="${x}" cy="${ht - 2}" r="7" fill="${hairC}"/><path d="M${x - 4} ${ht - 3} Q${x} ${ht - 7} ${x + 4} ${ht - 3}" stroke="${hd}" stroke-width="1" fill="none"/>`).join(''); break;
    default: H.cap = capOf(line(27.5, 36));
  }
  if (covered) H.top = '';
  // hats are drawn for a round head and stretched to this head
  const hatFit = `translate(62 ${ht - 18}) scale(${((hw + 3.6) / 40).toFixed(3)} 1) translate(-62 0)`;
  const earR = { normal: 4.5, small: 3.5, big: 6 }[L.ears] || 4.5;
  const ears = `<circle cx="${L.face === 'long' || L.face === 'oval' ? 44.5 : 42.5}" cy="40" r="${earR}" fill="${skin}"/><circle cx="${L.face === 'long' || L.face === 'oval' ? 79.5 : 81.5}" cy="40" r="${earR}" fill="${skin}"/><circle cx="${L.face === 'long' || L.face === 'oval' ? 44.5 : 42.5}" cy="40" r="${earR * .5}" fill="${dark}"/><circle cx="${L.face === 'long' || L.face === 'oval' ? 79.5 : 81.5}" cy="40" r="${earR * .5}" fill="${dark}"/>`;
  const eye = (x) => ({
    dots: `<circle cx="${x}" cy="38" r="2.2" fill="${ink}"/>`,
    round: `<circle cx="${x}" cy="38" r="3.4" fill="#fff"/><circle cx="${x + .5}" cy="38.3" r="2.1" fill="${L.eyeCol}"/><circle cx="${x + .5}" cy="38.3" r="1" fill="#111"/>`,
    almond: `<path d="M${x - 4} 38 Q${x} 34.5 ${x + 4} 38 Q${x} 41 ${x - 4} 38Z" fill="#fff"/><circle cx="${x + .3}" cy="38" r="1.8" fill="${L.eyeCol}"/><circle cx="${x + .3}" cy="38" r=".8" fill="#111"/>`,
    wide: `<ellipse cx="${x}" cy="38" rx="4" ry="4.4" fill="#fff"/><circle cx="${x + .6}" cy="38.6" r="2.7" fill="${L.eyeCol}"/><circle cx="${x + .6}" cy="38.6" r="1.3" fill="#111"/><circle cx="${x + 1.6}" cy="37.3" r=".8" fill="#fff"/>`,
    sleepy: `<path d="M${x - 3.6} 38 Q${x} 41.5 ${x + 3.6} 38Z" fill="#fff"/><circle cx="${x}" cy="38.8" r="1.6" fill="${L.eyeCol}"/><path d="M${x - 4} 37.6 L${x + 4} 37.6" stroke="${ink}" stroke-width="1.4"/>`,
    narrow: `<path d="M${x - 4} 38 Q${x} 36.4 ${x + 4} 38 Q${x} 39.6 ${x - 4} 38Z" fill="#fff"/><circle cx="${x}" cy="38" r="1.3" fill="${L.eyeCol}"/>`,
  }[L.eyes]);
  const browW = { thick: 3.2, thin: 1.2, none: 1, straight: 2, arched: 2, angled: 2.2 }[L.brows];
  const browCol = L.brows === 'none' ? shade(hairC, 1.3) : hairC;
  let brows = { straight: 'M50 32.5 L59 32.5 M65 32.5 L74 32.5', arched: 'M50 33.5 Q54.5 29.5 59 32.5 M65 32.5 Q69.5 29.5 74 33.5', thick: 'M50 32.5 Q54.5 31 59 32.5 M65 32.5 Q69.5 31 74 32.5', thin: 'M51 32.5 Q54.5 31 58 32.5 M66 32.5 Q69.5 31 73 32.5', angled: 'M50 31.5 L59 33.5 M65 33.5 L74 31.5', none: 'M51 32.5 L58 32.5 M66 32.5 L73 32.5' }[L.brows];
  let mouth = {
    smile: `<path d="M56 48 Q62 52.5 68 48" fill="none" stroke="#5a3825" stroke-width="2" stroke-linecap="round"/>`,
    neutral: `<path d="M57 49 L67 49" stroke="#5a3825" stroke-width="2" stroke-linecap="round"/>`,
    smirk: `<path d="M56 49.5 Q63 50.5 68.5 46.5" fill="none" stroke="#5a3825" stroke-width="2" stroke-linecap="round"/>`,
    open: `<path d="M55 47 Q62 55 69 47Z" fill="#fff" stroke="#5a3825" stroke-width="1.6"/><path d="M57.5 50.5 Q62 53 66.5 50.5" fill="#e8838b"/>`,
    braces: `<path d="M55 47 Q62 54 69 47Z" fill="#fff" stroke="#5a3825" stroke-width="1.6"/><path d="M56.5 48.6 L67.5 48.6" stroke="#868e96" stroke-width="1.2"/>${[58, 61, 64, 67].map(x => `<rect x="${x - .7}" y="47.9" width="1.4" height="1.4" fill="#adb5bd"/>`).join('')}`,
    small: `<path d="M59 48.5 Q62 50.5 65 48.5" fill="none" stroke="#5a3825" stroke-width="1.8" stroke-linecap="round"/>`,
  }[L.mouth];
  // bought expressions
  if (ex === 'f_focus') { brows = 'M50 31 L59 33.5 M74 31 L65 33.5'; mouth = `<path d="M57 49 L67 49" stroke="#5a3825" stroke-width="2" stroke-linecap="round"/>`; }
  if (ex === 'f_grin') mouth = `<path d="M54 46 Q62 56 70 46Z" fill="#fff" stroke="#5a3825" stroke-width="1.6"/><path d="M54.5 46.5 L69.5 46.5" stroke="#5a3825" stroke-width="1"/>`;
  if (ex === 'f_fierce') { brows = 'M49 30 L59 34.5 M75 30 L65 34.5'; mouth = `<path d="M56 50.5 Q62 46.5 68 50.5" fill="none" stroke="#5a3825" stroke-width="2.2" stroke-linecap="round"/>`; }
  const nose = { small: `<path d="M62 40 Q63.5 43.5 61 44" fill="none" stroke="${dark}" stroke-width="1.6" stroke-linecap="round"/>`, button: `<circle cx="62" cy="43" r="2.2" fill="${dark}"/>`,
    long: `<path d="M62 37 L63.6 45 L60.6 45" fill="none" stroke="${dark}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`, wide: `<path d="M58.5 44 Q62 46.5 65.5 44" fill="none" stroke="${dark}" stroke-width="1.8" stroke-linecap="round"/><circle cx="59" cy="43.5" r="1" fill="${dark}"/><circle cx="65" cy="43.5" r="1" fill="${dark}"/>`,
    pointed: `<path d="M62 38 L65 44 L61.5 44.5" fill="none" stroke="${dark}" stroke-width="1.6" stroke-linejoin="round"/>` }[L.nose];
  const beard = { none: '', stubble: `<path d="M45 44 Q47 58 62 60 Q77 58 79 44 Q76 54 62 55 Q48 54 45 44Z" fill="${hairC}" opacity=".28"/>`,
    moustache: `<path d="M55.5 46.3 Q59 44 62 45.5 Q65 44 68.5 46.3 Q65 47.6 62 46.6 Q59 47.6 55.5 46.3Z" fill="${hairC}"/>`,
    goatee: `<path d="M57 52 Q62 60 67 52 Q62 55 57 52Z" fill="${hairC}"/><path d="M56 46.3 Q62 44.3 68 46.3 Q62 47.6 56 46.3Z" fill="${hairC}"/>`,
    full: `<path d="M44 40 Q44 60 62 61 Q80 60 80 40 Q78 52 70 51 Q62 47 54 51 Q46 52 44 40Z" fill="${hairC}"/>` }[L.beard];
  const extra = { none: '', freckles: [[52, 43], [54.5, 45], [50.5, 45.5], [72, 43], [69.5, 45], [73.5, 45.5], [57, 42.5], [67, 42.5]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".7" fill="${shade(skin, .62)}"/>`).join(''),
    blush: `<ellipse cx="51" cy="45" rx="3.6" ry="2" fill="#ff8787" opacity=".45"/><ellipse cx="73" cy="45" rx="3.6" ry="2" fill="#ff8787" opacity=".45"/>`, mole: `<circle cx="69" cy="47" r=".9" fill="#4a2f1b"/>`,
    scar: `<path d="M71 31 L74 39" stroke="${shade(skin, .7)}" stroke-width="1.2"/><path d="M71.4 33.4 L73.6 33 M72 35.6 L74.2 35.2" stroke="${shade(skin, .7)}" stroke-width=".8"/>`,
    dimples: `<path d="M53.5 47 q.6 1.4 1.6 1.2 M70.5 47 q-.6 1.4 -1.6 1.2" fill="none" stroke="${dark}" stroke-width="1"/>` }[L.extras];
  const glasses = { none: '', rect: `<g fill="rgba(255,255,255,.18)" stroke="#212529" stroke-width="1.6"><rect x="49" y="34" width="11" height="8" rx="2"/><rect x="64" y="34" width="11" height="8" rx="2"/></g><path d="M60 37 L64 37 M49 37 L44 36 M75 37 L80 36" stroke="#212529" stroke-width="1.4"/>`,
    round: `<g fill="rgba(255,255,255,.18)" stroke="#8a5a2e" stroke-width="1.6"><circle cx="55" cy="38" r="5"/><circle cx="69" cy="38" r="5"/></g><path d="M60 37.5 Q62 36 64 37.5 M50 37 L44 36 M74 37 L80 36" fill="none" stroke="#8a5a2e" stroke-width="1.4"/>`,
    thick: `<g fill="rgba(255,255,255,.15)" stroke="#111" stroke-width="2.8"><rect x="48.5" y="33.5" width="12" height="9" rx="3"/><rect x="63.5" y="33.5" width="12" height="9" rx="3"/></g><path d="M60.5 37 L63.5 37" stroke="#111" stroke-width="2.4"/>`,
    rimless: `<g fill="rgba(200,230,255,.25)" stroke="#adb5bd" stroke-width=".9"><rect x="49" y="34.5" width="11" height="7.5" rx="3"/><rect x="64" y="34.5" width="11" height="7.5" rx="3"/></g><path d="M60 37 L64 37" stroke="#adb5bd" stroke-width="1"/>` }[L.glasses];
  const ex1 = L.face === 'long' || L.face === 'oval' ? 44.5 : 42.5, ex2 = 124 - ex1, ey = 40 + earR * .8;
  const stud = x => `<circle cx="${x}" cy="${ey}" r="1.3" fill="#fcc419" stroke="#e67700" stroke-width=".4"/>`, hoop = x => `<circle cx="${x}" cy="${ey + 2}" r="2.4" fill="none" stroke="#fcc419" stroke-width="1"/>`;
  const earrings = { none: '', stud: stud(ex2), studs: stud(ex1) + stud(ex2), hoop: hoop(ex2), hoops: hoop(ex1) + hoop(ex2) }[L.earrings] || '';
  const browCut = { none: '', one: `<path d="M71 30.5 L70 34.5" stroke="${skin}" stroke-width="1.1"/>`, two: `<path d="M70 30.5 L69 34.5 M72.4 30.5 L71.4 34.5" stroke="${skin}" stroke-width="1"/>` }[L.browCut] || '';
  const burns = { none: '', short: 4, long: 9 }[L.sideburns];
  const sideburns = burns ? `<path d="M${hl + 1.2} 34 L${hl + 1.6} ${34 + burns} L${hl + 4} ${34 + burns} L${hl + 4} 33Z M${hr - 1.2} 34 L${hr - 1.6} ${34 + burns} L${hr - 4} ${34 + burns} L${hr - 4} 33Z" fill="${hairC}"/>` : '';
  const lashes = L.lashes === 'lashes' ? [55, 69].map(x => `<path d="M${x - 3.6} 36.2 l-1.4 -1.4 M${x - 1.2} 35 l-.6 -1.8 M${x + 1.2} 35 l.6 -1.8 M${x + 3.6} 36.2 l1.4 -1.4" stroke="${ink}" stroke-width=".8" stroke-linecap="round"/>`).join('') : '';
  const faces = `${sideburns}${eye(55)}${eye(69)}${lashes}<path d="${brows}" fill="none" stroke="${browCol}" stroke-width="${browW}" stroke-linecap="round"/>${browCut}${nose}${extra}${beard}${mouth}${glasses}`;
  const bw = { slim: .88, regular: 1, athletic: 1.08, broad: 1.18 }[L.build] || 1, armDx = (bw - 1) * 20;
  const hat = {
    hat_band: '<rect x="43" y="27" width="38" height="6" rx="3" fill="#e03131"/>',
    hat_cap: `<path d="M43 30 Q44 13 62 13 Q80 13 81 30Z" fill="${kit}"/><path d="M78 29 L96 31 L80 33Z" fill="${kit}"/><circle cx="62" cy="14" r="2" fill="${light}"/>`,
    hat_backcap: `<path d="M43 30 Q44 13 62 13 Q80 13 81 30Z" fill="${kit}"/><path d="M46 29 L30 31 L44 33Z" fill="${kit}"/>`,
    hat_beanie: `<path d="M42 32 Q42 10 62 10 Q82 10 82 32Z" fill="#364fc7"/><rect x="41" y="28" width="42" height="7" rx="3" fill="#4c6ef5"/><circle cx="62" cy="8" r="5" fill="#dbe4ff"/>`,
    hat_phones: `<path d="M42 38 Q42 14 62 14 Q82 14 82 38" fill="none" stroke="#212529" stroke-width="4"/><rect x="37" y="32" width="9" height="15" rx="4" fill="${kit}"/><rect x="78" y="32" width="9" height="15" rx="4" fill="${kit}"/>`,
    hat_bucket: '<path d="M46 28 Q47 13 62 13 Q77 13 78 28Z" fill="#e9ecef"/><path d="M38 30 Q62 22 86 30 L82 34 Q62 28 42 34Z" fill="#dee2e6" stroke="#adb5bd"/>',
    hat_party: '<path d="M52 22 L62 -2 L72 22Z" fill="#f06595" stroke="#fff" stroke-width="1.5"/><circle cx="62" cy="-2" r="3" fill="#fcc419"/>',
    hat_viking: '<path d="M42 30 Q42 12 62 12 Q82 12 82 30Z" fill="#868e96"/><path d="M43 24 Q30 18 32 4 Q38 16 46 18Z" fill="#f8f9fa"/><path d="M81 24 Q94 18 92 4 Q86 16 78 18Z" fill="#f8f9fa"/><rect x="42" y="26" width="40" height="5" fill="#495057"/>',
    hat_halo: '<ellipse cx="62" cy="6" rx="16" ry="4" fill="none" stroke="#fcc419" stroke-width="3" class="halo"/>',
    hat_horns: '<path d="M46 22 Q40 10 44 4 Q48 14 52 18Z" fill="#e03131"/><path d="M78 22 Q84 10 80 4 Q76 14 72 18Z" fill="#e03131"/>',
    hat_snap: `<path d="M42.5 30 Q43 12 62 12 Q81 12 81.5 30Z" fill="#212529"/><rect x="40" y="28" width="58" height="4" rx="1.5" fill="#212529"/><rect x="55" y="16" width="14" height="7" rx="1.5" fill="${kit}"/><path d="M58 19.5 L66 19.5" stroke="#fff" stroke-width="1.2"/>`,
    hat_durag: '<path d="M41 34 Q41 11 62 11 Q83 11 83 34 Q74 30 62 30 Q50 30 41 34Z" fill="#212529"/><path d="M42 33 L36 52 L42 50 L44 36Z" fill="#212529"/><path d="M50 14 Q62 22 74 14" stroke="#495057" stroke-width="1.2" fill="none"/>',
    hat_bandana: '<path d="M41.5 31 Q42 12 62 12 Q82 12 82.5 31 Q62 26 41.5 31Z" fill="#c92a2a"/><g fill="#fff" opacity=".8"><circle cx="52" cy="20" r="1.2"/><circle cx="62" cy="17" r="1.2"/><circle cx="72" cy="20" r="1.2"/><circle cx="57" cy="25" r="1"/><circle cx="67" cy="25" r="1"/></g><path d="M82 28 L90 24 L88 33Z" fill="#c92a2a"/>',
    hat_beret: '<ellipse cx="58" cy="19" rx="21" ry="8" fill="#862e9c"/><path d="M42 24 Q60 30 80 22" stroke="#5f3dc4" stroke-width="2.4" fill="none"/><path d="M58 11 L59 7" stroke="#862e9c" stroke-width="2"/>',
    hat_flowers: '<path d="M42 26 Q62 18 82 26" stroke="#2f9e44" stroke-width="2" fill="none"/>' + [[44, 25, '#f06595'], [51, 21.5, '#fcc419'], [58, 19.8, '#ff8787'], [66, 19.8, '#cc5de8'], [73, 21.5, '#fcc419'], [80, 25, '#f06595']].map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="3.4" fill="${c}"/><circle cx="${x}" cy="${y}" r="1.2" fill="#fff3bf"/>`).join(''),
    hat_helmet: `<path d="M40 31 Q40 9 62 9 Q84 9 84 31 Z" fill="${kit}" stroke="#212529" stroke-width="1.2"/><path d="M48 13 L52 29 M58 10 L59 29 M66 10 L65 29 M76 13 L72 29" stroke="rgba(0,0,0,.35)" stroke-width="2"/><path d="M42 31 L46 44 M82 31 L78 44" stroke="#212529" stroke-width="1.2"/>`,
    hat_cowboy: '<path d="M44 27 Q45 7 62 7 Q79 7 80 27Z" fill="#8b5a2b"/><path d="M57 8 Q62 14 67 8" stroke="#6b4423" stroke-width="2" fill="none"/><rect x="44" y="21" width="36" height="4" fill="#3b2416"/><path d="M26 25 Q30 34 44 30 L80 30 Q94 34 98 25 Q90 30 80 27 L44 27 Q34 30 26 25Z" fill="#8b5a2b" stroke="#6b4423"/>',
    hat_tophat: '<rect x="48" y="-8" width="28" height="32" rx="2" fill="#212529"/><rect x="48" y="15" width="28" height="5" fill="#c92a2a"/><ellipse cx="62" cy="25" rx="22" ry="4" fill="#212529"/><path d="M51 -6 L51 13" stroke="#495057" stroke-width="2"/>',
    hat_wizard: '<path d="M42 27 L56 18 Q60 0 76 -10 Q66 4 70 18 L82 27Z" fill="#5f3dc4"/><ellipse cx="62" cy="27" rx="22" ry="4.5" fill="#5f3dc4" stroke="#3b2a6b"/><g fill="#fcc419"><circle cx="62" cy="14" r="1.6"/><circle cx="68" cy="6" r="1.2"/><circle cx="57" cy="22" r="1.1"/><path d="M66 18 l1 2 l2 .3 l-1.5 1.4 l.4 2 l-1.9 -1 l-1.9 1 l.4 -2 l-1.5 -1.4 l2 -.3Z"/></g>',
    hat_beta: '<path d="M43 30 Q44 13 62 13 Q80 13 81 30Z" fill="#7048e8"/><path d="M78 29 L96 31 L80 33Z" fill="#5f3dc4"/><circle cx="62" cy="21" r="5.5" fill="#4dabf7"/><text x="62" y="24.5" text-anchor="middle" font-size="9" font-weight="900" fill="#fff">β</text>',
    hat_crown: '<path d="M46 22 L48 8 L55 16 L62 4 L69 16 L76 8 L78 22Z" fill="#fcc419" stroke="#e67700" stroke-width="1.5"/><circle cx="62" cy="15" r="2.5" fill="#e03131"/>',
  }[spec.hat] || '';
  const eyes = {
    eye_sport: '<path d="M48 34 Q62 30 76 34 L75 41 Q69 44 63 40 Q61 39 59 40 Q53 44 49 41Z" fill="#1c7ed6" opacity=".9"/><path d="M50 35 Q60 32 70 34" stroke="#a5d8ff" stroke-width="1.5" fill="none"/>',
    eye_aviator: '<ellipse cx="55" cy="39" rx="6.5" ry="5" fill="#343a40" stroke="#fcc419" stroke-width="1.4"/><ellipse cx="69" cy="39" rx="6.5" ry="5" fill="#343a40" stroke="#fcc419" stroke-width="1.4"/><path d="M61 38 L63 38" stroke="#fcc419" stroke-width="1.4"/>',
    eye_goggles: '<path d="M42 38 L82 38" stroke="#212529" stroke-width="2"/><circle cx="55" cy="38" r="6" fill="#74c0fc" stroke="#1971c2" stroke-width="2"/><circle cx="69" cy="38" r="6" fill="#74c0fc" stroke="#1971c2" stroke-width="2"/>',
    eye_nerd: '<rect x="48" y="33" width="12" height="10" rx="2" fill="rgba(255,255,255,.2)" stroke="#212529" stroke-width="2"/><rect x="64" y="33" width="12" height="10" rx="2" fill="rgba(255,255,255,.2)" stroke="#212529" stroke-width="2"/><path d="M60 37 L64 37" stroke="#212529" stroke-width="2"/>',
    eye_star: '<g fill="#f06595" stroke="#fff" stroke-width=".8"><path d="M55 31 L57 36 L62 36 L58 39 L60 44 L55 41 L50 44 L52 39 L48 36 L53 36Z"/><path d="M69 31 L71 36 L76 36 L72 39 L74 44 L69 41 L64 44 L66 39 L62 36 L67 36Z"/></g>',
    eye_laser: '<g class="laser"><circle cx="55" cy="38" r="3.5" fill="#ff0000"/><circle cx="69" cy="38" r="3.5" fill="#ff0000"/><path d="M55 38 L124 30 M69 38 L124 46" stroke="#ff4d4d" stroke-width="2.5" opacity=".85"/></g>',
    eye_3d: '<rect x="48" y="34" width="12" height="8.5" rx="1.5" fill="#fa5252" opacity=".85" stroke="#f8f9fa" stroke-width="1.6"/><rect x="64" y="34" width="12" height="8.5" rx="1.5" fill="#339af0" opacity=".85" stroke="#f8f9fa" stroke-width="1.6"/><path d="M60 37 L64 37 M48 37 L43 36 M76 37 L81 36" stroke="#f8f9fa" stroke-width="1.6"/>',
    eye_mono: '<circle cx="69" cy="38" r="5.5" fill="rgba(255,255,255,.2)" stroke="#e67700" stroke-width="1.8"/><path d="M73 42 Q76 52 72 62" stroke="#e67700" stroke-width=".9" fill="none"/>',
    eye_ski: '<path d="M41 37 L83 37" stroke="#212529" stroke-width="3"/><rect x="46" y="31" width="32" height="13" rx="6.5" fill="url(#skiG)" stroke="#f8f9fa" stroke-width="1.6"/>',
    eye_heart: '<g fill="#e64980" stroke="#fff" stroke-width=".8"><path d="M55 44 L49.5 38.5 Q48 34 51.5 33.5 Q54 33.3 55 36 Q56 33.3 58.5 33.5 Q62 34 60.5 38.5Z"/><path d="M69 44 L63.5 38.5 Q62 34 65.5 33.5 Q68 33.3 69 36 Q70 33.3 72.5 33.5 Q76 34 74.5 38.5Z"/></g><path d="M61 37 L63 37" stroke="#e64980" stroke-width="1.2"/>',
    eye_visor: '<path d="M44 34 Q62 30 80 34 L80 41 Q62 45 44 41Z" fill="#3bc9db" opacity=".88" stroke="#0b7285"/><path d="M47 36 L77 36" stroke="#e3fafc" stroke-width="1"/>',
    eye_vr: '<path d="M41 36 L83 36" stroke="#212529" stroke-width="3"/><rect x="44" y="30.5" width="36" height="14" rx="5" fill="#212529"/><rect x="46" y="32.5" width="32" height="10" rx="4" fill="#343a40"/><circle cx="74" cy="37.5" r="1.3" fill="#40c057"/>',
    eye_paint: '<rect x="50" y="42" width="9" height="3" rx="1.5" fill="#212529"/><rect x="65" y="42" width="9" height="3" rx="1.5" fill="#212529"/>',
  }[spec.eyes] || '';
  const back = {
    x_cape: `<path d="M44 62 Q30 110 38 132 L86 132 Q94 110 80 62Z" fill="#e03131" opacity=".95"/>`,
    x_wings: '<g fill="#fff" stroke="#adb5bd" stroke-width="1.5"><path d="M46 70 Q14 52 8 74 Q22 74 14 88 Q30 84 28 98 Q40 86 48 82Z"/><path d="M78 70 Q110 52 116 74 Q102 74 110 88 Q94 84 96 98 Q84 86 76 82Z"/></g>',
    x_sparkle: '<g class="sparkles" fill="#fcc419">' + [[20, 40], [100, 30], [14, 100], [108, 96], [30, 140], [96, 150]].map(([x, y]) => `<path d="M${x} ${y - 7} L${x + 2} ${y - 2} L${x + 7} ${y} L${x + 2} ${y + 2} L${x} ${y + 7} L${x - 2} ${y + 2} L${x - 7} ${y} L${x - 2} ${y - 2}Z"/>`).join('') + '</g>',
    x_jetpack: '<rect x="33" y="64" width="13" height="36" rx="6" fill="#adb5bd" stroke="#495057"/><rect x="78" y="64" width="13" height="36" rx="6" fill="#adb5bd" stroke="#495057"/><g class="jetflame"><path d="M35 100 L39.5 118 L44 100Z M80 100 L84.5 118 L89 100Z" fill="#ff922b"/><path d="M37 100 L39.5 110 L42 100Z M82 100 L84.5 110 L87 100Z" fill="#ffd43b"/></g>',
    x_backpack: '<rect x="36" y="64" width="52" height="42" rx="9" fill="#1c7ed6"/><rect x="40" y="94" width="44" height="10" rx="4" fill="#1864ab"/>',
    x_aura: '<g class="aura"><ellipse cx="62" cy="96" rx="44" ry="66" fill="url(#auraG)"/></g>',
  }[spec.extra] || '';
  const front = { x_chain: '<path d="M50 64 Q62 80 74 64" fill="none" stroke="#fcc419" stroke-width="3"/><circle cx="62" cy="76" r="4" fill="#fcc419"/>', x_medal: '<path d="M56 62 L62 74 L68 62" fill="none" stroke="#1c7ed6" stroke-width="3"/><circle cx="62" cy="79" r="6" fill="#fcc419" stroke="#e67700" stroke-width="1.5"/>',
    x_backpack: '<path d="M49 64 L47 100 M75 64 L77 100" stroke="#1864ab" stroke-width="3.2" stroke-linecap="round"/>',
    x_guitar: '<g transform="rotate(-38 62 92)"><rect x="60" y="50" width="4" height="40" fill="#6b4423"/><rect x="58.5" y="46" width="7" height="6" rx="1" fill="#3b2416"/><ellipse cx="62" cy="96" rx="10" ry="8.5" fill="#e8590c"/><ellipse cx="62" cy="106" rx="12.5" ry="10" fill="#e8590c"/><circle cx="62" cy="99" r="3.4" fill="#3b2416"/><path d="M61 52 L61 104 M63 52 L63 104" stroke="#f1f3f5" stroke-width=".4"/></g>' }[spec.extra] || '';
  const pat = (cos(spec.kit) || {}).pattern;
  const pattern = pat === 'stripes' ? [50, 58, 66, 74].map(x => `<rect x="${x}" y="58" width="4" height="60" fill="#fff" opacity=".85"/>`).join('')
    : pat === 'hoops' ? [72, 86, 100].map(y => `<rect x="40" y="${y}" width="44" height="7" fill="#fff" opacity=".9"/>`).join('')
    : pat === 'camo' ? '<g opacity=".7"><ellipse cx="52" cy="78" rx="7" ry="4" fill="#3d4a26"/><ellipse cx="70" cy="90" rx="8" ry="5" fill="#8a7a4a"/><ellipse cx="56" cy="104" rx="9" ry="4" fill="#2f3a1c"/><ellipse cx="74" cy="72" rx="5" ry="3" fill="#8a7a4a"/></g>'
    : pat === 'rainbow' ? ['#fa5252', '#fd7e14', '#fcc419', '#40c057', '#228be6', '#7048e8'].map((c, k) => `<rect x="40" y="${60 + k * 9}" width="44" height="9" fill="${c}"/>`).join('')
    : pat === 'flames' ? '<path d="M40 118 L40 92 Q45 102 48 88 Q52 100 56 82 Q60 98 64 84 Q68 100 72 86 Q76 102 80 90 Q82 100 84 94 L84 118Z" fill="#ff6b00"/><path d="M40 118 L42 102 Q47 108 50 98 Q55 106 58 96 Q62 106 66 96 Q70 106 74 98 Q78 108 82 102 L84 118Z" fill="#ffd43b"/>'
    : pat === 'checker' ? Array.from({ length: 48 }, (_, k) => (k + Math.floor(k / 6)) % 2 ? `<rect x="${40 + (k % 6) * 7.4}" y="${58 + Math.floor(k / 6) * 7.6}" width="7.4" height="7.6" fill="#f8f9fa"/>` : '').join('')
    : pat === 'galaxy' ? '<ellipse cx="58" cy="84" rx="16" ry="7" fill="#7048e8" opacity=".55" transform="rotate(-20 58 84)"/><ellipse cx="68" cy="100" rx="12" ry="5" fill="#e64980" opacity=".4" transform="rotate(15 68 100)"/>' + [[48, 70], [72, 74], [56, 92], [76, 88], [52, 108], [66, 112], [62, 80], [46, 96]].map(([x, y], k) => `<circle cx="${x}" cy="${y}" r="${k % 3 ? .9 : 1.5}" fill="#fff"/>`).join('')
    : pat === 'beta' ? '<rect x="40" y="66" width="44" height="7" fill="#4dabf7"/><rect x="40" y="73" width="44" height="2" fill="#fff" opacity=".8"/>'
    : pat === 'dev' ? '<path d="M53 62 L56 74 M71 62 L68 74" stroke="#495057" stroke-width="1.6"/><text x="62" y="84" text-anchor="middle" font-size="8" font-family="monospace" font-weight="900" fill="#69db7c">&lt;/&gt;</text>' : '';
  const flip = face === 'left' ? ' transform="translate(124 0) scale(-1 1)"' : '';
  return `<svg class="avatar ${cls}" viewBox="0 0 124 170" width="${size * 124 / 170}" height="${size}" aria-hidden="true"><defs><clipPath id="bodyClip"><path d="M44 66 Q62 58 80 66 L82 116 L42 116Z"/></clipPath><linearGradient id="skiG" x1="0" x2="1"><stop offset="0" stop-color="#ff922b"/><stop offset=".5" stop-color="#f06595"/><stop offset="1" stop-color="#845ef7"/></linearGradient><radialGradient id="auraG"><stop offset="0" stop-color="#ffd43b" stop-opacity=".9"/><stop offset=".6" stop-color="#ff6b00" stop-opacity=".45"/><stop offset="1" stop-color="#ff6b00" stop-opacity="0"/></radialGradient></defs>
    <g${flip}><g class="av">${back}
    <g class="legL"><rect x="49" y="112" width="11" height="40" rx="5" fill="${skin}"/><rect x="48" y="112" width="13" height="16" rx="4" fill="#343a40"/><path d="M44 152 Q46 146 54 147 L62 148 L62 156 L44 156Z" fill="${shoe}" stroke="#868e96" stroke-width="1"/></g>
    <g class="legR"><rect x="64" y="112" width="11" height="40" rx="5" fill="${skin}"/><rect x="63" y="112" width="13" height="16" rx="4" fill="#343a40"/><path d="M62 152 Q64 146 72 147 L80 148 L80 156 L62 156Z" fill="${shoe}" stroke="#868e96" stroke-width="1"/></g>
    <g class="body"><g transform="translate(62 0) scale(${bw} 1) translate(-62 0)"><path d="M44 66 Q62 58 80 66 L82 116 L42 116Z" fill="${kit}"/>${pattern ? `<g clip-path="url(#bodyClip)">${pattern}</g>` : ''}</g><text x="62" y="102" text-anchor="middle" font-size="20" font-weight="900" fill="${light}">${esc(spec.no)}</text>${front}</g>
    <g class="armL" transform="translate(${-armDx} 0)"><rect x="34" y="66" width="11" height="40" rx="5.5" fill="${skin}"/><rect x="33" y="64" width="13" height="14" rx="5" fill="${kit}"/></g>
    <g class="armR" transform="translate(${armDx} 0)"><rect x="79" y="66" width="11" height="40" rx="5.5" fill="${skin}"/><rect x="78" y="64" width="13" height="14" rx="5" fill="${kit}"/></g>
    ${{ x_ball: '<ellipse cx="92" cy="100" rx="12" ry="8" fill="#c2410c" stroke="#7c2d12" stroke-width="1.5" transform="rotate(-25 92 100)"/><path d="M86 100 L98 100" stroke="#fff" stroke-width="1.4" transform="rotate(-25 92 100)"/>', x_trophy: '<g transform="translate(84 80)"><path d="M2 0 L22 0 L20 14 Q12 22 4 14Z" fill="#fcc419" stroke="#e67700"/><rect x="9" y="18" width="6" height="8" fill="#e67700"/><rect x="4" y="26" width="16" height="5" fill="#495057"/></g>', x_books: '<g transform="translate(80 92)"><rect width="22" height="6" fill="#e03131"/><rect y="6" x="2" width="20" height="6" fill="#1c7ed6"/><rect y="12" width="22" height="6" fill="#2f9e44"/></g>',
      x_skate: '<g transform="rotate(-68 96 100)"><rect x="74" y="95" width="46" height="8" rx="4" fill="#e64980" stroke="#a61e4d"/><circle cx="82" cy="105" r="3" fill="#fcc419"/><circle cx="112" cy="105" r="3" fill="#fcc419"/></g>',
      x_laptop: '<g transform="translate(76 90)"><rect width="26" height="17" rx="2" fill="#343a40"/><rect x="2" y="2" width="22" height="13" fill="#0b1a3a"/><text x="13" y="11.5" text-anchor="middle" font-size="7" font-family="monospace" font-weight="700" fill="#69db7c">&lt;/&gt;</text><rect x="-3" y="17" width="32" height="3" rx="1" fill="#868e96"/></g>' }[spec.extra] || ''}
    <g class="head">${H.back}<rect x="57" y="52" width="10" height="10" fill="${skin}"/>${ears}${earrings}${headShape}${faces}${H.cap}${H.top}${eyes}${hat ? `<g transform="${hatFit}">${hat}</g>` : ''}</g>
    </g></g></svg>`;
}
const BG_CSS = {
  bg_none: '', bg_sunset: 'linear-gradient(180deg,#ff922b,#f06595 60%,#845ef7)',
  bg_track: 'repeating-linear-gradient(0deg,#c2410c 0 18px,#fff 18px 20px)', bg_oval: 'radial-gradient(ellipse at 50% 120%,#2f9e44 40%,#69db7c 41%,#2f9e44 42%,#37b24d 70%,#74c0fc 71%)',
  bg_galaxy: 'radial-gradient(circle at 30% 30%,#fff 0 1px,transparent 2px) 0 0/24px 24px, radial-gradient(circle at 70% 60%,#ffd8a8 0 1px,transparent 2px) 0 0/31px 31px, linear-gradient(160deg,#1b1240,#3b1f6b 50%,#0b1a3a)',
  bg_beach: 'linear-gradient(180deg,#74c0fc 55%,#ffe8a3 56%)', bg_snow: 'linear-gradient(160deg,#e7f5ff,#a5d8ff 50%,#fff 51%)',
  bg_everest: 'linear-gradient(180deg,#1c3d6e,#4a7ab8 45%,#fff 46%,#dbe4ff)', bg_neon: 'linear-gradient(180deg,#12002f,#3a0ca3 60%,#f72585)',
  bg_gold: 'radial-gradient(circle,#fff3bf,#fcc419 50%,#e67700)',
  bg_fire: 'radial-gradient(ellipse at 50% 120%,#ffd43b,#ff6b00 40%,#c92a2a 70%,#2b0505)',
  bg_ocean: 'radial-gradient(circle at 25% 30%,rgba(255,255,255,.5) 0 2px,transparent 3px) 0 0/40px 50px, linear-gradient(180deg,#74c0fc,#1c7ed6 50%,#0b3d6e)',
  bg_night: 'radial-gradient(ellipse at 20% 0,rgba(255,255,255,.7),transparent 25%), radial-gradient(ellipse at 80% 0,rgba(255,255,255,.7),transparent 25%), linear-gradient(180deg,#0b1026,#1b2a6b 60%,#2b8a3e 61%,#237032)',
  bg_volcano: 'radial-gradient(ellipse at 50% 100%,#ffd43b,#ff6b00 25%,transparent 45%), linear-gradient(180deg,#2b0a0a,#5c1a0a 55%,#1a0505)',
  bg_aurora: 'radial-gradient(ellipse at 30% 20%,rgba(105,219,124,.7),transparent 45%), radial-gradient(ellipse at 70% 30%,rgba(151,117,250,.6),transparent 45%), linear-gradient(180deg,#06141f,#0b2a3a 60%,#e7f5ff 61%,#d0ebff)',
};
const petHtml = (id, size = 30) => { const p = cos(id); return p && p.e ? `<span class="avpet" style="font-size:${size}px">${p.e}</span>` : ''; };
const avatarBadge = (spec, size = 64) => `<span class="avbadge" style="background:${BG_CSS[spec.bg] || 'var(--panel2)'}">${avatarFull(spec, { size })}${petHtml(spec.pet, size / 4)}</span>`;

function lookEditor() {
  const L = myLook(), spec = { ...avatarSpec(), hat: 'hat_none', eyes: 'eye_none', face: 'f_smile' };
  const row = (k, label) => `<div class="lookrow"><span class="lklabel">${label}</span><div class="lkopts">${LOOK_OPTS[k].map(([v, n]) => `<button class="lkopt ${L[k] === v ? 'on' : ''}" data-act="setLook" data-k="${k}" data-v="${v}"><span class="lkface">${avatarFace({ ...spec, look: { ...L, [k]: v } })}</span>${n}</button>`).join('')}</div></div>`;
  const sw = (k, label, custom) => `<div class="lookrow"><span class="lklabel">${label}</span><div class="lkopts">${LOOK_OPTS[k].map(c => `<button class="lksw ${L[k] === c ? 'on' : ''}" style="background:${c}" data-act="setLook" data-k="${k}" data-v="${c}" title="${c}"></button>`).join('')}
    <label class="lksw custom" title="Pick any colour"><input type="color" data-change="lookColor" data-k="${k}" value="${L[k] || (k === 'hairC' ? '#5c3a21' : k === 'skinC' ? '#f1c9a5' : '#6b4423')}">🎨</label></div></div>`;
  return `<div class="lookeditor"><p class="muted small-text" style="margin-top:0">All free. Make your athlete look like you.</p>
    ${sw('skinC', 'Skin')}${sw('hairC', 'Hair colour')}${sw('eyeCol', 'Eye colour')}
    ${row('face', 'Face shape')}${row('eyes', 'Eyes')}${row('brows', 'Eyebrows')}${row('nose', 'Nose')}${row('mouth', 'Mouth')}${row('ears', 'Ears')}
    ${row('beard', 'Facial hair')}${row('sideburns', 'Sideburns')}${row('extras', 'Details')}${row('lashes', 'Eyelashes')}${row('browCut', 'Eyebrow slit')}${row('earrings', 'Earrings')}${row('glasses', 'Glasses')}
    <div class="lookrow"><span class="lklabel">Build</span><div class="lkopts">${LOOK_OPTS.build.map(([v, n]) => `<button class="lkopt ${L.build === v ? 'on' : ''}" data-act="setLook" data-k="build" data-v="${v}">${n}</button>`).join('')}</div></div>
    <div class="lookrow"><span class="lklabel">Height</span><div class="lkopts">${LOOK_OPTS.height.map(([v, n]) => `<button class="lkopt ${L.height === v ? 'on' : ''}" data-act="setLook" data-k="height" data-v="${v}">${n}</button>`).join('')}</div></div>
    <p class="muted small-text">Hairstyles are under <b>Hair</b>. Ginger, black, brown and blonde are free there too, or pick any colour above.</p></div>`;
}
// head-only crop of the avatar for the creator buttons
const avatarFace = spec => avatarFull(spec, { size: 150 }).replace(/viewBox="0 0 124 170"/, 'viewBox="34 4 56 60"').replace(/width="[\d.]+" height="150"/, 'width="52" height="52"');

// ---------- wardrobe page ----------
function arenaWardrobe() {
  const av = myAv(), cat = ui.wardCat || 'hair', bare = cat === 'look' && (av.hat !== 'hat_none' || av.eyes !== 'eye_none');
  const spec = { ...avatarSpec(av), ...(bare ? { hat: 'hat_none', eyes: 'eye_none' } : {}) };
  return `<div class="wardrobe"><div class="card wardprev"><div class="wardstage" id="wardStage" style="background:${BG_CSS[av.bg] || 'linear-gradient(180deg,var(--panel2),var(--panel))'}">${avatarFull(spec, { size: 260, cls: 'idle' })}${petHtml(av.pet, 56)}</div>
      <div class="row" style="justify-content:center;gap:10px;margin-top:10px"><span class="pill">${COIN} ${coins()}</span><span class="pill">${GRIT} ${grit()}</span></div>
      <p class="muted small-text" style="text-align:center">Coins come from studying, Grit from training. ${ONLINE ? '' : 'Your avatar shows on the leaderboard.'}</p>
      ${bare ? '<p class="muted small-text" style="text-align:center;margin:0 0 8px">Headwear and eyewear are hidden while you edit your look.</p>' : ''}<button class="btn small" data-act="avDance" style="display:block;margin:0 auto">💃 Test your victory dance</button></div>
    <div class="card"><div class="seg wardcats">${COS_CATS.map(([k, l]) => `<button class="${cat === k ? 'on' : ''}" data-act="wardCat" data-v="${k}">${l}</button>`).join('')}</div>
      ${cat === 'look' ? lookEditor() : ''}<div class="wardgrid">${COSMETICS.filter(c => c.cat === cat).map(c => {
        const own = ownsCos(c.id), on = av[cat] === c.id, preview = { ...spec, [cat]: c.id, ...(cat === 'kit' ? { kitC: c.id === 'kit_gear' ? avatarSpec({ ...av, kit: 'kit_gear' }).kitC : c.c } : {}) };
        const price = c.coins ? `${c.coins} ${COIN}` : `${c.grit} ${GRIT}`, can = c.coins ? coins() >= c.coins : grit() >= (c.grit || 0);
        return `<div class="wcos ${on ? 'on' : ''} ${own ? 'own' : ''}">${cat === 'bg' ? `<div class="wbg" style="background:${BG_CSS[c.id] || 'var(--panel2)'}"></div>` : cat === 'pet' ? `<div class="wbg dance">${c.e || '🚫'}</div>` : cat === 'dance' ? `<div class="wbg dance">${{ d_jump: '🦘', d_flex: '💪', d_spin: '🌀', d_flip: '🤸', d_dab: '🙆', d_moon: '🕺', d_worm: '🐛' }[c.id]}</div>` : `<div class="wmini">${avatarFull(preview, { size: 92 })}</div>`}
          <b>${esc(c.name)}</b>${!own ? `<span class="muted small-text">${c.coins ? 'study reward' : 'training reward'}</span>` : ''}${on ? '<span class="tag green">Wearing</span>' : own ? `<button class="btn small" data-act="wearCos" data-id="${c.id}">Wear</button>` : `<button class="btn small ${can ? 'primary' : ''}" data-act="buyCos" data-id="${c.id}" ${can ? '' : 'disabled'}>${price}</button>`}</div>`;
      }).join('')}</div></div></div>`;
}
