import { DISTRICTS, STATE_CLIMATE } from './geography';
import { isEligible } from '../../config/hazardRegions';
import { isoAgo } from '../../utils/format';

/**
 * Monitoring-station model: how each hazard's stations are created, how a reading evolves over time
 * (random walk + mean reversion + diurnal cycle for temperature) and how a reading is classified.
 * Shared by the seed generator and the live engine so both behave identically.
 */
export const HAZARD_PREFIX = { flood: 'FL', landslide: 'LS', earthquake: 'EQ', avalanche: 'AV', wildfire: 'WF', heatwave: 'HW', coldwave: 'CW' };
const SUFFIX = { flood: 'river gauge', landslide: 'rain gauge', earthquake: 'seismic station', avalanche: 'snow observatory', wildfire: 'fire watch zone', heatwave: 'AWS', coldwave: 'AWS' };
const KIND = { flood: 'observation', landslide: 'observation', earthquake: 'event', avalanche: 'bulletin', wildfire: 'detection', heatwave: 'observation', coldwave: 'observation' };
const UNIT = { flood: 'm', landslide: 'mm / 24 h', earthquake: 'M', avalanche: 'danger level (1–5)', wildfire: 'confidence %', heatwave: '°C max', coldwave: '°C min' };
const SOURCES = {
  flood: ['cwc', 'cwc', 'imd', 'stategauge', 'sensors'], landslide: ['imd', 'imd', 'gsi', 'sensors'], earthquake: ['ncs', 'ncs', 'seismic'],
  avalanche: ['sase', 'sase', 'imd'], wildfire: ['fsi', 'firms', 'firms'], heatwave: ['imd', 'imd', 'stateaws', 'sensors'], coldwave: ['imd', 'imd', 'stateaws', 'sensors'],
};
const CADENCE = [15, 30, 30, 60, 60];

const HEAT_NORMAL = { desert: 40, plains: 37, coastal: 33, 'ne-plains': 33, 'ne-hills': 28, himalaya: 26, 'cold-desert': 22 };
const COLD_NORMAL = { himalaya: -1, 'cold-desert': -12, 'ne-hills': 7, 'ne-plains': 10, plains: 8, desert: 9, coastal: 19 };
const COLD_WARN = { himalaya: -5, 'cold-desert': -15, 'ne-hills': 3, 'ne-plains': 5, plains: 4, desert: 4, coastal: 14 };

const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;
const gauss = (rng) => (rng.next() + rng.next() + rng.next() + rng.next() - 2) * 1.7;

/** Station place names: districts first, then compass-suffixed variants so any state reaches its station count. */
function placeNames(state, n) {
  const ds = DISTRICTS[state] || [state];
  const dirs = ['North', 'South', 'East', 'West', 'Central'];
  const out = [];
  for (let i = 0; out.length < n; i += 1) out.push(i < ds.length ? { district: ds[i], place: ds[i] } : { district: ds[i % ds.length], place: `${ds[i % ds.length]} ${dirs[Math.floor(i / ds.length) % 5]}` });
  return out;
}

function params(hazard, state, rng) {
  const cl = STATE_CLIMATE[state] || 'plains';
  switch (hazard) {
    case 'flood': { const L = r2(20 + rng.next() * 260); return { normal: L, warning: r2(L + 2), danger: r2(L + 3.2), sd: 0.28, revert: 0.1, lo: L - 1.5, hi: L + 4.6, below: false }; }
    case 'landslide': { const n = 18 + rng.int(0, 40); return { normal: n, warning: 110 + rng.int(0, 40), danger: 170 + rng.int(0, 40), sd: 7, revert: 0.1, lo: 0, hi: 300, below: false, soil: 30 + rng.int(0, 35) }; }
    case 'earthquake': return { normal: 2.7, warning: 4.5, danger: 5.5, sd: 0.4, revert: 0.2, lo: 1.5, hi: 6.8, below: false, depthKm: 8 + rng.int(0, 40) };
    case 'avalanche': return { normal: 2, warning: 3, danger: 4, sd: 0.3, revert: 0.15, lo: 1, hi: 5, below: false, snowCm: 60 + rng.int(0, 240) };
    case 'wildfire': return { normal: 48, warning: 80, danger: 92, sd: 6, revert: 0.12, lo: 20, hi: 99, below: false, frp: r1(2 + rng.next() * 8), fwi: 8 + rng.int(0, 14) };
    case 'heatwave': { const n = (HEAT_NORMAL[cl] || 36) + rng.int(-2, 2); return { normal: n, warning: r1(n + 4.5), danger: r1(n + 6.5), sd: 0.45, revert: 0.25, lo: n - 5, hi: n + 9, below: false, diurnal: 3 }; }
    default: { const n = (COLD_NORMAL[cl] ?? 6) + rng.int(-2, 2); const w = COLD_WARN[cl] ?? 4; return { normal: n, warning: w, danger: w - 3, sd: 0.4, revert: 0.25, lo: w - 8, hi: n + 6, below: true, diurnal: 3 }; }
  }
}

/** How a reading is classified: wording, severity and whether it is beyond the warning / danger level. */
export function classify(rec) {
  const { warning, danger, below } = rec.extra;
  if (rec.extra.inactive && rec.hazard !== 'earthquake') {
    return { classification: 'Within normal range', severity: 'None', exceeding: false, danger: false };
  }
  const v = Number(rec.value);
  const beyond = (t) => (below ? v <= t : v >= t);
  const isDanger = beyond(danger);
  const isWarn = beyond(warning);
  const near = !isWarn && (below ? v <= warning + Math.abs(warning) * 0.15 + 1 : v >= warning - Math.abs(warning - rec.extra.normal) * 0.15);
  const noun = { flood: 'level', landslide: 'rainfall', earthquake: 'magnitude', avalanche: 'danger level', wildfire: 'confidence', heatwave: 'temperature', coldwave: 'temperature' }[rec.hazard];
  let classification = `Within normal ${noun}`;
  if (isDanger) classification = `Beyond danger ${noun}`; else if (isWarn) classification = `Beyond warning ${noun}`; else if (near) classification = `Approaching warning ${noun}`;
  if (rec.hazard === 'earthquake') classification = `M${r1(v)} · depth ${rec.extra.depthKm} km`;
  const severity = isDanger ? 'High' : isWarn ? 'Moderate' : near ? 'Low' : 'None';
  return { classification, severity, exceeding: isWarn, danger: isDanger };
}

export function applyClassification(rec) {
  const c = classify(rec);
  return { ...rec, classification: c.classification, severity: c.severity };
}

/** Builds the station records for one hazard x state. */
export function buildStations(hazard, state, rng, base) {
  const ds = DISTRICTS[state] || [state];
  const count = Math.min(10, 4 + Math.floor(ds.length / 2) + rng.int(0, 2));
  return placeNames(state, count).map((pl, i) => {
    const p = params(hazard, state, rng);
    const cadenceMin = rng.pick(CADENCE);
    // Most stations sit near normal; roughly one in five starts near or beyond its warning level.
    const roll = rng.next();
    let value = p.normal + gauss(rng) * p.sd * 2;
    if (roll < 0.2) value = p.below ? p.warning - rng.next() * 2.5 : p.warning + rng.next() * (p.danger - p.warning) * 0.9;
    else if (roll < 0.35) value = p.below ? p.warning + rng.next() * 2 : p.warning - rng.next() * (p.warning - p.normal) * 0.25;
    value = hazard === 'avalanche' ? Math.max(1, Math.min(5, Math.round(value))) : Math.min(p.hi, Math.max(p.lo, value));
    const series = [];
    let v = value;
    for (let k = 0; k < 12; k += 1) { series.unshift(hazard === 'avalanche' ? Math.round(v) : r2(v)); v += (p.normal - v) * p.revert * -0.5 + gauss(rng) * p.sd; v = Math.min(p.hi, Math.max(p.lo, v)); }
    const rec = {
      id: `${HAZARD_PREFIX[hazard]}-${state}-${String(i + 1).padStart(2, '0')}`, hazard, kind: KIND[hazard], stateCode: state, district: pl.district,
      location: `${pl.place} ${SUFFIX[hazard]}`, value: hazard === 'avalanche' ? Math.round(value) : r2(value), unit: UNIT[hazard], sourceId: rng.pick(SOURCES[hazard]),
      sourceTimestamp: isoAgo(base, rng.int(0, 2)), verification: 'Automated', series, notes: [], origin: 'baseline', cursor: 0,
      extra: { ...p, cadenceMin, readings24h: Math.round(1440 / cadenceMin), inactive: !isEligible(hazard, state) },
    };
    series[series.length - 1] = rec.value;
    return applyClassification(rec);
  });
}

/** Advances one station by a single reading; returns a new record. `rng` needs next(); `nowMs` drives the diurnal cycle. */
export function stepRecord(rec, rng, nowMs) {
  const e = rec.extra;
  let v = Number(rec.value);
  if (rec.hazard === 'earthquake') {
    if (rng.next() < 0.06) v = Math.min(e.hi, Math.max(e.lo, 2 + -Math.log(1 - rng.next()) * 0.9));
    else v += (e.normal - v) * 0.1 + gauss(rng) * 0.05;
  } else if (rec.hazard === 'avalanche') {
    if (rng.next() < 0.08) v += rng.next() < 0.5 ? 1 : -1;
    v = Math.max(1, Math.min(5, Math.round(v)));
  } else {
    let target = e.normal;
    if (e.diurnal) {
      const h = new Date(nowMs).getHours() + new Date(nowMs).getMinutes() / 60;
      target += e.diurnal * (rec.hazard === 'heatwave' ? Math.sin(((h - 9) / 24) * 2 * Math.PI) : -Math.sin(((h - 9) / 24) * 2 * Math.PI) * 0.7);
    }
    v += (target - v) * e.revert + gauss(rng) * e.sd;
    if (rng.next() < 0.012) v += (e.below ? -1 : 1) * Math.abs(e.danger - e.warning) * (0.5 + rng.next());
    v = Math.min(e.hi, Math.max(e.lo, v));
  }
  const value = rec.hazard === 'avalanche' ? v : r2(v);
  const series = [...rec.series.slice(-11), value];
  return applyClassification({ ...rec, value, series, sourceTimestamp: new Date(nowMs).toISOString() });
}

/** Pushes a station just beyond its warning level (used by the coverage guard). */
export function pushBeyondWarning(rec, rng, nowMs) {
  const e = rec.extra;
  const v = rec.hazard === 'avalanche' ? e.warning : e.below ? e.warning - 0.4 - rng.next() * 1.5 : e.warning + 0.3 + rng.next() * (e.danger - e.warning) * 0.7;
  const value = rec.hazard === 'avalanche' ? v : r2(Math.min(e.hi, Math.max(e.lo, v)));
  return applyClassification({ ...rec, value, series: [...rec.series.slice(-11), value], sourceTimestamp: new Date(nowMs).toISOString() });
}
