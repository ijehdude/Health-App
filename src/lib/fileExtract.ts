/**
 * Client-side extraction of uploaded exercise files into something the
 * parse-exercise API can normalize:
 *   - Excel / CSV  → plain text (CSV of every sheet) via SheetJS
 *   - Word .docx   → raw text via mammoth
 *   - PDF          → sent to Gemini as a document (handles text AND scanned/
 *                    image PDFs natively, so no client PDF parsing is needed)
 *   - .txt / .md   → read directly
 *
 * Heavy parsers are dynamically imported so they only load when a file is
 * actually picked.
 */

export type ExtractedKind = 'spreadsheet' | 'word' | 'pdf' | 'text';

export interface ExtractedFile {
  kind: ExtractedKind;
  /** Present for spreadsheet / word / text inputs. */
  text?: string;
  /** Present for PDFs — base64 + mime for the AI to read directly. */
  document?: { b64: string; mimeType: string };
}

export class UnsupportedFileError extends Error {
  constructor(name: string) {
    super(`"${name}" isn't a supported file type. Use Excel, CSV, Word (.docx), PDF or a text file.`);
    this.name = 'UnsupportedFileError';
  }
}

/** Hard cap so a huge export can't blow up the request or the model context. */
const MAX_EXTRACTED_CHARS = 60_000;

export const ACCEPTED_FILE_EXTENSIONS = [
  '.csv',
  '.xls',
  '.xlsx',
  '.docx',
  '.pdf',
  '.txt',
  '.md',
];

function extensionOf(file: File): string {
  return file.name.split('.').pop()?.toLowerCase() ?? '';
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function clamp(text: string): string {
  const trimmed = text.trim();
  return trimmed.length > MAX_EXTRACTED_CHARS
    ? trimmed.slice(0, MAX_EXTRACTED_CHARS) + '\n…(truncated)'
    : trimmed;
}

async function extractSpreadsheet(file: File): Promise<string> {
  const XLSX = await import('xlsx');
  const data = new Uint8Array(await file.arrayBuffer());
  const wb = XLSX.read(data, { type: 'array' });
  const parts = wb.SheetNames.map((name) => {
    const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name]);
    return wb.SheetNames.length > 1 ? `# Sheet: ${name}\n${csv}` : csv;
  });
  return clamp(parts.join('\n\n'));
}

async function extractDocx(file: File): Promise<string> {
  const mammoth = await import('mammoth');
  const arrayBuffer = await file.arrayBuffer();
  const { value } = await mammoth.extractRawText({ arrayBuffer });
  return clamp(value);
}

export async function extractFile(file: File): Promise<ExtractedFile> {
  const ext = extensionOf(file);
  const mime = file.type;

  if (ext === 'pdf' || mime === 'application/pdf') {
    return {
      kind: 'pdf',
      document: { b64: arrayBufferToBase64(await file.arrayBuffer()), mimeType: 'application/pdf' },
    };
  }
  if (ext === 'xlsx' || ext === 'xls' || ext === 'csv' || mime.includes('spreadsheet')) {
    return { kind: 'spreadsheet', text: await extractSpreadsheet(file) };
  }
  if (ext === 'docx' || mime.includes('wordprocessingml')) {
    return { kind: 'word', text: await extractDocx(file) };
  }
  if (ext === 'txt' || ext === 'md' || mime.startsWith('text/')) {
    return { kind: 'text', text: clamp(await file.text()) };
  }
  throw new UnsupportedFileError(file.name);
}
