/**
 * Single mapping from every severity / verification / status value to a badge tone.
 * Tones: red · orange · amber · green · blue · cyan · violet · slate.
 */
export const SEVERITY_TONE = { Critical: 'red', High: 'orange', Moderate: 'amber', Low: 'blue', None: 'slate' };
export const CAP_SEVERITY_TONE = { Extreme: 'red', Severe: 'orange', Moderate: 'amber', Minor: 'blue', Unknown: 'slate' };
export const VERIFICATION_TONE = {
  Verified: 'green', Pending: 'amber', Unverified: 'slate', 'Not Verified': 'slate', Rejected: 'slate', Automated: 'blue',
};
export const INCIDENT_STATUS_TONE = {
  Reported: 'slate', New: 'slate', Open: 'slate', 'Under Verification': 'amber', Confirmed: 'blue', Unconfirmed: 'slate',
  'Response in Progress': 'blue', Resolved: 'green', Closed: 'green',
};
export const TASK_STATUS_TONE = {
  Unassigned: 'amber', Assigned: 'blue', 'In Progress': 'blue', 'Awaiting Verification': 'amber', Completed: 'green', Cancelled: 'slate',
};
export const PRIORITY_TONE = { Urgent: 'red', High: 'orange', Medium: 'amber', Low: 'blue' };
export const SOURCE_STATUS_TONE = { Connected: 'green', Delayed: 'amber', Offline: 'red' };
export const CLASSIFICATION_TONE = { Official: 'blue', Historical: 'slate' };
export const ALERT_STATUS_TONE = { Active: 'blue', Updated: 'blue', Cancelled: 'slate', Expired: 'slate' };
export const AVAILABILITY_TONE = { Available: 'green', Allocated: 'blue', Unavailable: 'slate', 'Needs verification': 'amber' };
export const ROAD_TONE = { Open: 'green', 'At risk': 'amber', Blocked: 'red', 'Needs verification': 'amber' };
export const FRESHNESS_TONE = { fresh: 'green', aging: 'amber', stale: 'orange', unknown: 'slate' };
export const REVIEW_TONE = { 'Pending review': 'amber', 'Reviewed — action taken': 'green', 'Reviewed — no action': 'slate', Dismissed: 'slate' };
export const OUTCOME_TONE = { Success: 'green', Denied: 'amber', Failed: 'red' };
/** KPI card status (from kpiStatus) -> tone and footer label. */
export const KPI_STATUS_TONE = { green: 'green', amber: 'amber', red: 'red', blue: 'slate' };
export const KPI_STATUS_LABEL = { green: 'NORMAL', amber: 'WARNING', red: 'CRITICAL' };
/** Normalises the 'slate' tone to the legacy 'grey' CSS class. */
export const toneClass = (tone) => (tone === 'slate' ? 'grey' : tone || 'grey');
