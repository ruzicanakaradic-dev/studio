import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

const BRAND = `Ti si pomoćnik za marketing brenda "Ružini domaći kolači" — mali domaći biznis koji po porudžbini pravi kolače, torte i sitne kolače.
Ton: topao, domaći, pristupačan i primamljiv. Piši na srpskom (latinica), kratko i prilagođeno za Instagram i TikTok.
Uvek odgovaraj ISKLJUČIVO validnim JSON-om bez markdown ograda i bez dodatnog teksta.`;

type Body = {
  mode: "suggest" | "caption" | "improve" | "layout";
  idea?: string;
  format?: string;
  tone?: string;
  text?: string;
  texts?: string[];
};

function prompt(b: Body): string {
  const fmt = b.format || "objava";
  switch (b.mode) {
    case "suggest":
      return `Za Instagram ${fmt} na temu: "${b.idea || "domaći kolači"}".
Predloži kratke tekstove. Vrati JSON: {"title": "kratak udarni naslov (2-5 reči)", "subtitle": "podnaslov (do 8 reči)", "cta": "poziv na akciju (1-2 reči, npr. Naruči)"}.`;
    case "caption":
      return `Napiši opis (caption) za Instagram/TikTok ${fmt} na temu: "${b.idea || "domaći kolači"}".
${b.texts?.length ? `Tekst na objavi: ${b.texts.join(" | ")}.` : ""}
Vrati JSON: {"caption": "opis 2-4 rečenice sa 1-3 emojija", "hashtags": ["#hashtag", ...  8-12 relevantnih na srpskom i engleskom]}.`;
    case "improve":
      return `Poboljšaj ovaj tekst za objavu: "${b.text || ""}". Željeni pravac: ${b.tone || "toplo i primamljivo"}.
Zadrži isti jezik (srpski, latinica). Vrati JSON: {"content": "poboljšan tekst"}.`;
    case "layout":
      return `Za ${fmt} (vertikalni format), rasporedi ove tekstualne slojeve po platnu radi lepe kompozicije i čitljivosti.
Slojevi (redom): ${JSON.stringify(b.texts || [])}.
Pravila: x i y su procenti 0-100 (gornji-levi ugao sloja). Drži tekst unutar bezbedne zone: x između 6 i 78, y između 10 i 82. Najvažniji tekst krupniji. Ne preklapaj slojeve.
Vrati JSON: {"layout": [{"x": number, "y": number, "size": number(18-64), "align": "left"|"center"|"right"}, ...]} — jedan objekat po sloju, istim redosledom.`;
  }
}

function demo(b: Body) {
  switch (b.mode) {
    case "suggest":
      return { title: "Slatko iskušenje", subtitle: "Domaći sitni kolači, ručno pravljeni", cta: "Naruči", demo: true };
    case "caption":
      return {
        caption: "Ručno pravljeni sitni kolači, iz naše kuhinje pravo na tvoju slavu 🍰 Naruči na vreme i počasti svoje goste.",
        hashtags: ["#domacikolaci", "#sitnikolaci", "#kolaci", "#slava", "#homemade", "#dessert", "#baking", "#srbija", "#torte", "#poslastice"],
        demo: true,
      };
    case "improve":
      return { content: (b.text || "") + " ✨", demo: true };
    case "layout":
      return {
        layout: (b.texts || []).map((_, i) => ({ x: 8, y: 24 + i * 16, size: i === 0 ? 40 : 22, align: "left" })),
        demo: true,
      };
  }
}

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("no json");
  return JSON.parse(text.slice(start, end + 1));
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  if (!body?.mode) return Response.json({ error: "bad_request" }, { status: 400 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // radi u demo režimu dok se ne doda ključ
    return Response.json(demo(body));
  }

  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 900,
      system: BRAND,
      messages: [{ role: "user", content: prompt(body) }],
    });
    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    return Response.json(extractJson(text));
  } catch (e) {
    console.error("AI error", e);
    return Response.json({ error: "ai_failed" }, { status: 502 });
  }
}
