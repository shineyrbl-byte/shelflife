// Sends email through Brevo's free transactional API (300 emails/day; the sender only needs a
// verified email address, no domain). Optional: without BREVO_API_KEY and EMAIL_FROM, email is off.

export const emailEnabled = () => Boolean(process.env.BREVO_API_KEY && process.env.EMAIL_FROM);

export async function sendEmail(to: string, subject: string, text: string, html: string) {
  if (!emailEnabled()) throw new Error("Email isn't set up");
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": process.env.BREVO_API_KEY!, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { name: "ShelfLife", email: process.env.EMAIL_FROM },
      to: [{ email: to }],
      subject,
      textContent: text,
      htmlContent: html,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Email failed: HTTP ${res.status} ${await res.text().catch(() => "")}`.trim());
}
