// main.js — boot, game loop, screen state machine, alarm logic, and the
// screenshot staging presets (?shot=cover|sus|vault|hide). The loop owns
// one run state and passes it to the single-job modules: levels, guards,
// detection, player, render, hud, audio, input.

import { buildLevel, LEVEL_DEFS, tileCenter } from './levels.js';
import { createGuard, resetGuard, updateGuard } from './guards.js';
import { isLit, isHidden, guardSeesPlayer, spotlightSeesPlayer, updateGuardSuspicion, updateSpotlightSuspicion, noiseAlert, maxSuspicion } from './detection.js';
import { createPlayer, resetPlayer, updatePlayer, updateFlyingCoin, updateSmoke } from './player.js';
import { drawWorld, CANVAS_W, CANVAS_H } from './render.js';
import { drawTopBar, drawRightPanel, drawBottomBar, drawTitle, drawHowTo, drawIntro, drawPause, drawLevelWin, drawGameOver, drawCampaignWin, formatTime } from './hud.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const input = createInput(canvas);
const audio = createAudio();

const state = {
  screen: 'title', // title | howto | intro | play | pause | levelwin | gameover | campaignwin
  levelIndex: 0,
  level: null,
  guards: [],
  spotlights: [],
  lasers: [],
  player: null,
  time: 0,
  score: 0,
  scoreAtLevelStart: 0,
  totalSpotted: 0,
  spotted: 0,
  strikes: 0,
  lootGot: 0,
  objectiveDone: false,
  coinsLeft: 5,
  smokeLeft: 2,
  smokeClouds: [],
  flyingCoin: null,
  message: '',
  messageTimer: 0,
  alarm: false,
  unseenTimer: 0,
  lit: false,
  noiseTimer: 0,
  frozen: false,
  buttons: [],
  audio,
  input,
  stepEvent: false,
  coinEvent: false,
  smokeEvent: false,
  pickupEvent: false,
  objectiveEvent: false,
  exitLockedEvent: false,
};

function loadLevel(index) {
  const level = buildLevel(index);
  state.levelIndex = index;
  state.level = level;
  state.guards = level.def.guards.map((def) => createGuard(def, level));
  state.spotlights = level.def.spotlights.map((def) => {
    const p = tileCenter(def.x, def.y);
    return { ...def, x: p.x, y: p.y, angle: def.baseAngle, suspicion: 0, t: 0 };
  });
  state.lasers = level.def.lasers.map((def) => ({ ...def, on: false }));
  state.player = createPlayer(level.playerStart);
  state.time = 0;
  state.scoreAtLevelStart = state.score;
  state.spotted = 0;
  state.strikes = 0;
  state.lootGot = 0;
  state.objectiveDone = false;
  state.coinsLeft = 5;
  state.smokeLeft = 2;
  state.smokeClouds = [];
  state.flyingCoin = null;
  state.message = '';
  state.messageTimer = 0;
  state.alarm = false;
  state.unseenTimer = 0;
  state.lit = false;
  state.noiseTimer = 0;
  state.frozen = false;
  audio.stopAlarm();
}

function triggerAlarm() {
  if (state.alarm) return;
  state.alarm = true;
  state.unseenTimer = 0;
  state.spotted += 1;
  state.totalSpotted += 1;
  state.message = 'ALARM! BREAK LINE OF SIGHT!';
  state.messageTimer = 2.5;
  audio.startAlarm();
}

function endAlarm() {
  state.alarm = false;
  state.unseenTimer = 0;
  audio.stopAlarm();
  for (const g of state.guards) {
    g.suspicion = 35;
    if (g.state === 'chase') g.state = 'return';
  }
  for (const s of state.spotlights) s.suspicion = 35;
}

function caught() {
  state.strikes += 1;
  audio.caught();
  endAlarm();
  if (state.strikes >= 3) {
    state.screen = 'gameover';
    audio.lose();
    return;
  }
  resetPlayer(state.player, state.level.playerStart);
  for (const g of state.guards) resetGuard(g, state.level);
  for (const s of state.spotlights) s.suspicion = 0;
  state.message = 'CAUGHT! ' + (3 - state.strikes) + ' CHANCE' + (3 - state.strikes === 1 ? '' : 'S') + ' LEFT';
  state.messageTimer = 3.0;
}

function levelComplete() {
  const timeBonus = Math.max(0, 300 - Math.floor(state.time)) * 2;
  const ghost = state.spotted === 0 ? 500 : 0;
  state.score += timeBonus + ghost;
  state.screen = 'levelwin';
  audio.win();
  audio.stopAlarm();
  state.alarm = false;
}

function updatePlay(dt) {
  state.time += dt;
  if (state.messageTimer > 0) state.messageTimer -= dt;

  const result = updatePlayer(state.player, input, state.level, state, dt);
  if (result === 'win') {
    levelComplete();
    return;
  }
  if (updateFlyingCoin(state, dt)) audio.coinLand();
  updateSmoke(state, dt);

  const lit = isLit(state.level, state.player.x, state.player.y);
  state.lit = lit;

  // Sprint noise draws nearby guards every half second.
  if (state.player.sprinting && state.player.moving) {
    state.noiseTimer -= dt;
    if (state.noiseTimer <= 0) {
      state.noiseTimer = 0.5;
      noiseAlert(state.guards, state.player);
    }
  }

  for (const g of state.guards) {
    updateGuard(g, state.level, state.smokeClouds, state.player, state.alarm, dt);
    const event = updateGuardSuspicion(state.level, state.smokeClouds, g, state.player, lit, dt);
    if (event === 'alarm') triggerAlarm();
  }

  for (const spot of state.spotlights) {
    spot.t += dt;
    spot.angle = spot.baseAngle + Math.sin((spot.t * Math.PI * 2) / spot.period) * spot.sweep;
    const event = updateSpotlightSuspicion(state.level, state.smokeClouds, spot, state.player, dt);
    if (event === 'alarm') triggerAlarm();
  }

  // Lasers: pulse on a 3.8 s cycle (2.2 s on, 1.6 s off), offset by phase.
  for (const beam of state.lasers) {
    beam.on = ((state.time + beam.phase) % 3.8) < 2.2;
    if (!beam.on) continue;
    const { tx, ty } = { tx: beam.x, ty: beam.y };
    const px = state.player.x;
    const py = state.player.y;
    const inBeam =
      px >= tx * 40 && px < (tx + 1) * 40 &&
      py >= 48 + ty * 40 && py < 48 + (ty + 1) * 40;
    if (inBeam) {
      state.message = 'LASER TRIPPED!';
      state.messageTimer = 2.0;
      triggerAlarm();
    }
  }

  if (state.alarm) {
    // Caught: an alarmed guard touches the player.
    for (const g of state.guards) {
      if (Math.hypot(g.x - state.player.x, g.y - state.player.y) < 24) {
        caught();
        return;
      }
    }
    // Alarm ends after 4 s with nobody seeing the player.
    let seen = false;
    for (const g of state.guards) {
      if (guardSeesPlayer(state.level, state.smokeClouds, g, state.player)) { seen = true; break; }
    }
    if (!seen) {
      for (const spot of state.spotlights) {
        if (spotlightSeesPlayer(state.level, state.smokeClouds, spot, state.player)) { seen = true; break; }
      }
    }
    if (seen) state.unseenTimer = 0;
    else {
      state.unseenTimer += dt;
      if (state.unseenTimer > 4) endAlarm();
    }
  }

  // Sound events from this frame.
  if (state.stepEvent) {
    state.stepEvent = false;
    let nearest = Infinity;
    let pan = 0;
    for (const g of state.guards) {
      const d = Math.hypot(g.x - state.player.x, g.y - state.player.y);
      if (d < nearest) { nearest = d; pan = (g.x - state.player.x) / 400; }
    }
    const loudness = Math.max(0, 1 - nearest / 500);
    audio.step(loudness, pan);
  }
  if (state.coinEvent) { state.coinEvent = false; audio.coin(); }
  if (state.smokeEvent) { state.smokeEvent = false; audio.smoke(); }
  if (state.pickupEvent) { state.pickupEvent = false; audio.pickup(); }
  if (state.objectiveEvent) { state.objectiveEvent = false; audio.objective(); }
  if (state.exitLockedEvent) { state.exitLockedEvent = false; }
}

// Menu clicks: returns the id of the clicked button, or null.
function clickedButton() {
  for (const click of input.clicks) {
    for (const b of state.buttons) {
      if (click.x >= b.x && click.x <= b.x + b.w && click.y >= b.y && click.y <= b.y + b.h) {
        return b.id;
      }
    }
  }
  return null;
}

function firstButton() {
  return state.buttons.length ? state.buttons[0].id : null;
}

function handleMenus() {
  const clicked = clickedButton();
  const confirm = input.wasPressed('confirm');
  const pick = clicked || (confirm ? firstButton() : null);

  if (input.wasPressed('mute')) audio.setMuted(!audio.muted);

  switch (state.screen) {
    case 'title':
      if (pick === 'start') { loadLevel(0); state.screen = 'intro'; }
      else if (pick === 'howto') state.screen = 'howto';
      break;
    case 'howto':
      if (pick === 'back') state.screen = 'title';
      break;
    case 'intro':
      if (pick === 'play') state.screen = 'play';
      break;
    case 'pause':
      if (pick === 'resume' || input.wasPressed('pause')) state.screen = 'play';
      else if (pick === 'restart') { loadLevel(state.levelIndex); state.screen = 'intro'; }
      else if (pick === 'quit') { state.screen = 'title'; state.score = 0; state.totalSpotted = 0; }
      break;
    case 'levelwin':
      if (pick === 'next') { loadLevel(state.levelIndex + 1); state.screen = 'intro'; }
      else if (pick === 'replay') { state.score = state.scoreAtLevelStart; loadLevel(state.levelIndex); state.screen = 'intro'; }
      else if (pick === 'campaign') state.screen = 'campaignwin';
      break;
    case 'gameover':
      if (pick === 'retry') { state.score = state.scoreAtLevelStart; loadLevel(state.levelIndex); state.screen = 'intro'; }
      else if (pick === 'quit') { state.screen = 'title'; state.score = 0; state.totalSpotted = 0; }
      break;
    case 'campaignwin':
      if (pick === 'again') { state.score = 0; state.totalSpotted = 0; loadLevel(0); state.screen = 'intro'; }
      else if (pick === 'quit') { state.screen = 'title'; state.score = 0; state.totalSpotted = 0; }
      break;
    default:
      break;
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - (frame.last || now)) / 1000 || 0.016);
  frame.last = now;

  audio.ensure();

  if (state.screen === 'play') {
    if (input.wasPressed('pause')) {
      state.screen = 'pause';
    } else if (input.wasPressed('retry')) {
      state.score = state.scoreAtLevelStart;
      loadLevel(state.levelIndex);
      state.screen = 'intro';
    } else if (input.wasPressed('mute')) {
      audio.setMuted(!audio.muted);
    } else if (!state.frozen) {
      updatePlay(dt);
    }
  } else {
    handleMenus();
  }

  // Render.
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  if (state.level) {
    drawWorld(ctx, state, state.time);
    drawTopBar(ctx, state);
    drawRightPanel(ctx, state);
    drawBottomBar(ctx, state);
  }
  if (state.screen === 'title') drawTitle(ctx, state);
  else if (state.screen === 'howto') drawHowTo(ctx, state);
  else if (state.screen === 'intro') drawIntro(ctx, state);
  else if (state.screen === 'pause') drawPause(ctx, state);
  else if (state.screen === 'levelwin') drawLevelWin(ctx, state);
  else if (state.screen === 'gameover') drawGameOver(ctx, state);
  else if (state.screen === 'campaignwin') drawCampaignWin(ctx, state);

  input.endFrame();
}

// ---- Screenshot staging (?shot=...) ----
// Real game states, staged for the camera: the level loads, the player and
// guards are placed, and updates freeze so the shot is stable. Everything
// on screen is a genuine render of the game's own code.
function applyShot(name) {
  if (name === 'cover') {
    loadLevel(1);
    state.screen = 'play';
    state.time = 84;
    const p = tileCenter(11, 9);
    state.player.x = p.x; state.player.y = p.y;
    state.player.sneaking = true;
    state.player.facing = -Math.PI / 2;
    const g = state.guards[3];
    g.suspicion = 62;
    g.state = 'investigate';
    const t = tileCenter(11, 7);
    g.investigateTarget = { x: t.x, y: t.y };
    g.lastSeen = { x: t.x, y: t.y };
    g.callout = 'WHAT WAS THAT?';
    g.calloutTimer = 99;
    const spot = state.spotlights[0];
    spot.angle = spot.baseAngle + 0.45;
    state.lootGot = 2;
    state.level.loot[0].taken = true;
    state.level.loot[1].taken = true;
    state.score = 100;
  } else if (name === 'sus') {
    loadLevel(0);
    state.screen = 'play';
    state.time = 64;
    const p = tileCenter(1, 6);
    state.player.x = p.x; state.player.y = p.y;
    state.player.hidden = true;
    const g = state.guards[0];
    g.suspicion = 68;
    g.state = 'investigate';
    const t = tileCenter(2, 6);
    g.investigateTarget = { x: t.x, y: t.y };
    g.lastSeen = { x: t.x, y: t.y };
    g.callout = 'WHAT WAS THAT?';
    g.calloutTimer = 99;
    state.lootGot = 1;
    state.level.loot[0].taken = true;
    state.score = 50;
  } else if (name === 'vault') {
    loadLevel(2);
    state.screen = 'play';
    state.time = 41;
    const p = tileCenter(16, 5);
    state.player.x = p.x; state.player.y = p.y;
    state.player.facing = Math.PI / 4;
    for (const beam of state.lasers) beam.on = true;
    const g = state.guards[0];
    const gp = tileCenter(19, 7);
    g.x = gp.x; g.y = gp.y;
    g.facing = Math.PI;
    state.lootGot = 1;
    state.level.loot[0].taken = true;
    state.score = 50;
  } else if (name === 'hide') {
    loadLevel(1);
    state.screen = 'play';
    state.time = 52;
    const p = tileCenter(1, 8);
    state.player.x = p.x; state.player.y = p.y;
    state.player.hidden = true;
    const g = state.guards[1];
    const gp = tileCenter(3, 10);
    g.x = gp.x; g.y = gp.y;
    g.facing = Math.PI / 2;
    const spot = state.spotlights[0];
    spot.angle = spot.baseAngle - 0.5;
  } else {
    return;
  }
  state.frozen = true;
  state.message = '';
  state.messageTimer = 0;
}

// Debug handle for scripted playtests: read-only snapshots of live state.
window.__VC = {
  get state() { return state; },
  applyShot,
  snapshot() {
    return {
      screen: state.screen,
      level: state.level ? state.level.def.number : null,
      levelName: state.level ? state.level.def.name : null,
      time: Math.round(state.time * 10) / 10,
      player: state.player ? {
        x: Math.round(state.player.x), y: Math.round(state.player.y),
        hidden: state.player.hidden, lit: state.lit,
        sneaking: state.player.sneaking, sprinting: state.player.sprinting,
      } : null,
      guards: state.guards.map((g) => ({
        name: g.name, x: Math.round(g.x), y: Math.round(g.y),
        suspicion: Math.round(g.suspicion), state: g.state,
      })),
      spotlights: state.spotlights.map((s) => ({ suspicion: Math.round(s.suspicion || 0) })),
      lootGot: state.lootGot,
      lootTotal: state.level ? state.level.loot.length : 0,
      objectiveDone: state.objectiveDone,
      objective: state.level ? { x: Math.round(state.level.objective.x), y: Math.round(state.level.objective.y), taken: state.level.objective.taken } : null,
      exit: state.level ? { x: Math.round(state.level.exit.x), y: Math.round(state.level.exit.y) } : null,
      strikes: state.strikes,
      spotted: state.spotted,
      score: state.score,
      coinsLeft: state.coinsLeft,
      smokeLeft: state.smokeLeft,
      alarm: state.alarm,
      message: state.message,
      maxSuspicion: Math.round(maxSuspicion(state.guards, state.spotlights)),
    };
  },
};

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) {
  applyShot(shot);
} else {
  loadLevel(0);
}
requestAnimationFrame(frame);
