/**
 * Server-only AI helpers — Lovable AI Gateway (Responses API).
 * Never import from client code: reads LOVABLE_API_KEY from process.env.
 */
import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import { z } from "zod";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";
const MODEL = "openai/gpt-6-astra";

const extractedSchema = z.object({
  value: z.number().int().min(0).max(1000000).nullable(),
  vehicle: z.string().trim().max(60).nullable(),
});

export type ExtractedStats = z.infer<typeof extractedSchema>;
export type ExtractCategory = "damage" | "spot" | "kills";

const CATEGORY_HINTS: Record<ExtractCategory, string> = {
  damage:
    "celkové poškození způsobené hráčem (damage dealt) — na výsledkové liště typicky první/nejvyšší číslo, často u ikony děla nebo granátu",
  spot:
    "poškození způsobené po hráčově nasvícení (spotting/assist damage) — typicky číslo u ikony dalekohledu/oko, označené jako asistence při nasvícení",
  kills:
    "počet zničených nepřátel (kills/destroyed) — typicky malé číslo u ikony lebky nebo zničených tanků",
};

function buildPrompt(category: ExtractCategory): string {
  return `Jsi extraktor herních statistik. Na obrázku je screenshot z konce bitvy (typicky tanková hra World of Tanks — výsledková tabulka).
Hráč hlásí výsledek v kategorii "${category}": ${CATEGORY_HINTS[category]}.
Přečti z obrázku PŘESNĚ tuto hodnotu pro hráče, který screenshot nahrál (zvýrazněný řádek nebo hlavní čísla na obrazovce).
Vrať POUZE validní JSON bez jakéhokoliv dalšího textu ve tvaru:
{"value": number | null, "vehicle": string | null}

Pravidla:
- value je vždy celé číslo odpovídající kategorii "${category}" — NE jiná kategorie, i kdyby byla výraznější.
- vehicle = název stroje/tanky, který hráč použil; pokud není poznat, null.
- Pokud hodnotu pro kategorii "${category}" nelze spolehlivě přečíst, vrať null.`;
}

export async function extractStatsFromImage(
  imageDataUrl: string,
  category: ExtractCategory,
): Promise<ExtractedStats> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI není nakonfigurované (chybí LOVABLE_API_KEY).");

  const provider = createOpenAI({
    baseURL: GATEWAY_URL,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });

  const result = streamText({
    model: provider.responses(MODEL),
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: buildPrompt(category) },
          {
            type: "file",
            data: new URL(imageDataUrl),
            mediaType: imageDataUrl.match(/^data:([^;]+);/)?.[1] ?? "image/png",
          },
        ],
      },
    ],
    providerOptions: {
      openai: {
        store: false,
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        include: ["reasoning.encrypted_content"],
      },
    },
  });

  const text = (await result.text).trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("AI nedokázalo přečíst statistiky z obrázku.");
  const parsed = extractedSchema.safeParse(JSON.parse(jsonMatch[0]));
  if (!parsed.success) throw new Error("AI vrátilo nečitelný výsledek.");
  return parsed.data;
}
