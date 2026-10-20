/**
 * Role → permission and module-access matrix.
 * Browser-side only: hiding or disabling a control in the browser
 * is not authorization. Real enforcement must live in a backend.
 */
const ALL = [
  'incident.create', 'incident.update', 'incident.transition', 'incident.assign', 'incident.escalate', 'note.add',
  'alert.ack', 'alert.link', 'alert.note',
  'task.create', 'task.assign', 'task.update', 'task.complete', 'task.escalate',
  'resource.assign', 'hazard.verify',
  'sim.run', 'audit.view', 'report.export', 'admin.manage', 'demo.reset',
];

export const ROLE_PERMISSIONS = {
  NATIONAL_ADMIN: ALL,
  STATE_OPERATOR: ALL.filter((p) => !['admin.manage', 'demo.reset'].includes(p)),
  DISTRICT_OPERATOR: [
    'incident.create', 'incident.update', 'incident.transition', 'incident.assign', 'incident.escalate', 'note.add',
    'alert.ack', 'alert.link', 'alert.note',
    'task.create', 'task.assign', 'task.update', 'task.complete', 'task.escalate',
    'resource.assign', 'hazard.verify',
  ],
  FIELD_RESPONDER: ['note.add', 'task.update', 'hazard.verify', 'alert.note'],
  ANALYST: ['sim.run', 'report.export', 'audit.view', 'note.add'],
  AUDITOR: ['audit.view', 'report.export'],
};

export const MODULES = {
  command: 'Command Centre',
  situational: 'Situational Overview',
  hazards: 'Hazard Intelligence',
  alerts: 'Alerts & Warnings',
  incidents: 'Incident Management',
  field: 'Field Operations',
  resources: 'Evacuation & Resources',
  analytics: 'Historical Analytics',
  simulation: 'Simulation & Replay',
  integrations: 'Data Sources & Integrations',
  reports: 'Reports & Audit',
  admin: 'Administration',
};

const EVERYTHING = Object.keys(MODULES);
export const ROLE_MODULES = {
  NATIONAL_ADMIN: EVERYTHING,
  STATE_OPERATOR: EVERYTHING.filter((m) => !['admin', 'simulation'].includes(m)),
  DISTRICT_OPERATOR: EVERYTHING.filter((m) => !['admin', 'reports', 'simulation'].includes(m)),
  FIELD_RESPONDER: ['command', 'situational', 'hazards', 'alerts', 'incidents', 'field', 'resources'],
  ANALYST: EVERYTHING.filter((m) => !['admin', 'simulation'].includes(m)),
  AUDITOR: EVERYTHING.filter((m) => !['admin', 'simulation'].includes(m)),
};

export function can(role, permission) {
  return !!role && (ROLE_PERMISSIONS[role] || []).includes(permission);
}
export function canAccess(role, moduleKey) {
  return !!role && (ROLE_MODULES[role] || []).includes(moduleKey);
}

export const PERMISSION_LABEL = {
  'incident.create': 'Create incidents', 'incident.update': 'Edit incident fields', 'incident.transition': 'Change incident status',
  'incident.assign': 'Assign incident owner', 'incident.escalate': 'Escalate incidents', 'note.add': 'Add notes',
  'alert.ack': 'Acknowledge alerts', 'alert.link': 'Link alerts to incidents', 'alert.note': 'Record alert notes',
  'task.create': 'Create tasks', 'task.assign': 'Assign / reassign tasks', 'task.update': 'Update task progress',
  'task.complete': 'Verify and complete tasks', 'task.escalate': 'Escalate tasks',
  'resource.assign': 'Assign resources', 'hazard.verify': 'Verify hazard records', 
  'sim.run': 'Run simulations', 'audit.view': 'View audit register', 'report.export': 'Export reports',
  'admin.manage': 'Manage administration', 'demo.reset': 'Reset data',
};
