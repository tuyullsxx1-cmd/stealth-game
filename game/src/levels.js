// levels.js — the three theatre levels: maps, patrols, loot, lights, exits.
// Tile size is 40 px. The world is 24 x 17 tiles (960 x 680 px), drawn at
// canvas offset (0, 48). Coordinates below are TILE coordinates (x 0..23,
// y 0..16). The border is always solid wall; interior solids come from the
// wall rects and crate tiles. Nothing here uses randomness: every level is
// fixed, so replays and screenshots are identical every time.

export const TILE = 40;
export const COLS = 24;
export const ROWS = 17;
export const WORLD_X = 0;
export const WORLD_Y = 48;

// Seeded helper, used only for cosmetic sparkle positions (never gameplay).
export function seededRandom(seed) {
  let s = seed >>> 0;
  return function next() {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function tileCenter(tx, ty) {
  return { x: WORLD_X + tx * TILE + TILE / 2, y: WORLD_Y + ty * TILE + TILE / 2 };
}

function rectTiles(x, y, w, h) {
  const out = [];
  for (let ty = y; ty < y + h; ty++) {
    for (let tx = x; tx < x + w; tx++) out.push([tx, ty]);
  }
  return out;
}

// Level definitions. guards carry waypoint loops in tile coords and a pause
// (seconds) at each waypoint. spotlights sweep a cone from a fixed pivot.
// lasers are beam tiles across a doorway, pulsing on a timer.
export const LEVEL_DEFS = [
  {
    name: 'THE LOBBY',
    number: 1,
    objectiveName: 'BRASS KEY',
    objectiveText: 'Steal the Brass Key, then reach the stage door',
    walls: [
      [10, 3, 3, 2], // ticket counter, north block
      [10, 6, 3, 1], // ticket counter, south block
      [6, 8, 1, 1], // pillar west
      [17, 8, 1, 1], // pillar east
    ],
    crates: [
      [15, 10], [16, 10], [15, 11],
      [20, 9], [20, 10],
    ],
    curtains: [
      [1, 5], [1, 6], [1, 7], [1, 8],
      [1, 11], [1, 12], [1, 13],
      [22, 6], [22, 7],
    ],
    seats: [],
    lamps: [[6, 3], [17, 3], [6, 13], [17, 13]],
    loot: [[4, 2], [20, 5], [8, 12], [21, 14]],
    objective: [20, 2],
    exit: [2, 15],
    playerStart: [12, 15],
    guards: [
      { name: 'USHER A', waypoints: [[8, 3], [8, 8], [13, 8], [13, 5], [8, 5]], pause: 1.2 },
      { name: 'USHER B', waypoints: [[4, 2], [20, 2], [20, 5], [4, 5]], pause: 1.0 },
      { name: 'USHER C', waypoints: [[5, 12], [19, 12], [19, 15], [5, 15]], pause: 1.0 },
    ],
    spotlights: [],
    lasers: [],
  },
  {
    name: 'THE AUDITORIUM',
    number: 2,
    objectiveName: 'STAR SCRIPT',
    objectiveText: 'Steal the Star Script from the stage, then reach the exit',
    walls: [],
    crates: [
      [5, 3], [6, 3],
      [18, 3], [19, 3],
      [5, 14], [18, 14],
    ],
    curtains: [
      [1, 3], [1, 4], [1, 5], [1, 6], [1, 7], [1, 8], [1, 9], [1, 10], [1, 11], [1, 12], [1, 13],
      [22, 3], [22, 4], [22, 5], [22, 6], [22, 7], [22, 8], [22, 9], [22, 10], [22, 11], [22, 12], [22, 13],
    ],
    seats: [
      ...rectTiles(4, 6, 7, 1), ...rectTiles(13, 6, 7, 1),
      ...rectTiles(4, 8, 7, 1), ...rectTiles(13, 8, 7, 1),
      ...rectTiles(4, 10, 7, 1), ...rectTiles(13, 10, 7, 1),
      ...rectTiles(4, 12, 7, 1), ...rectTiles(13, 12, 7, 1),
    ],
    lamps: [[4, 4], [19, 4], [4, 14], [19, 14]],
    loot: [[2, 8], [11, 9], [21, 8], [7, 13], [16, 13]],
    objective: [12, 2],
    exit: [11, 15],
    playerStart: [2, 15],
    guards: [
      { name: 'USHER A', waypoints: [[8, 2], [16, 2], [16, 4], [8, 4]], pause: 1.0 },
      { name: 'USHER B', waypoints: [[3, 5], [3, 14]], pause: 1.5 },
      { name: 'USHER C', waypoints: [[20, 5], [20, 14]], pause: 1.5 },
      { name: 'USHER D', waypoints: [[9, 7], [14, 7], [14, 11], [9, 11]], pause: 1.0 },
    ],
    spotlights: [
      { x: 12, y: 1, baseAngle: Math.PI / 2, sweep: 0.96, period: 7.0, range: 260 },
    ],
    lasers: [],
  },
  {
    name: 'THE BACKSTAGE VAULT',
    number: 3,
    objectiveName: 'MOON MASQUE',
    objectiveText: 'Steal the Moon Masque from the vault, then reach the exit',
    walls: [
      [17, 1, 6, 1], // vault north wall
      [17, 5, 6, 1], // vault south wall
      [22, 2, 1, 3], // vault east wall
    ],
    crates: [
      ...rectTiles(8, 2, 1, 4),
      ...rectTiles(15, 2, 1, 4),
      ...rectTiles(8, 10, 1, 4),
      ...rectTiles(15, 10, 1, 4),
      ...rectTiles(3, 8, 4, 1),
      ...rectTiles(17, 8, 4, 1),
    ],
    curtains: [
      [1, 3], [1, 4], [1, 5],
      [22, 12], [22, 13],
    ],
    seats: [],
    lamps: [[5, 2], [18, 8], [5, 14], [12, 5], [12, 12]],
    loot: [[3, 8], [12, 1], [21, 8], [6, 15], [18, 15]],
    objective: [20, 2],
    exit: [2, 15],
    playerStart: [2, 14],
    guards: [
      { name: 'USHER A', waypoints: [[18, 6], [22, 6], [22, 9], [18, 9]], pause: 1.0 },
      { name: 'USHER B', waypoints: [[4, 3], [13, 3], [13, 6], [4, 6]], pause: 1.0 },
      { name: 'USHER C', waypoints: [[10, 7], [10, 10], [13, 10], [13, 7]], pause: 1.2 },
      { name: 'USHER D', waypoints: [[5, 13], [18, 13]], pause: 1.5 },
      { name: 'USHER E', waypoints: [[3, 9], [6, 9], [6, 12], [3, 12]], pause: 1.0 },
    ],
    spotlights: [
      { x: 12, y: 8, baseAngle: 0, sweep: 1.05, period: 6.0, range: 260 },
      { x: 20, y: 12, baseAngle: Math.PI, sweep: 0.87, period: 8.0, range: 260 },
    ],
    lasers: [
      // The vault door gap at x = 17, y = 2..4: three pulsing beams.
      { x: 17, y: 2, phase: 0.0 },
      { x: 17, y: 3, phase: 0.7 },
      { x: 17, y: 4, phase: 1.4 },
    ],
  },
];

// Build the runtime level: solid/blocking tile sets and runtime entities.
export function buildLevel(index) {
  const def = LEVEL_DEFS[index];
  const solids = new Set();
  const key = (tx, ty) => tx + ',' + ty;
  for (let tx = 0; tx < COLS; tx++) {
    solids.add(key(tx, 0));
    solids.add(key(tx, ROWS - 1));
  }
  for (let ty = 0; ty < ROWS; ty++) {
    solids.add(key(0, ty));
    solids.add(key(COLS - 1, ty));
  }
  for (const [x, y, w, h] of def.walls) {
    for (const [tx, ty] of rectTiles(x, y, w, h)) solids.add(key(tx, ty));
  }
  for (const [tx, ty] of def.crates) solids.add(key(tx, ty));

  const curtains = new Set(def.curtains.map(([tx, ty]) => key(tx, ty)));
  const seats = new Set(def.seats.map(([tx, ty]) => key(tx, ty)));
  const blockers = new Set([...solids, ...curtains]);

  const loot = def.loot.map(([tx, ty]) => ({ ...tileCenter(tx, ty), tx, ty, taken: false }));
  const objectivePos = tileCenter(def.objective[0], def.objective[1]);
  const exitPos = tileCenter(def.exit[0], def.exit[1]);
  const startPos = tileCenter(def.playerStart[0], def.playerStart[1]);

  return {
    def,
    solids,
    blockers,
    curtains,
    seats,
    lamps: def.lamps.map(([tx, ty]) => tileCenter(tx, ty)),
    loot,
    objective: { ...objectivePos, taken: false },
    exit: exitPos,
    playerStart: startPos,
    key,
  };
}

export function isSolid(level, tx, ty) {
  return level.solids.has(level.key(tx, ty));
}

export function isBlocking(level, tx, ty) {
  return level.blockers.has(level.key(tx, ty));
}

export function tileAt(level, px, py) {
  const tx = Math.floor((px - WORLD_X) / TILE);
  const ty = Math.floor((py - WORLD_Y) / TILE);
  return { tx, ty };
}
