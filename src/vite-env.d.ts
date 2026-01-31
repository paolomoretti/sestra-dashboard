/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

// Build timestamp constants injected by Vite
declare const __BUILD_TIMESTAMP__: string;
declare const __BUILD_DATE__: string;

