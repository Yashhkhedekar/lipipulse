"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ChevronRight, Pencil, Plus, Star } from "lucide-react";
import { useApp } from "@/store";
import { PERIODS, type StoryRow, channelMetric, contribution, downsample, idx, pulse30, seriesForChannels, slicePeriod, storyRows } from "@/lib/analytics";
import { fmtCompact, fmtFull, fmtPct, fmtRating, fmtSigned, todayISO } from "@/lib/format";
import { Button, Card, Dot, Empty, Growth, Num, Segmented } from "@/components/ui";
import { Sparkline } from "@/components/charts";
import { RankBadge, StoryThumb } from "@/components/bits";

function StoryLine({ row, rank, onClick }: { row: StoryRow; rank?: number; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="press flex w-full items-center gap-3 py-3 text-left">
      {rank !== undefined && <RankBadge rank={rank} />}
      <StoryThumb cover={row.story.coverUri} color={row.channelColor} title={row.story.title} />
      <div className="min-w-0 flex-1">
        <p className="deva truncate text-[14.5px] font-medium">{row.story.title}</p>
        <p className="mt-0.5 truncate text-[11.5px] text-muted tnum">
          {row.episodeCount} eps · ★ {fmtRating(row.rating)} · +{fmtCompact(row.episodeGain)} eps
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[14px] font-semibold tnum">{fmtCompact(row.views)}</p>
        <p className="mt-0.5 text-[11.5px] font-semibold tnum text-pos">{fmtSigned(row.viewsGain)}</p>
      </div>
      <ChevronRight size={14} className="shrink-0 text-muted" />
    </button>
  );
}

export default function Channels() {
  const data = useApp((s) => s.data);
  const period = useApp((s) => s.period);
  const setPeriod = useApp((s) => s.setPeriod);
  const setDetail = useApp((s) => s.setDetail);
  const setSheet = useApp((s) => s.setSheet);
  const today = todayISO();
  const I = useMemo(() => idx(data), [data]);

  return (
    <div className="px-5 pt-5 pb-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-[30px] italic leading-[1.05] tracking-[-0.01em]">Channels</h1>
          <p className="mt-1 text-[12.5px] text-muted">
            {data.channels.length} Pratilipi accounts · {data.stories.length} stories
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSheet({ kind: "channelForm" })}
          className="press grid h-9 w-9 place-items-center rounded-full bg-ink text-paper"
          aria-label="Add channel"
        >
          <Plus size={17} />
        </button>
      </div>

      <div className="mt-4">
        <Segmented value={period} onChange={setPeriod} options={PERIODS.map((p) => ({ value: p.key, label: p.short }))} />
      </div>

      <div className="mt-3 space-y-2.5">
        {data.channels.map((c, i) => {
          const m = channelMetric(data, c.id, period, today);
          const p30 = pulse30(data, [c.id], today);
          const spark = downsample(slicePeriod(seriesForChannels(data, [c.id], "views"), period, today), 40);
          const share = contribution(data, today).find((s) => s.id === c.id)?.share ?? 0;
          const stories = I.storiesByChannel.get(c.id) ?? [];
          return (
            <Card key={c.id} i={i} onClick={() => setDetail({ type: "channel", id: c.id })} className="overflow-hidden">
              <div className="h-1 w-full" style={{ background: c.colorHex }} />
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <motion.span
                    layoutId={`ch-${c.id}`}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[15px] font-semibold"
                    style={{ background: c.colorHex }}
                    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {c.name.charAt(0)}
                  </motion.span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15.5px] font-semibold tracking-[-0.01em]">{c.name}</p>
                    <p className="truncate text-[11.5px] text-muted">
                      {c.handle} · {Math.round(share)}% of total views
                    </p>
                  </div>
                  <ChevronRight size={16} className="mt-1 shrink-0 text-muted" />
                </div>

                <div className="mt-3.5 grid grid-cols-2 gap-y-3">
                  <div>
                    <p className="eyebrow">Followers</p>
                    <p className="mt-1 text-[19px] font-semibold leading-none tnum">
                      <Num value={m.followers} format={fmtFull} />
                    </p>
                    <div className="mt-1.5">
                      <Growth value={m.followersGain} pct={m.followersPct} />
                    </div>
                  </div>
                  <div>
                    <p className="eyebrow">Views</p>
                    <p className="mt-1 text-[19px] font-semibold leading-none tnum">
                      <Num value={m.views} format={fmtCompact} />
                    </p>
                    <div className="mt-1.5">
                      <Growth value={m.viewsGain} pct={m.viewsPct} />
                    </div>
                  </div>
                  <div>
                    <p className="eyebrow">Avg rating</p>
                    <p className="mt-1 flex items-center gap-1 text-[19px] font-semibold leading-none tnum">
                      {fmtRating(m.rating)}
                      <Star size={12} className="fill-ink text-ink" />
                    </p>
                    <p className="mt-1.5 text-[11px] text-muted tnum">{fmtCompact(m.ratingCount)} ratings</p>
                  </div>
                  <div>
                    <p className="eyebrow">Library</p>
                    <p className="mt-1 text-[19px] font-semibold leading-none tnum">
                      {m.stories} <span className="text-[12px] font-medium text-muted">stories</span>
                    </p>
                    <p className="mt-1.5 text-[11px] text-muted tnum">{m.episodes} episodes</p>
                  </div>
                </div>

                <div className="mt-3.5">
                  <Sparkline points={spark} color={c.colorHex === "#FFD3B6" ? "#E8894B" : c.colorHex} height={36} />
                </div>

                <div className="mt-3 flex items-center justify-between rounded-[14px] bg-pill px-3 py-2">
                  <span className="eyebrow">Last 30 days</span>
                  <span className="flex items-center gap-2.5 text-[12px] font-semibold tnum">
                    <span className="text-pos">+{fmtCompact(p30.newViews)} views</span>
                    <span className="h-3 w-px bg-hair" />
                    <span className="text-accent">+{Math.max(0, p30.newEpisodes)} eps</span>
                  </span>
                </div>
                <p className="mt-2 text-[11px] text-muted">{stories.length} stories tracking in this channel</p>
              </div>
            </Card>
          );
        })}

        {!data.channels.length && (
          <Empty
            title="No channels yet"
            body="Add your first Pratilipi author account to start tracking daily snapshot deltas."
            action={<Button onClick={() => setSheet({ kind: "channelForm" })}>Add channel</Button>}
          />
        )}
      </div>
    </div>
  );
}

export function ChannelDetail({ channelId }: { channelId: string }) {
  const data = useApp((s) => s.data);
  const setDetail = useApp((s) => s.setDetail);
  const setSheet = useApp((s) => s.setSheet);
  const setPeriod = useApp((s) => s.setPeriod);
  const period = useApp((s) => s.period);
  const today = todayISO();
  const I = useMemo(() => idx(data), [data]);
  const channel = I.channelById.get(channelId);

  const [sort, setSort] = useState<"views" | "gain" | "rating" | "episodes" | "updated">("gain");
  const rows = useMemo(() => {
    const list = storyRows(data, [channelId], period, today);
    const sorted = [...list];
    if (sort === "views") sorted.sort((a, b) => b.views - a.views);
    if (sort === "gain") sorted.sort((a, b) => b.viewsGain - a.viewsGain);
    if (sort === "rating") sorted.sort((a, b) => b.rating - a.rating);
    if (sort === "episodes") sorted.sort((a, b) => b.episodeCount - a.episodeCount);
    if (sort === "updated") sorted.sort((a, b) => (a.story.createdAt < b.story.createdAt ? 1 : -1));
    return sorted;
  }, [data, channelId, period, sort, today]);

  if (!channel) return null;
  const m = channelMetric(data, channelId, period, today);
  const breakdown = PERIODS.filter((p) => p.key !== "ALL");

  return (
    <div className="px-5 pt-5 pb-8">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setDetail(null)}
          className="press flex items-center gap-1.5 rounded-full bg-pill px-3 py-1.5 text-[12.5px] font-medium"
        >
          <ArrowLeft size={14} /> Channels
        </button>
        <button
          type="button"
          onClick={() => setSheet({ kind: "channelForm", channelId })}
          className="press flex items-center gap-1.5 rounded-full bg-pill px-3 py-1.5 text-[12.5px] font-medium"
        >
          <Pencil size={13} /> Edit
        </button>
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="mt-4 flex items-center gap-3">
          <motion.span
            layoutId={`ch-${channel.id}`}
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-[18px] font-semibold"
            style={{ background: channel.colorHex }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            {channel.name.charAt(0)}
          </motion.span>
          <div className="min-w-0">
            <h1 className="truncate text-[22px] font-semibold tracking-[-0.02em]">{channel.name}</h1>
            <p className="truncate text-[12.5px] text-muted">{channel.handle}</p>
          </div>
        </div>

        <Card i={1} className="mt-4 p-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="eyebrow">Total views</p>
              <p className="mt-1.5 text-[30px] font-semibold leading-none tracking-[-0.03em]">
                <Num value={m.views} format={fmtFull} />
              </p>
            </div>
            <Growth value={m.viewsGain} pct={m.viewsPct} />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 border-t border-hair pt-3.5">
            <div>
              <p className="eyebrow">Followers</p>
              <p className="mt-1 text-[15.5px] font-semibold tnum">{fmtFull(m.followers)}</p>
              <p className="text-[11px] tnum text-pos">{fmtSigned(m.followersGain)}</p>
            </div>
            <div>
              <p className="eyebrow">Rating</p>
              <p className="mt-1 text-[15.5px] font-semibold tnum">{fmtRating(m.rating)} ★</p>
              <p className="text-[11px] tnum text-muted">{fmtCompact(m.ratingCount)}</p>
            </div>
            <div>
              <p className="eyebrow">Library</p>
              <p className="mt-1 text-[15.5px] font-semibold tnum">
                {m.stories}/{m.episodes}
              </p>
              <p className="text-[11px] text-muted">stories/eps</p>
            </div>
          </div>
        </Card>

        <p className="eyebrow mt-5 mb-2">Period breakdown</p>
        <div className="no-scrollbar -mx-5 flex gap-2.5 overflow-x-auto px-5">
          {breakdown.map((p) => {
            const pm = channelMetric(data, channelId, p.key, today);
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => setPeriod(p.key)}
                className={`press min-w-[128px] shrink-0 rounded-[18px] border p-3 text-left ${
                  period === p.key ? "border-ink bg-surface" : "border-hair bg-surface"
                }`}
              >
                <p className="eyebrow">{p.label}</p>
                <p className="mt-1.5 text-[17px] font-semibold tnum">{fmtCompact(pm.viewsGain)}</p>
                <p className="mt-1 text-[11.5px] font-medium tnum text-pos">{fmtPct(pm.viewsPct)} views</p>
                <p className="mt-1.5 text-[11px] tnum text-muted">{fmtSigned(pm.followersGain)} followers</p>
              </button>
            );
          })}
        </div>

        <p className="eyebrow mt-5 mb-1">Top 3 · {PERIODS.find((p) => p.key === period)?.label}</p>
        <Card i={2} className="p-4">
          <div className="divide-y divide-hair">
            {rows.slice(0, 3).map((row, i) => (
              <StoryLine key={row.story.id} row={row} rank={i + 1} onClick={() => setDetail({ type: "story", id: row.story.id })} />
            ))}
            {!rows.length && <p className="py-5 text-center text-[12.5px] text-muted">No stories in this channel yet.</p>}
          </div>
        </Card>

        <div className="mt-5 mb-2 flex items-center justify-between">
          <p className="eyebrow">All stories</p>
          <div className="w-[210px]">
            <Segmented
              compact
              value={sort}
              onChange={setSort}
              options={[
                { value: "gain", label: "30D" },
                { value: "views", label: "Views" },
                { value: "rating", label: "Rating" },
                { value: "episodes", label: "Eps" },
              ]}
            />
          </div>
        </div>
        <Card i={3} className="p-4">
          <div className="divide-y divide-hair">
            {rows.map((row) => (
              <StoryLine key={row.story.id} row={row} onClick={() => setDetail({ type: "story", id: row.story.id })} />
            ))}
            {!rows.length && <p className="py-5 text-center text-[12.5px] text-muted">Nothing here yet.</p>}
          </div>
        </Card>

        <div className="mt-4 flex items-center gap-2 text-[11.5px] text-muted">
          <Dot color={channel.colorHex} size={7} />
          Baseline followers {fmtFull(channel.baselineFollowers)} · first snapshot {channel.createdAt}
        </div>
      </motion.div>
    </div>
  );
}
