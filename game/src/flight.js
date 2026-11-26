// Canyon Ridge Run — the flight model and the sortie state machine.
// One job: step the plane forward (throttle, pitch, bank, lift, fuel, rings,
// terrain, water and landings) and say what happened.

import { FLIGHT, HOME_RUNWAY, STEP, buildCourse, riverCenterX } from './config.js';
import { terrainHeight, isOverWater, runwayAt } from './world.js';
import { checkRingPass, markRingMissed } from './rings.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_OVER = 'over';
export const SCREEN_LANDED = 'landed';

export const EVENT_NONE = 0;
export const EVENT_RING = 1;
export const EVENT_CRASH = 2;
export const EVENT_LANDED = 4;
export const EVENT_LOW_FUEL = 8;

/** A fresh sortie: parked on the home runway, engine idling, full tank. */
export function freshState(seed) {
  return {
    seed,
    screen: SCREEN_TITLE,
    x: HOME_RUNWAY.x,
    y: 5.4,
    z: HOME_RUNWAY.z + 60,
    heading: 0, // 0 faces north (-Z), down the canyon
    pitch: 0,
    roll: 0,
    speed: 0,
    throttle: 0,
    fuel: FLIGHT.fuelStart,
    score: 0,
    ringsHit: 0,
    ringsTotal: 8,
    course: buildCourse(seed),
    nextRing: 0,
    message: '',
    messageUntil: 0,
    time: 0,
    distanceFlown: 0,
    airborne: false, // true once the plane has really left the ground
    crashedInto: '',
    lowFuelWarned: false,
    landedRunway: null,
  };
}

/** Forward vector for a heading (0 = -Z) with pitch applied. */
export function forwardVector(state) {
  const cp = Math.cos(state.pitch);
  return {
    x: -Math.sin(state.heading) * cp,
    y: Math.sin(state.pitch),
    z: -Math.cos(state.heading) * cp,
  };
}

/** Clamp a value into [min, max]. */
function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

/**
 * One fixed step of flight. `stick` is { pitch: -1..1, roll: -1..1,
 * throttleDelta: -1..1 } from keyboard/mouse; `ringMeshes` may be null in a
 * headless check. Returns an event bitmask.
 */
export function stepFlight(state, stick, ringMeshes) {
  if (state.screen !== SCREEN_PLAY) return EVENT_NONE;
  const dt = STEP;
  state.time += dt;
  let events = EVENT_NONE;

  // Throttle: Shift spools up, Space brakes; otherwise it holds.
  state.throttle = clamp(state.throttle + stick.throttleDelta * dt * 0.9, 0, 1);
  const targetSpeed = state.throttle * FLIGHT.maxSpeed;
  state.speed += clamp(targetSpeed - state.speed, -FLIGHT.accel * dt, FLIGHT.accel * dt);

  // Pitch and bank answer the stick at once, then ease back toward level.
  state.pitch = clamp(state.pitch + stick.pitch * FLIGHT.pitchRate * dt, -FLIGHT.maxPitch, FLIGHT.maxPitch);
  state.roll = clamp(state.roll + stick.roll * FLIGHT.rollRate * dt, -FLIGHT.maxRoll, FLIGHT.maxRoll);
  if (stick.pitch === 0) state.pitch += (0 - state.pitch) * Math.min(1, dt * 1.6);
  if (stick.roll === 0) state.roll += (0 - state.roll) * Math.min(1, dt * 1.2);

  // A banked turn swings the heading; a level plane flies straight.
  state.heading += -state.roll * FLIGHT.turnRate * dt * clamp(state.speed / FLIGHT.cruiseSpeed, 0, 1.4);

  // Move along the nose; slow flight sinks, fast flight holds its line.
  const fwd = forwardVector(state);
  let vertical = fwd.y * state.speed;
  if (state.speed < FLIGHT.stallSpeed) {
    vertical -= FLIGHT.sinkAtStall * (1 - state.speed / FLIGHT.stallSpeed);
  }
  const prevZ = state.z;
  const prevX = state.x;
  state.x += fwd.x * state.speed * dt;
  state.y += vertical * dt;
  state.z += fwd.z * state.speed * dt;
  state.distanceFlown += state.speed * dt;

  // Fuel: throttle drinks it; empty means gliding to whatever is below.
  if (state.throttle > 0 && state.fuel > 0) {
    state.fuel = Math.max(0, state.fuel - FLIGHT.fuelBurn * state.throttle * dt);
    if (state.fuel === 0) {
      state.throttle = 0;
      state.message = 'FUEL EMPTY — glide her down!';
      state.messageUntil = state.time + 4;
    }
  }
  if (state.fuel < 25 && !state.lowFuelWarned) {
    state.lowFuelWarned = true;
    events |= EVENT_LOW_FUEL;
    state.message = 'LOW FUEL — land at the north strip!';
    state.messageUntil = state.time + 4;
  }

  // Rings: flying the hoop scores and lights it green.
  if (ringMeshes) {
    const flown = checkRingPass(ringMeshes, state.nextRing, prevZ, state);
    if (flown) {
      state.ringsHit += 1;
      state.nextRing += 1;
      state.score += FLIGHT.ringScore;
      events |= EVENT_RING;
      state.message = `RING ${state.ringsHit}/${state.ringsTotal} — +${FLIGHT.ringScore}`;
      state.messageUntil = state.time + 2.5;
    } else {
      // Flew past the hoop without threading it: the gate is missed, move on
      // to the next one — never turn back into the canyon wall for it.
      const next = state.course[state.nextRing];
      if (next && prevZ >= next.z && state.z < next.z) {
        markRingMissed(ringMeshes, state.nextRing);
        state.nextRing += 1;
        state.message = 'MISSED RING — next gate!';
        state.messageUntil = state.time + 2;
      }
    }
  }

  // Ground and water: the canyon floor, the cliffs and the river all bite.
  const ground = terrainHeight(state.x, state.z);
  const strip = runwayAt(state.x, state.z);
  const gentle = Math.abs(state.pitch) < 0.16 && Math.abs(state.roll) < 0.3;
  if (state.y - ground > 10) state.airborne = true;
  if (state.y <= ground + FLIGHT.crashClearance) {
    if (strip && state.speed < 26 && gentle && state.airborne) {
      return landPlane(state, strip);
    }
    if (strip && state.speed < 30) {
      // Still on the takeoff roll (or rolling out): taxi along the strip.
      state.y = ground + FLIGHT.crashClearance;
      return events;
    }
    state.screen = SCREEN_OVER;
    state.crashedInto = isOverWater(state.x, state.z) ? 'the river' : 'the canyon wall';
    state.y = ground + 0.6;
    return events | EVENT_CRASH;
  }
  // Landing flare: slow, gentle and low over a strip counts as down, even a
  // couple of metres above the tarmac — the wheels are on the ground.
  if (strip && state.airborne && state.speed < 26 && gentle && state.y <= ground + 3.0) {
    return landPlane(state, strip);
  }
  if (state.y < 0.5) {
    state.screen = SCREEN_OVER;
    state.crashedInto = 'the river';
    return events | EVENT_CRASH;
  }
  // Out of the valley sideways: the plateau is a wall, not a shortcut.
  if (Math.abs(state.x - riverCenterX(state.z)) > 420 || state.z > 320 || state.z < -2150) {
    state.screen = SCREEN_OVER;
    state.crashedInto = 'the mountains';
    return events | EVENT_CRASH;
  }
  // Ceiling: thin air above 260 m pushes the nose down.
  if (state.y > 260) {
    state.y = 260;
    state.pitch = Math.min(state.pitch, -0.05);
  }
  return events;
}

function landPlane(state, strip) {
  state.screen = SCREEN_LANDED;
  state.landedRunway = strip === HOME_RUNWAY ? 'home' : 'north';
  const fuelBonus = Math.round(state.fuel);
  state.score += FLIGHT.landingScore + fuelBonus;
  state.y = terrainHeight(state.x, state.z) + 1.1;
  state.speed = 0;
  state.throttle = 0;
  return EVENT_LANDED;
}

/** Heading in degrees, 0 = north, clockwise. */
export function headingDegrees(state) {
  const deg = ((-state.heading * 180) / Math.PI) % 360;
  return deg < 0 ? deg + 360 : deg;
}

/** Height above the ground right now (metres). */
export function altitudeAboveGround(state) {
  return Math.max(0, state.y - terrainHeight(state.x, state.z));
}
