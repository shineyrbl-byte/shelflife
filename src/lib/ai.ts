import { ApiError, GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { expiryLabel, rupees, type BundleItem } from "./schema";

// Optional AI copywriting for rescue bundles, on Gemini's free tier.
// The rule-based engine still decides what goes in a bundle and its price; AI only names and describes it.

export const aiEnabled = () => Boolean(process.env.GEMINI_API_KEY);

// Flash-Lite is the fallback when the main model is overloaded or out of free quota.
const MODELS = [process.env.GEMINI_MODEL || "gemini-flash-latest", "gemini-flash-lite-latest"];
const isRetryable = (err: unknown) => err instanceof ApiError && [429, 500, 503].includes(err.status);

let client: GoogleGenAI | null = null;
const getClient = () => (client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }));

export const CopySchema = z.object({
  title: z.string().describe("Catchy bundle name, max 40 characters, no prices"),
  description: z.string().describe("One or two short sentences for customers, max 160 characters"),
});
export type Copy = z.infer<typeof CopySchema>;

const SYSTEM = `You write menu copy for a small, friendly café in India that sells near-expiry food as discounted "rescue bundles".
Make the bundle sound appetising and like a smart, feel-good deal. Never imply the food is old, stale or unsafe; say "fresh today" or "best enjoyed today/tomorrow" instead of "expiring".
Plain, warm English. No hashtags. At most one emoji.`;

export async function writeBundleCopy(input: {
  items: Pick<BundleItem, "name" | "quantity" | "unit">[];
  price: number;
  originalPrice: number;
  expiresOn: string;
  shop?: string;
}): Promise<Copy> {
  const prompt = `Shop: ${input.shop || "a neighbourhood café"}
Bundle contents: ${input.items.map((i) => `${i.quantity} ${i.unit} ${i.name}`).join(" + ")}
Price: ${rupees(input.price)} (normally ${rupees(input.originalPrice)})
Best enjoyed by: ${expiryLabel(input.expiresOn)}
Write the bundle's name and description.`;
  const { $schema, ...schema } = z.toJSONSchema(CopySchema) as Record<string, unknown>;
  void $schema; // Gemini rejects the $schema keyword

  let lastErr: unknown;
  for (const model of MODELS) {
    try {
      const res = await getClient().models.generateContent({
        model,
        contents: prompt,
        config: { systemInstruction: SYSTEM, responseMimeType: "application/json", responseJsonSchema: schema, maxOutputTokens: 4096 },
      });
      const parsed = CopySchema.safeParse(JSON.parse(res.text ?? "null"));
      if (!parsed.success) throw new Error("Could not read the AI response. Please try again.");
      return { title: parsed.data.title.slice(0, 100), description: parsed.data.description.slice(0, 300) };
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err)) throw err;
    }
  }
  throw lastErr;
}
