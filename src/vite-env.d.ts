/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />
/// <reference types="vite-plugin-pwa/client" />

declare module '*.woff2?datauri' {
  const dataUri: string;
  export default dataUri;
}
