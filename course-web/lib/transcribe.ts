// Audio/video transcription.
//
// This is an internal, self-hosted deployment: content is only ever sent to our
// own infrastructure (the DGX Spark vLLM for text generation) — never to any
// third-party API. The DGX stack does text generation, not speech-to-text, so
// there is no transcription backend. Audio/video uploads are therefore not
// transcribed; callers degrade gracefully and ask for a text/PDF/doc source.
//
// If an on-prem/self-hosted STT service is added later, wire it in here.

export function isTranscriptionEnabled(): boolean {
  return false
}

/**
 * Audio/video transcription is unavailable in this deployment. Returns a clear
 * error string (never throws) so callers can surface it instead of crashing the
 * upload. Makes no network calls.
 */
export async function transcribeAudio(
  _buf: Buffer,
  _filename: string
): Promise<{ text: string; error: string | null }> {
  return {
    text: '',
    error:
      'Audio and video transcription isn’t available in this deployment. Please upload a PDF, document, or text file instead.',
  }
}
