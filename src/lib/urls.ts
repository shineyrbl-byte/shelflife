// The app's main public address. Set APP_URL in production so links shared with customers
// (WhatsApp, QR poster) always use it, even when staff opened a Vercel preview address.
export const appUrl = (req: Request) => (process.env.APP_URL || new URL(req.url).origin).replace(/\/+$/, "");

export const publicDealsUrl = (req: Request, slug: string) => `${appUrl(req)}/s/${slug}`;
