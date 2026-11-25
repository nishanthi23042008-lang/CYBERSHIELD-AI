# TrustScan AI — Digital Document & Invoice Fraud Detection System

**Team:** Nova Squad  
**Event:** AVISHKAR'26  
**Domain:** Cybersecurity, Artificial Intelligence, and Document Forensics

---

## Overview

TrustScan AI is a full-stack document verification and invoice forensics platform engineered to help auditors, finance teams, and security analysts detect suspicious indicators, invoice arithmetic/field anomalies, metadata tampering clues, and exact duplicate submissions across PDF, JPG, JPEG, and PNG documents.

All forensic scores (`0–100`) are computed deterministically from transparent rules and extracted evidence—never simulated or randomized. Findings are framed strictly as potential risk indicators requiring manual verification.

---

## Technology Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, Shadcn-pattern UI components, Recharts, Lucide React, jsPDF
- **Backend:** Express (`server.ts`), Multer, `pdf-parse`, `jpeg-js`, `pngjs`, `exif-parser`, Node `crypto` (SHA-256 & `scrypt`)
- **AI / OCR:** `@google/genai` (`gemini-4-hydrogen`) executed exclusively server-side for multimodal OCR & structured invoice extraction
- **Database, Auth & Storage:**
  - **Supabase Mode:** Supabase PostgreSQL, Supabase Auth, and Supabase Storage (`documents` private bucket) with Row Level Security (`supabase/schema.sql`)
  - **Built-in Local Vault Mode:** Automatic persistent file-backed store (`data/trustscan-db.json` + `data/uploads/`) when Supabase environment variables are not yet configured, enabling instant testing out of the box

---

## Forensic Capabilities & Technical Limitations

1. **OCR & Structured Invoice Parsing:** Extracts full text, invoice number, vendor/company name, invoice date, subtotal, tax/GST amount, GSTIN, and total amount.
2. **Deterministic Rule Engine:** Checks missing critical fields, arithmetic mismatch (`subtotal + tax != total`), GSTIN structural format, future-dated/conflicting timestamps, and unusual outlier totals.
3. **SHA-256 Duplicate Detection:** Computes cryptographic SHA-256 digests of raw uploaded file bytes and checks against prior uploads.
   - *Limitation:* Identical hashes confirm byte-for-byte duplicate files, whereas different hashes do **not** prove two documents are unrelated (re-saving, scanning, or re-exporting changes bytes).
4. **Metadata & Error Level Analysis (ELA):**
   - Inspects PDF `Creator`/`Producer`/`ModDate` and JPEG EXIF `Software`/`ModifyDate` or PNG `tEXt` chunks for editing tool signatures (e.g., Photoshop, Canva, GIMP, ILovePDF).
   - Performs real JPEG Error Level Analysis (recompression at quality 90 + 8×8 block error variance heatmap).
   - *Limitation:* Re-saving through messaging apps, scanners, or lossless PNG conversion alters or discards DCT compression history; ELA anomalies highlight compression differences, not definitive proof of forgery.

---

## Local Setup in VS Code

1. **Install dependencies:**
   ```bash
   npm install
   ```
2. **Configure environment variables:**
   Copy `.env.example` to `.env` and set your keys:
   ```env
   GEMINI_API_KEY="your-gemini-api-key"
   VITE_SUPABASE_URL="https://your-project.supabase.co"
   VITE_SUPABASE_ANON_KEY="your-supabase-anon-key"
   ```
   *(If `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are left blank, TrustScan AI automatically runs with its built-in Express authentication and persistent local storage.)*
3. **Run development server:**
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000`.
4. **Production build & run:**
   ```bash
   npm run build
   npm start
   ```

---

## Supabase Configuration Instructions

1. Create a new project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor** in your Supabase Dashboard and execute the full contents of [`supabase/schema.sql`](supabase/schema.sql). This creates:
   - `profiles`, `documents`, `analysis_results`, `invoice_details`, and `duplicate_checks` tables
   - Foreign keys, indexes, and automatic profile signup trigger
   - Strict Row Level Security (RLS) policies ensuring users can only access their own records
   - Private `documents` Storage bucket with per-user folder policies
3. Copy your **Project URL** and **Anon Public Key** from **Settings → API** into `.env` (`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`).
4. Never expose your `service_role` key in frontend code (`VITE_*`).
