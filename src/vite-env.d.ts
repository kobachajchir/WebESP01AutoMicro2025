/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_REMOTE_AUTH_BRIDGE_MODE?: "uner" | "json";
  readonly VITE_STM_REMOTE_COMMAND_MODE?: "legacy-hex" | "json";
  readonly VITE_INTERNET_PROBE_URL?: string;
  readonly VITE_HD_MODEL_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
