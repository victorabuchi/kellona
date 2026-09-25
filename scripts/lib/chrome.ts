// Minimal headless Chrome driver over the DevTools protocol, for layout checks
// and screenshots without extra dependencies. Node's global WebSocket is used.
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME_PATHS = [
  process.env['CHROME_PATH'],
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean) as string[];

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void };

export class Browser {
  private proc: ChildProcess;
  private ws!: WebSocket;
  private id = 0;
  private pending = new Map<number, Pending>();
  private listeners: Array<(method: string, params: unknown) => void> = [];
  private profile: string;

  private constructor(proc: ChildProcess, profile: string) {
    this.proc = proc;
    this.profile = profile;
  }

  static async launch(): Promise<Browser> {
    const bin = CHROME_PATHS[0];
    if (!bin) throw new Error('Chrome not found. Set CHROME_PATH.');
    const profile = mkdtempSync(join(tmpdir(), 'kellona-chrome-'));
    const port = 9300 + Math.floor(Math.random() * 500);
    const proc = spawn(bin, [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--no-first-run',
      '--no-default-browser-check',
      `--user-data-dir=${profile}`,
      `--remote-debugging-port=${port}`,
      'about:blank',
    ]);
    const browser = new Browser(proc, profile);
    let pageWs: string | null = null;
    for (let i = 0; i < 50 && !pageWs; i++) {
      await new Promise((r) => setTimeout(r, 200));
      try {
        const list = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()) as Array<{ type: string; webSocketDebuggerUrl: string }>;
        pageWs = list.find((t) => t.type === 'page')?.webSocketDebuggerUrl ?? null;
      } catch {
        // not up yet
      }
    }
    if (!pageWs) throw new Error('Chrome did not start');
    browser.ws = new WebSocket(pageWs);
    await new Promise((resolve, reject) => {
      browser.ws.onopen = resolve;
      browser.ws.onerror = () => reject(new Error('CDP connect failed'));
    });
    browser.ws.onmessage = (ev) => {
      const msg = JSON.parse(String(ev.data)) as { id?: number; result?: unknown; error?: { message: string }; method?: string; params?: unknown };
      if (msg.id !== undefined) {
        const p = browser.pending.get(msg.id);
        browser.pending.delete(msg.id);
        if (msg.error) p?.reject(new Error(msg.error.message));
        else p?.resolve(msg.result);
      } else if (msg.method) {
        for (const l of browser.listeners) l(msg.method, msg.params);
      }
    };
    await browser.send('Page.enable');
    await browser.send('Runtime.enable');
    return browser;
  }

  send<R = unknown>(method: string, params: Record<string, unknown> = {}): Promise<R> {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject }));
  }

  async viewport(width: number, height: number, dark = false) {
    await this.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: true });
    await this.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }] });
  }

  // Navigates and waits for the load event (with a timeout, since the dev
  // server keeps a live connection open).
  async goto(url: string, timeoutMs = 15000) {
    const loaded = new Promise<void>((resolve) => {
      const l = (method: string) => {
        if (method === 'Page.loadEventFired') {
          this.listeners = this.listeners.filter((x) => x !== l);
          resolve();
        }
      };
      this.listeners.push(l);
    });
    await this.send('Page.navigate', { url });
    await Promise.race([loaded, new Promise((r) => setTimeout(r, timeoutMs))]);
    await new Promise((r) => setTimeout(r, 300));
  }

  async eval<T>(expression: string): Promise<T> {
    const res = await this.send<{ result: { value: T }; exceptionDetails?: unknown }>('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (res.exceptionDetails) throw new Error(`eval failed: ${JSON.stringify(res.exceptionDetails)}`);
    return res.result.value;
  }

  // Viewport sized capture only; taller images are rejected by viewers.
  async screenshot(): Promise<Buffer> {
    const res = await this.send<{ data: string }>('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    return Buffer.from(res.data, 'base64');
  }

  async close() {
    try {
      this.ws.close();
    } catch {
      // ignore
    }
    this.proc.kill('SIGKILL');
    await new Promise((r) => setTimeout(r, 200));
    rmSync(this.profile, { recursive: true, force: true });
  }
}
