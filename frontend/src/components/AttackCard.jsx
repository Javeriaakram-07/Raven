import React, { useState } from 'react';

export function AttackCard({ attack }) {
  const [expanded, setExpanded] = useState(attack.verdict === 'fail');
  const [copied, setCopied] = useState(false);

  function toggleExpand() {
    setExpanded((v) => !v);
  }

  async function copyPayload() {
    try {
      await navigator.clipboard.writeText(attack.payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard not available
    }
  }

  return (
    <div className={`attack-card ${attack.verdict}`} role="article" aria-label={`${attack.name}: ${attack.verdict}`}>
      {/* Header — always visible */}
      <div
        className="attack-card-header"
        onClick={toggleExpand}
        role="button"
        aria-expanded={expanded}
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleExpand()}
      >
        <span className={`verdict-dot ${attack.verdict}`} aria-hidden="true" />
        <span className="attack-name">{attack.name}</span>
        <span className={`attack-severity ${attack.severity}`}>{attack.severity}</span>
        <span className={`verdict-badge ${attack.verdict}`}>{attack.verdict.toUpperCase()}</span>
        <span className={`expand-arrow${expanded ? ' open' : ''}`} aria-hidden="true">▼</span>
      </div>

      {/* Body — collapsible */}
      {expanded && (
        <div className="attack-card-body">
          {/* Explanation */}
          <p className="attack-explanation">
            <strong>What happened: </strong>{attack.explanation}
          </p>

          {/* Remediation */}
          {attack.verdict === 'fail' && attack.remediationHint && (
            <div className="attack-remediation">
              <strong>Suggested fix</strong>
              {attack.remediationHint}
            </div>
          )}

          {/* Payload */}
          <div className="attack-payload-toggle" style={{ marginTop: 12 }}>
            <div className="payload-label">
              Attack payload
              <button
                className={`btn-copy${copied ? ' copied' : ''}`}
                onClick={copyPayload}
                aria-label="Copy attack payload"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <pre className="payload-text">{attack.payload}</pre>
          </div>

          {/* Model response — always show when expanded so user knows what happened */}
          <div className="model-response-section">
            <div className="payload-label">Model response</div>
            <pre className="model-response-text">
              {attack.modelResponse
                ? attack.modelResponse
                : '(No response text returned — the model may have refused without generating output, or the response was empty.)'}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
