// Canyon Ridge Run — the aircraft: a little orange bush plane, built from parts.
// One job: build the plane mesh and pose it from the flight state.

import * as THREE from 'three';

const PAINT = 0xe8590c; // burnt orange
const PAINT_DARK = 0xb23c05;
const CREAM = 0xf5ead6;
const GLASS = 0x1d3a4d;

/** Build the plane. It faces -Z (north) when heading is 0. Returns { group, propeller }. */
export function buildAircraft() {
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: PAINT, roughness: 0.55, metalness: 0.15 });
  const dark = new THREE.MeshStandardMaterial({ color: PAINT_DARK, roughness: 0.6, metalness: 0.1 });
  const cream = new THREE.MeshStandardMaterial({ color: CREAM, roughness: 0.7 });
  const glass = new THREE.MeshStandardMaterial({ color: GLASS, roughness: 0.15, metalness: 0.6 });
  const tyre = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.95 });

  // Fuselage: a tapered body, nose forward (-Z).
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.55, 5.6, 12), paint);
  body.rotation.x = Math.PI / 2;
  body.position.set(0, 0, 0.4);
  group.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.5, 12), dark);
  nose.rotation.x = -Math.PI / 2;
  nose.position.set(0, 0, -2.9);
  group.add(nose);
  // Belly stripe.
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.22, 4.6), cream);
  stripe.position.set(0, -0.62, 0.5);
  group.add(stripe);
  // Canopy: a glass bubble the pilot sits under.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.78, 16, 12), glass);
  canopy.scale.set(1, 0.72, 1.7);
  canopy.position.set(0, 0.72, -0.4);
  group.add(canopy);
  // Main wing (high wing) and tailplane.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(10.4, 0.22, 1.9), cream);
  wing.position.set(0, 0.55, -0.3);
  group.add(wing);
  const wingTipL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.26, 1.9), paint);
  wingTipL.position.set(-5.2, 0.55, -0.3);
  group.add(wingTipL);
  const wingTipR = wingTipL.clone();
  wingTipR.position.x = 5.2;
  group.add(wingTipR);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.18, 1.2), paint);
  tail.position.set(0, 0.25, 3.1);
  group.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.5, 1.4), paint);
  fin.position.set(0, 0.85, 3.15);
  group.add(fin);
  // Fixed gear with chunky bush tyres.
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.0, 0.14), dark);
    leg.position.set(side * 0.75, -0.95, -0.6);
    leg.rotation.z = side * 0.25;
    group.add(leg);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.3, 12), tyre);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(side * 1.0, -1.45, -0.6);
    group.add(wheel);
  }
  // Propeller: two blades on a spinner, spun by updateAircraftPose.
  const propeller = new THREE.Group();
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.7, 10), cream);
  spinner.rotation.x = -Math.PI / 2;
  spinner.position.set(0, 0, -3.75);
  propeller.add(spinner);
  for (const angle of [0, Math.PI]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.34, 2.6, 0.1), dark);
    blade.position.set(0, 0, -3.7);
    blade.rotation.z = angle;
    propeller.add(blade);
  }
  propeller.position.set(0, 0, 0);
  group.add(propeller);
  // Navigation lights: red left, green right, white tail — small and emissive.
  const navLights = [
    [0xff2a2a, -5.45, 0.55, -0.3],
    [0x2aff66, 5.45, 0.55, -0.3],
    [0xffffff, 0, 0.3, 3.8],
  ];
  for (const [color, x, y, z] of navLights) {
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 8, 8),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2.2 }),
    );
    lamp.position.set(x, y, z);
    group.add(lamp);
  }
  group.traverse((child) => {
    if (child.isMesh) child.castShadow = false;
  });
  return { group, propeller };
}

/**
 * Pose the plane from the flight state: position, heading (yaw), pitch and bank.
 * The propeller spins faster with throttle.
 */
export function updateAircraftPose(aircraft, state, dt) {
  const { group, propeller } = aircraft;
  group.position.set(state.x, state.y, state.z);
  group.rotation.order = 'YXZ';
  group.rotation.y = state.heading;
  group.rotation.x = state.pitch;
  group.rotation.z = -state.roll;
  propeller.rotation.z += dt * (4 + state.throttle * 42);
}
