// @types/pdf-parse only declares the package root; we import the lib entrypoint
// directly to avoid the index.js debug harness that reads a test PDF on load.
declare module 'pdf-parse/lib/pdf-parse.js' {
  interface PDFParseResult {
    text: string
    numpages: number
    info: unknown
    metadata: unknown
    version: string
  }
  function pdfParse(dataBuffer: Buffer): Promise<PDFParseResult>
  export default pdfParse
}
