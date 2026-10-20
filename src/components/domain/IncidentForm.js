import React, { useEffect, useState } from 'react';
import { Modal } from '../ui/Overlay';
import { Button, TextInput, TextArea, Select } from '../ui/Controls';
import { HAZARDS, SEVERITIES } from '../../types';
import { STATES, DISTRICTS } from '../../data/demo/geography';
import { createIncident } from '../../state/actions';

const blank = { title: '', hazard: 'flood', stateCode: 'AR', district: 'East Siang', location: '', severity: 'Moderate', description: '', dueHours: '' };

export default function IncidentForm({ open, onClose, initial, fromAlertId, fromRecordId, onCreated }) {
  const [f, setF] = useState(blank);
  const [errors, setErrors] = useState({});
  useEffect(() => { if (open) { setF({ ...blank, ...(initial || {}) }); setErrors({}); } }, [open, initial]);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v, ...(k === 'stateCode' ? { district: DISTRICTS[v][0] } : {}) }));

  const submit = () => {
    const e = {};
    if (!f.title.trim()) e.title = 'Title is required.';
    if (!f.district) e.district = 'District is required.';
    setErrors(e);
    if (Object.keys(e).length) return;
    const res = createIncident(f, { fromAlertId, fromRecordId });
    if (!res.ok) { setErrors({ form: res.error }); return; }
    onClose();
    if (onCreated) onCreated(res.id);
  };

  return (
    <Modal open={open} onClose={onClose} title="Create incident"
      footer={<><Button variant="primary" onClick={submit}>Create incident</Button><Button onClick={onClose}>Cancel</Button></>}>
      {errors.form && <div className="bx-error" role="alert">{errors.form}</div>}
      <TextInput label="Incident title" value={f.title} onChange={(e) => set('title')(e.target.value)} error={errors.title} placeholder="Short operational title" />
      <div className="bx-grid bx-grid-2">
        <Select label="Hazard type" value={f.hazard} onChange={set('hazard')} options={HAZARDS.map((h) => ({ value: h.key, label: h.label }))} />
        <Select label="Severity" value={f.severity} onChange={set('severity')} options={SEVERITIES} />
        <Select label="State" value={f.stateCode} onChange={set('stateCode')} options={STATES.map((s) => ({ value: s.code, label: s.name }))} />
        <Select label="District" value={f.district} onChange={set('district')} options={DISTRICTS[f.stateCode] || []} error={errors.district} />
      </div>
      <TextInput label="Location description" value={f.location} onChange={(e) => set('location')(e.target.value)} placeholder="Road, settlement or landmark" />
      <TextArea label="Description" value={f.description} onChange={(e) => set('description')(e.target.value)} />
      <TextInput label="Response due (hours from now)" type="number" min="1" value={f.dueHours} onChange={(e) => set('dueHours')(e.target.value)} help="Optional." />
      <p className="bx-help">New incidents start as Reported / Unverified. A warning or record does not make an incident confirmed.</p>
    </Modal>
  );
}
