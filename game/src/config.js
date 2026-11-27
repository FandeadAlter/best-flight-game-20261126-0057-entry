// Cendrawasih Coast Run — tuning and world layout (all original, written for this entry).
// Units: 1 unit = 1 metre. Speeds in knots, altitudes in feet on the HUD (converted at draw).

export const VIEW = { width: 1280, height: 720 };

// Flight model tuning.
export const FLIGHT = {
  minSpeed: 38, // knots — below this the wing stops flying
  maxSpeed: 165, // knots at full throttle, level
  cruiseSpeed: 95, // knots at 0.65 throttle
  accel: 22, // knots per second toward the throttle target
  maxPitch: 24, // degrees, nose up/down
  maxRoll: 58, // degrees of bank
  pitchRate: 55, // degrees per second toward the commanded pitch
  rollRate: 95, // degrees per second toward the commanded roll
  turnRate: 0.42, // heading degrees per second per degree of bank, scaled by speed
  climbFactor: 1.05, // how much of the pitch turns into climb
  sinkBelowStall: 9, // metres per second of sink when stalled
  startThrottle: 0.62,
  timeLimit: 240, // seconds on the clock
};

// The course: start over the bay, follow the coast north, cross the river,
// thread the city, then land on the runway at Cendrawasih Field.
export const COURSE = {
  start: { x: -40, y: 150, z: 0, heading: 0, speed: 80 },
  length: 6000, // the runway ends the world at z = 5900
  runway: { x0: -30, x1: 30, z0: 5200, z1: 5900, groundY: 4 },
  city: { x0: 60, x1: 300, z0: 3900, z1: 4700 },
  river: { z0: 2800, z1: 4300 },
};

// Eight gold rings on the route. y is the ring centre height (metres).
export const RINGS = [
  { x: -30, y: 130, z: 700, r: 26 },
  { x: 20, y: 110, z: 1400, r: 26 },
  { x: -70, y: 150, z: 2100, r: 26 },
  { x: 30, y: 120, z: 2800, r: 26 },
  { x: 60, y: 100, z: 3400, r: 26 }, // over the river
  { x: 120, y: 140, z: 4100, r: 26 }, // over the city
  { x: 40, y: 110, z: 4700, r: 26 },
  { x: 0, y: 70, z: 4800, r: 26 }, // final gate, on the runway centreline
];

export const SCORING = {
  ring: 100,
  landing: 500,
  landingSoftBonus: 250, // gentle touchdown
  timeBonusPerSecond: 5, // seconds left on the clock, on landing
  nearMiss: 25, // skimming a ring's edge (within 1.6x radius, not through)
};

// Colours.
export const COLORS = {
  skyTop: '#1e5fa8',
  skyMid: '#7fb2e0',
  skyHorizon: '#d8ecf7',
  sea: '#1d6fb8',
  seaDeep: '#14568f',
  sand: '#e3cf9a',
  grass: '#4f9e4a',
  grassDry: '#7fae56',
  forest: '#2e7d32',
  hill: '#6d8f57',
  rock: '#8d8578',
  cityGround: '#9aa0a3',
  asphalt: '#33373b',
  runwayMark: '#f2f2e8',
  ringGold: '#ffc93c',
  ringGlow: '#ff9d00',
  panel: '#10151c',
  panelEdge: '#2c3a48',
  gaugeFace: '#0d1b12',
  litGreen: '#39ff88',
  litAmber: '#ffb02e',
  litRed: '#ff4d4d',
  litCyan: '#4dd8ff',
};
