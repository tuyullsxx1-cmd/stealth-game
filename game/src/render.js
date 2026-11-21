// render.js — canvas drawing of the theatre: floor, lamplight, walls, cover,
// vision cones, spotlights, lasers, ushers, Wren, and callouts.
// The world occupies x 0..960, y 48..728 (24 x 17 tiles of 40 px). The right
// panel (x 960..1280) and the top/bottom bars are drawn by hud.js.

import { TILE, WORLD_X, WORLD_Y, COLS, ROWS, seededRandom } from './levels.js';
import { CONE_RANGE, CONE_HALF_ANGLE, SPOT_RANGE, SPOT_HALF_ANGLE } from './guards.js';
import { LAMP_RADIUS } from './detection.js';

export const CANVAS_W = 1280;
export const CANVAS_H = 800;
export const TOP_H = 48;
export const PANEL_X = 960;
export const PANEL_W = 320;

function conePath(ctx, x, y, facing, range, halfAngle) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, range, facing - halfAngle, facing + halfAngle);
  ctx.closePath();
}

function coneFill(ctx, x, y, facing, range, halfAngle, inner, outer) {
  const g = ctx.createRadialGradient(x, y, 10, x, y, range);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  conePath(ctx, x, y, facing, range, halfAngle);
  ctx.fill();
}

export function drawWorld(ctx, state, time) {
  const level = state.level;
  const def = level.def;

  // Floor: deep blue-purple checker, darker in the wings.
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      ctx.fillStyle = (tx + ty) % 2 === 0 ? '#151530' : '#191938';
      ctx.fillRect(WORLD_X + tx * TILE, WORLD_Y + ty * TILE, TILE, TILE);
    }
  }

  // Level decor: the stage (level 2) and the vault room (level 3).
  if (def.number === 2) {
    ctx.fillStyle = '#33241a';
    ctx.fillRect(WORLD_X + 7 * TILE, WORLD_Y + 1 * TILE, 10 * TILE, 2 * TILE);
    ctx.strokeStyle = '#c9a24d';
    ctx.lineWidth = 2;
    ctx.strokeRect(WORLD_X + 7 * TILE + 1, WORLD_Y + 1 * TILE + 1, 10 * TILE - 2, 2 * TILE - 2);
    ctx.fillStyle = '#c9a24d';
    ctx.font = 'bold 13px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('S T A G E', WORLD_X + 12 * TILE, WORLD_Y + 1 * TILE + 26);
  }
  if (def.number === 3) {
    ctx.fillStyle = '#232338';
    ctx.fillRect(WORLD_X + 17 * TILE, WORLD_Y + 1 * TILE, 6 * TILE, 4 * TILE);
    ctx.strokeStyle = '#c9a24d';
    ctx.lineWidth = 2;
    ctx.strokeRect(WORLD_X + 17 * TILE + 1, WORLD_Y + 1 * TILE + 1, 6 * TILE - 2, 4 * TILE - 2);
    ctx.fillStyle = '#c9a24d';
    ctx.font = 'bold 12px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('VAULT', WORLD_X + 19.5 * TILE, WORLD_Y + 4 * TILE + 24);
  }

  // Walls first, before any entity or label, so no label is ever covered.
  for (const key of level.solids) {
    const [tx, ty] = key.split(',').map(Number);
    if (tx <= 0 || tx >= COLS - 1 || ty <= 0 || ty >= ROWS - 1) continue; // border drawn below
    if (def.crates.some(([cx, cy]) => cx === tx && cy === ty)) continue;
    const x = WORLD_X + tx * TILE;
    const y = WORLD_Y + ty * TILE;
    ctx.fillStyle = '#2e2a4a';
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = '#4a4480';
    ctx.fillRect(x, y, TILE, 4);
  }
  // Border walls.
  ctx.fillStyle = '#241f3d';
  ctx.fillRect(WORLD_X, WORLD_Y, 960, 10);
  ctx.fillRect(WORLD_X, WORLD_Y + 670, 960, 10);
  ctx.fillRect(WORLD_X, WORLD_Y, 10, 680);
  ctx.fillRect(WORLD_X + 950, WORLD_Y, 10, 680);
  ctx.fillStyle = '#3a3260';
  ctx.fillRect(WORLD_X, WORLD_Y, 960, 3);
  ctx.fillRect(WORLD_X, WORLD_Y + 677, 960, 3);
  ctx.fillRect(WORLD_X, WORLD_Y, 3, 680);
  ctx.fillRect(WORLD_X + 957, WORLD_Y, 3, 680);

  // Lamplight pools: warm radial glows on the floor.
  for (const lamp of level.lamps) {
    const g = ctx.createRadialGradient(lamp.x, lamp.y, 6, lamp.x, lamp.y, LAMP_RADIUS);
    g.addColorStop(0, 'rgba(255, 190, 90, 0.30)');
    g.addColorStop(0.6, 'rgba(255, 170, 70, 0.12)');
    g.addColorStop(1, 'rgba(255, 170, 70, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, LAMP_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }

  // Dust motes: fixed seeded sparkles drifting slowly (cosmetic only).
  const rng = seededRandom(def.number * 7919 + 13);
  for (let i = 0; i < 42; i++) {
    const mx = WORLD_X + rng() * 960;
    const my = WORLD_Y + rng() * 680;
    const a = 0.05 + 0.05 * Math.sin(time * 0.7 + i * 1.7);
    ctx.fillStyle = 'rgba(220, 210, 255, ' + Math.max(0, a).toFixed(3) + ')';
    ctx.fillRect(mx, my, 2, 2);
  }

  // Exit tile: green, with a lit border and EXIT label.
  const ex = level.exit;
  ctx.fillStyle = state.objectiveDone ? '#1f9d55' : '#1d4d33';
  ctx.fillRect(ex.x - 20, ex.y - 20, 40, 40);
  ctx.strokeStyle = state.objectiveDone ? '#7dffa8' : '#4d7a5e';
  ctx.lineWidth = 3;
  ctx.strokeRect(ex.x - 20, ex.y - 20, 40, 40);
  ctx.fillStyle = '#eafff0';
  ctx.font = 'bold 11px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('EXIT', ex.x, ex.y + 4);
  if (!state.objectiveDone) {
    // Drawn padlock above the exit (no emoji: headless fonts may lack it).
    ctx.strokeStyle = '#ffd76e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ex.x, ex.y - 28, 5, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = '#ffd76e';
    ctx.fillRect(ex.x - 7, ex.y - 28, 14, 10);
  }

  // Loot: gold ticket stubs.
  for (const stub of level.loot) {
    if (stub.taken) continue;
    ctx.save();
    ctx.translate(stub.x, stub.y);
    ctx.rotate(Math.sin(time * 2 + stub.x) * 0.08);
    ctx.fillStyle = '#e8b64c';
    ctx.fillRect(-9, -6, 18, 12);
    ctx.fillStyle = '#7a5a10';
    ctx.fillRect(-9, -1, 18, 2);
    ctx.restore();
  }

  // Objective: a pulsing gold diamond with a glow.
  if (!level.objective.taken) {
    const o = level.objective;
    const pulse = 1 + 0.12 * Math.sin(time * 3);
    const g = ctx.createRadialGradient(o.x, o.y, 2, o.x, o.y, 34 * pulse);
    g.addColorStop(0, 'rgba(255, 215, 110, 0.55)');
    g.addColorStop(1, 'rgba(255, 215, 110, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(o.x, o.y, 34 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#ffd76e';
    ctx.strokeStyle = '#8a6a1a';
    ctx.lineWidth = 2;
    ctx.fillRect(-9, -9, 18, 18);
    ctx.strokeRect(-9, -9, 18, 18);
    ctx.restore();
    ctx.fillStyle = '#ffd76e';
    ctx.font = 'bold 10px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(def.objectiveName, o.x, o.y + 34);
  }

  // Laser grid (level 3): red beams across the vault door, pulsing.
  for (const beam of state.lasers) {
    if (!beam.on) continue;
    const bx = WORLD_X + beam.x * TILE;
    const by = WORLD_Y + beam.y * TILE;
    ctx.strokeStyle = 'rgba(255, 45, 45, 0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(bx, by + 4);
    ctx.lineTo(bx + TILE, by + 4);
    ctx.moveTo(bx, by + TILE - 4);
    ctx.lineTo(bx + TILE, by + TILE - 4);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 45, 45, 0.85)';
    ctx.beginPath();
    ctx.arc(bx, by + TILE / 2, 4, 0, Math.PI * 2);
    ctx.arc(bx + TILE, by + TILE / 2, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Curtains: deep red drapes with fold lines and a gold rod.
  for (const key of level.curtains) {
    const [tx, ty] = key.split(',').map(Number);
    const x = WORLD_X + tx * TILE;
    const y = WORLD_Y + ty * TILE;
    ctx.fillStyle = '#7a1f2b';
    ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
    ctx.strokeStyle = '#a83240';
    ctx.lineWidth = 3;
    for (let f = 0; f < 3; f++) {
      ctx.beginPath();
      ctx.moveTo(x + 10 + f * 10, y + 3);
      ctx.lineTo(x + 10 + f * 10, y + TILE - 3);
      ctx.stroke();
    }
    ctx.fillStyle = '#c9a24d';
    ctx.fillRect(x + 2, y + 2, TILE - 4, 3);
  }

  // Seats: dark red velvet rows with a pale backrest edge.
  for (const key of level.seats) {
    const [tx, ty] = key.split(',').map(Number);
    const x = WORLD_X + tx * TILE;
    const y = WORLD_Y + ty * TILE;
    ctx.fillStyle = '#5a1f2e';
    ctx.fillRect(x + 3, y + 8, TILE - 6, TILE - 12);
    ctx.fillStyle = '#8a3048';
    ctx.fillRect(x + 3, y + 8, TILE - 6, 5);
  }

  // Crates: brown boxes with a pale X.
  for (const [tx, ty] of def.crates) {
    const x = WORLD_X + tx * TILE;
    const y = WORLD_Y + ty * TILE;
    ctx.fillStyle = '#6b4a2f';
    ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
    ctx.strokeStyle = '#d9c08a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 5, y + 5);
    ctx.lineTo(x + TILE - 5, y + TILE - 5);
    ctx.moveTo(x + TILE - 5, y + 5);
    ctx.lineTo(x + 5, y + TILE - 5);
    ctx.stroke();
    ctx.strokeStyle = '#3d2a18';
    ctx.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4);
  }

  // Lamps: brass fixtures on the floor.
  for (const lamp of level.lamps) {
    ctx.fillStyle = '#c9a24d';
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff2c0';
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Sweeping spotlights: fixture + pale yellow cone.
  for (const spot of state.spotlights) {
    coneFill(ctx, spot.x, spot.y, spot.angle, SPOT_RANGE, SPOT_HALF_ANGLE,
      'rgba(255, 230, 140, 0.28)', 'rgba(255, 230, 140, 0.02)');
    ctx.fillStyle = '#d8c27a';
    ctx.beginPath();
    ctx.arc(spot.x, spot.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff6c8';
    ctx.beginPath();
    ctx.arc(spot.x, spot.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Guard vision cones, coloured by state.
  for (const g of state.guards) {
    let inner;
    let outer;
    if (g.state === 'chase' || state.alarm) {
      inner = 'rgba(255, 60, 60, 0.38)';
      outer = 'rgba(255, 60, 60, 0.03)';
    } else if (g.suspicion >= 50) {
      inner = 'rgba(245, 166, 35, 0.34)';
      outer = 'rgba(245, 166, 35, 0.03)';
    } else {
      inner = 'rgba(120, 180, 255, 0.22)';
      outer = 'rgba(120, 180, 255, 0.02)';
    }
    coneFill(ctx, g.x, g.y, g.facing, CONE_RANGE, CONE_HALF_ANGLE, inner, outer);
  }

  // Sprint noise ring around the player.
  const p = state.player;
  if (p.noisePulse > 0) {
    const a = Math.max(0, p.noisePulse / 0.35);
    ctx.strokeStyle = 'rgba(255, 220, 120, ' + (0.7 * a).toFixed(2) + ')';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 40 + (1 - a) * 90, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Flying coin: a small gold arc.
  if (state.flyingCoin) {
    const c = state.flyingCoin;
    const t = Math.min(1, c.t);
    const x = c.sx + (c.tx - c.sx) * t;
    const y = c.sy + (c.ty - c.sy) * t - Math.sin(t * Math.PI) * 46;
    ctx.fillStyle = '#ffd76e';
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8a6a1a';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Smoke clouds: soft grey puffs.
  for (const cloud of state.smokeClouds) {
    const a = Math.min(0.55, (cloud.t / 3) * 0.55);
    const g = ctx.createRadialGradient(cloud.x, cloud.y, 4, cloud.x, cloud.y, cloud.r);
    g.addColorStop(0, 'rgba(200, 200, 210, ' + a.toFixed(2) + ')');
    g.addColorStop(1, 'rgba(200, 200, 210, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cloud.x, cloud.y, cloud.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Ushers: amber circles with a white direction tick and a state mark.
  for (const g of state.guards) {
    ctx.fillStyle = '#f5a623';
    ctx.beginPath();
    ctx.arc(g.x, g.y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7a5200';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(g.x, g.y);
    ctx.lineTo(g.x + Math.cos(g.facing) * 15, g.y + Math.sin(g.facing) * 15);
    ctx.stroke();
    // Suspicion arc above the guard.
    if (g.suspicion > 2) {
      ctx.strokeStyle = g.suspicion >= 50 ? '#f5a623' : '#9fc4ff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(g.x, g.y - 20, 7, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * g.suspicion) / 100);
      ctx.stroke();
    }
    if (g.state === 'investigate') {
      ctx.fillStyle = '#ffd76e';
      ctx.font = 'bold 20px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText('?', g.x, g.y - 28);
    } else if (g.state === 'chase' || state.alarm) {
      ctx.fillStyle = '#ff5a4d';
      ctx.font = 'bold 20px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', g.x, g.y - 28);
    }
    if (g.callout) {
      ctx.fillStyle = '#ffe9a8';
      ctx.font = 'bold 13px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText(g.callout, g.x, g.y - 44);
    }
  }

  // Wren: a dark hooded figure with a pale outline and a gold mask glint.
  ctx.save();
  if (p.hidden) ctx.globalAlpha = 0.45;
  ctx.fillStyle = '#1c1c26';
  ctx.beginPath();
  ctx.arc(p.x, p.y, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#e8e4d8';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#ffd76e';
  ctx.beginPath();
  ctx.arc(p.x + Math.cos(p.facing) * 6, p.y + Math.sin(p.facing) * 6, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (p.hidden) {
    ctx.fillStyle = '#7dffa8';
    ctx.font = 'bold 12px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('HIDDEN', p.x, p.y - 22);
  }

  // Message banner across the top of the world.
  if (state.messageTimer > 0 && state.message) {
    ctx.fillStyle = 'rgba(10, 10, 26, 0.82)';
    ctx.fillRect(180, 56, 600, 30);
    ctx.strokeStyle = '#c9a24d';
    ctx.lineWidth = 1;
    ctx.strokeRect(180, 56, 600, 30);
    ctx.fillStyle = '#ffe9a8';
    ctx.font = 'bold 14px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(state.message, 480, 76);
  }
}
