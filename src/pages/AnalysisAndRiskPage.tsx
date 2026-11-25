import * as React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  FileCheck2,
  FileSearch,
  FileSpreadsheet,
  Info,
  ShieldAlert,
  UploadCloud,
} from 'lucide-react';
import type { WorkspaceRoute } from '../components/AppShell';
import { Alert } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Progress } from '../components/ui/progress';
import { RiskStatusLabel } from '../components/ui/risk-indicator';
import { dataService } from '../lib/dataService';
import { formatBytes, formatCurrency, formatDateTime } from '../lib/utils';
import type { FullDocumentBundle } from '../types/forensics';

interface AnalysisAndRiskPageProps {
  mode: 'analysis' | 'risk';
  documents: FullDocumentBundle[];
  selectedDocId: string | null;
  onSelectDocId: (id: string) => void;
  onNavigate: (route: WorkspaceRoute) => void;
}

export function AnalysisAndRiskPage({
  mode,
  documents,
  selectedDocId,
  onSelectDocId,
  onNavigate,
}: AnalysisAndRiskPageProps) {
  const activeBundle =
    documents.find((d) => d.document.id === selectedDocId) || documents[0] || null;

  const [activeTab, setActiveTab] = React.useState<
    'overview' | 'risk' | 'ocr' | 'metadata'
  >(mode === 'risk' ? 'risk' : 'overview');

  React.useEffect(() => {
    setActiveTab(mode === 'risk' ? 'risk' : 'overview');
  }, [mode]);

  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [copiedText, setCopiedText] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    let createdBlobUrl: string | null = null;
    setPreviewUrl(null);

    if (!activeBundle) return;
    void dataService.getDocumentPreviewUrl(activeBundle.document).then((url) => {
      if (!active) {
        if (url && url.startsWith('blob:')) URL.revokeObjectURL(url);
        return;
      }
      if (url && url.startsWith('blob:')) createdBlobUrl = url;
      setPreviewUrl(url);
    });

    return () => {
      active = false;
      if (createdBlobUrl) URL.revokeObjectURL(createdBlobUrl);
    };
  }, [activeBundle?.document.id]);

  if (!activeBundle) {
    return (
      <Card className="p-10 text-center">
        <FileSearch className="mx-auto h-10 w-10 text-slate-400" aria-hidden="true" />
        <h2 className="mt-4 font-display text-xl font-semibold text-slate-900 dark:text-white">
          No analyzed documents available
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-600 dark:text-slate-400">
          Upload a PDF, JPG, JPEG, or PNG document to inspect OCR extractions, metadata, JPEG ELA
          visualizations, and risk assessments.
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
  const meta = analysis.metadata_summary;
  const exactDup = duplicateChecks.find((dc) => dc.match_type === 'EXACT_SHA256_MATCH');
  const isImage = doc.file_type.startsWith('image/');

  const handleCopyOcr = () => {
    void navigator.clipboard.writeText(analysis.extracted_text || '');
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 1800);
  };

  return (
    <div className="space-y-6">
      {/* Document Selector & Quick Actions */}
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white truncate">
            {activeTab === 'risk' ? 'Structured Risk Assessment' : 'Document Forensic Analysis'}
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 truncate">
            Inspecting {doc.file_name} · Analyzed {formatDateTime(analysis.created_at)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            aria-label="Select analyzed document"
            value={doc.id}
            onChange={(e) => onSelectDocId(e.target.value)}
            className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 max-w-[260px]"
          >
            {documents.map((b) => (
              <option key={b.document.id} value={b.document.id}>
                {b.document.file_name} ({b.analysis.risk_score}/100)
              </option>
            ))}
          </select>

          <Button variant="outline" size="sm" onClick={() => onNavigate('invoice-verification')}>
            <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
            <span>Verify Invoice</span>
          </Button>
          <Button size="sm" onClick={() => onNavigate('reports')}>
            <FileCheck2 className="h-4 w-4" aria-hidden="true" />
            <span>View Report</span>
          </Button>
        </div>
      </div>

      {/* Segmented Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 w-fit dark:border-slate-800 dark:bg-slate-900/80">
        {[
          { id: 'overview', label: 'Forensic Overview' },
          { id: 'risk', label: `Risk Assessment (${analysis.risk_score}/100)` },
          { id: 'ocr', label: 'OCR Text Layer' },
          { id: 'metadata', label: 'Metadata & Image ELA' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === tab.id
                ? 'bg-white text-slate-900 shadow-sm dark:bg-blue-600 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: FORENSIC OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-7">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <div>
                  <CardTitle>Verification Summary</CardTitle>
                  <CardDescription>
                    Deterministic risk score &amp; extracted invoice snapshot
                  </CardDescription>
                </div>
                <RiskStatusLabel level={analysis.risk_level} score={analysis.risk_score} />
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="text-slate-600 dark:text-slate-400">
                      Overall Potential Risk Score
                    </span>
                    <span className="font-mono tabular-nums font-semibold">
                      {analysis.risk_score} / 100
                    </span>
                  </div>
                  <Progress
                    value={analysis.risk_score}
                    indicatorClassName={
                      analysis.risk_level === 'HIGH RISK'
                        ? 'from-red-600 to-rose-500'
                        : analysis.risk_level === 'MEDIUM RISK'
                          ? 'from-amber-500 to-orange-500'
                          : 'from-emerald-600 to-teal-500'
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 border-t border-slate-200 pt-4 dark:border-slate-800">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Invoice Number</p>
                    <p className="mt-1 font-mono text-sm font-medium text-slate-900 dark:text-white">
                      {invoice.invoice_number || 'Missing'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Vendor / Company</p>
                    <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white truncate">
                      {invoice.company_name || 'Missing'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Invoice Date</p>
                    <p className="mt-1 font-mono text-sm font-medium text-slate-900 dark:text-white">
                      {invoice.invoice_date || 'Missing'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Total Amount</p>
                    <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                      {formatCurrency(invoice.total_amount, invoice.currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Tax Amount</p>
                    <p className="mt-1 font-mono text-sm tabular-nums text-slate-900 dark:text-white">
                      {formatCurrency(invoice.tax_amount, invoice.currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">GST / Tax ID</p>
                    <p className="mt-1 font-mono text-sm text-slate-900 dark:text-white truncate">
                      {invoice.gst_number || 'Not detected'}
                    </p>
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-4 dark:border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Duplicate Status</span>
                    <span
                      className={`font-medium ${
                        exactDup
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {exactDup
                        ? `Exact match with ${exactDup.matched_file_name || 'previous upload'}`
                        : 'No exact SHA-256 duplicate in vault'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-500 dark:text-slate-400 shrink-0">SHA-256 Digest</span>
                    <span className="font-mono text-slate-700 dark:text-cyan-300 truncate">
                      {doc.file_hash}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  Detected Suspicious Indicators ({analysis.detected_indicators.length})
                </CardTitle>
                <CardDescription>
                  Indicators signal potential risks requiring manual verification
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {analysis.detected_indicators.length === 0 ? (
                  <Alert variant="success">
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>
                      No automated anomalies were triggered across OCR fields, arithmetic checks,
                      metadata, or SHA-256 duplicates.
                    </span>
                  </Alert>
                ) : (
                  analysis.detected_indicators.map((ind) => (
                    <div
                      key={ind.id}
                      className="rounded-lg border border-slate-200 p-4 dark:border-slate-800"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          {ind.severity === 'high' ? (
                            <ShieldAlert className="h-4 w-4 text-red-500 shrink-0" aria-hidden="true" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" aria-hidden="true" />
                          )}
                          <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                            {ind.title}
                          </h4>
                        </div>
                        <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          +{ind.points} pts
                        </span>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                        {ind.explanation}
                      </p>
                      <p className="mt-2 rounded bg-slate-100 px-2.5 py-1.5 font-mono text-[11px] text-slate-700 dark:bg-slate-900/90 dark:text-cyan-300 break-words">
                        Evidence: {ind.evidence}
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Original Document Preview */}
          <Card className="lg:col-span-5 h-fit">
            <CardHeader>
              <CardTitle>Stored Document Viewer</CardTitle>
              <CardDescription>
                {doc.file_type} · {formatBytes(doc.file_size)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!previewUrl ? (
                <div className="flex h-80 items-center justify-center rounded-lg border border-slate-200 text-sm text-slate-500 dark:border-slate-800">
                  Loading stored document preview...
                </div>
              ) : isImage ? (
                <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-950 dark:border-slate-800 flex justify-center">
                  <img
                    src={previewUrl}
                    alt={doc.file_name}
                    className="max-h-[480px] w-auto object-contain"
                  />
                </div>
              ) : (
                <iframe
                  src={previewUrl}
                  title={doc.file_name}
                  className="h-[480px] w-full rounded-lg border border-slate-200 dark:border-slate-800"
                />
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 2: DEDICATED RISK ASSESSMENT (PAGE 7) */}
      {activeTab === 'risk' && (
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Overall Forensic Risk Score
                  </p>
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-5xl font-bold tabular-nums text-slate-900 dark:text-white">
                      {analysis.risk_score}
                    </span>
                    <span className="font-mono text-lg text-slate-500 dark:text-slate-400">
                      / 100
                    </span>
                    <RiskStatusLabel level={analysis.risk_level} className="ml-2" />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Analysis Timestamp: {formatDateTime(analysis.created_at)}
                  </p>
                </div>

                <div className="w-full md:w-80 space-y-2">
                  <Progress
                    value={analysis.risk_score}
                    className="h-3"
                    indicatorClassName={
                      analysis.risk_level === 'HIGH RISK'
                        ? 'from-red-600 to-rose-500'
                        : analysis.risk_level === 'MEDIUM RISK'
                          ? 'from-amber-500 to-orange-500'
                          : 'from-emerald-600 to-teal-500'
                    }
                  />
                  <div className="flex justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    <span>0 · Low (0–29)</span>
                    <span>Medium (30–64)</span>
                    <span>High (65–100)</span>
                  </div>
                </div>
              </div>

              <Alert variant="info" className="mt-6">
                <Info className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                <div className="text-xs leading-relaxed">
                  <strong>Forensic Interpretation Notice:</strong> Anomalies detected by TrustScan
                  AI indicate <em>potential risk</em> and <em>require manual verification</em>. An
                  elevated risk score does not automatically mean a document is fraudulent.
                </div>
              </Alert>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                Indicator Breakdown &amp; Evidence ({analysis.detected_indicators.length})
              </CardTitle>
              <CardDescription>
                Every point in the score is derived deterministically from the checks below
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {analysis.detected_indicators.length === 0 ? (
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Zero risk indicators triggered. All inspected invoice fields, arithmetic checks,
                  and metadata parameters passed screening rules.
                </p>
              ) : (
                analysis.detected_indicators.map((ind, idx) => (
                  <div
                    key={ind.id}
                    className="rounded-xl border border-slate-200 p-5 dark:border-slate-800 space-y-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                        {idx + 1}. {ind.title}
                      </h4>
                      <span className="font-mono text-xs font-medium text-slate-600 dark:text-cyan-300 tabular-nums">
                        Severity: {ind.severity.toUpperCase()} · +{ind.points} risk pts
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-300">{ind.explanation}</p>
                    <div className="rounded-lg bg-slate-100 p-3 font-mono text-xs text-slate-800 dark:bg-slate-900 dark:text-slate-200 break-words">
                      <span className="text-slate-500 dark:text-slate-400">Extracted Evidence: </span>
                      {ind.evidence}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Confidence &amp; Technical Limitations</CardTitle>
              <CardDescription>{analysis.confidence_notes?.forensicsScope}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-slate-700 dark:text-slate-300">
                <strong>OCR Engine:</strong> {analysis.confidence_notes?.ocrEngine}
              </p>
              <p className="text-slate-700 dark:text-slate-300">
                <strong>Extraction Assessment:</strong>{' '}
                {analysis.confidence_notes?.ocrConfidenceNote}
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                {(analysis.confidence_notes?.limitations || []).map((lim, i) => (
                  <li key={i}>{lim}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 3: OCR TEXT LAYER */}
      {activeTab === 'ocr' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>Extracted OCR Text Layer</CardTitle>
              <CardDescription>
                Engine: {analysis.confidence_notes?.ocrEngine || 'Server OCR'}
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleCopyOcr}>
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{copiedText ? 'Copied' : 'Copy Text'}</span>
            </Button>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[540px] overflow-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-5 font-mono text-xs leading-relaxed text-slate-800 dark:border-slate-800 dark:bg-slate-950/80 dark:text-slate-200">
              {analysis.extracted_text || 'No readable text could be extracted from this document.'}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* TAB 4: METADATA & IMAGE ELA */}
      {activeTab === 'metadata' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Container &amp; Software Metadata</CardTitle>
                <CardDescription>
                  Raw header tags inspected for editing tools and timestamp discrepancies
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between gap-4 border-b border-slate-200 pb-2 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">MIME / Size</span>
                  <span className="font-mono text-xs">
                    {meta.mimeType} · {formatBytes(meta.fileSizeBytes)}
                  </span>
                </div>
                {meta.pageCount !== undefined && (
                  <div className="flex justify-between gap-4 border-b border-slate-200 pb-2 dark:border-slate-800">
                    <span className="text-slate-500 dark:text-slate-400">PDF Pages</span>
                    <span className="font-mono tabular-nums">{meta.pageCount}</span>
                  </div>
                )}
                {meta.width !== undefined && meta.height !== undefined && (
                  <div className="flex justify-between gap-4 border-b border-slate-200 pb-2 dark:border-slate-800">
                    <span className="text-slate-500 dark:text-slate-400">Dimensions</span>
                    <span className="font-mono tabular-nums">
                      {meta.width} × {meta.height} px
                    </span>
                  </div>
                )}
                <div className="flex justify-between gap-4 border-b border-slate-200 pb-2 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">Editing Software Tag</span>
                  <span className="font-mono text-xs">
                    {meta.editingToolDetected || 'None detected'}
                  </span>
                </div>

                {meta.pdfInfo && (
                  <div className="space-y-2 pt-2 text-xs">
                    <p className="font-semibold text-slate-700 dark:text-slate-200">
                      PDF Header Info
                    </p>
                    <p className="font-mono text-slate-600 dark:text-slate-400">
                      Creator: {meta.pdfInfo.creator || '—'}
                    </p>
                    <p className="font-mono text-slate-600 dark:text-slate-400">
                      Producer: {meta.pdfInfo.producer || '—'}
                    </p>
                    <p className="font-mono text-slate-600 dark:text-slate-400">
                      CreationDate: {meta.pdfInfo.creationDate || '—'}
                    </p>
                    <p className="font-mono text-slate-600 dark:text-slate-400">
                      ModDate: {meta.pdfInfo.modDate || '—'}
                    </p>
                  </div>
                )}

                {meta.exifInfo && (
                  <div className="space-y-2 pt-2 text-xs">
                    <p className="font-semibold text-slate-700 dark:text-slate-200">
                      EXIF Metadata
                    </p>
                    <p className="font-mono text-slate-600 dark:text-slate-400">
                      Software: {meta.exifInfo.software || '—'}
                    </p>
                    <p className="font-mono text-slate-600 dark:text-slate-400">
                      Camera/Scanner: {[meta.exifInfo.make, meta.exifInfo.model].filter(Boolean).join(' ') || '—'}
                    </p>
                    <p className="font-mono text-slate-600 dark:text-slate-400">
                      DateTimeOriginal: {meta.exifInfo.dateTimeOriginal || '—'}
                    </p>
                    <p className="font-mono text-slate-600 dark:text-slate-400">
                      ModifyDate: {meta.exifInfo.modifyDate || '—'}
                    </p>
                  </div>
                )}

                {meta.pngTextChunks && Object.keys(meta.pngTextChunks).length > 0 && (
                  <div className="space-y-2 pt-2 text-xs">
                    <p className="font-semibold text-slate-700 dark:text-slate-200">
                      PNG Text Chunks
                    </p>
                    {Object.entries(meta.pngTextChunks).map(([k, v]) => (
                      <p key={k} className="font-mono text-slate-600 dark:text-slate-400 break-all">
                        {k}: {v}
                      </p>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Image Manipulation Indicators (ELA)</CardTitle>
                <CardDescription>
                  JPEG Error Level Analysis recompresses at Q=90 and maps 8×8 block residuals
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {meta.elaMetrics?.applicable ? (
                  <>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                        <p className="font-mono text-lg font-semibold tabular-nums">
                          {meta.elaMetrics.meanError}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">Mean Error</p>
                      </div>
                      <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                        <p className="font-mono text-lg font-semibold tabular-nums">
                          {meta.elaMetrics.maxBlockError}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">Max Block</p>
                      </div>
                      <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                        <p className="font-mono text-lg font-semibold tabular-nums">
                          {meta.elaMetrics.anomalyBlockPercent}%
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Elevated Blocks
                        </p>
                      </div>
                    </div>

                    {analysis.ela_preview_data_url ? (
                      <div className="overflow-hidden rounded-lg border border-slate-200 bg-black dark:border-slate-800">
                        <img
                          src={analysis.ela_preview_data_url}
                          alt="Error Level Analysis residual heatmap"
                          className="max-h-[340px] w-full object-contain"
                        />
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">
                        ELA heatmap preview omitted due to image size limits.
                      </p>
                    )}
                  </>
                ) : (
                  <Alert variant="info">
                    <Info className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                    <span className="text-xs">
                      {meta.elaMetrics?.reason ||
                        'Error Level Analysis is only applicable to JPEG images.'}
                    </span>
                  </Alert>
                )}

                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  <strong>Technical Limitation:</strong> Uniform re-saving, social messaging
                  compression, or scanner noise can alter JPEG quantization residuals globally or
                  around sharp text edges. ELA highlights compression differences for review and is
                  not standalone proof of manipulation.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
