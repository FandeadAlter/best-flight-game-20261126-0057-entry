// Screenshot staging: each ?shot= scene plays the real rules forward from a
// fresh world for a fixed time, steered by a simple autopilot (bank toward the
// next ring or the runway centreline, pitch toward its height, throttle to
// hold speed), so the frame is what real play looks like and the same seed
// always gives the same frame.

import { COURSE, FLIGHT, RINGS } from './config.js';
import { EVENT_CRASH, EVENT_LANDED, EVENT_TIMEOUT, nextRing, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './physics.js';

const STEP = 1 / 60;
const DEG = Math.PI / 180;

function wrapAngle(a) {
  return ((a + 540) % 360) - 180;
}

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

// Steer the plane toward `target` {x, y, z} at the given throttle.
// A PD controller on heading (proportional + turn-rate damping) so the
// plane does not overshoot and weave, plus a crab back to the runway
// centreline on final.
let prevHeading = null;

export function autopilot(state, target, throttle) {
  const dx = target.x - state.x;
  const dz = target.z - state.z;
  let wantHeading = Math.atan2(dx, dz) / DEG;
  if (!nextRing(state)) {
    // On final, crab toward the centreline when off it.
    wantHeading += clamp(-state.x * 0.06, -18, 18);
  }
  const headingErr = wrapAngle(wantHeading - state.heading);
  const rate = prevHeading === null ? 0 : wrapAngle(state.heading - prevHeading) / STEP;
  prevHeading = state.heading;
  const roll = clamp(headingErr * 0.035 - rate * 0.05, -1, 1);
  const altErr = target.y - state.y;
  const pitch = clamp(altErr * 0.03, -1, 1);
  return {
    pitch,
    roll,
    throttle: 0,
    throttleSet: throttle,
    mouse: null,
    _slow: Math.hypot(dx, dz) < 200,
  };
}

function flyUntil(world, seconds, targetFn, throttle) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const state = world.state;
    if (state.screen !== SCREEN_PLAY) break;
    const target = targetFn(state);
    if (!target) break;
    const input = autopilot(state, target, throttle);
    if (input._slow) input.throttleSet = 0.42;
    world.step(STEP, input);
  }
}

// Where the autopilot aims: the next ring, then the runway threshold.
export function aimPoint(state) {
  const nxt = nextRing(state);
  if (nxt) return { x: nxt.ring.x, y: nxt.ring.y, z: nxt.ring.z };
  // Final: descend to a fix abeam the threshold, then a gentle 3-degree
  // glide down the centreline; past the threshold, settle onto the runway.
  const distToThreshold = COURSE.runway.z0 - state.z;
  if (distToThreshold > 300) return { x: 0, y: 45, z: COURSE.runway.z0 - 300 };
  if (distToThreshold <= 0) return { x: 0, y: 4, z: COURSE.runway.z0 + 800 };
  const y = clamp(4 + distToThreshold * 0.055, 6, 45);
  return { x: 0, y, z: COURSE.runway.z0 + 800 };
}

/**
 * Set `world` to the named scene and return the screen to draw.
 * start: title over the bay. play: mid-flight over the river with the city
 * ahead. final: on the glide slope with the runway ahead. win: landed.
 */
export function stageShot(name, world) {
  prevHeading = null;
  world.reset();
  const state = world.state;
  if (name === 'start') {
    world.toTitle();
    state.x = -40;
    state.y = 150;
    state.z = 0;
    state.heading = 0;
    state.speed = 85;
    state.throttle = 0.62;
    return { screen: SCREEN_TITLE };
  }
  if (name === 'play') {
    flyUntil(world, 55, aimPoint, 0.72);
    return { screen: state.screen };
  }
  if (name === 'city') {
    flyUntil(world, 75, aimPoint, 0.72);
    return { screen: state.screen };
  }
  if (name === 'final') {
    // Stop on short final, runway filling the view, before touchdown.
    flyUntil(world, 150, (s) => (s.z >= 5000 ? null : aimPoint(s)), 0.72);
    return { screen: state.screen };
  }
  if (name === 'win') {
    flyUntil(world, 220, aimPoint, 0.72);
    return { screen: state.screen };
  }
  return { screen: SCREEN_PLAY };
}

export { EVENT_CRASH, EVENT_LANDED, EVENT_TIMEOUT, SCREEN_OVER, SCREEN_WIN, FLIGHT, RINGS };
