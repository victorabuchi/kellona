// Transactional email through Resend when RESEND_API_KEY and RESEND_FROM are
// set. Without them nothing is sent and callers decide how to degrade.
export function emailConfigured(): boolean {
  return Boolean(process.env['RESEND_API_KEY'] && process.env['RESEND_FROM']);
}

// The sender address stays Kellona's; the display name is the organization's.
function from(senderName: string | null): string {
  const configured = process.env['RESEND_FROM']!;
  const address = /<([^>]+)>/.exec(configured)?.[1] ?? configured;
  const name = (senderName ?? '').replace(/["<>\r\n]/g, '').trim();
  return name ? `"${name}" <${address}>` : configured;
}

export async function sendEmail(args: { to: string; subject: string; text: string; senderName: string | null }): Promise<boolean> {
  if (!emailConfigured()) return false;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env['RESEND_API_KEY']}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: from(args.senderName), to: [args.to], subject: args.subject, text: args.text }),
  });
  return res.ok;
}
