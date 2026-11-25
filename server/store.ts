import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type {
  AnalysisResultRecord,
  DocumentRecord,
  DuplicateCheckRecord,
  FullDocumentBundle,
  InvoiceDetailsRecord,
  PublicStats,
  UserProfile,
} from '../src/types/forensics.ts';

interface StoredUser extends UserProfile {
  password_hash: string;
}

interface DatabaseSchema {
  users: StoredUser[];
  documents: DocumentRecord[];
  analysis_results: AnalysisResultRecord[];
  invoice_details: InvoiceDetailsRecord[];
  duplicate_checks: DuplicateCheckRecord[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const UPLOADS_DIR = path.resolve(DATA_DIR, 'uploads');
const DB_FILE = path.resolve(DATA_DIR, 'trustscan-db.json');

// Session signing secret: uses env var if provided, otherwise ephemeral random 32-byte key in memory
const SESSION_SECRET =
  process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim().length >= 16
    ? process.env.SESSION_SECRET.trim()
    : crypto.randomBytes(32).toString('hex');

function ensureDirs(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

function readDb(): DatabaseSchema {
  ensureDirs();
  if (!fs.existsSync(DB_FILE)) {
    const empty: DatabaseSchema = {
      users: [],
      documents: [],
      analysis_results: [],
      invoice_details: [],
      duplicate_checks: [],
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(empty, null, 2), 'utf-8');
    return empty;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<DatabaseSchema>;
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      documents: Array.isArray(parsed.documents) ? parsed.documents : [],
      analysis_results: Array.isArray(parsed.analysis_results) ? parsed.analysis_results : [],
      invoice_details: Array.isArray(parsed.invoice_details) ? parsed.invoice_details : [],
      duplicate_checks: Array.isArray(parsed.duplicate_checks) ? parsed.duplicate_checks : [],
    };
  } catch {
    return {
      users: [],
      documents: [],
      analysis_results: [],
      invoice_details: [],
      duplicate_checks: [],
    };
  }
}

function writeDb(db: DatabaseSchema): void {
  ensureDirs();
  const tempFile = `${DB_FILE}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(db, null, 2), 'utf-8');
  fs.renameSync(tempFile, DB_FILE);
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  if (!salt || !keyHex) return false;
  const keyBuf = Buffer.from(keyHex, 'hex');
  const derivedBuf = crypto.scryptSync(password, salt, 64);
  if (keyBuf.length !== derivedBuf.length) return false;
  return crypto.timingSafeEqual(keyBuf, derivedBuf);
}

export function createSessionToken(userId: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      uid: userId,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  if (!payload || !sig) return null;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as {
      uid?: string;
      exp?: number;
    };
    if (!parsed.uid || !parsed.exp || parsed.exp < Date.now()) {
      return null;
    }
    return parsed.uid;
  } catch {
    return null;
  }
}

export function sanitizeUser(user: StoredUser): UserProfile {
  return {
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    created_at: user.created_at,
  };
}

export function findUserByEmail(email: string): StoredUser | undefined {
  const db = readDb();
  const normalized = email.trim().toLowerCase();
  return db.users.find((u) => u.email.toLowerCase() === normalized);
}

export function findUserById(id: string): StoredUser | undefined {
  const db = readDb();
  return db.users.find((u) => u.id === id);
}

export function createUser(fullName: string, email: string, password: string): UserProfile {
  const db = readDb();
  const normalizedEmail = email.trim().toLowerCase();
  if (db.users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
    throw new Error('An account with this email already exists.');
  }
  const user: StoredUser = {
    id: crypto.randomUUID(),
    full_name: fullName.trim(),
    email: normalizedEmail,
    password_hash: hashPassword(password),
    created_at: new Date().toISOString(),
  };
  db.users.push(user);
  writeDb(db);
  return sanitizeUser(user);
}

export function updateUserProfile(userId: string, fullName: string): UserProfile | null {
  const db = readDb();
  const idx = db.users.findIndex((u) => u.id === userId);
  if (idx === -1) return null;
  db.users[idx].full_name = fullName.trim();
  writeDb(db);
  return sanitizeUser(db.users[idx]);
}

export function updateUserPassword(userId: string, newPassword: string): boolean {
  const db = readDb();
  const idx = db.users.findIndex((u) => u.id === userId);
  if (idx === -1) return false;
  db.users[idx].password_hash = hashPassword(newPassword);
  writeDb(db);
  return true;
}

export function saveUploadedFile(userId: string, originalName: string, buffer: Buffer): string {
  ensureDirs();
  const safeUserDir = path.resolve(UPLOADS_DIR, userId.replace(/[^a-zA-Z0-9_-]/g, ''));
  if (!safeUserDir.startsWith(UPLOADS_DIR + path.sep)) {
    throw new Error('Invalid user storage path.');
  }
  if (!fs.existsSync(safeUserDir)) {
    fs.mkdirSync(safeUserDir, { recursive: true });
  }
  const ext = path.extname(originalName).toLowerCase().replace(/[^.a-z0-9]/g, '') || '.bin';
  const fileKey = `${crypto.randomUUID()}${ext}`;
  const fullPath = path.resolve(safeUserDir, fileKey);
  if (!fullPath.startsWith(safeUserDir + path.sep)) {
    throw new Error('Invalid target file path.');
  }
  fs.writeFileSync(fullPath, buffer);
  // Return portable relative path from UPLOADS_DIR
  return `${path.basename(safeUserDir)}/${fileKey}`;
}

export function resolveStoredFilePath(storagePath: string): string | null {
  ensureDirs();
  const resolved = path.resolve(UPLOADS_DIR, storagePath);
  if (!resolved.startsWith(UPLOADS_DIR + path.sep)) {
    return null;
  }
  if (!fs.existsSync(resolved)) {
    return null;
  }
  return resolved;
}

export function getUserDocumentsByHash(userId: string, fileHash: string): DocumentRecord[] {
  const db = readDb();
  return db.documents.filter((d) => d.user_id === userId && d.file_hash === fileHash);
}

export function insertDocumentBundle(bundle: FullDocumentBundle): void {
  const db = readDb();
  db.documents.push(bundle.document);
  db.analysis_results.push(bundle.analysis);
  db.invoice_details.push(bundle.invoice);
  for (const check of bundle.duplicateChecks) {
    db.duplicate_checks.push(check);
  }
  writeDb(db);
}

export function listUserDocumentBundles(userId: string): FullDocumentBundle[] {
  const db = readDb();
  const userDocs = db.documents
    .filter((d) => d.user_id === userId)
    .sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());

  const bundles: FullDocumentBundle[] = [];
  for (const doc of userDocs) {
    const analysis = db.analysis_results.find((a) => a.document_id === doc.id && a.user_id === userId);
    const invoice = db.invoice_details.find((i) => i.document_id === doc.id);
    const duplicateChecks = db.duplicate_checks
      .filter((dc) => dc.document_id === doc.id)
      .map((dc) => {
        const matchedDoc = dc.matched_document_id
          ? db.documents.find((d) => d.id === dc.matched_document_id && d.user_id === userId)
          : undefined;
        return {
          ...dc,
          matched_file_name: matchedDoc?.file_name ?? null,
          matched_uploaded_at: matchedDoc?.uploaded_at ?? null,
        };
      });

    if (analysis && invoice) {
      bundles.push({ document: doc, analysis, invoice, duplicateChecks });
    }
  }
  return bundles;
}

export function getUserDocumentBundle(userId: string, documentId: string): FullDocumentBundle | null {
  const bundles = listUserDocumentBundles(userId);
  return bundles.find((b) => b.document.id === documentId) ?? null;
}

export function updateDocumentAnalysisAndInvoice(
  userId: string,
  documentId: string,
  updates: {
    analysis?: Partial<AnalysisResultRecord>;
    invoice?: Partial<InvoiceDetailsRecord>;
  }
): FullDocumentBundle | null {
  const db = readDb();
  const doc = db.documents.find((d) => d.id === documentId && d.user_id === userId);
  if (!doc) return null;

  if (updates.analysis) {
    const aIdx = db.analysis_results.findIndex(
      (a) => a.document_id === documentId && a.user_id === userId
    );
    if (aIdx !== -1) {
      db.analysis_results[aIdx] = { ...db.analysis_results[aIdx], ...updates.analysis };
    }
  }

  if (updates.invoice) {
    const iIdx = db.invoice_details.findIndex((i) => i.document_id === documentId);
    if (iIdx !== -1) {
      db.invoice_details[iIdx] = { ...db.invoice_details[iIdx], ...updates.invoice };
    }
  }

  writeDb(db);
  return getUserDocumentBundle(userId, documentId);
}

export function deleteUserDocument(userId: string, documentId: string): boolean {
  const db = readDb();
  const docIndex = db.documents.findIndex((d) => d.id === documentId && d.user_id === userId);
  if (docIndex === -1) return false;

  const doc = db.documents[docIndex];
  const filePath = resolveStoredFilePath(doc.storage_path);
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch {
      // Non-fatal if file already removed
    }
  }

  db.documents.splice(docIndex, 1);
  db.analysis_results = db.analysis_results.filter(
    (a) => !(a.document_id === documentId && a.user_id === userId)
  );
  db.invoice_details = db.invoice_details.filter((i) => i.document_id !== documentId);
  db.duplicate_checks = db.duplicate_checks.filter(
    (dc) => dc.document_id !== documentId && dc.matched_document_id !== documentId
  );
  writeDb(db);
  return true;
}

export function getPublicStats(): PublicStats {
  const db = readDb();
  const totalDocuments = db.documents.length;
  let lowRiskCount = 0;
  let mediumRiskCount = 0;
  let highRiskCount = 0;

  for (const res of db.analysis_results) {
    if (res.risk_level === 'LOW RISK') lowRiskCount += 1;
    else if (res.risk_level === 'MEDIUM RISK') mediumRiskCount += 1;
    else if (res.risk_level === 'HIGH RISK') highRiskCount += 1;
  }

  const duplicatesDetected = db.duplicate_checks.filter(
    (dc) => dc.match_type === 'EXACT_SHA256_MATCH'
  ).length;

  return {
    totalDocuments,
    lowRiskCount,
    mediumRiskCount,
    highRiskCount,
    duplicatesDetected,
  };
}
