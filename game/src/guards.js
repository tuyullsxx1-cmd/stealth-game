// guards.js — usher patrol AI and vision cones.
// A guard walks a fixed waypoint loop (patrol), investigates a spot it was
// drawn to (suspicious), or chases the player (alarmed). A guard sees the
// player only inside its cone AND with a clear line of sight: walls, crates
// and velvet curtains block sight. Smoke clouds block sight too.

import { tileCenter, isSolid, isBlocking, tileAt, TILE } from './levels.js';

export const CONE_RANGE = 200;
export const CONE_HALF_ANGLE = (35 * Math.PI) / 180;
export const SPOT_RANGE = 260;
export const SPOT_HALF_ANGLE = (22 * Math.PI) / 180;

export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// True when the straight segment from (x1,y1) to (x2,y2) crosses no
// sight-blocking tile and no smoke cloud.
export function lineOfSight(level, smoke, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 6));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const px = x1 + dx * t;
    const py = y1 + dy * t;
    const { tx, ty } = tileAt(level, px, py);
    if (isBlocking(level, tx, ty)) return false;
    for (const cloud of smoke) {
      if (Math.hypot(px - cloud.x, py - cloud.y) < cloud.r) return false;
    }
  }
  return true;
}

export function inCone(sx, sy, facing, range, halfAngle, px, py) {
  const dx = px - sx;
  const dy = py - sy;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return false;
  if (dist < 14) return true;
  const ang = Math.atan2(dy, dx);
  return Math.abs(angleDiff(ang, facing)) <= halfAngle;
}

export function createGuard(def, level) {
  const start = tileCenter(def.waypoints[0][0], def.waypoints[0][1]);
  const next = def.waypoints[1] || def.waypoints[0];
  const nextPos = tileCenter(next[0], next[1]);
  return {
    name: def.name,
    def,
    x: start.x,
    y: start.y,
    facing: Math.atan2(nextPos.y - start.y, nextPos.x - start.x),
    waypointIndex: 1 % def.waypoints.length,
    pauseTimer: 0,
    state: 'patrol', // patrol | investigate | chase | return
    suspicion: 0,
    lastSeen: null,
    investigateTarget: null,
    lookTimer: 0,
    scanDir: 1,
    callout: null,
    calloutTimer: 0,
  };
}

export function resetGuard(g, level) {
  const start = tileCenter(g.def.waypoints[0][0], g.def.waypoints[0][1]);
  const next = g.def.waypoints[1] || g.def.waypoints[0];
  const nextPos = tileCenter(next[0], next[1]);
  g.x = start.x;
  g.y = start.y;
  g.facing = Math.atan2(nextPos.y - start.y, nextPos.x - start.x);
  g.waypointIndex = 1 % g.def.waypoints.length;
  g.pauseTimer = 0;
  g.state = 'patrol';
  g.suspicion = 0;
  g.lastSeen = null;
  g.investigateTarget = null;
  g.lookTimer = 0;
  g.callout = null;
  g.calloutTimer = 0;
}

// Move a guard toward (tx, ty) in pixels, sliding along solid tiles.
function moveToward(g, level, tx, ty, speed, dt) {
  const dx = tx - g.x;
  const dy = ty - g.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 2) return true;
  const step = Math.min(dist, speed * dt);
  const nx = g.x + (dx / dist) * step;
  const ny = g.y + (dy / dist) * step;
  g.facing = Math.atan2(dy, dx);
  const r = 13;
  if (!hitsSolid(level, nx, g.y, r)) g.x = nx;
  if (!hitsSolid(level, g.x, ny, r)) g.y = ny;
  return dist <= step + 1;
}

export function hitsSolid(level, px, py, r) {
  const { tx, ty } = tileAt(level, px, py);
  for (let oy = -1; oy <= 1; oy++) {
    for (let ox = -1; ox <= 1; ox++) {
      // Movement collides with walls and crates only: curtains and seats
      // are walkable (curtains still block sight, handled in lineOfSight).
      if (!isSolid(level, tx + ox, ty + oy)) continue;
      const bx = tx + ox;
      const by = ty + oy;
      const cx = Math.max(bx * TILE, Math.min(px, (bx + 1) * TILE));
      const cy = Math.max(48 + by * TILE, Math.min(py, 48 + (by + 1) * TILE));
      if (Math.hypot(px - cx, py - cy) < r) return true;
    }
  }
  return false;
}

// One guard tick. `alarm` is true while the level alarm is sounding.
export function updateGuard(g, level, smoke, player, alarm, dt) {
  if (g.calloutTimer > 0) {
    g.calloutTimer -= dt;
    if (g.calloutTimer <= 0) g.callout = null;
  }

  if (alarm) {
    g.state = 'chase';
    moveToward(g, level, player.x, player.y, 115, dt);
    return;
  }

  if (g.state === 'chase') g.state = 'patrol';

  if (g.state === 'investigate' && g.investigateTarget) {
    const arrived = moveToward(g, level, g.investigateTarget.x, g.investigateTarget.y, 85, dt);
    if (arrived) {
      g.lookTimer -= dt;
      g.facing += g.scanDir * 1.4 * dt;
      if (g.lookTimer <= 0) {
        g.state = 'return';
        g.investigateTarget = null;
      }
    }
    return;
  }

  if (g.state === 'return') {
    // Walk back to the nearest waypoint, then resume the loop.
    let best = 0;
    let bestDist = Infinity;
    g.def.waypoints.forEach((wp, i) => {
      const p = tileCenter(wp[0], wp[1]);
      const d = Math.hypot(p.x - g.x, p.y - g.y);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    const target = tileCenter(g.def.waypoints[best][0], g.def.waypoints[best][1]);
    const arrived = moveToward(g, level, target.x, target.y, 70, dt);
    if (arrived) {
      g.waypointIndex = (best + 1) % g.def.waypoints.length;
      g.state = 'patrol';
    }
    return;
  }

  // Patrol: walk the waypoint loop, pausing and scanning at each point.
  if (g.pauseTimer > 0) {
    g.pauseTimer -= dt;
    g.facing += g.scanDir * 0.5 * dt;
    return;
  }
  const wp = g.def.waypoints[g.waypointIndex];
  const target = tileCenter(wp[0], wp[1]);
  const arrived = moveToward(g, level, target.x, target.y, 55, dt);
  if (arrived) {
    g.pauseTimer = g.def.pause;
    g.scanDir = -g.scanDir;
    g.waypointIndex = (g.waypointIndex + 1) % g.def.waypoints.length;
  }
}

// Send a guard to look at (x, y) in pixels. Used for coin clinks, noise,
// and the spot a guard last saw the player.
export function sendToInvestigate(g, x, y, callout) {
  if (g.state === 'chase') return;
  g.state = 'investigate';
  g.investigateTarget = { x, y };
  g.lookTimer = 3.5;
  if (callout) {
    g.callout = callout;
    g.calloutTimer = 2.2;
  }
}
