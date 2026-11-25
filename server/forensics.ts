import crypto from 'node:crypto';
import { GoogleGenAI, Type } from '@google/genai';
import exifParser from 'exif-parser';
import jpeg from 'jpeg-js';
import { PDFParse } from 'pdf-parse';
import { PNG } from 'pngjs';
import type {
  ConfidenceNotes,
  DetectedIndicator,
  DocumentRecord,
  FileMetadataSummary,
  RiskLevel,
} from '../src/types/forensics.ts';

const KNOWN_EDITORS = [
  'photoshop',
  'canva',
  'gimp',
  'paint',
  'ilovepdf',
  'smallpdf',
  'sejda',
  'pdfescape',
  'foxit',
  'inkscape',
  'illustrator',
  'figma',
  'coreldraw',
  'snapseed',
  'lightroom',
];

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export interface ExtractedInvoicePayload {
  invoiceNumber: string | null;
  companyName: string | null;
  invoiceDate: string | null;
  subtotalAmount: number | null;
  taxAmount: number | null;
  totalAmount: number | null;
  gstNumber: string | null;
  currency: string;
  taxDetails: string | null;
  textAnomaliesFromOcr: string[];
}

export interface ForensicAnalysisOutput {
  sha256: string;
  extractedText: string;
  invoice: ExtractedInvoicePayload;
  metadataSummary: FileMetadataSummary;
  elaPreviewDataUrl: string | null;
  detectedIndicators: DetectedIndicator[];
  riskScore: number;
  riskLevel: RiskLevel;
  confidenceNotes: ConfidenceNotes;
}

export function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
  if (buffer.length < 4) return false;
  if (mimeType === 'application/pdf') {
    return buffer.subarray(0, 4).toString('ascii') === '%PDF';
  }
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === 'image/png') {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    );
  }
  return false;
}

export function computeSha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function detectEditorKeyword(rawValues: (string | undefined)[]): string | null {
  for (const val of rawValues) {
    if (!val) continue;
    const lower = val.toLowerCase();
    const matched = KNOWN_EDITORS.find((editor) => lower.includes(editor));
    if (matched) return val;
  }
  return null;
}

function extractPngTextChunks(buffer: Buffer): Record<string, string> {
  const chunks: Record<string, string> = {};
  let offset = 8; // Skip PNG signature
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd > buffer.length) break;

    if (type === 'tEXt') {
      const slice = buffer.subarray(dataStart, dataEnd);
      const sep = slice.indexOf(0);
      if (sep > 0) {
        const key = slice.subarray(0, sep).toString('latin1');
        const value = slice.subarray(sep + 1).toString('latin1').slice(0, 300);
        chunks[key] = value;
      }
    } else if (type === 'iTXt') {
      const slice = buffer.subarray(dataStart, dataEnd);
      const sep = slice.indexOf(0);
      if (sep > 0) {
        const key = slice.subarray(0, sep).toString('utf-8');
        const textPreview = slice
          .subarray(sep + 1)
          .toString('utf-8')
          .replace(/[^\x20-\x7E]/g, ' ')
          .trim()
          .slice(0, 300);
        if (textPreview) chunks[key] = textPreview;
      }
    }
    if (type === 'IEND') break;
    offset = dataEnd + 4; // skip CRC
  }
  return chunks;
}

function runJpegErrorLevelAnalysis(buffer: Buffer): {
  width: number;
  height: number;
  elaPreviewDataUrl: string | null;
  meanError: number;
  maxBlockError: number;
  anomalyBlockPercent: number;
  suspiciousRegionsCount: number;
} | null {
  try {
    const decoded = jpeg.decode(buffer, { useTArray: true, maxMemoryUsageInMB: 128 });
    const { width, height, data } = decoded;
    if (!width || !height || width * height > 25_000_000) {
      return null;
    }

    // Recompress at quality 90 and decode to compare DCT quantization residuals
    const recompressed = jpeg.encode({ width, height, data }, 90);
    const redecoded = jpeg.decode(recompressed.data, { useTArray: true, maxMemoryUsageInMB: 128 });

    const elaPng = new PNG({ width, height });
    const blockCols = Math.ceil(width / 8);
    const blockRows = Math.ceil(height / 8);
    const blockSums = new Float64Array(blockCols * blockRows);
    const blockCounts = new Uint32Array(blockCols * blockRows);

    let totalDiff = 0;
    const totalPixels = width * height;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const dr = Math.abs(data[idx] - redecoded.data[idx]);
        const dg = Math.abs(data[idx + 1] - redecoded.data[idx + 1]);
        const db = Math.abs(data[idx + 2] - redecoded.data[idx + 2]);
        const meanPixDiff = (dr + dg + db) / 3;
        totalDiff += meanPixDiff;

        const bIdx = Math.floor(y / 8) * blockCols + Math.floor(x / 8);
        blockSums[bIdx] += meanPixDiff;
        blockCounts[bIdx] += 1;

        // Amplify residual 12x for forensic heatmap preview
        const rHeat = Math.min(255, Math.round(dr * 12));
        const gHeat = Math.min(255, Math.round(dg * 12));
        const bHeat = Math.min(255, Math.round(db * 12));
        elaPng.data[idx] = rHeat;
        elaPng.data[idx + 1] = gHeat;
        elaPng.data[idx + 2] = bHeat;
        elaPng.data[idx + 3] = 255;
      }
    }

    const meanError = totalPixels > 0 ? totalDiff / totalPixels : 0;
    let maxBlockError = 0;
    let anomalyBlocks = 0;
    const threshold = Math.max(meanError * 2.5, 4.0);

    for (let i = 0; i < blockSums.length; i++) {
      const avgBlock = blockCounts[i] > 0 ? blockSums[i] / blockCounts[i] : 0;
      if (avgBlock > maxBlockError) maxBlockError = avgBlock;
      if (avgBlock > threshold) anomalyBlocks += 1;
    }

    const anomalyBlockPercent =
      blockSums.length > 0 ? (anomalyBlocks / blockSums.length) * 100 : 0;

    // Downscale heatmap preview if image is very large so response stays snappy
    const pngBuffer = PNG.sync.write(elaPng);
    const elaPreviewDataUrl =
      pngBuffer.length <= 2_500_000
        ? `data:image/png;base64,${pngBuffer.toString('base64')}`
        : null;

    return {
      width,
      height,
      elaPreviewDataUrl,
      meanError: Number(meanError.toFixed(3)),
      maxBlockError: Number(maxBlockError.toFixed(3)),
      anomalyBlockPercent: Number(anomalyBlockPercent.toFixed(2)),
      suspiciousRegionsCount: anomalyBlocks,
    };
  } catch {
    return null;
  }
}

function parseInvoiceWithRegexFallback(text: string): ExtractedInvoicePayload {
  const clean = text || '';
  const invMatch = clean.match(
    /(?:invoice\s*(?:no\.?|number|#)|inv\s*#?)\s*[:\-]?\s*([A-Z0-9\-\/]{3,30})/i
  );
  const dateMatch = clean.match(
    /(?:invoice\s*date|dated?|bill\s*date)\s*[:\-]?\s*([0-9]{1,4}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4}|[A-Za-z]{3,9}\s+[0-9]{1,2},?\s+[0-9]{4})/i
  );
  const gstMatch = clean.match(
    /\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})\b/
  );
  const totalMatch = clean.match(
    /(?:grand\s*total|total\s*amount|amount\s*payable|balance\s*due|total)\s*[:\-]?\s*(?:INR|USD|EUR|GBP|₹|\$|€|£)?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i
  );
  const taxMatch = clean.match(
    /(?:total\s*tax|gst\s*amount|cgst\s*\+\s*sgst|igst|vat|tax)\s*[:\-]?\s*(?:INR|USD|EUR|GBP|₹|\$|€|£)?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i
  );
  const subtotalMatch = clean.match(
    /(?:sub\s*total|subtotal|taxable\s*value)\s*[:\-]?\s*(?:INR|USD|EUR|GBP|₹|\$|€|£)?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i
  );

  const lines = clean
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 2 && !/^tax\s*invoice$/i.test(l) && !/^invoice$/i.test(l));

  const toNumber = (m: RegExpMatchArray | null): number | null => {
    if (!m || !m[1]) return null;
    const n = Number(m[1].replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
  };

  let currency = 'INR';
  if (/\$|USD/i.test(clean)) currency = 'USD';
  else if (/€|EUR/i.test(clean)) currency = 'EUR';
  else if (/£|GBP/i.test(clean)) currency = 'GBP';

  return {
    invoiceNumber: invMatch?.[1]?.trim() ?? null,
    companyName: lines[0]?.slice(0, 90) ?? null,
    invoiceDate: dateMatch?.[1]?.trim() ?? null,
    subtotalAmount: toNumber(subtotalMatch),
    taxAmount: toNumber(taxMatch),
    totalAmount: toNumber(totalMatch),
    gstNumber: gstMatch?.[1] ?? null,
    currency,
    taxDetails: gstMatch ? `GSTIN detected (${gstMatch[1]})` : null,
    textAnomaliesFromOcr: [],
  };
}

async function extractWithGemini(
  buffer: Buffer,
  mimeType: string,
  embeddedPdfText: string
): Promise<{
  extractedText: string;
  invoice: ExtractedInvoicePayload;
  engineLabel: string;
}> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    if (mimeType === 'application/pdf' && embeddedPdfText.trim().length >= 25) {
      return {
        extractedText: embeddedPdfText.trim(),
        invoice: parseInvoiceWithRegexFallback(embeddedPdfText),
        engineLabel: 'PDF Embedded Text Layer + Deterministic Parser (GEMINI_API_KEY not set)',
      };
    }
    throw new Error(
      'GEMINI_API_KEY is not configured on the server. Configure GEMINI_API_KEY in Secrets to enable multimodal OCR for images and scanned PDFs.'
    );
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const normalizedMime = mimeType === 'image/jpg' ? 'image/jpeg' : mimeType;

  const prompt = `Perform precise forensic OCR and structured invoice field extraction on the provided document.
Rules:
- Transcribe ALL visible text faithfully into "extractedText" without inventing missing characters.
- Extract invoiceNumber, companyName (vendor/issuer), invoiceDate (ISO YYYY-MM-DD if possible, otherwise verbatim date string), subtotalAmount, taxAmount, totalAmount, gstNumber (GSTIN/VAT/Tax ID), currency (e.g., INR, USD, EUR), and taxDetails (e.g., CGST 9% + SGST 9% or VAT 20%).
- If a field is not present in the document, return null (do NOT guess or fabricate values).
- In "textAnomalies", list only concrete textual/visual inconsistencies you directly observe (e.g., conflicting total amounts, mismatched currency symbols, overwritten digits, misaligned/different-font numbers). Return an empty array if none are observed.${
    embeddedPdfText.trim()
      ? `\n\nEmbedded PDF text layer for cross-reference:\n${embeddedPdfText.slice(0, 6000)}`
      : ''
  }`;

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: normalizedMime,
            data: buffer.toString('base64'),
          },
        },
        { text: prompt },
      ],
    },
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          extractedText: { type: Type.STRING },
          invoiceNumber: { type: Type.STRING, nullable: true },
          companyName: { type: Type.STRING, nullable: true },
          invoiceDate: { type: Type.STRING, nullable: true },
          subtotalAmount: { type: Type.NUMBER, nullable: true },
          taxAmount: { type: Type.NUMBER, nullable: true },
          totalAmount: { type: Type.NUMBER, nullable: true },
          gstNumber: { type: Type.STRING, nullable: true },
          currency: { type: Type.STRING },
          taxDetails: { type: Type.STRING, nullable: true },
          textAnomalies: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: ['extractedText', 'currency', 'textAnomalies'],
      },
    },
  });

  const rawJson = (response.text ?? '{}').trim();
  const parsed = JSON.parse(rawJson) as {
    extractedText?: string;
    invoiceNumber?: string | null;
    companyName?: string | null;
    invoiceDate?: string | null;
    subtotalAmount?: number | null;
    taxAmount?: number | null;
    totalAmount?: number | null;
    gstNumber?: string | null;
    currency?: string;
    taxDetails?: string | null;
    textAnomalies?: string[];
  };

  const combinedText =
    parsed.extractedText && parsed.extractedText.trim().length > 0
      ? parsed.extractedText.trim()
      : embeddedPdfText.trim();

  return {
    extractedText: combinedText,
    invoice: {
      invoiceNumber: parsed.invoiceNumber?.trim() || null,
      companyName: parsed.companyName?.trim() || null,
      invoiceDate: parsed.invoiceDate?.trim() || null,
      subtotalAmount:
        typeof parsed.subtotalAmount === 'number' && Number.isFinite(parsed.subtotalAmount)
          ? parsed.subtotalAmount
          : null,
      taxAmount:
        typeof parsed.taxAmount === 'number' && Number.isFinite(parsed.taxAmount)
          ? parsed.taxAmount
          : null,
      totalAmount:
        typeof parsed.totalAmount === 'number' && Number.isFinite(parsed.totalAmount)
          ? parsed.totalAmount
          : null,
      gstNumber: parsed.gstNumber?.trim().toUpperCase() || null,
      currency: parsed.currency?.trim().toUpperCase() || 'INR',
      taxDetails: parsed.taxDetails?.trim() || null,
      textAnomaliesFromOcr: Array.isArray(parsed.textAnomalies)
        ? parsed.textAnomalies.filter((s) => typeof s === 'string' && s.trim().length > 0)
        : [],
    },
    engineLabel: 'Gemini 4 Hydrogen Multimodal OCR + Structured Parser',
  };
}

export function evaluateRuleBasedRisk(params: {
  invoice: ExtractedInvoicePayload;
  extractedText: string;
  metadataSummary: FileMetadataSummary;
  duplicateMatches: DocumentRecord[];
}): {
  detectedIndicators: DetectedIndicator[];
  riskScore: number;
  riskLevel: RiskLevel;
} {
  const { invoice, extractedText, metadataSummary, duplicateMatches } = params;
  const indicators: DetectedIndicator[] = [];

  // 1. Exact SHA-256 Duplicate Detection
  if (duplicateMatches.length > 0) {
    const firstMatch = duplicateMatches[0];
    indicators.push({
      id: 'dup-exact-sha256',
      category: 'duplicate_document',
      title: 'Exact Duplicate File Hash Detected',
      severity: 'high',
      points: 28,
      explanation:
        'An identical file (matching SHA-256 cryptographic digest) was previously uploaded to your workspace. Duplicate submissions warrant manual verification to rule out double billing or resubmission.',
      evidence: `Matched "${firstMatch.file_name}" uploaded on ${new Date(
        firstMatch.uploaded_at
      ).toLocaleString()} (SHA-256: ${metadataSummary.sha256.slice(0, 16)}...)`,
    });
  }

  // 2. Missing Critical Information Detection
  const missingFields: string[] = [];
  if (!invoice.invoiceNumber) missingFields.push('Invoice Number');
  if (!invoice.companyName) missingFields.push('Company / Vendor Name');
  if (!invoice.invoiceDate) missingFields.push('Invoice Date');
  if (invoice.totalAmount === null) missingFields.push('Total Amount');

  if (missingFields.length > 0) {
    const pts = Math.min(28, missingFields.length * 8);
    indicators.push({
      id: 'missing-core-fields',
      category: 'missing_information',
      title: 'Missing Mandatory Invoice Fields',
      severity: missingFields.length >= 2 ? 'high' : 'medium',
      points: pts,
      explanation:
        'One or more standard commercial invoice identifiers could not be located in the extracted text. Incomplete documents pose a potential verification risk and require manual review.',
      evidence: `Missing fields: ${missingFields.join(', ')}`,
    });
  }

  if (!invoice.gstNumber && invoice.taxAmount === null && !invoice.taxDetails) {
    indicators.push({
      id: 'missing-tax-gst',
      category: 'missing_information',
      title: 'Tax & GST Registration Details Absent',
      severity: 'low',
      points: 6,
      explanation:
        'No GSTIN, tax registration number, or tax line-item breakdown was detected. Confirm whether the issuer is tax-exempt or operating below registration thresholds.',
      evidence: 'gstNumber: null, taxAmount: null, taxDetails: null',
    });
  }

  // 3. Arithmetic & Unusual Amount Detection
  if (invoice.totalAmount !== null) {
    if (invoice.totalAmount <= 0) {
      indicators.push({
        id: 'non-positive-total',
        category: 'unusual_amount',
        title: 'Zero or Negative Total Amount',
        severity: 'high',
        points: 18,
        explanation:
          'The extracted total amount is zero or negative, which is atypical for a standard payable invoice unless it is explicitly a credit note.',
        evidence: `Extracted totalAmount: ${invoice.currency} ${invoice.totalAmount}`,
      });
    } else if (invoice.totalAmount > 10_000_000) {
      indicators.push({
        id: 'outlier-high-amount',
        category: 'unusual_amount',
        title: 'Extreme High-Value Invoice Outlier',
        severity: 'medium',
        points: 12,
        explanation:
          'The extracted invoice total exceeds 10,000,000 currency units. High-value invoices warrant secondary authorization and manual verification.',
        evidence: `Extracted totalAmount: ${invoice.currency} ${invoice.totalAmount.toLocaleString()}`,
      });
    } else if (
      invoice.totalAmount >= 50_000 &&
      invoice.totalAmount % 1000 === 0 &&
      invoice.taxAmount === null
    ) {
      indicators.push({
        id: 'round-amount-no-tax',
        category: 'unusual_amount',
        title: 'Exact Round High Total Without Tax Breakdown',
        severity: 'low',
        points: 9,
        explanation:
          'Large commercial invoices ending in exact thousands without itemized tax frequently require supporting PO verification.',
        evidence: `Extracted totalAmount: ${invoice.currency} ${invoice.totalAmount.toLocaleString()} with no taxAmount`,
      });
    }

    if (invoice.subtotalAmount !== null && invoice.taxAmount !== null) {
      const expected = invoice.subtotalAmount + invoice.taxAmount;
      const diff = Math.abs(expected - invoice.totalAmount);
      const tolerance = Math.max(1.0, invoice.totalAmount * 0.01);
      if (diff > tolerance) {
        indicators.push({
          id: 'arithmetic-mismatch',
          category: 'unusual_amount',
          title: 'Subtotal + Tax Does Not Reconcile With Total',
          severity: 'high',
          points: 24,
          explanation:
            'The sum of subtotal and tax differs from the stated total beyond a 1% rounding tolerance. This potential risk indicator requires manual recalculation.',
          evidence: `Subtotal (${invoice.subtotalAmount}) + Tax (${invoice.taxAmount}) = ${expected.toFixed(
            2
          )}, whereas Total = ${invoice.totalAmount}`,
        });
      }
    }
  }

  // 4. GSTIN / Tax ID Structural Validation
  if (invoice.gstNumber) {
    const cleanedGst = invoice.gstNumber.replace(/\s+/g, '').toUpperCase();
    // Check if it looks like an Indian GSTIN (15 chars) or malformed
    if (cleanedGst.length >= 13 && cleanedGst.length <= 17 && !GSTIN_REGEX.test(cleanedGst)) {
      indicators.push({
        id: 'invalid-gstin-format',
        category: 'tax_validation',
        title: 'Tax / GSTIN Format Failed Structural Check',
        severity: 'medium',
        points: 14,
        explanation:
          'The extracted GST identification string does not match the standard 15-character alphanumeric GSTIN pattern (2-digit state code + 10-char PAN + entity/Z/checksum).',
        evidence: `Extracted GSTIN string: "${invoice.gstNumber}"`,
      });
    }
  }

  // 5. Date & Timeline Validation
  if (invoice.invoiceDate) {
    const parsedDate = new Date(invoice.invoiceDate);
    if (Number.isNaN(parsedDate.getTime())) {
      indicators.push({
        id: 'malformed-invoice-date',
        category: 'date_anomaly',
        title: 'Ambiguous or Unparseable Invoice Date',
        severity: 'low',
        points: 8,
        explanation:
          'The invoice date string could not be parsed unambiguously into a calendar date, requiring human confirmation.',
        evidence: `Extracted invoiceDate: "${invoice.invoiceDate}"`,
      });
    } else {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      if (parsedDate.getTime() > tomorrow.getTime()) {
        indicators.push({
          id: 'future-dated-invoice',
          category: 'date_anomaly',
          title: 'Future-Dated Invoice Detected',
          severity: 'high',
          points: 18,
          explanation:
            'The extracted invoice date falls in the future relative to the current upload timestamp, which is an anomaly requiring verification.',
          evidence: `Invoice Date: ${invoice.invoiceDate} vs Analysis Date: ${new Date()
            .toISOString()
            .slice(0, 10)}`,
        });
      }
    }
  }

  // 6. Text Inconsistency Detection
  if (invoice.textAnomaliesFromOcr.length > 0) {
    indicators.push({
      id: 'ocr-text-inconsistencies',
      category: 'text_inconsistency',
      title: 'Visual or Textual Inconsistencies Observed',
      severity: 'medium',
      points: Math.min(18, 8 + invoice.textAnomaliesFromOcr.length * 4),
      explanation:
        'OCR inspection flagged potential textual conflicts or formatting inconsistencies inside the document body that require manual inspection.',
      evidence: invoice.textAnomaliesFromOcr.join(' | '),
    });
  }

  // Check if multiple distinct "Total" values appear in extracted text
  const totalRegex = /(?:grand\s*total|total\s*amount)\s*[:\-]?\s*(?:INR|USD|EUR|GBP|₹|\$|€|£)?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/gi;
  const totalCandidates = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = totalRegex.exec(extractedText)) !== null) {
    if (m[1]) totalCandidates.add(m[1].replace(/,/g, ''));
  }
  if (totalCandidates.size > 1) {
    indicators.push({
      id: 'conflicting-total-mentions',
      category: 'text_inconsistency',
      title: 'Multiple Conflicting Total Figures in Text',
      severity: 'medium',
      points: 12,
      explanation:
        'Multiple distinct numeric figures appear adjacent to "Total" labels in the extracted text layer.',
      evidence: `Distinct total candidates found: ${Array.from(totalCandidates).join(', ')}`,
    });
  }

  // 7. File Metadata Editing Tool Inspection
  if (metadataSummary.editingToolDetected) {
    indicators.push({
      id: 'metadata-editing-software',
      category: 'metadata_inspection',
      title: 'Graphic or PDF Editing Software Signature Found',
      severity: 'medium',
      points: 15,
      explanation:
        'Embedded file metadata references an interactive design or PDF post-processing tool rather than a standard ERP/accounting generator. While legitimate designers also use these tools, modified invoices warrant closer review.',
      evidence: `Detected software/producer tag: "${metadataSummary.editingToolDetected}"`,
    });
  }

  if (
    metadataSummary.pdfInfo?.creationDate &&
    metadataSummary.pdfInfo?.modDate &&
    metadataSummary.pdfInfo.creationDate !== metadataSummary.pdfInfo.modDate
  ) {
    indicators.push({
      id: 'pdf-modified-after-creation',
      category: 'metadata_inspection',
      title: 'PDF Modification Timestamp Differs From Creation Timestamp',
      severity: 'low',
      points: 8,
      explanation:
        'The PDF header indicates the file was modified after its initial creation timestamp. This may happen from benign annotations or post-issue edits.',
      evidence: `CreationDate: ${metadataSummary.pdfInfo.creationDate} | ModDate: ${metadataSummary.pdfInfo.modDate}`,
    });
  }

  // 8. JPEG Error Level Analysis (ELA) Inspection
  if (metadataSummary.elaMetrics?.applicable) {
    const { anomalyBlockPercent = 0, maxBlockError = 0, meanError = 0 } =
      metadataSummary.elaMetrics;
    const ratio = meanError > 0 ? maxBlockError / meanError : 0;
    if (anomalyBlockPercent > 6.5 && ratio > 4.2) {
      indicators.push({
        id: 'ela-compression-variance',
        category: 'image_forensics',
        title: 'Localized JPEG Compression Variance (ELA Indicator)',
        severity: 'medium',
        points: 16,
        explanation:
          'Error Level Analysis detected localized 8x8 pixel regions whose recompression residual diverges significantly from the global average. Because scanners, high-contrast text, and re-saving can also elevate ELA variance, this is a screening indicator requiring manual verification.',
        evidence: `High-variance blocks: ${anomalyBlockPercent}% | Mean Error: ${meanError} | Max Block Error: ${maxBlockError}`,
      });
    }
  }

  const rawScore = indicators.reduce((sum, item) => sum + item.points, 0);
  const riskScore = Math.max(0, Math.min(100, rawScore));
  let riskLevel: RiskLevel = 'LOW RISK';
  if (riskScore >= 65) riskLevel = 'HIGH RISK';
  else if (riskScore >= 30) riskLevel = 'MEDIUM RISK';

  return { detectedIndicators: indicators, riskScore, riskLevel };
}

export async function analyzeDocumentBuffer(params: {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  duplicateMatches: DocumentRecord[];
}): Promise<ForensicAnalysisOutput> {
  const { buffer, mimeType, duplicateMatches } = params;
  const sha256 = computeSha256(buffer);

  const metadataSummary: FileMetadataSummary = {
    mimeType,
    fileSizeBytes: buffer.length,
    sha256,
    editingToolDetected: null,
  };

  let embeddedPdfText = '';
  let elaPreviewDataUrl: string | null = null;
  const limitations: string[] = [
    'Automated risk indicators highlight potential anomalies for auditor review and do not constitute definitive legal proof of fraud.',
    'A different SHA-256 file hash does not prove two documents are unrelated, because re-saving, scanning, or converting a file alters its byte stream.',
  ];

  // Inspect file container metadata & image forensics
  if (mimeType === 'application/pdf') {
    let parser: PDFParse | null = null;
    try {
      parser = new PDFParse({ data: buffer });
      const [textResult, infoResult] = await Promise.all([
        parser.getText(),
        parser.getInfo(),
      ]);
      embeddedPdfText = textResult.text || '';
      const info = (infoResult.info || {}) as Record<string, unknown>;
      const creator = typeof info.Creator === 'string' ? info.Creator : undefined;
      const producer = typeof info.Producer === 'string' ? info.Producer : undefined;
      const author = typeof info.Author === 'string' ? info.Author : undefined;
      const creationDate =
        typeof info.CreationDate === 'string' ? info.CreationDate : undefined;
      const modDate = typeof info.ModDate === 'string' ? info.ModDate : undefined;
      const title = typeof info.Title === 'string' ? info.Title : undefined;

      metadataSummary.pageCount = infoResult.total || textResult.total;
      metadataSummary.pdfInfo = {
        creator,
        producer,
        author,
        creationDate,
        modDate,
        title,
      };
      metadataSummary.editingToolDetected = detectEditorKeyword([creator, producer, author]);
      metadataSummary.elaMetrics = {
        applicable: false,
        reason: 'Pixel Error Level Analysis applies to JPEG raster images, not PDF vector/document containers.',
      };
      limitations.push(
        'PDF documents are inspected via embedded text layer, multimodal OCR, and PDF header metadata rather than JPEG pixel ELA.'
      );
    } catch {
      metadataSummary.elaMetrics = {
        applicable: false,
        reason: 'PDF metadata stream could not be parsed cleanly.',
      };
    } finally {
      if (parser) {
        await parser.destroy().catch(() => {});
      }
    }
  } else if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
    try {
      const parser = exifParser.create(buffer);
      const exif = parser.parse();
      const tags = (exif.tags || {}) as Record<string, unknown>;
      const software = typeof tags.Software === 'string' ? tags.Software : undefined;
      const make = typeof tags.Make === 'string' ? tags.Make : undefined;
      const model = typeof tags.Model === 'string' ? tags.Model : undefined;
      const dateTimeOriginal = tags.DateTimeOriginal
        ? new Date(Number(tags.DateTimeOriginal) * 1000).toISOString()
        : undefined;
      const modifyDate = tags.ModifyDate
        ? new Date(Number(tags.ModifyDate) * 1000).toISOString()
        : undefined;

      metadataSummary.exifInfo = {
        software,
        make,
        model,
        dateTimeOriginal,
        modifyDate,
      };
      metadataSummary.editingToolDetected = detectEditorKeyword([software]);
    } catch {
      // JPEG without EXIF APP1 block (common after web/chat re-compression)
      metadataSummary.exifInfo = {};
    }

    const ela = runJpegErrorLevelAnalysis(buffer);
    if (ela) {
      metadataSummary.width = ela.width;
      metadataSummary.height = ela.height;
      elaPreviewDataUrl = ela.elaPreviewDataUrl;
      metadataSummary.elaMetrics = {
        applicable: true,
        meanError: ela.meanError,
        maxBlockError: ela.maxBlockError,
        anomalyBlockPercent: ela.anomalyBlockPercent,
        suspiciousRegionsCount: ela.suspiciousRegionsCount,
      };
    } else {
      metadataSummary.elaMetrics = {
        applicable: false,
        reason: 'JPEG stream exceeded safe decode limits or could not be recompressed.',
      };
    }

    limitations.push(
      'JPEG Error Level Analysis (ELA) measures recompression residual differences; messaging app compression, camera sharpening, and high-contrast text edges can naturally elevate ELA values.'
    );
  } else if (mimeType === 'image/png') {
    const chunks = extractPngTextChunks(buffer);
    metadataSummary.pngTextChunks = chunks;
    metadataSummary.editingToolDetected = detectEditorKeyword(Object.values(chunks));
    try {
      const decodedPng = PNG.sync.read(buffer);
      metadataSummary.width = decodedPng.width;
      metadataSummary.height = decodedPng.height;
    } catch {
      // ignore dimension parse failure
    }
    metadataSummary.elaMetrics = {
      applicable: false,
      reason: 'PNG uses lossless DEFLATE compression and does not retain JPEG DCT quantization history required for ELA.',
    };
    limitations.push(
      'PNG files are lossless and lack JPEG DCT quantization tables; image forensics for PNG focuses on embedded tEXt/iTXt software metadata chunks.'
    );
  }

  // OCR & Structured Invoice Extraction
  const ocrResult = await extractWithGemini(buffer, mimeType, embeddedPdfText);

  // Deterministic Rule-Based Risk Evaluation
  const { detectedIndicators, riskScore, riskLevel } = evaluateRuleBasedRisk({
    invoice: ocrResult.invoice,
    extractedText: ocrResult.extractedText,
    metadataSummary,
    duplicateMatches,
  });

  const confidenceNotes: ConfidenceNotes = {
    ocrEngine: ocrResult.engineLabel,
    ocrConfidenceNote:
      ocrResult.extractedText.length > 40
        ? 'Text extraction succeeded with sufficient character density for deterministic invoice field validation.'
        : 'Limited text density detected; verify image clarity and manually inspect key invoice values.',
    forensicsScope:
      mimeType === 'image/jpeg' || mimeType === 'image/jpg'
        ? 'SHA-256 Hash + EXIF Metadata + JPEG ELA + OCR Invoice Rules'
        : mimeType === 'image/png'
          ? 'SHA-256 Hash + PNG Chunk Metadata + OCR Invoice Rules'
          : 'SHA-256 Hash + PDF Metadata + Embedded/OCR Text + Invoice Rules',
    limitations,
  };

  return {
    sha256,
    extractedText: ocrResult.extractedText,
    invoice: ocrResult.invoice,
    metadataSummary,
    elaPreviewDataUrl,
    detectedIndicators,
    riskScore,
    riskLevel,
    confidenceNotes,
  };
}
