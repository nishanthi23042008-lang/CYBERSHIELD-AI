import * as React from 'react';
import {
  FileCheck2,
  FileSearch,
  History,
  Search,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import type { WorkspaceRoute } from '../components/AppShell';
import { Alert } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { RiskStatusLabel } from '../components/ui/risk-indicator';
import { dataService } from '../lib/dataService';
import { formatDateTime } from '../lib/utils';
import type { FullDocumentBundle, RiskLevel } from '../types/forensics';

interface HistoryPageProps {
  documents: FullDocumentBundle[];
  onSelectDocument: (docId: string, route: WorkspaceRoute) => void;
  onDocumentDeleted: (docId: string) => void;
  onNavigate: (route: WorkspaceRoute) => void;
}

export function HistoryPage({
  documents,
  onSelectDocument,
  onDocumentDeleted,
  onNavigate,
}: HistoryPageProps) {
  const [search, setSearch] = React.useState('');
  const [riskFilter, setRiskFilter] = React.useState<'ALL' | RiskLevel>('ALL');
  const [sortBy, setSortBy] = React.useState<'date_desc' | 'date_asc' | 'score_desc' | 'name_asc'>(
    'date_desc'
  );
  const [deleteTarget, setDeleteTarget] = React.useState<FullDocumentBundle | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return documents
      .filter((b) => {
        if (riskFilter !== 'ALL' && b.analysis.risk_level !== riskFilter) return false;
        if (!q) return true;
        return (
          b.document.file_name.toLowerCase().includes(q) ||
          (b.invoice.company_name || '').toLowerCase().includes(q) ||
          (b.invoice.invoice_number || '').toLowerCase().includes(q) ||
          b.document.file_hash.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (sortBy === 'date_desc') {
          return (
            new Date(b.document.uploaded_at).getTime() -
            new Date(a.document.uploaded_at).getTime()
          );
        }
        if (sortBy === 'date_asc') {
          return (
            new Date(a.document.uploaded_at).getTime() -
            new Date(b.document.uploaded_at).getTime()
          );
        }
        if (sortBy === 'score_desc') {
          return b.analysis.risk_score - a.analysis.risk_score;
        }
        return a.document.file_name.localeCompare(b.document.file_name);
      });
  }, [documents, search, riskFilter, sortBy]);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      await dataService.deleteDocument(deleteTarget.document);
      onDocumentDeleted(deleteTarget.document.id);
      setDeleteTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete document.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Analysis History
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Search, filter, sort, and manage all uploaded documents and forensic audit records.
          </p>
        </div>
        <Button onClick={() => onNavigate('upload')}>
          <UploadCloud className="h-4 w-4" aria-hidden="true" />
          <span>New Upload</span>
        </Button>
      </div>

      {error && <Alert variant="destructive">{error}</Alert>}

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search
                className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400"
                aria-hidden="true"
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by file name, vendor, invoice #, or SHA-256..."
                className="pl-9"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-900">
                {(['ALL', 'LOW RISK', 'MEDIUM RISK', 'HIGH RISK'] as const).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setRiskFilter(level)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                      riskFilter === level
                        ? 'bg-white text-slate-900 shadow-sm dark:bg-blue-600 dark:text-white'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    {level === 'ALL' ? 'All' : level.replace(' RISK', '')}
                  </button>
                ))}
              </div>

              <select
                aria-label="Sort analysis history"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="date_desc">Newest First</option>
                <option value="date_asc">Oldest First</option>
                <option value="score_desc">Highest Risk Score</option>
                <option value="name_asc">File Name (A–Z)</option>
              </select>
            </div>
          </div>
          <CardDescription>
            Showing {filtered.length} of {documents.length} record(s)
          </CardDescription>
        </CardHeader>

        <CardContent>
          {documents.length === 0 ? (
            <div className="py-12 text-center">
              <History className="mx-auto h-10 w-10 text-slate-400" aria-hidden="true" />
              <p className="mt-3 text-sm font-medium text-slate-800 dark:text-slate-200">
                Your analysis history is empty
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Upload a document to start building your searchable audit trail.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
              No records match your active search or risk filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    <th className="py-3 pr-4 font-medium">Document Name</th>
                    <th className="py-3 pr-4 font-medium">Upload Date</th>
                    <th className="py-3 pr-4 font-medium">Status</th>
                    <th className="py-3 pr-4 font-medium">Risk Assessment</th>
                    <th className="py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80">
                  {filtered.map((bundle) => (
                    <tr
                      key={bundle.document.id}
                      className="hover:bg-slate-100/60 dark:hover:bg-slate-800/30"
                    >
                      <td className="py-3.5 pr-4">
                        <p className="font-medium text-slate-900 dark:text-white max-w-[240px] truncate">
                          {bundle.document.file_name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[240px]">
                          {bundle.invoice.company_name || 'Vendor not detected'}
                          {bundle.invoice.invoice_number
                            ? ` · #${bundle.invoice.invoice_number}`
                            : ''}
                        </p>
                      </td>
                      <td className="py-3.5 pr-4 font-mono text-xs tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {formatDateTime(bundle.document.uploaded_at)}
                      </td>
                      <td className="py-3.5 pr-4 text-xs capitalize text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {bundle.analysis.analysis_status}
                      </td>
                      <td className="py-3.5 pr-4">
                        <RiskStatusLabel
                          level={bundle.analysis.risk_level}
                          score={bundle.analysis.risk_score}
                        />
                      </td>
                      <td className="py-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onSelectDocument(bundle.document.id, 'analysis')}
                          >
                            <FileSearch className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Inspect</span>
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => onSelectDocument(bundle.document.id, 'reports')}
                          >
                            <FileCheck2 className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>View Report</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Delete ${bundle.document.file_name}`}
                            onClick={() => setDeleteTarget(bundle)}
                            className="text-red-600 hover:text-red-700 dark:text-red-400"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={deleteTarget !== null}
        onClose={() => !deleting && setDeleteTarget(null)}
        title="Delete Document Record"
        description="This permanently removes the stored file, OCR text, invoice details, and forensic report."
      >
        <p className="text-sm text-slate-700 dark:text-slate-300">
          Are you sure you want to delete{' '}
          <strong className="text-slate-900 dark:text-white">
            {deleteTarget?.document.file_name}
          </strong>
          ?
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => setDeleteTarget(null)}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => void confirmDelete()}
            disabled={deleting}
          >
            {deleting ? 'Deleting...' : 'Delete Permanently'}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
