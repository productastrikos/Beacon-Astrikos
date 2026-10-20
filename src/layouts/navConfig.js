import { MODULE_ICON } from '../config/icons';

const item = (path, label, module, extra = {}) => ({ path, label, module, iconName: MODULE_ICON[path], ...extra });

export const NAV_GROUPS = [
  { key: 'command', label: 'Command', items: [
    item('/command-centre', 'Command Centre', 'command'),
    item('/situational-overview', 'Situational Overview', 'situational'),
  ] },
  { key: 'hazard', label: 'Hazard Intelligence', items: [
    item('/hazards/flood', 'Flood Monitoring', 'hazards', { hazard: 'flood' }),
    item('/hazards/landslide', 'Landslide Monitoring', 'hazards', { hazard: 'landslide' }),
    item('/hazards/earthquake', 'Earthquake Monitoring', 'hazards', { hazard: 'earthquake' }),
    item('/hazards/avalanche', 'Avalanche Monitoring', 'hazards', { hazard: 'avalanche' }),
    item('/hazards/wildfire', 'Wildfire Monitoring', 'hazards', { hazard: 'wildfire' }),
    item('/hazards/heatwave', 'Heatwave Monitoring', 'hazards', { hazard: 'heatwave' }),
    item('/hazards/coldwave', 'Coldwave Monitoring', 'hazards', { hazard: 'coldwave' }),
    item('/multi-hazard', 'Multi-Hazard Intelligence', 'hazards'),
  ] },
  { key: 'operations', label: 'Operations', items: [
    item('/alerts', 'Alerts & Warnings', 'alerts'),
    item('/incidents', 'Incident Management', 'incidents'),
    item('/field-operations', 'Field Operations', 'field'),
    item('/resources', 'Evacuation & Resources', 'resources'),
  ] },
  { key: 'intelligence', label: 'Intelligence', items: [
    item('/analytics', 'Historical Analytics', 'analytics'),
  ] },
  { key: 'system', label: 'System', items: [
    item('/integrations', 'Data Sources & Integrations', 'integrations'),
    item('/reports', 'Reports & Audit', 'reports'),
    item('/administration', 'Administration', 'admin', { hidden: true }),
    item('/simulation', 'Simulation & Replay', 'simulation'),
  ] },
];

export const NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items.map((i) => ({ ...i, group: g.label, groupKey: g.key })));

/** Longest-prefix match so detail routes (/incidents/INC-1) resolve to their parent module. */
export function matchNav(pathname) {
  const hits = NAV_ITEMS.filter((i) => pathname === i.path || pathname.startsWith(`${i.path}/`));
  return hits.sort((a, b) => b.path.length - a.path.length)[0] || null;
}
