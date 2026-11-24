import type { AppData, ChannelSnapshot, StorySnapshot } from "./types";
import { addDaysISO, daysBetween, todayISO } from "./format";

/**
 * Fills the missing daily snapshots of the last `days` days for the scoped channels
 * and their stories, so a freshly added channel immediately has a measurable 7D delta.
 *
 * Rules:
 *  - existing snapshots are NEVER modified or overwritten
 *  - if real history already spans the window, values are interpolated between the
 *    first and last genuine snapshot
 *  - if the entity was only just created, values grow backwards from today's numbers
 *    at a plausible daily rate (~1.3% followers, ~1.6% views)
 *  - rows are always marked isBaseline = 0 so the true first snapshot stays the baseline
 */
export function backfillLast7(
  data: AppData,
  ids: string[],
  days = 7,
  today = todayISO(),
): { data: AppData; created: number } {
  const channelSnapshots: ChannelSnapshot[] = [...data.channelSnapshots];
  const storySnapshots: StorySnapshot[] = [...data.storySnapshots];
  let created = 0;

  const byDate = <T extends { snapshotDate: string }>(a: T, b: T) => (a.snapshotDate < b.snapshotDate ? -1 : 1);
  const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);

  const windowStart = addDaysISO(today, -(days - 1));

  for (const c of data.channels.filter((x) => ids.includes(x.id))) {
    const snaps = data.channelSnapshots.filter((s) => s.channelId === c.id).sort(byDate);
    const first = snaps[0];
    const last = snaps[snaps.length - 1];
    if (!last) continue;
    const taken = new Set(snaps.map((s) => s.snapshotDate));
    const span = first ? daysBetween(first.snapshotDate, last.snapshotDate) : 0;
    const hasHistory = Boolean(first) && span >= days && first!.snapshotDate <= windowStart;

    for (let back = days - 1; back >= 1; back--) {
      const date = addDaysISO(today, -back);
      if (taken.has(date)) continue;

      let followers: number;
      let totalViews: number;
      let totalStories: number;

      if (hasHistory && first) {
        const t = Math.min(1, Math.max(0, daysBetween(first.snapshotDate, date) / Math.max(1, span)));
        followers = lerp(first.followers, last.followers, t);
        totalViews = lerp(first.totalViews, last.totalViews, t);
        totalStories = lerp(first.totalStories, last.totalStories, t);
      } else {
        followers = Math.max(0, Math.round(last.followers * (1 - 0.013 * back)));
        totalViews = Math.max(0, Math.round(last.totalViews * (1 - 0.016 * back)));
        totalStories = last.totalStories;
      }

      channelSnapshots.push({
        id: `bf_cs_${c.id}_${date}`,
        channelId: c.id,
        snapshotDate: date,
        followers,
        totalViews,
        totalStories,
        isBaseline: 0,
      });
      created += 1;
    }
  }

  for (const st of data.stories.filter((s) => ids.includes(s.channelId))) {
    const snaps = data.storySnapshots.filter((s) => s.storyId === st.id).sort(byDate);
    const first = snaps[0];
    const last = snaps[snaps.length - 1];
    if (!last) continue;
    const taken = new Set(snaps.map((s) => s.snapshotDate));
    const span = first ? daysBetween(first.snapshotDate, last.snapshotDate) : 0;
    const hasHistory = Boolean(first) && span >= days && first!.snapshotDate <= windowStart;

    for (let back = days - 1; back >= 1; back--) {
      const date = addDaysISO(today, -back);
      if (taken.has(date)) continue;

      let views: number;
      let rating: number;
      let ratingCount: number;
      let episodeCount: number;

      if (hasHistory && first) {
        const t = Math.min(1, Math.max(0, daysBetween(first.snapshotDate, date) / Math.max(1, span)));
        views = lerp(first.views, last.views, t);
        ratingCount = lerp(first.ratingCount, last.ratingCount, t);
        rating = Number(((first.rating + (last.rating - first.rating) * t) || last.rating).toFixed(2));
        episodeCount = lerp(first.episodeCount, last.episodeCount, t);
      } else {
        views = Math.max(0, Math.round(last.views * (1 - 0.016 * back)));
        ratingCount = Math.max(0, Math.round(last.ratingCount * (1 - 0.016 * back)));
        rating = last.rating;
        episodeCount = Math.max(0, last.episodeCount - Math.floor(back / 3));
      }

      storySnapshots.push({
        id: `bf_ss_${st.id}_${date}`,
        storyId: st.id,
        snapshotDate: date,
        views,
        rating,
        ratingCount,
        episodeCount,
        isBaseline: 0,
      });
      created += 1;
    }
  }

  return { data: { ...data, channelSnapshots, storySnapshots }, created };
}
