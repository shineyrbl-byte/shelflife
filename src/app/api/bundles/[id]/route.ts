import { getBundle, setBundleStatus } from "@/lib/db";
import { notFound } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

/** Takes a bundle off sale. Sales already made stay in the history. */
export async function DELETE(_req: Request, { params }: Ctx) {
  const bundle = getBundle((await params).id);
  if (!bundle) return notFound();
  setBundleStatus(bundle.id, "cancelled");
  return new Response(null, { status: 204 });
}
