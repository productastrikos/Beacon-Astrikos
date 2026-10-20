import React from 'react';
import { useScoped } from '../../state/hooks';
import { scopeLabel } from '../../state/selectors';
import { PageHeader, Card } from '../../components/ui/Layout';
import IncidentRegister from '../../components/domain/IncidentRegister';
import { INCIDENT_TRANSITIONS } from '../../types';
import { IncidentStatusBadge } from '../../components/ui/Badges';

export default function IncidentsPage() {
  const { scope, incidents } = useScoped();
  return (
    <>
      <PageHeader title="Incident Management"
        description={`Incident register for ${scopeLabel(scope)}. Incidents move through a controlled lifecycle; a warning alone never confirms an incident.`} />
      <Card title="Incident register" flush>
        <IncidentRegister incidents={incidents} pageSize={12} allowCreate exportName="incidents" caption="Incident register" />
      </Card>
      <div style={{ marginTop: 12 }}>
        <Card title="Lifecycle" subtitle="Allowed status transitions">
          <div className="bx-grid bx-grid-3">
            {Object.entries(INCIDENT_TRANSITIONS).map(([from, to]) => (
              <div key={from} className="bx-row" style={{ gap: 6 }}>
                <IncidentStatusBadge value={from} />
                <span aria-hidden="true">→</span>
                {to.length ? to.map((t) => <IncidentStatusBadge key={t} value={t} />) : <span className="bx-faint">terminal</span>}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
