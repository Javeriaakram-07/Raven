import React from 'react';

export function ScanButton({ onClick, disabled, scanning }) {
  return (
    <section className="scan-section">
      <button
        className={`btn-scan${scanning ? ' scanning' : ''}`}
        onClick={onClick}
        disabled={disabled}
        aria-busy={scanning}
        aria-label={scanning ? 'Scan in progress' : 'Run vulnerability scan'}
      >
        {scanning ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <span className="spinner" />
            scanning
          </span>
        ) : (
          'run scan'
        )}
      </button>
    </section>
  );
}