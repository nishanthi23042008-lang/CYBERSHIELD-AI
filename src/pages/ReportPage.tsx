import { Download, FileCheck2, UploadCloud } from 'lucide-react';
import type { WorkspaceRoute } from '../components/AppShell';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { RiskStatusLabel } from '../components/ui/risk-indicator';
import { downloadForensicPdfReport } from '../lib/pdfReport';
import { formatBytes, formatCurrency, formatDateTime } from '../lib/utils';
import type { FullDocumentBundle, UserProfile } from '../types/forensics';

interface ReportPageProps {
  user: UserProfile;
  documents: FullDocumentBundle[];
  selectedDocId: string | null;
  onSelectDocId: (id: string) => void;
  onNavigate: (route: WorkspaceRoute) => void;
}

export function ReportPage({
  user,
  documents,
  selectedDocId,
  onSelectDocId,
  onNavigate,
}: ReportPageProps) {
  const activeBundle =
    documents.find((d) => d.document.id === selectedDocId) || documents[0] || null;

  if (!activeBundle) {
    return (
      <Card className="p-10 text-center">
        <FileCheck2 className="mx-auto h-10 w-10 text-slate-400" aria-hidden="true" />
        <h2 className="mt-4 font-display text-xl font-semibold text-slate-900 dark:text-white">
          No forensic reports available yet
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-600 dark:text-slate-400">
          Upload and analyze a document to generate an audit-ready PDF forensic report.
        </p>
        <div className="mt-6">
          <Button onClick={() => onNavigate('upload')}>
            <UploadCloud className="h-4 w-4" aria-hidden="true" />
            <span>Upload Document</span>
          </Button>
        </div>
      </Card>
    );
  }

  const { document: doc, analysis, invoice, duplicateChecks } = activeBundle;
  const exactDup = duplicateChecks.find((dc) => dc.match_type === 'EXACT_SHA256_MATCH');

  const recommendations =
    analysis.risk_level === 'HIGH RISK'
      ? [
          'Place payment or approval on temporary hold pending manual auditor review.',
          'Cross-verify vendor GSTIN registration, bank account details, and original purchase order.',
          'Request the native ERP-exported PDF directly from the supplier if editing software or ELA anomalies were flagged.',
        ]
      : analysis.risk_level === 'MEDIUM RISK'
        ? [
            'Manually verify missing invoice identifiers, tax details, or metadata modification tags.',
            'Confirm with accounts payable that this invoice has not been submitted under a different format.',
          ]
        : [
            'Automated screening detected minimal risk indicators.',
            'Proceed with standard accounts-payable approval and archival procedures.',
          ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Detailed Forensic Audit Report
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Structured verification report with evidence, duplicate status, and PDF export.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            aria-label="Select document report"
            value={doc.id}
            onChange={(e) => onSelectDocId(e.target.value)}
            className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 max-w-[260px]"
          >
            {documents.map((b) => (
              <option key={b.document.id} value={b.document.id}>
                {b.document.file_name}
              </option>
            ))}
          </select>

          <Button onClick={() => downloadForensicPdfReport(activeBundle, user.email)}>
            <Download className="h-4 w-4" aria-hidden="true" />
            <span>Download PDF Report</span>
          </Button>
        </div>
      </div>

      {/* Report Document Sheet */}
      <Card className="overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-100/70 px-6 py-5 dark:border-slate-800 dark:bg-slate-900/80 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium text-cyan-600 dark:text-cyan-400">
              TrustScan AI · Forensic Verification Record
            </p>
            <h3 className="mt-1 font-display text-xl font-bold text-slate-900 dark:text-white">
              {doc.file_name}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Analysis Date: {formatDateTime(analysis.created_at)} · Analyst: {user.email}
            </p>
          </div>
          <RiskStatusLabel level={analysis.risk_level} score={analysis.risk_score} />
        </div>

        <CardContent className="divide-y divide-slate-200 p-6 dark:divide-slate-800 space-y-6">
          {/* 1. Document Information */}
          <section className="pt-1">
            <h4 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              1. Document Information &amp; Hash Integrity
            </h4>
            <dl className="mt-3 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">File Type</dt>
                <dd className="mt-0.5 font-mono text-xs">{doc.file_type}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">File Size</dt>
                <dd className="mt-0.5 font-mono text-xs tabular-nums">
                  {formatBytes(doc.file_size)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">Upload Timestamp</dt>
                <dd className="mt-0.5 font-mono text-xs tabular-nums">
                  {formatDateTime(doc.uploaded_at)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">OCR Engine</dt>
                <dd className="mt-0.5 text-xs">{analysis.confidence_notes?.ocrEngine}</dd>
              </div>
              <div className="sm:col-span-2 lg:col-span-4">
                <dt className="text-xs text-slate-500 dark:text-slate-400">SHA-256 Digest</dt>
                <dd className="mt-0.5 break-all font-mono text-xs text-cyan-700 dark:text-cyan-300">
                  {doc.file_hash}
                </dd>
              </div>
            </dl>
          </section>

          {/* 2. Extracted Invoice Summary */}
          <section className="pt-6">
            <h4 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              2. Invoice Verification Summary
            </h4>
            <dl className="mt-3 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3 lg:grid-cols-6">
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">Invoice #</dt>
                <dd className="mt-0.5 font-mono">{invoice.invoice_number || 'Missing'}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">Vendor</dt>
                <dd className="mt-0.5">{invoice.company_name || 'Missing'}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">Date</dt>
                <dd className="mt-0.5 font-mono">{invoice.invoice_date || 'Missing'}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">Tax</dt>
                <dd className="mt-0.5 font-mono tabular-nums">
                  {formatCurrency(invoice.tax_amount, invoice.currency)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">Total</dt>
                <dd className="mt-0.5 font-mono font-semibold tabular-nums">
                  {formatCurrency(invoice.total_amount, invoice.currency)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">GSTIN / Tax ID</dt>
                <dd className="mt-0.5 font-mono">{invoice.gst_number || 'Not detected'}</dd>
              </div>
            </dl>
          </section>

          {/* 3. Duplicate Check Status */}
          <section className="pt-6">
            <h4 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              3. Duplicate-Check Status
            </h4>
            <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
              {exactDup
                ? `Exact SHA-256 Match: This file matches "${
                    exactDup.matched_file_name || exactDup.matched_document_id
                  }" uploaded on ${formatDateTime(exactDup.matched_uploaded_at)}.`
                : 'No Exact SHA-256 Match: No byte-identical document was found in prior uploads. Note: Different hashes do not prove documents are unrelated if re-saved or scanned.'}
            </p>
          </section>

          {/* 4. Suspicious Indicators */}
          <section className="pt-6">
            <h4 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              4. Suspicious Indicators ({analysis.detected_indicators.length})
            </h4>
            {analysis.detected_indicators.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                No automated anomalies detected. Standard verification procedures apply.
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                {analysis.detected_indicators.map((ind) => (
                  <div
                    key={ind.id}
                    className="rounded-lg border border-slate-200 p-3.5 text-sm dark:border-slate-800"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {ind.title}
                      </span>
                      <span className="font-mono text-xs text-slate-500 tabular-nums">
                        {ind.severity.toUpperCase()} · +{ind.points} pts
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                      {ind.explanation}
                    </p>
                    <p className="mt-1.5 font-mono text-[11px] text-slate-500 dark:text-cyan-300 break-words">
                      Evidence: {ind.evidence}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 5. Recommendations */}
          <section className="pt-6">
            <h4 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              5. Auditor Recommendations
            </h4>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-slate-700 dark:text-slate-300">
              {recommendations.map((rec, idx) => (
                <li key={idx}>{rec}</li>
              ))}
            </ul>
          </section>

          {/* 6. Extracted Text Summary */}
          <section className="pt-6">
            <h4 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              6. Extracted Text Summary
            </h4>
            <pre className="mt-3 max-h-60 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-950/80 dark:text-slate-300">
              {analysis.extracted_text || 'No readable text extracted.'}
            </pre>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
