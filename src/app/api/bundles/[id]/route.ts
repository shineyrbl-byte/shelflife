import { requireShop } from "@/lib/auth";
import { getBundle, setBundleStatus } from "@/lib/db";
import { notFound } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

/** Takes a bundle off sale. Sales already made stay in the history. */
export async function DELETE(_req: Request, { params }: Ctx) {
  const shop = await requireShop();
  if (shop instanceof Response) return shop;
  const bundle = await getBundle(shop.id, (await params).id);
  if (!bundle) return notFound();
  await setBundleStatus(shop.id, bundle.id, "cancelled");
  return new Response(null, { status: 204 });
}
