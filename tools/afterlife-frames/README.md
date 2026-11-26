# Afterlife frame capture

Capture deterministic screenshots from any death replay without changing `index.html` or adding app dependencies. The script serves the repo over HTTP, intercepts the `index.html` response in Playwright, and adds a temporary `window.__h` hook after `const bindPose=`. It obtains Three.js 0.160.0 into a temporary system cache and serves that module to Chromium in place of jsDelivr. Missing optional music files are answered with empty success responses so unrelated audio assets do not create 404 console errors.

## Setup

Node.js and npm are required. Install Playwright's Chromium browser once:

```sh
npx --yes --package=playwright@1.56.1 playwright install chromium
```

The capture command uses `npm exec` to run Playwright from npm's cache. It does not create a `package.json`, edit `index.html`, or add dependencies to the repo.

## Use

```sh
node tools/afterlife-frames/capture.mjs --list
node tools/afterlife-frames/capture.mjs --key hollowerFeed --times 0,2,5,11.2 --blood on,off --out ./afterlife-frames
```

`--list` prints death keys from `DMK`. Captures are named by key, Blood setting, and time. One contact sheet is written for each Blood setting. Any console error or uncaught browser exception is saved in a `*__errors.json` file and makes the command exit non-zero.

To use a specific key's scenes repeatedly, change `--key`, `--times`, and `--out`. Only death keys listed by `DMK` are accepted.

`proof/` contains the contact sheets used to verify `hollowerFeed` (Mature-gated) and `hollower` (available without Mature mode), with Blood on and off.
