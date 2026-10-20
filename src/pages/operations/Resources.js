import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useScoped, useAuth } from '../../state/hooks';
import { scopeLabel, isActiveIncident } from '../../state/selectors';
import { PageHeader, Card, Tabs, Banner, Timeline } from '../../components/ui/Layout';
import DataTable from '../../components/tables/DataTable';
import { AvailabilityBadge, RoadBadge } from '../../components/ui/Badges';
import { Button, Select } from '../../components/ui/Controls';
import { Drawer } from '../../components/ui/Overlay';
import { RESOURCE_CATEGORIES, ROAD_STATUSES } from '../../types';
import { assignResource, releaseResource, setRoadStatus } from '../../state/actions';
import { fmtDateTime, fmtRelative } from '../../utils/format';
import { stateName, ActivityLog } from '../../components/domain/common';
import { SOURCE_NAME } from '../../data/demo/sources';

function ResourceDrawer({ resource, incidents, onClose }) {
  const { can } = useAuth();
  const [inc, setInc] = useState(resource.assignedIncident || '');
  const [road, setRoad] = useState(resource.roadStatus || 'Open');
  const [msg, setMsg] = useState('');
  const res = (r) => setMsg(r.ok ? '' : r.error);
  const canAssign = can('resource.assign');
  return (
    <Drawer open onClose={onClose} title={resource.name} subtitle={resource.id}>
      <div className="bx-row"><AvailabilityBadge value={resource.availability} />{resource.roadStatus && <RoadBadge value={resource.roadStatus} />}</div>
      {msg && <Banner kind="danger">{msg}</Banner>}
      <dl className="bx-kv">
        <dt>Category</dt><dd>{RESOURCE_CATEGORIES.find((c) => c.key === resource.category)?.label}</dd>
        <dt>Administrative area</dt><dd>{resource.district}, {stateName(resource.stateCode)}</dd>
        <dt>Capacity</dt><dd>{resource.capacity != null ? `${resource.capacity} ${resource.capacityUnit}` : 'Not recorded'}</dd>
        <dt>Responsible unit</dt><dd>{resource.responsibleUnit}</dd>
        <dt>Assigned incident</dt><dd>{resource.assignedIncident ? <Link to={`/incidents/${resource.assignedIncident}`}>{resource.assignedIncident}</Link> : '—'}</dd>
        <dt>Last updated</dt><dd>{fmtDateTime(resource.updatedAt)}</dd>
        <dt>Data source</dt><dd>{SOURCE_NAME[resource.sourceId] || 'Operator-entered'}</dd>
      </dl>
      <section>
        <div className="bx-section-title">Incident assignment</div>
        <div className="bx-row" style={{ alignItems: 'flex-end' }}>
          <Select label="Assign to incident" value={inc} onChange={setInc} placeholder="Select incident…"
            options={incidents.map((i) => ({ value: i.id, label: `${i.id} — ${i.title}` }))} />
          <Button variant="primary" disabled={!canAssign || !inc || inc === resource.assignedIncident} onClick={() => res(assignResource(resource.id, inc))}>Assign</Button>
          <Button disabled={!canAssign || !resource.assignedIncident} onClick={() => res(releaseResource(resource.id))}>Release</Button>
        </div>
      </section>
      {resource.category === 'road' && (
        <section>
          <div className="bx-section-title">Road status</div>
          <div className="bx-row" style={{ alignItems: 'flex-end' }}>
            <Select label="Status" value={road} onChange={setRoad} options={ROAD_STATUSES} />
            <Button disabled={!canAssign || road === resource.roadStatus} onClick={() => res(setRoadStatus(resource.id, road))}>Update</Button>
          </div>
          <p className="bx-help">Closures are recorded for coordination only; they are not published to the public.</p>
        </section>
      )}
      <section>
        <div className="bx-section-title">Record history</div>
        <Timeline items={[...resource.history].reverse().map((h) => ({ id: h.id, text: h.text, meta: `${fmtDateTime(h.at)} · ${h.by}` }))} />
      </section>
      <section>
        <div className="bx-section-title">Audit trail</div>
        <ActivityLog entityId={resource.id} />
      </section>
    </Drawer>
  );
}

export default function Resources() {
  const { data, scope, now, resources, incidents } = useScoped();
  const [tab, setTab] = useState('shelter');
  const [avail, setAvail] = useState('');
  const [selected, setSelected] = useState(null);

  const active = useMemo(() => incidents.filter(isActiveIncident), [incidents]);
  const rows = useMemo(() => resources.filter((r) => r.category === tab && (!avail || r.availability === avail)), [resources, tab, avail]);
  const selectedRes = selected ? data.resources.find((r) => r.id === selected) : null;
  const counts = Object.fromEntries(RESOURCE_CATEGORIES.map((c) => [c.key, resources.filter((r) => r.category === c.key).length]));

  const isRoad = tab === 'road';
  const cols = [
    { id: 'id', header: 'Resource ID', accessor: (r) => r.id, cell: (r) => <span className="bx-mono">{r.id}</span> },
    { id: 'name', header: 'Name', accessor: (r) => r.name, wrap: true },
    { id: 'area', header: 'Administrative area', accessor: (r) => `${r.district}, ${stateName(r.stateCode)}` },
    { id: 'avail', header: 'Availability', accessor: (r) => r.availability, cell: (r) => <AvailabilityBadge value={r.availability} /> },
    ...(isRoad ? [{ id: 'road', header: 'Road status', accessor: (r) => r.roadStatus, cell: (r) => <RoadBadge value={r.roadStatus} /> }]
      : [{ id: 'cap', header: 'Capacity', num: true, accessor: (r) => (r.capacity != null ? r.capacity : null), cell: (r) => (r.capacity != null ? `${r.capacity} ${r.capacityUnit}` : <span className="bx-faint">Not recorded</span>) }]),
    { id: 'inc', header: 'Assigned incident', accessor: (r) => r.assignedIncident || '—', cell: (r) => (r.assignedIncident ? <span className="bx-mono">{r.assignedIncident}</span> : '—') },
    { id: 'unit', header: 'Responsible unit', accessor: (r) => r.responsibleUnit, wrap: true },
    { id: 'upd', header: 'Last updated', accessor: (r) => r.updatedAt, cell: (r) => fmtRelative(r.updatedAt, now) },
    { id: 'src', header: 'Source', accessor: (r) => 'Resource register' },
  ];

  return (
    <>
      <PageHeader title="Evacuation & Resources"
        description={`Resource register for ${scopeLabel(scope)}.`} />
      <Tabs value={tab} onChange={setTab} tabs={RESOURCE_CATEGORIES.map((c) => ({ key: c.key, label: c.label, count: counts[c.key] }))} />
      <Card flush>
        <DataTable columns={cols} rows={rows} pageSize={10} caption={RESOURCE_CATEGORIES.find((c) => c.key === tab).label}
          onRowClick={(r) => setSelected(r.id)} selectedKey={selected} exportName={`resources-${tab}`}
          filters={<Select label="Availability" compact value={avail} onChange={setAvail} placeholder="All" options={['Available', 'Allocated', 'Unavailable', 'Needs verification']} />}
          emptyTitle="No resources of this type in the current scope" />
      </Card>
      {selectedRes && <ResourceDrawer resource={selectedRes} incidents={active} onClose={() => setSelected(null)} />}
    </>
  );
}
