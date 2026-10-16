// Push notifications through ntfy.sh: free, no account. The shop installs the ntfy app and
// subscribes to its topic; anyone who knows the topic name can read it, so it should be hard to guess.

// NTFY_URL lets a shop use a self-hosted ntfy server instead.
const NTFY_URL = process.env.NTFY_URL || "https://ntfy.sh";

export const NTFY_TOPIC_PATTERN = /^[A-Za-z0-9_-]{12,64}$/;

export async function pushSummary(topic: string, summary: { text: string; counts: { expiringToday: number; expired: number } }, clickUrl: string) {
  const urgent = summary.counts.expiringToday + summary.counts.expired > 0;
  const res = await fetch(`${NTFY_URL}/${encodeURIComponent(topic)}`, {
    method: "POST",
    body: summary.text,
    headers: {
      Title: "ShelfLife daily summary",
      Tags: urgent ? "warning" : "white_check_mark",
      Priority: urgent ? "high" : "default",
      Click: clickUrl,
    },
  });
  if (!res.ok) throw new Error(`ntfy push failed: HTTP ${res.status}`);
}
