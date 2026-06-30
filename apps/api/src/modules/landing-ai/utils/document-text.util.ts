import mammoth from 'mammoth';

export function isDocxFileName(fileName: string): boolean {
  return /\.docx$/i.test(fileName.trim());
}

export async function docxBufferToMarkdown(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  const text = result.value?.trim() ?? '';
  if (!text) {
    throw new Error('DOCX conversion returned empty text');
  }
  return text
    .split(/\n{3,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .join('\n\n');
}
