import type { ScanImage } from "@/store";

/**
 * Device-side Gemini Vision pipeline.
 *
 * Runs entirely on the phone (no server needed), which is what makes the APK build
 * possible: the installed app talks to Google's API directly with the key the author
 * saved in Settings.
 */

export const GEMINI_MODEL = "gemini-2.5-flash";

const endpoint = (model: string) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

/** Exact extraction prompt from the LipiPulse spec. */
export const SCAN_PROMPT = `You are an expert data extraction engine for the Pratilipi Author App.
Analyze the screenshot, identify what screen it represents, and return ONLY valid JSON matching this schema:

{
  "screen_type": "author_profile | story_list | story_detail | episode_list",
  "channel_name": string | null,
  "followers": int | null,
  "total_channel_views": int | null,
  "stories": [
    {
      "title": string,
      "views": int | null,
      "rating": float | null,
      "rating_count": int | null,
      "episode_count": int | null
    }
  ],
  "episodes": [
    {
      "story_title": string | null,
      "episode_number": int | null,
      "title": string,
      "views": int | null,
      "rating": float | null,
      "published_date": "YYYY-MM-DD" | null
    }
  ]
}

Strict Parsing Rules:
1. Convert abbreviated Indian/International numbers into full integers:
   - "1.2K" or "१.२ हजार" -> 1200
   - "2.45L" or "2.45 Lakh" or "२.४५ लाख" -> 245000
   - "1.5M" -> 1500000
   - "1.2Cr" or "कोटी" -> 12000000
2. Convert Devanagari numerals (०१२३४५६७८९) to standard ASCII digits (0-9).
3. Keep story and episode titles in their original script (Marathi/Hindi/English).
4. Never guess or hallucinate numbers; if a field is not visible, return null.`;

export interface Shot {
  name: string;
  mime: string;
  data: string; // base64 without the data-url prefix
}

function parseJson(text: string): unknown {
  const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  return JSON.parse(cleaned);
}

function body(parts: unknown[]) {
  return JSON.stringify({
    contents: [{ parts }],
    generationConfig: { temperature: 0, responseMimeType: "application/json" },
  });
}

function normalize(parsed: Partial<ScanImage>, name: string): ScanImage {
  return {
    name,
    screen_type: parsed.screen_type ?? "story_list",
    channel_name: parsed.channel_name ?? null,
    followers: parsed.followers ?? null,
    total_channel_views: parsed.total_channel_views ?? null,
    stories: Array.isArray(parsed.stories) ? parsed.stories : [],
    episodes: Array.isArray(parsed.episodes) ? parsed.episodes : [],
  };
}

/** Scans every screenshot on-device and returns structured records. */
export async function scanOnDevice(shots: Shot[], key: string): Promise<ScanImage[]> {
  if (!key) throw new Error("No Gemini API key saved");
  const out: ScanImage[] = [];
  const errors: string[] = [];

  for (const shot of shots) {
    const res = await fetch(`${endpoint(GEMINI_MODEL)}?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body([{ inline_data: { mime_type: shot.mime || "image/png", data: shot.data } }, { text: SCAN_PROMPT }]),
    });

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 200);
      errors.push(`${shot.name}: ${res.status} ${detail}`);
      continue;
    }
    const json = await res.json();
    const text: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    out.push(normalize(parseJson(text) as Partial<ScanImage>, shot.name));
  }

  if (!out.length) throw new Error(errors.join(" · ") || "Extraction failed");
  return out;
}

/** Lightweight connectivity check used by Settings → Test connection. */
export async function testKeyOnDevice(key: string): Promise<{ ok: boolean; message: string; model?: string }> {
  try {
    const res = await fetch(`${endpoint(GEMINI_MODEL)}?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Reply with the single word: ready" }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 16 },
      }),
    });
    if (!res.ok) return { ok: false, message: `Gemini ${res.status}: ${(await res.text()).slice(0, 200)}` };
    const json = await res.json();
    const reply = String(json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim().slice(0, 60);
    return { ok: true, message: `Connected on device · ${GEMINI_MODEL}${reply ? ` · “${reply}”` : ""}`, model: GEMINI_MODEL };
  } catch (e) {
    return { ok: false, message: `Network error: ${(e as Error).message}` };
  }
}

/* ------------------------------------------------------------------ */
/* Offline demo extraction — no key, no network.                       */
/* ------------------------------------------------------------------ */

const SAMPLES: Omit<ScanImage, "name">[] = [
  {
    screen_type: "author_profile",
    channel_name: "Vaishali Kulkarni",
    followers: 12480,
    total_channel_views: 861240,
    stories: [
      { title: "माझं नाव स्वाती नाही", views: 418300, rating: 4.7, rating_count: 2140, episode_count: 24 },
      { title: "कोकणाच्या रात्री", views: 262900, rating: 4.5, rating_count: 1385, episode_count: 18 },
      { title: "चहाची सगळ्या गोष्टी", views: 141250, rating: 4.8, rating_count: 742, episode_count: 14 },
    ],
    episodes: [],
  },
  {
    screen_type: "story_list",
    channel_name: "Rohit Deshmukh",
    followers: 24120,
    total_channel_views: 951400,
    stories: [
      { title: "मुंबई लोकल", views: 611800, rating: 4.6, rating_count: 3210, episode_count: 31 },
      { title: "एक चिठ्ठी, दोन शहरे", views: 226400, rating: 4.4, rating_count: 1198, episode_count: 16 },
      { title: "रस्त्याच्या कडेला", views: 96700, rating: 4.9, rating_count: 412, episode_count: 12 },
    ],
    episodes: [],
  },
  {
    screen_type: "episode_list",
    channel_name: null,
    followers: null,
    total_channel_views: null,
    stories: [],
    episodes: [
      { story_title: "सावळीचं घर", episode_number: 22, title: "कागदावरचं", views: 18420, rating: 4.7, published_date: "2026-01-14" },
      { story_title: "सावळीचं घर", episode_number: 21, title: "उरलेला वेळ", views: 24980, rating: 4.8, published_date: "2025-12-31" },
      { story_title: "शेवटची ट्रेन", episode_number: 17, title: "पुढचा थांबा", views: 12110, rating: 4.3, published_date: "2026-01-09" },
    ],
  },
];

/** Demo records. The third story is intentionally lower than the stored snapshot so the amber sanity check shows. */
export function demoExtraction(names: string[]): ScanImage[] {
  return names.map((name, i) => ({ ...SAMPLES[i % SAMPLES.length], name }));
}
