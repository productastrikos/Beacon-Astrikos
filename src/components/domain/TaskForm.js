import React, { useEffect, useState } from 'react';
import { Modal } from '../ui/Overlay';
import { Button, Select, TextInput, TextArea } from '../ui/Controls';
import { TASK_CATEGORIES, TASK_PRIORITIES } from '../../types';
import { TEAMS } from '../../data/demo/people';
import { createTask } from '../../state/actions';
import { useData } from '../../state/dataStore';

const blank = { incidentId: '', category: 'Field verification', location: '', priority: 'Medium', assignee: '', dueHours: 6, instructions: '' };

export default function TaskForm({ open, onClose, initial, onCreated }) {
  const incidents = useData((s) => s.incidents);
  const [f, setF] = useState(blank);
  const [errors, setErrors] = useState({});
  useEffect(() => { if (open) { setF({ ...blank, ...(initial || {}) }); setErrors({}); } }, [open, initial]);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const stateOf = (incidents.find((i) => i.id === f.incidentId) || {}).stateCode || f.stateCode || null;
  const active = incidents.filter((i) => !['Closed'].includes(i.status) && !i.historical);

  const submit = () => {
    const e = {};
    if (!f.location.trim()) e.location = 'Location description is required.';
    setErrors(e);
    if (Object.keys(e).length) return;
    const res = createTask({ ...f, incidentId: f.incidentId || null });
    if (!res.ok) { setErrors({ form: res.error }); return; }
    onClose();
    if (onCreated) onCreated(res.id);
  };

  return (
    <Modal open={open} onClose={onClose} title="Create response task"
      footer={<><Button variant="primary" onClick={submit}>Create task</Button><Button onClick={onClose}>Cancel</Button></>}>
      {errors.form && <div className="bx-error" role="alert">{errors.form}</div>}
      <Select label="Linked incident" value={f.incidentId} onChange={(v) => {
        const inc = incidents.find((i) => i.id === v);
        setF((x) => ({ ...x, incidentId: v, location: x.location || (inc ? inc.location : '') }));
      }} placeholder="None (standalone task)" options={active.map((i) => ({ value: i.id, label: `${i.id} — ${i.title}` }))} />
      <div className="bx-grid bx-grid-2">
        <Select label="Category" value={f.category} onChange={set('category')} options={TASK_CATEGORIES} />
        <Select label="Priority" value={f.priority} onChange={set('priority')} options={TASK_PRIORITIES} />
        <Select label="Assign to (optional)" value={f.assignee} onChange={set('assignee')} placeholder="Unassigned"
          options={TEAMS.filter((t) => !stateOf || t.stateCode === stateOf).map((t) => ({ value: t.id, label: t.name }))} />
        <TextInput label="Due in (hours)" type="number" min="1" value={f.dueHours} onChange={(e) => set('dueHours')(e.target.value)} />
      </div>
      <TextInput label="Location description" value={f.location} onChange={(e) => set('location')(e.target.value)} error={errors.location} />
      <TextArea label="Instructions" value={f.instructions} onChange={(e) => set('instructions')(e.target.value)} />
    </Modal>
  );
}
