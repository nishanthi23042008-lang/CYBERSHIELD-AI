export type RiskLevel = 'LOW RISK' | 'MEDIUM RISK' | 'HIGH RISK';

export type AnalysisStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type MatchType = 'NO_DUPLICATE' | 'EXACT_SHA256_MATCH';

export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
}

export interface DetectedIndicator {
  id: string;
  category:
    | 'missing_information'
    | 'unusual_amount'
    | 'text_inconsistency'
    | 'tax_validation'
    | 'date_anomaly'
    | 'duplicate_document'
    | 'metadata_inspection'
    | 'image_forensics';
  title: string;
  severity: 'low' | 'medium' | 'high';
  points: number;
  explanation: string;
  evidence: string;
}

export interface FileMetadataSummary {
  mimeType: string;
  fileSizeBytes: number;
  sha256: string;
  pageCount?: number;
  width?: number;
  height?: number;
  pdfInfo?: {
    creator?: string;
    producer?: string;
    author?: string;
    creationDate?: string;
    modDate?: string;
    title?: string;
  };
  exifInfo?: {
    software?: string;
    make?: string;
    model?: string;
    dateTimeOriginal?: string;
    modifyDate?: string;
  };
  pngTextChunks?: Record<string, string>;
  elaMetrics?: {
    applicable: boolean;
    reason?: string;
    meanError?: number;
    maxBlockError?: number;
    anomalyBlockPercent?: number;
    suspiciousRegionsCount?: number;
  };
  editingToolDetected?: string | null;
}

export interface ConfidenceNotes {
  ocrEngine: string;
  ocrConfidenceNote: string;
  forensicsScope: string;
  limitations: string[];
}

export interface DocumentRecord {
  id: string;
  user_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  file_hash: string;
  uploaded_at: string;
}

export interface AnalysisResultRecord {
  id: string;
  document_id: string;
  user_id: string;
  risk_score: number;
  risk_level: RiskLevel;
  extracted_text: string;
  detected_indicators: DetectedIndicator[];
  metadata_summary: FileMetadataSummary;
  confidence_notes: ConfidenceNotes;
  ela_preview_data_url: string | null;
  analysis_status: AnalysisStatus;
  created_at: string;
}

export interface InvoiceDetailsRecord {
  id: string;
  document_id: string;
  invoice_number: string | null;
  company_name: string | null;
  invoice_date: string | null;
  subtotal_amount: number | null;
  total_amount: number | null;
  gst_number: string | null;
  tax_amount: number | null;
  currency: string;
  tax_details: string | null;
  verification_notes?: string | null;
  created_at: string;
}

export interface DuplicateCheckRecord {
  id: string;
  document_id: string;
  matched_document_id: string | null;
  match_type: MatchType;
  matched_file_name?: string | null;
  matched_uploaded_at?: string | null;
  created_at: string;
}

export interface FullDocumentBundle {
  document: DocumentRecord;
  analysis: AnalysisResultRecord;
  invoice: InvoiceDetailsRecord;
  duplicateChecks: DuplicateCheckRecord[];
}

export interface PublicStats {
  totalDocuments: number;
  lowRiskCount: number;
  mediumRiskCount: number;
  highRiskCount: number;
  duplicatesDetected: number;
}
