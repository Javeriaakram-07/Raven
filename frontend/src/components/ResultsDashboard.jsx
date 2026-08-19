import React, { useEffect, useRef } from 'react';
import { RiskBadge } from './RiskBadge.jsx';
import { AttackCard } from './AttackCard.jsx';
import { ExportButtons } from './ExportButtons.jsx';

// Group results by OWASP category
function groupByCategory(results) {
  const groups = {};
  for (const r of results) {
    if (!groups[r.category]) {
      groups[r.category] = { owasp_ref: r.owasp_ref, attacks: [] };
    }
    groups[r.category].attacks.push(r);
  }
  return groups;
}

// Sort categories so failures appear first
function sortedEntries(groups) {
  return Object.entries(groups).sort(([, a], [, b]) => {
    const aFails = a.attacks.filter((x) => x.verdict === 'fail').length;
    const bFails = b.attacks.filter((x) => x.verdict === 'fail').length;
    return bFails - aFails;
  });
}

export function ResultsDashboard({ results }) {
  const ref = useRef(null);

  // Smooth-scroll to results when they appear
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const groups = groupByCategory(results.results);
  const { summary, riskScore, scannedAt } = results;
  const ts = new Date(scannedAt).toLocaleString();

  return (
    <section className="results-section" ref={ref} aria-label="Scan results">
      {/* Header */}
      <div className="results-header">
        <div>
          <h2 className="results-title">Scan Results</h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Completed {ts}
          </p>
        </div>
        <RiskBadge score={riskScore} />
      </div>

      {/* Summary stats */}
      <div className="summary-stats" role="group" aria-label="Scan summary">
        <div className="stat-card">
          <div className="stat-value">{summary.total}</div>
          <div className="stat-label">Total Attacks</div>
        </div>
        <div className="stat-card">
          <div className="stat-value passed">{summary.passed}</div>
          <div className="stat-label">Passed</div>
        </div>
        <div className="stat-card">
          <div className="stat-value failed">{summary.failed}</div>
          <div className="stat-label">Failed</div>
        </div>
        <div className="stat-card">
          <div className="stat-value errored">{summary.errored}</div>
          <div className="stat-label">Errors</div>
        </div>
      </div>

      {/* Results by category */}
      {sortedEntries(groups).map(([category, group]) => {
        const failCount = group.attacks.filter((a) => a.verdict === 'fail').length;
        return (
          <div key={category} className="category-section">
            <div className="category-header">
              <span className="category-name">{category}</span>
              <span className="category-ref">{group.owasp_ref}</span>
              {failCount > 0 && (
                <span
                  className="category-count"
                  style={{ color: 'var(--fail-color)' }}
                >
                  {failCount} vulnerable
                </span>
              )}
            </div>
            <div className="attack-grid">
              {group.attacks.map((attack) => (
                <AttackCard key={attack.id} attack={attack} />
              ))}
            </div>
          </div>
        );
      })}

      {/* Export */}
      <ExportButtons results={results} />
    </section>
  );
}
