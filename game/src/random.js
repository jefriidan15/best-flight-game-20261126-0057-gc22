// Canyon Ridge Run — deterministic randomness.
// One job: seeded generators so the same seed always builds the same valley.

/** mulberry32: a small fast seeded PRNG. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash a 2D integer lattice point to a stable 0..1 value. */
export function hash2(ix, iz, seed) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(seed, 2246822519)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

/** Smooth value noise in 2D, built from hash2 so it never needs stored state. */
export function valueNoise2(x, z, seed) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = smooth(x - ix);
  const fz = smooth(z - iz);
  const a = hash2(ix, iz, seed);
  const b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed);
  const d = hash2(ix + 1, iz + 1, seed);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}

/** Two-octave rolling-hills noise, roughly -1..1. */
export function hillsNoise(x, z, seed) {
  const coarse = valueNoise2(x * 0.004, z * 0.004, seed) * 2 - 1;
  const fine = valueNoise2(x * 0.016 + 7.3, z * 0.016 + 2.9, seed + 11) * 2 - 1;
  return coarse * 0.75 + fine * 0.25;
}
