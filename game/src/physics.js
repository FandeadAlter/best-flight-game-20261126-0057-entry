// The flight model: arcade, but honest — speed comes from the throttle, the
// wing needs speed to fly, bank turns the aircraft, and the ground is solid.
// Pure logic (no DOM), so Node can test it.

import { COURSE, FLIGHT, RINGS, SCORING } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

export const EVENT_NONE = 0;
export const EVENT_RING = 1;
export const EVENT_NEAR_MISS = 2;
export const EVENT_CRASH = 4;
export const EVENT_LANDED = 8;
export const EVENT_TIMEOUT = 16;

const DEG = Math.PI / 180;

export function createWorld(terrain) {
  const state = freshState();

  function freshState() {
    return {
      screen: SCREEN_TITLE,
      x: COURSE.start.x,
      y: COURSE.start.y,
      z: COURSE.start.z,
      heading: COURSE.start.heading, // degrees, 0 = north (+z)
      pitch: 0, // degrees, + = nose up
      roll: 0, // degrees, + = bank right
      speed: COURSE.start.speed, // knots
      throttle: FLIGHT.startThrottle,
      verticalSpeed: 0, // metres per second, + = climbing
      timeLeft: FLIGHT.timeLimit,
      score: 0,
      ringsHit: 0,
      ringPassed: RINGS.map(() => false),
      nearMissed: RINGS.map(() => false),
      message: '',
      messageTime: 0,
      reason: '',
      landedSoft: false,
      time: 0,
      propAngle: 0,
      crashed: false,
    };
  }

  function reset() {
    const next = freshState();
    Object.keys(state).forEach((k) => { state[k] = next[k]; });
    state.screen = SCREEN_PLAY;
  }

  function toTitle() {
    const next = freshState();
    Object.keys(state).forEach((k) => { state[k] = next[k]; });
    state.screen = SCREEN_TITLE;
  }

  function showMessage(text, seconds = 2.2) {
    state.message = text;
    state.messageTime = seconds;
  }

  // input: { pitch: -1..1 (pull up = +1), roll: -1..1 (right = +1),
  //          throttle: -1..1 (up = +1), mouse: null | { pitch, roll } }
  // Returns an event bitmask.
  function step(dt, input) {
    if (state.screen !== SCREEN_PLAY) return EVENT_NONE;
    let events = EVENT_NONE;
    state.time += dt;
    state.timeLeft -= dt;
    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      state.screen = SCREEN_OVER;
      state.reason = 'Out of time — the tower closed the field.';
      return EVENT_TIMEOUT;
    }

    // --- controls ---
    const cmdPitch = input.mouse ? input.mouse.pitch : input.pitch;
    const cmdRoll = input.mouse ? input.mouse.roll : input.roll;
    const targetPitch = cmdPitch * FLIGHT.maxPitch;
    const targetRoll = cmdRoll * FLIGHT.maxRoll;
    const pitchRate = FLIGHT.pitchRate * dt;
    const rollRate = FLIGHT.rollRate * dt;
    state.pitch += Math.max(-pitchRate, Math.min(pitchRate, targetPitch - state.pitch));
    state.roll += Math.max(-rollRate, Math.min(rollRate, targetRoll - state.roll));

    // Throttle: keys nudge it, the mouse wheel nudges it in steps, and a
    // set value (the autopilot) takes it straight there.
    if (typeof input.throttleSet === 'number') {
      state.throttle = Math.max(0, Math.min(1, input.throttleSet));
    } else if (typeof input.throttleNudge === 'number' && input.throttleNudge !== 0) {
      state.throttle = Math.max(0, Math.min(1, state.throttle + input.throttleNudge));
    } else {
      state.throttle = Math.max(0, Math.min(1, state.throttle + input.throttle * dt * 0.55));
    }

    // --- speed ---
    const targetSpeed = FLIGHT.minSpeed
      + (FLIGHT.maxSpeed - FLIGHT.minSpeed) * state.throttle;
    const ds = targetSpeed - state.speed;
    state.speed += Math.max(-FLIGHT.accel * dt, Math.min(FLIGHT.accel * dt, ds));
    const stalled = state.speed < 55;

    // --- heading from bank: banking right (roll > 0) turns right (heading up). ---
    const turn = state.roll * FLIGHT.turnRate * (state.speed / FLIGHT.cruiseSpeed) * dt;
    state.heading = (state.heading + turn + 360) % 360;

    // --- vertical ---
    const speedMs = state.speed * 0.514444;
    let vs = speedMs * Math.sin(state.pitch * DEG) * FLIGHT.climbFactor;
    if (stalled) vs -= FLIGHT.sinkBelowStall;
    if (state.pitch < -2) vs *= 1.15; // a dive picks up sink honestly
    state.verticalSpeed = vs;
    state.y += vs * dt;

    // --- horizontal ---
    const hRad = state.heading * DEG;
    const forward = speedMs * Math.cos(state.pitch * DEG) * dt;
    state.x += Math.sin(hRad) * forward;
    state.z += Math.cos(hRad) * forward;

    // Stay inside the world: the bay and the hills fence the course in.
    if (state.x < -480) { state.x = -480; state.heading = (360 - state.heading + 360) % 360; }
    if (state.x > 480) { state.x = 480; state.heading = (360 - state.heading + 360) % 360; }
    if (state.z < -40) { state.z = -40; state.heading = (state.heading + 180) % 360; }
    if (state.z > 6100) { state.z = 6100; state.heading = (state.heading + 180) % 360; }

    state.propAngle = (state.propAngle + dt * (6 + state.throttle * 40)) % (Math.PI * 2);
    if (state.messageTime > 0) state.messageTime -= dt;

    // --- rings ---
    for (let i = 0; i < RINGS.length; i += 1) {
      const ring = RINGS[i];
      if (state.ringPassed[i] || state.nearMissed[i]) continue;
      const prevZ = state.z - Math.cos(hRad) * forward;
      if (prevZ < ring.z && state.z >= ring.z) {
        const dx = state.x - ring.x;
        const dy = state.y - ring.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= ring.r) {
          state.ringPassed[i] = true;
          state.ringsHit += 1;
          state.score += SCORING.ring;
          showMessage(`RING ${state.ringsHit} / ${RINGS.length}  +${SCORING.ring}`);
          events |= EVENT_RING;
        } else if (dist <= ring.r * 1.6) {
          state.nearMissed[i] = true;
          state.score += SCORING.nearMiss;
          showMessage(`NEAR MISS  +${SCORING.nearMiss}`);
          events |= EVENT_NEAR_MISS;
        }
      }
    }

    // --- ground ---
    const ground = terrain.height(state.x, state.z);
    const overRunway = state.x >= COURSE.runway.x0 && state.x <= COURSE.runway.x1
      && state.z >= COURSE.runway.z0 && state.z <= COURSE.runway.z1;
    if (state.y <= ground + 1.5) {
      state.y = ground + 1.5;
      if (overRunway && state.speed < 130 && state.verticalSpeed > -6 && Math.abs(state.roll) < 20) {
        // Touchdown. Roll out along the runway.
        const bonus = SCORING.landing + (state.verticalSpeed > -3 ? SCORING.landingSoftBonus : 0)
          + Math.round(state.timeLeft) * SCORING.timeBonusPerSecond;
        state.score += bonus;
        state.landedSoft = state.verticalSpeed > -3;
        state.screen = SCREEN_WIN;
        state.reason = `Landed at Cendrawasih Field — ${state.ringsHit}/${RINGS.length} rings, ${Math.round(state.timeLeft)}s to spare.`;
        events |= EVENT_LANDED;
      } else {
        state.screen = SCREEN_OVER;
        state.crashed = true;
        const where = terrain.type(state.x, state.z) === 'water'
          ? 'Ditched in the bay'
          : terrain.type(state.x, state.z) === 'city'
            ? 'Clipped a rooftop in town'
            : 'Hit the ground';
        state.reason = `${where} — ${state.ringsHit}/${RINGS.length} rings, score ${state.score}.`;
        events |= EVENT_CRASH;
      }
      return events;
    }

    // Low-altitude warning — not on a lined-up final approach, where being
    // low over the runway is the whole point.
    const onFinal = state.ringsHit === RINGS.length
      && Math.abs(state.x) < 60 && state.z > 4800;
    if (!onFinal && state.y - ground < 18 && state.messageTime <= 0) showMessage('PULL UP', 0.8);
    return events;
  }

  return { state, reset, toTitle, step };
}

// What the next ring is, for the HUD arrow and the autopilot.
export function nextRing(state) {
  for (let i = 0; i < RINGS.length; i += 1) {
    if (!state.ringPassed[i] && !state.nearMissed[i]) return { index: i, ring: RINGS[i] };
  }
  return null;
}
