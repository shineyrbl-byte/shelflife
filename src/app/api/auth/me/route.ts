import { connection } from "next/server";
import { currentSession } from "@/lib/auth";

/** Who's logged in, for the staff header. */
export async function GET() {
  await connection();
  const session = await currentSession();
  if (!session) return Response.json({ error: "Not logged in." }, { status: 401 });
  return Response.json({ email: session.user.email, shop: { name: session.shop.name, slug: session.shop.slug } });
}
