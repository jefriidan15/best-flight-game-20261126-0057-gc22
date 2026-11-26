// Canyon Ridge Run — the game loop: scene, camera, states, overlays.
// One job: wire world, plane, rings, input, sound and HUD together, and run
// the frame loop (live play) or one frozen frame (a ?shot= scene).

import * as THREE from 'three';
import { GAME_TITLE, GAME_TAGLINE, STEP } from './config.js';
import { buildWorld } from './world.js';
import { buildAircraft, updateAircraftPose } from './aircraft.js';
import { buildRings, pulseNextRing } from './rings.js';
import {
  freshState, stepFlight, headingDegrees,
  EVENT_RING, EVENT_CRASH, EVENT_LANDED, EVENT_LOW_FUEL,
  SCREEN_TITLE, SCREEN_PLAY, SCREEN_OVER, SCREEN_LANDED,
} from './flight.js';
import { Input } from './input.js';
import { EngineAudio } from './audio.js';
import { Hud } from './hud.js';
import { stageShot, autopilotStick } from './shots.js';

const params = new URLSearchParams(window.location.search);
const SHOT = params.get('shot');
const SEED = Number(params.get('seed') || 1) || 1;
const SHOT_MODE = SHOT === 'start' || SHOT === 'play' || SHOT === 'end';

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.getElementById('scene').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 5000);

buildWorld(scene, SEED);
const aircraft = buildAircraft();
scene.add(aircraft.group);

const state = freshState(SEED);
const ringMeshes = buildRings(scene, state.course);
const input = new Input();
const audio = new EngineAudio();
const hud = new Hud();

input.onFirstGesture = () => audio.ensure();
input.attach();

let shotScreen = null;
if (SHOT_MODE) {
  shotScreen = stageShot(SHOT, state, ringMeshes).screen;
} else {
  showTitle();
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/** Chase camera: behind the tail, above the wing, looking down the nose. */
function placeCamera() {
  const back = 15;
  const up = 4.6;
  const heading = state.heading;
  const cx = state.x + Math.sin(heading) * back;
  const cz = state.z + Math.cos(heading) * back;
  const cy = state.y + up;
  // Smooth: the camera chases instead of snapping.
  camera.position.x += (cx - camera.position.x) * 0.12;
  camera.position.y += (cy - camera.position.y) * 0.12;
  camera.position.z += (cz - camera.position.z) * 0.12;
  const lookX = state.x - Math.sin(heading) * 26;
  const lookZ = state.z - Math.cos(heading) * 26;
  camera.up.set(Math.sin(state.roll) * -0.4, 1, 0);
  camera.lookAt(lookX, state.y + 1.5, lookZ);
}

/** Put the camera exactly behind the plane (used for the first frame / shots). */
function snapCamera() {
  camera.position.set(
    state.x + Math.sin(state.heading) * 15,
    state.y + 4.6,
    state.z + Math.cos(state.heading) * 15,
  );
  camera.lookAt(state.x - Math.sin(state.heading) * 26, state.y + 1.5, state.z - Math.cos(state.heading) * 26);
}

function showTitle() {
  state.screen = SCREEN_TITLE;
  hud.showOverlay(
    GAME_TITLE,
    `${GAME_TAGLINE}<br><br>Fly all <b>8 rings</b> down the canyon, then land on the north strip.`
    + `<br>Low fuel? Land early — a landing still scores.`
    + `<br><br><b>Arrows / WASD</b> pitch &amp; bank &nbsp;·&nbsp; <b>Shift</b> throttle up &nbsp;·&nbsp; <b>Space</b> brake`
    + `<br><b>Mouse</b> steers too &nbsp;·&nbsp; <b>R</b> fly again`,
    'Click or press Enter to take off',
  );
}

function showCrash() {
  audio.crashThud();
  audio.hush();
  hud.showOverlay(
    'CRASHED',
    `You flew into ${state.crashedInto}.<br><br>Score <b>${state.score}</b> &nbsp;·&nbsp; Rings <b>${state.ringsHit}/${state.ringsTotal}</b>`
    + `<br>Distance flown <b>${Math.round(state.distanceFlown)} m</b>`,
    'Press R or click to fly again',
  );
}

function showLanded() {
  audio.landThud();
  audio.hush();
  const where = state.landedRunway === 'north' ? 'the north strip' : 'the home runway';
  hud.showOverlay(
    'LANDED — SORTIE COMPLETE',
    `Down safe on ${where}.<br><br>Score <b>${state.score}</b> &nbsp;·&nbsp; Rings <b>${state.ringsHit}/${state.ringsTotal}</b>`
    + `<br>Fuel left <b>${Math.round(state.fuel)}%</b> &nbsp;·&nbsp; Distance <b>${Math.round(state.distanceFlown)} m</b>`,
    'Press R or click to fly again',
  );
}

function startFlight() {
  Object.assign(state, freshState(SEED));
  for (const entry of ringMeshes) {
    entry.hit = false;
    entry.mesh.material.color.setHex(0xffc53d);
    entry.mesh.material.emissive.setHex(0xffc53d);
    entry.beacon.material.color.setHex(0xffc53d);
    entry.beacon.material.emissive.setHex(0xffc53d);
  }
  state.screen = SCREEN_PLAY;
  state.throttle = 0.55;
  hud.showOverlay(null);
  snapCamera();
}

function handleEvents(events) {
  if (events & EVENT_RING) audio.chime();
  if (events & EVENT_LOW_FUEL) audio.chime();
  if (events & EVENT_CRASH) showCrash();
  if (events & EVENT_LANDED) showLanded();
}

let last = performance.now();
let accumulator = 0;

function frame(now) {
  requestAnimationFrame(frame);
  const elapsed = Math.min(0.1, (now - last) / 1000);
  last = now;

  if (SHOT_MODE) {
    // Frozen staged frame: same seed, same pixels, every load.
    updateAircraftPose(aircraft, state, 0);
    pulseNextRing(ringMeshes, state.nextRing, state.time);
    snapCamera();
    hud.update(state);
    if (shotScreen === SCREEN_TITLE) {
      hud.showOverlay(
        GAME_TITLE,
        `${GAME_TAGLINE}<br><br>Fly all <b>8 rings</b> down the canyon, then land on the north strip.`
        + `<br><br><b>Arrows / WASD</b> pitch &amp; bank &nbsp;·&nbsp; <b>Shift</b> throttle up &nbsp;·&nbsp; <b>Space</b> brake`,
        'Click or press Enter to take off',
      );
    } else if (shotScreen === SCREEN_OVER) {
      hud.showOverlay(
        'CRASHED',
        `You flew into ${state.crashedInto}.<br><br>Score <b>${state.score}</b> &nbsp;·&nbsp; Rings <b>${state.ringsHit}/${state.ringsTotal}</b>`,
        'Press R or click to fly again',
      );
    } else if (shotScreen === SCREEN_LANDED) {
      hud.showOverlay(
        'LANDED — SORTIE COMPLETE',
        `Down safe on the north strip.<br><br>Score <b>${state.score}</b> &nbsp;·&nbsp; Rings <b>${state.ringsHit}/${state.ringsTotal}</b>`,
        'Press R or click to fly again',
      );
    } else {
      // Mid-flight: no panel — the sky, the plane and the HUD are the shot.
      hud.showOverlay(null);
    }
    renderer.render(scene, camera);
    return;
  }

  const stick = input.poll();
  if (state.screen === SCREEN_TITLE && (stick.clicked || stick.restartPressed)) {
    startFlight();
  } else if ((state.screen === SCREEN_OVER || state.screen === SCREEN_LANDED)
    && (stick.clicked || stick.restartPressed)) {
    startFlight();
  }

  if (state.screen === SCREEN_PLAY) {
    accumulator += elapsed;
    let events = 0;
    while (accumulator >= STEP) {
      events |= stepFlight(state, stick, ringMeshes);
      accumulator -= STEP;
    }
    handleEvents(events);
    audio.setThrottle(state.throttle, state.speed);
  } else {
    audio.hush();
  }

  updateAircraftPose(aircraft, state, elapsed);
  pulseNextRing(ringMeshes, state.nextRing, state.time);
  placeCamera();
  hud.update(state);
  renderer.render(scene, camera);
}

snapCamera();
requestAnimationFrame(frame);

// Expose a tiny probe for play-testing: window.__canyon.state.
window.__canyon = { state, headingDegrees };
