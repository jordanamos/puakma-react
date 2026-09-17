// Bundles src/main.tsx into a cloned Puakma app's RESOURCE folder as bundle.js.js.
//
//   npm run build                         -> clone found from package.json "puakma.app" under VORTEX_HOME
//   APP_DIR=/path/to/clone npm run build  -> explicit clone path (CI does this)
//
// Deploy with `npm run deploy` (deploy.mjs), which also sets the app's ClientBuild keyword.
// Minify here. NEVER set MinifyLevel on the RESOURCE: the server's minifier (JSMin) predates ES2015.
import * as esbuild from "esbuild";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

// Where the app clone is. Resolution order:
//   1. APP_DIR                      explicit path to the clone (what CI sets)
//   2. APP_GROUP + APP_NAME         environment, else "puakma.app" ("group/app") in package.json,
//      located under VORTEX_HOME (vortex's default is ~/vortex-cli-workspace) as <host>/<group>/<app>
const APP_DIR = process.env.APP_DIR ?? locateClone();

function locateClone() {
  let group = process.env.APP_GROUP, app = process.env.APP_NAME;
  if (!group || !app) [group, app] = String(pkg.puakma?.app ?? "").split("/");
  if (!group || !app || group.startsWith("<")) {
    console.error('build: set APP_DIR, or APP_GROUP/APP_NAME, or "puakma": {"app": "group/app"} in package.json');
    process.exit(1);
  }
  const home = process.env.VORTEX_HOME ?? resolve(homedir(), "vortex-cli-workspace");
  const hits = existsSync(home)
    ? readdirSync(home, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => resolve(home, d.name, group, app))
        .filter((p) => existsSync(resolve(p, "RESOURCE")))
    : [];
  if (hits.length !== 1) {
    console.error(`build: expected one clone of ${group}/${app} under ${home}, found ${hits.length}. vortex clone it, or set APP_DIR.`);
    process.exit(1);
  }
  return hits[0];
}

// The RESOURCE is the design element named "bundle.js"; vortex stores it locally as
// bundle.js + an extension it derives from the content type via Python's mimetypes, which
// differs between machines (.js here, .mjs or .es elsewhere). Write to whatever file the clone
// has for that element, so push compares and uploads the file we actually built.
const RES_DIR = resolve(APP_DIR, "RESOURCE");
const existing = existsSync(RES_DIR)
  ? readdirSync(RES_DIR).filter((f) => f === "bundle.js" || f.startsWith("bundle.js."))
  : [];
if (existing.length > 1) {
  console.error(`build: more than one bundle.js* file in ${RES_DIR} (${existing.join(", ")}); remove the stale one`);
  process.exit(1);
}
const OUT = resolve(RES_DIR, existing[0] ?? "bundle.js.js");

// Build identity, injected as constants (see src/build.d.ts). esbuild itself keeps no build
// number, so this is assembled here: package version, git short SHA, build time, and the CI
// build number when the pipeline provides one (BUILD_NUMBER; Azure passes Build.BuildId).
function git(cmd) { try { return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch { return ""; } }
const BUILD = {
  version: pkg.version ?? "",
  commit: git("git rev-parse --short HEAD"),
  dirty: git("git status --porcelain") !== "",
  number: process.env.BUILD_NUMBER ?? "",
  time: new Date().toISOString(),
  id: "",
};
// Build id: short, URL-safe, unique per build. deploy.mjs stores it in the app's ClientBuild
// keyword, index.html uses it as bundle.js?v=<id>, and the client compares it with v1/ping to
// notice it is stale. Written to .last-build in this project (git-ignored) for deploy.mjs to read.
BUILD.id = createHash("sha256").update(JSON.stringify(BUILD)).digest("hex").slice(0, 10);
const BUILD_LABEL = [BUILD.version, BUILD.commit && `(${BUILD.commit}${BUILD.dirty ? "+" : ""})`, BUILD.number && `build ${BUILD.number}`]
  .filter(Boolean).join(" ");

const opts = {
  entryPoints: ["src/main.tsx"],
  bundle: true,
  outfile: OUT,
  format: "iife",
  target: ["es2020"],
  jsx: "automatic",
  minify: true,
  sourcemap: false,
  define: {
    "process.env.NODE_ENV": '"production"',
    __BUILD__: JSON.stringify(BUILD),
    __BUILD_LABEL__: JSON.stringify(BUILD_LABEL),
  },
  banner: { js: `/* ${pkg.name} ${BUILD_LABEL} id ${BUILD.id} ${BUILD.time} */` },
  legalComments: "none",
  logLevel: "info",
};

function writeBuildId() {
  writeFileSync(new URL("./.last-build", import.meta.url), BUILD.id);
  console.log(`build id ${BUILD.id} (${BUILD_LABEL || "no version info"})`);
}

if (process.argv.includes("--watch")) {
  const ctx = await esbuild.context({ ...opts, plugins: [{ name: "build-id", setup(b) { b.onEnd(writeBuildId); } }] });
  await ctx.watch();
  console.log("watching src/ -> " + OUT);
} else {
  await esbuild.build(opts);
  writeBuildId();
}
