import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { LaunchProject, Scan } from './types';
import { DIMENSION_LABEL } from './types';
import { dimensionKeys, formatDate } from './utils';
import { severityCounts } from './demoData';

const SEVERITY_COLOR: Record<string, [number, number, number]> = {
  critical: [220, 38, 38],
  high:     [234, 88, 12],
  medium:   [202, 138, 4],
  low:      [37, 99, 235],
  info:     [100, 116, 139],
};

function scoreColorRGB(score: number): [number, number, number] {
  if (score >= 80) return [22, 163, 74];
  if (score >= 60) return [202, 138, 4];
  if (score >= 40) return [234, 88, 12];
  return [220, 38, 38];
}

export function exportScanPdf(project: LaunchProject, scan: Scan, allScans: Scan[]) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const M = 48;

  // ---- Cover ----
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('Launch Readiness Report', M, 80);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(90);
  doc.text(project.name, M, 105);
  doc.setFontSize(10);
  doc.text(project.url, M, 122);
  doc.text(`Generated: ${formatDate(new Date().toISOString())}`, M, 138);
  doc.text(`Scan: ${formatDate(scan.createdAt)}`, M, 152);

  // Big score circle (drawn as filled circle)
  const cx = W - M - 60, cy = 110, r = 48;
  const [sr, sg, sb] = scoreColorRGB(scan.scores.overall);
  doc.setFillColor(sr, sg, sb);
  doc.circle(cx, cy, r, 'F');
  doc.setTextColor(255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.text(String(scan.scores.overall), cx, cy + 6, { align: 'center' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('OVERALL', cx, cy + 22, { align: 'center' });
  doc.setTextColor(0);

  // ---- Scorecard ----
  autoTable(doc, {
    startY: 200,
    head: [['Dimension', 'Score', 'Source']],
    body: dimensionKeys().map(d => [
      DIMENSION_LABEL[d],
      String(scan.scores[d]),
      scan.sources[d] === 'real' ? 'Real probe' : 'Demo',
    ]),
    headStyles: { fillColor: [15, 23, 42] },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 1) {
        const s = Number(data.cell.text[0]);
        const [r, g, b] = scoreColorRGB(s);
        data.cell.styles.textColor = [r, g, b];
        data.cell.styles.fontStyle = 'bold';
      }
    },
    margin: { left: M, right: M },
  });

  // ---- Severity ----
  const counts = severityCounts(scan.findings);
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 24,
    head: [['Severity', 'Count']],
    body: (['critical', 'high', 'medium', 'low', 'info'] as const).map(s => [s.toUpperCase(), String(counts[s])]),
    headStyles: { fillColor: [15, 23, 42] },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 0) {
        const key = data.cell.text[0]?.toLowerCase();
        const c = SEVERITY_COLOR[key];
        if (c) { data.cell.styles.textColor = c; data.cell.styles.fontStyle = 'bold'; }
      }
    },
    margin: { left: M, right: M },
  });

  // ---- Timeline ----
  if (allScans.length > 0) {
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 24,
      head: [['When', 'Overall', 'Δ', 'Summary']],
      body: allScans.map((s, i) => {
        const prev = i > 0 ? allScans[i - 1] : null;
        const delta = prev ? s.scores.overall - prev.scores.overall : 0;
        const arrow = !prev ? '—' : delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : '0';
        return [formatDate(s.createdAt), String(s.scores.overall), arrow, s.summary];
      }),
      headStyles: { fillColor: [15, 23, 42] },
      columnStyles: { 3: { cellWidth: 240 } },
      styles: { fontSize: 9 },
      margin: { left: M, right: M },
    });
  }

  // ---- Findings (each on its own block) ----
  doc.addPage();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Findings & Builder Fix Prompts', M, 60);
  let y = 90;

  scan.findings.forEach((finding, idx) => {
    if (y > 700) { doc.addPage(); y = 60; }
    const [r, g, b] = SEVERITY_COLOR[finding.severity] ?? [100, 116, 139];

    // Severity tag + title
    doc.setFillColor(r, g, b);
    doc.roundedRect(M, y - 12, 56, 16, 3, 3, 'F');
    doc.setTextColor(255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(finding.severity.toUpperCase(), M + 28, y - 1, { align: 'center' });

    doc.setTextColor(0);
    doc.setFontSize(11);
    const titleLines = doc.splitTextToSize(`${idx + 1}. ${finding.title}`, W - M - 120);
    doc.text(titleLines, M + 64, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(DIMENSION_LABEL[finding.dimension], W - M, y, { align: 'right' });
    doc.setTextColor(0);
    y += titleLines.length * 13 + 6;

    const block = (label: string, text: string) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(110);
      doc.text(label, M, y);
      y += 10;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(20);
      const lines = doc.splitTextToSize(text, W - 2 * M);
      doc.text(lines, M, y);
      y += lines.length * 11 + 6;
      if (y > 760) { doc.addPage(); y = 60; }
    };

    block('WHY IT MATTERS', finding.whyItMatters);
    block('RECOMMENDED FIX', finding.recommendedFix);

    // Builder prompt — monospace box
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(110);
    doc.text('BUILDER FIX PROMPT (copy into Lovable AI)', M, y);
    y += 10;
    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(20);
    const promptLines = doc.splitTextToSize(finding.builderPrompt, W - 2 * M - 16);
    const boxH = promptLines.length * 10 + 12;
    if (y + boxH > 780) { doc.addPage(); y = 60; }
    doc.setFillColor(245, 245, 248);
    doc.roundedRect(M, y - 6, W - 2 * M, boxH, 4, 4, 'F');
    doc.text(promptLines, M + 8, y + 4);
    y += boxH + 18;
  });

  // ---- Footer with page numbers ----
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(`Launch Readiness Auditor • ${project.name}`, M, doc.internal.pageSize.getHeight() - 24);
    doc.text(`Page ${i} / ${pages}`, W - M, doc.internal.pageSize.getHeight() - 24, { align: 'right' });
  }

  const safe = project.name.replace(/[^a-z0-9-_]+/gi, '_').slice(0, 40);
  doc.save(`launch-report_${safe}_${scan.id.slice(-6)}.pdf`);
}
