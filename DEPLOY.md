# Putting ShelfLife online

ShelfLife runs on two free services: **Turso** (the database) and **Vercel** (the website). Neither needs a card. It takes about 15 minutes.

## 1. Create the database on Turso

1. Go to [turso.tech](https://turso.tech) and sign up (*Continue with GitHub* is quickest).
2. Create a database: **Databases → Create Database**, name it `shelflife`, and pick the region closest to your shops (e.g. **Mumbai / ap-south-1** for India).
3. Open the database and copy its **URL**. It looks like `libsql://shelflife-yourname.aws-ap-south-1.turso.io`.
4. Click **Create Token** (read & write, no expiry) and copy the token. Keep it secret: it gives full access to the data.

The tables are created automatically the first time the app connects.

## 2. Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) and sign up with GitHub.
2. **Add New → Project**, then import the `shelflife` repository.
3. Before clicking Deploy, open **Environment Variables** and add:

   | Name | Value |
   |---|---|
   | `TURSO_DATABASE_URL` | the URL from step 1.3 |
   | `TURSO_AUTH_TOKEN` | the token from step 1.4 |
   | `CRON_SECRET` | a long random string, e.g. the output of `openssl rand -hex 32` |
   | `GEMINI_API_KEY` | optional: your free key from [aistudio.google.com/apikey](https://aistudio.google.com/apikey), for bill scanning and AI bundle copy |

4. Click **Deploy**. After a minute you get a URL like `https://shelflife-xyz.vercel.app`.
5. Add one more variable, `APP_URL`, set to that URL (no trailing slash), then **Deployments → ⋯ → Redeploy**. Links in the daily summary use it.

## 3. Try it

1. Open your URL and click **Set up your shop**.
2. Add some stock or scan a bill, publish a bundle, and open **Customer deals** on your phone.
3. **Poster** now shows a QR code with your public link: print it for the counter.
4. **Settings → Morning summary**: set an ntfy topic to get the summary at 8:00 a.m. every day. To test it straight away, open **Vercel → your project → Settings → Cron Jobs** and click **Run**.

## Optional: emails for "Forgot password"

Without this, staff can still get reset links from the owner (Settings → Team), and you can make one for anyone with `npm run reset-password -- --email … --url https://your-app.vercel.app` (with the Turso variables in `.env.local`).

1. Sign up at [brevo.com](https://www.brevo.com) (free plan, 300 emails a day).
2. **Senders, Domains & Dedicated IPs → Senders → Add a sender**: use your own email address and click the link Brevo emails you to verify it.
3. **SMTP & API → API Keys → Generate a new API key**, and copy it.
4. In Vercel, add `BREVO_API_KEY` (the key) and `EMAIL_FROM` (the verified address), then redeploy.

## Good to know

- Every push to `main` on GitHub redeploys automatically.
- Vercel's free plan runs the cron job once a day, at some point within the scheduled hour.
- Your local copy keeps using the file in `data/` unless you put the Turso variables in `.env.local`.
- To fill an online shop with sample data: `npm run seed -- --url https://your-app.vercel.app --email you@cafe.com --password …`. Use a separate test account, because it adds sample stock.
