import { isoAgo, TIME } from '../../utils/format';
import { STATE_NAME } from './geography';

const SENDER_LABEL = {
  imd: 'India Meteorological Department', cwc: 'Central Water Commission', sachet: 'NDMA SACHET',
  gsi: 'Geological Survey of India', usgs: 'USGS', firms: 'NASA FIRMS', incois: 'INCOIS',
};
const CATEGORY = {
  flood: 'Met', landslide: 'Geo', earthquake: 'Geo', avalanche: 'Geo', wildfire: 'Fire', heatwave: 'Met', coldwave: 'Met',
};

/** Raw message preserved verbatim; the app never edits source fields. */
export function buildOriginalMessage(a) {
  return [
    '<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">',
    `  <identifier>${a.identifier}</identifier>`,
    `  <sender>${SENDER_LABEL[a.sender] || a.sender}</sender>`,
    `  <sent>${a.sent}</sent>`,
    `  <status>${a.status}</status>`,
    `  <msgType>${a.msgType}</msgType>`,
    '  <scope>Public</scope>',
    '  <info>',
    `    <category>${CATEGORY[a.hazard] || 'Other'}</category>`,
    `    <event>${a.event}</event>`,
    `    <urgency>${a.urgency}</urgency>`,
    `    <severity>${a.severity}</severity>`,
    `    <certainty>${a.certainty}</certainty>`,
    `    <effective>${a.effective}</effective>`,
    `    <expires>${a.expires}</expires>`,
    `    <headline>${a.headline}</headline>`,
    `    <area><areaDesc>${a.areaDesc}</areaDesc></area>`,
    '  </info>',
    '</alert>',
  ].join('\n');
}

// [id, sender, hazard, state, districts, event, severity, urgency, certainty, sentMinAgo, expiresInMin, headline, classification, extra]
const ROWS = [
  ['A-1001', 'imd', 'flood', 'AR', ['East Siang', 'Upper Siang', 'Lower Dibang Valley'], 'Heavy Rainfall', 'Severe', 'Expected', 'Likely', 140, 1300,
    'Heavy to very heavy rainfall likely over Siang and Dibang basins', 'Official', {}],
  ['A-1002', 'cwc', 'flood', 'AR', ['East Siang'], 'River level above warning level', 'Moderate', 'Expected', 'Observed', 40, 360,
    'Siang at Pasighat above warning level', 'Official', {}],
  ['A-1003', 'imd', 'landslide', 'AR', ['Upper Subansiri', 'Dibang Valley', 'Lower Subansiri'], 'Landslide possibility', 'Severe', 'Expected', 'Possible', 160, 1200,
    'Landslides possible in vulnerable terrain following heavy rain', 'Official', {}],
  ['A-1004', 'gsi', 'landslide', 'AR', ['Upper Subansiri'], 'Landslide susceptibility bulletin', 'Moderate', 'Future', 'Possible', 600, 2800,
    'Elevated landslide susceptibility along the NH corridor', 'Official', {}],
  ['A-1005', 'usgs', 'earthquake', 'AR', ['Tawang'], 'Earthquake M4.3', 'Minor', 'Past', 'Observed', 140, 720,
    'M4.3 earthquake 38 km NW of Tawang', 'Official', {}],
  ['A-1006', 'imd', 'avalanche', 'AR', ['Tawang'], 'Avalanche warning', 'Severe', 'Expected', 'Possible', 200, 900,
    'Avalanche danger Considerable above 3,500 m', 'Official', {}],
  ['A-1007', 'firms', 'wildfire', 'AR', ['Changlang', 'Tirap', 'Lohit'], 'Satellite fire detections', 'Unknown', 'Unknown', 'Observed', 180, 480,
    'Multiple active-fire detections reported by satellite', 'Official', {}],
  ['A-1008', 'imd', 'coldwave', 'AR', ['Tawang'], 'Cold conditions advisory', 'Minor', 'Future', 'Possible', 300, 1500,
    'Below-freezing minimum temperatures at high altitude', 'Official', {}],
  ['A-1009', 'sachet', 'flood', 'AR', ['Lohit'], 'Flood watch', 'Moderate', 'Expected', 'Possible', 220, 700,
    'Flood watch for Lohit river reaches', 'Official', {}],
  ['A-1010', 'imd', 'landslide', 'AR', ['West Kameng'], 'Landslide possibility', 'Moderate', 'Expected', 'Possible', 900, 600,
    'Landslide possibility West Kameng', 'Official', { cancelled: true, msgType: 'Cancel', history: [{ minAgo: 900, msgType: 'Alert', note: 'Initial issue' }, { minAgo: 300, msgType: 'Cancel', note: 'Cancelled by issuing agency (rain forecast revised)' }] }],

  ['A-1101', 'imd', 'flood', 'AS', ['Dibrugarh', 'Majuli', 'Lakhimpur'], 'Very heavy rainfall; flood', 'Severe', 'Expected', 'Likely', 150, 1400,
    'Very heavy rainfall and flood risk in upper Assam', 'Official', {}],
  ['A-1102', 'cwc', 'flood', 'AS', ['Dibrugarh'], 'River level above danger level', 'Severe', 'Immediate', 'Observed', 55, 480,
    'Brahmaputra at Dibrugarh above danger level', 'Official', {}],
  ['A-1103', 'imd', 'landslide', 'SK', ['Mangan'], 'Landslide possibility', 'Severe', 'Expected', 'Likely', 130, 1000,
    'Landslides likely in North Sikkim', 'Official', {}],
  ['A-1104', 'imd', 'heatwave', 'RJ', ['Barmer', 'Churu'], 'Severe heatwave', 'Severe', 'Immediate', 'Observed', 100, 2400,
    'Severe heatwave conditions over west Rajasthan', 'Official', {}],
  ['A-1105', 'imd', 'heatwave', 'UP', ['Banda'], 'Heatwave', 'Moderate', 'Expected', 'Likely', 110, 1800,
    'Heatwave conditions in Bundelkhand', 'Official', {}],
  ['A-1106', 'imd', 'coldwave', 'JK', ['Kupwara'], 'Cold wave', 'Severe', 'Expected', 'Likely', 140, 1500,
    'Cold wave in Kashmir valley', 'Official', {}],
  ['A-1107', 'imd', 'avalanche', 'HP', ['Lahaul and Spiti'], 'Avalanche warning', 'Severe', 'Expected', 'Possible', 280, 1100,
    'Avalanche warning above 3,000 m', 'Official', {}],
  ['A-1108', 'imd', 'avalanche', 'JK', ['Kupwara'], 'Avalanche warning', 'Extreme', 'Immediate', 'Likely', 160, 800,
    'High avalanche danger: Gurez axis', 'Official', {}],
  ['A-1109', 'usgs', 'earthquake', 'SK', ['Mangan'], 'Earthquake M5.1', 'Moderate', 'Past', 'Observed', 1500, 2000,
    'M5.1 earthquake 41 km N of Mangan', 'Official', {}],
  ['A-1110', 'sachet', 'landslide', 'UK', ['Rudraprayag'], 'Landslide possibility', 'Severe', 'Expected', 'Possible', 380, 900,
    'Landslide possibility Rudraprayag', 'Official', {}],
  ['A-1111', 'imd', 'flood', 'BR', ['Sitamarhi', 'Darbhanga'], 'Flood watch', 'Moderate', 'Expected', 'Possible', 230, 1200,
    'Flood watch for north Bihar rivers', 'Official', {}],
  ['A-1112', 'firms', 'wildfire', 'UK', ['Uttarkashi'], 'Satellite fire detections', 'Unknown', 'Unknown', 'Observed', 205, 480,
    'Active-fire detections in forest range', 'Official', {}],
  ['A-1113', 'imd', 'coldwave', 'LA', ['Leh'], 'Cold wave', 'Moderate', 'Expected', 'Likely', 200, 1700,
    'Severe cold at high altitude', 'Official', {}],
  ['A-1114', 'imd', 'flood', 'KL', ['Wayanad', 'Idukki'], 'Heavy rainfall', 'Moderate', 'Expected', 'Possible', 260, 900,
    'Heavy rainfall over Western Ghats districts', 'Official', {}],
];

export function buildAlerts(base) {
  return ROWS.map((r, i) => {
    const [id, sender, hazard, stateCode, districts, event, severity, urgency, certainty, sentAgo, expiresIn, headline, classification, extra] = r;
    const sent = isoAgo(base, sentAgo);
    const a = {
      id,
      identifier: `BEACON.${sender.toUpperCase()}.${id}`,
      sender, sent,
      status: 'Exercise',
      msgType: extra.msgType || 'Alert',
      category: CATEGORY[hazard],
      event, urgency, severity, certainty,
      effective: sent,
      expires: new Date(base + expiresIn * TIME.MIN).toISOString(),
      headline,
      description: `${headline}. Issued by ${SENDER_LABEL[sender]}.`,
      instruction: 'Operators: review against local observations and follow SOP. This is a demo record.',
      areaDesc: `${districts.join(', ')} — ${STATE_NAME[stateCode]}`,
      hazard, stateCode, districts, classification,
      cancelled: !!extra.cancelled,
      ackBy: null, ackAt: null,
      linkedIncidentIds: [],
      notes: [],
      history: (extra.history || [{ minAgo: sentAgo, msgType: 'Alert', note: 'Initial issue' }])
        .map((h) => ({ at: isoAgo(base, h.minAgo), msgType: h.msgType, note: h.note })),

      origin: 'baseline',
      _order: i,
    };
    delete a._order;
    return a;
  });
}
