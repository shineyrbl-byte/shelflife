import { connection } from "next/server";
import { requireShop } from "@/lib/auth";
import { getProduct } from "@/lib/db";
import { BarcodeSchema, CATEGORIES, today, type Category } from "@/lib/schema";

type Ctx = { params: Promise<{ barcode: string }> };

const plusDays = (n: number) => today(new Date(Date.now() + n * 86400000));

// Open Food Facts category tags -> our categories. Anything else packaged.
const CATEGORY_TAGS: [RegExp, Category][] = [
  [/dair|milk|yog|cheese|butter|curd|paneer|cream/, "dairy"],
  [/beverage|drink|juice|coffee|tea|water|soda/, "beverages"],
  [/bread|bakery|cake|pastr|bun/, "bakery"],
  [/fresh-(fruit|vegetable)|^en:fruits$|^en:vegetables$/, "produce"],
  [/meal|sandwich|prepared|ready-made/, "prepared"],
];

/** Looks up a barcode on Open Food Facts (free, no key). Only the name and a category guess are used. */
async function openFoodFacts(barcode: string) {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=product_name,brands,quantity,categories_tags`,
      { headers: { "User-Agent": "ShelfLife/1.0 (https://github.com/shineyrbl-byte/shelflife)" }, signal: AbortSignal.timeout(4000) },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const p = data.status === 1 ? data.product : null;
    if (!p?.product_name) return null;
    const brand = String(p.brands ?? "").split(",")[0].trim();
    // Drop the EU "estimated weight" mark (℮, often typed as "e") from quantities like "400 g e".
    const quantity = String(p.quantity ?? "").replace(/\s*℮$|\s+e$/i, "");
    const name = [brand && !p.product_name.toLowerCase().includes(brand.toLowerCase()) ? brand : "", p.product_name, quantity]
      .filter(Boolean)
      .join(" ")
      .slice(0, 60);
    const tags: string[] = p.categories_tags ?? [];
    const category = CATEGORY_TAGS.find(([re]) => tags.some((t) => re.test(t)))?.[1] ?? "packaged";
    return { name, category: CATEGORIES.includes(category) ? category : "packaged" };
  } catch {
    return null; // offline or slow: staff just type the details
  }
}

/** What a scanned barcode is: the shop's own record first, then Open Food Facts. */
export async function GET(_req: Request, { params }: Ctx) {
  await connection();
  const shop = await requireShop();
  if (shop instanceof Response) return shop;
  const parsed = BarcodeSchema.safeParse(decodeURIComponent((await params).barcode));
  if (!parsed.success) return Response.json({ error: "That doesn't look like a barcode." }, { status: 400 });
  const barcode = parsed.data;

  const known = await getProduct(shop.id, barcode);
  if (known) return Response.json({ source: "shop", ...known, expiresOn: plusDays(known.shelfLifeDays) });
  const found = await openFoodFacts(barcode);
  if (found) return Response.json({ source: "openfoodfacts", barcode, ...found });
  return Response.json({ source: "none", barcode });
}
