// player.js — Wren, the cat-burglar: movement, sneak/sprint, coin throws,
// smoke pellets, hiding in curtains, loot, the objective, and the exit.
// Movement collides with walls and crates only; curtains and seats are
// walkable. A coin flies in an arc to the clicked floor spot and draws the
// nearest guard to investigate the clink.

import { tileAt, WORLD_Y, TILE } from './levels.js';
import { hitsSolid, sendToInvestigate } from './guards.js';

export function createPlayer(start) {
  return {
    x: start.x,
    y: start.y,
    r: 13,
    facing: -Math.PI / 2,
    moving: false,
    sneaking: false,
    sprinting: false,
    hidden: false, // inside a curtain
    stepTimer: 0,
    noisePulse: 0, // counts down after a sprint step, drives the ring
  };
}

export function resetPlayer(player, start) {
  player.x = start.x;
  player.y = start.y;
  player.facing = -Math.PI / 2;
  player.moving = false;
  player.sneaking = false;
  player.sprinting = false;
  player.hidden = false;
  player.stepTimer = 0;
  player.noisePulse = 0;
}

// One player tick. `state` is the run state (coins, smoke, level, guards,
// message, audio). Returns an event string for the main loop to sound:
// 'step', 'coin', 'smoke', 'pickup', 'objective', 'exitLocked', 'win'.
export function updatePlayer(player, input, level, state, dt) {
  let dx = 0;
  let dy = 0;
  if (input.isDown('up')) dy -= 1;
  if (input.isDown('down')) dy += 1;
  if (input.isDown('left')) dx -= 1;
  if (input.isDown('right')) dx += 1;
  const wantMove = dx !== 0 || dy !== 0;

  player.sneaking = input.isDown('sneak') && wantMove;
  player.sprinting = input.isDown('sprint') && wantMove && !player.sneaking;

  const speed = player.sneaking ? 70 : player.sprinting ? 210 : 130;
  player.moving = wantMove && !player.hidden;

  if (wantMove && !player.hidden) {
    const len = Math.hypot(dx, dy);
    dx /= len;
    dy /= len;
    player.facing = Math.atan2(dy, dx);
    const nx = player.x + dx * speed * dt;
    const ny = player.y + dy * speed * dt;
    if (!hitsSolid(level, nx, player.y, player.r)) player.x = nx;
    if (!hitsSolid(level, player.x, ny, player.r)) player.y = ny;
    // Footsteps: interval by gait; the main loop sounds them.
    player.stepTimer -= dt;
    if (player.stepTimer <= 0) {
      player.stepTimer = player.sneaking ? 0.7 : player.sprinting ? 0.28 : 0.45;
      state.stepEvent = true;
      if (player.sprinting) player.noisePulse = 0.35;
    }
  } else {
    player.stepTimer = 0;
  }
  if (player.noisePulse > 0) player.noisePulse -= dt;

  // Hide / unhide in a velvet curtain with E.
  if (input.wasPressed('interact')) {
    const { tx, ty } = tileAt(level, player.x, player.y);
    const onCurtain = level.curtains.has(level.key(tx, ty));
    if (player.hidden) {
      player.hidden = false;
    } else if (onCurtain) {
      player.hidden = true;
    }
  }

  // Throw a coin at the clicked floor spot.
  for (const click of input.clicks) {
    if (state.coinsLeft <= 0) {
      state.message = 'NO COINS LEFT';
      state.messageTimer = 1.5;
      continue;
    }
    if (click.x < 960 && click.y >= WORLD_Y && click.y < WORLD_Y + 17 * TILE) {
      state.coinsLeft -= 1;
      state.flyingCoin = { sx: player.x, sy: player.y, tx: click.x, ty: click.y, t: 0 };
      state.coinEvent = true;
    }
  }

  // Smoke pellet at the player's feet.
  if (input.wasPressed('smoke')) {
    if (state.smokeLeft <= 0) {
      state.message = 'NO SMOKE LEFT';
      state.messageTimer = 1.5;
    } else {
      state.smokeLeft -= 1;
      state.smokeClouds.push({ x: player.x, y: player.y, r: 70, t: 3.0 });
      state.smokeEvent = true;
    }
  }

  // Loot: walk over a ticket stub to collect it.
  for (const stub of level.loot) {
    if (!stub.taken && Math.hypot(player.x - stub.x, player.y - stub.y) < 24) {
      stub.taken = true;
      state.lootGot += 1;
      state.score += 50;
      state.pickupEvent = true;
    }
  }

  // Objective: walk over it to pocket it; the exit unlocks.
  const obj = level.objective;
  if (!obj.taken && Math.hypot(player.x - obj.x, player.y - obj.y) < 26) {
    obj.taken = true;
    state.objectiveDone = true;
    state.objectiveEvent = true;
    state.message = 'OBJECTIVE SECURED — REACH THE EXIT';
    state.messageTimer = 3.0;
  }

  // Exit: locked until the objective is pocketed.
  const exit = level.exit;
  if (Math.hypot(player.x - exit.x, player.y - exit.y) < 26) {
    if (state.objectiveDone) return 'win';
    if (state.messageTimer <= 0) {
      state.message = 'LOCKED — FIND THE ' + level.def.objectiveName;
      state.messageTimer = 1.6;
      state.exitLockedEvent = true;
    }
  }

  return null;
}

// A flying coin's arc. Call every frame while one is in the air; returns
// true on landing so the main loop can clink and distract a guard.
export function updateFlyingCoin(state, dt) {
  const coin = state.flyingCoin;
  if (!coin) return false;
  coin.t += dt / 0.45;
  if (coin.t < 1) return false;
  state.flyingCoin = null;
  // The nearest guard within 320 px walks over to investigate the clink.
  let best = null;
  let bestDist = 320;
  for (const g of state.guards) {
    const d = Math.hypot(g.x - coin.tx, g.y - coin.ty);
    if (d < bestDist) { bestDist = d; best = g; }
  }
  if (best) {
    if (best.suspicion < 50) best.suspicion = 50;
    sendToInvestigate(best, coin.tx, coin.ty, null);
  }
  return true;
}

// Smoke clouds shrink away after 3 seconds.
export function updateSmoke(state, dt) {
  for (let i = state.smokeClouds.length - 1; i >= 0; i--) {
    state.smokeClouds[i].t -= dt;
    if (state.smokeClouds[i].t <= 0) state.smokeClouds.splice(i, 1);
  }
}
