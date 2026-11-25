import * as React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Save,
  UploadCloud,
} from 'lucide-react';
import type { WorkspaceRoute } from '../components/AppShell';
import { Alert } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { RiskStatusLabel } from '../components/ui/risk-indicator';
import { dataService } from '../lib/dataService';
import { formatCurrency } from '../lib/utils';
import type { FullDocumentBundle } from '../types/forensics';

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

interface InvoiceVerificationPageProps {
  documents: FullDocumentBundle[];
  selectedDocId: string | null;
  onSelectDocId: (id: string) => void;
  onBundleUpdated: (updated: FullDocumentBundle) => void;
  onNavigate: (route: WorkspaceRoute) => void;
}

export function InvoiceVerificationPage({
  documents,
  selectedDocId,
  onSelectDocId,
  onBundleUpdated,
  onNavigate,
}: InvoiceVerificationPageProps) {
  const activeBundle =
    documents.find((d) => d.document.id === selectedDocId) || documents[0] || null;

  const [invoiceNumber, setInvoiceNumber] = React.useState('');
  const [companyName, setCompanyName] = React.useState('');
  const [invoiceDate, setInvoiceDate] = React.useState('');
  const [subtotalAmount, setSubtotalAmount] = React.useState('');
  const [taxAmount, setTaxAmount] = React.useState('');
  const [totalAmount, setTotalAmount] = React.useState('');
  const [gstNumber, setGstNumber] = React.useState('');
  const [currency, setCurrency] = React.useState('INR');
  const [taxDetails, setTaxDetails] = React.useState('');
  const [verificationNotes, setVerificationNotes] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{ type: 'success' | 'error'; msg: string } | null>(
    null
  );

  React.useEffect(() => {
    if (!activeBundle) return;
    const inv = activeBundle.invoice;
    setInvoiceNumber(inv.invoice_number || '');
    setCompanyName(inv.company_name || '');
    setInvoiceDate(inv.invoice_date || '');
    setSubtotalAmount(inv.subtotal_amount !== null ? String(inv.subtotal_amount) : '');
    setTaxAmount(inv.tax_amount !== null ? String(inv.tax_amount) : '');
    setTotalAmount(inv.total_amount !== null ? String(inv.total_amount) : '');
    setGstNumber(inv.gst_number || '');
    setCurrency(inv.currency || 'INR');
    setTaxDetails(inv.tax_details || '');
    setVerificationNotes(inv.verification_notes || '');
    setFeedback(null);
  }, [activeBundle?.document.id]);

  if (!activeBundle) {
    return (
      <Card className="p-10 text-center">
        <FileSpreadsheet className="mx-auto h-10 w-10 text-slate-400" aria-hidden="true" />
        <h2 className="mt-4 font-display text-xl font-semibold text-slate-900 dark:text-white">
          No invoices available for verification
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-600 dark:text-slate-400">
          Upload an invoice PDF or image to inspect extracted fields, GSTIN structure, and
          arithmetic consistency.
        </p>
        <div className="mt-6">
          <Button onClick={() => onNavigate('upload')}>
            <UploadCloud className="h-4 w-4" aria-hidden="true" />
            <span>Upload Invoice</span>
          </Button>
        </div>
      </Card>
    );
  }

  const parsedSub = subtotalAmount.trim() !== '' ? Number(subtotalAmount) : null;
  const parsedTax = taxAmount.trim() !== '' ? Number(taxAmount) : null;
  const parsedTotal = totalAmount.trim() !== '' ? Number(totalAmount) : null;

  const arithmeticCheck = (() => {
    if (parsedSub === null || parsedTax === null || parsedTotal === null) {
      return { status: 'incomplete', label: 'Subtotal, tax, or total not all populated' };
    }
    const diff = Math.abs(parsedSub + parsedTax - parsedTotal);
    const tol = Math.max(1, parsedTotal * 0.01);
    if (diff > tol) {
      return {
        status: 'mismatch',
        label: `Mismatch: ${formatCurrency(parsedSub + parsedTax, currency)} expected vs ${formatCurrency(parsedTotal, currency)}`,
      };
    }
    return { status: 'valid', label: 'Subtotal + Tax matches Total within tolerance' };
  })();

  const gstCheck = (() => {
    const cleaned = gstNumber.trim().toUpperCase();
    if (!cleaned) return { status: 'missing', label: 'GST / Tax ID not provided' };
    if (cleaned.length >= 13 && cleaned.length <= 17 && !GSTIN_REGEX.test(cleaned)) {
      return { status: 'invalid', label: 'Does not match 15-character GSTIN pattern' };
    }
    if (GSTIN_REGEX.test(cleaned)) {
      return { status: 'valid', label: 'Valid 15-character GSTIN structure' };
    }
    return { status: 'info', label: 'Non-GSTIN tax identifier recorded' };
  })();

  const dateCheck = (() => {
    if (!invoiceDate.trim()) return { status: 'missing', label: 'Invoice date missing' };
    const parsed = new Date(invoiceDate);
    if (Number.isNaN(parsed.getTime())) {
      return { status: 'invalid', label: 'Date format could not be parsed cleanly' };
    }
    if (parsed.getTime() > Date.now() + 86400000) {
      return { status: 'invalid', label: 'Future-dated invoice requires verification' };
    }
    return { status: 'valid', label: 'Calendar date within normal range' };
  })();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      const updated = await dataService.updateInvoiceDetails(activeBundle.document.id, {
        invoice_number: invoiceNumber.trim() || null,
        company_name: companyName.trim() || null,
        invoice_date: invoiceDate.trim() || null,
        subtotal_amount: Number.isFinite(parsedSub) ? parsedSub : null,
        tax_amount: Number.isFinite(parsedTax) ? parsedTax : null,
        total_amount: Number.isFinite(parsedTotal) ? parsedTotal : null,
        gst_number: gstNumber.trim().toUpperCase() || null,
        currency: currency.trim().toUpperCase() || 'INR',
        tax_details: taxDetails.trim() || null,
        verification_notes: verificationNotes.trim() || null,
      });
      onBundleUpdated(updated);
      setFeedback({
        type: 'success',
        msg: 'Invoice fields saved and risk rules re-evaluated against updated values.',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        msg: err instanceof Error ? err.message : 'Unable to save invoice changes.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Invoice Verification Console
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Review extracted invoice fields, detect missing values or mismatches, and record manual
            auditor corrections.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            aria-label="Select invoice document"
            value={activeBundle.document.id}
            onChange={(e) => onSelectDocId(e.target.value)}
            className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 max-w-[260px]"
          >
            {documents.map((b) => (
              <option key={b.document.id} value={b.document.id}>
                {b.document.file_name}
              </option>
            ))}
          </select>
          <RiskStatusLabel
            level={activeBundle.analysis.risk_level}
            score={activeBundle.analysis.risk_score}
          />
        </div>
      </div>

      {feedback && (
        <Alert variant={feedback.type === 'success' ? 'success' : 'destructive'}>
          <span>{feedback.msg}</span>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Editable Verification Form */}
        <Card className="lg:col-span-7">
          <CardHeader>
            <CardTitle>Extracted Invoice Fields</CardTitle>
            <CardDescription>
              Edit any OCR field below and save to re-run deterministic risk scoring
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="inv-num">Invoice Number</Label>
                  <Input
                    id="inv-num"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="e.g. INV-2026-0412"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="inv-company">Company / Vendor Name</Label>
                  <Input
                    id="inv-company"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Issuer legal name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="inv-date">Invoice Date</Label>
                  <Input
                    id="inv-date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    placeholder="YYYY-MM-DD"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="inv-gst">GST Number / Tax ID</Label>
                  <Input
                    id="inv-gst"
                    value={gstNumber}
                    onChange={(e) => setGstNumber(e.target.value)}
                    placeholder="15-char GSTIN"
                    className="font-mono uppercase"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="inv-sub">Subtotal Amount</Label>
                  <Input
                    id="inv-sub"
                    type="number"
                    step="0.01"
                    value={subtotalAmount}
                    onChange={(e) => setSubtotalAmount(e.target.value)}
                    placeholder="0.00"
                    className="font-mono tabular-nums"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="inv-tax">Tax Amount</Label>
                  <Input
                    id="inv-tax"
                    type="number"
                    step="0.01"
                    value={taxAmount}
                    onChange={(e) => setTaxAmount(e.target.value)}
                    placeholder="0.00"
                    className="font-mono tabular-nums"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="inv-total">Total Amount</Label>
                  <Input
                    id="inv-total"
                    type="number"
                    step="0.01"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    placeholder="0.00"
                    className="font-mono tabular-nums"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="inv-currency">Currency</Label>
                  <Input
                    id="inv-currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    placeholder="INR / USD / EUR"
                    className="font-mono uppercase"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="inv-tax-details">Tax Breakdown Details</Label>
                <Input
                  id="inv-tax-details"
                  value={taxDetails}
                  onChange={(e) => setTaxDetails(e.target.value)}
                  placeholder="e.g. CGST 9% + SGST 9%"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="inv-notes">Manual Verification Notes</Label>
                <textarea
                  id="inv-notes"
                  rows={3}
                  value={verificationNotes}
                  onChange={(e) => setVerificationNotes(e.target.value)}
                  placeholder="Record PO match reference, vendor confirmation, or exception notes..."
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-slate-700/90 dark:bg-slate-900/70 dark:text-slate-100"
                />
              </div>

              <Button type="submit" disabled={saving}>
                <Save className="h-4 w-4" aria-hidden="true" />
                <span>{saving ? 'Saving & Re-evaluating...' : 'Save & Re-Verify Invoice'}</span>
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Live Field Diagnostic Checklist */}
        <Card className="lg:col-span-5 h-fit">
          <CardHeader>
            <CardTitle>Field Consistency Checks</CardTitle>
            <CardDescription>
              Real-time validation of missing fields, GSTIN format, and totals
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              {
                name: 'Mandatory Identifiers',
                ok: Boolean(
                  invoiceNumber.trim() &&
                    companyName.trim() &&
                    invoiceDate.trim() &&
                    totalAmount.trim()
                ),
                detail:
                  invoiceNumber.trim() &&
                  companyName.trim() &&
                  invoiceDate.trim() &&
                  totalAmount.trim()
                    ? 'Invoice number, vendor, date, and total are populated.'
                    : 'One or more core invoice fields are missing.',
              },
              {
                name: 'Arithmetic Reconciliation',
                ok: arithmeticCheck.status === 'valid',
                detail: arithmeticCheck.label,
              },
              {
                name: 'GST / Tax ID Validation',
                ok: gstCheck.status === 'valid' || gstCheck.status === 'info',
                detail: gstCheck.label,
              },
              {
                name: 'Invoice Date Sanity',
                ok: dateCheck.status === 'valid',
                detail: dateCheck.label,
              },
            ].map((item) => (
              <div
                key={item.name}
                className="flex items-start gap-3 rounded-lg border border-slate-200 p-3.5 dark:border-slate-800"
              >
                {item.ok ? (
                  <CheckCircle2
                    className="h-4.5 w-4.5 text-emerald-500 shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                ) : (
                  <AlertTriangle
                    className="h-4.5 w-4.5 text-amber-500 shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                )}
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{item.name}</p>
                  <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                    {item.detail}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
