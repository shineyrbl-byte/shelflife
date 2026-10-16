import { z } from "zod";
import { hashPassword, startSession } from "@/lib/auth";
import { createShopWithUser, findUserByEmail } from "@/lib/db";
import { readBody } from "@/lib/http";

const Body = z.object({
  shopName: z.string().trim().min(2, "Shop name is too short").max(60),
  email: z.email("Enter a valid email").trim().toLowerCase(),
  password: z.string().min(8, "Use at least 8 characters").max(200),
});

/** Creates a shop with its first login, and logs in. */
export async function POST(req: Request) {
  const body = await readBody(req, Body);
  if (body instanceof Response) return body;
  if (await findUserByEmail(body.email)) {
    return Response.json({ error: "There's already an account with that email. Log in instead." }, { status: 409 });
  }
  const { shop, user } = await createShopWithUser(body.shopName, body.email, await hashPassword(body.password));
  await startSession(user.id);
  return Response.json({ shop: { name: shop.name, slug: shop.slug } }, { status: 201 });
}
