import { create } from "zustand";
import type { AppData, Channel, Episode, PeriodKey, Story } from "@/lib/types";
import { EMPTY_DATA, uid } from "@/lib/types";
import { loadState, saveState } from "@/lib/db";
import { buildSeed } from "@/lib/seed";
import { todayISO } from "@/lib/format";

export type TabKey = "overview" | "channels" | "stories" | "insights";
export type Detail =
  | { type: "story"; id: string }
  | { type: "channel"; id: string }
  | null;
export type SheetKind =
  | { kind: "scan" }
  | { kind: "review"; payload: ScanPayload }
  | { kind: "manual"; target?: string }
  | { kind: "channelForm"; channelId?: string }
  | { kind: "storyForm"; channelId?: string }
  | { kind: "episodeForm"; storyId: string }
  | { kind: "key" }
  | null;

export type StorySort = "views" | "gain" | "rating" | "episodes" | "updated";

/* ---- scan payloads (Gemini extraction → review) ---- */
export interface ScanStoryItem {
  title: string;
  views: number | null;
  rating: number | null;
  rating_count: number | null;
  episode_count: number | null;
}
export interface ScanEpisodeItem {
  story_title: string | null;
  episode_number: number | null;
  title: string;
  views: number | null;
  rating: number | null;
  published_date: string | null;
}
export interface ScanImage {
  name: string;
  screen_type: string;
  channel_name: string | null;
  followers: number | null;
  total_channel_views: number | null;
  stories: ScanStoryItem[];
  episodes: ScanEpisodeItem[];
}
export interface ScanPayload {
  images: ScanImage[];
  demo: boolean;
  date: string;
  channelId: string;
}

interface AppState {
  ready: boolean;
  data: AppData;
  tab: TabKey;
  period: PeriodKey;
  channelFilter: string;
  storySearch: string;
  storySort: StorySort;
  detail: Detail;
  sheet: SheetKind;
  scanning: boolean;
  scanError: string | null;
  toast: string | null;

  hydrate: () => Promise<void>;
  setTab: (t: TabKey) => void;
  setPeriod: (p: PeriodKey) => void;
  setChannelFilter: (id: string) => void;
  setStorySearch: (q: string) => void;
  setStorySort: (s: StorySort) => void;
  setDetail: (d: Detail) => void;
  setSheet: (s: SheetKind) => void;
  setScanning: (b: boolean) => void;
  setScanError: (e: string | null) => void;
  showToast: (msg: string) => void;

  replaceData: (d: AppData) => Promise<void>;
  seedNow: () => Promise<void>;
  setGeminiKey: (k: string) => Promise<void>;
  upsertChannel: (c: Partial<Channel> & { id?: string }) => Promise<void>;
  removeChannel: (id: string) => Promise<void>;
  addStory: (s: { channelId: string; title: string; status: Story["status"]; coverUri?: string | null }) => Promise<void>;
  addEpisode: (e: { storyId: string; title: string; publishedDate: string; episodeNumber?: number }) => Promise<void>;
  saveChannelSnapshot: (input: {
    channelId: string;
    date: string;
    followers?: number | null;
    totalViews?: number | null;
    totalStories?: number | null;
  }) => Promise<void>;
  saveStorySnapshot: (input: {
    storyId: string;
    date: string;
    views?: number | null;
    rating?: number | null;
    ratingCount?: number | null;
    episodeCount?: number | null;
  }) => Promise<void>;
  saveEpisodeSnapshot: (input: {
    episodeId: string;
    date: string;
    views?: number | null;
    rating?: number | null;
  }) => Promise<void>;
}

/** Latest snapshot for an entity on or before `date` — the boundary-fallback baseline. */
function priorSnapshot<T extends { snapshotDate: string }>(rows: T[], field: string, id: string, date: string): T | undefined {
  let best: T | undefined;
  for (const r of rows) {
    if ((r as unknown as Record<string, unknown>)[field] !== id) continue;
    if (r.snapshotDate <= date && (!best || r.snapshotDate > best.snapshotDate)) best = r;
  }
  return best;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePersist(data: AppData) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void saveState(data), 250);
}

export const useApp = create<AppState>((set, get) => ({
  ready: false,
  data: EMPTY_DATA,
  tab: "overview",
  period: "30D",
  channelFilter: "all",
  storySearch: "",
  storySort: "gain",
  detail: null,
  sheet: null,
  scanning: false,
  scanError: null,
  toast: null,

  hydrate: async () => {
    if (get().ready) return;
    let data = await loadState();
    if (!data || !data.channels.length) {
      data = buildSeed();
      await saveState(data);
    }
    set({ data, ready: true });
  },

  setTab: (tab) => set({ tab, detail: null }),
  setPeriod: (period) => set({ period }),
  setChannelFilter: (channelFilter) => set({ channelFilter }),
  setStorySearch: (storySearch) => set({ storySearch }),
  setStorySort: (storySort) => set({ storySort }),
  setDetail: (detail) => set({ detail }),
  setSheet: (sheet) => set({ sheet }),
  setScanning: (scanning) => set({ scanning }),
  setScanError: (scanError) => set({ scanError }),
  showToast: (toast) => {
    set({ toast });
    setTimeout(() => {
      if (get().toast === toast) set({ toast: null });
    }, 2600);
  },

  replaceData: async (d) => {
    set({ data: d });
    await saveState(d);
  },

  seedNow: async () => {
    const d = buildSeed();
    set({ data: d, detail: null, tab: "overview" });
    await saveState(d);
    get().showToast("Demo dataset regenerated — 12 months of history");
  },

  setGeminiKey: async (k) => {
    const data = { ...get().data, settings: { ...get().data.settings, geminiKey: k } };
    set({ data });
    schedulePersist(data);
  },

  upsertChannel: async (c) => {
    const cur = get().data;
    if (c.id) {
      const channels = cur.channels.map((x) => (x.id === c.id ? { ...x, ...c } : x));
      const data = { ...cur, channels };
      set({ data });
      schedulePersist(data);
    } else {
      const colors = ["#C9B8FF", "#B8F0D8", "#FFD3B6", "#A8D8FF", "#FFC9DE"];
      const ch: Channel = {
        id: uid("ch"),
        name: c.name || "New channel",
        handle: c.handle || "@handle",
        colorHex: c.colorHex || colors[cur.channels.length % colors.length],
        baselineFollowers: c.baselineFollowers ?? 0,
        createdAt: todayISO(),
      };
      const data = { ...cur, channels: [...cur.channels, ch] };
      // baseline snapshot so growth maths has an anchor
      data.channelSnapshots = [
        ...cur.channelSnapshots,
        {
          id: uid("cs"),
          channelId: ch.id,
          snapshotDate: todayISO(),
          followers: ch.baselineFollowers,
          totalViews: 0,
          totalStories: 0,
          isBaseline: 1,
        },
      ];
      set({ data });
      schedulePersist(data);
      get().showToast(`Channel “${ch.name}” added`);
    }
  },

  removeChannel: async (id) => {
    const cur = get().data;
    const storyIds = new Set(cur.stories.filter((s) => s.channelId === id).map((s) => s.id));
    const epIds = new Set(cur.episodes.filter((e) => storyIds.has(e.storyId)).map((e) => e.id));
    const data: AppData = {
      ...cur,
      channels: cur.channels.filter((c) => c.id !== id),
      stories: cur.stories.filter((s) => s.channelId !== id),
      episodes: cur.episodes.filter((e) => !epIds.has(e.id)),
      channelSnapshots: cur.channelSnapshots.filter((s) => s.channelId !== id),
      storySnapshots: cur.storySnapshots.filter((s) => !storyIds.has(s.storyId)),
      episodeSnapshots: cur.episodeSnapshots.filter((s) => !epIds.has(s.episodeId)),
    };
    set({ data, detail: null, channelFilter: get().channelFilter === id ? "all" : get().channelFilter });
    schedulePersist(data);
  },

  addStory: async (s) => {
    const cur = get().data;
    const story: Story = {
      id: uid("st"),
      channelId: s.channelId,
      title: s.title,
      coverUri: s.coverUri ?? null,
      status: s.status,
      createdAt: todayISO(),
    };
    const data: AppData = {
      ...cur,
      stories: [...cur.stories, story],
      storySnapshots: [
        ...cur.storySnapshots,
        {
          id: uid("ss"),
          storyId: story.id,
          snapshotDate: todayISO(),
          views: 0,
          rating: 0,
          ratingCount: 0,
          episodeCount: 0,
          isBaseline: 1,
        },
      ],
    };
    set({ data });
    schedulePersist(data);
    get().showToast(`“${s.title}” created`);
  },

  addEpisode: async (e) => {
    const cur = get().data;
    const existing = cur.episodes.filter((x) => x.storyId === e.storyId);
    const number = e.episodeNumber ?? existing.length + 1;
    const ep: Episode = {
      id: uid("ep"),
      storyId: e.storyId,
      episodeNumber: number,
      title: e.title || `प्रकरण ${number}`,
      publishedDate: e.publishedDate,
    };
    const data: AppData = {
      ...cur,
      episodes: [...cur.episodes, ep],
      episodeSnapshots: [
        ...cur.episodeSnapshots,
        { id: uid("es"), episodeId: ep.id, snapshotDate: e.publishedDate, views: 0, rating: 0, isBaseline: 1 },
      ],
    };
    set({ data });
    schedulePersist(data);
    get().showToast(`Episode ${number} logged`);
  },

  saveChannelSnapshot: async (input) => {
    const cur = get().data;
    const existingIdx = cur.channelSnapshots.findIndex(
      (s) => s.channelId === input.channelId && s.snapshotDate === input.date,
    );
    const prev = existingIdx >= 0 ? cur.channelSnapshots[existingIdx] : undefined;
    const prior = prev ?? priorSnapshot(cur.channelSnapshots, "channelId", input.channelId, input.date);
    const storiesCount = cur.stories.filter((s) => s.channelId === input.channelId).length;
    const next = {
      id: prev?.id ?? uid("cs"),
      channelId: input.channelId,
      snapshotDate: input.date,
      followers: input.followers ?? prior?.followers ?? 0,
      totalViews: input.totalViews ?? prior?.totalViews ?? 0,
      totalStories: input.totalStories ?? prior?.totalStories ?? storiesCount,
      isBaseline: (prev ? prev.isBaseline : prior ? 0 : 1) as 0 | 1,
    };
    const channelSnapshots =
      existingIdx >= 0
        ? cur.channelSnapshots.map((s, i) => (i === existingIdx ? next : s))
        : [...cur.channelSnapshots, next];
    const data = { ...cur, channelSnapshots };
    set({ data });
    schedulePersist(data);
  },

  saveStorySnapshot: async (input) => {
    const cur = get().data;
    const existingIdx = cur.storySnapshots.findIndex(
      (s) => s.storyId === input.storyId && s.snapshotDate === input.date,
    );
    const prev = existingIdx >= 0 ? cur.storySnapshots[existingIdx] : undefined;
    const prior = prev ?? priorSnapshot(cur.storySnapshots, "storyId", input.storyId, input.date);
    const epCount = cur.episodes.filter((e) => e.storyId === input.storyId).length;
    const next = {
      id: prev?.id ?? uid("ss"),
      storyId: input.storyId,
      snapshotDate: input.date,
      views: input.views ?? prior?.views ?? 0,
      rating: input.rating ?? prior?.rating ?? 0,
      ratingCount: input.ratingCount ?? prior?.ratingCount ?? 0,
      episodeCount: input.episodeCount ?? prior?.episodeCount ?? epCount,
      isBaseline: (prev ? prev.isBaseline : prior ? 0 : 1) as 0 | 1,
    };
    const storySnapshots =
      existingIdx >= 0
        ? cur.storySnapshots.map((s, i) => (i === existingIdx ? next : s))
        : [...cur.storySnapshots, next];
    const data = { ...cur, storySnapshots };
    set({ data });
    schedulePersist(data);
  },

  saveEpisodeSnapshot: async (input) => {
    const cur = get().data;
    const existingIdx = cur.episodeSnapshots.findIndex(
      (s) => s.episodeId === input.episodeId && s.snapshotDate === input.date,
    );
    const prev = existingIdx >= 0 ? cur.episodeSnapshots[existingIdx] : undefined;
    const prior = prev ?? priorSnapshot(cur.episodeSnapshots, "episodeId", input.episodeId, input.date);
    const next = {
      id: prev?.id ?? uid("es"),
      episodeId: input.episodeId,
      snapshotDate: input.date,
      views: input.views ?? prior?.views ?? 0,
      rating: input.rating ?? prior?.rating ?? 0,
      isBaseline: (prev ? prev.isBaseline : prior ? 0 : 1) as 0 | 1,
    };
    const episodeSnapshots =
      existingIdx >= 0
        ? cur.episodeSnapshots.map((s, i) => (i === existingIdx ? next : s))
        : [...cur.episodeSnapshots, next];
    const data = { ...cur, episodeSnapshots };
    set({ data });
    schedulePersist(data);
  },
}));


