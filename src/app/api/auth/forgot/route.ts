import { z } from "zod";
import { createResetLink } from "@/lib/auth";
import { countRecentResets, findUserByEmail } from "@/lib/db";
import { emailEnabled, sendEmail } from "@/lib/email";
import { readBody } from "@/lib/http";
import { appUrl } from "@/lib/urls";

const Body = z.object({ email: z.string().trim().toLowerCase().max(200) });
const MAX_PER_HOUR = 3;

/**
 * Emails a password reset link (valid 1 hour). The answer is the same whether or not the email
 * has an account, so this can't be used to find out who uses ShelfLife.
 */
export async function POST(req: Request) {
  if (!emailEnabled()) {
    return Response.json({ emailEnabled: false });
  }
  const body = await readBody(req, Body);
  if (body instanceof Response) return body;
  const user = await findUserByEmail(body.email);
  if (user && (await countRecentResets(user.id, new Date(Date.now() - 3600000).toISOString())) < MAX_PER_HOUR) {
    const { url } = await createResetLink(appUrl(req), user.shopId, user.id, 1);
    try {
      await sendEmail(
        user.email,
        "Reset your ShelfLife password",
        `Someone (hopefully you) asked to reset your ShelfLife password.\n\nSet a new one here (the link works once, for 1 hour):\n${url}\n\nIf it wasn't you, ignore this email: your password stays the same.`,
        `<p>Someone (hopefully you) asked to reset your ShelfLife password.</p>
<p><a href="${url}" style="display:inline-block;background:#059669;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Set a new password</a></p>
<p style="color:#78716c;font-size:13px">The link works once, for 1 hour. If it wasn't you, ignore this email: your password stays the same.</p>`,
      );
    } catch (err) {
      console.error("reset email failed", err);
    }
  }
  return Response.json({ emailEnabled: true });
}
