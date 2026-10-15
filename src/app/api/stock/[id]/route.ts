import { deleteBatch, getBatch } from "@/lib/db";
import { notFound } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

/** Removes a batch entered by mistake, along with its history. */
export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!getBatch(id)) return notFound();
  deleteBatch(id);
  return new Response(null, { status: 204 });
}
