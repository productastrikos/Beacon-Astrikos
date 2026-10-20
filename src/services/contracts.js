/**
 * Service contracts for replacing the current implementations with real back-ends.
 *
 * Today every module reads and writes through `state/dataStore.js` and
 * `state/actions.js`, which are the *current implementation* of the interfaces
 * below. A backend phase would implement these against an API and keep the UI
 * unchanged, because pages only call actions and selectors.
 *
 * @typedef {Object} AuthService
 * @property {(identifier: string, password: string) => Promise<{ok: boolean, user?: object, error?: string}>} authenticate
 *   Current: authService.js (browser-side roster). Real: OIDC / server session.
 *
 * @typedef {Object} OperationsApi
 * @property {() => Promise<object>} loadSnapshot            incidents, alerts, tasks, resources, records, audit
 * @property {(input: object) => Promise<object>} createIncident
 * @property {(id: string, toStatus: string, reason?: string) => Promise<object>} transitionIncident
 * @property {(alertId: string, note?: string) => Promise<object>} acknowledgeAlert
 * @property {(input: object) => Promise<object>} createTask
 * @property {(taskId: string, teamId: string|null) => Promise<object>} assignTask
 *   Current: state/actions.js. Real: REST/GraphQL with server-side authorization and a server-written audit log.
 *
 * @typedef {Object} DataSourceAdapter
 * @property {string} id                       matches a source id (imd, cwc, sachet, ...)
 * @property {() => Promise<{status: string, checkedAt: string, detail?: string}>} checkConnection
 * @property {(since?: string) => Promise<{records: object[], receivedAt: string}>} fetchLatest
 *   Real adapters run on a server (credentials never reach the browser) and normalise source payloads
 *   (e.g. CAP 1.2 XML) into the Alert / HazardRecord shapes defined in types/index.js.
 */
export {};
