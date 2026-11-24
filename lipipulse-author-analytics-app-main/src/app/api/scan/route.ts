import { SCAN_PROMPT, GEMINI_MODEL, demoExtraction, type Shot } from "@/lib/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface IncomingImage extends Shot {}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function parseModelText(text: string): unknown {
  return JSON.parse(text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim());
}

export async function POST(req: Request) {
  let body: { images?: IncomingImage[]; test?: boolean; clientKey?: string } | null = null;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const key = process.env.GEMINI_API_KEY?.trim() || body?.clientKey?.trim() || undefined;
  const images: IncomingImage[] = body?.images && Array.isArray(body.images) ? body.images : [];

  if (body?.test) {
    if (!key) {
      return json({ ok: false, demo: true, message: "No Gemini key configured — LipiPulse will use offline demo extraction." });
    }
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(key)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: "Reply with the single word: ready" }] }],
            generationConfig: { temperature: 0, maxOutputTokens: 16 },
          }),
        },
      );
      if (!res.ok) return json({ ok: false, message: `Gemini ${res.status}: ${(await res.text()).slice(0, 240)}` });
      const data = await res.json();
      const reply = String(data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim().slice(0, 80);
      return json({ ok: true, model: GEMINI_MODEL, reply });
    } catch (e) {
      return json({ ok: false, message: `Network error: ${(e as Error).message}` });
    }
  }

  if (!images.length) return json({ error: "No images supplied" }, 400);
  if (!key) return json({ demo: true, images: demoExtraction(images.map((i) => i.name)) });

  const results: ScanImageLite[] = [];
  const errors: string[] = [];

  for (const img of images) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(key)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ inline_data: { mime_type: img.mime || "image/png", data: img.data } }, { text: SCAN_PROMPT }] }],
            generationConfig: { temperature: 0, responseMimeType: "application/json" },
          }),
        },
      );
      if (!res.ok) {
        errors.push(`${img.name}: Gemini ${res.status} ${(await res.text()).slice(0, 160)}`);
        continue;
      }
      const data = await res.json();
      const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      const parsed = parseModelText(text) as Partial<ScanImageLite>;
      results.push({
        name: img.name,
        screen_type: parsed.screen_type ?? "story_list",
        channel_name: parsed.channel_name ?? null,
        followers: parsed.followers ?? null,
        total_channel_views: parsed.total_channel_views ?? null,
        stories: Array.isArray(parsed.stories) ? parsed.stories : [],
        episodes: Array.isArray(parsed.episodes) ? parsed.episodes : [],
      });
    } catch (e) {
      errors.push(`${img.name}: ${(e as Error).message}`);
    }
  }

  if (!results.length) return json({ error: errors.join(" · ") || "Extraction failed", demo: false }, 502);
  return json({ demo: false, images: results, errors });
}

type ScanImageLite = {
  name: string;
  screen_type: string;
  channel_name: string | null;
  followers: number | null;
  total_channel_views: number | null;
  stories: { title: string; views: number | null; rating: number | null; rating_count: number | null; episode_count: number | null }[];
  episodes: { story_title: string | null; episode_number: number | null; title: string; views: number | null; rating: number | null; published_date: string | null }[];
};
