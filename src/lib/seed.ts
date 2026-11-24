import type { AppData, Channel, ChannelSnapshot, Episode, EpisodeSnapshot, Story, StorySnapshot } from "./types";
import { addDaysISO, isoOf, todayISO } from "./format";

/* Deterministic PRNG so the demo dataset is identical on every launch. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface StoryDef {
  title: string;
  cover: string | null;
  status: Story["status"];
  createdDaysAgo: number;
  eps: number;
  gap: number;
  target: number;
  baseRating: number;
}

interface ChannelDef {
  name: string;
  handle: string;
  color: string;
  followers0: number;
  growth: number;
  stories: StoryDef[];
}

const EP_TITLES = [
  "पहिली संधी", "थंड हात", "कोकणाचा पाऊस", "एकटी रात्र", "चहाची थंडी", "बाणीचं घर",
  "सकाळची गाडी", "दोन मिनिटं", "खिडकीतून", "ओलावडाणा", "माणुसकी", "शेवटचा माणूस",
  "पत्र", "नदीपार", "काठीचा पाया", "उन्हाळ्याची संधी", "आठवणीचा खजिना", "मेघ आणि मी",
  "तीन दिवस", "घर परत", "सावळी रात्र", "अंधारातला दीप", "एक वाक्य", "सख्या मैत्री",
  "पावसाळी थांबा", "लहान गोष्ट", "खरं खरं", "सपनं आणि धोका", "पुढचा थांबा", "संध्याकाळ",
  "आभाळाखाली", "माझी ओळख", "उरलेला वेळ", "कागदावरचं",
];

const CHANNELS: ChannelDef[] = [
  {
    name: "Vaishali Kulkarni",
    handle: "@vaishali.k",
    color: "#C9B8FF",
    followers0: 4200,
    growth: 1.95,
    stories: [
      { title: "माझं नाव स्वाती नाही", cover: "/images/cover-lavender.jpg", status: "ongoing", createdDaysAgo: 330, eps: 24, gap: 12, target: 420000, baseRating: 4.7 },
      { title: "कोकणाच्या रात्री", cover: null, status: "completed", createdDaysAgo: 300, eps: 18, gap: 15, target: 260000, baseRating: 4.5 },
      { title: "चहाची सगळ्या गोष्टी", cover: null, status: "ongoing", createdDaysAgo: 210, eps: 14, gap: 13, target: 150000, baseRating: 4.8 },
    ],
  },
  {
    name: "Rohit Deshmukh",
    handle: "@rohitdes",
    color: "#B8F0D8",
    followers0: 6800,
    growth: 2.6,
    stories: [
      { title: "मुंबई लोकल", cover: "/images/cover-mint.jpg", status: "ongoing", createdDaysAgo: 345, eps: 30, gap: 11, target: 610000, baseRating: 4.6 },
      { title: "एक चिठ्ठी, दोन शहरे", cover: null, status: "completed", createdDaysAgo: 250, eps: 16, gap: 14, target: 220000, baseRating: 4.4 },
      { title: "रस्त्याच्या कडेला", cover: null, status: "ongoing", createdDaysAgo: 160, eps: 12, gap: 12, target: 95000, baseRating: 4.9 },
    ],
  },
  {
    name: "Ananya Joshi",
    handle: "@ananyakatha",
    color: "#FFD3B6",
    followers0: 3100,
    growth: 2.2,
    stories: [
      { title: "सावळीचं घर", cover: "/images/cover-peach.jpg", status: "ongoing", createdDaysAgo: 320, eps: 21, gap: 14, target: 380000, baseRating: 4.8 },
      { title: "शेवटची ट्रेन", cover: null, status: "ongoing", createdDaysAgo: 240, eps: 16, gap: 13, target: 190000, baseRating: 4.3 },
      { title: "पाऊस आणि आठवणी", cover: null, status: "completed", createdDaysAgo: 180, eps: 11, gap: 15, target: 120000, baseRating: 4.6 },
    ],
  },
];

const SPAN = 365; // days of history

/**
 * Builds 12 months of internally consistent demo data:
 * episode curves roll up into story totals, stories roll up into channel totals.
 */
export function buildSeed(today = todayISO()): AppData {
  const rnd = mulberry32(20260214);
  const channels: Channel[] = [];
  const stories: Story[] = [];
  const episodes: Episode[] = [];
  const channelSnapshots: ChannelSnapshot[] = [];
  const storySnapshots: StorySnapshot[] = [];
  const episodeSnapshots: EpisodeSnapshot[] = [];

  const dates: string[] = [];
  for (let back = SPAN - 1; back >= 0; back--) dates.push(addDaysISO(today, -back));

  let sIdx = 0;
  CHANNELS.forEach((cdef, ci) => {
    const channelId = `ch_${ci + 1}`;
    channels.push({
      id: channelId,
      name: cdef.name,
      handle: cdef.handle,
      colorHex: cdef.color,
      baselineFollowers: cdef.followers0,
      createdAt: addDaysISO(today, -(SPAN - 1)),
    });

    const storyCurves: { storyId: string; views: number[] }[] = [];

    cdef.stories.forEach((sdef, si) => {
      sIdx += 1;
      const storyId = `st_${sIdx}`;
      const createdAt = addDaysISO(today, -sdef.createdDaysAgo);
      stories.push({
        id: storyId,
        channelId,
        title: sdef.title,
        coverUri: sdef.cover,
        status: sdef.status,
        createdAt,
      });

      // ---- episodes ----
      const epList: { ep: Episode; curve: number[]; rating: number }[] = [];
      for (let i = 0; i < sdef.eps; i++) {
        const published = addDaysISO(today, -(sdef.createdDaysAgo - i * sdef.gap));
        const ep: Episode = {
          id: `ep_${storyId}_${i + 1}`,
          storyId,
          episodeNumber: i + 1,
          title: EP_TITLES[(si * 5 + i) % EP_TITLES.length],
          publishedDate: published,
        };
        episodes.push(ep);

        const speed = 0.045 + rnd() * 0.03;
        const target = sdef.target * (0.55 + rnd() * 0.9) / sdef.eps;
        const curve: number[] = [];
        let acc = 0;
        for (let d = 0; d < SPAN; d++) {
          const dayIso = dates[d];
          const daysSincePublish = Math.round((Date.parse(published) - Date.parse(dayIso)) / 86400000);
          if (daysSincePublish > 0) {
            curve.push(0);
            continue;
          }
          const age = -daysSincePublish;
          const spike = rnd() < 0.04 ? 2.2 + rnd() * 2.5 : 1;
          const inc = target * speed * Math.exp(-speed * age) * (0.7 + rnd() * 0.6) * spike;
          acc += inc;
          curve.push(Math.round(acc));
        }
        const rating = Math.min(5, Math.max(3.6, sdef.baseRating + (rnd() - 0.5) * 0.5));
        epList.push({ ep, curve, rating });

        // episode snapshots every 2 days (+ publish day + today)
        for (let d = 0; d < SPAN; d++) {
          const isPublishDay = dates[d] === published;
          if (!isPublishDay && d % 2 !== 0 && d !== SPAN - 1) continue;
          if (Date.parse(dates[d]) < Date.parse(published)) continue;
          episodeSnapshots.push({
            id: `es_${ep.id}_${d}`,
            episodeId: ep.id,
            snapshotDate: dates[d],
            views: curve[d],
            rating: Number(rating.toFixed(2)),
            isBaseline: d === 0 || isPublishDay ? 1 : 0,
          });
        }
      }

      // ---- story = Σ episodes ----
      const views: number[] = [];
      for (let d = 0; d < SPAN; d++) {
        let sum = 0;
        for (const e of epList) sum += e.curve[d];
        views.push(sum);
      }
      for (let d = 0; d < SPAN; d++) {
        const epCount = epList.filter((e) => Date.parse(e.ep.publishedDate) <= Date.parse(dates[d])).length;
        const v = views[d];
        const ratingCount = v === 0 ? 0 : Math.max(3, Math.round(v / (760 + rnd() * 240)));
        const rating =
          v === 0
            ? sdef.baseRating
            : Math.min(5, Math.max(3.5, epList.reduce((acc, e) => acc + e.rating * e.curve[d], 0) / (v || 1)));
        storySnapshots.push({
          id: `ss_${storyId}_${d}`,
          storyId,
          snapshotDate: dates[d],
          views: v,
          rating: Number(rating.toFixed(2)),
          ratingCount,
          episodeCount: epCount,
          isBaseline: d === 0 ? 1 : 0,
        });
      }
      storyCurves.push({ storyId, views });
    });

    // ---- channel = Σ stories, followers growth ----
    const viralDays = new Set<number>();
    while (viralDays.size < 4) viralDays.add(Math.floor(rnd() * SPAN));
    let followerBump = 0;
    for (let d = 0; d < SPAN; d++) {
      const totalViews = storyCurves.reduce((acc, s) => acc + s.views[d], 0);
      const ageFrac = d / (SPAN - 1);
      if (viralDays.has(d)) followerBump += cdef.followers0 * (0.06 + rnd() * 0.14);
      const wobble = 1 + (rnd() - 0.5) * 0.012;
      const followers = Math.round((cdef.followers0 * (1 + cdef.growth * ageFrac) + followerBump) * wobble);
      const totalStories = stories.filter((s) => s.channelId === channelId && Date.parse(s.createdAt) <= Date.parse(dates[d])).length;
      channelSnapshots.push({
        id: `cs_${channelId}_${d}`,
        channelId,
        snapshotDate: dates[d],
        followers,
        totalViews,
        totalStories,
        isBaseline: d === 0 ? 1 : 0,
      });
    }
  });

  return {
    channels,
    stories,
    episodes,
    channelSnapshots,
    storySnapshots,
    episodeSnapshots,
    settings: { geminiKey: "", seededOn: isoOf(new Date()) },
  };
}
