import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

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
Vrati JSON: {"caption": "opis 2-4 rečenice sa 1-3 emojija", "hashtags": ["#hashtag", ... 8-12 relevantnih na srpskom i engleskom]}.`;
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

async function callGemini(key: string, model: string, sys: string, user: string): Promise<unknown> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
    key,
  )}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: sys }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { maxOutputTokens: 900, temperature: 0.8, responseMimeType: "application/json" },
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`${res.status} ${t.slice(0, 220)}`);
  }
  const data = await res.json();
  const text: string =
    data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
  if (!text) throw new Error(`prazan odgovor: ${JSON.stringify(data).slice(0, 220)}`);
  return extractJson(text);
}

async function callClaude(key: string, sys: string, user: string): Promise<unknown> {
  const client = new Anthropic({ apiKey: key });
  const msg = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 900,
    system: sys,
    messages: [{ role: "user", content: user }],
  });
  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  return extractJson(text);
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  if (!body?.mode) return Response.json({ error: "bad_request" }, { status: 400 });

  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  // demo dok nijedan ključ nije podešen
  if (!geminiKey && !anthropicKey) return Response.json(demo(body));

  const user = prompt(body);

  if (geminiKey) {
    const models = [GEMINI_MODEL, "gemini-2.0-flash", "gemini-flash-latest", "gemini-1.5-flash"].filter(
      (m, i, a) => a.indexOf(m) === i,
    );
    let lastErr = "";
    for (const m of models) {
      try {
        return Response.json(await callGemini(geminiKey, m, BRAND, user));
      } catch (e) {
        lastErr = `[${m}] ${(e as Error).message || String(e)}`;
      }
    }
    console.error("Gemini error", lastErr);
    return Response.json({ error: "ai_failed", detail: lastErr.slice(0, 300) }, { status: 502 });
  }

  try {
    return Response.json(await callClaude(anthropicKey!, BRAND, user));
  } catch (e) {
    console.error("Claude error", e);
    return Response.json({ error: "ai_failed", detail: (e as Error).message?.slice(0, 300) }, { status: 502 });
  }
}
