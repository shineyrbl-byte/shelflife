import type { z } from "zod";

/** Parses a JSON request body with a Zod schema; returns the data or a 400 response. */
export async function readBody<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T> | Response> {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (parsed.success) return parsed.data;
  const issue = parsed.error.issues[0];
  return Response.json({ error: issue ? `${issue.path.join(".") || "body"}: ${issue.message}` : "Bad request" }, { status: 400 });
}

export const notFound = () => Response.json({ error: "Not found" }, { status: 404 });
