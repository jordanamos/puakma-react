# ci-cd

Everything CI needs to deploy this frontend to a Puakma app with vortex-cli, in one folder.
This folder is the vortex workspace
(`VORTEX_HOME`) while the pipeline runs, so vortex clones the app into it and reads
`config/servers.ini` from it.

| File | What it is |
|---|---|
| `azure-pipelines.yaml` | The Azure Pipelines definition. Reusable unchanged in any frontend repo: it contains no app-specific values. |
| `config/servers.ini` | The vortex server definitions CI uses (host, port, backend, paths). **No credentials**, so it is safe to commit. One section per server. |

Clones made during a run land in this folder under `<host>/<group>/<app>/` and are ignored
by git, along with `.lib/`, `.pma` manifests and lock files.

## Set up in Azure DevOps

1. Make sure `package.json` has `"puakma": { "server": "<section>", "app": "group/app" }` and
   `config/servers.ini` here has that section. This is the one place the target is defined;
   the pipeline runs `npm run deploy`, which reads it.
2. Pipelines > New pipeline > your repo > **Existing Azure Pipelines YAML file** > path
   `/ci-cd/azure-pipelines.yaml`.
3. Edit > Variables, add the secrets `vortexUsername` and `vortexPassword`. Optional
   overrides: `serverName`, `appGroup`, `appName` (never an app id; ids change). Values
   defined inside the YAML cannot be overridden at queue time, which is why it defines none.
4. Run it. It fails fast if the target is not configured; otherwise it clones the app by
   `group/name`, resolves the numeric id with `vortex list ... -x`, builds, and pushes
   `bundle.js` and `index`. Read the two `OK via gateway (... journaled ...)` lines; a refusal
   names the missing role.

## Which identity

Use the server's gateway identity, the same one vortex uses locally. It holds
`GatewayDesignWrite` and nothing more than it needs, every push is journalled so
`vortex undo` can roll a bad bundle back, and a `protected = true` production server demands
the server name typed back, which no pipeline can do. CI deploys to dev; a person promotes.

## Adding a server

Append a section to `config/servers.ini` (name and `host`; the `[DEFAULT]` block carries the
rest) and name it in `package.json` (`puakma.server`) or in a pipeline's `serverName`. Credentials stay in secrets;
vortex reads `VORTEX_USERNAME` / `VORTEX_PASSWORD` for any server.
