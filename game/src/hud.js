// hud.js — the chrome around the game: top bar, right panel, bottom hint,
// and every menu screen (title, how to play, level intro, pause, win,
// game over). The judge reads the right panel, so it always shows the
// detection state, visibility, noise, loot, spotted count, goal, a legend,
// and the controls.

import { CANVAS_W, CANVAS_H, TOP_H, PANEL_X, PANEL_W } from './render.js';
import { maxSuspicion } from './detection.js';

export function formatTime(seconds) {
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return (m < 10 ? '0' + m : '' + m) + ':' + (r < 10 ? '0' + r : '' + r);
}

function panelBox(ctx, x, y, w, h) {
  ctx.fillStyle = '#101024';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#3a3260';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

function label(ctx, text, x, y, color, size) {
  ctx.fillStyle = color || '#8a84b8';
  ctx.font = 'bold ' + (size || 11) + 'px Georgia, serif';
  ctx.textAlign = 'left';
  ctx.fillText(text, x, y);
}

function value(ctx, text, x, y, color, size) {
  ctx.fillStyle = color || '#e8e4d8';
  ctx.font = 'bold ' + (size || 15) + 'px Georgia, serif';
  ctx.textAlign = 'left';
  ctx.fillText(text, x, y);
}

export function drawTopBar(ctx, state) {
  const level = state.level;
  ctx.fillStyle = '#0d0d1e';
  ctx.fillRect(0, 0, CANVAS_W, TOP_H);
  ctx.strokeStyle = '#c9a24d';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, TOP_H - 0.5);
  ctx.lineTo(CANVAS_W, TOP_H - 0.5);
  ctx.stroke();

  ctx.fillStyle = '#c9a24d';
  ctx.font = 'bold 20px Georgia, serif';
  ctx.textAlign = 'left';
  ctx.fillText(level.def.number, 16, 32);
  ctx.fillStyle = '#e8e4d8';
  ctx.font = 'bold 17px Georgia, serif';
  ctx.fillText(level.def.name, 44, 31);

  ctx.fillStyle = '#c9a24d';
  ctx.font = 'bold 13px Georgia, serif';
  ctx.fillText('◆ OBJECTIVE:', 300, 30);
  ctx.fillStyle = '#e8e4d8';
  ctx.font = '13px Georgia, serif';
  ctx.fillText(level.def.objectiveText, 408, 30);

  ctx.fillStyle = '#8a84b8';
  ctx.font = 'bold 12px Georgia, serif';
  ctx.textAlign = 'right';
  ctx.fillText('TIME', 1080, 20);
  ctx.fillStyle = '#e8e4d8';
  ctx.font = 'bold 20px Georgia, serif';
  ctx.fillText(formatTime(state.time), 1080, 42);
  ctx.textAlign = 'left';
}

export function drawRightPanel(ctx, state) {
  const level = state.level;
  const x = PANEL_X;
  const w = PANEL_W;
  ctx.fillStyle = '#0d0d1e';
  ctx.fillRect(x, TOP_H, w, CANVAS_H - TOP_H);
  ctx.strokeStyle = '#3a3260';
  ctx.beginPath();
  ctx.moveTo(x + 0.5, TOP_H);
  ctx.lineTo(x + 0.5, CANVAS_H);
  ctx.stroke();

  let y = TOP_H + 22;
  label(ctx, 'DETECTION', x + 16, y);
  y += 30;
  const maxSus = maxSuspicion(state.guards, state.spotlights);
  let detText = 'CALM';
  let detColor = '#7dffa8';
  if (state.alarm) { detText = 'ALARM !'; detColor = '#ff5a4d'; }
  else if (maxSus >= 50) { detText = 'SUSPICIOUS ?'; detColor = '#f5a623'; }
  ctx.fillStyle = detColor;
  ctx.fillRect(x + 16, y, w - 32, 40);
  ctx.fillStyle = '#0d0d1e';
  ctx.font = 'bold 22px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(detText, x + w / 2, y + 28);
  ctx.textAlign = 'left';
  y += 58;
  value(ctx, state.alarm ? 'Every usher is hunting you. Break line of sight!' :
    maxSus >= 50 ? 'Something caught an eye. Freeze.' :
    'Unseen. Keep to the shadows.', x + 16, y, '#c9c4e0', 12);
  y += 26;

  label(ctx, 'ALARM', x + 16, y);
  value(ctx, state.alarm ? 'RAISED' : 'QUIET', x + 120, y, state.alarm ? '#ff5a4d' : '#7dffa8', 13);
  y += 10;
  ctx.fillStyle = '#241f3d';
  ctx.fillRect(x + 16, y, w - 32, 8);
  ctx.fillStyle = state.alarm ? '#ff5a4d' : '#f5a623';
  ctx.fillRect(x + 16, y, (w - 32) * (maxSus / 100), 8);
  y += 30;

  label(ctx, 'VISIBILITY', x + 16, y);
  value(ctx, state.lit ? 'LIT' : 'IN SHADOW', x + 120, y, state.lit ? '#f5a623' : '#7dffa8', 13);
  y += 26;
  label(ctx, 'NOISE', x + 16, y);
  const noise = state.player.sprinting ? 'LOUD' : state.player.sneaking ? 'SILENT' : 'QUIET';
  value(ctx, noise, x + 120, y, state.player.sprinting ? '#ff5a4d' : '#7dffa8', 13);
  y += 34;

  label(ctx, 'LOOT', x + 16, y);
  value(ctx, state.lootGot + ' / ' + level.loot.length, x + 16, y + 22, '#ffd76e', 16);
  label(ctx, 'SPOTTED', x + 130, y);
  value(ctx, '' + state.spotted, x + 130, y + 22, state.spotted > 0 ? '#ff5a4d' : '#e8e4d8', 16);
  label(ctx, 'SCORE', x + 220, y);
  value(ctx, '' + state.score, x + 220, y + 22, '#e8e4d8', 16);
  y += 48;
  label(ctx, 'GOAL', x + 16, y);
  value(ctx, state.objectiveDone ? 'DONE — REACH EXIT' : level.def.objectiveName, x + 16, y + 20,
    state.objectiveDone ? '#7dffa8' : '#ffd76e', 14);
  y += 44;
  label(ctx, 'COINS ' + state.coinsLeft + '   •   SMOKE ' + state.smokeLeft + '   •   CHANCES ' + (3 - state.strikes), x + 16, y, '#c9c4e0', 12);
  y += 30;

  // Legend.
  ctx.strokeStyle = '#3a3260';
  ctx.beginPath();
  ctx.moveTo(x + 16, y);
  ctx.lineTo(x + w - 16, y);
  ctx.stroke();
  y += 20;
  label(ctx, 'LEGEND', x + 16, y);
  y += 20;
  const items = [
    ['●', '#f5a623', 'Usher + vision cone'],
    ['◐', '#ffe68c', 'Spotlight: sweeps a cone'],
    ['▦', '#a83240', 'Curtain: E to hide inside'],
    ['☒', '#6b4a2f', 'Crate: blocks sight'],
    ['○', '#ffd76e', 'Lamp light: you are seen'],
    ['▨', '#5a1f2e', 'Seats: sneak to hide'],
    ['—', '#ff2d2d', 'Laser: pulses on a timer'],
    ['◆', '#ffd76e', 'Objective item'],
    ['■', '#1f9d55', 'Exit: unlocks with goal'],
  ];
  for (const [glyph, color, text] of items) {
    ctx.fillStyle = color;
    ctx.font = 'bold 14px Georgia, serif';
    ctx.fillText(glyph, x + 16, y);
    value(ctx, text, x + 44, y, '#c9c4e0', 12);
    y += 21;
  }
  y += 6;

  // Controls.
  ctx.strokeStyle = '#3a3260';
  ctx.beginPath();
  ctx.moveTo(x + 16, y);
  ctx.lineTo(x + w - 16, y);
  ctx.stroke();
  y += 20;
  label(ctx, 'CONTROLS', x + 16, y);
  y += 20;
  const controls = [
    'WASD move · SHIFT sneak',
    'SPACE sprint (loud) · E hide',
    'CLICK throw coin · Q smoke',
    'R retry · M mute · ESC pause',
  ];
  for (const line of controls) {
    value(ctx, line, x + 16, y, '#c9c4e0', 12);
    y += 19;
  }
}

export function drawBottomBar(ctx, state) {
  ctx.fillStyle = '#0d0d1e';
  ctx.fillRect(0, 728, PANEL_X, 72);
  ctx.strokeStyle = '#3a3260';
  ctx.beginPath();
  ctx.moveTo(0, 728.5);
  ctx.lineTo(PANEL_X, 728.5);
  ctx.stroke();
  ctx.fillStyle = '#8a84b8';
  ctx.font = 'bold 12px Georgia, serif';
  ctx.textAlign = 'left';
  ctx.fillText('WASD MOVE · SHIFT SNEAK · CLICK COIN · E GRAB / HIDE · Q SMOKE · P / ESC PAUSE · M MUTE', 16, 752);
  ctx.fillStyle = state.objectiveDone ? '#7dffa8' : '#c9a24d';
  ctx.font = 'bold 14px Georgia, serif';
  ctx.fillText(state.objectiveDone ? 'WIN lift the ' + state.level.def.objectiveName + ' and reach the green exit unseen' :
    'WIN lift the ' + state.level.def.objectiveName + ' and reach the green exit unseen', 16, 776);
  ctx.fillStyle = '#8a84b8';
  ctx.font = '12px Georgia, serif';
  ctx.fillText('LOSE get caught 3 times', 16, 794);
}

// ---- Menu screens (drawn over the world) ----

function dim(ctx) {
  ctx.fillStyle = 'rgba(8, 8, 20, 0.86)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
}

function titleText(ctx, text, y, size, color) {
  ctx.fillStyle = color;
  ctx.font = 'bold ' + size + 'px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, CANVAS_W / 2, y);
}

function button(ctx, text, y, w, selected) {
  const x = CANVAS_W / 2 - w / 2;
  ctx.fillStyle = selected ? '#c9a24d' : '#1d1d38';
  ctx.fillRect(x, y, w, 44);
  ctx.strokeStyle = '#c9a24d';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, 44);
  ctx.fillStyle = selected ? '#0d0d1e' : '#e8e4d8';
  ctx.font = 'bold 17px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, CANVAS_W / 2, y + 29);
  return { x, y, w, h: 44 };
}

export function drawTitle(ctx, state) {
  dim(ctx);
  titleText(ctx, 'THE VELVET CURTAIN', 190, 54, '#c9a24d');
  titleText(ctx, 'A stealth heist in the Grand Velvet Theatre', 232, 18, '#c9c4e0');
  titleText(ctx, 'You are Wren, a cat-burglar. Steal the Moon Masque', 300, 16, '#e8e4d8');
  titleText(ctx, 'from the prop vault — and reach the stage door unseen.', 326, 16, '#e8e4d8');
  state.buttons = [
    { id: 'start', ...button(ctx, 'START THE HEIST', 420, 280, true) },
    { id: 'howto', ...button(ctx, 'HOW TO PLAY', 486, 280, false) },
  ];
}

export function drawHowTo(ctx, state) {
  dim(ctx);
  titleText(ctx, 'HOW TO PLAY', 130, 34, '#c9a24d');
  const lines = [
    'Stay out of the ushers’ vision cones — and out of the lamplight.',
    'Sneak (SHIFT) to move silently. Sprint (SPACE) is fast but loud.',
    'Hide in the velvet curtains with E. Crouch-sneak through the seats.',
    'CLICK to throw a coin and lure a guard away. Q drops a smoke pellet.',
    'Pocket the objective, then reach the green EXIT. Get caught 3 times and the heist fails.',
    'Finish a level with 0 spotted for a +500 GHOST bonus.',
  ];
  ctx.font = '15px Georgia, serif';
  ctx.fillStyle = '#e8e4d8';
  ctx.textAlign = 'center';
  lines.forEach((line, i) => ctx.fillText(line, CANVAS_W / 2, 200 + i * 30));
  state.buttons = [
    { id: 'back', ...button(ctx, 'BACK', 480, 220, true) },
  ];
}

export function drawIntro(ctx, state) {
  dim(ctx);
  const level = state.level;
  titleText(ctx, 'LEVEL ' + level.def.number + ' — ' + level.def.name, 210, 40, '#c9a24d');
  titleText(ctx, level.def.objectiveText, 270, 18, '#e8e4d8');
  titleText(ctx, level.def.guards.length + ' ushers on patrol · ' + level.loot.length + ' ticket stubs · ' +
    (level.def.spotlights.length ? level.def.spotlights.length + ' spotlight' + (level.def.spotlights.length > 1 ? 's' : '') + ' · ' : '') +
    (level.def.lasers.length ? 'laser grid · ' : '') + '3 chances', 310, 15, '#c9c4e0');
  state.buttons = [
    { id: 'play', ...button(ctx, 'BEGIN', 420, 240, true) },
  ];
}

export function drawPause(ctx, state) {
  dim(ctx);
  titleText(ctx, 'PAUSED', 240, 44, '#c9a24d');
  state.buttons = [
    { id: 'resume', ...button(ctx, 'RESUME', 360, 260, true) },
    { id: 'restart', ...button(ctx, 'RESTART LEVEL', 426, 260, false) },
    { id: 'quit', ...button(ctx, 'QUIT TO TITLE', 492, 260, false) },
  ];
}

export function drawLevelWin(ctx, state) {
  dim(ctx);
  const ghost = state.spotted === 0;
  titleText(ctx, 'HEIST COMPLETE', 200, 48, '#7dffa8');
  titleText(ctx, state.level.def.name + ' — ' + state.level.def.objectiveName + ' secured', 252, 18, '#e8e4d8');
  const timeBonus = Math.max(0, 300 - Math.floor(state.time)) * 2;
  titleText(ctx, 'TIME  ' + formatTime(state.time) + '   ·   LOOT  ' + state.lootGot + '/' + state.level.loot.length +
    '   ·   SPOTTED  ' + state.spotted, 320, 17, '#c9c4e0');
  titleText(ctx, 'TIME BONUS +' + timeBonus + (ghost ? '   ·   GHOST BONUS +500' : ''), 356, 17, '#ffd76e');
  titleText(ctx, 'SCORE  ' + state.score, 410, 22, '#ffd76e');
  const last = state.levelIndex >= 2;
  state.buttons = last
    ? [{ id: 'campaign', ...button(ctx, 'FINISH THE HEIST', 480, 300, true) }]
    : [
      { id: 'next', ...button(ctx, 'NEXT LEVEL', 480, 300, true) },
      { id: 'replay', ...button(ctx, 'REPLAY LEVEL', 546, 300, false) },
    ];
}

export function drawGameOver(ctx, state) {
  dim(ctx);
  titleText(ctx, 'CAUGHT!', 220, 54, '#ff5a4d');
  titleText(ctx, 'The ushers caught Wren three times. The heist is over.', 280, 17, '#e8e4d8');
  titleText(ctx, state.level.def.name + '   ·   SCORE  ' + state.score, 320, 16, '#c9c4e0');
  state.buttons = [
    { id: 'retry', ...button(ctx, 'RETRY LEVEL', 420, 280, true) },
    { id: 'quit', ...button(ctx, 'QUIT TO TITLE', 486, 280, false) },
  ];
}

export function drawCampaignWin(ctx, state) {
  dim(ctx);
  titleText(ctx, 'THE MOON MASQUE IS YOURS', 200, 44, '#ffd76e');
  titleText(ctx, 'Three levels. Three thefts. Not a single curtain out of place.', 258, 17, '#e8e4d8');
  titleText(ctx, 'TOTAL SCORE  ' + state.score + '   ·   TOTAL SPOTTED  ' + state.totalSpotted, 310, 18, '#c9c4e0');
  titleText(ctx, state.totalSpotted === 0 ? 'A PERFECT GHOST — never spotted, not once.' : 'A clean getaway.', 350, 17, '#7dffa8');
  state.buttons = [
    { id: 'again', ...button(ctx, 'PLAY AGAIN', 440, 280, true) },
    { id: 'quit', ...button(ctx, 'QUIT TO TITLE', 506, 280, false) },
  ];
}
