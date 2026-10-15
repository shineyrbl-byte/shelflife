// Prints today's ShelfLife summary and, if NTFY_TOPIC is set, pushes it to your phone
// through ntfy.sh (free, no account: install the ntfy app and subscribe to the same topic).
//
// usage: npm run summary [-- --url http://localhost:3000]
// Needs the app running. Schedule it every morning with cron; see the README.

const i = process.argv.indexOf("--url");
const BASE = i > -1 ? process.argv[i + 1] : process.env.APP_URL || "http://localhost:3000";
const TOPIC = process.env.NTFY_TOPIC;

async function main() {
  let summary;
  try {
    const res = await fetch(`${BASE}/api/summary`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
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
