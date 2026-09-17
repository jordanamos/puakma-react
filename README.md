# puakma-react

A React front end for a Puakma Tornado application: one esbuild bundle served as a RESOURCE,
talking to a JSON ACTION. Two halves make a template:

- **this repo**: the frontend project (React, esbuild, CI definition);
- **the Puakma app**: the server side (pages, the `v1` API action, shared code), shipped as
  `puakma/puakma-react-<version>.pmx`. Import it with webdesign to create your app.

Nothing on the server was modified or extended to make this work; it is plain Puakma.

## Layout

```
puakma/puakma-react-<ver>.pmx the Puakma app: import it into your server with webdesign
src/main.tsx                    keep: mounts <App/> into #root
src/api.ts                      keep: the only fetch path; knows the envelope, 401 handling and the body quirk
src/App.tsx                     EXAMPLE: a starter screen (me + items + build label). Replace with your app.
src/build.d.ts                  keep: types for the build constants injected by build.mjs
build.mjs                       keep: esbuild -> <app clone>/RESOURCE/bundle.js.js (+ a build id next to it)
deploy.mjs                      keep: clone if needed, build, push bundle.js, set the ClientBuild keyword (npm run deploy; CI runs the same)
tsconfig.json, package.json     npm run build | watch | typecheck | deploy; the "puakma" block names server + app
ci-cd/                          azure-pipelines.yaml, config/servers.ini, README with the setup steps
```

**One place to configure.** `package.json` holds the target, and build, deploy and CI all
read it:

```json
"puakma": { "server": "dev", "app": "mygroup/myapp" }
```

`server` is a section name in vortex's `servers.ini` (your own workspace locally,
`ci-cd/config/servers.ini` in CI: use the same section name in both). `app` is the app's
group and name. Credentials never go in the repo: locally vortex uses its keyring or
`VORTEX_USERNAME` / `VORTEX_PASSWORD`; in CI they are the two secret pipeline variables.
Environment variables `SERVER`, `APP_GROUP`, `APP_NAME`, `APP_DIR` override the file when
you need to, for example a second pipeline deploying the same repo to another server.

What is scaffolding and what is not, on both sides:

| Keep | Example, replace it |
|---|---|
| `__layout`, `index`, `login`, `403`/`404`/`500`, `app.css`, `SharedFunctions`, `GlobalSecurity`, `SaveLogin` | `v1`'s `items` routes and its in-memory store (keep `v1` itself: `parseRequest`, `authenticate`, `route`, `send`) |
| `main.tsx`, `api.ts`, `build.mjs`, `ci-cd/` | `App.tsx` (the starter screen) and the `Item` type in it |

The app holds only what the server executes:

| Element | Purpose |
|---|---|
| `__layout` PAGE | The one page with `<html>`/`<head>`/`app.css` and `<P@ChildPage @P>`. Every other page names it as `ParentPage`. |
| `index` PAGE | The shell: `<div id="root">` + `<script src="bundle.js?v=<P@Computed name="$ClientBuild" useKeyword="ClientBuild" @P>">`. App param `DefaultOpen=index`. |
| `login` PAGE | Puakma's own login form (`$LoginPage`, `UserName`, `Password`, `$RedirectTo`). App param `LoginPage=login`. |
| `403` `404` `500` PAGE | Served by the server for those errors. |
| `bundle.js` `app.css` RESOURCE | Build output, and the stylesheet the server-rendered pages share. Never edit the bundle by hand. |
| `v1` ACTION | The JSON API: `/v1/<resource>[/<id>]` + GET/POST/PUT/DELETE, `{"status":"ok","data":..}` / `{"status":"error","code":..,"message":..}` with real HTTP codes. `ping` and `me` are real; the `items` CRUD is an **example** backed by an in-memory store, there to show the pattern. `authenticate()` is the auth hook. |
| `GlobalSecurity` ACTION | Global pre-action (app param `OpenAction`), runs before every page render. A no-op with recipes in its comments. Never runs for `v1` or resources. |
| `SaveLogin` ACTION | SaveAction of `login`. A no-op: the server authenticates. Its comments show how to take over with `$BypassAuthenticators`. |
| `SharedFunctions` SHARED_CODE | Static helpers (strings, numbers, SQL, HTML, dates, hashing, request, keywords). |
| `README` `AGENTS` DOCUMENTATION | Copies of these two files. |

Security the app ships with: role `AllowAccess` = `!*` (any logged-in user); `AnonymousAccess=1`
on `__layout`, `login`, `403`, `404`, `500`, `app.css` and `v1`; app params `LoginPage=login`,
`DefaultOpen=index`, `OpenAction=GlobalSecurity`.

Which of those anonymous flags are load-bearing: `app.css` (the login page must style before
anyone is logged in), `__layout` (its parent), and `v1` (so it can answer 401 JSON instead of
the HTML login page). `login` does not strictly need it: the server presents the login page by
rewrite whenever access is denied, flag or not. `404` and `500` are only ever reached by users
who already passed AllowAccess. `403` is shown to logged-in users *without* access, so its flag
is what guarantees they see your page rather than the server's generic one. The template keeps
the flag on all of them because it is harmless and covers a public app (`AllowAccess = *`) too.

## Build identity and cache busting

esbuild keeps no build number, so `build.mjs` assembles one and injects it as constants
(`__BUILD__` and `__BUILD_LABEL__`, typed in `src/build.d.ts`): the `package.json` version, the
git short SHA (with `+` when the tree is dirty), the build time, `BUILD_NUMBER` from the
environment (the pipeline sets its build id), and a short `id` derived from all of that. The
label is also the first line of `bundle.js`, so `head -1` of the served bundle tells you what
is deployed.

The `id` does three jobs:

1. `deploy.mjs` writes it to the app's **`ClientBuild` keyword** right after pushing the bundle.
2. `index` reads that keyword into the bundle's URL:
   `bundle.js?v=<P@Computed name="$ClientBuild" useKeyword="ClientBuild" @P>`. New build, new
   URL, so browsers and any CDN fetch it fresh. Nothing in `index` is edited by hand or by the build.
3. `v1/ping` and `v1/me` return it as `clientBuild`. On start-up `api.ts` compares it with the
   id baked into the running bundle and reloads once if they differ, so a tab left open across
   a deploy picks up the new client (guarded against loops with `sessionStorage`).

## Keywords

Keywords are the app's settings, edited in webdesign (Keywords) and cached by the server
until `tell http cache flush`. The template defines two and reads them in three places:

| Keyword | Used by |
|---|---|
| `AppName` | `__layout`'s `<title>` (`<P@Computed name="$AppName" useKeyword="AppName" @P>`), and `v1/me` + `v1/ping` as `appName`, the starter screen's heading |
| `AppVersion` | `v1/me` + `v1/ping` as `appVersion`, and the version in the `.pmx` file name. Bump it when you ship |
| `ClientBuild` | Set by `npm run deploy`, never by hand: the deployed bundle's build id. `index` uses it as `bundle.js?v=`; `v1/ping` returns it for the stale-client reload |

Read one in Java with `SharedFunctions.keyword(pSession, "AppName", "default")`; in a page with
`<P@Computed name="$X" useKeyword="X" @P>`. Add your own the same way (feature flags, support address,
maintenance mode); never put secrets in keywords that a page merges.

## How it works

1. `/<group>/<app>.pma` opens `index`. Anonymous users are rewritten to `login`; after the POST
   the server redirects back. Logged-in users without AllowAccess get `403`.
2. `index` renders inside `__layout`, the browser fetches the bundle, React mounts.
3. React calls `v1/...` with relative URLs, so the session cookie rides along. `v1` parses
   method and path, runs `authenticate()` (logged in; mutating calls must be same-origin, as
   Puakma has no CSRF token), dispatches in `route()`, and replies with a JSON envelope.
   Non-200 replies are written with their own status line because Puakma's normal output path
   always answers 200.
4. A 401 (or an HTML reply from a protected element) makes `api.ts` send the browser to log in.
5. Logout is `index?OpenPage&logout`.

Reading input in `v1`: `getParameter()` for the query string, `getItemValue()` for form fields;
a JSON request body arrives in the `Data` item.

## Setup

Four things, once. Everything after that is `npm run deploy`. Using Claude Code? Run `/setup`
in this repo: a wizard that walks through everything below, installs vortex-cli if you let it,
and lists any step you chose to do by hand.

**Before you start** you need: Node 20+; [vortex-cli](https://pypi.org/project/vortex-cli/)
(`pip install vortex-cli`) with a workspace (`VORTEX_HOME`); a Puakma Tornado server; and an
identity on it that `vortex push` may use. With vortex's agent gateway app on the server
(`backend = gateway`, recommended: journalled pushes, `vortex undo`, least-privilege roles)
that identity needs the `GatewayDesignWrite` role; without it (`backend = soap`) pushes go
through SOAPDesigner and the identity needs access to it.

1. **Create the app on the server.** In webdesign, import `puakma/puakma-react-<version>.pmx` and give
   the new app the group and name you want, e.g. `mygroup/myapp`. The import carries the
   pages, actions, shared code, keywords, app parameters and the security state listed above.

2. **Make `package.json` yours.** Rename the package and name the target:
   ```bash
   npm pkg set name=myapp-frontend
   npm pkg set puakma.server=dev puakma.app=mygroup/myapp
   ```
   `server` is a section name in `servers.ini` (next step); `app` is the group and name you
   chose. Never an app id: ids change when an app is re-imported.

3. **Define the server in `servers.ini`**, in two places with the same section name:
   - `ci-cd/config/servers.ini` in this repo, for CI. It holds no credentials, so it is safe to
     commit. Add `[dev]` with `host = your.server.example.com`; the `[DEFAULT]` block already
     carries port, backend and paths.
   - `config/servers.ini` in your own vortex workspace, for local work (`vortex config --sample`
     prints a template if you have none).

4. **Give vortex credentials**, never in the repo:
   - locally: `vortex config --set-password -s dev` (keyring), or export `VORTEX_USERNAME` and
     `VORTEX_PASSWORD`;
   - in Azure DevOps: create the pipeline from `ci-cd/azure-pipelines.yaml` and add the secret
     variables `vortexUsername` and `vortexPassword` (`ci-cd/README.md` has the clicks).

Then:

```bash
npm install
npm run deploy            # clones the app on first run, builds, pushes bundle.js, sets ClientBuild
```

From then on every push to `main` does the same through CI. Environment variables `SERVER`,
`APP_GROUP`, `APP_NAME` and `APP_DIR` override `package.json` when you need to, for example a
second pipeline deploying the same repo to another server.

vortex has no command for roles, permissions, app parameters or `AnonymousAccess`. Set those
in webdesign (the app's Security and Settings pages). An app created with `vortex new app`
has **no roles at all** until you add `AllowAccess`; the imported `.pmx` carries the template's
security state with it.

## Daily loop

```bash
npm run watch            # rebuild on save (local only: nothing deploys on save on a gateway server)
npm run deploy           # build + push bundle.js + set the ClientBuild keyword
vortex compile <id> && vortex push -s <server> <id>       # after editing Java (id: vortex list -g -n --strict -x)
vortex log -n 20 -k      # tail the server log
```

Java rules: no inner or anonymous classes, no lambdas (one class per element); match the
server's class version; never push a failed build.

## CI

`ci-cd/` holds everything: the Azure definition, `config/servers.ini` (no credentials), and a
README with the setup clicks. The pipeline installs vortex-cli and runs `npm run deploy`, the
same command you run locally, with `ci-cd/` as the vortex workspace. The only required
pipeline variables are the two secrets, `vortexUsername` and `vortexPassword`; `serverName`,
`appGroup` and `appName` are optional overrides of `package.json`. Use a least-privilege
gateway identity; let CI deploy to a dev server and promote to production by hand behind
vortex's typed-name confirmation (`protected = true` in `servers.ini`).

## Things to know

- **Caching.** Browsers, and any CDN in front of the server, cache `bundle.js` by URL for hours
  regardless of login. That is why the URL carries the `ClientBuild` id (see above). A CDN
  cache rule bypassing `/*.pma/*` removes the issue entirely.
- **Minify with esbuild only.** Puakma's `MinifyLevel` uses JSMin, which corrupts modern JS.
- **Body-less PUT/DELETE with a Content-Type header return 500** (server body parser). `api.ts`
  always sends a JSON body on non-GET; external clients must too.
- **Saving App Settings in webdesign rewrites the app params from that form.** An empty
  OpenAction box deletes `OpenAction=GlobalSecurity`. Check the app's parameters afterwards.
- **A wrong permission entry can make every request to the app take ~15 s** and starve the
  server's system DB pool. Check the app's Security page before anything else.
- **`vortex new object --update` replaces the element's whole parameter set.** Setting
  `--parent-page` or `--save-action` on a page drops its `AnonymousAccess=1`; re-add it in
  webdesign afterwards (the login rewrite still works without it, so the loss is silent).
- **`vortex find` and `push` read the local `.pma`.** Objects created elsewhere need
  `vortex pull`; `--reclone` re-clones every app from that server, so use it with care.
- No source maps shipped; no SSR; no WebSocket/SSE/HTTP2 in the server (poll, or proxy);
  client-side routing needs hash routing or an `HTTPHeaderProcessor`; one bundle, no code
  splitting (switch esbuild to `splitting`+`esm` and ship chunks as RESOURCEs if it grows).
- Sources could instead live in the app as DOCUMENTATION elements (never RESOURCEs: those are
  downloadable by any user of the app, and `ResourceAccess` widens access rather than
  restricting it). That is a self-contained mode for small apps; a repo is the recommended one.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Blank page | Bundle not pushed, or `ClientBuild` keyword not updated | `npm run deploy` (does both) |
| Old code keeps running | Cached bundle and `ClientBuild` not updated | `npm run deploy`; if inside an iframe, reload the frame itself |
| Login page for everything, even logged in | AllowAccess has no permissions | add `!*` (or users/groups) to AllowAccess in webdesign |
| Login page unstyled | `app.css` lost `AnonymousAccess=1` | set the design parameter again |
| `Action Done: <date>` | Stale compiled class | `vortex compile` then push that element |
| `v1` 500 with empty body on DELETE/PUT | Content-Type without a body | send `{}` |
| `GlobalSecurity` not running | App Settings saved with an empty field | set app param `OpenAction=GlobalSecurity` |
| `Unable to determine file type for 'application/javascript'` | vortex maps `text/javascript` only | use `text/javascript` |
