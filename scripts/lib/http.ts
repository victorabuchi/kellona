// Tiny HTTP client for end to end checks against the dev server: sets the Host
// header (so *.localhost organizations resolve), posts server action forms as
// multipart, and keeps the session cookie.
import { request } from 'node:http';
import { randomUUID } from 'node:crypto';

export type Res = { status: number; location: string; cookie: string | null; body: string; type: string };

export function http(
  method: 'GET' | 'POST',
  host: string,
  path: string,
  opts: { cookie?: string | null; form?: Record<string, string | string[]> } = {},
): Promise<Res> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = { Host: `${host}:3000` };
    if (opts.cookie) headers['Cookie'] = opts.cookie;
    let body: Buffer | undefined;
    if (opts.form) {
      const boundary = `----kellona${randomUUID()}`;
      const parts: string[] = [];
      for (const [k, v] of Object.entries(opts.form)) {
        for (const value of Array.isArray(v) ? v : [v]) parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${value}\r\n`);
      }
      body = Buffer.from(parts.join('') + `--${boundary}--\r\n`);
      headers['Content-Type'] = `multipart/form-data; boundary=${boundary}`;
      headers['Content-Length'] = String(body.length);
    }
    const req = request({ hostname: '127.0.0.1', port: 3000, method, path, headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const session = (res.headers['set-cookie'] ?? []).find((c) => c.startsWith('kellona_session='));
        resolve({
          status: res.statusCode ?? 0,
          location: String(res.headers['location'] ?? ''),
          cookie: session ? session.split(';')[0]! : null,
          body: Buffer.concat(chunks).toString('utf8'),
          type: String(res.headers['content-type'] ?? ''),
        });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// The $ACTION_ID_ of the first form in the page whose markup contains `marker`.
export function actionIn(html: string, marker: string): string {
  for (const form of html.split('<form').slice(1)) {
    const markup = form.split('</form>')[0]!;
    if (!markup.includes(marker)) continue;
    const id = /name="(\$ACTION_ID_[0-9a-f]+)"/.exec(markup)?.[1];
    if (id) return id;
  }
  throw new Error(`No form containing ${marker}`);
}

export function param(location: string, name: string): string | null {
  return new URL(location, 'http://x').searchParams.get(name);
}
