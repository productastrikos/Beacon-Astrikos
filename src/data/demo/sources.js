/** Data-source registry (ingestion health shown on the Integrations page and across the app). */
const S = (o) => ({ configStatus: 'Configured', error: 'None', ...o });

export const SOURCE_DEFS = [
  S({ id: 'imd', name: 'India Meteorological Department (IMD)', short: 'IMD', hazards: ['flood', 'landslide', 'heatwave', 'coldwave', 'avalanche'],
    method: 'CAP / REST feed', url: 'https://mausam.imd.gov.in', access: 'Service credentials held server-side.', status: 'Connected', lastSuccessMin: 4, lastAttemptMin: 4, records: 128 }),
  S({ id: 'cwc', name: 'Central Water Commission (CWC)', short: 'CWC', hazards: ['flood'],
    method: 'Scheduled bulletin ingestion', url: 'https://cwc.gov.in', access: 'Data-sharing arrangement in place.', status: 'Connected', lastSuccessMin: 9, lastAttemptMin: 9, records: 64 }),
  S({ id: 'sachet', name: 'NDMA SACHET', short: 'SACHET', hazards: ['flood', 'landslide', 'earthquake', 'avalanche', 'wildfire', 'heatwave', 'coldwave'],
    method: 'CAP 1.2 feed', url: 'https://sachet.ndma.gov.in', access: 'Receive-only subscription.', status: 'Connected', lastSuccessMin: 3, lastAttemptMin: 3, records: 212 }),
  S({ id: 'gsi', name: 'Geological Survey of India (GSI)', short: 'GSI', hazards: ['landslide', 'avalanche'],
    method: 'Bulletin ingestion', url: 'https://www.gsi.gov.in', access: 'Bulletins received by agreement.', status: 'Connected', lastSuccessMin: 6, lastAttemptMin: 6, records: 31 }),
  S({ id: 'bhuvan', name: 'ISRO Bhuvan', short: 'Bhuvan', hazards: ['flood', 'landslide', 'wildfire'],
    method: 'OGC web services', url: 'https://bhuvan.nrsc.gov.in', access: 'Public services; boundaries follow the official Survey of India depiction.', status: 'Connected', lastSuccessMin: 18, lastAttemptMin: 18, records: 40 }),
  S({ id: 'firms', name: 'NASA FIRMS', short: 'FIRMS', hazards: ['wildfire'],
    method: 'REST API (server-side key)', url: 'https://firms.modaps.eosdis.nasa.gov', access: 'API key held server-side.', status: 'Connected', lastSuccessMin: 3, lastAttemptMin: 3, records: 124 }),
  S({ id: 'usgs', name: 'USGS Earthquake Catalog', short: 'USGS', hazards: ['earthquake'],
    method: 'GeoJSON feed', url: 'https://earthquake.usgs.gov', access: 'Public feed.', status: 'Connected', lastSuccessMin: 6, lastAttemptMin: 6, records: 9 }),
  S({ id: 'incois', name: 'INCOIS', short: 'INCOIS', hazards: [],
    method: 'Advisory feed', url: 'https://incois.gov.in', access: 'Ocean-state and tsunami advisories.', status: 'Connected', lastSuccessMin: 9, lastAttemptMin: 9, records: 12 }),
  S({ id: 'ncs', name: 'National Center for Seismology (NCS)', short: 'NCS', hazards: ['earthquake'],
    method: 'Event feed', url: 'https://seismo.gov.in', access: 'Public event feed.', status: 'Connected', lastSuccessMin: 2, lastAttemptMin: 2, records: 86 }),
  S({ id: 'seismic', name: 'State seismic network', short: 'Seismic', hazards: ['earthquake'],
    method: 'Station telemetry', url: '', access: 'State station telemetry received through the gateway.', status: 'Connected', lastSuccessMin: 1, lastAttemptMin: 1, records: 142 }),
  S({ id: 'sase', name: 'SASE / DGRE (snow & avalanche)', short: 'SASE', hazards: ['avalanche'],
    method: 'Bulletin and station feed', url: 'https://www.drdo.gov.in', access: 'Bulletins received by agreement.', status: 'Connected', lastSuccessMin: 7, lastAttemptMin: 7, records: 58 }),
  S({ id: 'fsi', name: 'Forest Survey of India (FSI)', short: 'FSI', hazards: ['wildfire'],
    method: 'Fire alert feed', url: 'https://fsi.nic.in', access: 'Alert feed subscription.', status: 'Connected', lastSuccessMin: 5, lastAttemptMin: 5, records: 74 }),
  S({ id: 'stateaws', name: 'State AWS network', short: 'State AWS', hazards: ['heatwave', 'coldwave'],
    method: 'AWS telemetry', url: '', access: 'State automatic weather stations received through the gateway.', status: 'Connected', lastSuccessMin: 1, lastAttemptMin: 1, records: 310 }),
  S({ id: 'stategauge', name: 'State gauge network', short: 'State gauges', hazards: ['flood'],
    method: 'Gauge telemetry', url: '', access: 'State river gauges received through the gateway.', status: 'Connected', lastSuccessMin: 1, lastAttemptMin: 1, records: 205 }),
  S({ id: 'stateeoc', name: 'State EOC bulletins', short: 'State EOCs', hazards: ['flood', 'landslide', 'wildfire', 'heatwave', 'coldwave'],
    method: 'Bulletin ingestion', url: '', access: 'Bulletins received from State Emergency Operations Centres.', status: 'Connected', lastSuccessMin: 11, lastAttemptMin: 11, records: 47 }),
  S({ id: 'sensors', name: 'Gauge station telemetry', short: 'Telemetry', hazards: ['flood', 'landslide', 'heatwave', 'coldwave'],
    method: 'MQTT / HTTP gateway', url: '', access: 'Station telemetry received through the gateway.', status: 'Connected', lastSuccessMin: 2, lastAttemptMin: 2, records: 22 }),
];

export const SOURCE_SHORT = Object.fromEntries(SOURCE_DEFS.map((s) => [s.id, s.short]));
export const SOURCE_NAME = Object.fromEntries(SOURCE_DEFS.map((s) => [s.id, s.name]));
