// Canyon Ridge Run — the glowing target rings.
// One job: build the ring gates, glow the next one, and call a ring flown when
// the plane passes through its hoop.

import * as THREE from 'three';
import { FLIGHT } from './config.js';

const RING_GOLD = 0xffc53d;
const RING_DONE = 0x51e07a;

/** Build one torus hoop per course ring. Returns the meshes, in course order. */
export function buildRings(scene, course) {
  const meshes = [];
  for (const ring of course) {
    const geo = new THREE.TorusGeometry(FLIGHT.ringRadius, 1.1, 12, 40);
    const mat = new THREE.MeshStandardMaterial({
      color: RING_GOLD, emissive: RING_GOLD, emissiveIntensity: 1.4,
      roughness: 0.35, metalness: 0.2, transparent: true, opacity: 0.95,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(ring.x, ring.y, ring.z);
    // Hoops stand vertical, facing the oncoming plane (their plane is X-Y).
    mesh.rotation.y = 0;
    scene.add(mesh);
    // A small beacon light above each hoop so it reads from far away.
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(1.4, 10, 10),
      new THREE.MeshStandardMaterial({ color: RING_GOLD, emissive: RING_GOLD, emissiveIntensity: 2.5 }),
    );
    beacon.position.set(ring.x, ring.y + FLIGHT.ringRadius + 5, ring.z);
    scene.add(beacon);
    meshes.push({ mesh, beacon, ring, hit: false });
  }
  return meshes;
}

/** Dim a missed hoop grey so the pilot can see it is gone. */
export function markRingMissed(ringMeshes, index) {
  const entry = ringMeshes[index];
  if (!entry || entry.hit) return;
  entry.hit = true; // never the next target again; checkRingPass skips hit rings
  entry.missed = true;
  entry.mesh.material.color.setHex(0x8a949e);
  entry.mesh.material.emissive.setHex(0x2a3138);
  entry.mesh.material.emissiveIntensity = 0.4;
  entry.beacon.material.color.setHex(0x8a949e);
  entry.beacon.material.emissive.setHex(0x2a3138);
}

export function pulseNextRing(ringMeshes, nextIndex, time) {
  for (let i = 0; i < ringMeshes.length; i += 1) {
    const entry = ringMeshes[i];
    if (entry.hit) continue;
    const isNext = i === nextIndex;
    const pulse = isNext ? 1.15 + Math.sin(time * 5) * 0.35 : 0.85;
    entry.mesh.material.emissiveIntensity = pulse;
    entry.mesh.scale.setScalar(isNext ? 1 + Math.sin(time * 5) * 0.03 : 1);
  }
}

/**
 * Check whether the plane just flew through the next ring. A pass counts when
 * the plane crosses the ring's z-plane within the hoop (plus a small margin).
 * Returns the ring when one is flown, else null.
 */
export function checkRingPass(ringMeshes, nextIndex, prevZ, state) {
  if (nextIndex >= ringMeshes.length) return null;
  const entry = ringMeshes[nextIndex];
  const z = entry.ring.z;
  const crossed = (prevZ - z) * (state.z - z) <= 0 && prevZ !== state.z;
  if (!crossed) return null;
  const dx = state.x - entry.ring.x;
  const dy = state.y - entry.ring.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > FLIGHT.ringRadius + 2.5) return null;
  entry.hit = true;
  entry.mesh.material.color.setHex(RING_DONE);
  entry.mesh.material.emissive.setHex(RING_DONE);
  entry.beacon.material.color.setHex(RING_DONE);
  entry.beacon.material.emissive.setHex(RING_DONE);
  return entry.ring;
}
