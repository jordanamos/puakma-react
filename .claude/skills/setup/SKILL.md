---
name: setup
description: Wizard that sets up this puakma-react project against a Puakma server - checks vortex-cli (offers to install), collects server details, imports the template .pmx as a new app (or explains the manual webdesign import), fills package.json and servers.ini, stores credentials, runs the first deploy, and explains CI. Use when a user says "set up", "setup", "get started", "new project", "connect to my server", or runs /setup.
---

# puakma-react setup wizard

Walk the user through connecting this repo to a Puakma app, one step at a time. Ask before
every action that touches their machine or server, show the exact command you are about to
run, and never print credentials. Read `README.md` first if you have not; it explains every
piece you are configuring.

Two different situations, handled differently:

- **The user declines a step** (for example, will install vortex-cli later): continue, and add
  it to the **Manual steps** list you print at the end.
- **The account cannot do something** (a `Gateway*` role refusal, `vortex import` refused, no
  access to webdesign) or the server is missing something (the gateway): do not work around it, do not switch
  identities, and do not continue past it. State exactly what the user or an administrator
  has to do, then **stop and wait** ("Tell me when that is done and I will re-check"). When
  they say it is done, re-run the check that failed before moving on.

Work in the repo root (where `package.json` is). Keep a running summary of what is done.

## 0. Is this a fresh copy?

If `package.json` still says `"name": "puakma-react"` or the `puakma` block has `<server>` /
`<group>/<app>` placeholders, this is a fresh copy. Ask for:

- a package name (suggest `<app>-frontend`), then `npm pkg set name=<value>`;
- whether they want a git remote now (offer `git init` if there is no `.git`; never push
  anywhere without being asked).

## 1. vortex-cli

Run `vortex --version`. Two outcomes:

- **Present**: note the version and continue.
- **Missing**: explain that vortex-cli is how the bundle reaches the server (PyPI package
  `vortex-cli`, needs Python 3.11+). Offer `pip install vortex-cli` (or `pipx install
  vortex-cli` if pipx exists). If they decline, continue, and record in Manual steps: install
  vortex-cli, then re-run `/setup` or do steps 3 and 6 by hand.

Also run `node --version`; Node 20+ is required. If missing or older, say so and stop the
deploy-related steps (record in Manual steps).

## 2. Server details

Ask, with the README's prerequisites in mind:

| Ask for | Why |
|---|---|
| a short server name, e.g. `dev` | the `servers.ini` section name; used in `package.json` and CI |
| host name | e.g. `puakma.example.com` |
| port | default `80` (`443` if they serve TLS directly) |
| does the server run vortex's agent gateway app? | recommended (journal, undo, role gating); without it `backend = soap` works. If unsure, we will probe it in step 3 |
| the group and name the new app should have | e.g. `myteam/myapp`; lowercase, no spaces |
| the account vortex should use | user name only; the identity needs the `GatewayDesignWrite` role |

## 3. vortex workspace and servers.ini (local)

If `vortex config --output-workspace-path` fails, create a workspace: ask where (default
`~/vortex-cli-workspace`), then `VORTEX_HOME=<path> vortex --init`. Tell the user to export
`VORTEX_HOME` in their shell profile if they chose a non-default path.

Then add the server section with `vortex config --set <name> host <host>`, `--set <name> port
<port>`, `--set <name> backend gateway`, `--set <name> gateway_path vortex/gateway.pma`,
`--set <name> soap_path system/SOAPDesigner.pma`, `--set <name> webdesign_path
system/webdesign.pma`.

Credentials: offer `vortex config --set-password -s <name>` (keyring; prompts them, you never
see it). If they prefer environment variables, tell them the names: `VORTEX_USERNAME` and
`VORTEX_PASSWORD` (or the per-server `VORTEX_USERNAME_<NAME>` form, name upper-cased, non
alphanumerics as `_`). Do not ask for the password yourself.

Probe: `vortex config --check-gateway -s <name>`. It must report `backend: gateway`, a
negotiated gateway, and `GatewayDesignWrite yes`. Three failure modes, each a **stop and wait**:

- **No gateway on the server** (negotiation fails / the gateway app is absent): `vortex push`
  still works, over SOAPDesigner, so `npm run deploy` and CI work too; what is lost is the
  gateway's journal (`vortex undo`), deploy confirmation and the least-privilege roles, and
  the identity then needs SOAPDesigner/webdesign access instead. Offer the choice and wait:
  an administrator installs vortex's companion app `vortex/gateway` (vortex-cli README, "The
  Agent Gateway") and you re-probe, or you switch the section to SOAP now:
  `vortex config --set <name> backend soap` (in `ci-cd/config/servers.ini` too) and carry on.
- **Gateway present but the identity lacks `GatewayDesignWrite`** (or another named role):
  an administrator grants the role to that identity in the gateway app's Security page on
  *that* server. Wait, then re-probe.
- **Wrong credentials**: let the user fix them (step above), then re-probe.

## 4. Create the app on the server

Find the template export: `ls puakma/puakma-react-*.pmx` (take the highest version). Offer:

```bash
vortex import -s <name> -g <group> -n <app> puakma/puakma-react-<version>.pmx
```

`vortex import` runs over the server's SOAP designer, which a least-privilege gateway identity
may not have. If it is refused or errors, do not retry with other identities. Tell the user
the manual route and **wait**: in webdesign (`/system/webdesign.pma`), Import PMX, choose the
file, enter the group and name. The import carries the pages, actions, shared code, keywords,
app parameters and security state (AllowAccess = any logged-in user).

When they say it is done (or after a successful `vortex import`), confirm it exists:
`vortex list -s <name> -g <group> -n <app> --strict`. Do not move on until it does.

Optional: ask whether the app should be public (`AllowAccess = *`) or logged-in users only
(the default `!*`). That is set in webdesign, Security page; note it in Manual steps if they
want a change.

## 5. Point the repo at it

```bash
npm pkg set puakma.server=<name> puakma.app=<group>/<app>
```

Then `ci-cd/config/servers.ini`: add (or replace the sample `[dev]`) a section with the same
name and `host = <host>` (and `port` if not 80). The `[DEFAULT]` block carries the rest. This
file holds no credentials and is committed.

Set the `AppName` keyword to something friendlier than the group/name if they like:
`vortex --yes keyword -s <name> <id> -n AppName --values "<Display Name>"` (get `<id>` from
`vortex list ... --strict -x`). Never touch `ClientBuild`; deploy owns it.

## 6. First deploy

`npm install` (if `node_modules` is missing), then `npm run deploy`. Expect: a clone of the
app under the workspace, a build line with the build id, `Upload DATA of Design Object
'bundle.js' ... OK via gateway`, and the `ClientBuild` keyword update. Then tell them to open
`http://<host>/<group>/<app>.pma` and log in; the starter screen shows the build id and the
server's `AppVersion`.

If the push is refused with a `Gateway*` role name, that is the role gate working: report the
role, tell them an administrator must grant it on that server, and **wait**; re-run
`npm run deploy` when they say it is done.

## 7. CI (optional)

Ask whether they use Azure DevOps. If yes, point at `ci-cd/README.md`: create the pipeline
from `ci-cd/azure-pipelines.yaml`, add the secret variables `vortexUsername` and
`vortexPassword`; nothing else is needed because the pipeline reads `package.json` and
`ci-cd/config/servers.ini`. If they use something else, the pipeline is three steps (install
vortex-cli, `npm ci`, `npm run deploy` with `VORTEX_HOME=ci-cd` and the two secrets) and easy
to port.

## 8. Finish

Print:

1. what was configured (server name, app, workspace path, package name);
2. the **Manual steps** list (things the user chose to defer), with the exact commands or
   webdesign clicks; anything the account could not do was waited for, not deferred;
3. the daily loop from the README: edit `src/`, `npm run deploy`, `vortex log -n 20 -k`.

Rules while running this wizard: never print or echo passwords or `servers.ini` contents;
never run anything against a server the user has not named; never use `--reclone`; prefer
`group/name` over app ids everywhere.
