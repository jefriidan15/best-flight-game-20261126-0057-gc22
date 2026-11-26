// Canyon Ridge Run — shared tuning and course definition.
// One job: every number the rest of the game agrees on lives here.

export const GAME_TITLE = 'Canyon Ridge Run';
export const GAME_TAGLINE = 'Thread the rings. Mind the river. Land the strip.';

// World extents (metres). The canyon river runs north, toward -Z.
export const WORLD = {
  width: 2400,
  length: 2600,
  northEdge: -2000,
  southEdge: 600,
  waterLevel: 2.5,
  plateauHeight: 62,
  canyonHalfWidth: 120,
};

// The home runway (start) and the destination strip (finish).
export const HOME_RUNWAY = { x: 0, z: 60, length: 190, width: 20, heading: 0 };
export const FAR_RUNWAY = { x: 0, z: -1930, length: 190, width: 20, heading: 0 };

// Flight model tuning.
export const FLIGHT = {
  maxSpeed: 58, // m/s at full throttle
  cruiseSpeed: 38,
  stallSpeed: 17,
  accel: 14, // m/s^2 toward target speed
  pitchRate: 0.9, // rad/s at full stick
  rollRate: 1.9, // rad/s at full stick
  maxPitch: 0.55,
  maxRoll: 1.1,
  turnRate: 0.7, // heading rad/s per unit of bank
  sinkAtStall: 9, // m/s extra sink below stall speed
  fuelBurn: 0.32, // %/s at full throttle
  fuelStart: 100,
  crashClearance: 1.1, // metres above terrain before impact
  ringRadius: 15,
  ringScore: 100,
  landingScore: 500,
};

export const STEP = 1 / 60;

/** Ring course: eight glowing gates down the canyon, then the far strip. */
export function buildCourse(seed) {
  const rings = [];
  for (let i = 0; i < 8; i += 1) {
    const z = -260 - i * 205;
    rings.push({
      index: i,
      x: riverCenterX(z) + ringOffset(seed, i),
      y: 30 + ringAltitude(seed, i),
      z,
    });
  }
  return rings;
}

/** The river meanders down the canyon; the course follows it. */
export function riverCenterX(z) {
  return 60 * Math.sin(z * 0.0012) + 25 * Math.sin(z * 0.0031 + 1.7);
}

function ringOffset(seed, i) {
  return seededJitter(seed, i, 0) * 70 - 35;
}

function ringAltitude(seed, i) {
  return seededJitter(seed, i, 1) * 20;
}

/** Deterministic 0..1 jitter from (seed, index, channel); no RNG state needed. */
export function seededJitter(seed, index, channel) {
  let h = (seed * 374761393 + index * 668265263 + channel * 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}
