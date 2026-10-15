import { aiEnabled, isBusyError, readBill, SCAN_MIME_TYPES } from "@/lib/ai";
import { today } from "@/lib/schema";

const MAX_BYTES = 8 * 1024 * 1024;

const plusDays = (n: number) => today(new Date(Date.now() + n * 86400000));
// Bills show cost, not selling price: start from roughly double cost, which staff can change.
const suggestPrice = (cost: number) => Math.max(Math.round((cost * 2) / 5) * 5, Math.ceil(cost) + 5);

/** Reads a photo of a supplier bill into draft stock lines for staff to review. Nothing is saved here. */
export async function POST(req: Request) {
  if (!aiEnabled()) {
    return Response.json({ error: "Bill scanning needs a free GEMINI_API_KEY in .env.local." }, { status: 501 });
  }
  const form = await req.formData().catch(() => null);
  const photo = form?.get("photo");
  if (!(photo instanceof File)) return Response.json({ error: "Attach a photo of the bill." }, { status: 400 });
  if (!SCAN_MIME_TYPES.includes(photo.type)) return Response.json({ error: "Use a JPG, PNG, WebP or HEIC photo." }, { status: 415 });
  if (photo.size > MAX_BYTES) return Response.json({ error: "That photo is over 8 MB. Try a smaller one." }, { status: 413 });

  try {
    const bill = await readBill({ data: Buffer.from(await photo.arrayBuffer()), mimeType: photo.type });
    if (!bill.readable || bill.items.length === 0) {
      return Response.json({ error: "Couldn't find any items on that photo. Try a sharper, well-lit photo of the whole bill." }, { status: 422 });
    }
    return Response.json({
      supplier: bill.supplier,
      items: bill.items.map((i) => ({
        name: i.name.slice(0, 60),
        category: i.category,
        unit: i.unit,
        quantity: Math.max(0, +i.quantity.toFixed(2)),
        unitCost: Math.max(0, +i.unitCost.toFixed(2)),
        unitPrice: suggestPrice(Math.max(0, i.unitCost)),
        expiresOn: plusDays(Math.min(Math.max(i.shelfLifeDays, 0), 365)),
      })),
    });
  } catch (err) {
    console.error("bill scan failed", err);
    const busy = isBusyError(err);
    return Response.json(
      { error: busy ? "Google's AI is busy right now. Try again in a minute." : "Couldn't read the bill. Please try again." },
      { status: busy ? 503 : 502 },
    );
  }
}
