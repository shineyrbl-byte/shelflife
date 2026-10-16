import { connection } from "next/server";
import { insertBatch, listStock } from "@/lib/db";
import { readBody } from "@/lib/http";
import { BatchInputSchema, daysLeft, freshness } from "@/lib/schema";

export async function GET() {
  await connection();
  return Response.json((await listStock()).map((b) => ({ ...b, daysLeft: daysLeft(b.expiresOn), freshness: freshness(b.expiresOn) })));
}

export async function POST(req: Request) {
  const body = await readBody(req, BatchInputSchema);
  if (body instanceof Response) return body;
  return Response.json({ id: await insertBatch(body) }, { status: 201 });
}
