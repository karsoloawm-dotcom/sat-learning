# sat-learning

## Deploying

### Cloudflare Workers

In the `sat-learning` Worker, open **Settings > Build** and use these settings.
The build command creates `dist/` before Wrangler publishes the static files.

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Root directory | `/` |
| Build command | `node tools/build-site.mjs` |
| Deploy command | `npx wrangler deploy` |
| Build variable | `NODE_VERSION=22` |

To validate the Wrangler configuration locally on Node 22 without deploying, run
`node tools/build-site.mjs && npx wrangler deploy --dry-run`.

### Cloudflare Pages alternative

Connect this repository to Cloudflare Pages using Git integration. Use these
settings with automatic production deployments enabled so merges to `main`
deploy automatically. Set preview branches to **None** for production-only deploys.

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Build command | `node tools/build-site.mjs` |
| Build output directory | `dist` |
| Environment variable | `NODE_VERSION=20` |

The static build runs with Node 18+ and needs no package installs. It recreates
`dist/` from an explicit list of runtime files. Serve it locally with
`python -m http.server --bind 127.0.0.1 --directory dist`.
