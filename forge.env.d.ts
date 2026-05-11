/// <reference types="@electron-forge/plugin-vite/forge-vite-env" />

// Build-time constant injected by vite.main.config.ts via define
declare const __RPC_URL__: string;

declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}

declare module '*.scss' {
  const content: Record<string, string>;
  export default content;
}

declare module '*.png' {
  const src: string;
  export default src;
}
