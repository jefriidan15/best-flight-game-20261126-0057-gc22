// Canyon Ridge Run — the valley: terrain, river, runways, sky.
// One job: build every static piece of the world and answer "how high is the
// ground here?" so flight, rendering and collision all agree.

import * as THREE from 'three';
import { WORLD, HOME_RUNWAY, FAR_RUNWAY, riverCenterX } from './config.js';
import { hillsNoise, mulberry32 } from './random.js';

const TERRAIN_SEED = 20261126;

/** Height of the ground at (x, z): river floor, steep canyon walls, high plateau. */
export function terrainHeight(x, z) {
  const riverX = riverCenterX(z);
  const d = Math.abs(x - riverX);
  const hills = hillsNoise(x, z, TERRAIN_SEED);
  const plateau = WORLD.plateauHeight + hills * 22;
  // Canyon profile: flat riverbed, then a smooth steep rise to the plateau.
  const t = Math.min(1, Math.max(0, (d - 26) / (WORLD.canyonHalfWidth - 26)));
  const canyon = 1.5 + (plateau - 1.5) * (t * t * (3 - 2 * t));
  let h = canyon;
  h = flattenNearRunway(h, x, z, HOME_RUNWAY);
  h = flattenNearRunway(h, x, z, FAR_RUNWAY);
  return h;
}

function flattenNearRunway(h, x, z, runway) {
  const dx = Math.abs(x - runway.x);
  const dz = Math.abs(z - runway.z);
  const padX = runway.width / 2 + 34;
  const padZ = runway.length / 2 + 34;
  if (dx > padX || dz > padZ) return h;
  const edge = Math.max(dx / padX, dz / padZ);
  const blend = edge < 0.55 ? 1 : 1 - (edge - 0.55) / 0.45;
  const smoothBlend = blend * blend * (3 - 2 * blend);
  return h + (4.0 - h) * smoothBlend;
}

/** True when (x, z) is over open river water (not the runway flats). */
export function isOverWater(x, z) {
  const d = Math.abs(x - riverCenterX(z));
  return d < 24 && terrainHeight(x, z) < WORLD.waterLevel + 1.2;
}

/** True when (x, z) is on a runway strip (either end of the course). */
export function runwayAt(x, z) {
  for (const r of [HOME_RUNWAY, FAR_RUNWAY]) {
    if (Math.abs(x - r.x) <= r.width / 2 + 2 && Math.abs(z - r.z) <= r.length / 2 + 2) return r;
  }
  return null;
}

function terrainColor(x, z, h, slope) {
  const c = new THREE.Color();
  if (h < 4.5) c.setHex(0xc2a878); // sandy riverbank
  else if (slope > 0.55) c.setHex(0x8a6f52); // bare cliff rock
  else if (h > 95) c.setHex(0xe8eef2); // snow on the high tops
  else if (h > 55) c.setHex(0x7d8a6a); // high scrub
  else c.setHex(0x5d7d46); // valley grass
  // Gentle variation so the ground never reads flat.
  const v = 0.92 + hillsNoise(x * 3.1, z * 3.1, 7) * 0.08;
  c.multiplyScalar(v);
  return c;
}

function buildTerrain(scene) {
  const geo = new THREE.PlaneGeometry(WORLD.width, WORLD.length, 190, 210);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const centerZ = (WORLD.northEdge + WORLD.southEdge) / 2;
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const z = pos.getZ(i) + centerZ;
    const h = terrainHeight(x, z);
    pos.setY(i, h);
    pos.setZ(i, z);
    const hEast = terrainHeight(x + 6, z);
    const hNorth = terrainHeight(x, z + 6);
    const slope = Math.max(Math.abs(hEast - h), Math.abs(hNorth - h)) / 6;
    const c = terrainColor(x, z, h, slope);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, 0, 0);
  scene.add(mesh);
}

function buildRiver(scene) {
  // A ribbon of water following the river's meander down the canyon floor.
  const segments = 120;
  const positions = [];
  const indices = [];
  for (let i = 0; i <= segments; i += 1) {
    const z = WORLD.southEdge - ((WORLD.southEdge - WORLD.northEdge) * i) / segments;
    const cx = riverCenterX(z);
    positions.push(cx - 24, WORLD.waterLevel, z, cx + 24, WORLD.waterLevel, z);
    if (i < segments) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    color: 0x2f7fb8, roughness: 0.25, metalness: 0.1,
    transparent: true, opacity: 0.9,
  });
  scene.add(new THREE.Mesh(geo, mat));
}

function buildRunwayMesh(scene, runway, label) {
  const group = new THREE.Group();
  const strip = new THREE.Mesh(
    new THREE.PlaneGeometry(runway.width, runway.length),
    new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: 0.9 }),
  );
  strip.rotation.x = -Math.PI / 2;
  strip.position.set(runway.x, 4.15, runway.z);
  group.add(strip);
  // Centreline dashes and threshold bars, painted as thin white boxes.
  const dashMat = new THREE.MeshStandardMaterial({ color: 0xf2f2e8, roughness: 0.8 });
  for (let dz = -runway.length / 2 + 14; dz < runway.length / 2 - 8; dz += 18) {
    const dash = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.06, 7), dashMat);
    dash.position.set(runway.x, 4.22, runway.z + dz);
    group.add(dash);
  }
  // Edge lights: small amber posts along both sides.
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xffb020, emissive: 0xff9a00, emissiveIntensity: 1.6 });
  for (let dz = -runway.length / 2 + 6; dz <= runway.length / 2 - 6; dz += 22) {
    for (const side of [-1, 1]) {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 8), lightMat);
      lamp.position.set(runway.x + side * (runway.width / 2 + 1.5), 4.6, runway.z + dz);
      group.add(lamp);
    }
  }
  group.userData.label = label;
  scene.add(group);
}

function buildMountains(scene, rng) {
  const rock = new THREE.MeshStandardMaterial({ color: 0x6f7d8c, roughness: 1, flatShading: true });
  const snow = new THREE.MeshStandardMaterial({ color: 0xf4f8fb, roughness: 0.9, flatShading: true });
  for (let i = 0; i < 26; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    const x = side * (820 + rng() * 420);
    const z = 500 - rng() * 2600;
    const h = 220 + rng() * 260;
    const r = 180 + rng() * 160;
    const peak = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), rock);
    peak.position.set(x, h / 2 - 10, z);
    scene.add(peak);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.34, h * 0.3, 7), snow);
    cap.position.set(x, h * 0.85 - 10, z);
    scene.add(cap);
  }
}

function buildClouds(scene, rng) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.92 });
  for (let i = 0; i < 34; i += 1) {
    const puff = new THREE.Group();
    const n = 3 + Math.floor(rng() * 3);
    for (let j = 0; j < n; j += 1) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(9 + rng() * 12, 10, 8), mat);
      s.position.set((rng() - 0.5) * 34, (rng() - 0.5) * 5, (rng() - 0.5) * 18);
      s.scale.y = 0.55;
      puff.add(s);
    }
    puff.position.set((rng() - 0.5) * 1900, 130 + rng() * 90, 500 - rng() * 2500);
    scene.add(puff);
  }
}

function buildSunAndSky(scene) {
  scene.background = new THREE.Color(0x8ec3e8);
  scene.fog = new THREE.Fog(0x9fc8e8, 500, 2400);
  const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x6a7a55, 1.15);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2d0, 1.9);
  sun.position.set(420, 620, 300);
  scene.add(sun);
  // The sun itself: a bright disc high in the sky, ahead-left of the course.
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(46, 32),
    new THREE.MeshBasicMaterial({ color: 0xfff6c8, fog: false }),
  );
  disc.position.set(-620, 520, -1900);
  disc.lookAt(0, 0, 0);
  scene.add(disc);
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(70, 32),
    new THREE.MeshBasicMaterial({ color: 0xfff6c8, transparent: true, opacity: 0.25, fog: false }),
  );
  halo.position.copy(disc.position).multiplyScalar(1.001);
  halo.lookAt(0, 0, 0);
  scene.add(halo);
}

/** Build the whole static world into `scene`. Returns nothing; queries use terrainHeight. */
export function buildWorld(scene, seed) {
  const rng = mulberry32(seed);
  buildSunAndSky(scene);
  buildTerrain(scene);
  buildRiver(scene);
  buildRunwayMesh(scene, HOME_RUNWAY, 'Ridgefield Home');
  buildRunwayMesh(scene, FAR_RUNWAY, 'Ridgefield North');
  buildMountains(scene, rng);
  buildClouds(scene, rng);
}
