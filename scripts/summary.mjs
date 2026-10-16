// Prints today's ShelfLife summary and, if NTFY_TOPIC is set, pushes it to your phone
// through ntfy.sh (free, no account: install the ntfy app and subscribe to the same topic).
//
// usage: npm run summary -- --shop <shop link name, e.g. cafe-mogra> [--url http://localhost:3000]
// Needs the app running and CRON_SECRET set (the same value) in .env.local for both. See the README.

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const BASE = arg("url", process.env.APP_URL || "http://localhost:3000");
const SHOP = arg("shop", process.env.SHELFLIFE_SHOP);
const TOPIC = process.env.NTFY_TOPIC;
if (!SHOP || !process.env.CRON_SECRET) {
  console.error("Needs --shop <link name> and CRON_SECRET in .env.local (any long random string; restart the app after setting it).");
  process.exit(1);
}

async function main() {
  let summary;
  try {
    const res = await fetch(`${BASE}/api/summary?shop=${encodeURIComponent(SHOP)}`, {
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
    summary = await res.json();
  } catch (err) {
    console.error(`Can't get the summary from ${BASE} (${err.message}). Is the app running?`);
    process.exit(1);
  }
  console.log(summary.text);

  if (!TOPIC) return;
  const urgent = summary.counts.expiringToday + summary.counts.expired > 0;
  const res = await fetch(`https://ntfy.sh/${encodeURIComponent(TOPIC)}`, {
    method: "POST",
    body: summary.text,
    headers: {
      Title: "ShelfLife daily summary",
      Tags: urgent ? "warning" : "white_check_mark",
      Priority: urgent ? "high" : "default",
      Click: `${BASE}/bundles`,
    },
  });
  console.log(res.ok ? `\nSent to ntfy topic "${TOPIC}".` : `\nntfy push failed: HTTP ${res.status}`);
  if (!res.ok) process.exit(1);
}

main();
