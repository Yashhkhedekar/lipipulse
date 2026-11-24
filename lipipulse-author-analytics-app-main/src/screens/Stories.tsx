"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Plus, ScanLine, Search, Star } from "lucide-react";
import { useApp, type StorySort } from "@/store";
import { PERIODS, episodeRows, idx, storyMetric, storyRows, downsample, slicePeriod } from "@/lib/analytics";
import { fmtCompact, fmtFull, fmtPct, fmtRating, fmtSigned, prettyDate, todayISO } from "@/lib/format";
import { Button, Card, Dot, Empty, Growth, Num, Segmented, Select } from "@/components/ui";
import { AreaChart, Sparkline } from "@/components/charts";
import { KpiTile, StoryThumb } from "@/components/bits";

const SORTS: { value: StorySort; label: string }[] = [
  { value: "gain", label: "Last 30D views gain" },
  { value: "views", label: "Total views" },
  { value: "rating", label: "Rating" },
  { value: "episodes", label: "Episode count" },
  { value: "updated", label: "Recently updated" },
];

export default function Stories() {
  const data = useApp((s) => s.data);
  const period = useApp((s) => s.period);
  const setPeriod = useApp((s) => s.setPeriod);
  const filter = useApp((s) => s.channelFilter);
  const setFilter = useApp((s) => s.setChannelFilter);
  const search = useApp((s) => s.storySearch);
  const setSearch = useApp((s) => s.setStorySearch);
  const sort = useApp((s) => s.storySort);
  const setSort = useApp((s) => s.setStorySort);
  const setDetail = useApp((s) => s.setDetail);
  const setSheet = useApp((s) => s.setSheet);
  const today = todayISO();
  const I = useMemo(() => idx(data), [data]);

  const ids = filter === "all" ? data.channels.map((c) => c.id) : [filter];
  const rows = useMemo(() => {
    const list = storyRows(data, ids, period, today);
    const q = search.trim().toLowerCase();
    const filtered = q
      ? list.filter((r) => r.story.title.toLowerCase().includes(q) || r.channelName.toLowerCase().includes(q))
      : list;
    const sorted = [...filtered];
    if (sort === "views") sorted.sort((a, b) => b.views - a.views);
    if (sort === "gain") sorted.sort((a, b) => b.viewsGain - a.viewsGain);
    if (sort === "rating") sorted.sort((a, b) => b.rating - a.rating);
    if (sort === "episodes") sorted.sort((a, b) => b.episodeCount - a.episodeCount);
    if (sort === "updated") sorted.sort((a, b) => (a.story.createdAt < b.story.createdAt ? 1 : -1));
    return sorted;
  }, [data, ids.join(","), period, search, sort, today]);

  return (
    <div className="px-5 pt-5 pb-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-[30px] italic leading-[1.05] tracking-[-0.01em]">Stories</h1>
          <p className="mt-1 text-[12.5px] text-muted tnum">
            {rows.length} of {data.stories.length} titles · sorted by {SORTS.find((s) => s.value === sort)?.label.toLowerCase()}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSheet({ kind: "scan" })}
            className="press grid h-9 w-9 place-items-center rounded-full bg-pill text-ink"
            aria-label="Scan screenshot"
          >
            <ScanLine size={16} />
          </button>
          <button
            type="button"
            onClick={() => setSheet({ kind: "storyForm" })}
            className="press grid h-9 w-9 place-items-center rounded-full bg-ink text-paper"
            aria-label="Add story"
          >
            <Plus size={17} />
          </button>
        </div>
      </div>

      <div className="relative mt-4">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search Marathi / English titles…"
          className="deva w-full rounded-full border border-hair bg-surface py-2.5 pl-10 pr-4 text-[14px] placeholder:font-sans placeholder:text-muted focus:border-accent focus:outline-none"
        />
      </div>

      <div className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5">
        {[{ id: "all", label: "All channels", color: "#1C1C1E" }, ...data.channels.map((c) => ({ id: c.id, label: c.name.split(" ")[0], color: c.colorHex }))].map(
          (it) => {
            const active = filter === it.id;
            return (
              <button
                key={it.id}
                type="button"
                onClick={() => setFilter(it.id)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-[12.5px] font-medium ${
                  active ? "border-ink bg-ink text-paper" : "border-hair text-muted"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Dot color={it.color} size={7} />
                  {it.label}
                </span>
              </button>
            );
          },
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <Select value={sort} onChange={(v) => setSort(v as StorySort)} options={SORTS} />
        </div>
        <div className="w-[186px] shrink-0">
          <Segmented compact value={period} onChange={setPeriod} options={PERIODS.map((p) => ({ value: p.key, label: p.short }))} />
        </div>
      </div>

      <Card i={0} className="mt-3 divide-y divide-hair p-4">
        {rows.map((row) => (
          <button
            key={row.story.id}
            type="button"
            onClick={() => setDetail({ type: "story", id: row.story.id })}
            className="press flex w-full items-center gap-3 py-3 text-left"
          >
            <StoryThumb layoutId={`story-${row.story.id}`} cover={row.story.coverUri} color={row.channelColor} title={row.story.title} size={42} />
            <div className="min-w-0 flex-1">
              <p className="deva truncate text-[14.5px] font-medium">{row.story.title}</p>
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-[11.5px] text-muted">
                <Dot color={row.channelColor} size={6} />
                {row.channelName.split(" ")[0]} · {row.episodeCount} eps · ★ {fmtRating(row.rating)}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <Growth value={row.viewsGain} />
                <span className="text-[10.5px] tnum text-muted">+{row.episodeGain} eps · {fmtPct(row.viewsPct)}</span>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[15px] font-semibold tnum">{fmtCompact(row.views)}</p>
              <p className="mt-0.5 text-[11px] text-muted tnum">{fmtCompact(row.ratingCount)} ratings</p>
            </div>
          </button>
        ))}
        {!rows.length && (
          <div className="py-4">
            <Empty
              title="No matching stories"
              body="Try a different search, clear the channel filter, or seed the demo dataset from Insights."
            />
          </div>
        )}
      </Card>
    </div>
  );
}

export function StoryDetail({ storyId }: { storyId: string }) {
  const data = useApp((s) => s.data);
  const setDetail = useApp((s) => s.setDetail);
  const setSheet = useApp((s) => s.setSheet);
  const period = useApp((s) => s.period);
  const today = todayISO();
  const I = useMemo(() => idx(data), [data]);
  const [chartPeriod, setChartPeriod] = useState<"7D" | "30D" | "90D" | "365D">("30D");

  const story = I.storyById.get(storyId);
  const m30 = useMemo(() => storyMetric(data, storyId, "30D", today), [data, storyId, today]);
  const m = useMemo(() => storyMetric(data, storyId, period, today), [data, storyId, period, today]);
  const eps = useMemo(() => episodeRows(data, storyId), [data, storyId]);

  const chartPts = useMemo(() => {
    const serie = (m?.series ?? []) as { date: string; v: number }[];
    return downsample(slicePeriod(serie, chartPeriod, today), 60);
  }, [m, chartPeriod, today]);

  const ratingPts = useMemo(
    () =>
      downsample(
        slicePeriod(
          data.storySnapshots.filter((s) => s.storyId === storyId).map((s) => ({ date: s.snapshotDate, v: s.rating })),
          chartPeriod,
          today,
        ),
        60,
      ),
    [data, storyId, chartPeriod, today],
  );

  const [seriesType, setSeriesType] = useState<"views" | "rating">("views");
  const channel = story ? I.channelById.get(story.channelId) : undefined;

  if (!story || !m) return null;
  const velocity = m30 ?? m;
  const avgPerEp = m.episodeCount ? Math.round(m.views / m.episodeCount) : 0;

  return (
    <div className="px-5 pt-5 pb-8">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setDetail(null)}
          className="press flex items-center gap-1.5 rounded-full bg-pill px-3 py-1.5 text-[12.5px] font-medium"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSheet({ kind: "scan" })}
            className="press flex items-center gap-1.5 rounded-full bg-pill px-3 py-1.5 text-[12.5px] font-medium"
          >
            <ScanLine size={13} /> Scan
          </button>
          <button
            type="button"
            onClick={() => setSheet({ kind: "episodeForm", storyId })}
            className="press flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-[12.5px] font-medium text-paper"
          >
            <Plus size={13} /> Episode
          </button>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="mt-4 flex items-start gap-3.5">
          <StoryThumb
            layoutId={`story-${story.id}`}
            cover={story.coverUri}
            color={channel?.colorHex ?? "#C9B8FF"}
            title={story.title}
            size={64}
            radius={16}
          />
          <div className="min-w-0 flex-1 pt-0.5">
            <h1 className="deva text-[21px] font-semibold leading-tight tracking-[-0.01em]">{story.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="flex items-center gap-1.5 rounded-full bg-pill px-2 py-1 text-[11px] font-medium">
                <Dot color={channel?.colorHex ?? "#C9B8FF"} size={6} />
                {channel?.name}
              </span>
              <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${story.status === "ongoing" ? "bg-posbg text-pos" : "bg-pill text-muted"}`}>
                {story.status === "ongoing" ? "Ongoing" : "Completed"}
              </span>
              <span className="rounded-full bg-pill px-2 py-1 text-[11px] font-medium tnum text-muted">since {prettyDate(story.createdAt)}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <Card i={0} className="p-4">
            <KpiTile label="Total views" value={m.views} format={fmtFull} sub={<Growth value={m.viewsGain} pct={m.viewsPct} />} />
          </Card>
          <Card i={1} className="p-4">
            <KpiTile
              label="Overall rating"
              value={m.rating}
              format={fmtRating}
              sub={
                <span className="flex items-center gap-1 tnum">
                  <Star size={10} className="fill-ink text-ink" /> {fmtFull(m.ratingCount)} ratings
                </span>
              }
            />
          </Card>
          <Card i={2} className="p-4">
            <KpiTile label="Episodes" value={m.episodeCount} format={fmtFull} sub={`${fmtSigned(m.episodeGain)} in period`} />
          </Card>
          <Card i={3} className="p-4">
            <KpiTile
              label="Avg per episode"
              value={avgPerEp}
              format={fmtCompact}
              sub={story.status === "ongoing" ? "Publishing active" : "Series complete"}
            />
          </Card>
        </div>

        {/* 30-day velocity */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.15 }}
          className="mt-2.5 rounded-[20px] border border-hair bg-surface p-4"
        >
          <div className="flex items-center justify-between">
            <p className="eyebrow">30-day story velocity</p>
            <span className="rounded-full bg-pill px-2 py-0.5 text-[10.5px] font-semibold tnum text-muted">exact deltas</span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <div>
              <p className="text-[19px] font-semibold leading-none tnum text-accent">
                <Num value={velocity.viewsGain} format={fmtSigned} />
              </p>
              <p className="mt-1.5 text-[11px] text-muted">New views (30D)</p>
            </div>
            <div>
              <p className="text-[19px] font-semibold leading-none tnum text-accent">
                <Num value={velocity.episodeGain} format={fmtSigned} />
              </p>
              <p className="mt-1.5 text-[11px] text-muted">New episodes</p>
            </div>
            <div>
              <p className="text-[19px] font-semibold leading-none tnum">
                <Num value={avgPerEp} format={fmtCompact} />
              </p>
              <p className="mt-1.5 text-[11px] text-muted">Views / episode</p>
            </div>
          </div>
          <div className="mt-3 border-t border-hair pt-3">
            <Sparkline points={downsample(slicePeriod(m.series, "30D", today), 30)} color={channel?.colorHex ?? "#C9B8FF"} height={34} />
          </div>
        </motion.div>

        {/* history chart */}
        <Card i={4} className="mt-2.5 p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-[15px] font-semibold tracking-[-0.01em]">History</h3>
              <p className="mt-0.5 text-[11.5px] text-muted">{seriesType === "views" ? "Cumulative views" : "Rating over time"}</p>
            </div>
            <div className="w-[150px]">
              <Segmented
                compact
                value={seriesType}
                onChange={setSeriesType}
                options={[
                  { value: "views", label: "Views" },
                  { value: "rating", label: "Rating" },
                ]}
              />
            </div>
          </div>

          <div className="mt-3">
            <AreaChart
              key={`${seriesType}-${chartPeriod}`}
              series={[{ points: seriesType === "views" ? chartPts : ratingPts, color: seriesType === "views" ? "#6C7BFF" : "#1F9D63", fill: true }]}
              height={164}
              yFormat={seriesType === "views" ? fmtCompact : (n) => n.toFixed(1)}
              yMin={
                seriesType === "rating" && ratingPts.length
                  ? Math.max(0, Math.min(...ratingPts.map((p) => p.v)) - 0.3)
                  : undefined
              }
            />
          </div>

          <div className="mt-3">
            <Segmented
              value={chartPeriod}
              onChange={setChartPeriod}
              options={PERIODS.slice(0, 4).map((p) => ({ value: p.key as "7D" | "30D" | "90D" | "365D", label: p.short }))}
            />
          </div>
        </Card>

        {/* episodes */}
        <div className="mt-5 mb-2 flex items-end justify-between">
          <p className="eyebrow">Episode breakdown · {eps.length}</p>
          <span className="text-[11px] text-muted">retention vs Ep 1</span>
        </div>
        <Card i={5} className="p-4">
          <div className="divide-y divide-hair">
            {eps
              .slice()
              .reverse()
              .map((r) => (
                <div key={r.episode.id} className="py-3">
                  <div className="flex items-baseline gap-2">
                    <span className="shrink-0 rounded-full bg-pill px-2 py-0.5 text-[10.5px] font-bold tnum text-muted">EP {r.episode.episodeNumber}</span>
                    <p className="deva min-w-0 flex-1 truncate text-[14px] font-medium">{r.episode.title}</p>
                    <p className="shrink-0 text-[13.5px] font-semibold tnum">{fmtCompact(r.views)}</p>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="text-[11px] tnum text-muted">{prettyDate(r.episode.publishedDate)}</span>
                    <span className="text-[11px] tnum text-muted">★ {fmtRating(r.rating)}</span>
                    <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-pill">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: r.retention >= 60 ? "#1F9D63" : r.retention >= 35 ? "#6C7BFF" : "#D94E4E" }}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.max(4, r.retention)}%` }}
                        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                      />
                    </div>
                    <span className="w-9 shrink-0 text-right text-[11px] font-semibold tnum text-muted">{Math.round(r.retention)}%</span>
                  </div>
                </div>
              ))}
            {!eps.length && (
              <div className="py-4">
                <Empty title="No episodes logged" body="Log an episode manually or scan an episode-list screenshot to populate this breakdown." />
              </div>
            )}
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => setSheet({ kind: "episodeForm", storyId })}>
              + Log episode
            </Button>
            <Button variant="quiet" className="flex-1" onClick={() => setSheet({ kind: "scan" })}>
              Scan list
            </Button>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
