declare module 'pdf-parse' {
  export interface TextResult {
    /** Concatenated plain text from all pages */
    text: string;
    /** Per-page text array */
    pages: Array<{ text: string }>;
    /** Total page count */
    total: number;
  }

  export interface PDFParseOptions {
    data: Buffer | Uint8Array;
    verbosity?: number;
  }

  export class PDFParse {
    constructor(options: PDFParseOptions);
    load(): Promise<void>;
    destroy(): Promise<void>;
    getText(params?: Record<string, unknown>): Promise<TextResult>;
  }
}
