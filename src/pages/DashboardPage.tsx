import * as React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileText,
  ShieldAlert,
  UploadCloud,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { WorkspaceRoute } from '../components/AppShell';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { RiskStatusLabel } from '../components/ui/risk-indicator';
import { formatDateTime } from '../lib/utils';
import type { FullDocumentBundle, UserProfile } from '../types/forensics';

interface DashboardPageProps {
  user: UserProfile;
  documents: FullDocumentBundle[];
  loading: boolean;
  onNavigate: (route: WorkspaceRoute) => void;
  onSelectDocument: (docId: string, route: WorkspaceRoute) => void;
}

export function DashboardPage({
  user,
  documents,
  loading,
  onNavigate,
  onSelectDocument,
}: DashboardPageProps) {
  const totalCount = documents.length;
  const lowRiskCount = documents.filter((d) => d.analysis.risk_level === 'LOW RISK').length;
  const mediumRiskCount = documents.filter((d) => d.analysis.risk_level === 'MEDIUM RISK').length;
  const highRiskCount = documents.filter((d) => d.analysis.risk_level === 'HIGH RISK').length;

  const riskDistributionData = React.useMemo(
    () =>
      [
        { name: 'Low Risk', value: lowRiskCount, color: '#16A34A' },
        { name: 'Medium Risk', value: mediumRiskCount, color: '#D97706' },
        { name: 'High Risk', value: highRiskCount, color: '#DC2626' },
      ].filter((item) => item.value > 0),
    [lowRiskCount, mediumRiskCount, highRiskCount]
  );

  const monthlyActivityData = React.useMemo(() => {
    const map = new Map<
      string,
      { month: string; low: number; medium: number; high: number; total: number }
    >();
    const sorted = [...documents].sort(
      (a, b) =>
        new Date(a.document.uploaded_at).getTime() - new Date(b.document.uploaded_at).getTime()
    );
    for (const item of sorted) {
      const d = new Date(item.document.uploaded_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
      const entry = map.get(key) || { month: label, low: 0, medium: 0, high: 0, total: 0 };
      entry.total += 1;
      if (item.analysis.risk_level === 'LOW RISK') entry.low += 1;
      else if (item.analysis.risk_level === 'MEDIUM RISK') entry.medium += 1;
      else entry.high += 1;
      map.set(key, entry);
    }
    return Array.from(map.values());
  }, [documents]);

  const recentDocs = documents.slice(0, 6);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-20 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800/70" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800/70" />
          ))}
        </div>
        <div className="h-80 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800/70" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-6 dark:border-slate-800">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Welcome back, {user.full_name}
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Monitor document verification metrics, risk distributions, and recent forensic audits.
          </p>
        </div>
        <Button onClick={() => onNavigate('upload')}>
          <UploadCloud className="h-4 w-4" aria-hidden="true" />
          <span>Quick Upload Document</span>
        </Button>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Total Analyzed
              </p>
              <FileText className="h-4 w-4 text-blue-500" aria-hidden="true" />
            </div>
            <p className="mt-3 font-mono text-3xl font-semibold tabular-nums text-slate-900 dark:text-white">
              {totalCount}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              All uploaded documents
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Low-Risk Documents
              </p>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
            </div>
            <p className="mt-3 font-mono text-3xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
              {lowRiskCount}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Score 0–29 · Minimal indicators
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Medium-Risk Documents
              </p>
              <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden="true" />
            </div>
            <p className="mt-3 font-mono text-3xl font-semibold tabular-nums text-amber-600 dark:text-amber-400">
              {mediumRiskCount}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Score 30–64 · Manual check advised
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                High-Risk Documents
              </p>
              <ShieldAlert className="h-4 w-4 text-red-500" aria-hidden="true" />
            </div>
            <p className="mt-3 font-mono text-3xl font-semibold tabular-nums text-red-600 dark:text-red-400">
              {highRiskCount}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Score 65–100 · Priority review
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Empty State vs Populated Charts & Tables */}
      {totalCount === 0 ? (
        <Card className="p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600/15 text-blue-500">
            <UploadCloud className="h-6 w-6" aria-hidden="true" />
          </div>
          <h3 className="mt-4 font-display text-lg font-semibold text-slate-900 dark:text-white">
            No documents analyzed yet
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-600 dark:text-slate-400">
            Upload your first PDF, JPG, JPEG, or PNG invoice to populate live risk distribution
            charts, OCR extractions, SHA-256 duplicate checks, and audit reports.
          </p>
          <div className="mt-6">
            <Button onClick={() => onNavigate('upload')}>
              Upload First Document
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </Card>
      ) : (
        <>
          {/* Charts Grid */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <Card className="lg:col-span-5">
              <CardHeader>
                <CardTitle>Risk Distribution</CardTitle>
                <CardDescription>
                  Breakdown of analyzed documents by risk tier
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={riskDistributionData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={56}
                        outerRadius={88}
                        paddingAngle={3}
                      >
                        {riskDistributionData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0B1221',
                          borderColor: '#1E293B',
                          borderRadius: '8px',
                          color: '#F8FAFC',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-center gap-5 text-xs">
                  {riskDistributionData.map((d) => (
                    <div key={d.name} className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: d.color }}
                      />
                      <span className="text-slate-700 dark:text-slate-300">
                        {d.name}: <strong className="font-mono tabular-nums">{d.value}</strong>
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-7">
              <CardHeader>
                <CardTitle>Monthly Document Analysis Activity</CardTitle>
                <CardDescription>
                  Volume of documents screened per month stacked by risk level
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyActivityData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.25} />
                      <XAxis dataKey="month" stroke="#94A3B8" fontSize={12} />
                      <YAxis allowDecimals={false} stroke="#94A3B8" fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0B1221',
                          borderColor: '#1E293B',
                          borderRadius: '8px',
                          color: '#F8FAFC',
                        }}
                      />
                      <Bar dataKey="low" stackId="a" name="Low Risk" fill="#16A34A" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="medium" stackId="a" name="Medium Risk" fill="#D97706" />
                      <Bar dataKey="high" stackId="a" name="High Risk" fill="#DC2626" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Analysis Table & Recent Activity */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <Card className="lg:col-span-8">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Recent Analysis Records</CardTitle>
                  <CardDescription>Click any record to inspect forensic findings</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => onNavigate('history')}>
                  View All
                </Button>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                      <th className="py-2.5 pr-4 font-medium">Document</th>
                      <th className="py-2.5 pr-4 font-medium">Vendor / Invoice</th>
                      <th className="py-2.5 pr-4 font-medium">Risk Assessment</th>
                      <th className="py-2.5 text-right font-medium">Uploaded</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80">
                    {recentDocs.map((bundle) => (
                      <tr
                        key={bundle.document.id}
                        onClick={() => onSelectDocument(bundle.document.id, 'analysis')}
                        className="hover:bg-slate-100/70 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                      >
                        <td className="py-3 pr-4 font-medium text-slate-900 dark:text-slate-100 max-w-[190px] truncate">
                          {bundle.document.file_name}
                        </td>
                        <td className="py-3 pr-4 text-slate-600 dark:text-slate-300 max-w-[190px] truncate">
                          {bundle.invoice.company_name || 'Unidentified Vendor'}
                          {bundle.invoice.invoice_number
                            ? ` · #${bundle.invoice.invoice_number}`
                            : ''}
                        </td>
                        <td className="py-3 pr-4">
                          <RiskStatusLabel
                            level={bundle.analysis.risk_level}
                            score={bundle.analysis.risk_score}
                          />
                        </td>
                        <td className="py-3 text-right font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {formatDateTime(bundle.document.uploaded_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card className="lg:col-span-4">
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest audit events in your workspace</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {recentDocs.slice(0, 5).map((bundle) => {
                  const hasDup = bundle.duplicateChecks.some(
                    (dc) => dc.match_type === 'EXACT_SHA256_MATCH'
                  );
                  return (
                    <div
                      key={bundle.document.id}
                      onClick={() => onSelectDocument(bundle.document.id, 'reports')}
                      className="border-b border-slate-200 pb-3 last:border-b-0 last:pb-0 dark:border-slate-800/80 cursor-pointer hover:opacity-85"
                    >
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                        {bundle.document.file_name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {bundle.analysis.detected_indicators.length} indicator(s)
                        {hasDup ? ' · Duplicate SHA-256 match' : ''} ·{' '}
                        {formatDateTime(bundle.analysis.created_at)}
                      </p>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
