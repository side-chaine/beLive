/**
 * Ambient type declarations for @libraz/libsonare WASM module
 * Placed in .d.ts to avoid module augmentation restrictions in .ts files
 */
declare module '@libraz/libsonare/wasm?url' {
  const url: string;
  export default url;
}

