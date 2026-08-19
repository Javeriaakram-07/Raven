import React, { useState } from 'react';
import { jsPDF } from 'jspdf';

// ── Colour palette (matches the new terminal theme) ────────────────────────
const C = {
  black:       [10,  14,  12],   // --bg-base
  surface:     [16,  21,  18],   // --bg-surface
  elevated:    [21,  27,  23],   // --bg-elevated
  border:      [38,  49,  41],   // --border
  textPrimary: [212, 232, 220],  // --text-primary
  textSecond:  [107, 138, 118],  // --text-secondary
  accent:      [0,   255, 159],  // --accent terminal green
  pass:        [0,   255, 159],
  fail:        [255, 71,  87],
  warn:        [255, 179, 71],
  high:        [255, 122, 69],
};

function riskColor(score) {
  switch (score) {
    case 'Low':      return C.pass;
    case 'Medium':   return C.warn;
    case 'High':     return C.high;
    case 'Critical': return C.fail;
    default:         return C.textSecond;
  }
}

function verdictColor(v) {
  if (v === 'pass')  return C.pass;
  if (v === 'fail')  return C.fail;
  return C.warn;
}

// ── PDF builder ──────────────────────────────────────────────────────────────

function buildPDF(data) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210;
  const H = 297;
  const margin = 18;
  const contentW = W - margin * 2;
  let y = 0;

  function setColor(rgb, kind = 'fill') {
    if (kind === 'fill') doc.setFillColor(...rgb);
    else doc.setTextColor(...rgb);
  }

  function rect(x, ry, w, h, rgb) {
    setColor(rgb, 'fill');
    doc.rect(x, ry, w, h, 'F');
  }

  function withOpacity(alpha, drawFn) {
    doc.saveGraphicsState();
    doc.setGState(new doc.GState({ opacity: alpha }));
    drawFn();
    doc.restoreGraphicsState();
  }

  function text(str, x, ty, opts = {}) {
    setColor(opts.color || C.textPrimary, 'text');
    doc.setFontSize(opts.size || 10);
    doc.setFont('courier', opts.style || 'normal');
    doc.text(str, x, ty, { maxWidth: opts.maxWidth, align: opts.align });
  }

  // Draws the Raven mark — a bordered box with an angular "wing" glyph,
  // matching the site's actual logo instead of a plain circle+letter.
  function drawLogo(x, ry, size) {
    doc.setDrawColor(...C.accent);
    doc.setLineWidth(0.5);
    doc.roundedRect(x, ry, size, size, 1.2, 1.2, 'S');

    doc.setDrawColor(...C.accent);
    doc.setLineWidth(0.7);
    const s = size / 48; // scale factor from the 48x48 SVG viewBox
    doc.lines(
      [
        [7 * s, -17 * s], [5 * s, 10 * s], [5 * s, -10 * s], [7 * s, 17 * s],
      ],
      x + 12 * s, ry + 32 * s,
      [1, 1], 'S', false
    );
    doc.setFillColor(...C.accent);
    doc.circle(x + 24 * s, ry + 25 * s, 1 * s, 'F');
  }

  function fillPage() {
    rect(0, 0, W, H, C.black);
  }

  function newPage() {
    doc.addPage();
    fillPage();
    rect(0, 0, W, 2, C.accent);
    y = 16;
  }

  function checkPageBreak(neededMM = 20) {
    if (y + neededMM > H - margin) newPage();
  }

  // ── Header ─────────────────────────────────────────────────────────────

  fillPage();
  rect(0, 0, W, 2, C.accent);

  const logoX = margin;
  const logoY = 16;
  const logoSize = 16;
  drawLogo(logoX, logoY, logoSize);

  text('RAVEN', logoX + logoSize + 6, logoY + 8, { size: 22, style: 'bold', color: C.textPrimary });
  text('AI System Prompt Vulnerability Scan Report', logoX + logoSize + 6, logoY + 14, { size: 9, color: C.textSecond });

  y = logoY + logoSize + 8;
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.3);
  doc.line(margin, y, W - margin, y);
  y += 8;

  // ── Scan metadata ─────────────────────────────────────────────────────

  const ts = new Date(data.scannedAt);
  const dateStr = ts.toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = ts.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });

  text('SCANNED', margin, y, { size: 7, color: C.textSecond });
  text(`${dateStr}  ${timeStr}`, margin + 20, y, { size: 8, color: C.textPrimary });
  y += 8;

  // ── Risk score badge + summary stats ─────────────────────────────────

  const badgeX = margin;
  const badgeY = y;
  const badgeW = 50;
  const badgeH = 16;
  const rc = riskColor(data.riskScore);

  withOpacity(0.12, () => {
    doc.setFillColor(...rc);
    doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 2, 2, 'F');
  });
  doc.setDrawColor(...rc);
  doc.setLineWidth(0.4);
  doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 2, 2, 'S');
  text('RISK SCORE', badgeX + badgeW / 2, badgeY + 6, { size: 6.5, style: 'bold', color: rc, align: 'center' });
  text(data.riskScore.toUpperCase(), badgeX + badgeW / 2, badgeY + 12.5, { size: 12, style: 'bold', color: rc, align: 'center' });

  const stats = [
    { label: 'Total',  value: data.summary.total,   color: C.textPrimary },
    { label: 'Passed', value: data.summary.passed,  color: C.pass },
    { label: 'Failed', value: data.summary.failed,  color: C.fail },
    { label: 'Errors', value: data.summary.errored, color: C.warn },
  ];

  const statW = 27;
  const statStartX = badgeX + badgeW + 8;
  stats.forEach((s, i) => {
    const sx = statStartX + i * (statW + 3);
    rect(sx, badgeY, statW, badgeH, C.surface);
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.3);
    doc.rect(sx, badgeY, statW, badgeH, 'S');
    text(String(s.value), sx + statW / 2, badgeY + 9.5, { size: 12, style: 'bold', color: s.color, align: 'center' });
    text(s.label.toUpperCase(), sx + statW / 2, badgeY + 14, { size: 5.5, color: C.textSecond, align: 'center' });
  });

  y = badgeY + badgeH + 12;

  // ── Category bar chart ─────────────────────────────────────────────────

  doc.setDrawColor(...C.border);
  doc.line(margin, y, W - margin, y);
  y += 7;

  text('// RESULTS BY CATEGORY', margin, y, { size: 8, style: 'bold', color: C.textSecond });
  y += 6;

  const groups = {};
  for (const r of data.results) {
    if (!groups[r.category]) groups[r.category] = { total: 0, failed: 0 };
    groups[r.category].total++;
    if (r.verdict === 'fail') groups[r.category].failed++;
  }

  const maxBarW = contentW - 60;
  const maxTotal = Math.max(...Object.values(groups).map((g) => g.total), 1);

  for (const [cat, g] of Object.entries(groups)) {
    checkPageBreak(10);
    const barY = y + 1;
    const barH = 4.5;
    const barFullW = (g.total / maxTotal) * maxBarW;
    const barFailW = g.total > 0 ? (g.failed / g.total) * barFullW : 0;

    text(cat, margin, y + 4.5, { size: 7.5, color: C.textPrimary, maxWidth: 52 });
    rect(margin + 54, barY, barFullW, barH, C.elevated);
    if (barFailW > 0) rect(margin + 54, barY, barFailW, barH, C.fail);

    const countLabel = g.failed > 0 ? `${g.failed}/${g.total} failed` : `${g.total} passed`;
    const countColor = g.failed > 0 ? C.fail : C.pass;
    text(countLabel, margin + 54 + maxBarW + 3, y + 4.5, { size: 6.5, color: countColor });

    y += 8;
  }

  y += 5;

  // ── Detailed findings ─────────────────────────────────────────────────

  doc.setDrawColor(...C.border);
  doc.line(margin, y, W - margin, y);
  y += 7;

  text('// DETAILED FINDINGS', margin, y, { size: 8, style: 'bold', color: C.textSecond });
  y += 8;

  const ordered = [
    ...data.results.filter((r) => r.verdict === 'fail'),
    ...data.results.filter((r) => r.verdict === 'pass'),
    ...data.results.filter((r) => r.verdict === 'error'),
  ];

  for (const attack of ordered) {
    const vc = verdictColor(attack.verdict);
    const neededH = attack.verdict === 'fail' ? 36 : 20;
    checkPageBreak(neededH + 4);

    rect(margin, y, 1.5, neededH - 4, vc);
    rect(margin + 1.5, y, contentW - 1.5, neededH - 4, C.surface);

    const vLabel = attack.verdict.toUpperCase();
    withOpacity(0.15, () => {
      doc.setFillColor(...vc);
      doc.roundedRect(margin + contentW - 22, y + 2, 18, 6.5, 1, 1, 'F');
    });
    text(vLabel, margin + contentW - 13, y + 6.5, { size: 6.5, style: 'bold', color: vc, align: 'center' });

    const sevColor = attack.severity === 'critical' ? C.fail :
                      attack.severity === 'high'     ? C.high :
                      attack.severity === 'medium'   ? C.warn : C.pass;
    text(attack.severity.toUpperCase(), margin + contentW - 44, y + 6.5, { size: 6, color: sevColor });

    text(`${attack.id}  ${attack.name}`, margin + 6, y + 6.5, { size: 8.5, style: 'bold', color: C.textPrimary, maxWidth: contentW - 62 });
    text(`${attack.category}  ·  ${attack.owasp_ref}`, margin + 6, y + 12, { size: 6.5, color: C.textSecond });

    if (attack.verdict === 'fail') {
      const exLines = doc.splitTextToSize(attack.explanation, contentW - 14);
      text(exLines.slice(0, 2).join(' '), margin + 6, y + 18, { size: 6.5, color: C.textPrimary, maxWidth: contentW - 14 });

      if (attack.remediationHint) {
        const remLines = doc.splitTextToSize(`Fix: ${attack.remediationHint}`, contentW - 14);
        text(remLines.slice(0, 2).join(' '), margin + 6, y + 26, { size: 6.5, color: C.textSecond, maxWidth: contentW - 14, style: 'oblique' });
      }
    }

    y += neededH;
  }

  // ── Footer on every page ─────────────────────────────────────────────

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    rect(0, H - 10, W, 10, C.surface);
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.2);
    doc.line(0, H - 10, W, H - 10);
    text('Raven — built by Javeria Akram', margin, H - 4, { size: 6.5, color: C.textSecond });
    text(`Page ${p} of ${totalPages}`, W - margin, H - 4, { size: 6.5, color: C.textSecond, align: 'right' });
    text(dateStr, W / 2, H - 4, { size: 6.5, color: C.textSecond, align: 'center' });
  }

  return doc;
}

// ── JSON helper ────────────────────────────────────────────────────────────

function downloadBlob(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Component ────────────────────────────────────────────────────────────

export function ExportButtons({ results }) {
  const [pdfBusy, setPdfBusy] = useState(false);

  const timestamp = new Date(results.scannedAt)
    .toISOString()
    .replace(/[:.]/g, '-')
    .slice(0, 19);

  function exportJSON() {
    downloadBlob(JSON.stringify(results, null, 2), `raven-scan-${timestamp}.json`, 'application/json');
  }

  function exportPDF() {
    setPdfBusy(true);
    try {
      const doc = buildPDF(results);
      doc.save(`raven-scan-${timestamp}.pdf`);
    } catch (err) {
      console.error('[ExportButtons] PDF generation failed:', err);
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <div className="export-section">
      <button className="btn-export" onClick={exportJSON} aria-label="Export scan results as JSON">
        export .json
      </button>
      <button
        className="btn-export"
        onClick={exportPDF}
        disabled={pdfBusy}
        aria-label="Export scan report as PDF"
        style={{ opacity: pdfBusy ? 0.6 : 1 }}
      >
        {pdfBusy ? 'generating…' : 'export .pdf'}
      </button>
    </div>
  );
}