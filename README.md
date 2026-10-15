# ShelfLife: sell it before it expires

Small cafés and grocers throw away food every day because nobody notices it's about to expire until it's too late. **ShelfLife** tracks every batch's expiry date, flags what's at risk, and turns near-expiry stock into discounted **rescue bundles** that customers can see on a shareable deals page, so the shop recovers money instead of binning it.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
npm run seed         # in a second terminal: a sample café's stock, history and one live bundle
```

Optional: copy `.env.example` to `.env.local` and set:
- `NEXT_PUBLIC_SHOP_NAME`: shown to customers.
- `GEMINI_API_KEY`: a free key from [aistudio.google.com/apikey](https://aistudio.google.com/apikey) turns on **✨ Write with AI** for bundle names and descriptions.

Everything else works without any keys or accounts, on local SQLite.

## How it works

| Page | Who | What |
|---|---|---|
| `/` Dashboard | Owner | Stock value at risk now, expired stock to log, the last 7/30 days (money rescued, waste at cost, rescue rate), and today's summary to send on WhatsApp |
| `/stock` | Staff | Add deliveries and bakes with an expiry date; stock grouped by urgency; log units as sold or wasted |
| `/bundles` | Staff | Suggested rescue bundles to publish (price editable); live bundles with a *Sold 1* button for the till |
| `/deals` | Customers | Phone-friendly list of today's bundles, with a *Share on WhatsApp* button |

### Rescue bundles (`src/lib/bundles.ts`)

1. Take every batch that expires within 2 days, most urgent (then most valuable) first.
2. Pair it with a complementary category (bakery + beverages = *Breakfast rescue*, prepared + beverages = *Lunch combo*, produce + dairy = *Fresh basket*, …). A partner that's also at risk is preferred, so one bundle rescues two items. With no partner, it becomes a *Last-chance deal* on its own.
3. Price it at 50% off if it expires today, 40% tomorrow, 30% in two days, rounded to ₹5. The price never goes below what the stock cost.
4. How many bundles can be sold is computed live from remaining stock, and each sale is recorded in a transaction, so a bundle can never oversell.
5. Optionally, **✨ Write with AI** (`src/lib/ai.ts`, Gemini free tier) gives the bundle an appetising name and description. AI only writes the words: contents and price stay rule-based, and it's told never to make food sound old or unsafe.

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
└─ src/lib/db.ts        node:sqlite, the only file that touches the database
```

- **Nothing derived is stored.** A batch's remaining stock = its quantity minus logged events (sold / wasted / rescued), so numbers can't drift out of sync.
- **Money is valued two ways.** Waste is counted at cost (what the shop actually lost); bundle revenue is what customers paid.
- **Server decides prices.** When a bundle is published, normal prices and expiry come from the stock records, not the browser.

## What's next

- Barcode or photo entry for deliveries
- Multiple shops with logins
