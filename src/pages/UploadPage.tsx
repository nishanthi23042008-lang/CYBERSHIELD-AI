import * as React from 'react';
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  FileWarning,
  Image as ImageIcon,
  UploadCloud,
  X,
} from 'lucide-react';
import type { WorkspaceRoute } from '../components/AppShell';
import { Alert } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Progress } from '../components/ui/progress';
import { RiskStatusLabel } from '../components/ui/risk-indicator';
import { dataService } from '../lib/dataService';
import { computeClientSha256, formatBytes } from '../lib/utils';
import type { FullDocumentBundle } from '../types/forensics';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ACCEPTED_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']);

interface UploadPageProps {
  onUploadComplete: (bundle: FullDocumentBundle) => void;
  onNavigateToAnalysis: (docId: string, route: WorkspaceRoute) => void;
}

export function UploadPage({ onUploadComplete, onNavigateToAnalysis }: UploadPageProps) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = React.useState(false);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [clientSha256, setClientSha256] = React.useState<string | null>(null);
  const [validationError, setValidationError] = React.useState<string | null>(null);

  const [uploading, setUploading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [stageText, setStageText] = React.useState('');
  const [completedBundle, setCompletedBundle] = React.useState<FullDocumentBundle | null>(null);

  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileSelection = async (file: File | undefined) => {
    setValidationError(null);
    setCompletedBundle(null);
    setProgress(0);
    setStageText('');

    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const validType =
      ACCEPTED_TYPES.has(file.type.toLowerCase()) ||
      ['pdf', 'jpg', 'jpeg', 'png'].includes(ext);

    if (!validType) {
      setSelectedFile(null);
      setValidationError(
        `Unsupported file "${file.name}". Only PDF, JPG, JPEG, and PNG documents are accepted.`
      );
      return;
    }

    if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
      setSelectedFile(null);
      setValidationError(
        `File size (${formatBytes(file.size)}) must be between 1 byte and 10 MB.`
      );
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const objectUrl = URL.createObjectURL(file);
    setSelectedFile(file);
    setPreviewUrl(objectUrl);

    try {
      const digest = await computeClientSha256(file);
      setClientSha256(digest);
    } catch {
      setClientSha256(null);
    }
  };

  const clearSelection = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    setClientSha256(null);
    setValidationError(null);
    setCompletedBundle(null);
    setProgress(0);
    setStageText('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleUploadAndAnalyze = async () => {
    if (!selectedFile) return;
    setValidationError(null);
    setUploading(true);
    setProgress(5);
    setStageText('Preparing secure upload...');

    try {
      const bundle = await dataService.uploadAndAnalyzeDocument(
        selectedFile,
        (pct, stage) => {
          setProgress(pct);
          setStageText(stage);
        }
      );
      setCompletedBundle(bundle);
      onUploadComplete(bundle);
    } catch (err) {
      setValidationError(
        err instanceof Error ? err.message : 'Document upload and forensic analysis failed.'
      );
      setProgress(0);
      setStageText('');
    } finally {
      setUploading(false);
    }
  };

  const isImage = selectedFile?.type.startsWith('image/');

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-5 dark:border-slate-800">
        <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Upload Document for Forensic Screening
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Submit a PDF, JPG, JPEG, or PNG invoice (up to 10 MB) for OCR extraction, SHA-256
          duplicate verification, metadata inspection, and rule-based risk evaluation.
        </p>
      </div>

      {validationError && (
        <Alert variant="destructive">
          <FileWarning className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{validationError}</span>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Dropzone & Controls */}
        <Card className="lg:col-span-6">
          <CardHeader>
            <CardTitle>Document Ingestion</CardTitle>
            <CardDescription>
              Files are stored securely in{' '}
              {dataService.getBackendMode() === 'supabase'
                ? 'Supabase Private Storage'
                : 'your isolated workspace vault'}
              .
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                void handleFileSelection(e.dataTransfer.files?.[0]);
              }}
              className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
                dragActive
                  ? 'border-cyan-400 bg-cyan-500/10'
                  : 'border-slate-300 bg-slate-50/70 hover:border-blue-500/60 dark:border-slate-700 dark:bg-slate-900/40'
              }`}
            >
              <UploadCloud
                className="mx-auto h-10 w-10 text-blue-500 dark:text-cyan-400"
                aria-hidden="true"
              />
              <p className="mt-3 text-sm font-medium text-slate-900 dark:text-white">
                Drag and drop your invoice or document here
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Supported formats: PDF, JPG, JPEG, PNG · Maximum size: 10 MB
              </p>

              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                className="hidden"
                onChange={(e) => void handleFileSelection(e.target.files?.[0])}
              />

              <div className="mt-5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => inputRef.current?.click()}
                  disabled={uploading}
                >
                  Browse Files
                </Button>
              </div>
            </div>

            {selectedFile && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    {isImage ? (
                      <ImageIcon className="h-5 w-5 text-cyan-500 shrink-0 mt-0.5" aria-hidden="true" />
                    ) : (
                      <FileText className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" aria-hidden="true" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                        {selectedFile.type || 'document'} · {formatBytes(selectedFile.size)}
                      </p>
                    </div>
                  </div>
                  {!uploading && (
                    <button
                      type="button"
                      onClick={clearSelection}
                      aria-label="Remove selected file"
                      className="rounded p-1 text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {clientSha256 && (
                  <div className="border-t border-slate-200 pt-2.5 dark:border-slate-800">
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Client Pre-Upload SHA-256 Digest
                    </p>
                    <p className="mt-0.5 break-all font-mono text-xs text-slate-700 dark:text-cyan-300">
                      {clientSha256}
                    </p>
                  </div>
                )}

                {(uploading || progress > 0) && (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600 dark:text-slate-300">{stageText}</span>
                      <span className="font-mono tabular-nums text-slate-700 dark:text-slate-200">
                        {progress}%
                      </span>
                    </div>
                    <Progress value={progress} />
                  </div>
                )}

                {!completedBundle && (
                  <Button
                    type="button"
                    className="w-full"
                    onClick={() => void handleUploadAndAnalyze()}
                    disabled={uploading}
                  >
                    {uploading ? 'Analyzing Document...' : 'Upload & Run Forensic Analysis'}
                  </Button>
                )}
              </div>
            )}

            {completedBundle && (
              <Alert variant="success" className="flex-col items-stretch gap-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 font-medium">
                    <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>Upload &amp; Forensic Analysis Completed</span>
                  </div>
                  <RiskStatusLabel
                    level={completedBundle.analysis.risk_level}
                    score={completedBundle.analysis.risk_score}
                  />
                </div>
                <p className="text-xs opacity-90">
                  Detected {completedBundle.analysis.detected_indicators.length} indicator(s).
                  Proceed to inspect extracted OCR text, invoice verification, or risk assessment.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() =>
                      onNavigateToAnalysis(completedBundle.document.id, 'analysis')
                    }
                  >
                    View Document Analysis
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      onNavigateToAnalysis(completedBundle.document.id, 'risk')
                    }
                  >
                    Risk Assessment
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      onNavigateToAnalysis(completedBundle.document.id, 'reports')
                    }
                  >
                    Detailed Report
                  </Button>
                </div>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Live Document Preview */}
        <Card className="lg:col-span-6">
          <CardHeader>
            <CardTitle>Document Preview</CardTitle>
            <CardDescription>
              Local rendering prior to and during forensic processing
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedFile || !previewUrl ? (
              <div className="flex h-[360px] flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-center p-6 dark:border-slate-800 dark:bg-slate-900/40">
                <FileText className="h-10 w-10 text-slate-400" aria-hidden="true" />
                <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                  No document selected
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Select a PDF, JPG, JPEG, or PNG file to preview its contents here.
                </p>
              </div>
            ) : isImage ? (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950/80 dark:border-slate-800 flex items-center justify-center max-h-[420px]">
                <img
                  src={previewUrl}
                  alt={`Preview of ${selectedFile.name}`}
                  className="max-h-[420px] w-auto object-contain"
                />
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950/80 dark:border-slate-800">
                <iframe
                  src={previewUrl}
                  title={`PDF preview of ${selectedFile.name}`}
                  className="h-[420px] w-full"
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
