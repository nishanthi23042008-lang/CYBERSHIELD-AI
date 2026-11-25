import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import {
  analyzeDocumentBuffer,
  computeSha256,
  evaluateRuleBasedRisk,
  validateMagicBytes,
} from './server/forensics.ts';
import {
  createSessionToken,
  createUser,
  deleteUserDocument,
  findUserByEmail,
  findUserById,
  getPublicStats,
  getUserDocumentBundle,
  getUserDocumentsByHash,
  insertDocumentBundle,
  listUserDocumentBundles,
  resolveStoredFilePath,
  sanitizeUser,
  saveUploadedFile,
  updateDocumentAnalysisAndInvoice,
  updateUserPassword,
  updateUserProfile,
  verifyPassword,
  verifySessionToken,
} from './server/store.ts';
import type {
  AnalysisResultRecord,
  DocumentRecord,
  DuplicateCheckRecord,
  FullDocumentBundle,
  InvoiceDetailsRecord,
  UserProfile,
} from './src/types/forensics.ts';

interface AuthenticatedRequest extends Request {
  authUser?: UserProfile;
}

const PORT = 3000;
const SESSION_COOKIE_NAME = 'trustscan_session';
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype.toLowerCase())) {
      cb(new Error('Unsupported file type. Only PDF, JPG, JPEG, and PNG files are allowed.'));
      return;
    }
    cb(null, true);
  },
});

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0) {
      const k = part.slice(0, eq).trim();
      const v = decodeURIComponent(part.slice(eq + 1).trim());
      cookies[k] = v;
    }
  }
  return cookies;
}

function setSessionCookie(req: Request, res: Response, token: string): void {
  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${7 * 24 * 60 * 60}`,
  ];
  if (isSecure) {
    parts.push('Secure', 'SameSite=None', 'Partitioned');
  } else {
    parts.push('SameSite=Lax');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(req: Request, res: Response): void {
  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const parts = [`${SESSION_COOKIE_NAME}=`, 'Path=/', 'HttpOnly', 'Max-Age=0'];
  if (isSecure) {
    parts.push('Secure', 'SameSite=None', 'Partitioned');
  } else {
    parts.push('SameSite=Lax');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

function verifyMutationOrigin(req: Request, res: Response, next: NextFunction): void {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    next();
    return;
  }
  // If using explicit Bearer header (not cookie-only), CSRF is not applicable
  if (req.headers.authorization?.startsWith('Bearer ')) {
    next();
    return;
  }
  const origin = req.headers.origin;
  const host = (req.headers['x-forwarded-host'] as string | undefined) || req.headers.host;
  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost !== host) {
        res.status(403).json({ error: 'Cross-origin request rejected.' });
        return;
      }
    } catch {
      res.status(403).json({ error: 'Invalid request origin.' });
      return;
    }
  } else if (req.headers['x-requested-with'] !== 'TrustScan-Client') {
    res.status(403).json({ error: 'Missing request verification header.' });
    return;
  }
  next();
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  let token: string | undefined;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else {
    const cookies = parseCookies(req.headers.cookie);
    token = cookies[SESSION_COOKIE_NAME];
  }

  if (!token) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }

  const userId = verifySessionToken(token);
  if (!userId) {
    res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
    return;
  }

  const user = findUserById(userId);
  if (!user) {
    res.status(401).json({ error: 'User account not found.' });
    return;
  }

  req.authUser = sanitizeUser(user);
  next();
}

async function startServer(): Promise<void> {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '2mb' }));

  // =========================================================================
  // PUBLIC TELEMETRY STATS (REAL DATABASE COUNTS ONLY)
  // =========================================================================
  app.get('/api/public-stats', (_req, res) => {
    res.json(getPublicStats());
  });

  app.get('/api/health', (_req, res) => {
    const hasGemini = Boolean(
      process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
    );
    const hasSupabase = Boolean(
      process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY
    );
    res.json({
      status: 'ok',
      ocrConfigured: hasGemini,
      supabaseConfigured: hasSupabase,
    });
  });

  // =========================================================================
  // AUTHENTICATION ROUTES (Built-in Local Vault Auth)
  // =========================================================================
  app.post('/api/auth/signup', verifyMutationOrigin, (req, res) => {
    try {
      const { fullName, email, password } = req.body as {
        fullName?: string;
        email?: string;
        password?: string;
      };

      if (!fullName || fullName.trim().length < 2) {
        res.status(400).json({ error: 'Full name must be at least 2 characters.' });
        return;
      }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        res.status(400).json({ error: 'Please provide a valid email address.' });
        return;
      }
      if (!password || password.length < 8) {
        res.status(400).json({ error: 'Password must be at least 8 characters long.' });
        return;
      }

      const user = createUser(fullName, email, password);
      const token = createSessionToken(user.id);
      setSessionCookie(req, res, token);
      res.status(201).json({ user, token });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to create account.';
      res.status(400).json({ error: message });
    }
  });

  app.post('/api/auth/login', verifyMutationOrigin, (req, res) => {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const user = findUserByEmail(email);
    if (!user || !verifyPassword(password, user.password_hash)) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const sanitized = sanitizeUser(user);
    const token = createSessionToken(user.id);
    setSessionCookie(req, res, token);
    res.json({ user: sanitized, token });
  });

  app.post('/api/auth/logout', verifyMutationOrigin, (req, res) => {
    clearSessionCookie(req, res);
    res.json({ ok: true });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
    res.json({ user: req.authUser });
  });

  app.patch('/api/auth/profile', verifyMutationOrigin, requireAuth, (req: AuthenticatedRequest, res) => {
    const { fullName } = req.body as { fullName?: string };
    if (!fullName || fullName.trim().length < 2) {
      res.status(400).json({ error: 'Full name must be at least 2 characters.' });
      return;
    }
    const updated = updateUserProfile(req.authUser!.id, fullName);
    if (!updated) {
      res.status(404).json({ error: 'User profile not found.' });
      return;
    }
    res.json({ user: updated });
  });

  app.post('/api/auth/change-password', verifyMutationOrigin, requireAuth, (req: AuthenticatedRequest, res) => {
    const { currentPassword, newPassword } = req.body as {
      currentPassword?: string;
      newPassword?: string;
    };
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'Current and new passwords are required.' });
      return;
    }
    if (newPassword.length < 8) {
      res.status(400).json({ error: 'New password must be at least 8 characters.' });
      return;
    }
    const stored = findUserById(req.authUser!.id);
    if (!stored || !verifyPassword(currentPassword, stored.password_hash)) {
      res.status(401).json({ error: 'Current password is incorrect.' });
      return;
    }
    updateUserPassword(req.authUser!.id, newPassword);
    res.json({ ok: true, message: 'Password updated successfully.' });
  });

  // =========================================================================
  // SERVER-SIDE FORENSICS ENDPOINT (for Supabase Mode or Pre-Check)
  // =========================================================================
  app.post(
    '/api/forensics/analyze-only',
    upload.single('file'),
    async (req: Request, res: Response) => {
      try {
        // Verify caller has either local session OR Supabase Bearer token
        const authHeader = req.headers.authorization;
        const cookies = parseCookies(req.headers.cookie);
        if (!authHeader?.startsWith('Bearer ') && !cookies[SESSION_COOKIE_NAME]) {
          res.status(401).json({ error: 'Authentication required for forensic processing.' });
          return;
        }
        if (!req.file) {
          res.status(400).json({ error: 'No file provided for analysis.' });
          return;
        }

        const mimeType = req.file.mimetype.toLowerCase();
        if (!validateMagicBytes(req.file.buffer, mimeType)) {
          res.status(400).json({
            error: 'File content signature does not match declared file type (PDF, JPG, or PNG).',
          });
          return;
        }

        let priorMatches: DocumentRecord[] = [];
        if (typeof req.body?.existingMatches === 'string') {
          try {
            const parsed = JSON.parse(req.body.existingMatches);
            if (Array.isArray(parsed)) priorMatches = parsed;
          } catch {
            priorMatches = [];
          }
        }

        const analysisOutput = await analyzeDocumentBuffer({
          buffer: req.file.buffer,
          fileName: req.file.originalname,
          mimeType,
          duplicateMatches: priorMatches,
        });

        res.json(analysisOutput);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Document analysis failed.';
        res.status(500).json({ error: message });
      }
    }
  );

  // =========================================================================
  // DOCUMENT UPLOAD, ANALYSIS, VERIFICATION, DUPLICATES & HISTORY
  // =========================================================================
  app.post(
    '/api/documents/upload',
    verifyMutationOrigin,
    requireAuth,
    upload.single('file'),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        if (!req.file) {
          res.status(400).json({ error: 'Please select a PDF, JPG, JPEG, or PNG document to upload.' });
          return;
        }

        const mimeType = req.file.mimetype.toLowerCase();
        if (!validateMagicBytes(req.file.buffer, mimeType)) {
          res.status(400).json({
            error:
              'File signature verification failed. The uploaded file bytes do not match a valid PDF, JPEG, or PNG header.',
          });
          return;
        }

        const userId = req.authUser!.id;
        const sha256 = computeSha256(req.file.buffer);
        const duplicateMatches = getUserDocumentsByHash(userId, sha256);

        const storagePath = saveUploadedFile(userId, req.file.originalname, req.file.buffer);
        const nowIso = new Date().toISOString();
        const documentId = crypto.randomUUID();

        const analysisOutput = await analyzeDocumentBuffer({
          buffer: req.file.buffer,
          fileName: req.file.originalname,
          mimeType,
          duplicateMatches,
        });

        const docRecord: DocumentRecord = {
          id: documentId,
          user_id: userId,
          file_name: path.basename(req.file.originalname),
          file_type: mimeType,
          file_size: req.file.size,
          storage_path: storagePath,
          file_hash: sha256,
          uploaded_at: nowIso,
        };

        const analysisRecord: AnalysisResultRecord = {
          id: crypto.randomUUID(),
          document_id: documentId,
          user_id: userId,
          risk_score: analysisOutput.riskScore,
          risk_level: analysisOutput.riskLevel,
          extracted_text: analysisOutput.extractedText,
          detected_indicators: analysisOutput.detectedIndicators,
          metadata_summary: analysisOutput.metadataSummary,
          confidence_notes: analysisOutput.confidenceNotes,
          ela_preview_data_url: analysisOutput.elaPreviewDataUrl,
          analysis_status: 'completed',
          created_at: nowIso,
        };

        const invoiceRecord: InvoiceDetailsRecord = {
          id: crypto.randomUUID(),
          document_id: documentId,
          invoice_number: analysisOutput.invoice.invoiceNumber,
          company_name: analysisOutput.invoice.companyName,
          invoice_date: analysisOutput.invoice.invoiceDate,
          subtotal_amount: analysisOutput.invoice.subtotalAmount,
          total_amount: analysisOutput.invoice.totalAmount,
          gst_number: analysisOutput.invoice.gstNumber,
          tax_amount: analysisOutput.invoice.taxAmount,
          currency: analysisOutput.invoice.currency,
          tax_details: analysisOutput.invoice.taxDetails,
          verification_notes: null,
          created_at: nowIso,
        };

        const duplicateChecks: DuplicateCheckRecord[] =
          duplicateMatches.length > 0
            ? duplicateMatches.map((match) => ({
                id: crypto.randomUUID(),
                document_id: documentId,
                matched_document_id: match.id,
                match_type: 'EXACT_SHA256_MATCH',
                matched_file_name: match.file_name,
                matched_uploaded_at: match.uploaded_at,
                created_at: nowIso,
              }))
            : [
                {
                  id: crypto.randomUUID(),
                  document_id: documentId,
                  matched_document_id: null,
                  match_type: 'NO_DUPLICATE',
                  matched_file_name: null,
                  matched_uploaded_at: null,
                  created_at: nowIso,
                },
              ];

        const bundle: FullDocumentBundle = {
          document: docRecord,
          analysis: analysisRecord,
          invoice: invoiceRecord,
          duplicateChecks,
        };

        insertDocumentBundle(bundle);
        res.status(201).json(bundle);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Document processing failed.';
        res.status(500).json({ error: message });
      }
    }
  );

  app.post(
    '/api/documents/hash-check',
    verifyMutationOrigin,
    requireAuth,
    upload.single('file'),
    (req: AuthenticatedRequest, res: Response) => {
      if (!req.file) {
        res.status(400).json({ error: 'Please select a file to compute its SHA-256 hash.' });
        return;
      }
      const sha256 = computeSha256(req.file.buffer);
      const matches = getUserDocumentsByHash(req.authUser!.id, sha256);
      res.json({
        fileName: req.file.originalname,
        fileSize: req.file.size,
        sha256,
        matchType: matches.length > 0 ? 'EXACT_SHA256_MATCH' : 'NO_DUPLICATE',
        matches,
      });
    }
  );

  app.get('/api/documents', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const bundles = listUserDocumentBundles(req.authUser!.id);
    res.json({ documents: bundles });
  });

  app.get('/api/documents/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const bundle = getUserDocumentBundle(req.authUser!.id, String(req.params.id));
    if (!bundle) {
      res.status(404).json({ error: 'Document not found.' });
      return;
    }
    res.json(bundle);
  });

  app.get('/api/documents/:id/file', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const bundle = getUserDocumentBundle(req.authUser!.id, String(req.params.id));
    if (!bundle) {
      res.status(404).json({ error: 'Document not found.' });
      return;
    }
    const resolvedPath = resolveStoredFilePath(bundle.document.storage_path);
    if (!resolvedPath) {
      res.status(404).json({ error: 'Stored document file is unavailable.' });
      return;
    }
    res.setHeader('Content-Type', bundle.document.file_type);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${bundle.document.file_name.replace(/[^a-zA-Z0-9._-]/g, '_')}"`
    );
    fs.createReadStream(resolvedPath).pipe(res);
  });

  app.patch(
    '/api/documents/:id/invoice',
    verifyMutationOrigin,
    requireAuth,
    (req: AuthenticatedRequest, res: Response) => {
      const existing = getUserDocumentBundle(req.authUser!.id, String(req.params.id));
      if (!existing) {
        res.status(404).json({ error: 'Document not found.' });
        return;
      }

      const body = req.body as {
        invoice_number?: string | null;
        company_name?: string | null;
        invoice_date?: string | null;
        subtotal_amount?: number | null;
        tax_amount?: number | null;
        total_amount?: number | null;
        gst_number?: string | null;
        currency?: string;
        tax_details?: string | null;
        verification_notes?: string | null;
      };

      const updatedInvoicePayload = {
        invoiceNumber:
          body.invoice_number !== undefined
            ? body.invoice_number?.trim() || null
            : existing.invoice.invoice_number,
        companyName:
          body.company_name !== undefined
            ? body.company_name?.trim() || null
            : existing.invoice.company_name,
        invoiceDate:
          body.invoice_date !== undefined
            ? body.invoice_date?.trim() || null
            : existing.invoice.invoice_date,
        subtotalAmount:
          body.subtotal_amount !== undefined
            ? body.subtotal_amount
            : existing.invoice.subtotal_amount,
        taxAmount:
          body.tax_amount !== undefined ? body.tax_amount : existing.invoice.tax_amount,
        totalAmount:
          body.total_amount !== undefined ? body.total_amount : existing.invoice.total_amount,
        gstNumber:
          body.gst_number !== undefined
            ? body.gst_number?.trim().toUpperCase() || null
            : existing.invoice.gst_number,
        currency: body.currency?.trim().toUpperCase() || existing.invoice.currency || 'INR',
        taxDetails:
          body.tax_details !== undefined
            ? body.tax_details?.trim() || null
            : existing.invoice.tax_details,
        textAnomaliesFromOcr: [],
      };

      const duplicateMatches = getUserDocumentsByHash(
        req.authUser!.id,
        existing.document.file_hash
      ).filter((d) => d.id !== existing.document.id && new Date(d.uploaded_at) <= new Date(existing.document.uploaded_at));

      const reEvaluated = evaluateRuleBasedRisk({
        invoice: updatedInvoicePayload,
        extractedText: existing.analysis.extracted_text,
        metadataSummary: existing.analysis.metadata_summary,
        duplicateMatches,
      });

      const updated = updateDocumentAnalysisAndInvoice(req.authUser!.id, existing.document.id, {
        invoice: {
          invoice_number: updatedInvoicePayload.invoiceNumber,
          company_name: updatedInvoicePayload.companyName,
          invoice_date: updatedInvoicePayload.invoiceDate,
          subtotal_amount: updatedInvoicePayload.subtotalAmount,
          tax_amount: updatedInvoicePayload.taxAmount,
          total_amount: updatedInvoicePayload.totalAmount,
          gst_number: updatedInvoicePayload.gstNumber,
          currency: updatedInvoicePayload.currency,
          tax_details: updatedInvoicePayload.taxDetails,
          verification_notes:
            body.verification_notes !== undefined
              ? body.verification_notes?.trim() || null
              : existing.invoice.verification_notes,
        },
        analysis: {
          detected_indicators: reEvaluated.detectedIndicators,
          risk_score: reEvaluated.riskScore,
          risk_level: reEvaluated.riskLevel,
        },
      });

      res.json(updated);
    }
  );

  app.delete(
    '/api/documents/:id',
    verifyMutationOrigin,
    requireAuth,
    (req: AuthenticatedRequest, res: Response) => {
      const deleted = deleteUserDocument(req.authUser!.id, String(req.params.id));
      if (!deleted) {
        res.status(404).json({ error: 'Document not found.' });
        return;
      }
      res.json({ ok: true });
    }
  );

  // Multer & API error handler
  app.use((err: Error, _req: Request, res: Response, next: NextFunction) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({ error: 'File size exceeds the 10 MB limit.' });
        return;
      }
      res.status(400).json({ error: err.message });
      return;
    }
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    next();
  });

  // =========================================================================
  // VITE DEV MIDDLEWARE / PRODUCTION STATIC FILES
  // =========================================================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TrustScan AI server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start TrustScan AI server:', err);
  process.exit(1);
});
