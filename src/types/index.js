/**
 * Shared domain vocabulary + JSDoc typedefs.
 * (The existing project is plain JavaScript / CRA, so types are expressed as
 *  JSDoc typedefs and frozen enums rather than .ts interfaces.)
 */

export const HAZARDS = [
  { key: 'flood',      label: 'Flood' },
  { key: 'landslide',  label: 'Landslide' },
  { key: 'earthquake', label: 'Earthquake' },
  { key: 'avalanche',  label: 'Avalanche' },
  { key: 'wildfire',   label: 'Wildfire' },
  { key: 'heatwave',   label: 'Heatwave' },
  { key: 'coldwave',   label: 'Coldwave' },
];
export const HAZARD_LABEL = Object.fromEntries(HAZARDS.map((h) => [h.key, h.label]));
export const HAZARD_KEYS = HAZARDS.map((h) => h.key);

/** Internal severity used by incidents / tasks / records. Ordered low → high. */
export const SEVERITIES = ['Low', 'Moderate', 'High', 'Critical'];
export const SEVERITY_RANK = { None: 0, Low: 1, Moderate: 2, High: 3, Critical: 4 };

/** CAP 1.2 severity as published by the source. Never rewritten by the app. */
export const CAP_SEVERITIES = ['Unknown', 'Minor', 'Moderate', 'Severe', 'Extreme'];
export const CAP_SEVERITY_RANK = { Unknown: 0, Minor: 1, Moderate: 2, Severe: 3, Extreme: 4 };

export const INCIDENT_STATUSES = [
  'Reported', 'Under Verification', 'Confirmed', 'Unconfirmed',
  'Response in Progress', 'Resolved', 'Closed',
];
export const INCIDENT_ACTIVE_STATUSES = ['Reported', 'Under Verification', 'Confirmed', 'Response in Progress'];
/** Controlled lifecycle: from → allowed next statuses. */
export const INCIDENT_TRANSITIONS = {
  'Reported':             ['Under Verification', 'Closed'],
  'Under Verification':   ['Confirmed', 'Unconfirmed'],
  'Confirmed':            ['Response in Progress', 'Closed'],
  'Unconfirmed':          ['Under Verification', 'Closed'],
  'Response in Progress': ['Resolved'],
  'Resolved':             ['Closed', 'Response in Progress'],
  'Closed':               [],
};
/** Target statuses whose transition must carry a reason. */
export const INCIDENT_REASON_REQUIRED = ['Closed', 'Unconfirmed', 'Resolved'];
export const VERIFICATION_STATUSES = ['Unverified', 'Pending', 'Verified', 'Not Verified'];

export const TASK_STATUSES = ['Unassigned', 'Assigned', 'In Progress', 'Awaiting Verification', 'Completed', 'Cancelled'];
export const TASK_OPEN_STATUSES = ['Unassigned', 'Assigned', 'In Progress', 'Awaiting Verification'];
export const TASK_TRANSITIONS = {
  'Unassigned':            ['Assigned', 'Cancelled'],
  'Assigned':              ['In Progress', 'Unassigned', 'Cancelled'],
  'In Progress':           ['Awaiting Verification', 'Cancelled'],
  'Awaiting Verification': ['Completed', 'In Progress', 'Cancelled'],
  'Completed':             [],
  'Cancelled':             [],
};
export const TASK_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
export const TASK_CATEGORIES = [
  'Field verification', 'Infrastructure inspection', 'Road assessment', 'Community liaison',
  'Medical response', 'Relief distribution', 'Monitoring review', 'Heat-action', 'Fire verification',
  'River gauge monitoring', 'Route closure check', 'Structural inspection', 'Evacuation readiness check',
  'Heat-action check', 'Cooling-centre readiness', 'Shelter readiness check',
];

export const RESOURCE_CATEGORIES = [
  { key: 'shelter',   label: 'Shelters & relief facilities' },
  { key: 'team',      label: 'Rescue teams' },
  { key: 'vehicle',   label: 'Emergency vehicles' },
  { key: 'medical',   label: 'Medical facilities' },
  { key: 'equipment', label: 'Equipment & supplies' },
  { key: 'road',      label: 'Road access & closures' },
];
export const RESOURCE_AVAILABILITY = ['Available', 'Allocated', 'Unavailable', 'Needs verification'];
export const ROAD_STATUSES = ['Open', 'At risk', 'Blocked', 'Needs verification'];

export const ALERT_CLASSIFICATIONS = ['Official', 'Historical'];

export const SOURCE_STATUSES = ['Connected', 'Delayed', 'Offline'];

export const ROLES = {
  NATIONAL_ADMIN:    'National Administrator',
  STATE_OPERATOR:    'State Control Room Operator',
  DISTRICT_OPERATOR: 'District Operator',
  FIELD_RESPONDER:   'Field Responder',
  ANALYST:           'Analyst',
  AUDITOR:           'Auditor',
};

export const SCOPES = [
  { key: 'IN', label: 'PAN INDIA' },
  { key: 'AR', label: 'ARUNACHAL PRADESH' },
];

/**
 * @typedef {Object} Incident
 * @property {string} id
 * @property {string} title
 * @property {string} hazard
 * @property {string} description
 * @property {string} stateCode
 * @property {string} district
 * @property {string} location
 * @property {string[]} linkedAlertIds
 * @property {string} provenance
 * @property {'Low'|'Moderate'|'High'|'Critical'} severity
 * @property {string} verification
 * @property {string} status
 * @property {string|null} assignedOperator
 * @property {string|null} assignedTeam
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {string|null} dueAt
 * @property {string[]} taskIds
 * @property {string[]} resourceIds
 * @property {{id:string,at:string,by:string,role:string,text:string,evidenceRef?:string}[]} notes
 * @property {{id:string,at:string,by:string,type:string,text:string}[]} timeline
 * @property {string|null} closureReason
 * @property {'baseline'|'simulation'|'operator'} origin
 *
 * @typedef {Object} Alert CAP-1.2-shaped; source fields are never rewritten.
 * @property {string} id
 * @property {string} identifier CAP identifier
 * @property {string} sender issuing agency id (imd, cwc, sachet ...)
 * @property {string} sent
 * @property {'Actual'|'Exercise'|'Test'} status
 * @property {'Alert'|'Update'|'Cancel'} msgType
 * @property {string} category
 * @property {string} event
 * @property {string} urgency
 * @property {string} severity CAP severity as issued
 * @property {string} certainty
 * @property {string} effective
 * @property {string} expires
 * @property {string} headline
 * @property {string} description
 * @property {string} instruction
 * @property {string} areaDesc
 * @property {string} hazard
 * @property {string} stateCode
 * @property {string[]} districts
 * @property {string} classification Official | Historical
 * @property {boolean} cancelled
 * @property {string|null} ackBy
 * @property {string|null} ackAt
 * @property {string[]} linkedIncidentIds
 * @property {{id:string,at:string,by:string,text:string}[]} notes
 * @property {{at:string,msgType:string,note:string}[]} history
 *
 * @typedef {Object} Task
 * @property {string} id
 * @property {string|null} incidentId
 * @property {string} category
 * @property {string} location
 * @property {string} stateCode
 * @property {string} priority
 * @property {string|null} assignee team id
 * @property {string} status
 * @property {string} createdAt
 * @property {string|null} dueAt
 * @property {string} instructions
 * @property {string} completionNotes
 * @property {string[]} evidenceRefs
 * @property {{id:string,at:string,by:string,text:string}[]} history
 *
 * @typedef {Object} HazardRecord
 * @property {string} id
 * @property {string} hazard
 * @property {string} kind observation|forecast|event|detection|bulletin|report
 * @property {string} location
 * @property {string} stateCode
 * @property {string} district
 * @property {number|string} value
 * @property {string} unit
 * @property {string} sourceId
 * @property {string} sourceTimestamp
 * @property {string} verification
 * @property {string} classification source-defined class/label
 * @property {string} severity None|Low|Moderate|High|Critical
 * @property {number[]} series short history, oldest to newest
 *
 * @typedef {Object} AuditEntry
 * @property {string} id
 * @property {string} at
 * @property {string} userId
 * @property {string} userName
 * @property {string} role
 * @property {string} action
 * @property {string} entityType
 * @property {string} entityId
 * @property {string|null} previous
 * @property {string|null} next
 * @property {'Success'|'Denied'|'Failed'} outcome
 * @property {'operator'|'integration'|'simulation'} source
 * @property {string} [detail]
 */
export {};
