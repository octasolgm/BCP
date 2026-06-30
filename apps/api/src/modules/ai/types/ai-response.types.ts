export interface UsageDetails {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface SimpleAiCallResponse {
  success: boolean;
  message: string | Record<string, unknown> | unknown[];
  model?: string;
  requestedModel?: string;
  error?: string;
  usage?: UsageDetails;
  responseTime?: string;
}

export interface PdfPageLayoutSpan {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PdfPageLayout {
  pageNumber: number;
  text: string;
  spans: PdfPageLayoutSpan[];
}

export interface PdfFileExtractResult {
  fileName: string;
  pageCount: number;
  characterCount: number;
  text: string;
  extractionMethod: string;
  pages?: PdfPageLayout[];
}

export interface PdfExtractResponse {
  success: boolean;
  error?: string;
  warning?: string;
  fileCount?: number;
  totalCharacterCount?: number;
  combinedText?: string;
  files?: PdfFileExtractResult[];
}

export interface PdfPagesExtractResponse {
  success: boolean;
  error?: string;
  fileName?: string;
  pageCount?: number;
  pages?: PdfPageLayout[];
}

export interface UploadedPdfFile {
  originalname: string;
  buffer: Buffer;
  size: number;
  mimetype: string;
}
