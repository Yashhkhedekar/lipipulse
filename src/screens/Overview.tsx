"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, Check, ChevronRight, Pencil, Star } from "lucide-react";
import { useApp } from "@/store";
import {
  PERIODS,
  type PodiumMode,
  channelMetric,
  contribution,
  downsample,
  idx,
  podium,
  pulse30,
  seriesForChannels,
  slicePeriod,
  snapshotStatus,
} from "@/lib/analytics";
import { fmtCompact, fmtFull, fmtPct, fmtRating, fmtSigned, greeting, prettyDate, shortDate, todayISO } from "@/lib/format";
import { Card, Dot, EASE, Growth, Num, Segmented } from "@/components/ui";
import { AreaChart, Sparkline } from "@/components/charts";
import { RankBadge, StoryThumb } from "@/components/bits";

function ChannelPills() {
  const data = useApp((s) => s.data);
  const filter = useApp((s) => s.channelFilter);
  const setFilter = useApp((s) => s.setChannelFilter);

  const items = [
    { id: "all", label: "All channels", color: "#1C1C1E" },
    ...data.channels.map((c) => ({ id: c.id, label: c.name.split(" ")[0], color: c.colorHex })),
  ];

  return (
    <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-0.5">
      {items.map((it) => {
        const active = filter === it.id;
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => setFilter(it.id)}
            className={`relative shrink-0 rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
              active ? "border-transparent font-semibold text-ink" : "border-hair text-muted hover:text-ink"
            }`}
          >
            {active && (
              <motion.span
                layoutId="channel-pill"
                className="absolute inset-0 -z-10 rounded-full border border-hair bg-surface"
                transition={{ type: "spring", stiffness: 460, damping: 38 }}
              />
            )}
            <span className="flex items-center gap-1.5">
              <Dot color={it.color} size={7} />
              {it.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Data-driven ECG-style strip for the 30-day pulse banner. */
function PulseLine({ values, color }: { values: number[]; color: string }) {
  if (values.length < 3) return null;
  const deltas = values.slice(1).map((v, i) => v - values[i]);
  const max = Math.max(1, ...deltas.map(Math.abs));
  const W = 300;
  const H = 26;
  const pts = deltas.map((d, i) => ({
    x: (i / (deltas.length - 1)) * W,
    y: H / 2 - (d / max) * (H / 2 - 2),
  }));
  let path = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i];
    const prev = pts[i - 1];
    path += ` L ${((prev.x + p.x) / 2).toFixed(1)} ${prev.y.toFixed(1)} L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-[26px] w-full" aria-hidden="true">
      <motion.path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="1.4"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
      />
    </svg>
  );
}

export default function Overview() {
  const data = useApp((s) => s.data);
  const period = useApp((s) => s.period);
  const setPeriod = useApp((s) => s.setPeriod);
  const filter = useApp((s) => s.channelFilter);
  const setDetail = useApp((s) => s.setDetail);
  const setSheet = useApp((s) => s.setSheet);

  const [metric, setMetric] = useState<"views" | "followers">("views");
  const [mode, setMode] = useState<PodiumMode>("gain");

  const today = todayISO();
  const ids = filter === "all" ? data.channels.map((c) => c.id) : [filter];
  const I = useMemo(() => idx(data), [data]);
  const periodDef = PERIODS.find((p) => p.key === period)!;

  const m = useMemo(() => channelMetric(data, filter === "all" ? null : filter, period, today), [data, filter, period, today]);
  const p30 = useMemo(() => pulse30(data, ids, today), [data, ids, today]);
  const base = useMemo(() => seriesForChannels(data, ids, metric), [data, ids, metric]);
  const chartPts = useMemo(() => downsample(slicePeriod(base, period, today), 60), [base, period, today]);
  const top = useMemo(() => podium(data, ids, period, mode, today), [data, ids, period, mode, today]);
  const split = useMemo(() => contribution(data, today), [data, today]);
  const idKey = ids.join(",");
  const status = useMemo(() => snapshotStatus(data, ids, today), [data, idKey, today]);
  const pulsePts = useMemo(() => slicePeriod(base, "30D", today).slice(-31), [base, today]);
  const viewsSpark = useMemo(() => downsample(slicePeriod(seriesForChannels(data, ids, "views"), period, today), 40), [data, ids, period, today]);

  const overlay =
    filter === "all" && metric === "views"
      ? data.channels.map((c) => ({
          points: downsample(slicePeriod(I.chSeries.get("views")!.get(c.id) ?? [], period, today), 60),
          color: c.colorHex,
          fill: false as const,
          name: c.name,
        }))
      : [{ points: chartPts, color: "#6C7BFF", fill: true }];

  const scopeLabel = filter === "all" ? "All channels" : (I.channelById.get(filter)?.name ?? "Channel");

  return (
    <div className="px-5 pt-5 pb-6">
      {/* header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-[30px] italic leading-[1.05] tracking-[-0.01em]">{greeting()}</h1>
          <p className="mt-1 truncate text-[12.5px] text-muted">
            {scopeLabel} · {m.stories} stories · {m.episodes} episodes
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-pill px-2.5 py-1.5 text-[11.5px] font-medium tnum text-muted">
          <CalendarDays size={12} />
          {prettyDate(today)}
        </span>
      </div>

      <div className="mt-4">
        <ChannelPills />
      </div>

      <div className="mt-3">
        <Segmented
          value={period}
          onChange={setPeriod}
          options={PERIODS.map((p) => ({ value: p.key, label: p.short }))}
        />
      </div>

      {/* daily snapshot status */}
      <motion.button
        type="button"
        onClick={() => setSheet({ kind: "manual" })}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.03, ease: EASE }}
        whileTap={{ scale: 0.98 }}
        className="mt-2.5 flex w-full items-center gap-3 rounded-[16px] border px-3.5 py-2.5 text-left"
        style={
          status.loggedToday
            ? { background: "#E8F8F0", borderColor: "#DCF2E7" }
            : { background: "#FFFFFF", borderColor: "#EFEFEF" }
        }
      >
        <span
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${status.loggedToday ? "bg-surface text-pos" : "bg-pill text-accent"}`}
        >
          {status.loggedToday ? <Check size={14} strokeWidth={2.6} /> : <Pencil size={13} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-[13px] font-semibold ${status.loggedToday ? "text-pos" : "text-ink"}`}>
            {status.loggedToday
              ? `Snapshot logged today · ${status.streak}-day streak`
              : status.streak > 0
                ? `Today's snapshot pending · ${status.streak}-day run`
                : "Log today's snapshot"}
          </span>
          <span className="block truncate text-[11.5px] tnum text-muted">
            {status.compareDate
              ? `7D compares to ${prettyDate(status.compareDate)}${status.loggedToday ? "" : " · log today to move it"}`
              : "First snapshot recorded — 7D baseline starts here"}
          </span>
        </span>
        <ChevronRight size={15} className="shrink-0 text-muted" />
      </motion.button>

      {/* bento */}
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <Card i={0} className="col-span-2 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="eyebrow">Total views · {periodDef.label}</p>
              <p className="mt-2 text-[34px] font-semibold leading-none tracking-[-0.03em]">
                <Num value={m.views} format={fmtFull} />
              </p>
              <div className="mt-2.5 flex items-center gap-2">
                <Growth value={m.viewsGain} pct={m.viewsPct} />
                <span className="text-[11.5px] text-muted">in {periodDef.label.toLowerCase()}</span>
              </div>
            </div>
            <div className="w-[42%] shrink-0 pt-1">
              <Sparkline points={viewsSpark} color="#6C7BFF" height={58} />
              <p className="mt-1 text-right text-[10.5px] tnum text-muted">
                {viewsSpark.length ? shortDate(viewsSpark[0].date) : ""} → {viewsSpark.length ? shortDate(viewsSpark[viewsSpark.length - 1].date) : ""}
              </p>
            </div>
          </div>
        </Card>

        <Card i={1} className="p-4">
          <p className="eyebrow">Followers</p>
          <p className="mt-2 text-[26px] font-semibold leading-none tracking-[-0.03em]">
            <Num value={m.followers} format={fmtFull} />
          </p>
          <div className="mt-2.5">
            <Growth value={m.followersGain} pct={m.followersPct} />
          </div>
        </Card>

        <Card i={2} className="p-4">
          <p className="eyebrow">Avg rating</p>
          <p className="mt-2 flex items-baseline gap-1 text-[26px] font-semibold leading-none tracking-[-0.03em]">
            <Num value={m.rating} format={fmtRating} />
            <Star size={13} className="translate-y-[-2px] fill-ink text-ink" />
          </p>
          <p className="mt-2.5 text-[11.5px] text-muted tnum">{fmtFull(m.ratingCount)} ratings · weighted</p>
        </Card>

        <Card i={3} className="col-span-2 flex items-stretch gap-4 p-4">
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Episodes</p>
            <p className="mt-2 text-[26px] font-semibold leading-none tracking-[-0.03em]">
              <Num value={m.episodes} format={fmtFull} />
            </p>
            <p className="mt-2 text-[11.5px] text-muted tnum">+{Math.max(0, p30.newEpisodes)} in last 30 days</p>
          </div>
          <div className="w-px bg-hair" />
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Stories</p>
            <p className="mt-2 text-[26px] font-semibold leading-none tracking-[-0.03em]">
              <Num value={m.stories} format={fmtFull} />
            </p>
            <p className="mt-2 text-[11.5px] text-muted">
              {split.length > 1 ? `${split[0].name.split(" ")[0]} leads · ${Math.round(split[0].share)}%` : "Single channel"}
            </p>
          </div>
        </Card>
      </div>

      {/* last 30 days pulse */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="mt-2.5 overflow-hidden rounded-[20px] border border-[#E5E3FF] bg-[#F2F1FF]"
      >
        <div className="flex items-center justify-between px-4 pt-3.5">
          <p className="eyebrow" style={{ color: "#6C7BFF" }}>
            Last 30 days pulse
          </p>
          <span className="rounded-full bg-surface px-2 py-0.5 text-[10.5px] font-semibold tnum text-accent">30D</span>
        </div>
        <div className="px-4 pt-1">
          <PulseLine values={pulsePts.map((x) => x.v)} color="#6C7BFF" />
        </div>
        <div className="grid grid-cols-4 gap-2 px-4 pt-1 pb-4">
          {[
            { label: "New views", value: fmtCompact(p30.newViews) },
            { label: "New eps", value: fmtCompact(p30.newEpisodes) },
            { label: "Followers", value: fmtSigned(p30.newFollowers) },
            { label: "Daily avg", value: fmtCompact(p30.dailyAvg) },
          ].map((it) => (
            <div key={it.label} className="min-w-0">
              <p className="truncate text-[9.5px] font-semibold uppercase tracking-[0.1em] text-[#5A69F5]">{it.label}</p>
              <p className="mt-1 truncate text-[15.5px] font-semibold tnum text-ink">{it.value}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* growth trend */}
      <Card i={4} className="mt-2.5 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[15px] font-semibold tracking-[-0.01em]">Growth trend</h3>
            <p className="mt-0.5 text-[11.5px] text-muted">
              {periodDef.label} · {metric === "views" ? "views" : "followers"}
            </p>
          </div>
          <div className="w-[152px]">
            <Segmented
              compact
              value={metric}
              onChange={setMetric}
              options={[
                { value: "views", label: "Views" },
                { value: "followers", label: "Followers" },
              ]}
            />
          </div>
        </div>

        <div className="mt-3">
          <AreaChart series={overlay} height={172} yFormat={fmtCompact} />
        </div>

        <div className="mt-1.5 flex items-center justify-between text-[10.5px] tnum text-muted">
          <span>{chartPts.length ? shortDate(chartPts[0].date) : ""}</span>
          <span>
            {filter === "all" && metric === "views"
              ? "Overlay: 3 channels"
              : `${fmtCompact(chartPts[chartPts.length - 1]?.v ?? 0)} now`}
          </span>
          <span>{chartPts.length ? shortDate(chartPts[chartPts.length - 1].date) : ""}</span>
        </div>

        {filter === "all" && metric === "views" && (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-hair pt-3">
            {data.channels.map((c) => {
              const share = split.find((s) => s.id === c.id)?.share ?? 0;
              return (
                <span key={c.id} className="flex items-center gap-1.5 text-[11.5px] text-muted">
                  <Dot color={c.colorHex} size={7} />
                  {c.name.split(" ")[0]}
                  <b className="font-semibold tnum text-ink">{Math.round(share)}%</b>
                </span>
              );
            })}
          </div>
        )}
      </Card>

      {/* podium */}
      <Card i={5} className="mt-2.5 p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[15px] font-semibold tracking-[-0.01em]">Top stories</h3>
          <div className="w-[190px]">
            <Segmented
              compact
              value={mode}
              onChange={setMode}
              options={[
                { value: "gain", label: "30D gain" },
                { value: "total", label: "Views" },
                { value: "rating", label: "Rating" },
              ]}
            />
          </div>
        </div>

        <div className="mt-1 divide-y divide-hair">
          {top.map((row, i) => (
            <button
              key={row.story.id}
              type="button"
              onClick={() => setDetail({ type: "story", id: row.story.id })}
              className="press flex w-full items-center gap-3 py-3 text-left"
            >
              <RankBadge rank={i + 1} />
              <StoryThumb layoutId={`story-${row.story.id}`} cover={row.story.coverUri} color={row.channelColor} title={row.story.title} />
              <div className="min-w-0 flex-1">
                <p className="deva truncate text-[14.5px] font-medium">{row.story.title}</p>
                <p className="mt-0.5 flex items-center gap-1.5 truncate text-[11.5px] text-muted">
                  <Dot color={row.channelColor} size={6} />
                  {row.episodeCount} eps · ★ {fmtRating(row.rating)} · {fmtPct(row.viewsPct)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[14px] font-semibold tnum">{fmtCompact(row.views)}</p>
                <p className="mt-0.5 text-[11.5px] font-semibold tnum text-pos">{fmtSigned(row.viewsGain)}</p>
              </div>
              <ChevronRight size={14} className="shrink-0 text-muted" />
            </button>
          ))}
          {!top.length && <p className="py-6 text-center text-[12.5px] text-muted">No stories yet.</p>}
        </div>
      </Card>
    </div>
  );
}
