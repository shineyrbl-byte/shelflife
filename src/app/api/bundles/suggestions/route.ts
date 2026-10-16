import { connection } from "next/server";
import { suggestBundles } from "@/lib/bundles";
import { listStock } from "@/lib/db";

export async function GET() {
  await connection();
  return Response.json(suggestBundles(await listStock()));
}
