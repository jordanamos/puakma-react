# Agent rules

- `README.md` explains the project; read it before changing anything.
- Never edit `RESOURCE/bundle.js.js` by hand or set the `ClientBuild` keyword by hand: `npm run deploy` does both. `index` needs no push after a build.
- Address Puakma apps by `group/name`, never by id.
- Deploying is `vortex push`; nothing deploys on save. Ask before pushing to any server the owner has not named as the dev target.
- Browser checks belong to the owner; do not install headless browsers or render tooling.
- Never print credentials, `servers.ini` passwords or `.pma` contents.
