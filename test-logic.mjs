// Node logic tests for Cendrawasih Coast Run (physics + terrain, no DOM).
// Run: node test-logic.mjs — exits non-zero on any failure.
import { createRandom } from './game/src/random.js';
import { createTerrain, riverX } from './game/src/terrain.js';
import { createWorld, EVENT_CRASH, EVENT_LANDED, EVENT_RING, EVENT_TIMEOUT, SCREEN_OVER, SCREEN_PLAY, SCREEN_WIN } from './game/src/physics.js';
import { COURSE, RINGS } from './game/src/config.js';

let pass = 0;
let fail = 0;
function check(name, cond, extra = '') {
  if (cond) { pass += 1; console.log(`PASS ${name}`); }
  else { fail += 1; console.log(`FAIL ${name} ${extra}`); }
}

const terrain = createTerrain(createRandom(1));

// --- terrain ---
check('runway is flat at 4m', terrain.height(0, 5500) === 4);
check('bay is water below zero', terrain.height(-300, 1000) < 0);
check('bay type is water', terrain.type(-300, 1000) === 'water');
check('city ground is 6m', terrain.height(150, 4200) === 6);
check('city type is city', terrain.type(150, 4200) === 'city');
check('runway type is runway', terrain.type(0, 5500) === 'runway');
check('river carves water', terrain.type(riverX(3400), 3400) === 'water' && terrain.height(riverX(3400), 3400) < 0, `riverX(3400)=${riverX(3400).toFixed(1)}`);
check('hills rise inland', terrain.height(450, 1000) > 20);
check('buildings exist in the city', terrain.buildings.length > 40, `got ${terrain.buildings.length}`);
check('trees exist', terrain.trees.length > 100, `got ${terrain.trees.length}`);

// --- flight: straight and level, throttle up ---
{
  const world = createWorld(terrain);
  world.reset();
  const s = world.state;
  for (let i = 0; i < 60 * 60; i += 1) {
    world.step(1 / 60, { pitch: 0, roll: 0, throttle: 0, throttleSet: 0.72, mouse: null });
  }
  check('plane advances north', s.z > 2000, `z=${s.z.toFixed(0)}`);
  check('plane stays airborne', s.y > 50, `y=${s.y.toFixed(1)}`);
  check('still playing after 60s level', s.screen === SCREEN_PLAY, s.screen);
  check('speed near cruise', s.speed > 80 && s.speed < 140, `speed=${s.speed.toFixed(1)}`);
}

// --- ring pass ---
{
  const world = createWorld(terrain);
  world.reset();
  const s = world.state;
  const ring = RINGS[0];
  s.x = ring.x; s.y = ring.y; s.z = ring.z - 30; s.heading = 0; s.speed = 95; s.throttle = 0.7;
  let events = 0;
  for (let i = 0; i < 120; i += 1) {
    events |= world.step(1 / 60, { pitch: 0, roll: 0, throttle: 0, throttleSet: 0.7, mouse: null });
    if (events & EVENT_RING) break;
  }
  check('flying through ring 1 scores it', (events & EVENT_RING) !== 0 && s.ringPassed[0]);
  check('ring adds 100 points', s.score === 100, `score=${s.score}`);
}

// --- stall and sink ---
{
  const world = createWorld(terrain);
  world.reset();
  const s = world.state;
  s.speed = 40; s.throttle = 0; s.y = 200;
  const y0 = s.y;
  for (let i = 0; i < 5 * 60; i += 1) {
    world.step(1 / 60, { pitch: 0, roll: 0, throttle: 0, throttleSet: 0, mouse: null });
    if (s.screen !== SCREEN_PLAY) break;
  }
  check('stalled plane sinks', s.y < y0 - 20, `y ${y0.toFixed(1)} -> ${s.y.toFixed(1)}`);
}

// --- crash into the ground ---
{
  const world = createWorld(terrain);
  world.reset();
  const s = world.state;
  s.y = terrain.height(100, 500) + 3; s.z = 500; s.x = 100; s.speed = 90; s.pitch = -20;
  let events = 0;
  for (let i = 0; i < 5 * 60; i += 1) {
    events |= world.step(1 / 60, { pitch: -1, roll: 0, throttle: 0, throttleSet: 0.6, mouse: null });
    if (events & EVENT_CRASH) break;
  }
  check('diving into terrain crashes', (events & EVENT_CRASH) !== 0 && s.screen === SCREEN_OVER);
}

// --- landing on the runway ---
{
  const world = createWorld(terrain);
  world.reset();
  const s = world.state;
  s.x = 0; s.z = 5300; s.y = 8; s.heading = 0; s.speed = 90; s.throttle = 0.3;
  s.pitch = -2; s.verticalSpeed = -2;
  let events = 0;
  for (let i = 0; i < 10 * 60; i += 1) {
    events |= world.step(1 / 60, { pitch: -0.1, roll: 0, throttle: 0, throttleSet: 0.25, mouse: null });
    if (events & EVENT_LANDED) break;
  }
  check('gentle runway touchdown lands', (events & EVENT_LANDED) !== 0 && s.screen === SCREEN_WIN, `screen=${s.screen} y=${s.y.toFixed(1)}`);
  check('landing pays a bonus', s.score >= 500, `score=${s.score}`);
}

// --- banking right turns right; banking left turns left ---
{
  const world = createWorld(terrain);
  world.reset();
  const s = world.state;
  s.speed = 100;
  for (let i = 0; i < 5 * 60; i += 1) {
    world.step(1 / 60, { pitch: 0, roll: 1, throttle: 0, throttleSet: 0.7, mouse: null });
  }
  check('banking right increases heading', s.heading > 20 && s.heading < 180, `heading=${s.heading.toFixed(1)}`);
  world.reset();
  const s2 = world.state;
  s2.speed = 100;
  for (let i = 0; i < 5 * 60; i += 1) {
    world.step(1 / 60, { pitch: 0, roll: -1, throttle: 0, throttleSet: 0.7, mouse: null });
  }
  check('banking left decreases heading', s2.heading > 180 && s2.heading < 340, `heading=${s2.heading.toFixed(1)}`);
}

// --- autopilot flies the whole course and lands (headless, via shots.js) ---
{
  const { stageShot } = await import('./game/src/shots.js');
  const world = createWorld(terrain);
  const result = stageShot('win', world);
  const s = world.state;
  check('autopilot lands the plane', s.screen === SCREEN_WIN, `screen=${s.screen} reason=${s.reason}`);
  check('autopilot scores all 8 rings', s.ringsHit === 8, `rings=${s.ringsHit}`);
  check('autopilot finishes with time to spare', s.timeLeft > 0, `timeLeft=${s.timeLeft.toFixed(0)}`);
  const mid = createWorld(terrain);
  const playResult = stageShot('play', mid);
  check('play shot is mid-flight with rings scored', mid.state.screen === SCREEN_PLAY && mid.state.ringsHit >= 3, `rings=${mid.state.ringsHit} z=${mid.state.z.toFixed(0)}`);
}

// --- timeout ---
{
  const world = createWorld(terrain);
  world.reset();
  const s = world.state;
  s.timeLeft = 1;
  let events = 0;
  for (let i = 0; i < 3 * 60; i += 1) {
    events |= world.step(1 / 60, { pitch: 0, roll: 0, throttle: 0, throttleSet: 0.7, mouse: null });
    if (events & EVENT_TIMEOUT) break;
  }
  check('clock running out ends the flight', (events & EVENT_TIMEOUT) !== 0 && s.screen === SCREEN_OVER);
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
