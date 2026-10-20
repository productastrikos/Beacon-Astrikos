import { DISTRICTS } from '../data/demo/geography';

/**
 * Where each hazard can realistically occur. Incidents, warnings and tasks are only generated for eligible
 * state (and district) combinations, and the "Link an alert" lists apply the same check.
 * Monitoring stations are kept in every state so readings never show an empty page.
 */
export const HAZARD_STATES = {
  flood: ['AR', 'AS', 'SK', 'ML', 'NL', 'MN', 'HP', 'UK', 'JK', 'KL', 'OD', 'WB', 'UP', 'BR', 'MH', 'RJ'],
  landslide: ['AR', 'AS', 'SK', 'ML', 'NL', 'MN', 'HP', 'UK', 'JK', 'LA', 'KL', 'WB', 'MH'],
  earthquake: ['AR', 'AS', 'SK', 'ML', 'NL', 'MN', 'HP', 'UK', 'JK', 'LA', 'KL', 'OD', 'WB', 'UP', 'BR', 'MH', 'RJ'],
  avalanche: ['AR', 'SK', 'HP', 'UK', 'JK', 'LA'],
  wildfire: ['AR', 'AS', 'SK', 'ML', 'NL', 'MN', 'HP', 'UK', 'JK', 'KL', 'OD', 'WB', 'UP', 'MH', 'RJ'],
  heatwave: ['AR', 'AS', 'KL', 'OD', 'UP', 'BR', 'MH', 'RJ'],
  coldwave: ['AR', 'AS', 'SK', 'ML', 'NL', 'MN', 'HP', 'UK', 'JK', 'LA', 'WB', 'UP', 'BR', 'RJ'],
};

/** Districts inside an eligible state where the hazard does not apply (or applies only to the listed ones). */
const ONLY = {
  'avalanche|AR': ['Tawang', 'West Kameng', 'Upper Subansiri', 'Dibang Valley', 'Anjaw', 'Upper Siang'],
  'coldwave|AR': ['Tawang', 'West Kameng', 'Upper Subansiri', 'Dibang Valley', 'Anjaw', 'Upper Siang'],
  'heatwave|AR': ['Namsai', 'Changlang', 'Lohit', 'Papum Pare', 'Lower Subansiri', 'East Siang'],
  'coldwave|WB': ['Darjeeling', 'Kalimpong'],
  'landslide|WB': ['Darjeeling', 'Kalimpong'],
};

export const isEligible = (hazard, stateCode) => (HAZARD_STATES[hazard] || []).includes(stateCode);
export const eligibleStates = (hazard) => HAZARD_STATES[hazard] || [];

/** Districts of `stateCode` where `hazard` can occur. */
export function eligibleDistricts(hazard, stateCode) {
  const all = DISTRICTS[stateCode] || [];
  const only = ONLY[`${hazard}|${stateCode}`];
  if (!only) return all;
  const hit = all.filter((d) => only.includes(d));
  return hit.length ? hit : all;
}

export const isEligibleDistrict = (hazard, stateCode, district) => isEligible(hazard, stateCode) && eligibleDistricts(hazard, stateCode).includes(district);
