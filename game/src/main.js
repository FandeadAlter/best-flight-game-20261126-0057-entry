// Cendrawasih Coast Run — entry point. Runs the loop, wires input and sound,
// and stages ?shot= scenes for screenshots (paints twice, then sets
// window.__shotReady, as the kit's starter does).

import { VIEW } from './config.js';
import { createRandom } from './random.js';
import { createTerrain } from './terrain.js';
import { createWorld, EVENT_CRASH, EVENT_LANDED, EVENT_NEAR_MISS, EVENT_RING, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './physics.js';
import { createRenderer } from './render.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
canvas.width = VIEW.width;
canvas.height = VIEW.height;
const statusEl = document.getElementById('status');

const random = createRandom(seed);
const terrain = createTerrain(random);
const world = createWorld(terrain);
const renderer = createRenderer(canvas);
const input = createInput(canvas);
const audio = createAudio();

const ui = { paused: false, muted: false };
let lastScreen = world.state.screen;

function announce() {
  const s = world.state;
  let text = '';
  if (s.screen === SCREEN_TITLE) text = 'Cendrawasih Coast Run. Press Enter to fly.';
  else if (s.screen === SCREEN_OVER) text = `Flight over. ${s.reason} Score ${s.score}. Press R to fly again.`;
  else if (s.screen === SCREEN_WIN) text = `Landed. ${s.reason} Score ${s.score}. Press R to fly again.`;
  else text = `Flying. Altitude ${Math.round(s.y * 3.28)} feet, speed ${Math.round(s.speed)} knots, heading ${Math.round(s.heading)} degrees. Rings ${s.ringsHit} of 8. Score ${s.score}.`;
  if (text !== statusEl.textContent) statusEl.textContent = text;
}

function startGame() {
  audio.unlock();
  audio.click();
  world.reset();
  ui.paused = false;
}

canvas.addEventListener('click', () => {
  if (world.state.screen !== SCREEN_PLAY) startGame();
  else audio.unlock();
});

function frame(now, last) {
  const dt = Math.min(0.05, (now - last) / 1000);
  const keys = input.read();

  if (keys.mute) {
    ui.muted = audio.toggleMute();
  }
  if (keys.restart && world.state.screen !== SCREEN_TITLE) {
    startGame();
  } else if (keys.start && world.state.screen !== SCREEN_PLAY) {
    startGame();
  }
  if (keys.paused && world.state.screen === SCREEN_PLAY) {
    ui.paused = !ui.paused;
    audio.click();
  }

  if (!ui.paused && world.state.screen === SCREEN_PLAY) {
    const events = world.step(dt, keys);
    if (events & EVENT_RING) audio.ring();
    if (events & EVENT_NEAR_MISS) audio.nearMiss();
    if (events & EVENT_CRASH) audio.crash();
    if (events & EVENT_LANDED) audio.land();
  }
  if (world.state.screen !== lastScreen) {
    lastScreen = world.state.screen;
    ui.paused = false;
  }

  audio.update(world.state.throttle, world.state.speed, world.state.screen === SCREEN_PLAY && !ui.paused);
  renderer.draw(world.state, terrain, ui);
  announce();
  requestAnimationFrame((t) => frame(t, now));
}

if (shot) {
  // Staged screenshot: play the scene forward, paint twice, signal readiness.
  stageShot(shot, world);
  renderer.draw(world.state, terrain, ui);
  renderer.draw(world.state, terrain, ui);
  window.__shotReady = true;
  announce();
} else {
  requestAnimationFrame((t) => frame(t, t));
}
