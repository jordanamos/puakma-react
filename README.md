# puakma-react

[![Build Status](https://dev.azure.com/amostj/puakma-react/_apis/build/status%2Fjordanamos.puakma-react?branchName=main)](https://dev.azure.com/amostj/puakma-react/_build/latest?definitionId=20&branchName=main)

A React front end for a Puakma Tornado app. One esbuild bundle served as a RESOURCE, talking
to a JSON ACTION. Plain Puakma: nothing on the server is modified or extended.

Two halves: **this repo** (React, esbuild, CI) and **the Puakma app**
(`puakma/puakma-react-<version>.pmx`: pages, the `v1` API, shared code, keywords, roles).

## What it does

1. `npm run deploy` builds `src/` into `bundle.js`, pushes it to your app with vortex-cli and
   writes the build id into the app's `ClientBuild` keyword. Same command locally and in CI.
2. The `index` page serves `<div id="root">` and `bundle.js?v=<ClientBuild>`. Every deploy is a
   new URL, so browsers and CDNs never serve a stale bundle.
3. The `v1` ACTION is the JSON API: `/v1/<resource>[/<id>]` with GET/POST/PUT/DELETE, replying
   `{"status":"ok","data":..}` or `{"status":"error","code":..,"message":..}` with real HTTP codes.
4. `src/api.ts` is the only fetch path. It unwraps the envelope, sends the browser to login on
   401, and reloads an open tab once when the server reports a newer build.
5. Puakma does login, sessions, access control and error pages (`login`, `403`, `404`, `500`).
   You write none of it.
6. `ci-cd/azure-pipelines.yaml` runs `npm run deploy` on every push to `main`.

## What you gain

- A modern React UI on Puakma, deployed with one command.
- Cache busting and stale-client reload with no extra work.
- Auth and sessions from the server, not from your frontend.
- One target to configure (`package.json`), read by build, deploy and CI alike.
- Credentials never in the repo: vortex keyring or env vars locally, secret variables in CI.

## Setup

You need Node 20+, [vortex-cli](https://pypi.org/project/vortex-cli/) (`pip install vortex-cli`)
with a workspace (`VORTEX_HOME`), a Puakma Tornado server, and an identity that `vortex push`
may use (`GatewayDesignWrite` role on a gateway server).

1. **Create the app** on the server from the shipped `.pmx` (or import it in webdesign):
   ```bash
   vortex import -s dev -g mygroup -n myapp puakma/puakma-react-1.0.0.pmx
   ```
2. **Point the repo at it.** Always group/name, never an app id:
   ```bash
   npm pkg set name=myapp-frontend puakma.server=dev puakma.app=mygroup/myapp
   ```
3. **Define `[dev]` in `servers.ini`**, same section name in both places: your vortex workspace
   `config/servers.ini` (local) and `ci-cd/config/servers.ini` (CI, no credentials, committed).
4. **Give vortex credentials.** Locally `vortex config --set-password -s dev` or export
   `VORTEX_USERNAME` / `VORTEX_PASSWORD`. In Azure DevOps create the pipeline from
   `ci-cd/azure-pipelines.yaml` and add the secrets `vortexUsername` and `vortexPassword`.
5. **Deploy:**
   ```bash
   npm install
   npm run deploy      # clones the app on first run, builds, pushes bundle.js, sets ClientBuild
   ```

Open `/mygroup/myapp.pma`. Using Claude Code? `/setup` in this repo walks through the steps above.

## Daily loop

```bash
npm run watch                                    # rebuild on save (local only, nothing deploys)
npm run deploy                                   # build + push bundle.js + set ClientBuild
vortex compile <id> && vortex push -s dev <id>   # after editing Java in the app clone
vortex log -n 20 -k                              # tail the server log
```

## What to edit

| Replace | Keep |
|---|---|
| `src/App.tsx` (starter screen) | `src/main.tsx`, `src/api.ts`, `build.mjs`, `deploy.mjs`, `ci-cd/` |
| `v1`'s `items` routes and in-memory store | `v1` itself (`parseRequest`, `authenticate`, `route`, `send`) |
| | `__layout`, `index`, `login`, `403`/`404`/`500`, `app.css`, `SharedFunctions`, `GlobalSecurity`, `SaveLogin` |

Keywords: `AppName` and `AppVersion` are yours to set in webdesign; `ClientBuild` is set by
`npm run deploy`, never by hand. Read one in Java with
`SharedFunctions.keyword(pSession, "AppName", "default")`, in a page with
`<P@Computed name="$X" useKeyword="X" @P>`.

Rules: never edit `bundle.js` by hand; no inner or anonymous classes and no lambdas in Java
(one class per element); roles, app parameters and `AnonymousAccess` are set in webdesign,
vortex has no command for them.
