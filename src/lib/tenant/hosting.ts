// Registers customer domains with the hosting provider so it serves them and
// issues certificates. Uses the Render API when RENDER_API_KEY and
// RENDER_SERVICE_ID are set; otherwise the domain is added in Render's
// dashboard by hand. Best effort: DNS verification decides what goes live.

function renderConfig(): { key: string; service: string } | null {
  const key = process.env['RENDER_API_KEY'];
  const service = process.env['RENDER_SERVICE_ID'];
  return key && service ? { key, service } : null;
}

export function hostingAutomated(): boolean {
  return renderConfig() !== null;
}

export async function addToHosting(host: string): Promise<boolean> {
  const cfg = renderConfig();
  if (!cfg) return false;
  const res = await fetch(`https://api.render.com/v1/services/${cfg.service}/custom-domains`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.key}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ name: host }),
  }).catch(() => null);
  return Boolean(res && (res.ok || res.status === 409));
}

export async function removeFromHosting(host: string): Promise<void> {
  const cfg = renderConfig();
  if (!cfg) return;
  await fetch(`https://api.render.com/v1/services/${cfg.service}/custom-domains/${encodeURIComponent(host)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${cfg.key}`, Accept: 'application/json' },
  }).catch(() => null);
}
