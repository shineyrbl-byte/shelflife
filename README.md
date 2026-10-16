# ShelfLife: sell it before it expires

Small cafés and grocers throw away food every day because nobody notices it's about to expire until it's too late. **ShelfLife** tracks every batch's expiry date, flags what's at risk, and turns near-expiry stock into discounted **rescue bundles** that customers can see on a shareable deals page, so the shop recovers money instead of binning it.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
npm run seed         # in a second terminal: a sample café's stock, history and one live bundle
npm run seed:history # optional: 4 weeks of past sales and waste, for the Insights page
```

Optional: copy `.env.example` to `.env.local` and set:
- `NEXT_PUBLIC_SHOP_NAME`: shown to customers.
- `GEMINI_API_KEY`: a free key from [aistudio.google.com/apikey](https://aistudio.google.com/apikey) turns on **📷 Scan a bill** and **✨ Write with AI** for bundle names and descriptions.

Everything else works without any keys or accounts, on a local SQLite file.

## How it works

| Page | Who | What |
|---|---|---|
| `/` Dashboard | Owner | Stock value at risk now, expired stock to log, the last 7/30 days (money rescued, waste at cost, rescue rate), and today's summary to send on WhatsApp |
| `/stock` | Staff | Scan a supplier bill or add deliveries by hand, with expiry dates; stock grouped by urgency; log units as sold or wasted |
| `/bundles` | Staff | Suggested rescue bundles to publish (price editable); live bundles with a *Sold 1* button for the till |
| `/insights` | Owner | Ordering tips ("order 9 croissants, not 12"), waste by weekday, and where each item's stock goes |
| `/deals` | Customers | Phone-friendly list of today's bundles, with a *Share on WhatsApp* button |

### Rescue bundles (`src/lib/bundles.ts`)

1. Take every batch that expires within 2 days, most urgent (then most valuable) first.
2. Pair it with a complementary category (bakery + beverages = *Breakfast rescue*, prepared + beverages = *Lunch combo*, produce + dairy = *Fresh basket*, …). A partner that's also at risk is preferred, so one bundle rescues two items. With no partner, it becomes a *Last-chance deal* on its own.
3. Price it at 50% off if it expires today, 40% tomorrow, 30% in two days, rounded to ₹5. The price never goes below what the stock cost.
4. How many bundles can be sold is computed live from remaining stock, and each sale is recorded in a transaction, so a bundle can never oversell.
5. Optionally, **✨ Write with AI** (`src/lib/ai.ts`, Gemini free tier) gives the bundle an appetising name and description. AI only writes the words: contents and price stay rule-based, and it's told never to make food sound old or unsafe.

### Bill scanning (`src/lib/ai.ts`)

Staff photograph a supplier bill; Gemini returns each stock line as schema-checked JSON: a clean name, category, quantity converted to a sensible unit (2 trays of 30 eggs = 60 pcs), cost per unit, and a typical shelf life. Delivery charges and tax lines are skipped. Bills don't show selling prices or expiry dates, so the app suggests about twice cost and an estimated expiry, and **nothing is saved until staff review every line** in an editable table. The chosen lines are added in one transaction. Photos are shrunk in the browser before upload.

### Ordering tips (`src/lib/insights.ts`)

Looks at finished batches (sold out or expired) from the last 28 days. For each item with at least 3 batches where 15% or more didn't sell at full price, it suggests ordering the amount that sold at full price on 80% of batches. That still covers demand on about 4 days in 5, so the shop runs out occasionally instead of binning stock daily. The saving shown is the cost of the units no longer over-ordered, capped at what was actually left over.

### Daily summary

Every morning the owner should know what expires today and tomorrow, what's already expired, and how many bundles are ready. The dashboard shows this summary with **Copy** and **Send on WhatsApp** buttons. To get it as a phone notification instead:

1. Install the free [ntfy](https://ntfy.sh) app and subscribe to a long, hard-to-guess topic name (anyone who knows the name can read it).
2. Put the same name in `.env.local` as `NTFY_TOPIC=...`.
3. Run `npm run summary` while the app is running. It prints the summary and pushes it to your phone (high priority if something expires today).
4. To get it every morning at 8:00, add a cron job (`crontab -e`):
   ```
   0 8 * * * cd ~/shelflife && npm run summary
   ```
   The app must be running at that time, e.g. on the shop's computer or a server.

## Architecture

```
Next.js 16 (App Router, React 19, Tailwind 4)
├─ src/app/(staff)/     Dashboard, Stock, Bundles (staff nav)
├─ src/app/deals/       public customer page
├─ src/app/api/         stock, outcomes, bundles, suggestions, report
├─ src/lib/schema.ts    Zod input schemas, types, expiry helpers
├─ src/lib/bundles.ts   rescue bundle engine (pure functions)
└─ src/lib/db.ts        libSQL (SQLite-compatible), the only file that touches the database
```

- **Local file or hosted database, same code.** \`db.ts\` uses libSQL: a SQLite file in \`data/\` by default, or a hosted [Turso](https://turso.tech) database when \`TURSO_DATABASE_URL\` and \`TURSO_AUTH_TOKEN\` are set.
- **Nothing derived is stored.** A batch's remaining stock = its quantity minus logged events (sold / wasted / rescued), so numbers can't drift out of sync.
- **Money is valued two ways.** Waste is counted at cost (what the shop actually lost); bundle revenue is what customers paid.
- **Server decides prices.** When a bundle is published, normal prices and expiry come from the stock records, not the browser.

## What's next

- Barcode or photo entry for deliveries
- Multiple shops with logins
