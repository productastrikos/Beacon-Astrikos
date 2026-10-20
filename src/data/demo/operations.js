import { isoAgo, TIME } from '../../utils/format';

/* ── Incidents ─────────────────────────────────────────────────────────
 * [id, title, hazard, state, district, location, severity, status, verification,
 *  minsAgoCreated, minsAgoUpdated, dueInMin|null, operator, team, alertIds, provenance, description]
 */
const INCIDENT_ROWS = [
  ['INC-1001', 'Siang above warning level at Pasighat', 'flood', 'AR', 'East Siang', 'Pasighat riverfront wards', 'High', 'Response in Progress', 'Verified',
    300, 25, 240, 'u-state', 'tm-ar-01', ['A-1002', 'A-1001'], 'CWC level observation + IMD rainfall warning',
    'River level above the warning threshold and rising. Low-lying wards under observation; shelter readiness being confirmed.'],
  ['INC-1002', 'Slope failure on NH-13 near Daporijo', 'landslide', 'AR', 'Upper Subansiri', 'NH-13 km marker area, near Daporijo', 'High', 'Under Verification', 'Pending',
    95, 20, 120, 'u-district', 'tm-ar-03', ['A-1003'], 'Operator-entered report following rainfall warning',
    'Report of a slope failure partially blocking the carriageway. Field verification requested; traffic status unknown.'],
  ['INC-1003', 'Debris on Anini–Roing road', 'landslide', 'AR', 'Dibang Valley', 'Anini–Roing road, mid-section', 'Moderate', 'Reported', 'Unverified',
    140, 140, 360, null, null, ['A-1003'], 'Operator-entered report (unverified)',
    'Debris reported on carriageway after sustained rain. No casualty information. Awaiting assignment.'],
  ['INC-1004', 'Dibang above warning level at Roing', 'flood', 'AR', 'Lower Dibang Valley', 'Roing town low-lying areas', 'Moderate', 'Confirmed', 'Verified',
    210, 60, 300, 'op-01', 'tm-ar-02', ['A-1001'], 'River level observation + operator confirmation',
    'Level above warning threshold. Confirmed by duty officer call. Monitoring continues.'],
  ['INC-1005', 'Avalanche danger corridor — Sela Pass approaches', 'avalanche', 'AR', 'Tawang', 'Sela Pass – Tawang corridor', 'High', 'Under Verification', 'Pending',
    200, 90, 180, 'u-district', 'tm-ar-04', ['A-1006'], 'Bulletin; corridor status needs field check',
    'Bulletin indicates Considerable danger. Road/corridor status requires verification before advisories to transport operators.'],
  ['INC-1006', 'Earthquake M4.3 near Tawang — inspection', 'earthquake', 'AR', 'Tawang', '38 km NW of Tawang', 'Moderate', 'Response in Progress', 'Verified',
    140, 40, 480, 'op-02', 'tm-ar-06', ['A-1005'], 'Catalog event — infrastructure check initiated',
    'No damage reports received. Routine inspection of bridges and public buildings in nearby settlements.'],
  ['INC-1007', 'Satellite fire detections — Changlang', 'wildfire', 'AR', 'Changlang', 'Forest areas near Miao', 'Moderate', 'Under Verification', 'Pending',
    180, 60, 240, 'op-03', 'tm-ar-03', ['A-1007'], 'Satellite detections; seasonal burning cannot be ruled out',
    'Two high-confidence detections. Field verification to distinguish agricultural burning from forest fire.'],
  ['INC-1008', 'Flood watch — Lohit river reaches', 'flood', 'AR', 'Lohit', 'Tezu–Wakro stretch', 'Low', 'Reported', 'Unverified',
    220, 200, null, null, null, ['A-1009'], 'Watch notice', 'Watch notice only. No observation above threshold.'],
  ['INC-1009', 'Cold conditions — Tawang high-altitude posts', 'coldwave', 'AR', 'Tawang', 'High-altitude posts', 'Low', 'Confirmed', 'Verified',
    300, 150, 600, 'op-01', null, ['A-1008'], 'Advisory sample + AWS observation', 'Below-freezing temperatures at posts. Supplies check pending.'],
  ['INC-1010', 'Slope instability — West Kameng (cancelled warning)', 'landslide', 'AR', 'West Kameng', 'Bomdila approach road', 'Low', 'Unconfirmed', 'Not Verified',
    880, 280, null, 'op-02', null, ['A-1010'], 'Linked to a warning later cancelled by the agency',
    'No observation supported the report; warning later cancelled.'],
  ['INC-1011', 'Rural road washout reported — East Kameng', 'flood', 'AR', 'East Kameng', 'Seppa link road', 'Moderate', 'Reported', 'Unverified',
    70, 70, 300, null, null, [], 'Operator-entered report', 'Washout reported by a community contact. Unverified.'],
  ['INC-1012', 'Debris flow near Joshimath approach', 'landslide', 'UK', 'Chamoli', 'Joshimath approach road', 'Moderate', 'Resolved', 'Verified',
    1400, 300, null, 'op-05', 'tm-uk-01', [], 'Operator-entered, field verified', 'Debris cleared; traffic restored.'],

  ['INC-2001', 'Brahmaputra above danger level at Dibrugarh', 'flood', 'AS', 'Dibrugarh', 'Dibrugarh riverfront', 'Critical', 'Response in Progress', 'Verified',
    240, 20, 180, 'op-04', 'tm-as-01', ['A-1102', 'A-1101'], 'CWC level observation + IMD warning',
    'Level above danger threshold. Embankment patrols and relief camp readiness under way.'],
  ['INC-2002', 'Landslide risk on North Sikkim highway', 'landslide', 'SK', 'Mangan', 'North Sikkim highway corridor', 'High', 'Confirmed', 'Verified',
    190, 50, 240, 'op-04', 'tm-sk-01', ['A-1103'], 'Rain gauge + bulletin sample', 'Rainfall above threshold; sections of road reported unstable.'],
  ['INC-2003', 'Severe heat — Barmer and Churu', 'heatwave', 'RJ', 'Churu', 'Churu city and surrounding blocks', 'High', 'Confirmed', 'Verified',
    120, 40, 480, 'op-06', 'tm-rj-01', ['A-1104'], 'AWS observation + IMD warning', 'Maximum temperature in severe range. Heat-action measures requested.'],
  ['INC-2004', 'Avalanche warning — Gurez axis', 'avalanche', 'JK', 'Kupwara', 'Gurez road', 'Critical', 'Under Verification', 'Pending',
    160, 30, 120, 'op-06', null, ['A-1108'], 'Bulletin', 'High avalanche danger indicated. Road status verification pending.'],
  ['INC-2005', 'Avalanche danger near Atal Tunnel approaches', 'avalanche', 'HP', 'Lahaul and Spiti', 'Atal Tunnel north approaches', 'High', 'Reported', 'Unverified',
    260, 250, 300, null, null, ['A-1107'], 'Bulletin', 'Danger level Considerable. Awaiting assignment.'],
  ['INC-2006', 'Earthquake M5.1 — North Sikkim assessment', 'earthquake', 'SK', 'Mangan', '41 km N of Mangan', 'High', 'Response in Progress', 'Verified',
    1500, 100, 360, 'op-04', 'tm-sk-01', ['A-1109'], 'Catalog event', 'Preliminary damage assessment under way; communications check complete.'],
  ['INC-2007', 'Flood watch — north Bihar', 'flood', 'BR', 'Sitamarhi', 'Bagmati reaches', 'Moderate', 'Reported', 'Unverified',
    230, 90, 420, null, null, ['A-1111'], 'Watch notice', 'Level above warning threshold at Dheng.'],
  ['INC-2008', 'Heatwave — Banda', 'heatwave', 'UP', 'Banda', 'Banda district', 'Moderate', 'Confirmed', 'Verified',
    110, 60, 480, 'op-06', null, ['A-1105'], 'AWS observation', 'Heatwave range reached.'],
  ['INC-2009', 'Cold wave — Kupwara', 'coldwave', 'JK', 'Kupwara', 'Kashmir valley (north)', 'High', 'Confirmed', 'Verified',
    140, 120, 360, 'op-06', null, ['A-1106'], 'AWS observation', 'Minimum temperature in cold wave range; power supply status being checked.'],
  ['INC-2010', 'Debris flow — Kedarnath route', 'landslide', 'UK', 'Rudraprayag', 'Kedarnath pedestrian route', 'High', 'Response in Progress', 'Verified',
    360, 45, 240, 'op-05', 'tm-uk-01', ['A-1110'], 'Operator-entered, field verified', 'Route partially obstructed; clearing under way.'],
  ['INC-2011', 'Forest fire detections — Uttarkashi', 'wildfire', 'UK', 'Uttarkashi', 'Forest range', 'Moderate', 'Under Verification', 'Pending',
    205, 90, 240, 'op-05', null, ['A-1112'], 'Satellite detections', 'High-confidence detections; field verification requested.'],
  ['INC-2012', 'Waterlogging — Wayanad', 'flood', 'KL', 'Wayanad', 'Low-lying wards', 'Low', 'Resolved', 'Verified',
    700, 200, null, 'op-06', null, ['A-1114'], 'Operator-entered', 'Waterlogging subsided.'],
];

export function buildIncidents(base, alertsById) {
  return INCIDENT_ROWS.map((r) => {
    const [id, title, hazard, stateCode, district, location, severity, status, verification,
      created, updated, due, operator, team, alertIds, provenance, description] = r;
    const createdAt = isoAgo(base, created);
    return {
      id, title, hazard, description, stateCode, district, location,
      linkedAlertIds: alertIds.filter((a) => alertsById[a]),
      provenance, severity, verification, status,
      assignedOperator: operator, assignedTeam: team,
      createdAt, updatedAt: isoAgo(base, updated),
      dueAt: due == null ? null : new Date(base + due * TIME.MIN).toISOString(),
      taskIds: [], resourceIds: [],
      notes: [],
      timeline: [
        { id: `${id}-t0`, at: createdAt, by: 'System', type: 'created', text: `Incident created — ${provenance}` },
        ...(status !== 'Reported'
          ? [{ id: `${id}-t1`, at: isoAgo(base, updated), by: operator || 'System', type: 'status', text: `Status: ${status}` }]
          : []),
      ],
      closureReason: status === 'Closed' ? 'Closed' : null,

      origin: 'baseline',
    };
  });
}

/* ── Tasks ─────────────────────────────────────────────────────────────
 * [id, incidentId, category, location, state, priority, assignee, status, minsAgoCreated, dueInMin, instructions]
 */
const TASK_ROWS = [
  ['TSK-3001', 'INC-1001', 'Monitoring review', 'Pasighat gauge', 'AR', 'High', 'tm-ar-01', 'In Progress', 280, 60, 'Confirm gauge reading by phone and report hourly until level falls below warning threshold.'],
  ['TSK-3002', 'INC-1001', 'Relief distribution', 'Pasighat shelters', 'AR', 'Medium', 'tm-ar-05', 'Assigned', 240, 180, 'Verify shelter readiness and stock levels.'],
  ['TSK-3003', 'INC-1002', 'Field verification', 'NH-13 near Daporijo', 'AR', 'Urgent', 'tm-ar-03', 'In Progress', 90, 30, 'Verify slope failure extent and whether the carriageway is passable.'],
  ['TSK-3004', 'INC-1003', 'Road assessment', 'Anini–Roing road', 'AR', 'High', null, 'Unassigned', 135, 90, 'Assess road debris and obstruction.'],
  ['TSK-3005', 'INC-1005', 'Field verification', 'Sela Pass corridor', 'AR', 'High', 'tm-ar-04', 'Assigned', 190, 60, 'Verify corridor condition before transport advisories.'],
  ['TSK-3006', 'INC-1006', 'Infrastructure inspection', 'Tawang bridges', 'AR', 'Medium', 'tm-ar-06', 'In Progress', 130, 300, 'Inspect bridges and public buildings near the epicentral area.'],
  ['TSK-3007', 'INC-1007', 'Fire verification', 'Miao forest range', 'AR', 'High', 'tm-ar-03', 'Awaiting Verification', 170, -30, 'Field team reports burn area; awaiting operator verification of findings.'],
  ['TSK-3008', 'INC-1009', 'Community liaison', 'High-altitude posts', 'AR', 'Low', null, 'Unassigned', 150, 480, 'Check winter supply status with post commanders.'],
  ['TSK-3009', 'INC-1004', 'Monitoring review', 'Roing gauge', 'AR', 'Medium', 'tm-ar-02', 'Assigned', 200, -20, 'Report gauge level at 3-hour intervals.'],
  ['TSK-3010', 'INC-1011', 'Field verification', 'Seppa link road', 'AR', 'Medium', null, 'Unassigned', 60, 200, 'Verify washout report and passability.'],
  ['TSK-3011', 'INC-2001', 'Infrastructure inspection', 'Embankment — Dibrugarh', 'AS', 'Urgent', 'tm-as-01', 'In Progress', 220, 45, 'Patrol and report embankment seepage points.'],
  ['TSK-3012', 'INC-2001', 'Relief distribution', 'Relief camps — Dibrugarh', 'AS', 'High', 'tm-as-01', 'Assigned', 200, 120, 'Confirm camp readiness.'],
  ['TSK-3013', 'INC-2002', 'Road assessment', 'North Sikkim highway', 'SK', 'High', 'tm-sk-01', 'In Progress', 180, 90, 'Assess unstable sections and recommend closures.'],
  ['TSK-3014', 'INC-2003', 'Heat-action', 'Churu blocks', 'RJ', 'High', 'tm-rj-01', 'In Progress', 100, 240, 'Deploy water points and advisory to health centres.'],
  ['TSK-3015', 'INC-2004', 'Field verification', 'Gurez road', 'JK', 'Urgent', null, 'Unassigned', 150, 60, 'Verify road status and avalanche debris.'],
  ['TSK-3016', 'INC-2006', 'Infrastructure inspection', 'Mangan', 'SK', 'High', 'tm-sk-01', 'Awaiting Verification', 1400, -240, 'Damage assessment submitted; awaiting verification.'],
  ['TSK-3017', 'INC-2010', 'Road assessment', 'Kedarnath route', 'UK', 'High', 'tm-uk-01', 'In Progress', 340, 120, 'Clear debris and certify route.'],
  ['TSK-3018', 'INC-1012', 'Road assessment', 'Joshimath approach', 'UK', 'Medium', 'tm-uk-01', 'Completed', 1380, null, 'Clear debris and restore traffic.'],
  ['TSK-3019', 'INC-2011', 'Fire verification', 'Uttarkashi forest range', 'UK', 'Medium', null, 'Unassigned', 195, 200, 'Verify detections with forest staff.'],
  ['TSK-3020', 'INC-1010', 'Field verification', 'Bomdila approach', 'AR', 'Low', 'tm-ar-03', 'Cancelled', 860, null, 'Cancelled after warning was withdrawn.'],
];

export function buildTasks(base, incidents) {
  const byId = Object.fromEntries(incidents.map((i) => [i.id, i]));
  const tasks = TASK_ROWS.map((r) => {
    const [id, incidentId, category, location, stateCode, priority, assignee, status, created, due, instructions] = r;
    const createdAt = isoAgo(base, created);
    return {
      id, incidentId, category, location, stateCode, priority, assignee, status,
      createdAt,
      dueAt: due == null ? null : new Date(base + due * TIME.MIN).toISOString(),
      instructions,
      completionNotes: status === 'Completed' ? 'Debris cleared; carriageway open.' : '',
      completedAt: status === 'Completed' ? isoAgo(base, 600) : null,
      evidenceRefs: [],
      history: [{ id: `${id}-h0`, at: createdAt, by: 'System', text: `Task created${assignee ? ' and assigned' : ''}` }],

      origin: 'baseline',
    };
  });
  tasks.forEach((t) => { if (byId[t.incidentId]) byId[t.incidentId].taskIds.push(t.id); });
  return tasks;
}

/* ── Resources ─────────────────────────────────────────────────────────
 * [id, category, name, state, district, availability, capacity, capUnit, assignedIncident, unit, minsAgoUpdated, extra]
 */
const RES_ROWS = [
  ['SH-001', 'shelter', 'Government Higher Secondary School, Pasighat (relief shelter)', 'AR', 'East Siang', 'Available', 250, 'persons', null, 'District Administration', 120, {}],
  ['SH-002', 'shelter', 'Community Hall, Roing', 'AR', 'Lower Dibang Valley', 'Available', 120, 'persons', null, 'District Administration', 200, {}],
  ['SH-003', 'shelter', 'Relief Camp Site, Tezu', 'AR', 'Lohit', 'Needs verification', null, '', null, 'District Administration', 900, {}],
  ['SH-004', 'shelter', 'Dibrugarh relief camp cluster A', 'AS', 'Dibrugarh', 'Allocated', 600, 'persons', 'INC-2001', 'State Disaster Management', 60, {}],
  ['SH-005', 'shelter', 'Tawang cold-weather shelter', 'AR', 'Tawang', 'Available', 80, 'persons', null, 'District Administration', 400, {}],
  ['SH-006', 'shelter', 'Mangan relief shelter', 'SK', 'Mangan', 'Available', 150, 'persons', null, 'State Disaster Management', 330, {}],
  ['TM-001', 'team', 'Rescue Team AR-01', 'AR', 'East Siang', 'Allocated', 12, 'personnel', 'INC-1001', 'State Response Unit', 30, { teamId: 'tm-ar-01' }],
  ['TM-002', 'team', 'Rescue Team AR-02', 'AR', 'Lower Dibang Valley', 'Allocated', 10, 'personnel', 'INC-1004', 'State Response Unit', 60, { teamId: 'tm-ar-02' }],
  ['TM-003', 'team', 'Rescue Team AS-01', 'AS', 'Dibrugarh', 'Allocated', 14, 'personnel', 'INC-2001', 'State Response Unit', 40, { teamId: 'tm-as-01' }],
  ['TM-004', 'team', 'Rescue Team UK-01', 'UK', 'Rudraprayag', 'Allocated', 12, 'personnel', 'INC-2010', 'State Response Unit', 50, { teamId: 'tm-uk-01' }],
  ['TM-005', 'team', 'Rescue Team HP-01', 'HP', 'Kullu', 'Available', 10, 'personnel', null, 'State Response Unit', 300, { teamId: 'tm-hp-01' }],
  ['VH-001', 'vehicle', 'Ambulance AR-01', 'AR', 'East Siang', 'Available', 1, 'vehicle', null, 'Health Department', 90, {}],
  ['VH-002', 'vehicle', 'Rescue vehicle AR-02', 'AR', 'Upper Subansiri', 'Available', 1, 'vehicle', null, 'District Administration', 150, {}],
  ['VH-003', 'vehicle', 'JCB excavator AR-03', 'AR', 'Dibang Valley', 'Needs verification', 1, 'vehicle', null, 'Public Works', 800, {}],
  ['VH-004', 'vehicle', 'Boat AS-01', 'AS', 'Dibrugarh', 'Allocated', 1, 'vessel', 'INC-2001', 'State Response Unit', 70, {}],
  ['MD-001', 'medical', 'District Hospital, Pasighat', 'AR', 'East Siang', 'Available', null, '', null, 'Health Department', 300, {}],
  ['MD-002', 'medical', 'Primary Health Centre, Roing', 'AR', 'Lower Dibang Valley', 'Available', null, '', null, 'Health Department', 500, {}],
  ['MD-003', 'medical', 'District Hospital, Tawang', 'AR', 'Tawang', 'Available', null, '', null, 'Health Department', 450, {}],
  ['MD-004', 'medical', 'District Hospital, Dibrugarh', 'AS', 'Dibrugarh', 'Available', null, '', null, 'Health Department', 200, {}],
  ['EQ-001', 'equipment', 'Inflatable boats (set of 4)', 'AR', 'East Siang', 'Available', 4, 'units', null, 'State Response Unit', 600, {}],
  ['EQ-002', 'equipment', 'Satellite phones (set of 6)', 'AR', 'Itanagar', 'Available', 6, 'units', null, 'Control Room', 700, {}],
  ['EQ-003', 'equipment', 'Relief kits — dry rations', 'AR', 'Lower Dibang Valley', 'Available', 400, 'kits', null, 'District Administration', 800, {}],
  ['EQ-004', 'equipment', 'Generator sets (set of 3)', 'SK', 'Mangan', 'Needs verification', 3, 'units', null, 'State Disaster Management', 1200, {}],
  ['RD-001', 'road', 'NH-13 — Daporijo section', 'AR', 'Upper Subansiri', 'Needs verification', null, '', 'INC-1002', 'Public Works', 90, { roadStatus: 'At risk' }],
  ['RD-002', 'road', 'Anini–Roing road', 'AR', 'Dibang Valley', 'Needs verification', null, '', 'INC-1003', 'Public Works', 140, { roadStatus: 'At risk' }],
  ['RD-003', 'road', 'Sela Pass – Tawang road', 'AR', 'Tawang', 'Needs verification', null, '', 'INC-1005', 'Public Works', 90, { roadStatus: 'At risk' }],
  ['RD-004', 'road', 'Seppa link road', 'AR', 'East Kameng', 'Needs verification', null, '', 'INC-1011', 'Public Works', 70, { roadStatus: 'Blocked' }],
  ['RD-005', 'road', 'Pasighat – Itanagar road', 'AR', 'East Siang', 'Available', null, '', null, 'Public Works', 240, { roadStatus: 'Open' }],
  ['RD-006', 'road', 'Tezu – Roing road', 'AR', 'Lohit', 'Available', null, '', null, 'Public Works', 300, { roadStatus: 'Open' }],
  ['RD-007', 'road', 'North Sikkim highway', 'SK', 'Mangan', 'Needs verification', null, '', 'INC-2002', 'State Road Authority', 50, { roadStatus: 'At risk' }],
  ['RD-008', 'road', 'Kedarnath pedestrian route', 'UK', 'Rudraprayag', 'Needs verification', null, '', 'INC-2010', 'State Road Authority', 45, { roadStatus: 'Blocked' }],
  ['RD-009', 'road', 'Ziro–Hapoli road', 'AR', 'Lower Subansiri', 'Available', null, '', null, 'Public Works', 260, { roadStatus: 'Open' }],
];

export function buildResources(base, incidents) {
  const byId = Object.fromEntries(incidents.map((i) => [i.id, i]));
  const res = RES_ROWS.map((r) => {
    const [id, category, name, stateCode, district, availability, capacity, capacityUnit, assignedIncident, unit, updated, extra] = r;
    return {
      id, category, name, stateCode, district, availability, capacity, capacityUnit,
      assignedIncident, responsibleUnit: unit,
      updatedAt: isoAgo(base, updated),
      sourceId: 'manual',
      roadStatus: extra.roadStatus || null,
      teamId: extra.teamId || null,
      history: [{ id: `${id}-h0`, at: isoAgo(base, updated), by: 'System', text: 'Record loaded from demo baseline' }],

      origin: 'baseline',
    };
  });
  res.forEach((r) => { if (r.assignedIncident && byId[r.assignedIncident]) byId[r.assignedIncident].resourceIds.push(r.id); });
  return res;
}
