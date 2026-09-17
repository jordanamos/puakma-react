// Constants injected by build.mjs via esbuild `define`. Read-only, frozen at build time.
declare const __BUILD__: {
  version: string;   // package.json version
  commit: string;    // git short SHA ("" outside a repo)
  dirty: boolean;    // uncommitted changes at build time
  number: string;    // CI build number (BUILD_NUMBER), "" locally
  time: string;      // ISO timestamp
  id: string;        // short build id: the ClientBuild keyword value and the bundle.js?v= cache-buster
};
declare const __BUILD_LABEL__: string; // e.g. "0.1.0 (a1b2c3d) build 142"
