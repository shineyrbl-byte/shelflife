import { ApiError, GoogleGenAI, type Part } from "@google/genai";
import { z } from "zod";
import { CATEGORIES, UNITS, expiryLabel, rupees, type BundleItem } from "./schema";

// Optional AI features on Gemini's free tier: bundle copywriting and reading supplier bills.
// AI only writes words or reads text; prices, pairing and stock rules stay in plain code.

export const aiEnabled = () => Boolean(process.env.GEMINI_API_KEY);

// Flash-Lite is the fallback when the main model is overloaded or out of free quota.
const MODELS = [process.env.GEMINI_MODEL || "gemini-flash-latest", "gemini-flash-lite-latest"];
export const isBusyError = (err: unknown) => err instanceof ApiError && [429, 500, 503].includes(err.status);

let client: GoogleGenAI | null = null;
const getClient = () => (client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }));

/** Asks Gemini for JSON matching a Zod schema, trying the fallback model if the first is busy. */
async function generateJson<T extends z.ZodType>(schema: T, system: string, parts: Part[], maxOutputTokens = 4096): Promise<z.infer<T>> {
  const { $schema, ...jsonSchema } = z.toJSONSchema(schema) as Record<string, unknown>;
  void $schema; // Gemini rejects the $schema keyword
  let lastErr: unknown;
  for (const model of MODELS) {
    try {
      const res = await getClient().models.generateContent({
        model,
        contents: [{ role: "user", parts }],
        config: { systemInstruction: system, responseMimeType: "application/json", responseJsonSchema: jsonSchema, maxOutputTokens },
      });
      const parsed = schema.safeParse(JSON.parse(res.text ?? "null"));
      if (!parsed.success) throw new Error("Could not read the AI response. Please try again.");
      return parsed.data;
    } catch (err) {
      lastErr = err;
      if (!isBusyError(err)) throw err;
    }
  }
  throw lastErr;
}

// ---- Bundle copy ----

export const CopySchema = z.object({
  title: z.string().describe("Catchy bundle name, max 40 characters, no prices"),
  description: z.string().describe("One or two short sentences for customers, max 160 characters"),
});
export type Copy = z.infer<typeof CopySchema>;

const COPY_SYSTEM = `You write menu copy for a small, friendly café in India that sells near-expiry food as discounted "rescue bundles".
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
  const copy = await generateJson(CopySchema, COPY_SYSTEM, [{ text: prompt }]);
  return { title: copy.title.slice(0, 100), description: copy.description.slice(0, 300) };
}

// ---- Bill scanning ----

export const BillSchema = z.object({
  readable: z.boolean().describe("false if the image is not a bill/invoice/receipt or is too blurry to read"),
  supplier: z.string().describe("Supplier or shop name on the bill, or empty"),
  items: z.array(
    z.object({
      name: z.string().describe("Short, clean product name as a café would call it, e.g. 'Amul milk' not 'AMUL TAAZA 1L PCH'"),
      category: z.enum(CATEGORIES),
      unit: z.enum(UNITS).describe("pcs for countable items, kg for loose produce, L for liquids sold by volume, pack for packaged goods"),
      quantity: z.number().describe("Number of units in `unit`, e.g. 6 pouches of 1 L milk = 6 L"),
      unitCost: z.number().describe("Cost per unit in rupees, after any discount, including tax if shown per line"),
      shelfLifeDays: z.number().int().describe("Typical days until expiry from today for this item if stored properly; a best guess"),
    }),
  ),
});
export type Bill = z.infer<typeof BillSchema>;

const BILL_SYSTEM = `You read supplier bills, invoices and receipts for a small café or grocery shop in India and turn them into stock lines.
- Only include goods the shop will stock and sell or use: food, drinks, ingredients. Skip delivery charges, totals, taxes lines, deposits and bags.
- Convert quantities to the chosen unit (e.g. 2 trays of 30 eggs = 60 pcs; 500 g x 4 = 2 kg). unitCost must match that unit.
- If a line shows only a total amount, divide by the quantity to get the unit cost.
- If a number is unreadable, make your best guess rather than skipping the line; staff will review every line.`;

export const SCAN_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export async function readBill(image: { data: Buffer; mimeType: string }): Promise<Bill> {
  return generateJson(
    BillSchema,
    BILL_SYSTEM,
    [{ inlineData: { mimeType: image.mimeType, data: image.data.toString("base64") } }, { text: "Read this bill and list its stock lines." }],
    8192,
  );
}
