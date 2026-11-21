// detection.js — suspicion, alarm, noise, strikes, light and shadow.
// A guard's suspicion rises while it sees the player (faster in lamplight,
// slower in shadow, slower still while the player sneaks) and drains when
// the player is hidden. At 50 the guard investigates; at 100 the alarm
// sounds, every guard chases, and SPOTTED rises by one.

import { inCone, lineOfSight, sendToInvestigate, CONE_RANGE, CONE_HALF_ANGLE, SPOT_RANGE, SPOT_HALF_ANGLE } from './guards.js';
import { tileAt } from './levels.js';

export const LAMP_RADIUS = 90;

// Is the player standing in lamplight?
export function isLit(level, px, py) {
  for (const lamp of level.lamps) {
    if (Math.hypot(px - lamp.x, py - lamp.y) <= LAMP_RADIUS) return true;
  }
  return false;
}

// Is the player hidden right now (curtain, sneaking in seats, or smoke)?
export function isHidden(level, smoke, player) {
  if (player.hidden) return true;
  const { tx, ty } = tileAt(level, player.x, player.y);
  if (player.sneaking && level.seats.has(level.key(tx, ty))) return true;
  for (const cloud of smoke) {
    if (Math.hypot(player.x - cloud.x, player.y - cloud.y) < cloud.r) return true;
  }
  return false;
}

// Can this guard see the player this frame?
export function guardSeesPlayer(level, smoke, guard, player) {
  if (isHidden(level, smoke, player)) return false;
  if (!inCone(guard.x, guard.y, guard.facing, CONE_RANGE, CONE_HALF_ANGLE, player.x, player.y)) return false;
  return lineOfSight(level, smoke, guard.x, guard.y, player.x, player.y);
}

// Can this sweeping spotlight see the player this frame?
export function spotlightSeesPlayer(level, smoke, spot, player) {
  if (isHidden(level, smoke, player)) return false;
  if (!inCone(spot.x, spot.y, spot.angle, SPOT_RANGE, SPOT_HALF_ANGLE, player.x, player.y)) return false;
  return lineOfSight(level, smoke, spot.x, spot.y, player.x, player.y);
}

// One detection tick for a guard. Returns 'alarm' when this guard just
// tripped the alarm, 'suspicious' when it just turned suspicious.
export function updateGuardSuspicion(level, smoke, guard, player, lit, dt) {
  const seen = guardSeesPlayer(level, smoke, guard, player);
  if (seen) {
    let rate = lit ? 55 : 26;
    if (player.sneaking) rate *= 0.55;
    guard.suspicion = Math.min(100, guard.suspicion + rate * dt);
    guard.lastSeen = { x: player.x, y: player.y };
    if (guard.suspicion >= 100) return 'alarm';
    if (guard.suspicion >= 50 && guard.state === 'patrol') {
      sendToInvestigate(guard, guard.lastSeen.x, guard.lastSeen.y, 'WHAT WAS THAT?');
      return 'suspicious';
    }
  } else {
    // Unseen: suspicion drains (faster when hidden). An investigating
    // guard finishes its look first — it does not abandon the search
    // just because the meter drained.
    const hidden = isHidden(level, smoke, player);
    const drain = hidden ? 45 : 25;
    guard.suspicion = Math.max(0, guard.suspicion - drain * dt);
  }
  return null;
}

// One detection tick for a sweeping spotlight. Returns 'alarm' on trip.
export function updateSpotlightSuspicion(level, smoke, spot, player, dt) {
  const seen = spotlightSeesPlayer(level, smoke, spot, player);
  if (seen) {
    spot.suspicion = Math.min(100, spot.suspicion + 50 * dt);
    if (spot.suspicion >= 100) return 'alarm';
  } else {
    spot.suspicion = Math.max(0, spot.suspicion - 20 * dt);
  }
  return null;
}

// Loud sprint noise: guards near the player turn to investigate the racket.
export function noiseAlert(guards, player) {
  for (const g of guards) {
    if (g.state === 'chase') continue;
    if (Math.hypot(g.x - player.x, g.y - player.y) <= 170) {
      if (g.suspicion < 50) g.suspicion = 50;
      sendToInvestigate(g, player.x, player.y, 'WHAT WAS THAT?');
    }
  }
}

// The highest suspicion across guards and spotlights: the HUD alarm meter.
export function maxSuspicion(guards, spotlights) {
  let m = 0;
  for (const g of guards) m = Math.max(m, g.suspicion);
  for (const s of spotlights) m = Math.max(m, s.suspicion || 0);
  return m;
}
