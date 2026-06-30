import { Injectable, Logger } from '@nestjs/common';
import pdfParse from 'pdf-parse';
import {
  PdfExtractResponse,
  PdfFileExtractResult,
  PdfPageLayout,
  PdfPageLayoutSpan,
  PdfPagesExtractResponse,
  UploadedPdfFile,
} from '../types/ai-response.types';

const MAX_PDF_SIZE_BYTES = 20 * 1024 * 1024;
const MIN_MEANINGFUL_CHARS = 20;

function layoutSpanFromTextItem(item: {
  str?: string;
  transform?: number[];
  width?: number;
  height?: number;
}): PdfPageLayoutSpan | null {
  if (!item.str?.trim()) return null;

  const tx = item.transform ?? [0, 0, 0, 0, 0, 0];
  const scaleX = Math.abs(tx[0] ?? 0);
  const scaleY = Math.abs(tx[3] ?? 0);
  let fontSize = scaleY || scaleX || 11;
  if (fontSize > 24 || fontSize < 5) fontSize = 11;

  const rawW = item.width ?? 0;
  const width =
    rawW > 0 && rawW < 600 ? rawW : item.str.length * fontSize * 0.48;

  const rawH = item.height ?? 0;
  const height = rawH > 0 && rawH < 24 ? rawH : fontSize;

  return {
    text: item.str,
    x: tx[4] ?? 0,
    y: tx[5] ?? 0,
    width,
    height,
  };
}

@Injectable()
export class PdfExtractionService {
  private readonly logger = new Logger(PdfExtractionService.name);

  async extractPagesLayout(
    file: UploadedPdfFile,
  ): Promise<PdfPagesExtractResponse> {
    if (!file?.size) {
      return { success: false, error: 'PDF file is required' };
    }
    if (!file.originalname.toLowerCase().endsWith('.pdf')) {
      return {
        success: false,
        error: `Only PDF files are supported (${file.originalname})`,
      };
    }
    if (file.size > MAX_PDF_SIZE_BYTES) {
      return {
        success: false,
        error: `PDF ${file.originalname} exceeds ${MAX_PDF_SIZE_BYTES / 1024 / 1024} MB limit`,
      };
    }

    try {
      const pages: PdfPageLayout[] = [];
      let pageNumber = 0;

      await pdfParse(file.buffer, {
        pagerender: (pageData: {
          getTextContent: (opts: {
            normalizeWhitespace: boolean;
            disableCombineTextItems: boolean;
          }) => Promise<{
            items: Array<{
              str?: string;
              transform?: number[];
              width?: number;
              height?: number;
            }>;
          }>;
        }) => {
          pageNumber += 1;
          const currentPage = pageNumber;
          return pageData
            .getTextContent({
              normalizeWhitespace: false,
              disableCombineTextItems: false,
            })
            .then((textContent) => {
              const spans: PdfPageLayoutSpan[] = [];
              let text = '';
              let lastY: number | undefined;

              for (const item of textContent.items) {
                const span = layoutSpanFromTextItem(item);
                if (!span) continue;

                spans.push(span);

                if (lastY === undefined || lastY === span.y) {
                  text += span.text;
                } else {
                  text += `\n${span.text}`;
                }
                lastY = span.y;
              }

              pages.push({
                pageNumber: currentPage,
                text: text.trim(),
                spans,
              });
              return text;
            });
        },
      });

      return {
        success: true,
        fileName: file.originalname,
        pageCount: pages.length,
        pages,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown extraction error';
      this.logger.error(
        `Failed to extract PDF layout ${file.originalname}`,
        message,
      );
      return {
        success: false,
        error: `Failed to extract ${file.originalname}: ${message}`,
      };
    }
  }

  async extract(files: UploadedPdfFile[]): Promise<PdfExtractResponse> {
    if (!files?.length) {
      return { success: false, error: 'At least one PDF file is required' };
    }

    const results: PdfFileExtractResult[] = [];
    const combinedParts: string[] = [];

    for (const file of files) {
      if (!file.originalname.toLowerCase().endsWith('.pdf')) {
        return {
          success: false,
          error: `Only PDF files are supported (${file.originalname})`,
        };
      }
      if (file.size > MAX_PDF_SIZE_BYTES) {
        return {
          success: false,
          error: `PDF ${file.originalname} exceeds ${MAX_PDF_SIZE_BYTES / 1024 / 1024} MB limit`,
        };
      }

      try {
        const parsed = await pdfParse(file.buffer);
        const text = (parsed.text ?? '').trim();
        const method =
          text.length >= MIN_MEANINGFUL_CHARS ? 'pdf-parse' : 'pdf-parse-empty';

        const fileResult: PdfFileExtractResult = {
          fileName: file.originalname,
          pageCount: parsed.numpages ?? 0,
          text,
          characterCount: text.length,
          extractionMethod: method,
        };
        results.push(fileResult);

        combinedParts.push(
          `=== FILE: ${file.originalname} (${fileResult.pageCount} pages, ${method}) ===`,
          text,
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown extraction error';
        this.logger.error(`Failed to extract PDF ${file.originalname}`, message);
        return {
          success: false,
          error: `Failed to extract ${file.originalname}: ${message}`,
        };
      }
    }

    if (!results.length) {
      return { success: false, error: 'No valid PDF files were provided' };
    }

    const combinedText = combinedParts.join('\n');
    const allEmpty = results.every(
      (r) => r.characterCount < MIN_MEANINGFUL_CHARS,
    );

    return {
      success: true,
      fileCount: results.length,
      files: results,
      combinedText,
      totalCharacterCount: combinedText.length,
      warning: allEmpty
        ? 'No readable text was found. The PDF may be scanned — OCR fallback can be added.'
        : undefined,
    };
  }
}
