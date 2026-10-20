/** Administrative reference data used by the seed datasets. */
export const STATES = [
  { code: 'AR', name: 'Arunachal Pradesh' },
  { code: 'AS', name: 'Assam' },
  { code: 'SK', name: 'Sikkim' },
  { code: 'ML', name: 'Meghalaya' },
  { code: 'NL', name: 'Nagaland' },
  { code: 'MN', name: 'Manipur' },
  { code: 'HP', name: 'Himachal Pradesh' },
  { code: 'UK', name: 'Uttarakhand' },
  { code: 'JK', name: 'Jammu & Kashmir' },
  { code: 'LA', name: 'Ladakh' },
  { code: 'KL', name: 'Kerala' },
  { code: 'OD', name: 'Odisha' },
  { code: 'WB', name: 'West Bengal' },
  { code: 'RJ', name: 'Rajasthan' },
  { code: 'UP', name: 'Uttar Pradesh' },
  { code: 'BR', name: 'Bihar' },
  { code: 'MH', name: 'Maharashtra' },
];
export const STATE_NAME = Object.fromEntries(STATES.map((s) => [s.code, s.name]));

export const DISTRICTS = {
  AR: ['Tawang', 'West Kameng', 'East Kameng', 'Papum Pare', 'Lower Subansiri', 'Upper Subansiri',
    'West Siang', 'East Siang', 'Upper Siang', 'Lower Dibang Valley', 'Dibang Valley', 'Lohit',
    'Anjaw', 'Changlang', 'Tirap', 'Namsai'],
  AS: ['Lakhimpur', 'Dhemaji', 'Majuli', 'Dibrugarh', 'Kamrup'],
  SK: ['Mangan', 'Gangtok', 'Pakyong'],
  ML: ['East Khasi Hills', 'West Garo Hills'],
  NL: ['Kohima'],
  MN: ['Churachandpur'],
  HP: ['Kullu', 'Chamba', 'Kinnaur', 'Lahaul and Spiti', 'Shimla'],
  UK: ['Chamoli', 'Rudraprayag', 'Pithoragarh', 'Uttarkashi'],
  JK: ['Ganderbal', 'Kupwara', 'Doda'],
  LA: ['Leh', 'Kargil'],
  KL: ['Wayanad', 'Idukki'],
  OD: ['Puri', 'Ganjam', 'Balasore'],
  WB: ['Darjeeling', 'Kalimpong'],
  RJ: ['Barmer', 'Churu', 'Jaisalmer'],
  UP: ['Banda', 'Prayagraj'],
  BR: ['Sitamarhi', 'Darbhanga'],
  MH: ['Raigad', 'Ratnagiri'],
};

/** Hazards that are plausible per state — used by the historical generator. */
export const STATE_HAZARDS = {
  AR: ['flood', 'landslide', 'earthquake', 'wildfire', 'avalanche'],
  AS: ['flood', 'earthquake'],
  SK: ['landslide', 'flood', 'avalanche', 'earthquake'],
  ML: ['landslide', 'flood'],
  NL: ['landslide', 'wildfire'],
  MN: ['landslide', 'flood', 'earthquake'],
  HP: ['landslide', 'flood', 'avalanche', 'coldwave', 'wildfire'],
  UK: ['landslide', 'flood', 'avalanche', 'wildfire'],
  JK: ['avalanche', 'coldwave', 'flood', 'earthquake'],
  LA: ['coldwave', 'avalanche', 'earthquake'],
  KL: ['landslide', 'flood'],
  OD: ['heatwave', 'flood'],
  WB: ['landslide', 'flood'],
  RJ: ['heatwave', 'wildfire'],
  UP: ['heatwave', 'coldwave', 'flood'],
  BR: ['flood', 'heatwave'],
  MH: ['landslide', 'flood'],
};

/** Climate class per state, used to set regional normals and thresholds for temperature stations. */
export const STATE_CLIMATE = {
  AR: 'ne-hills', AS: 'ne-plains', SK: 'himalaya', ML: 'ne-hills', NL: 'ne-hills', MN: 'ne-hills', HP: 'himalaya', UK: 'himalaya',
  JK: 'himalaya', LA: 'cold-desert', KL: 'coastal', OD: 'plains', WB: 'plains', RJ: 'desert', UP: 'plains', BR: 'plains', MH: 'plains',
};

/** Approximate district population (deterministic lookup): 3 to 30 lakh, keyed by district name. */
export function districtPopulation(name) {
  let h = 2166136261;
  for (let i = 0; i < name.length; i += 1) { h ^= name.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (3 + ((h >>> 0) % 2700) / 100) * 100000;
}
