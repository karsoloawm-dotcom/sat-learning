# sat-learning

## Deploying

1. In Netlify, choose **Add new project > Import an existing project**.
2. Choose GitHub, connect `karsoloawm-dotcom/sat-learning`, and select `main`
   as the production branch.
3. Deploy the project. Netlify reads the build command, publish directory,
   Node.js version, and cache headers from `netlify.toml`.

To verify the static build locally, run `node tools/build-site.mjs`. It recreates
`dist/` from an explicit list of runtime files. Serve it locally with
`python -m http.server --bind 127.0.0.1 --directory dist`.
