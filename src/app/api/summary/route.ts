import { connection } from "next/server";
import { buildSummary } from "@/lib/summary";

/** The owner's daily summary as plain text, used by the dashboard and `npm run summary`. */
export async function GET(req: Request) {
  await connection();
  return Response.json(await buildSummary(process.env.APP_URL || new URL(req.url).origin));
}
