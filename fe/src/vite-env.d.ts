/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_RAGFLOW_CHAT_PATH: string;
  readonly VITE_RAGFLOW_SEARCH_PATH: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly MODE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Global variables injected by Vite
declare const __SHARED_STORAGE_DOMAIN__: string;
