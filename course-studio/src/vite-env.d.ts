/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** On-prem DGX/vLLM API token — provided via .env (gitignored). */
  readonly VITE_DGX_API_KEY?: string
  /** OpenAI API key for the provider preset — provided via .env (gitignored). */
  readonly VITE_OPENAI_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
