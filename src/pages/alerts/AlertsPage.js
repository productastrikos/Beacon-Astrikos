import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useScoped } from '../../state/hooks';
import { alertStatus, isActiveAlert, scopeLabel, scopeFilter } from '../../state/selectors';
import { baselineFor } from '../../state/baseline';
import { PageHeader, Card, KpiCard, Tabs } from '../../components/ui/Layout';
import AlertTable from '../../components/domain/AlertTable';
import DataTable from '../../components/tables/DataTable';
import { OutcomeBadge } from '../../components/ui/Badges';
import { fmtDateTime, fmtRelative, fmtDuration, median, TIME } from '../../utils/format';
import { SOURCE_SHORT } from '../../data/demo/sources';
import { CAP_SEVERITIES } from '../../types';
import { stats, breakdownOf, oldestAge } from '../../utils/kpiHelpers';

const CAP_ORDER = CAP_SEVERITIES.slice().reverse();

export default function AlertsPage() {
  const { data, scope, now, alerts } = useScoped();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState('register');
  const openId = params.get('open');

  const live = useMemo(() => alerts.filter((a) => a.classification !== 'Historical'), [alerts]);
  const active = live.filter((a) => isActiveAlert(a, now));
  const unack = active.filter((a) => !a.ackAt);
  const expiring = active.filter((a) => new Date(a.expires).getTime() - now <= 24 * TIME.HOUR);
  const cancelled = live.filter((a) => alertStatus(a, now) === 'Cancelled');
  const cancelled7 = cancelled.filter((a) => now - new Date(a.history[a.history.length - 1].at).getTime() <= 7 * TIME.DAY);
  const bLive = scopeFilter(baselineFor(data.baseAt).alerts, scope).filter((a) => a.classification !== 'Historical');
  const bActive = bLive.filter((a) => isActiveAlert(a, now));
  const issued24 = active.filter((a) => now - new Date(a.sent).getTime() <= 24 * TIME.HOUR).length;
  const ackMins = live.filter((a) => a.ackAt).map((a) => (new Date(a.ackAt) - new Date(a.sent)) / TIME.MIN);
  const nextExpiry = expiring.map((a) => a.expires).sort()[0];
  const lastCancel = cancelled.map((a) => a.history[a.history.length - 1].at).sort().pop();
  const cols = [{ header: 'ID', get: (a) => a.id }, { header: 'Headline', get: (a) => a.headline }, { header: 'Severity', get: (a) => a.severity }, { header: 'Expires', get: (a) => fmtDateTime(a.expires) }];
  const bySeverity = (items) => stats(CAP_ORDER.map((s) => [s, items.filter((a) => a.severity === s).length]).filter(([, n]) => n).slice(0, 3));

  const history = useMemo(() => data.audit.filter((e) => ['Alert'].includes(e.entityType) && (scope === 'IN' || alerts.some((a) => a.id === e.entityId))), [data.audit, alerts, scope]);
  const histCols = [
    { id: 'at', header: 'Time', accessor: (r) => r.at, cell: (r) => fmtDateTime(r.at) },
    { id: 'user', header: 'User', accessor: (r) => r.userName },
    { id: 'role', header: 'Role', accessor: (r) => r.role },
    { id: 'action', header: 'Action', accessor: (r) => r.action },
    { id: 'alert', header: 'Alert', accessor: (r) => r.entityId, cell: (r) => <button type="button" className="bx-link-btn bx-mono" onClick={() => setParams({ open: r.entityId })}>{r.entityId}</button> },
    { id: 'change', header: 'Change', accessor: (r) => `${r.previous || ''}${r.previous && r.next ? ' → ' : ''}${r.next || ''}` },
    { id: 'outcome', header: 'Outcome', accessor: (r) => r.outcome, cell: (r) => <OutcomeBadge value={r.outcome} /> },
    { id: 'source', header: 'Source', accessor: (r) => r.source },
  ];

  return (
    <div className="bx-page">
      <PageHeader title="Alerts & Warnings"
        description={`Alert register for ${scopeLabel(scope)}. Source messages are shown as issued; acknowledgements, links and notes are recorded alongside them.`} />
      <div className="bx-kpi-grid">
        <KpiCard id="al.active" label="Active alerts" value={active.length} previous={bActive.length}
          stats={[...bySeverity(active), ...stats([['Issued 24 h', issued24]])]}
          breakdown={breakdownOf(active, (a) => a.severity, { title: 'By severity', xTitle: 'Alerts', yTitle: 'Severity', order: CAP_ORDER })} rows={{ columns: cols, items: active }} />
        <KpiCard id="al.unack" label="Unacknowledged" value={unack.length} previous={bActive.filter((a) => !a.ackAt).length}
          stats={stats([['Oldest', oldestAge(unack.map((a) => a.sent), now)], ['Median to ack', ackMins.length ? fmtDuration(median(ackMins) * TIME.MIN) : null]])}
          breakdown={breakdownOf(unack, (a) => SOURCE_SHORT[a.sender] || a.sender, { title: 'By agency', xTitle: 'Alerts', yTitle: 'Agency' })} rows={{ columns: cols, items: unack }} />
        <KpiCard id="al.expiring" label="Expiring within 24 h" value={expiring.length} previous={bActive.filter((a) => new Date(a.expires).getTime() - now <= 24 * TIME.HOUR).length}
          stats={stats([['Next expiry', nextExpiry ? fmtRelative(nextExpiry, now) : null], ['Of active', active.length]])}
          breakdown={breakdownOf(expiring, (a) => a.severity, { title: 'By severity', xTitle: 'Alerts', yTitle: 'Severity', order: CAP_ORDER })} rows={{ columns: cols, items: expiring }} />
        <KpiCard id="al.cancelled" label="Cancelled by source" value={cancelled.length} previous={bLive.filter((a) => alertStatus(a, now) === 'Cancelled').length}
          stats={stats([['Last 7 days', cancelled7.length], ['Most recent', lastCancel ? fmtRelative(lastCancel, now) : null]])}
          breakdown={breakdownOf(cancelled, (a) => SOURCE_SHORT[a.sender] || a.sender, { title: 'By agency', xTitle: 'Alerts', yTitle: 'Agency' })} rows={{ columns: cols, items: cancelled }} />
      </div>
      <p className="bx-note">Acknowledging, linking or annotating an alert is an internal action; nothing is transmitted to the public or to any agency.</p>
      <div>
        <Tabs value={tab} onChange={setTab} tabs={[{ key: 'register', label: 'Register', count: alerts.length }, { key: 'history', label: 'Action history', count: history.length }]} />
        {tab === 'register' ? (
          <Card flush>
            <AlertTable alerts={alerts} now={now} pageSize={12} openId={openId} onOpenIdChange={(id) => (id ? setParams({ open: id }) : setParams({}))} exportName="alert-register" />
          </Card>
        ) : (
          <Card flush>
            <DataTable columns={histCols} rows={history} pageSize={12} caption="Alert action history" defaultSort={{ id: 'at', dir: 'desc' }}
              emptyTitle="No alert actions recorded in this scope" exportName="alert-action-history" />
          </Card>
        )}
      </div>
    </div>
  );
}

