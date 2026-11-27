// The world of Cendrawasih Coast: a bay on the west, a sandy beach, green
// hills, a river winding to the sea, a small city by the river mouth, and the
// runway at Cendrawasih Field to the north. Everything is a pure function of
// (x, z) plus seeded decoration, so the world is the same every run.

import { COURSE } from './config.js';
import { makeNoise2D } from './random.js';

// The coastline snakes north: sea to its west.
export function coastlineX(z) {
  return -150 + 42 * Math.sin(z * 0.0009 + 0.5) + 18 * Math.sin(z * 0.0021 + 2.0);
}

// The river's centreline, from the hills down to the sea near the city.
export function riverX(z) {
  return 55 + 55 * Math.sin(z * 0.0011 + 1.2);
}

export function createTerrain(random) {
  const noise = makeNoise2D(random);

  function hills(x, z) {
    const n = noise(x * 0.004, z * 0.004) * 0.6
      + noise(x * 0.011 + 40, z * 0.011) * 0.3
      + noise(x * 0.03 + 90, z * 0.03) * 0.1;
    return n; // roughly -1..1
  }

  // Ground height in metres. Water is below zero.
  function height(x, z) {
    const coast = coastlineX(z);
    const river = riverX(z);
    const riverHalf = 15;
    const inRiver = z >= COURSE.river.z0 && z <= COURSE.river.z1 && Math.abs(x - river) < riverHalf;
    const inRunway = x >= COURSE.runway.x0 && x <= COURSE.runway.x1
      && z >= COURSE.runway.z0 && z <= COURSE.runway.z1;
    const inCity = x >= COURSE.city.x0 && x <= COURSE.city.x1
      && z >= COURSE.city.z0 && z <= COURSE.city.z1;
    if (inRunway) return COURSE.runway.groundY;
    if (inCity) return 6;
    if (inRiver) return -3;
    if (x < coast) return -6 - Math.min(10, (coast - x) * 0.05); // the bay, deeper offshore
    // Land: beach, then rolling green, then high ground to the east and far north.
    const h = hills(x, z);
    let y = 3 + h * 24 + Math.max(0, (x - 300) * 0.16) + Math.max(0, (z - 5900) * 0.05);
    if (x < coast + 26) y = Math.min(y, 1.5); // sand strip
    return y;
  }

  function type(x, z) {
    const coast = coastlineX(z);
    const river = riverX(z);
    const inRiver = z >= COURSE.river.z0 && z <= COURSE.river.z1 && Math.abs(x - river) < 15;
    const inRunway = x >= COURSE.runway.x0 && x <= COURSE.runway.x1
      && z >= COURSE.runway.z0 && z <= COURSE.runway.z1;
    const inCity = x >= COURSE.city.x0 && x <= COURSE.city.x1
      && z >= COURSE.city.z0 && z <= COURSE.city.z1;
    if (inRunway) return 'runway';
    if (inCity) return 'city';
    if (inRiver || x < coast) return 'water';
    if (x < coast + 26) return 'sand';
    const h = height(x, z);
    if (h > 55) return 'rock';
    // Forest patches, seeded by position so they are stable.
    const f = noise(x * 0.02 + 7, z * 0.02 + 3);
    if (f > 0.28 && h > 4) return 'forest';
    return h > 22 ? 'hill' : 'grass';
  }

  // City buildings: a small grid of blocks with seeded heights.
  const buildings = [];
  for (let gx = 0; gx < 7; gx += 1) {
    for (let gz = 0; gz < 12; gz += 1) {
      if (random.next() < 0.22) continue; // gaps: streets and a park
      const x = COURSE.city.x0 + 14 + gx * 32 + random.range(-4, 4);
      const z = COURSE.city.z0 + 18 + gz * 62 + random.range(-8, 8);
      const w = random.range(14, 24);
      const d = random.range(14, 24);
      const h = random.range(10, 46) + (gx === 3 && gz > 4 && gz < 8 ? 26 : 0); // a taller downtown strip
      buildings.push({ x, z, w, d, h, hue: random.pick([0, 1, 2, 3]), seed: random.next() * 100 });
    }
  }

  // Trees scattered on grass (drawn as small dark-green cones in the renderer).
  const trees = [];
  for (let i = 0; i < 420; i += 1) {
    const x = random.range(-380, 420);
    const z = random.range(0, 6000);
    if (type(x, z) !== 'grass' && type(x, z) !== 'hill') continue;
    trees.push({ x, z, s: random.range(4, 9) });
  }

  // Clouds: soft puffs high above the course.
  const clouds = [];
  for (let i = 0; i < 26; i += 1) {
    clouds.push({
      x: random.range(-600, 600),
      y: random.range(230, 330),
      z: random.range(-200, 6200),
      s: random.range(50, 130),
    });
  }

  return { height, type, buildings, trees, clouds };
}
