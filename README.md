# sat-learning

## Deploying

Connect this repository to Cloudflare Pages using Git integration. Use these
settings with automatic production deployments enabled so merges to `main`
deploy automatically. Set preview branches to **None** for production-only deploys.

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Build command | `node tools/build-site.mjs` |
| Build output directory | `dist` |
| Environment variable | `NODE_VERSION=20` |

The build runs with Node 18+ and needs no package installs. It recreates
`dist/` from an explicit list of runtime files. Serve it locally with
`python -m http.server --bind 127.0.0.1 --directory dist`.
