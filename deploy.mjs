// Build, then push bundle.js and index to the Puakma app with vortex-cli. One command, locally
// and in CI:   npm run deploy
//
// Reads the target from package.json:
//   "puakma": { "server": "dev", "app": "group/app" }
// server = a section name in vortex's servers.ini (your workspace locally, ci-cd/config in CI).
// Environment overrides, all optional: SERVER, APP_GROUP, APP_NAME, APP_DIR, VORTEX_HOME.
// Credentials are never read here: vortex takes them from its keyring or VORTEX_USERNAME /
// VORTEX_PASSWORD (CI secrets).
//
// Steps: locate the app clone under VORTEX_HOME (clone it if missing) -> node build.mjs ->
// vortex list -x for the id (ids change, so never stored) -> vortex push bundle.js ->
// set the ClientBuild keyword to the new build id (index.html uses it as bundle.js?v=..., and
// clients compare it with v1/ping to notice they are stale).
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
const server = process.env.SERVER ?? pkg.puakma?.server;
let [group, app] = [process.env.APP_GROUP, process.env.APP_NAME];
if (!group || !app) [group, app] = String(pkg.puakma?.app ?? "").split("/");
if (!server || !group || !app || String(server).startsWith("<") || group.startsWith("<")) {
  console.error('deploy: set "puakma": { "server": "...", "app": "group/app" } in package.json (or SERVER / APP_GROUP / APP_NAME)');
  process.exit(1);
}
const home = process.env.VORTEX_HOME ?? resolve(homedir(), "vortex-cli-workspace");

function vortex(args, opts = {}) {
  const r = spawnSync("vortex", ["--no-colour", ...args], { stdio: opts.capture ? ["inherit", "pipe", "inherit"] : "inherit", encoding: "utf8" });
  if (r.status !== 0) { console.error(`deploy: vortex ${args.join(" ")} failed`); process.exit(r.status ?? 1); }
  return (r.stdout ?? "").trim();
}

function findClone() {
  if (process.env.APP_DIR) return process.env.APP_DIR;
  if (!existsSync(home)) return null;
  const hits = readdirSync(home, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => resolve(home, d.name, group, app))
    .filter((p) => existsSync(resolve(p, "RESOURCE")));
  return hits.length === 1 ? hits[0] : null;
}

let appDir = findClone();
if (!appDir) {
  console.log(`deploy: no clone of ${group}/${app} under ${home}; cloning from ${server}`);
  vortex(["--yes", "clone", "--server", server, `${group}/${app}`]);
  appDir = findClone();
  if (!appDir) { console.error("deploy: clone did not produce a folder I can find; set APP_DIR"); process.exit(1); }
}
console.log(`deploy: ${group}/${app} on ${server} -> ${appDir}`);

execFileSync("node", [new URL("./build.mjs", import.meta.url).pathname], { stdio: "inherit", env: { ...process.env, APP_DIR: appDir } });

const id = vortex(["list", "--server", server, "-g", group, "-n", app, "--strict", "-x"], { capture: true }).split("\n")[0];
if (!/^\d+$/.test(id)) { console.error(`deploy: could not resolve the id of ${group}/${app} on ${server}`); process.exit(1); }
vortex(["push", "--server", server, id, "-n", "bundle.js"]);
const buildId = readFileSync(new URL("./.last-build", import.meta.url), "utf8").trim();
vortex(["--yes", "keyword", "--server", server, id, "-n", "ClientBuild", "--values", buildId]);
console.log(`deploy: done (${group}/${app} id ${id} on ${server}, ClientBuild ${buildId})`);
