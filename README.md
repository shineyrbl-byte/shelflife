# ShelfLife: sell it before it expires

Small cafés and grocers throw away food every day because nobody notices it's about to expire until it's too late. **ShelfLife** tracks every batch's expiry date, flags what's at risk, and turns near-expiry stock into discounted **rescue bundles** that customers can see on a shareable deals page, so the shop recovers money instead of binning it.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000, then "Set up your shop"
npm run seed         # in a second terminal: a demo café (local demo login) with stock and one live bundle
npm run seed:history # optional: 4 weeks of past sales and waste for the Insights page (add --shop <name> if you have several shops)
```

`npm run seed` prints the demo shop's login when it's done. To fill your own shop instead, pass `-- --email you@cafe.com --password …`.

Optional: copy `.env.example` to `.env.local` and set:
- `GEMINI_API_KEY`: a free key from [aistudio.google.com/apikey](https://aistudio.google.com/apikey) turns on **📷 Scan a bill** and **✨ Write with AI** for bundle names and descriptions.

Everything else works without any keys, on a local SQLite file.

**Putting it online:** see [DEPLOY.md](DEPLOY.md) (Turso + Vercel, both free, about 15 minutes).

## Accounts and shops

Each café signs up with its shop name, email and password, and only ever sees its own stock, bundles and reports. Every database query is filtered by the logged-in shop, and the API answers *not found* for another shop's ids.

- Passwords are hashed with scrypt (Node's built-in crypto); no third-party auth service.
- Sessions are random tokens in an httpOnly cookie, valid for 30 days; the database stores only their SHA-256 hash.
- `src/proxy.ts` sends logged-out visitors on staff pages to `/login`; each API route checks the session itself.
- **Staff logins**: the owner invites staff from **Settings → Team** with a one-time link (valid 7 days, only its hash stored), shared on WhatsApp. Staff set their own name, email and password at `/join`. Staff can use Stock, Bundles (including reservations) and Poster; money reports, Insights, Settings, the team list and the daily summary are owner-only, enforced by `requireOwner()` in each API route. Removing a staff member logs them out everywhere.
- **Forgot password**: `/forgot` emails a one-time reset link (1 hour; at most 3 per hour per account; same answer whether or not the email exists) when email is set up via [Brevo](https://www.brevo.com) (`BREVO_API_KEY`, `EMAIL_FROM`; free, no domain needed). Owners can also make a 24-hour reset link for any staff member in **Settings → Team**, and whoever runs the site can make one for any account with `npm run reset-password -- --email …`. Setting a new password logs out every other session.
- Each shop gets a public customer page at `/s/<shop-name>`, e.g. `/s/cafe-mogra`.
- Data created before accounts existed is given to the first shop that signs up, so an existing local setup keeps its data.

## How it works

| Page | Who | What |
|---|---|---|
| `/` | Everyone | Public homepage: what ShelfLife does, live totals across all shops, sign-up (logged-in staff go straight to the dashboard) |
| `/dashboard` | Owner | Stock value at risk now, expired stock to log, the last 7/30 days (money rescued, waste at cost, rescue rate), and today's summary to send on WhatsApp |
| `/stock` | Staff | Scan a supplier bill or add deliveries by hand, with expiry dates; stock grouped by urgency; log units as sold, donated (before expiry) or wasted |
| `/bundles` | Staff | Customer reservations to hand over (*Picked up* / *Cancel*); suggested rescue bundles to publish (price editable); live bundles with a *Sold 1* button for the till |
| `/insights` | Owner | Ordering tips ("order 9 croissants, not 12"), waste by weekday, and where each item's stock goes |
| `/poster` | Staff | Printable A4 poster with a QR code to the shop's deals page |
| `/settings` | Owner | Shop name, the customer page link, and the ntfy topic for the morning summary |
| `/s/<shop>` | Customers | Phone-friendly list of the shop's bundles today: **Reserve for pickup** (a 4-digit code, held for 1 hour), **🔔 Get deal alerts** and *Share on WhatsApp* |

### Rescue bundles (`src/lib/bundles.ts`)

1. Take every batch that expires within 2 days, most urgent (then most valuable) first.
2. Pair it with a complementary category (bakery + beverages = *Breakfast rescue*, prepared + beverages = *Lunch combo*, produce + dairy = *Fresh basket*, …). A partner that's also at risk is preferred, so one bundle rescues two items. With no partner, it becomes a *Last-chance deal* on its own.
3. Price it at 50% off if it expires today, 40% tomorrow, 30% in two days, rounded to ₹5. The price never goes below what the stock cost.
4. How many bundles can be sold is computed live from remaining stock, and each sale is recorded in a transaction, so a bundle can never oversell.
5. Optionally, **✨ Write with AI** (`src/lib/ai.ts`, Gemini free tier) gives the bundle an appetising name and description. AI only writes the words: contents and price stay rule-based, and it's told never to make food sound old or unsafe.

### Bill scanning (`src/lib/ai.ts`)

Staff photograph a supplier bill; Gemini returns each stock line as schema-checked JSON: a clean name, category, quantity converted to a sensible unit (2 trays of 30 eggs = 60 pcs), cost per unit, and a typical shelf life. Delivery charges and tax lines are skipped. Bills don't show selling prices or expiry dates, so the app suggests about twice cost and an estimated expiry, and **nothing is saved until staff review every line** in an editable table. The chosen lines are added in one transaction. Photos are shrunk in the browser before upload.

### Languages

Staff screens (header, Stock, bill and barcode scanning, Bundles, Join) and the customer deals page can switch between **English and Hindi** with the **EN | हिं** switch; the choice is saved per device. All text lives in `src/lib/i18n.tsx`, and TypeScript checks every language has every line, so adding one (e.g. Konkani) means adding one more dictionary. Owner-only screens, product and bundle names, and server error messages stay as they are. The Hindi text was written for this app and is worth a review by a native speaker.

### Export

**Dashboard → Export for your accountant** downloads a month as CSV (opens in Excel or Google Sheets): **stock activity** (every unit sold, sold in a bundle, donated or wasted, with cost and normal price) and **bundle sales** (what customers paid). Times are in the shop's time zone (`APP_TIMEZONE`, default `Asia/Kolkata`). Cells that look like spreadsheet formulas are written as text, so a product name can't run code in Excel.

### Impact numbers (`src/lib/impact.ts`)

The dashboard shows food rescued (kg), CO₂ avoided and money recovered, this month and in total, with a **Share it** button that writes a WhatsApp message. Food sold by kg or litre counts as is; pieces and packs use a typical weight per category (e.g. 80 g for bakery, 250 g for prepared food). CO₂ uses about 2.5 kg CO₂e per kg of food not wasted, the FAO's global average for food waste. Both are labelled as estimates wherever they appear. The customer page shows the shop's total, and the homepage shows totals across all shops.

### Deal alerts for customers

Each shop gets a public [ntfy](https://ntfy.sh) topic (e.g. `shelflife-cafe-mogra-1a2b3c4d`, created on first use). On the deals page, **🔔 Get deal alerts** shows how to follow it: in the browser through ntfy's web app, or in the free ntfy app, with no account. Every time staff publish a bundle, followers get *New deal at Café Mogra: Croissant ₹35 (was ₹60), until today*, linking back to the deals page. It's sent as ntfy JSON so ₹ and non-English names work, and a failed alert never blocks publishing. Owners can switch it off in **Settings**. Deals are public anyway, so the topic is too.

### Customer pre-orders

On a shop's deals page, customers tap **Reserve for pickup**, enter a first name, and get a 4-digit pickup code. The bundle is held for 1 hour: it's subtracted from what's available to everyone else, and staff can't sell it to a walk-in at the till. Staff see the reservations at the top of **Bundles**, check the name and code, take payment and tap **Picked up**, which records the sale. Holds expire on their own; a late customer can still collect if stock is left.

- Each customer (identified by a salted hash of their IP address, never the IP itself) can hold at most 2 deals at a shop at a time.
- Only a first name is stored: no phone number or email.
- Customers can cancel their own reservation; that needs its id and code, which only their browser has.
- Availability is checked and the hold created in one transaction, so two customers can't both get the last one.

### Barcode scanning

On the Stock page, **📷 Scan barcode** reads EAN/UPC codes with the phone camera ([ZXing](https://github.com/zxing-js/browser), loaded only when the scanner opens); USB or Bluetooth scanners work too, since they type the code and press Enter. ShelfLife remembers each shop's barcodes (name, category, unit, prices and typical shelf life), so the next scan fills everything in and staff only enter the quantity. Unknown barcodes are looked up on [Open Food Facts](https://world.openfoodfacts.org) (free, no key) for the name and a category guess. The camera needs HTTPS, which the deployed site has (or localhost).

### Ordering tips (`src/lib/insights.ts`)

Looks at finished batches (sold out or expired) from the last 28 days. For each item with at least 3 batches where 15% or more didn't sell at full price, it suggests ordering the amount that sold at full price on 80% of batches. That still covers demand on about 4 days in 5, so the shop runs out occasionally instead of binning stock daily. The saving shown is the cost of the units no longer over-ordered, capped at what was actually left over.

### Daily summary

Every morning the owner should know what expires today and tomorrow, what's already expired, and how many bundles are ready. The dashboard shows this summary with **Copy** and **Send on WhatsApp** buttons.

**As a phone notification** (free, via [ntfy](https://ntfy.sh)): in **Settings**, pick a hard-to-guess ntfy topic (or let the app make one), install the ntfy app and subscribe to the same topic. When deployed on Vercel, `vercel.json` runs `/api/cron/daily-summary` every day at 02:30 UTC (8:00 a.m. India time). It sends each shop with a topic its own summary, with high priority if something expires today. The route only runs with `Authorization: Bearer $CRON_SECRET`, which Vercel sends automatically.

Running locally instead: set `CRON_SECRET` in `.env.local`, then `npm run summary -- --shop <your shop's link name>` prints a shop's summary (and pushes it if `NTFY_TOPIC` is set), e.g. from a cron job:
```
0 8 * * * cd ~/shelflife && npm run summary -- --shop cafe-mogra
```

## Architecture

```
Next.js 16 (App Router, React 19, Tailwind 4)
├─ src/app/(staff)/     Dashboard, Stock, Bundles, Insights, Poster (staff nav, login required)
├─ src/app/s/[slug]/    public customer deals page per shop
├─ src/app/login, signup
├─ src/proxy.ts         redirects logged-out visitors on staff pages to /login
├─ src/lib/auth.ts      password hashing, sessions, requireShop()
├─ src/app/api/         stock, outcomes, bundles, suggestions, report
├─ src/lib/schema.ts    Zod input schemas, types, expiry helpers
├─ src/lib/bundles.ts   rescue bundle engine (pure functions)
└─ src/lib/db.ts        libSQL (SQLite-compatible), the only file that touches the database
```

- **Local file or hosted database, same code.** `db.ts` uses libSQL: a SQLite file in `data/` by default, or a hosted [Turso](https://turso.tech) database when `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` are set.
- **Nothing derived is stored.** A batch's remaining stock = its quantity minus logged events (sold / wasted / rescued), so numbers can't drift out of sync.
- **Money is valued two ways.** Waste is counted at cost (what the shop actually lost); bundle revenue is what customers paid.
- **Server decides prices.** When a bundle is published, normal prices and expiry come from the stock records, not the browser.

## Tests and checks

```bash
npm test          # unit and database tests (Vitest), about 1 second
npm run lint
npm run typecheck
npm run build
```

- **Pure logic**: bundle pairing and pricing (never below cost), ordering tips, impact maths, CSV escaping and formula-injection defence, expiry dates, input validation, and that every translation has every line with the same `{placeholders}`.
- **Database rules**, against a throwaway SQLite file: shops can't see or change each other's data, six simultaneous sales of a bundle with stock for two sell exactly two, reservations hold stock until they expire, changing a password ends every session, one-time links work once, and the owner can't be removed.
- **GitHub Actions** (`.github/workflows/ci.yml`) runs lint, typecheck, tests and the production build on every pull request and push to `main`; `main` only accepts merges that pass.

## What's next

- Barcode or photo entry for deliveries
- Multiple shops with logins
