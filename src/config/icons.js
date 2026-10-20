import hazardIcons from './hazardIcons.json';

/**
 * Central icon configuration. Every hazard, severity, status and module icon in
 * the app is resolved from here; no emoji characters are hard-coded elsewhere.
 *
 * Artwork: Microsoft Fluent UI Emoji, Flat style (MIT), served as local SVGs from
 * /public/icons/fluent (see scripts/fetch-fluent-emoji.js and LICENSE.txt there).
 * The India flag is a local drawing because Fluent UI Emoji ships no country flags.
 */

/** Human-readable label for every icon slug (used for aria-label / title). */
export const ICON_LABEL = {
  'water-wave': 'Water wave', mountain: 'Mountain', 'seismic-wave': 'Seismic wave', 'vibration-mode': 'Seismic vibration', 'snow-capped-mountain': 'Snow-capped mountain', avalanche: 'Avalanche',
  fire: 'Fire', thermometer: 'Thermometer', snowflake: 'Snowflake', 'puzzle-piece': 'Combined hazards', cyclone: 'Cyclone', desert: 'Drought',
  'high-voltage': 'Lightning', 'control-knobs': 'Control panel', satellite: 'Satellite', loudspeaker: 'Loudspeaker',
  'police-car-light': 'Emergency light', 'safety-vest': 'Safety vest', minibus: 'Transport vehicle', brain: 'Analysis', 'bar-chart': 'Bar chart',
  gear: 'Settings', 'busts-in-silhouette': 'Users', warning: 'Warning', 'round-pushpin': 'Location pin', clipboard: 'Clipboard',
  'electric-plug': 'Connection', 'chart-increasing': 'Increasing', 'chart-decreasing': 'Decreasing',
  'blue-square': 'Low', 'yellow-square': 'Moderate', 'orange-square': 'High', 'red-square': 'Critical',
  'white-circle': 'None', 'green-circle': 'Good', 'orange-circle': 'Degraded', 'red-circle': 'Unavailable', 'yellow-circle': 'Caution', 'blue-circle': 'Information',
  'new-button': 'New', 'counterclockwise-arrows': 'In progress', 'pause-button': 'On hold', 'check-mark-button': 'Complete', locked: 'Closed',
  'check-mark': 'Verified', 'hourglass-not-done': 'Pending', 'hourglass-done': 'Expired', 'red-question-mark': 'Unverified',
  'bust-in-silhouette': 'Assigned', 'flag-india': 'India', 'world-map': 'Map', 'three-oclock': 'Clock', 'crescent-moon': 'Dark theme', sun: 'Light theme',
  bell: 'Notifications', magnifier: 'Review', 'cross-mark': 'Failed', prohibited: 'Cancelled', 'no-entry': 'Unavailable', construction: 'Blocked',
  motorway: 'Road', pushpin: 'Allocated', 'hammer-and-wrench': 'Response', 'chequered-flag': 'Resolved', eye: 'Observed', wastebasket: 'Dismissed',
  'card-index-dividers': 'Archive', 'classical-building': 'Official', 'inbox-tray': 'Inbox', 'play-button': 'Run', 'up-arrow': 'Higher', 'down-arrow': 'Lower',
  minus: 'Medium', 'bookmark-tabs': 'Reports', 'anticlockwise-arrows': 'Updated', memo: 'Note', 'locked-with-key': 'Secured', 'no-mobile': 'Offline',
};

/** Hazards (sidebar, tables, filters, page titles). */
export const HAZARD_ICON = hazardIcons.icons;
/** Hazards that share artwork are told apart by tint; duplicates are rejected by scripts/check-icons.js. */
export const HAZARD_TINT = hazardIcons.tints;

/** Modules, keyed by route path. */
export const MODULE_ICON = {
  '/command-centre': 'control-knobs',
  '/situational-overview': 'satellite',
  '/hazards/flood': HAZARD_ICON.flood,
  '/hazards/landslide': HAZARD_ICON.landslide,
  '/hazards/earthquake': HAZARD_ICON.earthquake,
  '/hazards/avalanche': HAZARD_ICON.avalanche,
  '/hazards/wildfire': HAZARD_ICON.wildfire,
  '/hazards/heatwave': HAZARD_ICON.heatwave,
  '/hazards/coldwave': HAZARD_ICON.coldwave,
  '/multi-hazard': HAZARD_ICON.multi,
  '/alerts': 'loudspeaker',
  '/incidents': 'police-car-light',
  '/field-operations': 'safety-vest',
  '/resources': 'minibus',
  '/analytics': 'chart-increasing',
  '/simulation': 'play-button',
  '/integrations': 'electric-plug',
  '/reports': 'bar-chart',
  '/administration': 'gear',
  '/users': 'busts-in-silhouette',
};

/** Page-title → icon (page headers). */
export const TITLE_ICON = {
  'Command Centre': MODULE_ICON['/command-centre'],
  'Situational Overview': MODULE_ICON['/situational-overview'],
  'Multi-Hazard Intelligence': MODULE_ICON['/multi-hazard'],
  'Alerts & Warnings': MODULE_ICON['/alerts'],
  'Incident Management': MODULE_ICON['/incidents'],
  'Field Operations': MODULE_ICON['/field-operations'],
  'Evacuation & Resources': MODULE_ICON['/resources'],
  'Historical Analytics': MODULE_ICON['/analytics'],
  'Simulation & Replay': MODULE_ICON['/simulation'],
  'Data Sources & Integrations': MODULE_ICON['/integrations'],
  'Reports & Audit': MODULE_ICON['/reports'],
  Administration: MODULE_ICON['/administration'],
  'Flood Monitoring': HAZARD_ICON.flood,
  'Landslide Monitoring': HAZARD_ICON.landslide,
  'Earthquake Monitoring': HAZARD_ICON.earthquake,
  'Avalanche Monitoring': HAZARD_ICON.avalanche,
  'Wildfire Monitoring': HAZARD_ICON.wildfire,
  'Heatwave Monitoring': HAZARD_ICON.heatwave,
  'Coldwave Monitoring': HAZARD_ICON.coldwave,
};

/** Internal severity (matches chart bar colours: blue / yellow / orange / red). */
export const SEVERITY_ICON = { Low: 'blue-square', Moderate: 'yellow-square', High: 'orange-square', Critical: 'red-square', None: 'white-circle' };
/** CAP severity as issued by the source. */
export const CAP_SEVERITY_ICON = { Minor: 'blue-square', Moderate: 'yellow-square', Severe: 'orange-square', Extreme: 'red-square', Unknown: 'white-circle' };

export const INCIDENT_STATUS_ICON = {
  Reported: 'new-button', 'Under Verification': 'counterclockwise-arrows', Confirmed: 'counterclockwise-arrows', Unconfirmed: 'pause-button',
  'Response in Progress': 'counterclockwise-arrows', Resolved: 'check-mark-button', Closed: 'locked',
};
export const VERIFICATION_ICON = {
  Verified: 'check-mark', Pending: 'hourglass-not-done', Unverified: 'red-question-mark', 'Not Verified': 'red-question-mark',
  Automated: 'gear',
};
export const TASK_STATUS_ICON = {
  Unassigned: 'inbox-tray', Assigned: 'bust-in-silhouette', 'In Progress': 'counterclockwise-arrows', 'Awaiting Verification': 'magnifier',
  Completed: 'check-mark-button', Cancelled: 'prohibited',
};
export const PRIORITY_ICON = { Urgent: 'fire', High: 'up-arrow', Medium: 'minus', Low: 'down-arrow' };
export const AVAILABILITY_ICON = { Available: 'green-circle', Allocated: 'pushpin', Unavailable: 'no-entry', 'Needs verification': 'magnifier' };
export const ROAD_ICON = { Open: 'motorway', 'At risk': 'warning', Blocked: 'construction', 'Needs verification': 'magnifier' };
export const FRESHNESS_ICON = { fresh: 'green-circle', aging: 'yellow-circle', stale: 'orange-circle', unknown: 'red-question-mark' };
export const ALERT_STATUS_ICON = { Active: 'bell', Updated: 'anticlockwise-arrows', Cancelled: 'prohibited', Expired: 'hourglass-done' };
export const SOURCE_STATUS_ICON = { Connected: 'green-circle', Delayed: 'orange-circle', Offline: 'red-circle' };
export const CLASSIFICATION_ICON = { Official: 'classical-building', Historical: 'card-index-dividers' };
export const REVIEW_ICON = { 'Pending review': 'hourglass-not-done', 'Reviewed — action taken': 'check-mark-button', 'Reviewed — no action': 'eye', Dismissed: 'wastebasket' };
export const OUTCOME_ICON = { Success: 'check-mark', Denied: 'no-entry', Failed: 'cross-mark' };

/** Header and miscellaneous UI. */
export const UI_ICON = {
  scopeIndia: 'flag-india', scopeState: 'world-map', clock: 'three-oclock', themeToDark: 'crescent-moon', themeToLight: 'sun',
  notifications: 'bell', trendUp: 'chart-increasing', trendDown: 'chart-decreasing', trendFlat: 'minus', assigned: 'bust-in-silhouette', unassigned: 'white-circle',
  incidentsCreated: 'police-car-light', alertsIssued: 'loudspeaker',
};

/** KPI id → icon (used in the 32px accent chip). */
export const KPI_ICON = {
  'cc.activeIncidents': 'police-car-light', 'cc.warnings': 'loudspeaker', 'cc.highSeverity': 'warning', 'cc.districts': 'round-pushpin',
  'cc.openTasks': 'clipboard', 'cc.sources': 'database-zap',
  'al.active': 'bell', 'al.unack': 'loudspeaker', 'al.expiring': 'hourglass-done', 'al.cancelled': 'prohibited',
  'fo.open': 'clipboard', 'fo.unassigned': 'inbox-tray', 'fo.overdue': 'hourglass-done', 'fo.awaiting': 'magnifier', 'fo.completed': 'check-mark-button',
  'int.connected': 'green-circle', 'int.delayed': 'orange-circle', 'int.offline': 'red-circle', 'int.records': 'bar-chart',
  'an.incidents': 'bar-chart', 'an.ack': 'three-oclock', 'an.completion': 'check-mark-button', 'an.verification': 'check-mark',
};

export const iconUrl = (slug) => `${process.env.PUBLIC_URL || ''}/icons/fluent/${slug}.svg`;
