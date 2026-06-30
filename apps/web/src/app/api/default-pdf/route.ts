import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';

const DEFAULT_PDF_PATH =
  process.env.DEFAULT_PDF_PATH ??
  'C:\\Users\\Hp\\Downloads\\bundle\\I M P T F S.pdf';

const FALLBACK_PATHS = [
  'C:\\Users\\Hp\\Downloads\\bundle\\I M P T F S.pdf.pdf',
  'C:\\Users\\Hp\\Downloads\\bundle\\x.pdf',
];

export async function GET() {
  const candidates = [DEFAULT_PDF_PATH, ...FALLBACK_PATHS];

  for (const filePath of candidates) {
    if (!existsSync(filePath)) continue;

    const buffer = await readFile(filePath);
    const filename = path.basename(filePath);

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'X-Filename': filename,
        'Cache-Control': 'no-store',
      },
    });
  }

  return NextResponse.json(
    {
      error: 'Default PDF not found',
      paths: candidates,
    },
    { status: 404 },
  );
}
