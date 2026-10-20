import React from 'react';
import { STAGES, stageOf, stageIndex } from '../../config/taskLifecycle';
import { fmtDateTime } from '../../utils/format';

function logFor(task, stage) {
  const hit = (task.stageLog || []).filter((e) => e.stage === stage).pop();
  return hit ? `${stage} · ${fmtDateTime(hit.at)} · ${hit.by}` : stage;
}

/** Case-progress pipeline: completed stages green, current stage accent with a pulse dot, future stages neutral. */
export function TaskStepper({ task, extra }) {
  const cur = stageOf(task);
  const idx = cur ? stageIndex(cur) : stageIndex((task.stageLog || []).filter((e) => STAGES.includes(e.stage)).pop()?.stage || 'Created');
  const cancelled = task.status === 'Cancelled';
  return (
    <div className="bx-stepper" role="list" aria-label={`Task progress: ${cur || 'Cancelled'}`}>
      {STAGES.map((s, i) => {
        const done = cancelled ? i <= idx : (cur === 'Completed' || i < idx);
        const current = !cancelled && cur !== 'Completed' && i === idx;
        return (
          <React.Fragment key={s}>
            <span role="listitem" className={`bx-step ${done ? 'is-done' : current ? 'is-current' : ''}`} title={done || current ? logFor(task, s) : s}>
              {current && <span className="bx-step-dot" aria-hidden="true" />}{s}
            </span>
            {i < STAGES.length - 1 && <span className="bx-step-sep" aria-hidden="true">›</span>}
          </React.Fragment>
        );
      })}
      {cancelled && <span className="bx-step-flag">Cancelled</span>}
      {extra}
    </div>
  );
}

/** Six-pixel dots plus the current stage name, for tables and lists. */
export function MiniStepper({ task }) {
  const cur = stageOf(task);
  if (!cur) return <span className="bx-mini-step"><span className="bx-mini-name">Cancelled</span></span>;
  const idx = stageIndex(cur);
  return (
    <span className="bx-mini-step" title={`Stage: ${cur}`}>
      <span className="bx-mini-dots" aria-hidden="true">
        {STAGES.map((s, i) => <i key={s} className={cur === 'Completed' || i < idx ? 'is-done' : i === idx ? 'is-current' : ''} />)}
      </span>
      <span className="bx-mini-name">{cur}</span>
    </span>
  );
}
