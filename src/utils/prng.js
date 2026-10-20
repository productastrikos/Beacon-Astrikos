/** Deterministic PRNG (mulberry32) so seeded data is identical on every load. */
export function createRng(seed = 1) {
  let a = seed >>> 0;
  const next = () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => Math.floor(next() * (max - min + 1)) + min,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    weighted: (items) => {
      const total = items.reduce((s, i) => s + i.w, 0);
      let r = next() * total;
      for (const i of items) { r -= i.w; if (r <= 0) return i.v; }
      return items[items.length - 1].v;
    },
  };
}
