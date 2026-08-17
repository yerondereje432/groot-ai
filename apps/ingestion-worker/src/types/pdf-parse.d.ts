// Minimal declaration for pdf-parse — covers the only call we make.
declare module 'pdf-parse' {
  interface PdfResult {
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: unknown;
    text: string;
    version: string;
  }
  function pdfParse(buffer: Buffer, options?: Record<string, unknown>): Promise<PdfResult>;
  export default pdfParse;
}
