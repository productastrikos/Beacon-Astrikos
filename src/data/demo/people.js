/**
 * Demo users, operators and response-team roster.
 * Every name below is fictitious. Credentials are for the frontend
 * demonstration only and are NOT a security mechanism.
 */
export const DEMO_USERS = [
  { id: 'u-admin',    username: 'admin',    email: 'admin@beacon.local',    password: 'Astrikos2026',    name: 'Administrator',        role: 'NATIONAL_ADMIN',    homeScope: 'IN', stateCode: null,  initials: 'DA' },
  { id: 'u-state',    username: 'state',    email: 'state.ar@beacon.local', password: 'Beacon#State1',    name: 'State Operator (AR)',  role: 'STATE_OPERATOR',    homeScope: 'AR', stateCode: 'AR',  initials: 'SO' },
  { id: 'u-district', username: 'district', email: 'district@beacon.local', password: 'Beacon#District1', name: 'District Operator',    role: 'DISTRICT_OPERATOR', homeScope: 'AR', stateCode: 'AR',  initials: 'DO' },
  { id: 'u-field',    username: 'field',    email: 'field@beacon.local',    password: 'Beacon#Field1',    name: 'Field Responder',      role: 'FIELD_RESPONDER',   homeScope: 'AR', stateCode: 'AR',  initials: 'FR' },
  { id: 'u-analyst',  username: 'analyst',  email: 'analyst@beacon.local',  password: 'Beacon#Analyst1',  name: 'Analyst',              role: 'ANALYST',           homeScope: 'IN', stateCode: null,  initials: 'AN' },
  { id: 'u-auditor',  username: 'auditor',  email: 'auditor@beacon.local',  password: 'Beacon#Auditor1',  name: 'Auditor',              role: 'AUDITOR',           homeScope: 'IN', stateCode: null,  initials: 'AU' },
];

/** Additional operators who appear as assignees (cannot sign in). */
export const OPERATOR_ROSTER = [
  { id: 'op-01', name: 'Control Room Operator — Shift A', stateCode: 'AR' },
  { id: 'op-02', name: 'Control Room Operator — Shift B', stateCode: 'AR' },
  { id: 'op-03', name: 'Duty Officer — Itanagar',         stateCode: 'AR' },
  { id: 'op-04', name: 'Duty Officer — Guwahati',         stateCode: 'AS' },
  { id: 'op-05', name: 'Duty Officer — Dehradun',         stateCode: 'UK' },
  { id: 'op-06', name: 'Duty Officer — Shimla',           stateCode: 'HP' },
];

/** Response teams. Availability is a simulated roster, not live status. */
const BASE_TEAMS = [
  { id: 'tm-ar-01', name: 'Rescue Team AR-01',      stateCode: 'AR', base: 'Itanagar',  specialty: 'Flood rescue',        members: 12, baseAvailability: 'Available' },
  { id: 'tm-ar-02', name: 'Rescue Team AR-02',      stateCode: 'AR', base: 'Tezu',      specialty: 'Landslide response',  members: 10, baseAvailability: 'Available' },
  { id: 'tm-ar-03', name: 'Field Verification AR-A', stateCode: 'AR', base: 'Pasighat', specialty: 'Field verification',  members: 4,  baseAvailability: 'Available' },
  { id: 'tm-ar-04', name: 'Field Verification AR-B', stateCode: 'AR', base: 'Tawang',   specialty: 'Field verification',  members: 4,  baseAvailability: 'Standby' },
  { id: 'tm-ar-05', name: 'Medical Response AR-01', stateCode: 'AR', base: 'Itanagar',  specialty: 'Medical response',    members: 8,  baseAvailability: 'Available' },
  { id: 'tm-ar-06', name: 'Engineering Inspection AR', stateCode: 'AR', base: 'Itanagar', specialty: 'Infrastructure inspection', members: 6, baseAvailability: 'Available' },
  { id: 'tm-as-01', name: 'Rescue Team AS-01',      stateCode: 'AS', base: 'Guwahati',  specialty: 'Flood rescue',        members: 14, baseAvailability: 'Available' },
  { id: 'tm-uk-01', name: 'Rescue Team UK-01',      stateCode: 'UK', base: 'Dehradun',  specialty: 'Mountain rescue',     members: 12, baseAvailability: 'Standby' },
  { id: 'tm-hp-01', name: 'Rescue Team HP-01',      stateCode: 'HP', base: 'Shimla',    specialty: 'Avalanche / snow',    members: 10, baseAvailability: 'Available' },
  { id: 'tm-sk-01', name: 'Field Verification SK-A', stateCode: 'SK', base: 'Gangtok',  specialty: 'Field verification',  members: 4,  baseAvailability: 'Available' },
  { id: 'tm-rj-01', name: 'Heat-Action Team RJ-01', stateCode: 'RJ', base: 'Jaipur',    specialty: 'Heat-action',         members: 6,  baseAvailability: 'Available' },
];

const SPECIALTIES = ['Flood rescue', 'Landslide response', 'Field verification', 'Medical response', 'Infrastructure inspection', 'Mountain rescue', 'Fire response', 'Heat-action', 'Relief logistics'];
const LABEL = { 'Flood rescue': 'Rescue Team', 'Landslide response': 'Landslide Response', 'Field verification': 'Field Verification', 'Medical response': 'Medical Response',
  'Infrastructure inspection': 'Engineering Inspection', 'Mountain rescue': 'Mountain Rescue', 'Fire response': 'Fire Response', 'Heat-action': 'Heat-Action Team', 'Relief logistics': 'Relief Logistics' };
const STATE_BASE = { AR: 'Itanagar', AS: 'Guwahati', SK: 'Gangtok', ML: 'Shillong', NL: 'Kohima', MN: 'Imphal', HP: 'Shimla', UK: 'Dehradun', JK: 'Srinagar', LA: 'Leh',
  KL: 'Thiruvananthapuram', OD: 'Bhubaneswar', WB: 'Kolkata', RJ: 'Jaipur', UP: 'Lucknow', BR: 'Patna', MH: 'Mumbai' };

/** Response teams: the original roster plus a deterministic set so every state has 8-25 teams. Off-shift is a fixed flag per team. */
export const TEAMS = (() => {
  const out = [...BASE_TEAMS.map((t, i) => ({ ...t, offShift: i % 9 === 8 }))];
  Object.keys(STATE_BASE).forEach((st, si) => {
    const have = out.filter((t) => t.stateCode === st).length;
    const want = 8 + ((si * 7 + 3) % 18);
    for (let n = have + 1; n <= want; n += 1) {
      const sp = SPECIALTIES[(n + si) % SPECIALTIES.length];
      out.push({
        id: `tm-${st.toLowerCase()}-${String(n).padStart(2, '0')}`, name: `${LABEL[sp]} ${st}-${String(n).padStart(2, '0')}`, stateCode: st, base: STATE_BASE[st],
        specialty: sp, members: 4 + ((n * 3 + si) % 10), baseAvailability: 'Available', offShift: (n + si) % 7 === 0,
      });
    }
  });
  return out;
})();
