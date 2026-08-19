import React from 'react';

const VERDICT_ICON = {
  pass:  '✓',
  fail:  '✕',
  error: '⚠',
};

const PHASE_LABELS = [
  'Initialising scan engine…',
  'Loading attack library…',
  'Probing system prompt boundaries…',
  'Testing injection resistance…',
  'Evaluating information disclosure controls…',
  'Checking prompt leakage vectors…',
  'Assessing output handling…',
  'Testing agency restrictions…',
  'Running judge evaluations…',
  'Finalising results…',
];

function phaseLabel(completed, total) {
  if (completed === 0) return PHASE_LABELS[0];
  const pct = completed / total;
  const idx = Math.min(Math.floor(pct * (PHASE_LABELS.length - 1)), PHASE_LABELS.length - 2);
  return PHASE_LABELS[idx + 1];
}

export function ProgressBar({ visible, progress }) {
  if (!visible) return null;

  const completed = progress?.completed ?? 0;
  const total     = progress?.total ?? 22;
  const pct       = total > 0 ? Math.round((completed / total) * 100) : 0;
  const lastAttack = progress?.attackName ?? null;
  const lastVerdict = progress?.verdict ?? null;

  return (
    <div className="progress-section" role="status" aria-live="polite" aria-label={`Scan progress: ${pct}%`}>
      {/* Top row: phase label + percentage */}
      <div className="progress-label" style={{ justifyContent: 'space-between' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="spinner" aria-hidden="true" />
          {phaseLabel(completed, total)}
        </span>
        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--accent)' }}>
          {pct}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="progress-bar-track" style={{ marginBottom: 10 }}>
        <div
          className="progress-bar-fill"
          style={{
            width: `${pct}%`,
            transition: 'width 0.4s ease',
          }}
        />
      </div>

      {/* Attack counter + last result */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {completed} of {total} attacks evaluated
        </span>

        {lastAttack && lastVerdict && (
          <span style={{
            fontSize: 12,
            color: lastVerdict === 'fail'  ? 'var(--fail-color)'  :
                   lastVerdict === 'error' ? 'var(--error-color)' : 'var(--pass-color)',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <span aria-hidden="true">{VERDICT_ICON[lastVerdict] ?? '·'}</span>
            <span style={{ color: 'var(--text-muted)' }}>{lastAttack}</span>
          </span>
        )}
      </div>
    </div>
  );
}
