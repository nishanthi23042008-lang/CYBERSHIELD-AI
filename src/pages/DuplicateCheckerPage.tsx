import * as React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CopyCheck,
  FileSearch,
  Info,
  UploadCloud,
} from 'lucide-react';
import type { WorkspaceRoute } from '../components/AppShell';
import { Alert } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { dataService } from '../lib/dataService';
import { formatBytes, formatDateTime } from '../lib/utils';
import type { DocumentRecord, FullDocumentBundle } from '../types/forensics';

interface DuplicateCheckerPageProps {
  documents: FullDocumentBundle[];
  onSelectDocument: (docId: string, route: WorkspaceRoute) => void;
}

export function DuplicateCheckerPage({
  documents,
  onSelectDocument,
}: DuplicateCheckerPageProps) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [checking, setChecking] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [checkResult, setCheckResult] = React.useState<{
    fileName: string;
    fileSize: number;
    sha256: string;
    matchType: 'NO_DUPLICATE' | 'EXACT_SHA256_MATCH';
    matches: DocumentRecord[];
  } | null>(null);

  const handleCheckFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setChecking(true);
    try {
      const result = await dataService.checkHashDuplicate(file);
      setCheckResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to compute SHA-256 hash.');
    } finally {
      setChecking(false);
    }
  };

  const duplicateBundles = documents.filter((b) =>
    b.duplicateChecks.some((dc) => dc.match_type === 'EXACT_SHA256_MATCH')
  );

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-5 dark:border-slate-800">
        <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          SHA-256 Duplicate Document Checker
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Compute cryptographic SHA-256 file hashes and compare against all documents previously
          stored in your workspace.
        </p>
      </div>

      <Alert variant="info">
        <Info className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
        <span className="text-xs leading-relaxed">
          <strong>Hash Comparison Scope Limitation:</strong> An identical SHA-256 digest confirms
          that two files are byte-for-byte identical. However, a <em>different</em> SHA-256 hash
          does <strong>not</strong> prove two documents are unrelated—re-saving, printing to PDF,
          cropping, or scanning a document changes its bytes and generates a new hash.
        </span>
      </Alert>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Live Hash Check Dropzone */}
        <Card className="lg:col-span-6">
          <CardHeader>
            <CardTitle>Verify a File Against Stored Vault</CardTitle>
            <CardDescription>
              Compute SHA-256 digest without adding a duplicate entry to your analysis history
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && <Alert variant="destructive">{error}</Alert>}

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void handleCheckFile(e.dataTransfer.files?.[0]);
              }}
              className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/70 p-8 text-center dark:border-slate-700 dark:bg-slate-900/40"
            >
              <CopyCheck className="mx-auto h-9 w-9 text-cyan-500" aria-hidden="true" />
              <p className="mt-3 text-sm font-medium text-slate-900 dark:text-white">
                Drop any file to check its SHA-256 fingerprint
              </p>
              <input
                ref={inputRef}
                type="file"
                className="hidden"
                onChange={(e) => void handleCheckFile(e.target.files?.[0])}
              />
              <div className="mt-4">
                <Button
                  type="button"
                  variant="outline"
                  disabled={checking}
                  onClick={() => inputRef.current?.click()}
                >
                  <UploadCloud className="h-4 w-4" aria-hidden="true" />
                  <span>{checking ? 'Hashing File...' : 'Select File to Hash'}</span>
                </Button>
              </div>
            </div>

            {checkResult && (
              <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                    {checkResult.fileName}
                  </p>
                  <span className="font-mono text-xs text-slate-500 tabular-nums">
                    {formatBytes(checkResult.fileSize)}
                  </span>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">SHA-256 Digest</p>
                  <p className="mt-0.5 break-all font-mono text-xs text-cyan-600 dark:text-cyan-300">
                    {checkResult.sha256}
                  </p>
                </div>

                {checkResult.matchType === 'EXACT_SHA256_MATCH' ? (
                  <Alert variant="warning" className="flex-col items-stretch gap-2">
                    <div className="flex items-center gap-2 font-medium">
                      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>
                        Exact Duplicate Found ({checkResult.matches.length} matching upload)
                      </span>
                    </div>
                    {checkResult.matches.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between gap-2 text-xs pt-1"
                      >
                        <span className="truncate">
                          {m.file_name} · {formatDateTime(m.uploaded_at)}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onSelectDocument(m.id, 'analysis')}
                        >
                          Inspect Match
                        </Button>
                      </div>
                    ))}
                  </Alert>
                ) : (
                  <Alert variant="success">
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                    <span className="text-xs">
                      No exact byte-for-byte SHA-256 match found among your {documents.length}{' '}
                      stored document(s).
                    </span>
                  </Alert>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recorded Duplicate Matches & Vault Hash Registry */}
        <Card className="lg:col-span-6">
          <CardHeader>
            <CardTitle>Recorded Duplicate Detections ({duplicateBundles.length})</CardTitle>
            <CardDescription>
              Documents flagged during upload with identical SHA-256 hashes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {duplicateBundles.length === 0 ? (
              <div className="rounded-xl border border-slate-200 p-8 text-center dark:border-slate-800">
                <FileSearch className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" />
                <p className="mt-3 text-sm font-medium text-slate-800 dark:text-slate-200">
                  No duplicate submissions recorded
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Whenever an uploaded file shares a SHA-256 digest with an earlier document, the
                  match is logged here automatically.
                </p>
              </div>
            ) : (
              duplicateBundles.map((bundle) => {
                const match = bundle.duplicateChecks.find(
                  (dc) => dc.match_type === 'EXACT_SHA256_MATCH'
                );
                return (
                  <div
                    key={bundle.document.id}
                    className="rounded-lg border border-slate-200 p-4 dark:border-slate-800 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                        {bundle.document.file_name}
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onSelectDocument(bundle.document.id, 'analysis')}
                      >
                        Open
                      </Button>
                    </div>
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      Matches earlier upload: {match?.matched_file_name || match?.matched_document_id}{' '}
                      ({formatDateTime(match?.matched_uploaded_at)})
                    </p>
                    <p className="truncate font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      SHA-256: {bundle.document.file_hash}
                    </p>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
