// Deterministic seeded random numbers, so a ?seed=N run always draws the same
// trees, buildings and clouds (screenshots are reproducible).

export function createRandom(seed) {
  let state = (seed >>> 0) || 1;
  return {
    next() {
      // xorshift32.
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      state >>>= 0;
      return state / 4294967296;
    },
    range(min, max) {
      return min + this.next() * (max - min);
    },
    int(min, max) {
      return Math.floor(this.range(min, max + 1));
    },
    pick(list) {
      return list[Math.floor(this.next() * list.length)];
    },
  };
}

// Smooth value noise in 2D, built from a seeded lattice — used for hills.
export function makeNoise2D(random) {
  const perm = new Uint8Array(512);
  const base = new Uint8Array(256);
  for (let i = 0; i < 256; i += 1) base[i] = i;
  for (let i = 255; i > 0; i -= 1) {
    const j = Math.floor(random.next() * (i + 1));
    const tmp = base[i];
    base[i] = base[j];
    base[j] = tmp;
  }
  for (let i = 0; i < 512; i += 1) perm[i] = base[i & 255];
  const fade = (t) => t * t * (3 - 2 * t);
  const grad = (h, x, y) => ((h & 1) === 0 ? x + y : -x + y);
  return (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const aa = perm[(perm[xi & 255] + yi) & 255];
    const ab = perm[(perm[xi & 255] + yi + 1) & 255];
    const ba = perm[(perm[(xi + 1) & 255] + yi) & 255];
    const bb = perm[(perm[(xi + 1) & 255] + yi + 1) & 255];
    const u = fade(xf);
    const v = fade(yf);
    const x1 = grad(aa, xf, yf) + (grad(ba, xf - 1, yf) - grad(aa, xf, yf)) * u;
    const x2 = grad(ab, xf, yf - 1) + (grad(bb, xf - 1, yf - 1) - grad(ab, xf, yf - 1)) * u;
    return (x1 + (x2 - x1) * v) * 0.7071;
  };
}
