import type { Env } from './env';

export interface Mail { to: string; subject: string; text: string; html: string; tag?: string }

/**
 * Sends an email through Cloudflare Email Service (send_email binding) by default,
 * or through Resend when MAIL_PROVIDER=resend and RESEND_API_KEY is set.
 * Returns false when no provider is available (development without email).
 */
export async function sendMail(env: Env, mail: Mail): Promise<boolean> {
  const from = `${env.MAIL_FROM_NAME || env.SITE_NAME} <${env.MAIL_FROM}>`;
  if (env.MAIL_PROVIDER === 'resend' && env.RESEND_API_KEY) {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        // Resend blocks requests without a User-Agent (403, code 1010).
        'User-Agent': 'portfolio/1.0',
      },
      body: JSON.stringify({
        from,
        to: [mail.to],
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
        ...(env.MAIL_REPLY_TO ? { reply_to: env.MAIL_REPLY_TO } : {}),
        // A unique reference stops Gmail from grouping every sign-in email into one thread.
        headers: { 'X-Entity-Ref-ID': crypto.randomUUID() },
        tags: [{ name: 'type', value: mail.tag || 'signin' }],
      }),
    });
    if (!r.ok) throw new Error(`Resend failed: ${r.status} ${await r.text()}`);
    return true;
  }
  if (env.EMAIL && typeof env.EMAIL.send === 'function') {
    await env.EMAIL.send({ to: mail.to, from: env.MAIL_FROM, subject: mail.subject, text: mail.text, html: mail.html });
    return true;
  }
  return false;
}

/** The email with the 6-digit code that lets the owner set or reset the admin password. */
export function setupMail(env: Env, to: string, code: string, minutes: number): Mail {
  const site = env.SITE_NAME || 'Portfolio';
  const heading = 'Your portfolio admin code';
  const lead = `Someone asked to set or reset the admin password of ${site}. If that was you, use this code on the sign-in page. If not, ignore this email and nothing will change.`;
  const text = `${heading}\n\n${lead}\n\nYour code: ${code}\n\nThe code is valid for ${minutes} minutes and can be used once.\n\n${site}`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${heading}</title></head>
<body style="margin:0;padding:0;background:#F2EADD;font-family:'Century Gothic',Questrial,'Trebuchet MS',Arial,sans-serif;color:#06303F">
  <div style="max-width:520px;margin:32px auto;background:#FBF7F1;border-top:3px solid #C9A24B;padding:32px">
    <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:.25em;color:#8A6A22">${site.toUpperCase()}</p>
    <h1 style="margin:0 0 14px;font-size:22px;color:#06303F">${heading}</h1>
    <p style="font-size:14px;line-height:1.7;margin:0 0 18px">${lead}</p>
    <p style="font-size:34px;letter-spacing:.3em;font-weight:700;color:#06303F;margin:0 0 18px;font-family:Consolas,Menlo,monospace">${code}</p>
    <p style="font-size:13px;line-height:1.7;margin:0;color:#3E5964">The code is valid for ${minutes} minutes and can be used once.</p>
  </div>
</body></html>`;
  return { to, subject: `${code} is your ${site} admin code`, text, html, tag: 'setup' };
}
