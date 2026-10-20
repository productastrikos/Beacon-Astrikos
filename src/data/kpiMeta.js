/**
 * KPI presentation metadata: name, source entity, drill-down route and explanation.
 * Thresholds, targets and colour rules live in src/config/kpiThresholds.js.
 */
const M = (name, source, to, explanation) => ({ name, source, to, explanation });

export const KPI_META = {
  'cc.activeIncidents': M('Active incidents', 'Incident register', '/incidents', 'Incidents in Reported, Under Verification, Confirmed or Response in Progress status within the selected scope.'),
  'cc.warnings': M('Active official warnings', 'Alert register (agency CAP messages)', '/alerts', 'Warnings from source agencies that are inside their validity period and not cancelled.'),
  'cc.highSeverity': M('High-severity incidents', 'Incident register', '/incidents', 'Active incidents whose internal severity is High or Critical.'),
  'cc.districts': M('Districts affected', 'Incident register', '/situational-overview', 'Distinct districts with at least one active incident.'),
  'cc.openTasks': M('Open response tasks', 'Task register (Field Operations)', '/field-operations', 'Tasks that are Unassigned, Assigned, In Progress or Awaiting Verification.'),
  'cc.sources': M('Data sources needing attention', 'Data source registry', '/integrations', 'Sources reported as Delayed or Offline by ingestion monitoring.'),
  'al.active': M('Active alerts', 'Alert register', '/alerts', 'Alerts inside their validity period.'),
  'al.unack': M('Unacknowledged alerts', 'Alert register', '/alerts', 'Active alerts that no operator has acknowledged yet.'),
  'al.expiring': M('Expiring within 24 hours', 'Alert register', '/alerts', 'Active alerts whose validity ends within the next 24 hours.'),
  'al.cancelled': M('Cancelled by source', 'Alert register', '/alerts', 'Alerts for which the issuing agency sent a cancellation message.'),
  'fo.open': M('Open tasks', 'Task register', '/field-operations', 'Tasks not yet completed or cancelled.'),
  'fo.unassigned': M('Unassigned tasks', 'Task register', '/field-operations', 'Open tasks with no team or operator assigned.'),
  'fo.overdue': M('Overdue tasks', 'Task register', '/field-operations', 'Open tasks whose due time has passed.'),
  'fo.awaiting': M('Awaiting verification', 'Task register', '/field-operations', 'Tasks where the field team has reported and an operator must verify.'),
  'fo.completed': M('Completed tasks', 'Task register', '/field-operations', 'Tasks verified as completed.'),
  'int.connected': M('Connected sources', 'Data source registry', '/integrations', 'Sources delivering data on schedule.'),
  'int.delayed': M('Delayed sources', 'Data source registry', '/integrations', 'Sources whose latest update is later than expected.'),
  'int.offline': M('Offline sources', 'Data source registry', '/integrations', 'Sources that are not responding.'),
  'int.records': M('Records ingested', 'Data source registry', '/integrations', 'Records received from all sources.'),
  'an.incidents': M('Incidents in period', 'Incident register (history)', '/incidents', 'Incidents created during the selected period.'),
  'an.ack': M('Median time to acknowledge', 'Alert register (history)', '/alerts', 'Median minutes from alert issue to first operator acknowledgement.'),
  'an.completion': M('Task completion rate', 'Task register (history)', '/field-operations', 'Completed tasks as a share of non-cancelled tasks created in the period.'),
  'an.verification': M('Verification outcome', 'Incident register (history)', '/incidents', 'Share of verified incidents that were confirmed rather than not verified.'),
  'hz.records': M('Monitoring records', 'Hazard monitoring records', null, 'Monitoring records for this hazard in the selected scope.'),
  'hz.warnings': M('Active warnings', 'Alert register', '/alerts', 'Active agency warnings for this hazard.'),
  'hz.exceeding': M('Records beyond threshold', 'Hazard monitoring records', null, 'Records at or beyond their warning threshold.'),
  'hz.districts': M('Districts affected', 'Incident register', '/incidents', 'Districts with an active incident for this hazard.'),
};
