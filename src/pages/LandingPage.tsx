import * as React from 'react';
import {
  ArrowRight,
  CheckCircle2,
  CopyCheck,
  FileSearch,
  FileSpreadsheet,
  Lock,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import type { PublicStats, UserProfile } from '../types/forensics';
import { BrandMark } from '../components/BrandMark';
import { Button } from '../components/ui/button';
import { Dialog } from '../components/ui/dialog';

interface LandingPageProps {
  user: UserProfile | null;
  stats: PublicStats | null;
  onGoLogin: () => void;
  onGoSignup: () => void;
  onGoDashboard: () => void;
}

export function LandingPage({
  user,
  stats,
  onGoLogin,
  onGoSignup,
  onGoDashboard,
}: LandingPageProps) {
  const [heroImgFailed, setHeroImgFailed] = React.useState(false);
  const [layerImgFailed, setLayerImgFailed] = React.useState(false);
  const [infoModal, setInfoModal] = React.useState<'about' | 'contact' | null>(null);

  return (
    <div className="min-h-screen bg-[#060A14] text-slate-100">
      {/* Zone 1 - Zone 2 - Zone 3 Top Bar Contract */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-[#060A14]/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
          <a
            href="#top"
            className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
          >
            TrustScan AI
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300">
            <a
              href="#capabilities"
              className="hover:text-cyan-300 transition-colors whitespace-nowrap shrink-0"
            >
              Capabilities
            </a>
            <a
              href="#workflow"
              className="hover:text-cyan-300 transition-colors whitespace-nowrap shrink-0"
            >
              How It Works
            </a>
            <a
              href="#why-trustscan"
              className="hover:text-cyan-300 transition-colors whitespace-nowrap shrink-0"
            >
              Why TrustScan
            </a>
            <a
              href="#statistics"
              className="hover:text-cyan-300 transition-colors whitespace-nowrap shrink-0"
            >
              Live Metrics
            </a>
          </nav>

          <div className="shrink-0">
            {user ? (
              <Button size="sm" onClick={onGoDashboard}>
                Open Dashboard
              </Button>
            ) : (
              <Button size="sm" onClick={onGoLogin}>
                Login
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section
        id="top"
        className="relative overflow-hidden border-b border-slate-800/70 cyber-grid-bg"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -top-40 h-96 bg-gradient-to-b from-blue-600/20 via-indigo-600/10 to-transparent blur-3xl"
        />
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-stretch gap-10 px-4 py-16 sm:px-6 lg:grid-cols-12 lg:py-24 lg:px-8">
          <div className="flex flex-col justify-center lg:col-span-6">
            <p className="text-sm font-medium text-cyan-400">
              Nova Squad · AVISHKAR&apos;26 · Digital Document &amp; Invoice Forensics
            </p>
            <h1 className="mt-4 font-display text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-[3.5rem] lg:leading-[1.08] [text-wrap:balance]">
              Trust Every Document. Detect Every Risk.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-300">
              TrustScan AI inspects digital invoices and financial documents using multimodal OCR,
              deterministic arithmetic and GST rules, cryptographic SHA-256 duplicate matching, and
              metadata plus JPEG Error Level Analysis to surface potential verification risks.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              {user ? (
                <Button size="lg" onClick={onGoDashboard}>
                  Go to Dashboard
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              ) : (
                <>
                  <Button size="lg" onClick={onGoSignup}>
                    Get Started
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button size="lg" variant="outline" onClick={onGoLogin}>
                    Login
                  </Button>
                </>
              )}
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-400">
              <span>PDF, JPG, JPEG &amp; PNG Support</span>
              <span aria-hidden="true">·</span>
              <span>SHA-256 Deduplication</span>
              <span aria-hidden="true">·</span>
              <span>Deterministic 0–100 Risk Scoring</span>
            </div>
          </div>

          <div className="lg:col-span-6 flex items-stretch">
            <div className="relative w-full overflow-hidden rounded-2xl border border-slate-800 bg-[#0B1221] shadow-2xl shadow-blue-950/30">
              {!heroImgFailed ? (
                <img
                  src="/src/assets/images/hero_forensics_console_1795641032636.jpg"
                  alt="TrustScan AI multi-layer digital document verification scanner visualization"
                  referrerPolicy="no-referrer"
                  onError={() => setHeroImgFailed(true)}
                  className="h-full w-full object-cover min-h-[280px] lg:min-h-[380px]"
                />
              ) : (
                <div className="flex h-full min-h-[320px] flex-col items-center justify-center bg-gradient-to-br from-[#0B1221] via-[#111C38] to-[#081020] p-8 text-center">
                  <ShieldCheck className="h-14 w-14 text-cyan-400" aria-hidden="true" />
                  <p className="mt-4 font-display text-lg font-semibold text-white">
                    Forensic Document Inspection Pipeline
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    OCR · Metadata · SHA-256 · Error Level Analysis
                  </p>
                </div>
              )}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#060A14]/70 via-transparent to-transparent" />
            </div>
          </div>
        </div>
      </section>

      {/* Feature Overview (Asymmetric Bento Grid) */}
      <section id="capabilities" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-cyan-400">Forensic Capabilities</p>
          <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-white [text-wrap:balance]">
            Multi-layered document verification built for audit transparency
          </h2>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="md:col-span-2 rounded-xl border border-slate-800/90 bg-[#0B1221]/90 p-7 glass-surface">
            <FileSearch className="h-6 w-6 text-cyan-400" aria-hidden="true" />
            <h3 className="mt-4 font-display text-xl font-semibold text-white">
              OCR Text Extraction &amp; Invoice Anomaly Rules
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              Extracts invoice numbers, issuer names, dates, GSTIN registration numbers, tax
              breakdowns, subtotals, and grand totals. Deterministic rules immediately flag missing
              mandatory fields, subtotal-plus-tax discrepancies, future-dated invoices, and
              structural tax ID issues.
            </p>
          </div>

          <div className="rounded-xl border border-slate-800/90 bg-[#0B1221]/90 p-7 glass-surface">
            <CopyCheck className="h-6 w-6 text-blue-400" aria-hidden="true" />
            <h3 className="mt-4 font-display text-xl font-semibold text-white">
              SHA-256 Duplicate Checker
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              Generates cryptographic SHA-256 digests on every file to detect byte-identical
              resubmissions across your vault while clearly documenting hashing scope limits.
            </p>
          </div>

          <div className="rounded-xl border border-slate-800/90 bg-[#0B1221]/90 p-7 glass-surface">
            <FileSpreadsheet className="h-6 w-6 text-indigo-400" aria-hidden="true" />
            <h3 className="mt-4 font-display text-xl font-semibold text-white">
              Metadata &amp; JPEG ELA Inspection
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              Inspects PDF Producer/Creator tags, EXIF Software headers, PNG chunks, and JPEG
              8×8 block Error Level Analysis heatmaps to surface post-export editing clues.
            </p>
          </div>

          <div className="md:col-span-2 rounded-xl border border-slate-800/90 bg-[#0B1221]/90 p-7 glass-surface">
            <Lock className="h-6 w-6 text-cyan-400" aria-hidden="true" />
            <h3 className="mt-4 font-display text-xl font-semibold text-white">
              Evidence-Backed Risk Assessment &amp; Audit PDF Reports
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              Every risk score (0–100) links directly to extracted document evidence, rule weightings,
              confidence notes, and technical limitations. Download structured forensic PDF audit
              reports in one click for compliance review.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section
        id="workflow"
        className="border-y border-slate-800/70 bg-[#080D1A]"
      >
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-12 lg:px-8">
          <div className="lg:col-span-5">
            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0B1221]">
              {!layerImgFailed ? (
                <img
                  src="/src/assets/images/forensic_layer_scan_1795641033376.jpg"
                  alt="Isometric multi-layer document authentication and cryptographic hashing workflow"
                  referrerPolicy="no-referrer"
                  onError={() => setLayerImgFailed(true)}
                  className="aspect-[4/3] w-full object-cover"
                />
              ) : (
                <div className="aspect-[4/3] flex flex-col items-center justify-center p-8 text-center">
                  <ShieldCheck className="h-12 w-12 text-blue-400" aria-hidden="true" />
                  <p className="mt-3 font-medium text-white">4-Stage Verification Pipeline</p>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-7">
            <p className="text-sm font-medium text-cyan-400">How It Works</p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-white">
              From raw upload to verifiable forensic report
            </h2>

            <div className="mt-8 space-y-6">
              {[
                {
                  step: '01. Secure Ingestion & SHA-256 Digest',
                  desc: 'Upload PDF, JPG, JPEG, or PNG files with magic-byte validation and immediate SHA-256 hash comparison against prior submissions.',
                },
                {
                  step: '02. Multimodal OCR & Metadata Parsing',
                  desc: 'Extracts verbatim text, invoice line totals, GSTIN/tax details, PDF header info, EXIF camera/software tags, and PNG text chunks.',
                },
                {
                  step: '03. Rule-Based Anomaly & ELA Scoring',
                  desc: 'Evaluates arithmetic consistency, missing identifiers, date anomalies, editing-tool signatures, and JPEG recompression variance.',
                },
                {
                  step: '04. Structured Risk Review & PDF Export',
                  desc: 'Inspect indicators with direct evidence, verify or edit extracted fields, and export a formatted forensic audit PDF.',
                },
              ].map((item) => (
                <div key={item.step} className="border-b border-slate-800/70 pb-5 last:border-b-0 last:pb-0">
                  <h3 className="font-display text-lg font-semibold text-white">{item.step}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-300">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose TrustScan AI */}
      <section id="why-trustscan" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-cyan-400">Why Choose TrustScan AI</p>
          <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-white">
            Engineered for explainability, never black-box guesswork
          </h2>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-3">
          {[
            {
              title: 'Zero Random or Simulated Scores',
              body: 'Every risk point is calculated deterministically from explicit, auditable forensic rules and observable document evidence.',
            },
            {
              title: 'Responsible Risk Language',
              body: 'Anomalies are communicated accurately as potential risk indicators requiring manual verification—never premature accusations of fraud.',
            },
            {
              title: 'Row-Level Isolated Storage',
              body: 'Designed around PostgreSQL Row Level Security and private per-user storage folders so analysts only access their own records.',
            },
          ].map((point) => (
            <div key={point.title} className="space-y-2.5 border-t border-slate-800 pt-5">
              <div className="flex items-center gap-2 text-cyan-400">
                <CheckCircle2 className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />
                <h3 className="font-display text-base font-semibold text-white">{point.title}</h3>
              </div>
              <p className="text-sm leading-relaxed text-slate-300">{point.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Live Statistics Section (Real DB Data Only) */}
      <section
        id="statistics"
        className="border-t border-slate-800/70 bg-gradient-to-b from-[#080E1D] to-[#060A14]"
      >
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium text-cyan-400">Live Platform Telemetry</p>
              <h2 className="mt-1 font-display text-3xl font-bold tracking-tight text-white">
                Real database verification metrics
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              Counts reflect actual documents stored and analyzed in this instance.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-6 lg:grid-cols-4">
            {[
              {
                label: 'Documents Analyzed',
                value: stats ? stats.totalDocuments : 0,
              },
              {
                label: 'Low-Risk Verified',
                value: stats ? stats.lowRiskCount : 0,
              },
              {
                label: 'Medium / High Risk Flagged',
                value: stats ? stats.mediumRiskCount + stats.highRiskCount : 0,
              },
              {
                label: 'SHA-256 Duplicates Caught',
                value: stats ? stats.duplicatesDetected : 0,
              },
            ].map((metric) => (
              <div
                key={metric.label}
                className="rounded-xl border border-slate-800 bg-[#0B1221]/90 p-6"
              >
                <p className="font-mono text-3xl font-semibold tabular-nums text-white">
                  {metric.value}
                </p>
                <p className="mt-2 text-sm text-slate-400">{metric.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-col items-start justify-between gap-6 rounded-2xl border border-blue-900/40 bg-gradient-to-r from-blue-950/40 via-[#0B1221] to-indigo-950/40 p-8 sm:flex-row sm:items-center">
            <div>
              <h3 className="font-display text-xl font-semibold text-white">
                Ready to verify your invoices and documents?
              </h3>
              <p className="mt-1 text-sm text-slate-300">
                Create an analyst account to upload files, inspect OCR extractions, and generate PDF reports.
              </p>
            </div>
            <Button size="lg" onClick={user ? onGoDashboard : onGoSignup}>
              {user ? 'Open Workspace' : 'Create Free Account'}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </section>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-800/80 bg-[#050811]">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="space-y-1">
            <BrandMark onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />
            <p className="text-xs text-slate-400">
              Nova Squad · AVISHKAR&apos;26 · Cybersecurity, AI &amp; Document Forensics
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-sm text-slate-400">
            <button
              type="button"
              onClick={() => setInfoModal('about')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              About Project
            </button>
            <button
              type="button"
              onClick={() => setInfoModal('contact')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Contact Nova Squad
            </button>
            <button
              type="button"
              onClick={onGoLogin}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Analyst Login
            </button>
          </div>
        </div>
      </footer>

      <Dialog
        open={infoModal !== null}
        onClose={() => setInfoModal(null)}
        title={infoModal === 'about' ? 'About TrustScan AI' : 'Contact Nova Squad'}
        description={
          infoModal === 'about'
            ? 'AVISHKAR’26 Cybersecurity & Document Forensics Submission'
            : 'Reach the project team regarding TrustScan AI'
        }
      >
        {infoModal === 'about' ? (
          <div className="space-y-3 text-sm text-slate-300">
            <p>
              <strong>TrustScan AI</strong> is developed by <strong>Nova Squad</strong> for{' '}
              <strong>AVISHKAR&apos;26</strong> to assist finance and compliance teams in screening
              digital invoices and documents for structural, arithmetic, cryptographic, and
              metadata anomalies.
            </p>
            <p className="text-slate-400">
              All automated indicators are framed strictly as potential risks requiring manual
              auditor verification.
            </p>
          </div>
        ) : (
          <div className="space-y-3 text-sm text-slate-300">
            <div className="flex items-center gap-2.5">
              <Mail className="h-4 w-4 text-cyan-400" aria-hidden="true" />
              <span>novasquad.avishkar26@trustscan-ai.local</span>
            </div>
            <p className="text-slate-400">
              Domain: Cybersecurity, Artificial Intelligence &amp; Document Forensics.
            </p>
          </div>
        )}
      </Dialog>
    </div>
  );
}
