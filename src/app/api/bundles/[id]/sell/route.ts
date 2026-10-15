import { bundlesAvailable } from "@/lib/bundles";
import { getBatch, getBundle, recordBundleSale, setBundleStatus, transaction } from "@/lib/db";
import { notFound } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

const remainingOf = (items: { batchId: string; quantity: number }[]) =>
  bundlesAvailable(items.map((i) => ({ quantity: i.quantity, remaining: getBatch(i.batchId)?.remaining ?? 0 })));

/** Records one bundle sale. Checking stock and logging the sale happen in one transaction, so it can't oversell. */
export async function POST(_req: Request, { params }: Ctx) {
  const bundle = getBundle((await params).id);
  if (!bundle) return notFound();
  if (bundle.status !== "active") return Response.json({ error: "This bundle is no longer on sale." }, { status: 409 });
  const result = transaction(() => {
    if (remainingOf(bundle.items) < 1) return null;
    recordBundleSale(bundle);
    const left = remainingOf(bundle.items);
    if (left < 1) setBundleStatus(bundle.id, "sold");
    return left;
  });
  if (result === null) return Response.json({ error: "Not enough stock left for this bundle." }, { status: 409 });
  return Response.json({ available: result });
}
