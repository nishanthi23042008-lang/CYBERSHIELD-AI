import type {
  AnalysisResultRecord,
  DocumentRecord,
  DuplicateCheckRecord,
  FullDocumentBundle,
  InvoiceDetailsRecord,
  PublicStats,
  UserProfile,
} from '../types/forensics';
import { isSupabaseConfigured, supabase } from './supabaseClient';
import { computeClientSha256 } from './utils';

// In-memory session token (never persisted to localStorage/sessionStorage)
let inMemoryBearerToken: string | null = null;

function buildHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    'X-Requested-With': 'TrustScan-Client',
    ...extra,
  };
  if (inMemoryBearerToken) {
    headers.Authorization = `Bearer ${inMemoryBearerToken}`;
  }
  return headers;
}

async function parseJsonOrThrow<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: unknown = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(res.statusText || 'Unexpected server response.');
    }
  }
  if (!res.ok) {
    const errMsg =
      typeof data === 'object' && data !== null && 'error' in data
        ? String((data as { error: unknown }).error)
        : `Request failed (${res.status})`;
    throw new Error(errMsg);
  }
  return data as T;
}

export const dataService = {
  getBackendMode(): 'supabase' | 'local-vault' {
    return isSupabaseConfigured ? 'supabase' : 'local-vault';
  },

  async fetchPublicStats(): Promise<PublicStats> {
    if (isSupabaseConfigured && supabase) {
      // Query public aggregate counts if permitted; fallback to server public-stats endpoint
      try {
        const res = await fetch('/api/public-stats');
        if (res.ok) return (await res.json()) as PublicStats;
      } catch {
        // ignore
      }
    }
    const res = await fetch('/api/public-stats');
    return parseJsonOrThrow<PublicStats>(res);
  },

  async getCurrentUser(): Promise<UserProfile | null> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) return null;
      const session = await supabase.auth.getSession();
      inMemoryBearerToken = session.data.session?.access_token ?? null;
      return {
        id: data.user.id,
        email: data.user.email || '',
        full_name:
          (data.user.user_metadata?.full_name as string | undefined) ||
          data.user.email?.split('@')[0] ||
          'User',
        created_at: data.user.created_at,
      };
    }

    const res = await fetch('/api/auth/me', {
      credentials: 'include',
      headers: buildHeaders(),
    });
    if (res.status === 401) return null;
    const data = await parseJsonOrThrow<{ user: UserProfile }>(res);
    return data.user;
  },

  async signup(fullName: string, email: string, password: string): Promise<{
    user: UserProfile | null;
    confirmationRequired?: boolean;
  }> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: fullName.trim() },
        },
      });
      if (error) throw new Error(error.message);
      if (data.session) {
        inMemoryBearerToken = data.session.access_token;
      }
      if (!data.user) return { user: null, confirmationRequired: true };
      return {
        user: data.session
          ? {
              id: data.user.id,
              email: data.user.email || email,
              full_name: fullName.trim(),
              created_at: data.user.created_at,
            }
          : null,
        confirmationRequired: !data.session,
      };
    }

    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      credentials: 'include',
      headers: buildHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ fullName, email, password }),
    });
    const data = await parseJsonOrThrow<{ user: UserProfile; token: string }>(res);
    inMemoryBearerToken = data.token;
    return { user: data.user };
  },

  async login(email: string, password: string): Promise<UserProfile> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error || !data.user) {
        throw new Error(error?.message || 'Invalid email or password.');
      }
      inMemoryBearerToken = data.session?.access_token ?? null;
      return {
        id: data.user.id,
        email: data.user.email || email,
        full_name:
          (data.user.user_metadata?.full_name as string | undefined) ||
          data.user.email?.split('@')[0] ||
          'User',
        created_at: data.user.created_at,
      };
    }

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: buildHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ email, password }),
    });
    const data = await parseJsonOrThrow<{ user: UserProfile; token: string }>(res);
    inMemoryBearerToken = data.token;
    return data.user;
  },

  async logout(): Promise<void> {
    inMemoryBearerToken = null;
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
      return;
    }
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: buildHeaders(),
    });
  },

  async requestPasswordReset(email: string): Promise<string> {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/settings`,
      });
      if (error) throw new Error(error.message);
      return 'Password reset instructions have been sent to your email via Supabase Auth.';
    }
    return 'In Built-in Local Vault mode, update your password anytime from Account Settings once signed in. Configure VITE_SUPABASE_URL to enable email reset links.';
  },

  async updateProfile(fullName: string): Promise<UserProfile> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.updateUser({
        data: { full_name: fullName.trim() },
      });
      if (error || !data.user) throw new Error(error?.message || 'Unable to update profile.');
      await supabase.from('profiles').update({ full_name: fullName.trim() }).eq('id', data.user.id);
      return {
        id: data.user.id,
        email: data.user.email || '',
        full_name: fullName.trim(),
        created_at: data.user.created_at,
      };
    }

    const res = await fetch('/api/auth/profile', {
      method: 'PATCH',
      credentials: 'include',
      headers: buildHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ fullName }),
    });
    const data = await parseJsonOrThrow<{ user: UserProfile }>(res);
    return data.user;
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<string> {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw new Error(error.message);
      return 'Password updated via Supabase Auth.';
    }

    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      credentials: 'include',
      headers: buildHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await parseJsonOrThrow<{ message: string }>(res);
    return data.message;
  },

  async listDocuments(): Promise<FullDocumentBundle[]> {
    if (isSupabaseConfigured && supabase) {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return [];
      const { data: docs, error: docErr } = await supabase
        .from('documents')
        .select('*')
        .order('uploaded_at', { ascending: false });
      if (docErr) throw new Error(docErr.message);
      if (!docs || docs.length === 0) return [];

      const docIds = docs.map((d: DocumentRecord) => d.id);
      const [{ data: analyses }, { data: invoices }, { data: duplicates }] = await Promise.all([
        supabase.from('analysis_results').select('*').in('document_id', docIds),
        supabase.from('invoice_details').select('*').in('document_id', docIds),
        supabase.from('duplicate_checks').select('*').in('document_id', docIds),
      ]);

      const bundles: FullDocumentBundle[] = [];
      for (const doc of docs as DocumentRecord[]) {
        const analysis = (analyses as AnalysisResultRecord[] | null)?.find(
          (a) => a.document_id === doc.id
        );
        const invoice = (invoices as InvoiceDetailsRecord[] | null)?.find(
          (i) => i.document_id === doc.id
        );
        const dupChecks: DuplicateCheckRecord[] = ((duplicates as DuplicateCheckRecord[] | null) || [])
          .filter((dc) => dc.document_id === doc.id)
          .map((dc): DuplicateCheckRecord => {
            const matched = dc.matched_document_id
              ? (docs as DocumentRecord[]).find((d) => d.id === dc.matched_document_id)
              : undefined;
            return {
              ...dc,
              matched_file_name: matched?.file_name ?? null,
              matched_uploaded_at: matched?.uploaded_at ?? null,
            };
          });
        if (analysis && invoice) {
          bundles.push({ document: doc, analysis, invoice, duplicateChecks: dupChecks });
        }
      }
      return bundles;
    }

    const res = await fetch('/api/documents', {
      credentials: 'include',
      headers: buildHeaders(),
    });
    const data = await parseJsonOrThrow<{ documents: FullDocumentBundle[] }>(res);
    return data.documents;
  },

  async uploadAndAnalyzeDocument(
    file: File,
    onProgress?: (percent: number, stage: string) => void
  ): Promise<FullDocumentBundle> {
    if (isSupabaseConfigured && supabase) {
      const { data: authData } = await supabase.auth.getUser();
      const { data: sessionData } = await supabase.auth.getSession();
      if (!authData.user || !sessionData.session) {
        throw new Error('Please sign in before uploading documents.');
      }
      inMemoryBearerToken = sessionData.session.access_token;

      onProgress?.(20, 'Computing SHA-256 digest and checking duplicates...');
      const sha256 = await computeClientSha256(file);
      const { data: existingMatches } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', authData.user.id)
        .eq('file_hash', sha256);

      onProgress?.(45, 'Uploading encrypted file to Supabase Storage...');
      const storagePath = `${authData.user.id}/${crypto.randomUUID()}-${file.name.replace(
        /[^a-zA-Z0-9._-]/g,
        '_'
      )}`;
      const { error: uploadErr } = await supabase.storage
        .from('documents')
        .upload(storagePath, file, { contentType: file.type, upsert: false });
      if (uploadErr) throw new Error(uploadErr.message);

      onProgress?.(70, 'Running OCR, metadata inspection & ELA forensics...');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('existingMatches', JSON.stringify(existingMatches || []));

      const analyzeRes = await fetch('/api/forensics/analyze-only', {
        method: 'POST',
        headers: buildHeaders(),
        body: formData,
      });
      const output = await parseJsonOrThrow<{
        sha256: string;
        extractedText: string;
        invoice: {
          invoiceNumber: string | null;
          companyName: string | null;
          invoiceDate: string | null;
          subtotalAmount: number | null;
          taxAmount: number | null;
          totalAmount: number | null;
          gstNumber: string | null;
          currency: string;
          taxDetails: string | null;
        };
        metadataSummary: AnalysisResultRecord['metadata_summary'];
        elaPreviewDataUrl: string | null;
        detectedIndicators: AnalysisResultRecord['detected_indicators'];
        riskScore: number;
        riskLevel: AnalysisResultRecord['risk_level'];
        confidenceNotes: AnalysisResultRecord['confidence_notes'];
      }>(analyzeRes);

      onProgress?.(90, 'Saving forensic records to Supabase PostgreSQL...');
      const { data: docRow, error: docInsertErr } = await supabase
        .from('documents')
        .insert({
          user_id: authData.user.id,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          storage_path: storagePath,
          file_hash: output.sha256,
        })
        .select('*')
        .single();
      if (docInsertErr || !docRow) throw new Error(docInsertErr?.message || 'Failed saving document.');

      const { data: analysisRow, error: analysisErr } = await supabase
        .from('analysis_results')
        .insert({
          document_id: docRow.id,
          user_id: authData.user.id,
          risk_score: output.riskScore,
          risk_level: output.riskLevel,
          extracted_text: output.extractedText,
          detected_indicators: output.detectedIndicators,
          metadata_summary: output.metadataSummary,
          confidence_notes: output.confidenceNotes,
          ela_preview_data_url: output.elaPreviewDataUrl,
          analysis_status: 'completed',
        })
        .select('*')
        .single();
      if (analysisErr || !analysisRow) throw new Error(analysisErr?.message || 'Failed saving analysis.');

      const { data: invoiceRow, error: invErr } = await supabase
        .from('invoice_details')
        .insert({
          document_id: docRow.id,
          invoice_number: output.invoice.invoiceNumber,
          company_name: output.invoice.companyName,
          invoice_date: output.invoice.invoiceDate,
          subtotal_amount: output.invoice.subtotalAmount,
          total_amount: output.invoice.totalAmount,
          gst_number: output.invoice.gstNumber,
          tax_amount: output.invoice.taxAmount,
          currency: output.invoice.currency,
          tax_details: output.invoice.taxDetails,
        })
        .select('*')
        .single();
      if (invErr || !invoiceRow) throw new Error(invErr?.message || 'Failed saving invoice.');

      const dupRowsPayload: Array<{
        document_id: string;
        matched_document_id: string | null;
        match_type: string;
      }> =
        existingMatches && existingMatches.length > 0
          ? (existingMatches as DocumentRecord[]).map((m) => ({
              document_id: docRow.id as string,
              matched_document_id: m.id,
              match_type: 'EXACT_SHA256_MATCH',
            }))
          : [
              {
                document_id: docRow.id as string,
                matched_document_id: null,
                match_type: 'NO_DUPLICATE',
              },
            ];

      const { data: dupRows } = await supabase
        .from('duplicate_checks')
        .insert(dupRowsPayload)
        .select('*');

      onProgress?.(100, 'Analysis complete');
      return {
        document: docRow as DocumentRecord,
        analysis: analysisRow as AnalysisResultRecord,
        invoice: invoiceRow as InvoiceDetailsRecord,
        duplicateChecks: (dupRows as DuplicateCheckRecord[]) || [],
      };
    }

    // Built-in Local Express Vault using XMLHttpRequest for real upload progress
    onProgress?.(10, 'Uploading document securely...');
    const formData = new FormData();
    formData.append('file', file);

    return new Promise<FullDocumentBundle>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/documents/upload');
      xhr.withCredentials = true;
      xhr.setRequestHeader('X-Requested-With', 'TrustScan-Client');
      if (inMemoryBearerToken) {
        xhr.setRequestHeader('Authorization', `Bearer ${inMemoryBearerToken}`);
      }

      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) {
          const uploadPct = Math.round((ev.loaded / ev.total) * 45) + 10;
          onProgress?.(Math.min(55, uploadPct), 'Transferring file bytes...');
        }
      };

      xhr.upload.onload = () => {
        onProgress?.(68, 'Extracting OCR text, metadata, SHA-256 & ELA...');
      };

      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText || '{}');
          if (xhr.status >= 200 && xhr.status < 300) {
            onProgress?.(100, 'Analysis complete');
            resolve(data as FullDocumentBundle);
          } else {
            reject(new Error(data.error || `Upload failed (${xhr.status})`));
          }
        } catch {
          reject(new Error('Failed to parse server response.'));
        }
      };

      xhr.onerror = () => reject(new Error('Network error during document upload.'));
      xhr.send(formData);
    });
  },

  async checkHashDuplicate(file: File): Promise<{
    fileName: string;
    fileSize: number;
    sha256: string;
    matchType: 'NO_DUPLICATE' | 'EXACT_SHA256_MATCH';
    matches: DocumentRecord[];
  }> {
    if (isSupabaseConfigured && supabase) {
      const sha256 = await computeClientSha256(file);
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error('Authentication required.');
      const { data: matches, error } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', auth.user.id)
        .eq('file_hash', sha256);
      if (error) throw new Error(error.message);
      const list = (matches as DocumentRecord[]) || [];
      return {
        fileName: file.name,
        fileSize: file.size,
        sha256,
        matchType: list.length > 0 ? 'EXACT_SHA256_MATCH' : 'NO_DUPLICATE',
        matches: list,
      };
    }

    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/documents/hash-check', {
      method: 'POST',
      credentials: 'include',
      headers: buildHeaders(),
      body: formData,
    });
    return parseJsonOrThrow(res);
  },

  async getDocumentPreviewUrl(doc: DocumentRecord): Promise<string | null> {
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase.storage
        .from('documents')
        .createSignedUrl(doc.storage_path, 3600);
      return data?.signedUrl ?? null;
    }
    const res = await fetch(`/api/documents/${encodeURIComponent(doc.id)}/file`, {
      credentials: 'include',
      headers: buildHeaders(),
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },

  async updateInvoiceDetails(
    documentId: string,
    payload: Partial<InvoiceDetailsRecord>
  ): Promise<FullDocumentBundle> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('invoice_details')
        .update(payload)
        .eq('document_id', documentId)
        .select('*')
        .single();
      if (error || !data) throw new Error(error?.message || 'Unable to update invoice details.');
      const all = await this.listDocuments();
      const found = all.find((b) => b.document.id === documentId);
      if (!found) throw new Error('Document not found.');
      return found;
    }

    const res = await fetch(`/api/documents/${encodeURIComponent(documentId)}/invoice`, {
      method: 'PATCH',
      credentials: 'include',
      headers: buildHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    });
    return parseJsonOrThrow<FullDocumentBundle>(res);
  },

  async deleteDocument(doc: DocumentRecord): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      await supabase.storage.from('documents').remove([doc.storage_path]);
      const { error } = await supabase.from('documents').delete().eq('id', doc.id);
      if (error) throw new Error(error.message);
      return;
    }

    const res = await fetch(`/api/documents/${encodeURIComponent(doc.id)}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: buildHeaders(),
    });
    await parseJsonOrThrow<{ ok: boolean }>(res);
  },
};
