# Astrikos Beacon — Internal Command Centre (frontend demonstration)

Internal early-warning and disaster-response operations UI for Arunachal Pradesh and PAN India.
This build is a **frontend-only demonstration**: all data is synthetic, no live agency feed is
connected, no public warning can be sent, and there is no map.

## Run

```bash
cd client
npm install
npm start          # development server
npm run build      # production build (static files in client/build)
npm test           # unit + UI tests (Jest / React Testing Library)
```

Requires Node 18+.

## Demo sign-in

Authentication is a **browser-side demo roster, not security**. Accounts are listed on the login page.

| Username | Password | Role |
|---|---|---|
| admin | Astrikos2026 | National Administrator |
| state | Beacon#State1 | State Control Room Operator |
| district | Beacon#District1 | District Operator |
| field | Beacon#Field1 | Field Responder |
| analyst | Beacon#Analyst1 | Analyst |
| auditor | Beacon#Auditor1 | Auditor |

The profile menu has a *Demo: switch role* shortcut for reviewers.

## What is implemented

Login → shared shell (grouped sidebar, header with scope selector, notifications, role menu) →

- **Command Centre**: KPI strip, incident/alert trend (range + hazard filters), severity chart that filters the register, priority incident register with drawer, latest alerts, response activity.
- **Situational Overview**, **Multi-Hazard Intelligence** (tables; no map).
- **Seven hazard modules** from one template (Flood, Landslide, Earthquake, Avalanche, Wildfire, Heatwave, Coldwave) with hazard-specific indicators, records table, detail drawer, verification and create-incident/task actions, no-data/feed-unavailable states.
- **Alerts & Warnings**: CAP-shaped register, source fields preserved verbatim, acknowledge / link / note, update and cancellation history, action history.
- **Incident Management**: register, create, controlled lifecycle (Reported → Under Verification → Confirmed/Unconfirmed → Response in Progress → Resolved → Closed), assign, escalate, notes + evidence refs, tasks, resources, timeline.
- **Field Operations**: tasks, assignment/reassignment, escalation, completion notes, evidence, overdue flags, simulated team roster.
- **Evacuation & Resources**: shelters, teams, vehicles, medical, equipment, roads; incident assignment and history.
- **AI & Risk Analysis**: transparent rule catalogue; assessments evaluated live from the shared data, with inputs, factors, method, no invented confidence, analyst review.
- **Historical Analytics**, **Reports & Audit** (filterable audit register, CSV export), **Administration** (users, role/module matrix, hazard config, statuses, sources, simulation settings, reset).
- **Simulation & Replay**: five scenarios that apply real changes to the shared store (alerts, records, flags, incidents, tasks, assignments, resource status, audit). Start / Pause / Resume / Step / Replay / Reset. Reset removes exactly what the scenario created and restores the fields it changed.
- **Data Sources & Integrations**: status table and drawer. No source is ever shown as *Connected* without a real check.

## Architecture

```
client/src/
  layouts/         AppShell (sidebar + header), navConfig
  pages/           auth, command-centre, hazards, alerts, incidents, operations,
                   analytics, simulation, integrations, admin
  components/      ui (badges, controls, overlays), tables (DataTable), charts, domain
  state/           dataStore (shared data, persisted), session, uiStore, actions
                   (permissioned + audited), simulation engine, rules, selectors, permissions
  services/        authService, dataSources, contracts (interfaces for real back-ends)
  data/demo/       deterministic synthetic datasets + scenarios
  types/           shared vocabulary and JSDoc typedefs
  styles/beacon.css  theme tokens + components (extends the template's index.css)
```

- **Shared state**: every module reads from one store, so an action in one place (e.g. acknowledging an alert, running a scenario) is reflected in KPIs, registers, tasks and the audit log.
- **Persistence**: demo data is stored in `localStorage` key `beacon.demo.data.v1`; session in `sessionStorage` (or `localStorage` with *Remember me*); UI prefs in `beacon.ui.v1`. None contain credentials. Administration → *Reset demo data* restores the baseline.
- **Determinism**: seed data uses a fixed PRNG and timestamps relative to a persisted baseline time, so nothing changes on re-render. If the baseline is more than ~12 h old a notice appears and some warnings will show as expired; reset to rebase.
- **Roles**: permissions and module access live in `state/permissions.js`. Actions re-check permission and write a *Denied* audit entry. This is **not** secure authorization.
- **Swapping in real integrations**: pages only call `state/actions.js` and selectors. Implement the interfaces in `services/contracts.js` against an API and keep the UI unchanged.
- **GIS later**: navigation is data-driven (`layouts/navConfig.js`) and records carry `stateCode`/`district`, so a map module can be added as a new route without restructuring. No map library is installed.

## Honest status of data

| Area | Status |
|---|---|
| Alerts, incidents, tasks, resources, observations | Synthetic (labelled DEMO) |
| Source status (FIRMS degraded, INCOIS unavailable, …) | Simulated |
| Official agency warnings | Not received; official-*format* samples only |
| Risk assessments | Rule-based on synthetic data; no accuracy claims |
| Audit log | Browser-local; not tamper-proof |
| Authentication / authorization | Demo only |

## Known gaps

- No backend, live ingestion, real authentication or server-side audit.
- No map or routing (out of scope for this phase).
- Charts use Chart.js; they are not covered by screenshot tests, and layout was not exercised in a real browser during development (UI behaviour is covered by Jest/RTL tests only).
- CSV export is available on the main registers and reports, not on every table.
- Accessibility has been designed for (labels, focus states, text alongside colour) but a formal audit has not been run.
- The original template (HSL Design Validator shell) was replaced; a copy of its source is in `_original-src-backup/`.

## Icons

All hazard, severity, status and module icons come from one place: `src/config/icons.js`, rendered by
`<HazardIcon name size label />` using local **Microsoft Fluent UI Emoji (Flat, MIT)** SVGs in
`public/icons/fluent/` (re-fetch with `node scripts/fetch-fluent-emoji.js`). Sizes: 18 px sidebar,
20 px inside a 32 px tinted chip on KPI cards, 16 px in tables, badges and legends. No emoji characters are
hard-coded in components. Icons always accompany a text label; CSV exports contain text only.
Screenshots can be regenerated with `node scripts/screenshots.js` after `npm run build`.

## Live simulation

The app runs a client-side live engine (`src/state/liveEngine.js`, driven by `LiveDataProvider`). Every 5–6 s (jittered) it applies
1–3 weighted events (new incidents, severity changes, status/verification progress, task assignment/completion/overdue, warnings
issued/expired, data sources going offline/recovering) to the shared store; KPIs, charts, tables and the bell are derived from it.
It pauses while the tab is hidden. Records created by scenario replays are never touched.

- **Change the speed or mix:** edit `src/config/simulationConfig.js` (`tickMs`, `eventsPerTick`, `eventWeights`, `severityWeights`).
- **Turn it off:** run with `REACT_APP_LIVE=false`, or use the Live / Paused toggle in the header. It is always off under Jest.
- Live changes persist in `localStorage` like other demo data; *Administration → Reset data* restores the baseline.
- KPI thresholds: `src/config/kpiThresholds.js`. Badge colours: `src/components/ui/badgeTones.js`. Theme tokens: `src/styles/theme.css`.

## KPI cards and drawers

Every KPI on every page uses `src/components/ui/Kpi.js`. Thresholds, direction (`dir`) and delta-colour rules for all KPIs live in
`src/config/kpiThresholds.js`; the status (NORMAL / WARNING / CRITICAL) is always computed from them. CRITICAL and WARNING cards pulse softly
(disabled under `prefers-reduced-motion`). VIEW DETAILS opens `KpiDetailDrawer` with a 7-day trend + 3-day linear forecast, breakdown chart,
insights and actions; it updates live while open. Charts share the defaults in `src/components/charts/Charts.js` (labelled axes, integer count
axes, legends for multi-series, value labels on bars).
