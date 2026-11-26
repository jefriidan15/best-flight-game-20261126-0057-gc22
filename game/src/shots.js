// Canyon Ridge Run — deterministic screenshot scenes.
// One job: stage ?shot=start|play|end by playing the real rules forward from a
// fresh sortie with a simple autopilot, so the same seed always gives the same
// frame. Shot mode freezes after staging: the frame never drifts.

import { STEP, FLIGHT } from './config.js';
import {
  stepFlight, EVENT_CRASH, EVENT_LANDED,
  SCREEN_TITLE, SCREEN_PLAY, SCREEN_OVER, SCREEN_LANDED,
} from './flight.js';

const START_IDLE_SECONDS = 2;
const PLAY_SECONDS = 24;
const END_LIMIT_SECONDS = 240;
const SAMPLE = STEP;

/**
 * Steer toward the next ring (or the far runway once the rings are done):
 * bank toward the target's bearing, pitch toward its height, full throttle
 * until close, then ease off for the landing.
 */
export function autopilotStick(state) {
  // After the last ring, aim PAST the far strip (z=-2100) so the bearing
  // stays north instead of swinging wildly as the strip's centre draws near.
  const target = state.nextRing < state.course.length
    ? state.course[state.nextRing]
    : { x: 0, y: 30, z: -2100 };
  const dx = target.x - state.x;
  const dz = target.z - state.z;
  const wantedHeading = Math.atan2(-dx, -dz);
  let turn = wantedHeading - state.heading;
  while (turn > Math.PI) turn -= Math.PI * 2;
  while (turn < -Math.PI) turn += Math.PI * 2;
  // The flight model reads the stick as a RATE (hold up and the nose keeps
  // rising), so convert the wanted bank/pitch angles into rate commands that
  // drive the current angle toward the target and then hold it there.
  const targetRoll = Math.max(-0.8, Math.min(0.8, -turn * 1.6));
  const roll = Math.max(-1, Math.min(1, (targetRoll - state.roll) * 4));
  const dist = Math.sqrt(dx * dx + dz * dz);
  const ringsDone = state.nextRing >= state.course.length;
  // Glide slope is measured to the strip itself, not to the aim point past it.
  const stripDist = ringsDone ? Math.hypot(state.x - 0, state.z + 1930) : dist;
  // On final approach, glide down to the strip instead of holding ring height.
  // A steeper slope (0.12) ending at 4.6 m so the wheels reach the strip
  // while it is still underneath; the gain is higher on final so the plane
  // tracks the slope instead of lagging above it.
  const wantedAlt = ringsDone && stripDist < 520 ? 4.6 + stripDist * 0.12 : target.y + 6;
  const altErr = wantedAlt - state.y;
  const altGain = ringsDone ? 0.9 : 0.45;
  const vsWanted = Math.max(-9, Math.min(9, altErr * altGain));
  const speedForPitch = Math.max(12, state.speed);
  const targetPitch = Math.max(-0.35, Math.min(0.35,
    Math.asin(Math.max(-0.9, Math.min(0.9, vsWanted / speedForPitch)))));
  const pitch = Math.max(-1, Math.min(1, (targetPitch - state.pitch) * 4));
  const nearRunway = ringsDone && stripDist < 200;
  // Cruise the canyon at 32 m/s: slow enough to line up each gate, fast
  // enough to feel like flying. (A human pilot may push full throttle.)
  // Throttle both up and down to hold the cruise speed.
  const throttleDelta = nearRunway ? (state.speed > 24 ? -1 : state.speed < 20 ? 0.5 : 0)
    : state.speed < 30 ? 1 : state.speed > 34 ? -1 : 0;
  return { pitch, roll, throttleDelta };
}

/**
 * Stage the named scene on a fresh state and return the screen to show.
 * The caller renders this state frozen; nothing advances after staging.
 */
export function stageShot(name, state, ringMeshes) {
  if (name !== 'play' && name !== 'end') {
    // Start: parked on the home runway, engine idling, title up.
    state.screen = SCREEN_TITLE;
    state.throttle = 0.15;
    for (let i = 0; i < START_IDLE_SECONDS / SAMPLE; i += 1) {
      state.time += SAMPLE;
    }
    return { screen: SCREEN_TITLE };
  }
  state.screen = SCREEN_PLAY;
  state.throttle = 0.7;
  const limit = name === 'end' ? END_LIMIT_SECONDS : PLAY_SECONDS;
  for (let t = 0; t < limit; t += SAMPLE) {
    const events = stepFlight(state, autopilotStick(state), ringMeshes);
    if (events & EVENT_CRASH) break;
    if (events & EVENT_LANDED) break;
    if (name === 'play' && state.nextRing >= 3) break;
  }
  if (state.screen === SCREEN_OVER) return { screen: SCREEN_OVER };
  if (state.screen === SCREEN_LANDED) return { screen: SCREEN_LANDED };
  return { screen: SCREEN_PLAY };
}
