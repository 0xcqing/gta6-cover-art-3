import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const screenshotDir = join(root, 'screenshots');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const serverPort = 8099;
const debugPort = 9333;
const base = `http://127.0.0.1:${serverPort}`;
const maxBytes = 262144;
const delay = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));

const shots = [
  { name: '1-landscape-cover.jpg', mode: 'landscape', width: 1280, height: 720 },
  { name: '2-square-cover.jpg', mode: 'square', width: 1080, height: 1080 },
  { name: '3-portrait-cover.jpg', mode: 'portrait', width: 1024, height: 1280 },
  { name: '4-editor.jpg', mode: 'editor', width: 1280, height: 720 },
];

class CdpClient {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 0;
    this.pending = new Map();
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const entry = this.pending.get(message.id);
        if (!entry) return;
        this.pending.delete(message.id);
        if (message.error) entry.reject(new Error(message.error.message));
        else entry.resolve(message.result);
      }
    });
    socket.addEventListener('close', () => {
      for (const entry of this.pending.values()) entry.reject(new Error('Chrome closed the debug session.'));
      this.pending.clear();
    });
  }

  send(method, params = {}) {
    const id = this.nextId += 1;
    return new Promise((resolveSend, rejectSend) => {
      this.pending.set(id, { resolve: resolveSend, reject: rejectSend });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket.close();
  }
}

function connectSocket(url) {
  return new Promise((resolveConnect, rejectConnect) => {
    const socket = new WebSocket(url);
    socket.addEventListener('open', () => resolveConnect(socket), { once: true });
    socket.addEventListener('error', () => rejectConnect(new Error('Could not open the DevTools socket.')), { once: true });
  });
}

async function waitForHttp(url, timeout = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {
      await delay(120);
    }
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function debugPage() {
  const started = Date.now();
  while (Date.now() - started < 30000) {
    try {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
      if (response.ok) {
        const targets = await response.json();
        const page = targets.find((target) => target.type === 'page' && target.webSocketDebuggerUrl);
        if (page) return page;
      }
    } catch {
      await delay(150);
    }
  }
  throw new Error('Timed out waiting for Chrome.');
}

async function evaluate(client, expression) {
  const result = await client.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || 'Page evaluation failed.');
  }
  return result.result.value;
}

async function waitForReady(client) {
  const started = Date.now();
  while (Date.now() - started < 30000) {
    try {
      if (await evaluate(client, 'window.__shotReady === true')) return;
    } catch {
      await delay(80);
      continue;
    }
    await delay(100);
  }
  throw new Error('Timed out waiting for window.__shotReady.');
}

function jpegSize(buffer) {
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) throw new Error('Chrome did not return a JPEG.');
  let index = 2;
  while (index < buffer.length - 8) {
    if (buffer[index] !== 0xff) {
      index += 1;
      continue;
    }
    const marker = buffer[index + 1];
    if (marker === 0xd8 || marker === 0xd9) {
      index += 2;
      continue;
    }
    if (index + 4 > buffer.length) break;
    const length = buffer.readUInt16BE(index + 2);
    if (marker >= 0xc0 && marker <= 0xc3) {
      return {
        height: buffer.readUInt16BE(index + 5),
        width: buffer.readUInt16BE(index + 7),
      };
    }
    index += 2 + length;
  }
  throw new Error('Could not read the JPEG dimensions.');
}

async function capture(client, shot) {
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: shot.width,
    height: shot.height,
    deviceScaleFactor: 1,
    mobile: false,
    screenWidth: shot.width,
    screenHeight: shot.height,
  });
  await client.send('Page.navigate', { url: `${base}/?shot=${shot.mode}&capture=${Date.now()}` });
  await waitForReady(client);
  await delay(160);

  let buffer = null;
  let size = null;
  for (const quality of [82, 80, 78, 75, 72, 68, 64, 60]) {
    const result = await client.send('Page.captureScreenshot', {
      format: 'jpeg',
      quality,
      fromSurface: true,
      captureBeyondViewport: false,
    });
    buffer = Buffer.from(result.data, 'base64');
    size = jpegSize(buffer);
    if (buffer.length <= maxBytes) break;
  }

  if (!buffer || !size) throw new Error(`Could not capture ${shot.name}.`);
  if (size.width !== shot.width || size.height !== shot.height) {
    throw new Error(`${shot.name} is ${size.width} x ${size.height}, expected ${shot.width} x ${shot.height}.`);
  }
  if (size.width > 1280 || size.height > 1280 || size.width < 480 || size.height < 480) {
    throw new Error(`${shot.name} does not meet the screenshot size limits.`);
  }
  if (buffer.length > maxBytes) {
    throw new Error(`${shot.name} is ${buffer.length} bytes, over ${maxBytes}.`);
  }

  const path = join(screenshotDir, shot.name);
  writeFileSync(path, buffer);
  console.log(`${shot.name}: ${size.width} x ${size.height}, ${buffer.length} bytes`);
}

function stop(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
  } else {
    child.kill('SIGTERM');
  }
}

let server = null;
let chrome = null;
let profile = null;
let client = null;

try {
  mkdirSync(screenshotDir, { recursive: true });
  for (const name of readdirSync(screenshotDir)) {
    if (/\.(?:jpe?g|png)$/i.test(name)) unlinkSync(join(screenshotDir, name));
  }

  server = spawn(process.execPath, [join(root, 'serve.ts'), '--port', String(serverPort)], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  await waitForHttp(`${base}/`);

  profile = mkdtempSync(join(tmpdir(), 'coastline-shot-'));
  chrome = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profile}`,
    '--window-size=1280,720',
    '--remote-allow-origins=*',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-background-networking',
    '--disable-sync',
    'about:blank',
  ], {
    stdio: 'ignore',
    windowsHide: true,
  });

  const page = await debugPage();
  const socket = await connectSocket(page.webSocketDebuggerUrl);
  client = new CdpClient(socket);
  await client.send('Page.enable');
  await client.send('Runtime.enable');

  for (const shot of shots) {
    await capture(client, shot);
  }

  const total = shots.reduce((sum, shot) => sum + statSync(join(screenshotDir, shot.name)).size, 0);
  console.log(`Captured ${shots.length} screenshots, ${total} bytes total.`);
} finally {
  if (client) client.close();
  stop(chrome);
  stop(server);
  if (profile) {
    try {
      rmSync(profile, { recursive: true, force: true, maxRetries: 4, retryDelay: 150 });
    } catch {}
  }
}
