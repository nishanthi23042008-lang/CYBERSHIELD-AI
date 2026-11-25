-- TrustScan AI — Supabase PostgreSQL Schema & Row Level Security
-- Project: Digital Document & Invoice Fraud Detection System
-- Team: Nova Squad | Event: AVISHKAR'26

-- Enable UUID generation extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. User Profiles Table (linked to Supabase Auth users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Automatically create profile row on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Documents Table
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL CHECK (file_size > 0),
  storage_path TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_file_hash ON public.documents(user_id, file_hash);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_at ON public.documents(uploaded_at DESC);

-- 3. Analysis Results Table
CREATE TABLE IF NOT EXISTS public.analysis_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  risk_score INTEGER NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('LOW RISK', 'MEDIUM RISK', 'HIGH RISK')),
  extracted_text TEXT NOT NULL DEFAULT '',
  detected_indicators JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence_notes JSONB NOT NULL DEFAULT '{}'::jsonb,
  ela_preview_data_url TEXT,
  analysis_status TEXT NOT NULL DEFAULT 'completed' CHECK (analysis_status IN ('pending', 'processing', 'completed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analysis_results_user_id ON public.analysis_results(user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_results_document_id ON public.analysis_results(document_id);
CREATE INDEX IF NOT EXISTS idx_analysis_results_risk_level ON public.analysis_results(risk_level);

-- 4. Invoice Details Table
CREATE TABLE IF NOT EXISTS public.invoice_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  invoice_number TEXT,
  company_name TEXT,
  invoice_date TEXT,
  subtotal_amount NUMERIC(14, 2),
  total_amount NUMERIC(14, 2),
  gst_number TEXT,
  tax_amount NUMERIC(14, 2),
  currency TEXT DEFAULT 'INR',
  tax_details TEXT,
  verification_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_details_document_id ON public.invoice_details(document_id);

-- 5. Duplicate Checks Table
CREATE TABLE IF NOT EXISTS public.duplicate_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  matched_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  match_type TEXT NOT NULL CHECK (match_type IN ('NO_DUPLICATE', 'EXACT_SHA256_MATCH')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_duplicate_checks_document_id ON public.duplicate_checks(document_id);
CREATE INDEX IF NOT EXISTS idx_duplicate_checks_matched_id ON public.duplicate_checks(matched_document_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duplicate_checks ENABLE ROW LEVEL SECURITY;

-- Profiles: users can view and update only their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Documents: users can CRUD only their own documents
CREATE POLICY "Users can view own documents"
  ON public.documents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own documents"
  ON public.documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own documents"
  ON public.documents FOR DELETE
  USING (auth.uid() = user_id);

-- Analysis Results: users can CRUD only their own analysis records
CREATE POLICY "Users can view own analysis results"
  ON public.analysis_results FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own analysis results"
  ON public.analysis_results FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own analysis results"
  ON public.analysis_results FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own analysis results"
  ON public.analysis_results FOR DELETE
  USING (auth.uid() = user_id);

-- Invoice Details: access controlled via parent document ownership
CREATE POLICY "Users can view own invoice details"
  ON public.invoice_details FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = invoice_details.document_id AND d.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own invoice details"
  ON public.invoice_details FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = invoice_details.document_id AND d.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own invoice details"
  ON public.invoice_details FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = invoice_details.document_id AND d.user_id = auth.uid()
    )
  );

-- Duplicate Checks: access controlled via parent document ownership
CREATE POLICY "Users can view own duplicate checks"
  ON public.duplicate_checks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = duplicate_checks.document_id AND d.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own duplicate checks"
  ON public.duplicate_checks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = duplicate_checks.document_id AND d.user_id = auth.uid()
    )
  );

-- ============================================================================
-- SUPABASE STORAGE BUCKET & POLICIES
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  10485760, -- 10 MB
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload to own folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can read own folder"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete from own folder"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
