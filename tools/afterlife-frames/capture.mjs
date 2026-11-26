#!/usr/bin/env node
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const INDEX = path.join(ROOT, 'index.html');
const THREE_VERSION = '0.160.0';
const PLAYWRIGHT_VERSION = '1.56.1';
const SCRIPT = fileURLToPath(import.meta.url);

function help() {
  console.log(`Afterlife frame capture

Usage:
  node tools/afterlife-frames/capture.mjs --list
  node tools/afterlife-frames/capture.mjs --key <death-key> --times 0,2,5 --blood on,off --out <dir>

Options:
  --key      Death key from DMK
  --times    Comma-separated seconds to render
  --blood    Comma-separated settings: on, off (default: on,off)
  --out      Output directory for PNGs and contact sheets
  --list     Print all death keys from DMK
  --help     Show this help
`);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--list') args.list = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else if (['--key', '--times', '--blood', '--out'].includes(arg)) {
      if (!argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error(`Missing value for ${arg}`);
      args[arg.slice(2)] = argv[++i];
    } else throw new Error(`Unknown option: ${arg}`);
  }
  return args;
}

function deathKeys(html) {
  const match = html.match(/const\s+DMK\s*=\s*\[([\s\S]*?)\];/);
  if (!match) throw new Error('Could not find DMK in index.html');
  return [...match[1].matchAll(/\[\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\]/g)].map((item) => item[1]);
}

function npmCli() {
  const nodeDir = path.dirname(process.execPath);
  const candidates = [
    process.env.npm_execpath,
    path.join(nodeDir, 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    path.resolve(nodeDir, '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function bootstrapPlaywright(argv) {
  if (process.env.AFTERLIFE_PLAYWRIGHT_BOOTSTRAPPED === '1') return null;
  const cli = npmCli();
  if (!cli) throw new Error('npm was not found next to Node.js. Install Node.js with npm, then retry.');
  const child = spawnSync(process.execPath, [cli,
    'exec', '--yes', `--package=playwright@${PLAYWRIGHT_VERSION}`, '--', process.execPath, SCRIPT, ...argv,
  ], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, AFTERLIFE_PLAYWRIGHT_BOOTSTRAPPED: '1' },
  });
  if (child.error) throw child.error;
  return child.status ?? 1;
}

function findPlaywright() {
  const require = createRequire(import.meta.url);
  const isUsable = (api) => {
    try { return fs.existsSync(api.chromium.executablePath()); } catch { return false; }
  };
  try {
    const local = require('playwright');
    if (isUsable(local) || require('playwright/package.json').version === PLAYWRIGHT_VERSION) return local;
  } catch {}

  // Prefer the package selected by `npm exec` when this script was bootstrapped.
  const pathCandidates = [];
  for (const entry of (process.env.PATH || '').split(path.delimiter)) {
    const bin = path.join(entry, process.platform === 'win32' ? 'playwright.cmd' : 'playwright');
    if (!fs.existsSync(bin)) continue;
    const candidate = path.resolve(entry, '..', 'playwright');
    try {
      const packageRequire = createRequire(path.join(candidate, 'package.json'));
      const api = packageRequire('playwright');
      const version = packageRequire('./package.json').version;
      if (version === PLAYWRIGHT_VERSION) return api;
      if (isUsable(api)) pathCandidates.push(api);
    } catch {}
  }
  if (pathCandidates.length) return pathCandidates[0];

  const cacheDirs = [
    process.env.npm_config_cache,
    process.env.NPM_CONFIG_CACHE,
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'npm-cache'),
    path.join(os.homedir(), '.npm'),
  ].filter(Boolean).map((cache) => path.join(cache, '_npx'));
  const cached = [];
  for (const cacheDir of new Set(cacheDirs)) {
    let entries = [];
    try { entries = fs.readdirSync(cacheDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()); } catch {}
    for (const entry of entries) {
      const packageJson = path.join(cacheDir, entry.name, 'node_modules', 'playwright', 'package.json');
      if (!fs.existsSync(packageJson)) continue;
      try {
        const packageRequire = createRequire(packageJson);
        const api = packageRequire('playwright');
        const version = packageRequire('./package.json').version;
        cached.push({ api, version });
      } catch {}
    }
  }
  const ready = cached.find(({ api }) => isUsable(api));
  if (ready) return ready.api;
  const pinned = cached.find(({ version }) => version === PLAYWRIGHT_VERSION);
  if (pinned) return pinned.api;

  return null;
}

function run(command, args, options = {}) {
  const child = spawnSync(command, args, { encoding: 'utf8', ...options });
  if (child.error) throw child.error;
  if (child.status !== 0) {
    const detail = [child.stdout, child.stderr].filter(Boolean).join('\n').trim();
    throw new Error(`${command} exited with ${child.status}${detail ? `:\n${detail}` : ''}`);
  }
  return child.stdout || '';
}

function prepareThree() {
  const cacheDir = path.join(os.tmpdir(), 'afterlife-frames-cache', `three-${THREE_VERSION}`);
  const packageDir = path.join(cacheDir, 'package');
  const moduleFile = path.join(packageDir, 'build', 'three.module.min.js');
  if (fs.existsSync(moduleFile)) return packageDir;

  const cli = npmCli();
  if (!cli) throw new Error('npm was not found next to Node.js. Install Node.js with npm, then retry.');
  fs.mkdirSync(cacheDir, { recursive: true });
  run(process.execPath, [cli, 'pack', `three@${THREE_VERSION}`, '--pack-destination', cacheDir], { cwd: ROOT });
  const tarball = fs.readdirSync(cacheDir).find((name) => name.startsWith(`three-${THREE_VERSION}`) && name.endsWith('.tgz'));
  if (!tarball) throw new Error(`npm pack did not produce three-${THREE_VERSION}.tgz`);
  run('tar', ['-xzf', path.join(cacheDir, tarball), '-C', cacheDir], { cwd: ROOT });
  if (!fs.existsSync(moduleFile)) throw new Error(`Three.js module was not found at ${moduleFile}`);
  return packageDir;
}

function mimeType(file) {
  const ext = path.extname(file).toLowerCase();
  return ({
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
    '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.glb': 'model/gltf-binary',
  })[ext] || 'application/octet-stream';
}

function startServer() {
  const server = http.createServer((req, res) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname); }
    catch { res.writeHead(400).end('Bad request'); return; }
    if (pathname === '/') pathname = '/index.html';
    const file = path.resolve(ROOT, `.${pathname}`);
    if (!file.startsWith(`${ROOT}${path.sep}`) && file !== INDEX) { res.writeHead(403).end('Forbidden'); return; }
    fs.readFile(file, (error, body) => {
      if (error) { res.writeHead(error.code === 'ENOENT' ? 404 : 500).end('Not found'); return; }
      res.writeHead(200, { 'content-type': mimeType(file), 'cache-control': 'no-store' });
      res.end(body);
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({ server, origin: `http://127.0.0.1:${address.port}` });
    });
  });
}

const HOOK = `
    window.__h={
      enter:()=>Reaper.enter(),
      ready:()=>Boolean(Reaper.on&&THREE&&renderer&&renderer.domElement.isConnected&&scene&&camera&&blood&&dth),
      mature:()=>{SET.matureMode=true;showMatureMode()},
      setBlood:on=>blood.set(on),
      unlock:key=>OPEN.add(key),
      practice:key=>practice(key),
      freeze:value=>{timeScale=value},
      frameAt:seconds=>{dth.t=seconds;dth.step(0);renderer.render(scene,camera);return renderer.domElement.toDataURL('image/png')},
      deathKeys:()=>DMK.map(([key])=>key),
      get dth(){return dth},
      get blood(){return blood},
      get matureMode(){return SET.matureMode}
    };
`;

function injectHook(html) {
  const anchor = /^[\t ]*const bindPose=G=>[^\r\n]*;\r?$/m;
  const matches = html.match(anchor) || [];
  if (matches.length !== 1) throw new Error(`Expected exactly one bindPose injection point, found ${matches.length}`);
  return html.replace(anchor, (line) => `${line}\n${HOOK.trimEnd()}`);
}

function safePart(value) {
  return String(value).replace(/[^a-zA-Z0-9.-]+/g, '-').replace(/^-+|-+$/g, '') || 'frame';
}

async function makeContactSheet(browser, frames, output) {
  const columns = Math.min(3, frames.length);
  const rows = Math.ceil(frames.length / columns);
  const thumbW = 480;
  const thumbH = 270;
  const labelH = 34;
  const sheet = await browser.newPage({ viewport: { width: columns * thumbW, height: rows * (thumbH + labelH) }, deviceScaleFactor: 1 });
  try {
    await sheet.setContent('<!doctype html><html><body style="margin:0;background:#10131c;color:#f5f5f5;font:14px system-ui"></body></html>');
    const data = frames.map(({ file, seconds }) => ({ file: fs.readFileSync(file).toString('base64'), seconds }));
    await sheet.evaluate(({ frames: items, columns: cols, thumbW: width, thumbH: height, labelH: label }) => {
      const canvas = document.createElement('canvas');
      canvas.width = cols * width;
      canvas.height = Math.ceil(items.length / cols) * (height + label);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#10131c'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      return Promise.all(items.map((item, index) => new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
          const x = (index % cols) * width;
          const y = Math.floor(index / cols) * (height + label);
          ctx.drawImage(image, x, y, width, height);
          ctx.fillStyle = '#10131c'; ctx.fillRect(x, y + height, width, label);
          ctx.fillStyle = '#f5f5f5'; ctx.fillText(`${item.seconds}s`, x + 10, y + height + 23);
          resolve();
        };
        image.onerror = reject;
        image.src = `data:image/png;base64,${item.file}`;
      }))).then(() => {
        document.body.appendChild(canvas);
        document.body.dataset.width = String(canvas.width);
        document.body.dataset.height = String(canvas.height);
      });
    }, { frames: data, columns, thumbW, thumbH, labelH });
    await sheet.locator('canvas').screenshot({ path: output });
  } finally { await sheet.close(); }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) { help(); return 0; }
  const html = fs.readFileSync(INDEX, 'utf8');
  const keys = deathKeys(html);
  if (options.list) { console.log(keys.join('\n')); return 0; }
  if (!options.key || !options.times || !options.out) {
    help(); throw new Error('--key, --times, and --out are required unless --list is used');
  }
  if (!keys.includes(options.key)) throw new Error(`Unknown death key "${options.key}". Use --list to see DMK keys.`);
  const times = options.times.split(',').map((part) => Number(part.trim()));
  if (!times.length || times.some((time) => !Number.isFinite(time) || time < 0)) throw new Error('--times must contain non-negative numbers');
  const blood = (options.blood || 'on,off').split(',').map((item) => item.trim().toLowerCase());
  if (!blood.length || blood.some((item) => !['on', 'off'].includes(item))) throw new Error('--blood accepts comma-separated on and off values');

  const playwright = findPlaywright();
  if (!playwright) {
    const status = bootstrapPlaywright(process.argv.slice(2));
    if (status === null) throw new Error('Playwright is unavailable. Run `npx playwright install chromium` and retry.');
    return status;
  }

  const output = path.resolve(process.cwd(), options.out);
  fs.mkdirSync(output, { recursive: true });
  const errorFile = path.join(output, `${safePart(options.key)}__errors.json`);
  let server;
  let browser;
  const errors = [];
  try {
    const threeDir = prepareThree();
    ({ server } = await startServer());
    const listening = server.address();
    const origin = `http://127.0.0.1:${listening.port}`;
    browser = await playwright.chromium.launch({
      headless: true,
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    });

    for (const setting of blood) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
      const page = await context.newPage();
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push({ type: 'console', text: message.text(), location: message.location(), blood: setting });
      });
      page.on('pageerror', (error) => errors.push({ type: 'exception', text: error.stack || error.message, blood: setting }));
      await page.route('**/*', async (route) => {
        const url = route.request().url();
        if (url === `${origin}/index.html`) {
          const response = await route.fetch();
          return route.fulfill({ response, body: injectHook(await response.text()) });
        }
        if (url.startsWith(`${origin}/`)) {
          const pathname = new URL(url).pathname;
          if (pathname === '/grand-piano.sf2') return route.fulfill({ status: 200, contentType: 'application/octet-stream', body: Buffer.alloc(0) });
          if (pathname === '/sounds/sounds.json') return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
          if (pathname.startsWith('/sounds/')) return route.fulfill({ status: 200, contentType: 'audio/mp4', body: Buffer.alloc(0) });
          return route.continue();
        }
        if (url.startsWith(`https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/`)) {
          const relative = decodeURIComponent(url.slice(`https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/`.length));
          const local = path.resolve(threeDir, relative);
          if (local.startsWith(`${threeDir}${path.sep}`) && fs.existsSync(local)) {
            return route.fulfill({ status: 200, contentType: mimeType(local), body: fs.readFileSync(local) });
          }
          errors.push({ type: 'resource', text: `Three.js resource not found: ${relative}`, blood: setting });
          return route.abort();
        }
        if (url.startsWith('https://fonts.googleapis.com/')) return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
        if (url.startsWith('https://fonts.gstatic.com/')) return route.fulfill({ status: 200, contentType: 'font/woff2', body: Buffer.alloc(0) });
        return route.fulfill({ status: 204, body: '' });
      });

      await page.goto(`${origin}/index.html`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
      await page.evaluate(() => Reaper.enter());
      await page.waitForFunction(() => window.__h?.ready(), undefined, { timeout: 120_000 });
      await page.evaluate(({ key, setting }) => {
        window.__h.mature();
        window.__h.setBlood(setting === 'on');
        window.__h.unlock(key);
        window.__h.practice(key);
      }, { key: options.key, setting });
      await page.waitForFunction((key) => window.__h?.dth?.m === key, options.key, { timeout: 30_000 });
      await page.evaluate(() => window.__h.freeze(1e-4));

      const frames = [];
      for (const seconds of times) {
        const filename = `${safePart(options.key)}__blood-${setting}__t-${safePart(seconds)}.png`;
        const file = path.join(output, filename);
        const dataUrl = await page.evaluate((time) => window.__h.frameAt(time), seconds);
        fs.writeFileSync(file, Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64'));
        frames.push({ file, seconds });
        console.log(`Saved ${file}`);
      }
      const contactSheet = path.join(output, `${safePart(options.key)}__contact-sheet__blood-${setting}.png`);
      await makeContactSheet(browser, frames, contactSheet);
      console.log(`Saved ${contactSheet}`);
      await context.close();
    }
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise((resolve) => server.close(resolve));
    fs.writeFileSync(errorFile, `${JSON.stringify(errors, null, 2)}\n`);
  }
  if (errors.length) {
    console.error(`Captured ${errors.length} browser error(s); details: ${errorFile}`);
    for (const item of errors) console.error(`[${item.type}] ${item.text}`);
    return 1;
  }
  console.log(`No console errors or uncaught exceptions. Details: ${errorFile}`);
  return 0;
}

main().then((status) => { process.exitCode = status; }).catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
