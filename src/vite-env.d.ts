/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_REMOTE_AUTH_BRIDGE_MODE?: "uner" | "json";
  readonly VITE_STM_REMOTE_COMMAND_MODE?: "legacy-hex" | "json";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
