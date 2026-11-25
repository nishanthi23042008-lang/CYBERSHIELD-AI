import { jsPDF } from 'jspdf';
import type { FullDocumentBundle } from '../types/forensics';
import { formatBytes, formatCurrency, formatDateTime } from './utils';

export function downloadForensicPdfReport(bundle: FullDocumentBundle, analystEmail?: string): void {
  const { document: doc, analysis, invoice, duplicateChecks } = bundle;
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 44;
  const maxWidth = pageWidth - margin * 2;
  let y = 52;

  const ensureSpace = (needed = 40) => {
    if (y + needed > pageHeight - 48) {
      pdf.addPage();
      y = 52;
    }
  };

  const addSectionTitle = (title: string) => {
    ensureSpace(36);
    y += 10;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(30, 64, 175);
    pdf.text(title, margin, y);
    y += 6;
    pdf.setDrawColor(203, 213, 225);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 14;
  };

  const addKeyValue = (label: string, value: string) => {
    ensureSpace(22);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9.5);
    pdf.setTextColor(71, 85, 105);
    pdf.text(`${label}:`, margin, y);

    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(15, 23, 42);
    const wrapped = pdf.splitTextToSize(value || 'Not detected', maxWidth - 140);
    pdf.text(wrapped, margin + 140, y);
    y += Math.max(15, wrapped.length * 13);
  };

  const addParagraph = (text: string, fontSize = 9.5, color: [number, number, number] = [30, 41, 59]) => {
    const lines = pdf.splitTextToSize(text, maxWidth);
    for (const line of lines) {
      ensureSpace(16);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(fontSize);
      pdf.setTextColor(color[0], color[1], color[2]);
      pdf.text(line, margin, y);
      y += 13;
    }
    y += 4;
  };

  // Header Banner
  pdf.setFillColor(11, 18, 33);
  pdf.rect(0, 0, pageWidth, 84, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.setTextColor(255, 255, 255);
  pdf.text('TrustScan AI — Forensic Document Audit Report', margin, 38);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);
  pdf.setTextColor(148, 163, 184);
  pdf.text(
    `Generated: ${new Date().toLocaleString()}  |  Analyst: ${analystEmail || 'Authenticated User'}  |  Nova Squad`,
    margin,
    58
  );

  y = 108;

  // Risk Verdict Summary Strip
  const riskColor: [number, number, number] =
    analysis.risk_level === 'HIGH RISK'
      ? [220, 38, 38]
      : analysis.risk_level === 'MEDIUM RISK'
        ? [217, 119, 6]
        : [22, 163, 74];

  pdf.setFillColor(248, 250, 252);
  pdf.setDrawColor(226, 232, 240);
  pdf.roundedRect(margin, y, maxWidth, 56, 4, 4, 'FD');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(riskColor[0], riskColor[1], riskColor[2]);
  pdf.text(`ASSESSMENT: ${analysis.risk_level} (${analysis.risk_score} / 100)`, margin + 14, y + 22);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(71, 85, 105);
  pdf.text(
    'Note: Indicators denote potential risks requiring manual verification, not definitive proof of fraud.',
    margin + 14,
    y + 40
  );
  y += 74;

  // 1. Document Metadata
  addSectionTitle('1. Document Information & Cryptographic Digest');
  addKeyValue('File Name', doc.file_name);
  addKeyValue('MIME Type', doc.file_type);
  addKeyValue('File Size', formatBytes(doc.file_size));
  addKeyValue('Upload Date', formatDateTime(doc.uploaded_at));
  addKeyValue('Analysis Date', formatDateTime(analysis.created_at));
  addKeyValue('SHA-256 Hash', doc.file_hash);
  addKeyValue('OCR Engine', analysis.confidence_notes?.ocrEngine || 'Server OCR Pipeline');
  if (analysis.metadata_summary?.editingToolDetected) {
    addKeyValue('Editor Tag Found', analysis.metadata_summary.editingToolDetected);
  }

  // 2. Invoice Details
  addSectionTitle('2. Extracted Invoice & Tax Verification');
  addKeyValue('Invoice Number', invoice.invoice_number || 'Missing / Not detected');
  addKeyValue('Company Name', invoice.company_name || 'Missing / Not detected');
  addKeyValue('Invoice Date', invoice.invoice_date || 'Missing / Not detected');
  addKeyValue('Subtotal', formatCurrency(invoice.subtotal_amount, invoice.currency));
  addKeyValue('Tax Amount', formatCurrency(invoice.tax_amount, invoice.currency));
  addKeyValue('Total Amount', formatCurrency(invoice.total_amount, invoice.currency));
  addKeyValue('GST / Tax ID', invoice.gst_number || 'Not detected');
  addKeyValue('Tax Details', invoice.tax_details || 'Not detected');
  if (invoice.verification_notes) {
    addKeyValue('Auditor Notes', invoice.verification_notes);
  }

  // 3. Duplicate Check Status
  addSectionTitle('3. Duplicate Document Check');
  const exactMatch = duplicateChecks.find((d) => d.match_type === 'EXACT_SHA256_MATCH');
  if (exactMatch) {
    addParagraph(
      `EXACT SHA-256 MATCH: Matches "${exactMatch.matched_file_name || exactMatch.matched_document_id}" uploaded on ${formatDateTime(
        exactMatch.matched_uploaded_at
      )}. Confirm whether this represents an intentional re-upload or duplicate invoice submission.`
    );
  } else {
    addParagraph(
      'NO EXACT SHA-256 MATCH: No byte-identical document was found in your prior uploads. Note: A different SHA-256 hash does not prove documents are unrelated, since re-saving or scanning changes file bytes.'
    );
  }

  // 4. Detected Indicators
  addSectionTitle(`4. Detected Suspicious Indicators (${analysis.detected_indicators.length})`);
  if (analysis.detected_indicators.length === 0) {
    addParagraph(
      'No automated risk rules were triggered. Standard visual and supplier verification is still recommended.'
    );
  } else {
    analysis.detected_indicators.forEach((ind, idx) => {
      ensureSpace(54);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(15, 23, 42);
      pdf.text(
        `${idx + 1}. ${ind.title} [${ind.severity.toUpperCase()} · +${ind.points} pts]`,
        margin,
        y
      );
      y += 14;
      addParagraph(ind.explanation, 9, [51, 65, 85]);
      addParagraph(`Evidence: ${ind.evidence}`, 8.5, [100, 116, 139]);
    });
  }

  // 5. Recommendations & Limitations
  addSectionTitle('5. Recommendations & Technical Limitations');
  if (analysis.risk_level === 'HIGH RISK') {
    addParagraph(
      '• Place invoice on manual verification hold prior to disbursement.\n• Cross-check vendor bank details, GSTIN registration portal status, and purchase order totals.\n• Request the original system-generated PDF directly from the supplier if metadata or compression anomalies appear.'
    );
  } else if (analysis.risk_level === 'MEDIUM RISK') {
    addParagraph(
      '• Perform manual spot verification on flagged fields (missing identifiers, tax registration, or metadata tags).\n• Confirm invoice has not already been settled under a different file format.'
    );
  } else {
    addParagraph(
      '• Automated screening found minimal risk indicators. Proceed with standard accounts-payable approval workflow.'
    );
  }

  const limitations = analysis.confidence_notes?.limitations || [];
  if (limitations.length > 0) {
    addParagraph(`Technical Limitations: ${limitations.join(' ')}`, 8.5, [100, 116, 139]);
  }

  // 6. Extracted Text Summary
  addSectionTitle('6. Extracted OCR Text Summary');
  const snippet = (analysis.extracted_text || 'No text extracted.').slice(0, 2600);
  addParagraph(snippet, 8.5, [51, 65, 85]);

  const safeFile = doc.file_name.replace(/[^a-zA-Z0-9._-]/g, '_');
  pdf.save(`TrustScan_Report_${safeFile}.pdf`);
}
