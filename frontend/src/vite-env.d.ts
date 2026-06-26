/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Backend base URL for API calls. Empty/undefined means same-origin, which is
   * correct when FastAPI serves the built SPA. Set this (e.g. to a deployed
   * backend URL) when building the Android APK, which bundles the SPA alone.
   */
  readonly VITE_API_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
