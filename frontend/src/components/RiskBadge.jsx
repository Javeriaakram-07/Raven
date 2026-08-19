import React from 'react';

export function RiskBadge({ score }) {
  const cls = score?.toLowerCase() ?? 'low';
  return (
    <span className={`risk-badge ${cls}`} aria-label={`Risk level: ${score}`}>
      {score}
    </span>
  );
}