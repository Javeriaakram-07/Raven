import React, { useState } from 'react';
import { PromptInput } from './components/PromptInput.jsx';
import { ScanButton } from './components/ScanButton.jsx';
import { ProgressBar } from './components/ProgressBar.jsx';
import { ResultsDashboard } from './components/ResultsDashboard.jsx';
import { useScan } from './hooks/useScan.js';

const MAX_LENGTH = 8000;
function RavenMark() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="46" height="46" rx="4" stroke="var(--accent)" strokeWidth="1.5"/>
      <path d="M12 32L19 15L24 25L29 15L36 32" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="square" strokeLinejoin="miter" fill="none"/>
      <circle cx="24" cy="25" r="1.8" fill="var(--accent)"/>
    </svg>
  );
}
export default function App() {
  const [systemPrompt, setSystemPrompt] = useState('');
  const { status, progress, results, error, startScan, reset } = useScan();

  const isScanning = status === 'scanning';
  const isComplete = status === 'complete';
  const hasError   = status === 'error';
  const isOverLimit = systemPrompt.length > MAX_LENGTH;

  function handleScan() {
    if (!systemPrompt.trim() || isOverLimit || isScanning) return;
    startScan(systemPrompt);
  }

  function handleReset() {
    reset();
    setSystemPrompt('');
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="header" role="banner">
          <RavenMark />
        <div>
          <h1 className="header-title">
            <span>Raven</span>
          </h1>
          <p className="header-tagline">AI system prompt vulnerability scanner</p>
        </div>
        <nav style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
          <a href="/docs" style={{ fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none' }}>Docs</a>
          <a href="/docs/about" style={{ fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none' }}>Founder</a>
        </nav>
      </header>

      <main role="main">
        {/* System prompt input */}
        <PromptInput
          value={systemPrompt}
          onChange={setSystemPrompt}
          disabled={isScanning}
        />

        {/* Error banner */}
        {hasError && error && (
          <div className="error-banner" role="alert">
            <span className="error-icon" aria-hidden="true">✕</span>
            <div>
              <strong>Scan failed:</strong> {error}
              <div style={{ marginTop: 8 }}>
                <button className="btn-ghost" onClick={handleReset}>
                  Try again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Scan button */}
        <ScanButton
          onClick={handleScan}
          disabled={!systemPrompt.trim() || isOverLimit || isScanning}
          scanning={isScanning}
        />

        {/* Live progress bar */}
        <ProgressBar visible={isScanning} progress={progress} />

        {/* Results */}
        {isComplete && results && (
          <>
            <ResultsDashboard results={results} />
            <div style={{ marginTop: 24, textAlign: 'center' }}>
              <button className="btn-ghost" onClick={handleReset}>
                Start a new scan
              </button>
            </div>
          </>
        )}
      </main>

      <footer className="footer" role="contentinfo">
        Raven, built by <a href="/docs/about">Javeria Akram</a> &middot; <a href="/docs">Docs</a> &middot; <a href="/docs/privacy">Privacy</a> &middot; <a href="/docs/terms">Terms</a> &middot; &copy; 2026
      </footer>
    </div>
  );
}
