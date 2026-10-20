import { buildBaseline } from '../data/demo/baseline';

const cache = new Map();

/** Reference dataset at the persisted baseline time — used as the KPI "previous value". */
export function baselineFor(baseAt) {
  if (!cache.has(baseAt)) cache.set(baseAt, buildBaseline(new Date(baseAt).getTime()));
  return cache.get(baseAt);
}
