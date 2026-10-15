# ShelfLife: sell it before it expires

Small cafés and grocers throw away food every day because nobody notices it's about to expire until it's too late. **ShelfLife** tracks every batch's expiry date, flags what's at risk, and turns near-expiry stock into discounted **rescue bundles** that customers can see on a shareable deals page, so the shop recovers money instead of binning it.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
npm run seed         # in a second terminal: a sample café's stock, history and one live bundle
```

Optional: copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SHOP_NAME` (shown to customers). No API keys or accounts needed. Everything runs locally on SQLite.

## How it works

| Page | Who | What |
|---|---|---|
| `/` Dashboard | Owner | Stock value at risk now, expired stock to log, and the last 7/30 days: money rescued, waste at cost, rescue rate |
| `/stock` | Staff | Add deliveries and bakes with an expiry date; stock grouped by urgency; log units as sold or wasted |
| `/bundles` | Staff | Suggested rescue bundles to publish (price editable); live bundles with a *Sold 1* button for the till |
| `/deals` | Customers | Phone-friendly list of today's bundles, with a *Share on WhatsApp* button |

### Rescue bundles (`src/lib/bundles.ts`)

1. Take every batch that expires within 2 days, most urgent (then most valuable) first.
2. Pair it with a complementary category (bakery + beverages = *Breakfast rescue*, prepared + beverages = *Lunch combo*, produce + dairy = *Fresh basket*, …). A partner that's also at risk is preferred, so one bundle rescues two items. With no partner, it becomes a *Last-chance deal* on its own.
3. Price it at 50% off if it expires today, 40% tomorrow, 30% in two days, rounded to ₹5. The price never goes below what the stock cost.
4. How many bundles can be sold is computed live from remaining stock, and each sale is recorded in a transaction, so a bundle can never oversell.

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

- AI-written bundle names and descriptions (free Gemini tier) on top of the rule-based engine
- Barcode or photo entry for deliveries
- Multiple shops with logins
- Daily "expiring today" WhatsApp or email summary for the owner
