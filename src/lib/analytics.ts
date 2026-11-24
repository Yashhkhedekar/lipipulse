import type { AppData, Episode, PeriodKey, Story } from "./types";
import { addDaysISO, todayISO } from "./format";

export interface Pt {
  date: string;
  v: number;
}

export interface PeriodDef {
  key: PeriodKey;
  label: string;
  short: string;
  days: number | null;
}

export const PERIODS: PeriodDef[] = [
  { key: "7D", label: "Weekly", short: "7D", days: 7 },
  { key: "30D", label: "Monthly", short: "30D", days: 30 },
  { key: "90D", label: "Quarterly", short: "Qtr", days: 90 },
  { key: "365D", label: "Yearly", short: "Year", days: 365 },
  { key: "ALL", label: "All time", short: "All", days: null },
];

export const PERIOD_DAYS: Record<PeriodKey, number | null> = {
  "7D": 7,
  "30D": 30,
  "90D": 90,
  "365D": 365,
  ALL: null,
};

/* ---------------- snapshot lookup (boundary fallback rule) ---------------- */

/** Exact date → closest prior → earliest available snapshot. */
export function pickAt(pts: Pt[], target: string): Pt | null {
  if (!pts.length) return null;
  let lo = 0;
  let hi = pts.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (pts[mid].date <= target) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  if (found === -1) return pts[0];
  return pts[found];
}

export interface Delta {
  cur: Pt;
  base: Pt;
  gain: number;
  pct: number | null;
}

export function deltaOf(pts: Pt[], period: PeriodKey, today = todayISO()): Delta {
  if (!pts.length) {
    const zero: Pt = { date: today, v: 0 };
    return { cur: zero, base: zero, gain: 0, pct: null };
  }
  const cur = pts[pts.length - 1];
  const days = PERIOD_DAYS[period];
  const base = days === null ? pts[0] : (pickAt(pts, addDaysISO(today, -days)) ?? pts[0]);
  const gain = cur.v - base.v;
  const pct = base.v === 0 ? null : (gain / base.v) * 100;
  return { cur, base, gain, pct };
}

/** Points from the period baseline up to now (inclusive), for charting. */
export function slicePeriod(pts: Pt[], period: PeriodKey, today = todayISO()): Pt[] {
  if (!pts.length) return pts;
  const d = deltaOf(pts, period, today);
  return pts.filter((p) => p.date >= d.base.date);
}

/** Union of dates across series, forward-filling each with its prior value. */
export function combineSeries(list: Pt[][]): Pt[] {
  const dateSet = new Set<string>();
  for (const s of list) for (const p of s) dateSet.add(p.date);
  const dates = [...dateSet].sort();
  if (!dates.length) return [];
  const cursors = list.map(() => -1);
  return dates.map((date) => {
    let total = 0;
    list.forEach((s, i) => {
      while (cursors[i] + 1 < s.length && s[cursors[i] + 1].date <= date) cursors[i] += 1;
      total += cursors[i] >= 0 ? s[cursors[i]].v : 0;
    });
    return { date, v: total };
  });
}

export function downsample(pts: Pt[], max = 64): Pt[] {
  if (pts.length <= max) return pts;
  const bucket = Math.ceil(pts.length / max);
  const out: Pt[] = [];
  for (let i = 0; i < pts.length; i += bucket) {
    const chunk = pts.slice(i, i + bucket);
    const v = chunk.reduce((a, p) => a + p.v, 0) / chunk.length;
    out.push({ date: chunk[chunk.length - 1].date, v: Math.round(v) });
  }
  return out;
}

/* ---------------- index ---------------- */

export interface Index {
  channelById: Map<string, AppData["channels"][number]>;
  storyById: Map<string, Story>;
  storiesByChannel: Map<string, Story[]>;
  episodesByStory: Map<string, Episode[]>;
  chSeries: Map<string, Map<string, Pt[]>>; // metric -> channelId -> points
  stSeries: Map<string, Pt[]>;
  epSeries: Map<string, Pt[]>;
}

let cache: { data: AppData; idx: Index } | null = null;

export function idx(data: AppData): Index {
  if (cache && cache.data === data) return cache.idx;

  const channelById = new Map(data.channels.map((c) => [c.id, c]));
  const storyById = new Map(data.stories.map((s) => [s.id, s]));
  const storiesByChannel = new Map<string, Story[]>();
  for (const s of data.stories) {
    const arr = storiesByChannel.get(s.channelId) ?? [];
    arr.push(s);
    storiesByChannel.set(s.channelId, arr);
  }
  const episodesByStory = new Map<string, Episode[]>();
  for (const e of data.episodes) {
    const arr = episodesByStory.get(e.storyId) ?? [];
    arr.push(e);
    episodesByStory.set(e.storyId, arr);
  }
  for (const arr of episodesByStory.values()) arr.sort((a, b) => a.episodeNumber - b.episodeNumber);

  const chSeries = new Map<string, Map<string, Pt[]>>();
  const chViews = new Map<string, Pt[]>();
  const chFollowers = new Map<string, Pt[]>();
  for (const s of data.channelSnapshots) {
    const v = chViews.get(s.channelId) ?? [];
    v.push({ date: s.snapshotDate, v: s.totalViews });
    chViews.set(s.channelId, v);
    const f = chFollowers.get(s.channelId) ?? [];
    f.push({ date: s.snapshotDate, v: s.followers });
    chFollowers.set(s.channelId, f);
  }
  for (const arr of chViews.values()) arr.sort((a, b) => (a.date < b.date ? -1 : 1));
  for (const arr of chFollowers.values()) arr.sort((a, b) => (a.date < b.date ? -1 : 1));
  chSeries.set("views", chViews);
  chSeries.set("followers", chFollowers);

  const stSeries = new Map<string, Pt[]>();
  for (const s of data.storySnapshots) {
    const arr = stSeries.get(s.storyId) ?? [];
    arr.push({ date: s.snapshotDate, v: s.views });
    stSeries.set(s.storyId, arr);
  }
  for (const arr of stSeries.values()) arr.sort((a, b) => (a.date < b.date ? -1 : 1));

  const epSeries = new Map<string, Pt[]>();
  for (const s of data.episodeSnapshots) {
    const arr = epSeries.get(s.episodeId) ?? [];
    arr.push({ date: s.snapshotDate, v: s.views });
    epSeries.set(s.episodeId, arr);
  }
  for (const arr of epSeries.values()) arr.sort((a, b) => (a.date < b.date ? -1 : 1));

  const built: Index = { channelById, storyById, storiesByChannel, episodesByStory, chSeries, stSeries, epSeries };
  cache = { data, idx: built };
  return built;
}

/* ---------------- metrics ---------------- */

export function scopeChannelIds(data: AppData, filter: string | null): string[] {
  return filter && filter !== "all" ? [filter] : data.channels.map((c) => c.id);
}

export function seriesForChannels(data: AppData, channelIds: string[], metric: "views" | "followers"): Pt[] {
  const I = idx(data);
  const map = I.chSeries.get(metric)!;
  return combineSeries(channelIds.map((id) => map.get(id) ?? []));
}

export interface ChannelMetric {
  views: number;
  viewsGain: number;
  viewsPct: number | null;
  followers: number;
  followersGain: number;
  followersPct: number | null;
  stories: number;
  episodes: number;
  rating: number;
  ratingCount: number;
  ratingGain: number;
}

function latestStorySnapshot(data: AppData, storyId: string) {
  const I = idx(data);
  const pts = I.stSeries.get(storyId);
  if (!pts?.length) return null;
  const latestDate = pts[pts.length - 1].date;
  for (let i = data.storySnapshots.length - 1; i >= 0; i--) {
    const s = data.storySnapshots[i];
    if (s.storyId === storyId && s.snapshotDate === latestDate) return s;
  }
  return null;
}

export function channelMetric(data: AppData, channelId: string | null, period: PeriodKey, today = todayISO()): ChannelMetric {
  const I = idx(data);
  const ids = channelId && channelId !== "all" ? [channelId] : data.channels.map((c) => c.id);
  const viewsSerie = seriesForChannels(data, ids, "views");
  const followersSerie = seriesForChannels(data, ids, "followers");
  const vD = deltaOf(viewsSerie, period, today);
  const fD = deltaOf(followersSerie, period, today);

  const stories = data.stories.filter((s) => ids.includes(s.channelId));
  let ratingCount = 0;
  let ratingWeighted = 0;
  let episodes = 0;
  for (const s of stories) {
    const snap = latestStorySnapshot(data, s.id);
    if (!snap) continue;
    ratingCount += snap.ratingCount;
    ratingWeighted += snap.rating * snap.ratingCount;
    episodes += snap.episodeCount;
  }
  const rating = ratingCount ? ratingWeighted / ratingCount : 0;

  return {
    views: vD.cur.v,
    viewsGain: vD.gain,
    viewsPct: vD.pct,
    followers: fD.cur.v,
    followersGain: fD.gain,
    followersPct: fD.pct,
    stories: stories.length,
    episodes,
    rating,
    ratingCount,
    ratingGain: 0,
  };
}

export interface StoryMetric {
  story: Story;
  views: number;
  viewsGain: number;
  viewsPct: number | null;
  rating: number;
  ratingCount: number;
  episodeCount: number;
  episodeGain: number;
  series: Pt[];
}

export function storyMetric(data: AppData, storyId: string, period: PeriodKey, today = todayISO()): StoryMetric | null {
  const I = idx(data);
  const story = I.storyById.get(storyId);
  if (!story) return null;
  const serie = I.stSeries.get(storyId) ?? [];
  const d = deltaOf(serie, period, today);
  const snaps = data.storySnapshots.filter((s) => s.storyId === storyId);
  const latest = snaps.length ? snaps[snaps.length - 1] : null;
  const epSerie = snaps.map((s) => ({ date: s.snapshotDate, v: s.episodeCount }));
  const epD = deltaOf(epSerie, period, today);
  return {
    story,
    views: d.cur.v,
    viewsGain: d.gain,
    viewsPct: d.pct,
    rating: latest?.rating ?? 0,
    ratingCount: latest?.ratingCount ?? 0,
    episodeCount: latest?.episodeCount ?? 0,
    episodeGain: epD.gain,
    series: serie,
  };
}

export interface StoryRow extends StoryMetric {
  channelId: string;
  channelColor: string;
  channelName: string;
}

export function storyRows(data: AppData, channelIds: string[], period: PeriodKey, today = todayISO()): StoryRow[] {
  const I = idx(data);
  const out: StoryRow[] = [];
  for (const s of data.stories) {
    if (!channelIds.includes(s.channelId)) continue;
    const m = storyMetric(data, s.id, period, today);
    if (!m) continue;
    const ch = I.channelById.get(s.channelId);
    out.push({ ...m, channelId: s.channelId, channelColor: ch?.colorHex ?? "#C9B8FF", channelName: ch?.name ?? "" });
  }
  return out;
}

/** Last-30-day pulse — mandatory calculations from the spec. */
export interface Pulse {
  newViews: number;
  newEpisodes: number;
  newFollowers: number;
  dailyAvg: number;
  prevFollowers: number;
}

export function pulse30(data: AppData, channelIds: string[], today = todayISO()): Pulse {
  const views = seriesForChannels(data, channelIds, "views");
  const followers = seriesForChannels(data, channelIds, "followers");
  const vD = deltaOf(views, "30D", today);
  const fD = deltaOf(followers, "30D", today);

  let newEpisodes = 0;
  for (const s of data.stories) {
    if (!channelIds.includes(s.channelId)) continue;
    const snaps = data.storySnapshots.filter((x) => x.storyId === s.id);
    if (!snaps.length) continue;
    const epSerie = snaps.map((x) => ({ date: x.snapshotDate, v: x.episodeCount }));
    newEpisodes += deltaOf(epSerie, "30D", today).gain;
  }
  return {
    newViews: vD.gain,
    newEpisodes,
    newFollowers: fD.gain,
    dailyAvg: Math.round(vD.gain / 30),
    prevFollowers: fD.base.v,
  };
}

export type PodiumMode = "gain" | "total" | "rating";

export function podium(data: AppData, channelIds: string[], period: PeriodKey, mode: PodiumMode, today = todayISO()): StoryRow[] {
  const rows = storyRows(data, channelIds, period, today);
  const sorted = [...rows];
  if (mode === "gain") sorted.sort((a, b) => b.viewsGain - a.viewsGain);
  if (mode === "total") sorted.sort((a, b) => b.views - a.views);
  if (mode === "rating") sorted.sort((a, b) => b.rating - a.rating || b.ratingCount - a.ratingCount);
  return sorted.slice(0, 3);
}

export function contribution(data: AppData, today = todayISO()): { id: string; name: string; color: string; views: number; share: number }[] {
  const I = idx(data);
  const items = data.channels.map((c) => {
    const serie = I.chSeries.get("views")?.get(c.id) ?? [];
    const views = serie.length ? serie[serie.length - 1].v : 0;
    return { id: c.id, name: c.name, color: c.colorHex, views };
  });
  const total = items.reduce((a, b) => a + b.views, 0) || 1;
  return items.map((i) => ({ ...i, share: (i.views / total) * 100 })).sort((a, b) => b.views - a.views);
}

export function fastestGrowing(data: AppData, channelIds: string[], period: PeriodKey, today = todayISO()): StoryRow | null {
  const rows = storyRows(data, channelIds, period, today);
  if (!rows.length) return null;
  return [...rows].sort((a, b) => b.viewsGain - a.viewsGain)[0];
}

export interface Consistency {
  thisWeek: number;
  lastWeek: number;
  streak: number;
  daily: number[]; // last 14 days counts, oldest first
  bestDay: number;
}

export function consistency(data: AppData, channelIds: string[], today = todayISO()): Consistency {
  const counts = new Map<string, number>();
  for (const e of data.episodes) {
    const story = data.stories.find((s) => s.id === e.storyId);
    if (!story || !channelIds.includes(story.channelId)) continue;
    counts.set(e.publishedDate, (counts.get(e.publishedDate) ?? 0) + 1);
  }
  const dayCount = (iso: string) => counts.get(iso) ?? 0;
  let thisWeek = 0;
  let lastWeek = 0;
  for (let i = 0; i < 7; i++) thisWeek += dayCount(addDaysISO(today, -i));
  for (let i = 7; i < 14; i++) lastWeek += dayCount(addDaysISO(today, -i));

  const daily: number[] = [];
  for (let i = 13; i >= 0; i--) daily.push(dayCount(addDaysISO(today, -i)));

  let streak = 0;
  for (let i = 0; i < 30; i++) {
    if (dayCount(addDaysISO(today, -i)) > 0) streak++;
    else break;
  }
  let longest = streak;
  let run = 0;
  for (let i = 29; i >= 0; i--) {
    if (dayCount(addDaysISO(today, -i)) > 0) {
      run += 1;
      longest = Math.max(longest, run);
    } else run = 0;
  }
  return { thisWeek, lastWeek, streak, daily, bestDay: longest };
}

export interface EpisodeRow {
  episode: Episode;
  views: number;
  rating: number;
  retention: number;
}

export function episodeRows(data: AppData, storyId: string): EpisodeRow[] {
  const I = idx(data);
  const eps = I.episodesByStory.get(storyId) ?? [];
  const rows = eps.map((episode) => {
    const serie = I.epSeries.get(episode.id) ?? [];
    const views = serie.length ? serie[serie.length - 1].v : 0;
    const snaps = data.episodeSnapshots.filter((s) => s.episodeId === episode.id);
    const rating = snaps.length ? snaps[snaps.length - 1].rating : 0;
    return { episode, views, rating, retention: 0 };
  });
  const first = rows[0]?.views || 1;
  return rows.map((r) => ({ ...r, retention: Math.min(100, (r.views / first) * 100) }));
}

/* ---------------- daily snapshot status ---------------- */

export interface SnapshotStatus {
  loggedToday: boolean;
  streak: number;
  lastDate: string | null;
  compareDate: string | null;
}

/** Is today's snapshot recorded for the scoped channels, and how far back does the daily run go? */
export function snapshotStatus(data: AppData, ids: string[], today = todayISO()): SnapshotStatus {
  const dates = new Set<string>();
  for (const s of data.channelSnapshots) if (ids.includes(s.channelId)) dates.add(s.snapshotDate);

  const loggedToday = dates.has(today);
  let streak = 0;
  let cursor = loggedToday ? today : addDaysISO(today, -1);
  while (dates.has(cursor)) {
    streak += 1;
    cursor = addDaysISO(cursor, -1);
  }

  let lastDate: string | null = null;
  for (const d of dates) if (!lastDate || d > lastDate) lastDate = d;

  const serie = seriesForChannels(data, ids, "views");
  const compareDate = serie.length ? deltaOf(serie, "7D", today).base.date : null;

  return { loggedToday, streak, lastDate, compareDate };
}

export function sparkline(data: AppData, channelId: string, days = 30, today = todayISO()): Pt[] {
  const I = idx(data);
  const serie = I.chSeries.get("views")?.get(channelId) ?? [];
  const from = addDaysISO(today, -days);
  const sliced = serie.filter((p) => p.date >= from);
  return sliced.length >= 2 ? sliced : serie.slice(-Math.max(2, days));
}
